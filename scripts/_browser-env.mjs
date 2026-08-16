#!/usr/bin/env node
// _browser-env.mjs — ONE place that (a) resolves playwright-core and (b) makes the browser's
// network actually work inside a policy-proxied sandbox.
//
// WHY THIS EXISTS
// ---------------
// Some managed/cloud dev environments (Claude Code on the web, Cursor cloud, CI runners behind an
// egress policy) allow outbound HTTPS *only* through a local CONNECT proxy ($HTTPS_PROXY). Node
// honours that proxy; Chromium's own network stack does not, and the policy layer resets anything
// the browser dials directly. The symptom is the one verify-app.mjs already warns about:
//
//     net::ERR_CONNECTION_RESET  https://cdn.velt.dev/lib/sdk@…/velt.js
//     → velt-* tags exist but the SDK never DEFINED them ("PRESENT BUT NOT BOOTED")
//
// while `curl https://cdn.velt.dev/…` from the very same shell returns 200. Every measurement then
// runs against an app whose SDK never booted — the exact false-surface the measure scripts exist to
// prevent, arriving through the network layer instead of the headless-browser layer.
//
// THE FIX: move the I/O from the blocked client to the allowed one. We intercept every external
// request with Playwright's route() *before* Chromium's network stack sends it, perform the request
// from Node through the sanctioned CONNECT proxy, and fulfill the browser request with the real
// response. Loopback (the app under test) is left on Chromium's stack, which reaches localhost fine.
//
// TLS verification is never disabled — the Node side simply trusts the proxy's CA bundle
// ($NODE_EXTRA_CA_CERTS, already exported in these environments).
//
// SCOPE / SAFETY: the shim is OFF unless an egress proxy is actually configured, so on a normal
// laptop or a CI box with open egress this module changes nothing but the playwright-core lookup.
//   VELT_EGRESS_SHIM=auto   (default) active iff $HTTPS_PROXY / $https_proxy is set
//   VELT_EGRESS_SHIM=on     force on   ·   VELT_EGRESS_SHIM=off  force off
//
// KNOWN LIMIT: route() cannot intercept WebSockets, so a `wss://` connection still dies in the
// browser. Velt's realtime stack (Firebase RTDB / Firestore) falls back to HTTPS long-polling on
// its own, which IS intercepted — verified end-to-end (comments read + write) on the Harvey demo.
//
// Usage from a script:
//   import { loadChromium } from "./_browser-env.mjs";
//   const chromium = await loadChromium();     // already wrapped — launch/connect are shimmed
// Everything downstream (newContext / newPage / connectOverCDP) is patched transparently.

import http from "node:http";
import tls from "node:tls";
import fs from "node:fs";
import path from "node:path";

// ── playwright-core resolution ───────────────────────────────────────────────
// Ordered widest-net-last. $PLAYWRIGHT_CORE wins; then a plain specifier (local node_modules);
// then the known global install layouts, including `playwright`'s bundled copy — a globally
// installed `playwright` is the common case on managed runners, and its playwright-core is nested
// inside it, which a bare import() from this file can never resolve.
const CORE_CANDIDATES = () => [
  process.env.PLAYWRIGHT_CORE,
  "playwright-core",
  "playwright",
  path.join(process.env.HOME || "", ".claude/skills/gstack/node_modules/playwright-core/index.js"),
  "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core/index.js",
  "/opt/node22/lib/node_modules/playwright-core/index.js",
  "/usr/lib/node_modules/playwright/node_modules/playwright-core/index.js",
  "/usr/local/lib/node_modules/playwright/node_modules/playwright-core/index.js",
].filter(Boolean);

/** Resolve raw (unwrapped) chromium, or throw with the install hint. */
export async function loadChromiumRaw() {
  for (const c of CORE_CANDIDATES()) {
    try { const m = await import(c); const ch = (m.default || m).chromium; if (ch) return ch; }
    catch { /* try next */ }
  }
  throw new Error("playwright-core not found — `npm i -D playwright-core` or set $PLAYWRIGHT_CORE");
}

// ── egress shim ──────────────────────────────────────────────────────────────
const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || "";

export function egressShimActive() {
  const mode = (process.env.VELT_EGRESS_SHIM || "auto").toLowerCase();
  if (mode === "off" || mode === "0" || mode === "false") return false;
  if (mode === "on" || mode === "1" || mode === "true") return !!PROXY_URL;
  return !!PROXY_URL;                                    // auto
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1|0\.0\.0\.0)$/i;

// Transport-level headers describing the upstream wire format. Node has already dechunked and
// decompressed the body, so replaying these would make the browser decode a body that is plain.
const HOP_BY_HOP = new Set([
  "content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive",
  "proxy-authenticate", "proxy-authorization", "te", "trailer", "upgrade",
]);

let CA;
function caBundle() {
  if (CA !== undefined) return CA;
  const p = process.env.NODE_EXTRA_CA_CERTS || process.env.SSL_CERT_FILE || "/root/.ccr/ca-bundle.crt";
  CA = (p && fs.existsSync(p)) ? fs.readFileSync(p) : null;
  return CA;
}

/** Open a TCP tunnel to host:port through the sanctioned CONNECT proxy. */
function tunnel(host, port) {
  const proxy = new URL(PROXY_URL);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: proxy.hostname,
      port: proxy.port || 80,
      method: "CONNECT",
      path: `${host}:${port}`,
      headers: { Host: `${host}:${port}` },
      timeout: 30_000,
    });
    req.once("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        // 403/407 here is an ORG EGRESS POLICY denial for that host — surface it, never retry.
        return reject(new Error(`proxy CONNECT ${host}:${port} -> ${res.statusCode}`));
      }
      resolve(socket);
    });
    req.once("error", reject);
    req.once("timeout", () => req.destroy(new Error("proxy CONNECT timeout")));
    req.end();
  });
}

/** Perform one HTTP(S) request from Node, through the proxy tunnel. */
async function proxiedRequest({ url, method, headers, body }) {
  const u = new URL(url);
  const port = u.port || (u.protocol === "https:" ? 443 : 80);
  const socket = await tunnel(u.hostname, port);

  return new Promise((resolve, reject) => {
    const opts = { method, path: u.pathname + u.search, headers: { ...headers, host: u.host }, timeout: 45_000 };
    const send = (sock) => {
      const req = http.request({ ...opts, createConnection: () => sock }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.once("error", reject);
      req.once("timeout", () => req.destroy(new Error("upstream timeout")));
      if (body) req.write(body);
      req.end();
    };
    if (u.protocol === "https:") {
      const secure = tls.connect({
        socket,
        servername: u.hostname,
        ca: caBundle() || undefined,
        rejectUnauthorized: true,          // verification stays ON, just against the proxy's CA
      });
      secure.once("secureConnect", () => send(secure));
      secure.once("error", reject);
    } else {
      send(socket);
    }
  });
}

const SHIMMED = new WeakSet();

/**
 * Install the route interceptor on a BrowserContext. Idempotent per context.
 * @param {import('playwright-core').BrowserContext} context
 */
export async function installEgressShim(context) {
  if (!context || SHIMMED.has(context) || !egressShimActive()) return false;
  SHIMMED.add(context);

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();

    let u;
    try { u = new URL(url); } catch { return route.continue(); }
    // The app under test, and non-http schemes (data:, blob:, file:), stay on Chromium's stack.
    if (LOOPBACK.test(u.hostname) || !/^https?:$/.test(u.protocol)) return route.continue();

    // CORS preflight answered locally. The real request right after is proxied for real, so this
    // hides no genuine upstream failure — it only skips a round trip the sandbox would reset.
    if (request.method() === "OPTIONS") {
      const h = request.headers();
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": h["origin"] || "*",
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": h["access-control-request-headers"] || "*",
          "access-control-max-age": "600",
        },
        body: "",
      });
    }

    const outHeaders = { ...request.headers() };
    delete outHeaders["accept-encoding"];      // let Node negotiate its own encoding upstream
    delete outHeaders["host"];

    try {
      const res = await proxiedRequest({
        url,
        method: request.method(),
        headers: outHeaders,
        body: request.postDataBuffer() || undefined,
      });
      const outbound = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (HOP_BY_HOP.has(k.toLowerCase())) continue;
        outbound[k] = Array.isArray(v) ? v.join(", ") : v;
      }
      // The browser still enforces CORS on a fulfilled response. Only fill in allow-origin when
      // upstream sent none, so a genuine CORS misconfiguration in the app stays visible.
      if (!Object.keys(outbound).some((k) => k.toLowerCase() === "access-control-allow-origin")) {
        outbound["access-control-allow-origin"] = request.headers()["origin"] || "*";
        outbound["access-control-allow-credentials"] = "true";
      }
      await route.fulfill({ status: res.status, headers: outbound, body: res.body });
    } catch (err) {
      if (process.env.VELT_EGRESS_DEBUG) console.error(`[egress-shim] ${request.method()} ${url} :: ${err.message}`);
      await route.abort("failed");
    }
  });
  return true;
}

/**
 * Patch a Browser so every context it hands out is shimmed. Idempotent.
 * Async because callers routinely reach straight for `browser.contexts()[0]` after
 * connectOverCDP — the default context must already be routed before they do.
 */
export async function patchBrowser(browser) {
  if (!browser || SHIMMED.has(browser) || !egressShimActive()) return browser;
  SHIMMED.add(browser);

  // Contexts that already exist — the default context of a CDP-attached browser lives here.
  for (const ctx of browser.contexts?.() || []) await installEgressShim(ctx).catch(() => {});

  const origNewContext = browser.newContext?.bind(browser);
  if (origNewContext) {
    browser.newContext = async (...args) => {
      const ctx = await origNewContext(...args);
      await installEgressShim(ctx).catch(() => {});
      return ctx;
    };
  }
  const origNewPage = browser.newPage?.bind(browser);
  if (origNewPage) {
    browser.newPage = async (...args) => {
      const page = await origNewPage(...args);
      await installEgressShim(page.context()).catch(() => {});
      return page;
    };
  }
  return browser;
}

/** Wrap a chromium namespace so every browser it produces is patched. */
export function wrapChromium(chromium) {
  if (!egressShimActive()) return chromium;
  const wrap = (fn) => fn && (async (...args) => patchBrowser(await fn(...args)));
  return new Proxy(chromium, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (prop === "launch" || prop === "connect" || prop === "connectOverCDP") {
        return wrap(typeof v === "function" ? v.bind(target) : v);
      }
      if (prop === "launchPersistentContext" && typeof v === "function") {
        return async (...args) => {
          const ctx = await v.bind(target)(...args);
          await installEgressShim(ctx).catch(() => {});
          return ctx;
        };
      }
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

/** The one call scripts should use: resolved AND shimmed. */
export async function loadChromium() {
  return wrapChromium(await loadChromiumRaw());
}

// ── CLI: `node scripts/_browser-env.mjs` prints a diagnosis ──────────────────
if (process.argv[1] && process.argv[1].endsWith("_browser-env.mjs")) {
  const out = { proxy: PROXY_URL || null, shimActive: egressShimActive(), caBundle: !!caBundle() };
  try { await loadChromiumRaw(); out.playwrightCore = "ok"; }
  catch (e) { out.playwrightCore = e.message; }
  if (out.shimActive) {
    try {
      const r = await proxiedRequest({ url: "https://cdn.velt.dev/", method: "GET", headers: {} });
      out.proxyProbe = `cdn.velt.dev -> ${r.status} (${r.body.length}b)`;
    } catch (e) { out.proxyProbe = `FAILED: ${e.message}`; }
  }
  console.log(JSON.stringify(out, null, 2));
}

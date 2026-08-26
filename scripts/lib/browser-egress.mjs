// browser-egress.mjs — make the measurement browser able to load Velt in a proxied sandbox.
//
// WHY THIS EXISTS (guide/debugging.md "Fix B", now implemented instead of merely described):
// in sandboxed cloud runners (claude.ai/code, Cursor background agents) the egress proxy breaks
// Chromium's TLS handshake inside the CONNECT tunnel while Node's own fetch succeeds against the
// SAME host. Symptom: `verify-app.mjs` reports `veltBooted:false` ("present but not booted") and
// the browser network log shows ERR_CONNECTION_RESET on Velt's SDK bundle host, while
// `curl -sI <same url>` from the same box returns 200. Measured live on the Harvey demo:
//   Chromium  → https://serveprivatenpmpackage-…run.app/sdk-dev/lib/sdk@…/velt.js  ERR_CONNECTION_RESET
//   Node fetch→ same URL                                                            200, 320311 bytes
//
// The fix moves the actual network I/O from the blocked client (Chromium) to an allowed one (Node):
// every external request the page makes is caught by Playwright's request interception BEFORE
// Chromium's network stack sends it, performed by Node, and the response handed back to the page.
//
// SCOPE / LIMITS (know these before trusting a green run):
//   • Loopback is NEVER intercepted — the app under test, its HMR/SSE channel and any local API
//     keep talking to Chromium directly, so nothing about the measured app changes.
//   • WebSockets are NOT interceptable via route(). Velt's Firebase transport degrades to HTTP
//     long-polling on its own when the WS is reset, and that long-polling IS intercepted — verified
//     live (sidebar rendered real threads). A host with a hard WS dependency would still need Fix A.
//   • Responses are buffered, not streamed. Fine for the SDK bundle, Firestore `Listen/channel`
//     chunks and Firebase `.lp` polls (all measured working); a genuinely infinite stream would hang.
//
// ENABLEMENT — `VELT_BROWSER_PROXY_FETCH`:
//   "1"/"on"/"true"  → always intercept
//   "0"/"off"/"false"→ never intercept (use on a normal machine, or with Fix A's mitmproxy)
//   unset / "auto"   → intercept only when an egress proxy is configured (HTTPS_PROXY/HTTP_PROXY),
//                      which is the sandbox signature. A normal dev machine therefore behaves
//                      exactly as before this file existed.

// ─────────────────────────────────────────────────────────────────────────────
// Bring-up: finding playwright-core at all.
// The loaders try $PLAYWRIGHT_CORE, then a BARE "playwright-core" specifier — which only resolves
// for a LOCAL install. A globally-installed Playwright (`npm i -g playwright`, the shape cloud
// runners ship) is not on Node's resolution path at all, so every measurement script died with
// "playwright-core not found" until $PLAYWRIGHT_CORE was exported by hand. Derive that global
// location from the running interpreter instead, so the fallback is automatic.
import { existsSync } from "node:fs";
import nodePath from "node:path";

export function globalPlaywrightCore() {
  try {
    const root = nodePath.join(nodePath.dirname(nodePath.dirname(process.execPath)), "lib", "node_modules");
    for (const rel of ["playwright-core/index.js", "playwright/node_modules/playwright-core/index.js"]) {
      const p = nodePath.join(root, rel);
      if (existsSync(p)) return p;
    }
  } catch { /* fall through — the bare specifier may still resolve */ }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

const LOOPBACK_RE = /^(localhost|127(?:\.\d+){1,3}|0\.0\.0\.0|\[?::1\]?|host\.docker\.internal)$/i;

// Headers that describe THIS hop, not the payload — forwarding them corrupts the replayed request.
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
]);

const ARMED = new WeakSet();   // contexts/pages already routed — installing twice would double-fetch

export function isLoopbackUrl(url) {
  try { return LOOPBACK_RE.test(new URL(url).hostname); } catch { return false; }
}

/** "on" | "off" | "auto" → the resolved boolean, so callers can log WHY they did or didn't arm. */
export function egressInterceptionEnabled() {
  const raw = (process.env.VELT_BROWSER_PROXY_FETCH || "auto").toLowerCase();
  if (["1", "on", "true", "yes"].includes(raw)) return { enabled: true, why: `VELT_BROWSER_PROXY_FETCH=${raw}` };
  if (["0", "off", "false", "no"].includes(raw)) return { enabled: false, why: `VELT_BROWSER_PROXY_FETCH=${raw}` };
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  return proxy
    ? { enabled: true, why: `auto: egress proxy detected (${proxy})` }
    : { enabled: false, why: "auto: no egress proxy configured — browser talks to the network directly" };
}

/**
 * Install the interception on a BrowserContext (preferred — covers pages opened later) or a Page.
 * Idempotent. Returns a live stats object the caller may print into the journal.
 */
export async function installProxyFetch(target, { onEvent } = {}) {
  const stats = { intercepted: 0, bypassed: 0, failed: 0, hosts: new Set() };
  if (!target || ARMED.has(target)) return stats;
  ARMED.add(target);

  await target.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();

    // Loopback + non-HTTP (data:, blob:, file:) stay on Chromium's own stack.
    if (!/^https?:/i.test(url) || isLoopbackUrl(url)) { stats.bypassed++; return route.continue(); }

    try {
      const headers = { ...req.headers() };
      for (const k of Object.keys(headers)) {
        const lk = k.toLowerCase();
        if (HOP_BY_HOP.has(lk) || lk === "host" || lk.startsWith(":")) delete headers[k];
      }

      const res = await fetch(url, {
        method: req.method(),
        headers,
        body: req.postDataBuffer() ?? undefined,
        redirect: "follow",
      });
      const body = Buffer.from(await res.arrayBuffer());

      const out = {};
      for (const [k, v] of res.headers) {
        const lk = k.toLowerCase();
        // fetch already decompressed the body, so the upstream length/encoding no longer describe
        // what we are about to hand the page — sending them makes Chromium reject the response.
        if (HOP_BY_HOP.has(lk) || lk === "content-encoding" || lk === "content-length") continue;
        out[k] = v;
      }

      stats.intercepted++;
      try { stats.hosts.add(new URL(url).host); } catch { /* non-parseable — count only */ }
      onEvent?.({ kind: "ok", url, status: res.status, bytes: body.length });
      await route.fulfill({ status: res.status, headers: out, body });
    } catch (e) {
      // Node couldn't fetch it either. Hand it back to Chromium rather than abort: on a machine
      // where only SOME hosts are blocked, the browser may well succeed where Node just failed.
      stats.failed++;
      onEvent?.({ kind: "fail", url, error: e.message });
      await route.continue().catch(() => route.abort().catch(() => {}));
    }
  });

  return stats;
}

/** Arm every context a browser already has, and every one it creates from here on. Idempotent. */
export async function armBrowser(browser, opts = {}) {
  const { enabled, why } = egressInterceptionEnabled();
  if (!enabled || !browser || ARMED.has(browser)) return { armed: false, why };
  ARMED.add(browser);

  for (const ctx of browser.contexts()) await installProxyFetch(ctx, opts).catch(() => {});

  // A CDP-connected run REUSES the default context (measure-block.openPage), but a fresh
  // newContext() must be armed too — patch the factory so no call site can forget.
  const origNewContext = browser.newContext?.bind(browser);
  if (origNewContext) {
    browser.newContext = async (...args) => {
      const ctx = await origNewContext(...args);
      await installProxyFetch(ctx, opts).catch(() => {});
      return ctx;
    };
  }
  return { armed: true, why };
}

/**
 * Wrap a chromium namespace so EVERY browser it hands out is armed — launch(), connect() and
 * connectOverCDP() alike. This is the single line each script's loadChromium() needs, so a new
 * measurement script inherits the fix instead of re-discovering the bug.
 */
export function armChromium(chromium, opts = {}) {
  if (!chromium || ARMED.has(chromium)) return chromium;
  const { enabled } = egressInterceptionEnabled();
  if (!enabled) return chromium;
  ARMED.add(chromium);

  const wrapped = Object.create(chromium);
  for (const m of ["launch", "connect", "connectOverCDP"]) {
    if (typeof chromium[m] !== "function") continue;
    wrapped[m] = async (...args) => {
      const browser = await chromium[m](...args);
      await armBrowser(browser, opts).catch(() => {});
      return browser;
    };
  }
  return wrapped;
}

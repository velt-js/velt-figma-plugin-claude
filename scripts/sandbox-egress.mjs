#!/usr/bin/env node
// sandbox-egress.mjs — make the measurement browser able to reach the internet
// inside a locked-down agent sandbox (claude.ai/code cloud containers).
//
// THE PROBLEM (verify-app.mjs already names it in its own failure text: "an
// egress proxy can break Chromium's TLS while curl succeeds")
// ---------------------------------------------------------------------------
// In these containers all egress goes through a policy proxy ($HTTPS_PROXY) and
// only sanctioned clients are allowed through it. Node/curl succeed; Chromium
// does not — every external host dies with ERR_CONNECTION_RESET. Pointing
// Chromium at the proxy with --proxy-server does NOT help: the CONNECT returns
// 200 and the connection is then killed during Chromium's TLS handshake, so it
// is the client that is being rejected, not the route. Measured here: curl
// through a hand-written CONNECT relay → 200; Chromium through that same relay
// → ERR_CONNECTION_CLOSED.
//
// Net effect on a run: cdn.velt.dev never loads, so React still renders the
// <velt-*> JSX tags but the SDK never defines them — exactly the
// "PRESENT BUT NOT BOOTED" state verify-app.mjs reports, and every downstream
// measurement is taken against an empty surface.
//
// THE FIX
// ---------------------------------------------------------------------------
// Move the network I/O off the blocked client and onto the allowed one. Every
// request the page makes is intercepted before Chromium's socket layer sees it
// and re-pointed at a local Node HTTPS server, which performs the real request
// through the sanctioned proxy and streams the response back.
//
// Why re-point (route.continue) rather than answer in Node (route.fulfill):
// fulfill() needs a COMPLETE body, so it cannot represent a streaming response.
// Velt's realtime layer is Firestore WebChannel, whose backchannel is a
// long-lived GET that never completes — buffering it desynchronises the session
// and Google starts answering 400. Measured: with fulfill() the sidebar renders
// its shell and stays empty (0 comment dialogs); re-pointed and streamed, the
// same page loads 34. Playwright requires a rewritten URL to keep its protocol,
// which is why the local server speaks TLS.
//
// WebSockets never surface in route() at all, and Chromium cannot open them
// here either, so they go through routeWebSocket + connectToServer, which
// performs the upgrade from Playwright's own (allowed) Node process.
//
// The local server's self-signed cert is whitelisted by SPKI hash rather than
// by disabling certificate checking, so normal TLS verification stays on.
//
// OPT-IN: does nothing unless VELT_SANDBOX_EGRESS=1. Outside these sandboxes
// the browser should talk to the network directly — that is the correct design
// everywhere else, and this shim is pure overhead.
//
// Usage from a measurement script:
//   import { sandboxLaunchArgs, installSandboxEgress } from "./sandbox-egress.mjs";
//   const browser = await chromium.launch({ headless: true, args: [...sandboxLaunchArgs()] });
//   const ctx = await browser.newContext({...});
//   const egress = await installSandboxEgress(ctx);      // no-op when disabled
//   ...
//   await egress?.close();

import net from "node:net";
import tls from "node:tls";
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const TARGET_HEADER = "x-egress-target";
const LOCAL = /^(localhost|127\.0\.0\.1|\[?::1\]?|0\.0\.0\.0)$/i;
// Stable so a browser launched by one process (browser-endpoint.mjs --launch)
// and a shim started by another (measure-block.mjs) agree on the cert.
const CERT_DIR = path.join(os.tmpdir(), "velt-sandbox-egress");
const CA_BUNDLE = "/root/.ccr/ca-bundle.crt";

export const sandboxEgressEnabled = () => process.env.VELT_SANDBOX_EGRESS === "1";

// Silent unless tracing is asked for — measurement scripts print JSON on stdout,
// so diagnostics go to stderr.
const defaultLog = (m) => { if (process.env.VELT_SANDBOX_EGRESS_TRACE) console.error(m); };

const isLocal = (url) => { try { return LOCAL.test(new URL(url).hostname); } catch { return false; } };

// Self-signed cert for 127.0.0.1, generated once and reused.
function ensureCert() {
  const key = path.join(CERT_DIR, "key.pem"), cert = path.join(CERT_DIR, "cert.pem");
  if (!fs.existsSync(key) || !fs.existsSync(cert)) {
    fs.mkdirSync(CERT_DIR, { recursive: true, mode: 0o700 });
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
        "-keyout", key, "-out", cert, "-days", "3650", "-subj", "/CN=127.0.0.1",
        "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost"], { stdio: "ignore" });
    } catch (e) {
      throw new Error(`sandbox-egress: could not generate a local cert with openssl (${e.message})`);
    }
    fs.chmodSync(key, 0o600);
  }
  return { key, cert };
}

// Base64 SHA-256 of the cert's SubjectPublicKeyInfo — what Chromium's
// --ignore-certificate-errors-spki-list expects.
export function certSpki() {
  const { cert } = ensureCert();
  const pub = execFileSync("openssl", ["x509", "-in", cert, "-pubkey", "-noout"]);
  const der = execFileSync("openssl", ["pkey", "-pubin", "-outform", "der"], { input: pub });
  const dgst = execFileSync("openssl", ["dgst", "-sha256", "-binary"], { input: der });
  return dgst.toString("base64");
}

// Launch args the measurement browser needs. Empty unless enabled.
export function sandboxLaunchArgs() {
  if (!sandboxEgressEnabled()) return [];
  // Trust ONLY our local shim's key — every other certificate is still verified.
  return [`--ignore-certificate-errors-spki-list=${certSpki()}`];
}

// A socket to host:port, opened by tunnelling CONNECT through the agent proxy.
function tunnel(host, port) {
  const up = (process.env.HTTPS_PROXY || process.env.https_proxy || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!up) return Promise.reject(new Error("HTTPS_PROXY is not set — nothing to tunnel through"));
  const [ph, pp] = up.split(":");
  return new Promise((resolve, reject) => {
    const s = net.connect(Number(pp), ph, () => {
      s.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
    });
    s.unref();   // same reason as server.unref(): a long-poll socket must not pin the process
    s.setTimeout(30000, () => { s.destroy(); reject(new Error(`CONNECT ${host}:${port} timed out`)); });
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString("latin1");
      if (!buf.includes("\r\n\r\n")) return;
      s.removeListener("data", onData);
      s.setTimeout(0);
      if (!/^HTTP\/1\.[01] 200/.test(buf)) { s.destroy(); return reject(new Error(`proxy refused: ${buf.split("\r\n")[0]}`)); }
      resolve(s);
    };
    s.on("data", onData);
    s.on("error", reject);
  });
}

// The local streaming server every intercepted request is re-pointed at.
export async function startEgressServer({ log = defaultLog } = {}) {
  const { key, cert } = ensureCert();
  const ca = fs.existsSync(CA_BUNDLE) ? fs.readFileSync(CA_BUNDLE) : undefined;
  const stats = { streamed: 0, failed: 0, hosts: new Set(), errors: [] };

  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, async (req, res) => {
    const target = req.headers[TARGET_HEADER];
    if (!target) { res.writeHead(400).end("missing egress target"); return; }
    const u = new URL(target);
    const headers = { ...req.headers };
    delete headers[TARGET_HEADER];
    delete headers.connection;
    headers.host = u.host;             // upstream must see its own Host, not 127.0.0.1
    const secure = u.protocol === "https:";

    const fail = (e) => {
      stats.failed++;
      stats.errors.push(`${req.method} ${target.slice(0, 110)} → ${e.message}`);
      log(`[sandbox-egress] FAIL ${req.method} ${target.slice(0, 110)} → ${e.message}`);
      if (!res.headersSent) res.writeHead(502);
      res.end();
    };

    try {
      const raw = await tunnel(u.hostname, u.port || (secure ? 443 : 80));
      // The tunnel yields a PLAIN socket; https.request will not TLS-wrap a
      // socket given to it via createConnection, so do the handshake here.
      const socket = secure ? tls.connect({ socket: raw, servername: u.hostname, ca }) : raw;
      socket.on("error", fail);
      const client = (secure ? https : http).request(
        { method: req.method, path: u.pathname + u.search, headers, createConnection: () => socket },
        (up) => {
          stats.streamed++;
          stats.hosts.add(u.host);
          if (process.env.VELT_SANDBOX_EGRESS_TRACE) log(`[sandbox-egress] ${up.statusCode} ${req.method} ${target.slice(0, 130)}`);
          res.writeHead(up.statusCode, up.headers);
          up.pipe(res);                // the whole point: bytes flow as they arrive
        });
      client.on("error", fail);
      req.pipe(client);
    } catch (e) { fail(e); }
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  // Never keep the host process alive. Measurement scripts finish and exit
  // without closing the shim (there are ~27 of them), and a listening server
  // would hold the event loop open forever — the script prints its verdict and
  // then hangs until whatever timeout is watching it fires.
  server.unref();
  const port = server.address().port;
  log(`[sandbox-egress] streaming shim on https://127.0.0.1:${port}`);
  return { server, port, stats, close: () => new Promise((r) => server.close(r)) };
}

// Install on a browser context. No-op (returns null) unless VELT_SANDBOX_EGRESS=1,
// so this is safe to call unconditionally from every measurement script.
export async function installSandboxEgress(context, { log = defaultLog } = {}) {
  if (!sandboxEgressEnabled()) return null;
  const egress = await startEgressServer({ log });

  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    if (isLocal(url) || !/^https?:/i.test(url)) return route.continue();
    const u = new URL(url);
    await route.continue({
      url: `https://127.0.0.1:${egress.port}${u.pathname}${u.search}`,
      headers: { ...req.headers(), [TARGET_HEADER]: url },
    }).catch(() => route.continue().catch(() => {}));
  });

  // Match ONLY external sockets: a handler that neither connects nor closes
  // leaves the socket hanging, and swallowing the dev server's HMR socket that
  // way stalls hydration so the app never mounts (measured — the page loaded
  // and React never ran).
  await context.routeWebSocket((url) => !isLocal(String(url)), (ws) => {
    try { ws.connectToServer(); egress.stats.hosts.add(new URL(ws.url()).host); }
    catch (e) {
      egress.stats.failed++;
      egress.stats.errors.push(`WS ${ws.url().slice(0, 110)} → ${e.message}`);
      log(`[sandbox-egress] WS FAIL ${ws.url().slice(0, 110)} → ${e.message}`);
    }
  });

  return egress;
}

// `node scripts/sandbox-egress.mjs --check` — prove the shim works end to end.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const enabled = sandboxEgressEnabled();
  console.log(`VELT_SANDBOX_EGRESS=${process.env.VELT_SANDBOX_EGRESS ?? "(unset)"} → ${enabled ? "ENABLED" : "disabled (no-op)"}`);
  console.log(`HTTPS_PROXY=${process.env.HTTPS_PROXY || "(unset)"}`);
  if (enabled) {
    console.log(`cert dir: ${CERT_DIR}`);
    console.log(`launch args: ${sandboxLaunchArgs().join(" ")}`);
    const eg = await startEgressServer({ log: console.log });
    await eg.close();
    console.log("✓ shim starts and stops cleanly");
  }
}

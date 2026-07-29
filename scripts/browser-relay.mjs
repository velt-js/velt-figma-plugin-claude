#!/usr/bin/env node
// browser-relay.mjs — egress relay for the measurement browser in restricted sandboxes.
//
// Some managed cloud environments (e.g. Claude Code remote sandboxes) allow outbound
// HTTPS from CLI tools (curl / Node fetch honor $HTTPS_PROXY + the injected CA) but
// RESET any TLS handshake originating from Chromium's own network stack — even when
// Chromium is pointed at the same proxy. Result: the app page loads (localhost is
// fine) but `velt.js` from cdn.velt.dev never arrives, the SDK never boots, and
// verify-app.mjs correctly HALTs with "present but not booted".
//
// This daemon fixes that WITHOUT touching any other script: it attaches to the
// measurement browser over raw CDP (Node >= 22 built-in WebSocket, zero deps),
// auto-attaches to every page/frame target, enables the Fetch domain, and for every
// non-localhost request performs the fetch IN NODE (which uses the sanctioned
// $HTTPS_PROXY path) and fulfills the paused browser request with the result.
// Local requests continue untouched. Because interception happens at the browser
// level, every OTHER client driving the same browser (verify-app.mjs,
// measure-block.mjs, capture-block.mjs, dom-snapshot.mjs, …) transparently gets
// working egress with no code changes and no flags beyond the usual --connect.
//
// Known limit: the Fetch domain cannot intercept WebSocket upgrades, so wss://
// realtime channels still fail in such sandboxes; Velt/Firebase falls back to
// long-polling (verified working). Not needed in normal local runs — only start
// this when the environment resets browser-originated TLS.
//
// Usage:
//   node scripts/browser-endpoint.mjs --launch     # prints ws://…/devtools/browser/<id>
//   node scripts/browser-relay.mjs <browser-ws>    # keep running for the whole run
//   NODE_USE_ENV_PROXY=1 must be set (or Node must otherwise reach the proxy).
//
// Exit codes: 0 clean stop (SIGINT/SIGTERM or browser closed) · 1 usage/connect error.

const wsUrl = process.argv[2];
if (!wsUrl || !/^wss?:\/\//.test(wsUrl)) {
  console.error("usage: browser-relay.mjs <ws://…/devtools/browser/…>  (from browser-endpoint.mjs --launch)");
  process.exit(1);
}
if (process.env.NODE_USE_ENV_PROXY !== "1" && process.env.HTTPS_PROXY) {
  console.error("⚠ NODE_USE_ENV_PROXY=1 is not set — Node's fetch may bypass $HTTPS_PROXY and fail the same way the browser does. Restart with NODE_USE_ENV_PROXY=1.");
}

const LOCAL_RE = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const STRIP_REQ = /^(host|connection|content-length|accept-encoding|proxy-)/i;
const STRIP_RES = /^(content-encoding|content-length|transfer-encoding|connection)$/i;

let nextId = 0;
const pending = new Map();
const ws = new WebSocket(wsUrl);
const send = (method, params = {}, sessionId = undefined) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });

let relayed = 0, passed = 0, failed = 0;

async function onRequestPaused(sessionId, p) {
  const { requestId, request } = p;
  let host = "";
  try { host = new URL(request.url).hostname; } catch { /* fall through to continue */ }
  if (!host || LOCAL_RE.test(host)) {
    passed++;
    return send("Fetch.continueRequest", { requestId }, sessionId).catch(() => {});
  }
  try {
    const headers = {};
    for (const [k, v] of Object.entries(request.headers || {})) if (!STRIP_REQ.test(k)) headers[k] = v;
    const resp = await fetch(request.url, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.postData,
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });
    const body = Buffer.from(await resp.arrayBuffer());
    const responseHeaders = [];
    resp.headers.forEach((value, name) => { if (!STRIP_RES.test(name)) responseHeaders.push({ name, value }); });
    relayed++;
    await send("Fetch.fulfillRequest", {
      requestId,
      responseCode: resp.status,
      responseHeaders,
      body: body.toString("base64"),
    }, sessionId);
  } catch (e) {
    failed++;
    console.error(`✗ relay ${request.method} ${request.url.slice(0, 120)} — ${String(e.message || e).slice(0, 120)}`);
    await send("Fetch.failRequest", { requestId, errorReason: "ConnectionReset" }, sessionId).catch(() => {});
  }
}

async function armSession(sessionId) {
  // Per-target: intercept everything at the Request stage, recurse into child targets (OOPIFs, popups).
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] }, sessionId).catch(() => {});
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId).catch(() => {});
  await send("Runtime.runIfWaitingForDebugger", {}, sessionId).catch(() => {});
}

ws.onmessage = (ev) => {
  const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === "Target.attachedToTarget") armSession(msg.params.sessionId);
  else if (msg.method === "Fetch.requestPaused") onRequestPaused(msg.sessionId, msg.params);
};

ws.onopen = async () => {
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  console.log(`▶ browser-relay armed on ${wsUrl}`);
  console.log("  external requests are fetched in Node (via $HTTPS_PROXY) and fulfilled into the browser; localhost passes through.");
  setInterval(() => console.log(`  · relayed ${relayed} · passthrough ${passed} · failed ${failed}`), 30_000).unref();
};
ws.onclose = () => { console.log(`browser closed — relay stopping (relayed ${relayed}, passthrough ${passed}, failed ${failed})`); process.exit(0); };
ws.onerror = (e) => { console.error("✗ relay ws error:", e.message || e); process.exit(1); };
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

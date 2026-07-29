#!/usr/bin/env node
// cdp-proxy-browser.mjs — dedicated measurement browser for sandboxes whose BROWSER egress is
// blocked while Node-side HTTP works (verified on a Claude Code cloud sandbox, 2026-07-29: the
// Harvey app's Chromium got connection-reset on cdn.velt.dev — Velt "PRESENT BUT NOT BOOTED" in
// verify-app.mjs — while Node's fetch traversed the sandbox's sanctioned HTTPS proxy fine).
//
// It launches a headless Chromium exposing CDP on --port (default 9222) and arms BROWSER-WIDE
// request interception over raw CDP (Target.setAutoAttach + Fetch.enable per session): every
// target — including pages created LATER by OTHER CDP clients, i.e. verify-app.mjs / capture-block.mjs /
// measure-block.mjs with `--connect` — has its non-localhost HTTP(S) requests fetched from NODE
// (playwright's APIRequestContext, which honors $HTTPS_PROXY + the sandbox CA) and fulfilled back
// into the page (Fetch.fulfillRequest). localhost passes through untouched. The plugin's scripts
// stay UNMODIFIED — direct browser networking is the normal, correct design everywhere except
// this sandbox class; this helper only swaps WHERE the bytes travel.
//
// Known limits:
//   * WebSockets can't be intercepted via the Fetch domain — wss:// (e.g. Firebase realtime)
//     still fails in-browser; Firebase falls back to HTTP long-polling, which IS proxied (verified:
//     comments load). Expect data readiness to lag a few extra seconds — give captures a drive
//     wait (--eval) rather than relying on fixed settle delays.
//   * Bodies are buffered in Node — fine for SDK/API/CDN traffic, not for large media streams.
//
// Usage:
//   node scripts/cdp-proxy-browser.mjs [--port 9222] [--chrome /path/to/chrome]
// Prints the browser CDP ws endpoint on stdout (keep the process alive for the whole run):
//   export VELT_CDP_WS=<printed ws url>       # browser-endpoint.mjs then resolves it
//   node scripts/verify-app.mjs <url> --connect "$VELT_CDP_WS" ...
// Chrome binary resolution: --chrome, $VELT_CHROME_BIN, else playwright-core's bundled chromium.
// playwright-core resolution: $PLAYWRIGHT_CORE, else a normal import (same as verify-app.mjs).

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadPlaywrightCore() {
  const candidates = [process.env.PLAYWRIGHT_CORE, "playwright-core",
    path.join(process.env.HOME || "", ".claude/skills/gstack/node_modules/playwright-core/index.js")].filter(Boolean);
  for (const c of candidates) {
    try { const m = await import(c); return m.default || m; } catch { /* try next */ }
  }
  throw new Error("playwright-core not found — `npm i -D playwright-core` or set $PLAYWRIGHT_CORE to its index.js");
}

async function main() {
  const argv = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const PORT = +argv("--port", "9222");
  const pw = await loadPlaywrightCore();
  const chromeBin = argv("--chrome", process.env.VELT_CHROME_BIN || pw.chromium.executablePath());

  // Node-side fetcher that provably traverses the sandbox proxy: playwright's APIRequestContext
  // (the same machinery page.route().fetch() uses).
  const fetcher = await pw.request.newContext();

  const profile = mkdtempSync(path.join(tmpdir(), "cdp-proxy-profile-"));
  const chrome = spawn(chromeBin, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", () => {});
  chrome.on("exit", (code) => { console.error(`✗ chrome exited (${code})`); process.exit(code ?? 1); });

  let wsUrl = null;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!wsUrl) { console.error("✗ CDP never came up on :" + PORT); process.exit(3); }

  // ---- raw CDP client (Node ≥22 global WebSocket) ----
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId = undefined) => new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const eventHandlers = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method) eventHandlers.get(msg.method)?.(msg.params, msg.sessionId);
  };
  const on = (method, fn) => eventHandlers.set(method, fn);

  const stats = { proxied: 0, passed: 0, failed: 0 };
  const isLocal = (h) => h === "localhost" || h === "127.0.0.1" || h === "::1";

  on("Fetch.requestPaused", async (p, sessionId) => {
    const { requestId, request } = p;
    let host = "";
    try { host = new URL(request.url).hostname; } catch { /* fall through to passthrough */ }
    if (isLocal(host) || !/^https?:/.test(request.url)) {
      stats.passed++;
      return send("Fetch.continueRequest", { requestId }, sessionId).catch(() => {});
    }
    try {
      const headers = { ...request.headers };
      delete headers["Accept-Encoding"]; delete headers["accept-encoding"];
      const resp = await fetcher.fetch(request.url, {
        method: request.method, headers, data: request.postData ?? undefined,
        maxRedirects: 10, timeout: 45000, failOnStatusCode: false,
      });
      const body = await resp.body();
      // body is already decoded — strip encoding/length/hop-by-hop, re-set content-length
      const responseHeaders = Object.entries(resp.headers())
        .filter(([k]) => !/^(content-encoding|content-length|transfer-encoding|connection|keep-alive|set-cookie)$/i.test(k))
        .map(([name, value]) => ({ name, value }));
      for (const h of resp.headersArray()) if (/^set-cookie$/i.test(h.name)) responseHeaders.push(h);
      responseHeaders.push({ name: "content-length", value: String(body.length) });
      stats.proxied++;
      await send("Fetch.fulfillRequest", {
        requestId, responseCode: resp.status(), responseHeaders, body: body.toString("base64"),
      }, sessionId);
    } catch (e) {
      stats.failed++;
      console.error(`✗ proxy-fetch failed: ${request.url.slice(0, 100)} — ${String(e).split("\n")[0].slice(0, 120)}`);
      send("Fetch.failRequest", { requestId, errorReason: "ConnectionReset" }, sessionId).catch(() => {});
    }
  });

  const armSession = async (sessionId) => {
    try {
      await send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }, sessionId);
      // cascade to nested targets (OOPIFs, popups, workers) created under this one
      await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId).catch(() => {});
      await send("Runtime.runIfWaitingForDebugger", {}, sessionId).catch(() => {});
    } catch (e) { console.error("✗ arm session failed:", String(e).slice(0, 120)); }
  };
  on("Target.attachedToTarget", (p) => {
    const t = p.targetInfo || {};
    if (["page", "iframe", "other", "service_worker", "shared_worker", "webview"].includes(t.type)) armSession(p.sessionId);
    else send("Runtime.runIfWaitingForDebugger", {}, p.sessionId).catch(() => {});
  });
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });

  console.log(wsUrl);
  console.error(`▶ interception-armed measurement browser on :${PORT} (chrome pid ${chrome.pid})`);
  console.error(`  export VELT_CDP_WS=${wsUrl}`);
  setInterval(() => {
    if (stats.proxied + stats.failed > 0)
      console.error(`  [stats] proxied=${stats.proxied} passthrough=${stats.passed} failed=${stats.failed}`);
  }, 30000).unref?.();

  const shutdown = () => { try { chrome.kill(); } catch { /* already gone */ } process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });

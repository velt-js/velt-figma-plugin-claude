// _egress-relay.mjs — make the measurement browser reach the internet inside a
// locked-down sandbox (Claude Code on the web, CI runners behind a MITM egress proxy).
//
// WHY THIS EXISTS
// The measurement scripts drive Chromium and let it talk to the network directly.
// That is the correct design everywhere except a sandbox that (a) routes all egress
// through an authenticated MITM proxy and (b) gives the browser no way to trust that
// proxy's CA (no `certutil`, no NSS db). There, `curl https://cdn.velt.dev` succeeds
// while the SAME fetch from Chromium dies with ERR_CONNECTION_RESET — which is exactly
// the "PRESENT BUT NOT BOOTED" false negative verify-app.mjs warns about: React renders
// the <velt-*> tags, the SDK bundle never loads, nothing is ever DEFINED.
//
// THE FIX
// Move the network I/O from the blocked client to an allowed one. Every cross-origin
// request the page makes is intercepted BEFORE Chromium's network stack sends it,
// performed by Node (which does reach the sanctioned proxy), and the response is handed
// back to the page. No TLS verification is disabled anywhere: Node still validates the
// chain, and the proxy still enforces the egress policy.
//
// OPT-IN ONLY. Off unless VELT_EGRESS_RELAY is set, so normal machines — where the
// browser's own networking is fine and faster — are completely unaffected.
//
//   export VELT_EGRESS_RELAY=1
//
// Usage from a measurement script, right after the context is acquired:
//   import { installEgressRelay } from "./_egress-relay.mjs";
//   await installEgressRelay(ctx);

const LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i;

// Firestore's webchannel Listen stream stays open for the life of the subscription.
// route.fulfill() cannot stream, so cap it: deliver whatever arrived and let the SDK
// re-poll. Long enough that the initial document snapshot always lands.
const STREAMING_RE = /firestore\.googleapis\.com\/.*\/(Listen|Write)\/channel/i;

const HOP_BY_HOP = ["host", "connection", "content-length", "transfer-encoding", "accept-encoding", "keep-alive", "upgrade"];

const installed = new WeakSet();

export function relayEnabled() {
  const v = process.env.VELT_EGRESS_RELAY;
  return !!v && v !== "0" && v.toLowerCase() !== "false";
}

/**
 * Route the context's cross-origin traffic through Node.
 * No-op when VELT_EGRESS_RELAY is unset, or if already installed on this context.
 * @returns {{relayed:number, failed:number, sockets:number, fails:string[], enabled:boolean}}
 */
export async function installEgressRelay(ctx, { log = () => {}, streamTimeoutMs = 25000, requestTimeoutMs = 30000 } = {}) {
  const stats = { relayed: 0, failed: 0, sockets: 0, fails: [], enabled: false };
  if (!relayEnabled() || !ctx || installed.has(ctx)) return stats;
  installed.add(ctx);
  stats.enabled = true;

  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    if (LOCAL_RE.test(url) || url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("file:")) {
      return route.continue();
    }

    // Reflect the page's own origin: a wildcard ACAO is rejected for credentialed
    // requests, and Firestore's channel calls are credentialed.
    let origin = "*";
    try { origin = new URL(req.frame().url()).origin; } catch { /* keep * */ }
    const corsHeaders = () => ({
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": req.headers()["access-control-request-headers"] || "*",
      "access-control-allow-methods": "*",
      "access-control-expose-headers": "*",
      "access-control-max-age": "600",
    });

    // Answer preflights locally — the upstream answer would be rewritten anyway.
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders(), body: "" }).catch(() => {});
    }

    const streaming = STREAMING_RE.test(url);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), streaming ? streamTimeoutMs : requestTimeoutMs);
    try {
      const headers = { ...req.headers() };
      for (const h of HOP_BY_HOP) delete headers[h];
      const init = { method: req.method(), headers, redirect: "follow", signal: ac.signal };
      const body = req.postDataBuffer();
      if (body && req.method() !== "GET" && req.method() !== "HEAD") init.body = body;

      const res = await fetch(url, init);

      let buf;
      if (streaming && res.body) {
        const chunks = [];
        try { for await (const c of res.body) chunks.push(Buffer.from(c)); }
        catch { /* hit the cap — deliver what arrived */ }
        buf = Buffer.concat(chunks);
      } else {
        buf = Buffer.from(await res.arrayBuffer());
      }

      const out = {};
      res.headers.forEach((v, k) => {
        if (HOP_BY_HOP.includes(k) || k === "content-encoding") return; // fetch already decoded
        if (k.startsWith("access-control-")) return;                    // replaced below
        out[k] = v;
      });
      stats.relayed++;
      await route.fulfill({ status: res.status, headers: { ...out, ...corsHeaders() }, body: buf });
    } catch (e) {
      stats.failed++;
      if (stats.fails.length < 30) stats.fails.push(`${req.method()} ${url.slice(0, 140)} :: ${e.message}`);
      log(`egress-relay: ${req.method()} ${url.slice(0, 100)} failed — ${e.message}`);
      await route.abort().catch(() => {});
    } finally {
      clearTimeout(timer);
    }
  });

  return stats;
}

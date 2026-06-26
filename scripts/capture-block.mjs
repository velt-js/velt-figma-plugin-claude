#!/usr/bin/env node
// capture-block.mjs — REFERENCE capture adapter: a device-resolution PNG element screenshot of one
// block's live state, for visual-diff. This is the capture path the redesign requires — the Chrome
// MCP `computer` screenshot returns a ~1x lossy JPEG (too noisy for pixel work); a DPR-2 element
// screenshot aligns 1:1 with the @2x Figma frame (354px → 708px). See BLOCK-BY-BLOCK-REDESIGN-PLAN.md §0b.
//
// Capture is the one step that can't be pure-node (it drives a browser). This adapter uses
// playwright-core via DYNAMIC import so the repo's scripts stay dependency-free at the validate gate;
// the Judge can equally feed visual-diff a PNG from any device-res source (CDP, etc.).
//
// Usage:
//   node scripts/capture-block.mjs <url> <liveSelector> <outPng> [--scale 2] [--select-user user1]
//        [--assert <selector>] [--eval '<page JS to reach the block state>'] [--timeout 30000]
//
// playwright-core resolution: $PLAYWRIGHT_CORE, else a normal import, else a clear install hint.

import path from "node:path";

async function loadChromium() {
  const candidates = [process.env.PLAYWRIGHT_CORE, "playwright-core",
    path.join(process.env.HOME || "", ".claude/skills/gstack/node_modules/playwright-core/index.js")].filter(Boolean);
  for (const c of candidates) {
    try { const m = await import(c); return (m.default || m).chromium; } catch { /* try next */ }
  }
  throw new Error("playwright-core not found — `npm i -D playwright-core` (or set $PLAYWRIGHT_CORE), or feed visual-diff a device-res PNG from your own capture (CDP element screenshot at DPR 2).");
}

async function main() {
  const [url, liveSelector, outPng, ...rest] = process.argv.slice(2);
  if (!url || !liveSelector || !outPng) { console.error("usage: capture-block.mjs <url> <liveSelector> <outPng> [--scale 2] [--select-user user1] [--assert sel] [--eval 'js'] [--timeout 30000]"); process.exit(1); }
  const argv = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
  const scale = +argv("--scale", "2"), timeout = +argv("--timeout", "30000");
  const selectUser = argv("--select-user", null), assertSel = argv("--assert", null), driveJs = argv("--eval", null);

  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout });

    // optional: pick a user in a test harness (a <select> of users — NOT a credential login)
    if (selectUser) await page.evaluate(async (u) => {
      const sel = document.querySelector("select"); if (!sel) return;
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(sel, u);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 600));
      document.querySelector(".hw-sidebar-toggle")?.click();
      await new Promise((r) => setTimeout(r, 1200));
    }, selectUser);

    // wait for the block's surface
    await page.waitForSelector(liveSelector, { timeout });

    // RESET state before driving this block — so a prior block's open menu / typed composer / hover
    // doesn't leak into this capture (§0d fix #b). Escape closes menus + collapses the composer; clear
    // any composer text; blur. Idempotent and safe for a fresh state too.
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => {
      const ed = document.querySelector(".hw-rail-inner [contenteditable='true']");
      if (ed && (ed.textContent ?? "").length) { ed.focus(); document.execCommand("selectAll", false); document.execCommand("delete", false); }
      document.activeElement?.blur?.();
      document.body?.click?.();   // dismiss any open overlay/menu
    }).catch(() => {});
    await page.waitForTimeout(400);

    // run the per-block drive (hover/click/type/seed), then assert
    if (driveJs) await page.evaluate(`(async()=>{ ${driveJs} })()`);
    if (assertSel) await page.waitForSelector(assertSel, { timeout: 8000 }).catch(() => { throw new Error(`state assert failed: ${assertSel} never appeared — the drive did not reach the block's state`); });
    await page.waitForTimeout(500);

    const el = page.locator(liveSelector).first();
    const box = await el.boundingBox();
    await el.screenshot({ path: outPng });
    console.log(JSON.stringify({ ok: true, outPng, deviceScaleFactor: scale, cssBox: box, note: "device-res element PNG ready for visual-diff" }));
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });

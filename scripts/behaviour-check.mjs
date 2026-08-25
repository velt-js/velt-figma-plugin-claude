#!/usr/bin/env node
// behaviour-check.mjs — does the composed control still DO what the SDK's control does?
//
// WHY THIS EXISTS
// The pixel half of the Judge proves a control LOOKS right. Nothing proved it still WORKS, and
// that is the whole premise of the primitives path: your markup, the SDK's behaviour. Every defect
// class this pipeline calls "renders correctly, behaves wrongly" — the dead compound trigger, the
// control the SDK gate silently emptied, the composer whose submit is a no-op — is invisible to a
// diff and to a person looking at a screenshot.
//
// WHAT MAKES IT REUSABLE
// The contracts are keyed to the PRIMITIVE FAMILY, never to a design. SDK behaviour is invariant
// across customizations, so a contract written once runs against every build that places those
// primitives. Which contracts apply is derived from the plan; the selectors come from
// probe-selectors.json and the plan's own vcClasses. Nothing here knows what Harvey is.
//
// SPEED IS A FEATURE. One browser, one page load, every contract sharing it. A suite that takes an
// hour does not get run, and a check that does not get run is not a check.
//
// USAGE  node scripts/behaviour-check.mjs <phaseDir> --url <appUrl> [--connect ws] [--json]
// EXIT   0 all applicable contracts pass · 2 a contract FAILED · 3 environment/blocked

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadChromium, acquireBrowser } from "./measure-block.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const phaseDir = argv.find((a) => !a.startsWith("--"));
const url = val("--url");
if (!phaseDir || !url) { console.error("usage: behaviour-check.mjs <phaseDir> --url <appUrl> [--connect ws] [--json]"); process.exit(1); }
const P = (f) => path.join(path.resolve(phaseDir), f);
const rj = async (p, d) => fs.readFile(p, "utf8").then(JSON.parse).catch(() => d);

const contracts = (await rj(path.join(ROOT, "knowledge/behaviour-contracts.json"), { contracts: [] })).contracts;
const plan = await rj(P("plan-primitives.json"), null);
if (!plan) { console.error("✗ plan-primitives.json missing"); process.exit(1); }
const probes = await rj(P("probe-selectors.json"), {});

// which primitives does this build actually place?
const placed = new Set();
const vc = {};
const walk = (n) => {
  if (!n || typeof n !== "object") return;
  if (n.primitive) placed.add(n.primitive);
  const c = String(n.vcClass || "").split(/\s+/)[0];
  if (c) vc[c] = true;
  for (const ch of n.children || []) walk(ch);
};
for (const s of plan.surfaces || []) walk(s.root);

// role -> selector, resolved from the plan's own classes (never hardcoded per design)
const pick = (...cands) => cands.find((c) => c && (c.startsWith(".") ? vc[c.slice(1)] : true)) || null;
const SEL = {
  composerInput: pick(...Object.keys(vc).filter((k) => /composer.*input/.test(k)).map((k) => "." + k)) || ".vc-composer-input",
  filterTrigger: pick(...Object.keys(vc).filter((k) => /filter.*(icon|trigger)/.test(k)).map((k) => "." + k)) || "velt-comment-sidebar-filter-dropdown-trigger-v2",
  filterContent: "velt-comment-sidebar-filter-dropdown-content-v2",
  card: probes.card || ".vc-thread-card",
};

// A contract only runs if THIS phase draws the state it exercises. The filter menu's open state
// belongs to a later Loop, so a closed dropdown here is the correct resting state — reporting it as
// a defect charges this phase for work the design has not specified yet.
const blocks = await rj(P("blocks.json"), { blocks: [] });
const drawnStates = new Set((blocks.blocks || []).flatMap((b) => [b.state, b.component, b.id].filter(Boolean).map(String)));
const drawsState = (c) => !c.requiresDrawnState ||
  [...drawnStates].some((s2) => s2.toLowerCase().includes(String(c.requiresDrawnState).toLowerCase().split("-")[0]));
const applicable = contracts.filter((c) =>
  (c.requires.length === 0 || c.requires.every((r) => placed.has(r))) && drawsState(c));
const skipped = contracts.filter((c) => !applicable.includes(c));

const chromium = await loadChromium();
const connect = val("--connect", null);
const browser = await acquireBrowser(chromium, connect, { requireConnect: !!connect });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(6000);
// identify + reveal, the same two preconditions every measurement stage needs
try { const o = await page.$$eval("select option", (os) => os.map((x) => x.value).find(Boolean)); if (o) { await page.selectOption("select", o); await page.waitForTimeout(6000); } } catch {}
await page.click(".hw-sidebar-toggle").catch(() => {});

// WAIT FOR THE DATA, not just the surface. A contract that counts a collection has to run after
// that collection exists, or it measures an empty page and reports a working feature as broken —
// which is worse than no check, because a red result gets believed. This suite's own first run did
// exactly that: it counted 0 rows while the list rendered 16 rows three seconds later, and called
// submit broken. Poll until the row collection settles, with a hard ceiling so a genuinely empty
// document cannot hang the suite.
{
  const deadline = Date.now() + 20000;
  let last = -1, stable = 0;
  while (Date.now() < deadline) {
    const n = await page.evaluate((s2) => document.querySelectorAll(s2).length, SEL.card).catch(() => 0);
    if (n > 0 && n === last) { if (++stable >= 2) break; } else stable = 0;
    last = n;
    await page.waitForTimeout(700);
  }
}

const COMPOSER_ID = JSON.stringify(plan).match(/"targetComposerElementId"\s*:\s*"([^"]+)"/)?.[1] || null;
const results = [];
const store = {};

const rowCount = () => page.evaluate((s) => document.querySelectorAll(s).length, SEL.card);
const composerText = () => page.evaluate((s) => {
  const el = document.querySelector(s + " [contenteditable]") || document.querySelector(s);
  return (el?.innerText ?? "").trim();
}, SEL.composerInput);

for (const c of applicable) {
  const t0 = Date.now();
  try {
    await page.evaluate(() => { window.__bcEvents = []; });
    for (const st of c.steps) {
      const sel = SEL[st.target] || st.target;
      if (st.action === "click") await page.click(sel, { timeout: 4000 });
      else if (st.action === "type") { await page.click(sel + " [contenteditable]", { timeout: 4000 }).catch(() => {}); await page.keyboard.type(st.text); }
      else if (st.action === "sleep") await page.waitForTimeout(st.ms);
      else if (st.action === "countRows") store[st.as] = await rowCount();
      else if (st.action === "measure") store[st.as] = await page.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; }, sel);
      else if (st.action === "subscribe") await page.evaluate((ev) => {
        const el = window.Velt?.getCommentElement?.(); if (!el?.on) return;
        el.on(ev).subscribe(() => window.__bcEvents.push(ev));
      }, st.event);
      else if (st.action === "api") await page.evaluate(([m, id]) => {
        const el = window.Velt?.getCommentElement?.(); el?.[m]?.({ targetComposerElementId: id });
      }, [st.method, COMPOSER_ID]);
      else if (st.action === "hitTestPlacedControls") {
        store.hits = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll("button,[role='button'],[contenteditable]")) {
            const b = el.getBoundingClientRect();
            if (b.width < 4 || b.height < 4) continue;
            const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            if (top && !el.contains(top) && !top.contains(el)) out.push(el.className || el.tagName);
          }
          return out;
        });
      }
    }
    const a = c.assert; let ok = false, got = null;
    if (a.kind === "composerText") { got = await composerText(); ok = a.contains ? got.includes(a.contains) : got === (a.equals ?? ""); }
    else if (a.kind === "eventFired") { got = await page.evaluate(() => window.__bcEvents.length); ok = got > 0; }
    else if (a.kind === "rowsIncreased") { got = await rowCount(); ok = got > store[a.from]; }
    else if (a.kind === "grewFrom") { got = await page.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; }, SEL[a.target] || a.target); ok = got > store[a.from]; }
    else if (a.kind === "allControlsHittable") { got = store.hits || []; ok = got.length === 0; }
    results.push({ id: c.id, ok, got, ms: Date.now() - t0, why: c.why, mutation: c.mutation });
  } catch (e) {
    results.push({ id: c.id, ok: false, blocked: true, got: String(e).split("\n")[0].slice(0, 90), ms: Date.now() - t0, why: c.why });
  }
}
await browser.close();

const failed = results.filter((r) => !r.ok);
if (flag("--json")) console.log(JSON.stringify({ ok: !failed.length, applicable: applicable.length, skipped: skipped.map((s) => s.id), results }, null, 2));
else {
  for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(32)} ${String(r.ms).padStart(5)}ms${r.ok ? "" : `  got: ${JSON.stringify(r.got)}`}`);
  for (const r of failed) console.log(`\n  ${r.id}: ${r.why}`);
  for (const s of skipped) console.log(`· skipped ${s.id} — ${s.requiresDrawnState ? `this phase does not draw '${s.requiresDrawnState}'` : `places none of ${s.requires.join(", ")}`}`);
  console.log(`\n${failed.length ? "✗" : "✓"} behaviour: ${results.length - failed.length}/${results.length} contract(s) pass`);
}
process.exit(failed.length ? 2 : 0);

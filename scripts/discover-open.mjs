#!/usr/bin/env node
// discover-open.mjs — find the control that REVEALS each planned surface, against the live app.
//
// WHY THIS EXISTS
// A drive's first step has to make the surface exist. The planner authors that step from Figma and
// the SDK manifest, neither of which says anything about the HOST: Velt's own convention is a
// sidebar button, but an embedding app usually owns the toggle itself (its own React state, its own
// markup). The planner's guess is therefore right only by luck.
//
// When it is wrong the failure is quiet and expensive. Measured on the first run to reach 5a2: the
// opening click matched nothing, the rail stayed at width 0, and dom-snapshot recorded three states
// `stateUnreachable` while the four that did capture measured a surface that was never opened. The
// build was correct the whole time — a live probe showed the composer reaching `active` and `filled`
// exactly as planned once the real toggle was clicked.
//
// drive-repair cannot fix this: it repairs selectors AGAINST A SNAPSHOT, and a drive that fails to
// open the surface produces no snapshot to repair against. The repair has to happen live, before the
// snapshot exists.
//
// HOW — and why this stays design-agnostic. It does not look for "the sidebar button", or match app
// class names, or carry keywords for any surface. It measures the planned surface root, and if that
// root is absent or zero-size it clicks each plausible control in turn and keeps whichever one makes
// the root appear. The oracle is the PLAN's own vcClass, so the same procedure works for any design,
// any surface and any host.
//
// USAGE  node scripts/discover-open.mjs <phaseDir> --url <appUrl> [--connect ws] [--apply] [--json]
// EXIT   0 every planned surface is reachable (already visible, or an opener was found)
//        2 at least one surface could not be revealed by any candidate — the planner must be told
//        1 usage

import { promises as fs } from "node:fs";
import path from "node:path";
import { loadChromium, acquireBrowser } from "./measure-block.mjs";

const argvv = process.argv.slice(2);
const flag = (n) => argvv.includes(n);
const val = (n, d = null) => { const i = argvv.indexOf(n); return i >= 0 && argvv[i + 1] ? argvv[i + 1] : d; };
const phaseDir = argvv.find((a) => !a.startsWith("--"));
const url = val("--url");
if (!phaseDir || !url) { console.error("usage: discover-open.mjs <phaseDir> --url <appUrl> [--connect ws] [--apply] [--json]"); process.exit(1); }
const P = (f) => path.join(path.resolve(phaseDir), f);
const readJson = async (p, d) => fs.readFile(p, "utf8").then(JSON.parse).catch(() => d);

const plan = await readJson(P("plan-primitives.json"), null);
if (!plan) { console.error("✗ plan-primitives.json missing"); process.exit(1); }
// The planned surface roots, straight from the plan — this is the oracle.
const surfaces = (plan.surfaces || [])
  .map((s) => ({ id: s.id, cls: (s.root?.vcClass || "").split(/\s+/)[0] }))
  .filter((s) => s.cls);

const chromium = await loadChromium();
const connect = val("--connect", null);
const browser = await acquireBrowser(chromium, connect, { requireConnect: !!connect });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 40000 });
await page.waitForTimeout(2500);

const visible = (cls) => page.evaluate((c) => {
  const el = document.querySelector("." + c);
  if (!el) return { present: false, w: 0, h: 0 };
  const r = el.getBoundingClientRect();
  // A surface inside a collapsed container is "present" and useless. Its own box can legitimately be
  // narrow before the style stage, so the container chain is what decides reachability.
  let n = el, minW = r.width;
  for (let i = 0; i < 6 && n; i++, n = n.parentElement) minW = Math.min(minW, n.getBoundingClientRect().width);
  return { present: true, w: Math.round(r.width), h: Math.round(r.height), chainW: Math.round(minW) };
}, cls);

// Every plausible opener, ranked by how likely it is to be a disclosure control. No app-specific
// names: aria state first (a toggle usually announces itself), then ordinary buttons.
const candidates = await page.evaluate(() => {
  const out = [];
  const seen = new Set();
  const sel = (el) => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const cls = [...el.classList].filter((c) => !/^(ng-|velt-)/.test(c))[0];
    if (cls) return `${el.tagName.toLowerCase()}.${CSS.escape(cls)}`;
    const t = el.getAttribute("data-testid");
    return t ? `[data-testid="${t}"]` : null;
  };
  const push = (el, rank) => {
    const s = sel(el);
    if (!s || seen.has(s)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    seen.add(s);
    out.push({ selector: s, rank, label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40) });
  };
  for (const el of document.querySelectorAll("[aria-pressed],[aria-expanded]")) push(el, 0);
  for (const el of document.querySelectorAll('button,[role="button"]')) push(el, 1);
  return out.sort((a, b) => a.rank - b.rank).slice(0, 24);
});

const results = [];
for (const s of surfaces) {
  const before = await visible(s.cls);
  if (before.present && before.chainW > 40) { results.push({ ...s, status: "already-visible", box: before }); continue; }
  let found = null;
  for (const c of candidates) {
    try {
      await page.click(c.selector, { timeout: 1500 });
      await page.waitForTimeout(900);
      const after = await visible(s.cls);
      if (after.present && after.chainW > 40) { found = { ...c, box: after }; break; }
      await page.click(c.selector, { timeout: 1500 }).catch(() => {});   // revert a toggle we flipped
      await page.waitForTimeout(300);
    } catch { /* not clickable — next candidate */ }
  }
  results.push(found
    ? { ...s, status: "opener-found", opener: found.selector, label: found.label, box: found.box }
    : { ...s, status: "unreachable", triedCandidates: candidates.length });
}
await browser.close();

// Write an IDEMPOTENT open step into every brief for a surface whose opener we found. Idempotent
// because all blocks share one reused page: a bare click would open for one block and close for the
// next, which is the documented way six state blocks once captured the same card.
let written = 0;
if (flag("--apply")) {
  const briefDir = P("briefs");
  const files = (await fs.readdir(briefDir).catch(() => [])).filter((f) => f.endsWith(".probes.json"));
  for (const f of files) {
    const b = await readJson(path.join(briefDir, f), null);
    if (!b) continue;
    const surf = results.find((r) => (b.liveSelector || "").includes(r.cls) || (b.browser?.surfaceSelector || "").includes(r.cls));
    if (!surf || surf.status !== "opener-found") continue;
    const step = { action: "eval",
      js: `{const el=document.querySelector('.${surf.cls}');const w=el?Math.min(...[0,1,2,3].map((i,_,__)=>{let n=el;for(let k=0;k<i;k++)n=n&&n.parentElement;return n?n.getBoundingClientRect().width:0})):0;if(!el||w<=40){document.querySelector('${surf.opener}')?.click();}}`,
      why: `idempotent open — discovered live: '${surf.opener}'${surf.label ? ` (${surf.label})` : ""} reveals .${surf.cls}. Every block shares ONE page, so this opens only when closed and never toggles.`,
      discoveredBy: "scripts/discover-open.mjs" };
    const steps = b.drive?.steps || [];
    const rest = steps.filter((s2) => !(s2.discoveredBy === "scripts/discover-open.mjs") && !/sidebar-button/.test(s2.js || ""));
    b.drive.steps = [step, ...rest];
    // Adding steps to a brief that had none would violate the drive contract's "steps without an
    // assert is a false-pass" rule. The open step's own success IS assertable — the surface is
    // present — so supply that rather than leaving the brief in a state our own gate rejects.
    if (!b.drive.assert) {
      b.drive.assert = `.${surf.cls}`;
      b.drive.assertNote = "supplied by discover-open: proves the surface was actually revealed by the discovered opener.";
    }
    await fs.writeFile(path.join(briefDir, f), JSON.stringify(b, null, 2) + "\n");
    written++;
  }
}

const unreachable = results.filter((r) => r.status === "unreachable");
if (flag("--json")) console.log(JSON.stringify({ ok: !unreachable.length, results, briefsUpdated: written }, null, 2));
else {
  for (const r of results) {
    if (r.status === "already-visible") console.log(`· ${r.id}: .${r.cls} already visible (${r.box.w}x${r.box.h})`);
    else if (r.status === "opener-found") console.log(`✓ ${r.id}: .${r.cls} revealed by '${r.opener}'${r.label ? ` (${r.label})` : ""}`);
    else console.error(`✗ ${r.id}: .${r.cls} could not be revealed by any of ${r.triedCandidates} candidate control(s) — the planner must supply the opener`);
  }
  console.log(`\n${unreachable.length ? "✗" : "✓"} discover-open: ${results.length - unreachable.length}/${results.length} surface(s) reachable${flag("--apply") ? ` · ${written} brief(s) updated` : " (dry run — pass --apply)"}`);
}
process.exit(unreachable.length ? 2 : 0);

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
import { installEgressRelay } from "./_egress-relay.mjs";

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

// Which class repeats INSIDE each surface — the plan marks it with `repeat`, so a member selector
// can be built without knowing anything about this design.
const repeatedChildClasses = {};
for (const s2 of plan.surfaces || []) {
  const rootCls = (s2.root?.vcClass || "").split(/\s+/)[0];
  if (!rootCls) continue;
  const kids = [];
  const walkR = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.repeat && n.vcClass) kids.push(String(n.vcClass).split(/\s+/)[0]);
    for (const c of n.children || []) walkR(c);
  };
  walkR(s2.root);
  if (kids.length) repeatedChildClasses[rootCls] = kids;
}

const chromium = await loadChromium();
const connect = val("--connect", null);
const browser = await acquireBrowser(chromium, connect, { requireConnect: !!connect });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await installEgressRelay(page.context());
await page.goto(url, { waitUntil: "networkidle", timeout: 40000 });
await page.waitForTimeout(2500);

// SIGN IN FIRST, if the app asks. A surface backed by collaboration data does not exist until the
// SDK has identified someone: before that the sidebar's row collection is empty, so the list renders
// nothing and no amount of clicking reveals it. `selectUser` is already a drive verb for exactly
// this, but a drive authored from Figma has no way to know the app gates on it — so the discovery
// step, which is the one thing that runs live, resolves it and records it for the briefs.
let signedInAs = null;
let signedInLabel = null;
try {
  const opt = await page.$$eval("select option", (os) =>
    os.map((o) => ({ v: o.value, t: (o.textContent || "").trim() })).find((o) => o.v) || null);
  if (opt) {
    await page.selectOption("select", opt.v);
    // Record the option's VALUE, not its label: the shared selectUser helper signs in by assigning
    // select.value, so a human-readable label never sticks and fails as a "hydration race".
    signedInAs = opt.v;
    signedInLabel = opt.t || opt.v;
    await page.waitForTimeout(6000);   // identify + first data fetch
  }
} catch { /* no sign-in control — the app identifies on its own */ }


// READY, not merely present. For a surface that repeats a row, an empty container still has a box —
// measured 321x24 — so a width test calls it visible, no data wait gets recorded, and every later
// capture happens against an empty list. Readiness for such a surface means at least one ROW.
const visible = (cls, memberCls) => page.evaluate(([c, m]) => {
  const el = document.querySelector("." + c);
  if (!el) return { present: false, w: 0, h: 0 };
  const r = el.getBoundingClientRect();
  // A surface inside a collapsed container is "present" and useless. Its own box can legitimately be
  // narrow before the style stage, so the container chain is what decides reachability.
  let n = el, minW = r.width;
  for (let i = 0; i < 6 && n; i++, n = n.parentElement) minW = Math.min(minW, n.getBoundingClientRect().width);
  const members = m ? el.querySelectorAll("." + m).length : null;
  return { present: true, w: Math.round(r.width), h: Math.round(r.height), chainW: Math.round(minW), members };
}, [cls, memberCls || null]);

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
// Openers already proven for an EARLIER surface. Two rules follow from this, and both were learned
// the hard way: never click one again while probing (that toggles it back off and hides the surface
// it just revealed), and never revert it. Surfaces in one app commonly share a container, so the
// second surface is usually "already visible" purely because the first one's opener is still applied.
const applied = new Set();
for (const s of surfaces) {
  const memberCls = (repeatedChildClasses[s.cls] || [])[0] || null;
  const ready = (v) => v.present && v.chainW > 40 && (memberCls ? (v.members || 0) > 0 : true);
  const before = await visible(s.cls, memberCls);
  if (ready(before)) { results.push({ ...s, status: "already-visible", box: before }); continue; }
  let found = null;
  for (const c of candidates) {
    if (applied.has(c.selector)) continue;
    try {
      await page.click(c.selector, { timeout: 1500 });
      await page.waitForTimeout(900);
      const after = await visible(s.cls, memberCls);
      if (ready(after)) {
        // CAUSALITY CHECK. A surface backed by collaboration data appears when the data arrives,
        // which can easily land during an unrelated click — the first version of this credited a
        // filter dropdown for revealing the thread list. So prove the link: undo the click and
        // require the surface to go away again. If it stays, the click was a coincidence and the
        // surface simply became ready on its own.
        await page.click(c.selector, { timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(900);
        const reverted = await visible(s.cls, memberCls);
        if (ready(reverted)) {
          found = { self: true, box: reverted };            // not caused by this control
          break;
        }
        await page.click(c.selector, { timeout: 1500 }).catch(() => {});   // re-apply the real opener
        await page.waitForTimeout(700);
        found = { ...c, box: after }; applied.add(c.selector); break;
      }
      await page.click(c.selector, { timeout: 1500 }).catch(() => {});   // revert a toggle we flipped
      await page.waitForTimeout(300);
    } catch { /* not clickable — next candidate */ }
  }
  if (found?.selector) applied.add(found.selector);
  results.push(!found ? { ...s, status: "unreachable", triedCandidates: candidates.length }
    : found.self ? { ...s, status: "became-ready", box: found.box }
    : { ...s, status: "opener-found", opener: found.selector, label: found.label, box: found.box });
}
// A FLOW block is a full-surface acceptance screen, so it must be rooted at an element that holds
// EVERY planned surface — not at one of them. The scaffold cannot know that container: before the
// build there is no DOM, so it falls back to a surface's own vcClass and the acceptance snapshot
// then captures one surface and calls it the whole screen. Measured: flow and flow-2 both rooted at
// the header, so the composer and the thread list were absent from the very snapshots the style
// stage treats as the full picture. Live, the container is simply the nearest common ancestor.
const memberOf = (cls) => {
  const kids = repeatedChildClasses[cls];
  return kids && kids.length ? `.${cls} .${kids[0]}` : `.${cls}`;
};

const commonRoot = await page.evaluate((clsList) => {
  const els = clsList.map((c) => document.querySelector("." + c)).filter(Boolean);
  if (els.length < 2) return null;
  let n = els[0];
  while (n && n !== document.body) {
    if (els.every((e) => n.contains(e))) {
      const cls = [...n.classList].filter((c) => !/^ng-/.test(c));
      if (cls.length) return "." + cls[0];
      if (n.id) return "#" + n.id;
      return n.tagName.toLowerCase();
    }
    n = n.parentElement;
  }
  return null;
}, surfaces.map((s2) => s2.cls));

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
    // Re-root the acceptance blocks on the common container before anything else.
    if (/^flow/.test(b.blockId || "") && commonRoot) {
      b.liveSelector = commonRoot;
      if (b.browser) b.browser.surfaceSelector = commonRoot;
      b.selectorProvenance = `discover-open: nearest live ancestor containing every planned surface (${surfaces.map((s3) => "." + s3.cls).join(", ")}) — an acceptance block must capture the whole screen, not one surface`;
      // An acceptance block captures the whole screen, so it needs every surface's OPENER as well as
      // every data wait — and the waits must target a ROW, not a container that is laid out before
      // any row arrives. Building this list without the openers left the drive unable to open the
      // rail at all, and waiting on containers captured 129 nodes with zero rows.
      const openers = results.filter((r) => r.status === "opener-found").map((r) => ({
        action: "eval",
        js: `{const el=document.querySelector('.${r.cls}');if(!el||el.getBoundingClientRect().width<=40){document.querySelector('${r.opener}')?.click();}}`,
        why: `idempotent open for .${r.cls} — discovered live as '${r.opener}'`,
        discoveredBy: "scripts/discover-open.mjs" }));
      const dataWaits = results.filter((r) => r.status === "became-ready")
        .map((r) => ({ action: "waitFor", selector: memberOf(r.cls),
          why: `an acceptance block captures the whole screen, so it must wait for every data-backed surface on it — otherwise the screenshot is of a half-loaded page`,
          discoveredBy: "scripts/discover-open.mjs" }));
      // Keep a previously discovered OPENER. Discovery reflects the browser state it happened to
      // find: probing a page whose sidebar is already open records no opener, and dropping the old
      // one leaves the drive unable to open anything on a fresh load.
      const prior = (b.drive?.steps || []).filter((s4) => s4.discoveredBy === "scripts/discover-open.mjs" && /click\(\)/.test(s4.js || ""));
      const keep = [...(b.drive?.steps || []).filter((s4) => s4.discoveredBy !== "scripts/discover-open.mjs"), ...prior];
      b.drive = b.drive || {};
      b.drive.steps = [...(signedInAs ? [{ action: "selectUser", text: signedInAs, why: "identify before measuring", discoveredBy: "scripts/discover-open.mjs" }] : []), ...openers, ...keep, ...dataWaits];
      if (!b.drive.assert && dataWaits.length) b.drive.assert = dataWaits[0].selector;
      await fs.writeFile(path.join(briefDir, f), JSON.stringify(b, null, 2) + "\n");
      written++;
    }
    const surf = results.find((r) => (b.liveSelector || "").includes(r.cls) || (b.browser?.surfaceSelector || "").includes(r.cls));
    if (!surf || surf.status !== "opener-found") continue;
    const step = { action: "eval",
      js: `{const el=document.querySelector('.${surf.cls}');const w=el?Math.min(...[0,1,2,3].map((i,_,__)=>{let n=el;for(let k=0;k<i;k++)n=n&&n.parentElement;return n?n.getBoundingClientRect().width:0})):0;if(!el||w<=40){document.querySelector('${surf.opener}')?.click();}}`,
      why: `idempotent open — discovered live: '${surf.opener}'${surf.label ? ` (${surf.label})` : ""} reveals .${surf.cls}. Every block shares ONE page, so this opens only when closed and never toggles.`,
      discoveredBy: "scripts/discover-open.mjs" };
    const steps = b.drive?.steps || [];
    const rest = steps.filter((s2) => !(s2.discoveredBy === "scripts/discover-open.mjs") && !/sidebar-button/.test(s2.js || ""));
    // selectUser first: it is idempotent by construction — the shared helper short-circuits once the
    // app is identified, because the host swaps the sign-in control away after the first use.
    const pre = signedInAs
      ? [{ action: "selectUser", text: signedInAs, why: `the app gates its collaboration data behind identification (signs in as ${signedInLabel}); without it the surface has no rows to render`, discoveredBy: "scripts/discover-open.mjs" }]
      : [];
    // WAIT FOR THE DATA, not just the element. A surface whose content arrives asynchronously is in
    // the DOM long before it has anything in it, so a capture taken on presence alone records an
    // EMPTY surface and reports success — the style stage then plans against a blank screen.
    // Measured: the thread list snapshotted at height 0 while the same list rendered 16 threads by
    // hand moments later. waitFor is the right verb because it waits for VISIBILITY, and an element
    // with no content has no box — so "visible" is exactly "has content".
    const dataBacked = results.filter((r) => r.status === "became-ready");
    // Wait for a MEMBER of the collection, not its container. A list container is visible the moment
    // it is laid out — it has a box whether or not any row has arrived — so waiting on it passes
    // instantly and the capture records an empty surface. Measured: every snapshot in this phase
    // held 129 nodes and ZERO thread cards, which made skeleton-check swing between 2 and 10
    // defects on the same build and left real classes missing from the selector corpus.
    const post = dataBacked.map((r) => ({ action: "waitFor", selector: memberOf(r.cls),
      why: `${r.cls} is data-backed. Waiting on the container passes instantly — it has a box before any row arrives — so this waits for a ROW.`,
      discoveredBy: "scripts/discover-open.mjs" }));
    b.drive.steps = [...pre, step, ...rest, ...post];
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
    else if (r.status === "became-ready") console.log(`· ${r.id}: .${r.cls} appeared on its own once its data loaded — no opener needed (${r.box.w}x${r.box.h})`);
    else if (r.status === "opener-found") console.log(`✓ ${r.id}: .${r.cls} revealed by '${r.opener}'${r.label ? ` (${r.label})` : ""}`);
    else console.error(`✗ ${r.id}: .${r.cls} could not be revealed by any of ${r.triedCandidates} candidate control(s) — the planner must supply the opener`);
  }
  if (commonRoot) console.log(`· acceptance blocks re-rooted on '${commonRoot}' (holds every planned surface)`);
  if (signedInAs) console.log(`· signed in as '${signedInAs}'${signedInLabel && signedInLabel !== signedInAs ? ` (${signedInLabel})` : ""} before probing — recorded as a selectUser step`);
  console.log(`\n${unreachable.length ? "✗" : "✓"} discover-open: ${results.length - unreachable.length}/${results.length} surface(s) reachable${flag("--apply") ? ` · ${written} brief(s) updated` : " (dry run — pass --apply)"}`);
}
process.exit(unreachable.length ? 2 : 0);

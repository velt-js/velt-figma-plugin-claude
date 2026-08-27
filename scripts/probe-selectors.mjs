#!/usr/bin/env node
// probe-selectors.mjs — tell the Judge's structural probes where things ARE in this build.
//
// WHY THIS EXISTS
// judge2-chrome-probes makes the checks a pixel diff structurally cannot: card ring, doubled
// border, thread rail, inter-card gap. To do that it needs a selector per ROLE (card, avatar, list,
// connector). Its fallbacks are the wireframe path's class names — `.vc-body`, `.vc-card`,
// `.vc-connector` — which exist only because the wireframe builder writes them.
//
// A `strictly primitives` build has none of them: the React wrappers drop className, so the classes
// live on the customer's own markup under names the planner chose. Every probe therefore matched
// ZERO elements and the Judge reported its own results INVALID — correctly, but nothing existed to
// fix it, so the whole structural half of the Judge was dead on this path.
//
// The plan already knows the answer. Each role is identified by the PRIMITIVE that defines it (a
// card is whatever contains velt-comment-dialog-thread-card), and the selector to probe is the
// nearest own-markup ancestor of that primitive — the element that actually carries the design's
// box. Both facts are in plan-primitives.json, so this is derived, not authored.
//
// USAGE  node scripts/probe-selectors.mjs <phaseDir> [--write] [--json]
// EXIT   0 always (a role that cannot be resolved is reported, never guessed)

import { promises as fs } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const phaseDir = argv.find((a) => !a.startsWith("--"));
if (!phaseDir) { console.error("usage: probe-selectors.mjs <phaseDir> [--write] [--json]"); process.exit(1); }
const P = (f) => path.join(path.resolve(phaseDir), f);
const plan = await fs.readFile(P("plan-primitives.json"), "utf8").then(JSON.parse).catch(() => null);
if (!plan) { console.error("✗ plan-primitives.json missing"); process.exit(1); }

// role -> the primitive that DEFINES it. Semantic, not per-design: these tags mean the same thing
// in every Velt build, which is why the mapping can live in the plugin at all.
const ROLE_PRIMITIVE = {
  card:      ["velt-comment-dialog-thread-card"],
  avatar:    ["velt-comment-dialog-thread-card-avatar"],
  list:      ["velt-comment-sidebar-list-item-v2", "velt-comment-sidebar-list-v2"],
  threads:   ["velt-comment-sidebar-list-v2"],
  moreReply: ["velt-comment-dialog-toggle-reply"],
  dialog:    ["velt-comment-dialog-thread-card"],
};

// Walk the compose tree remembering the nearest own-markup ancestor, so a primitive can report the
// element that actually carries the design's box rather than its own (class-less) host.
const found = {};
// Leaves of the thread-card family. A `strictly primitives` build may compose ONLY these and own
// the card box itself, in which case the container tag below never mounts — see CARD FALLBACK.
const CARD_LEAF = [
  "velt-comment-dialog-thread-card-avatar", "velt-comment-dialog-thread-card-name",
  "velt-comment-dialog-thread-card-time", "velt-comment-dialog-thread-card-message",
  "velt-comment-dialog-thread-card-reply", "velt-comment-dialog-thread-card-reaction-tool",
];
const leafChains = [];
const walk = (node, ownAncestor, chain) => {
  if (!node || typeof node !== "object") return;
  const cls = (node.vcClass || "").split(/\s+/)[0];
  const isOwn = Boolean(node.element && cls);
  const nextOwn = isOwn ? cls : ownAncestor;
  const nextChain = isOwn ? [...chain, cls] : chain;
  if (node.primitive) {
    for (const [role, tags] of Object.entries(ROLE_PRIMITIVE)) {
      if (!tags.includes(node.primitive) || found[role]) continue;
      found[role] = { selector: nextOwn ? `.${nextOwn}` : node.primitive, via: node.primitive,
                      how: nextOwn ? "nearest own-markup ancestor (carries the design's box)" : "the primitive's own tag (no own-markup wrapper)" };
    }
    if (CARD_LEAF.includes(node.primitive)) leafChains.push(nextChain);
  }
  for (const c of node.children || []) walk(c, nextOwn, nextChain);
};
for (const s of plan.surfaces || []) walk(s.root, null, []);

// CARD FALLBACK — derived, still never guessed.
// `card` is keyed to the CONTAINER tag velt-comment-dialog-thread-card. Under `strictly primitives`
// the container is frequently not composed at all: the plan mounts the leaves and the customer's own
// element carries the card box. The container tag then never appears, `card` goes unresolved, and
// judge2-chrome-probes exits 3 INVALID — the whole structural half of the Judge stays dead, which is
// the exact failure this script exists to prevent (measured: privado run 2026-08-27).
// The card is recoverable without guessing: it is the DEEPEST own-markup ancestor common to every
// thread-card leaf. One leaf alone is not enough (that resolves to .vc-card-head, a sub-row), so this
// requires >= 2 distinct leaves whose chains agree.
// The direct match must AGREE with where the leaves actually live. `card` was previously taken from
// the container tag whenever a plan composed it ANYWHERE — including as a narrow non-card wrapper —
// and the derived fallback below never ran. Measured on privado phase 2: that resolved `card` to
// `.vc-card-actions-cluster`, a 42x32 hover cluster, EXIT 0 and silent, so every card probe would
// have iterated a sub-row and reported the card fine. The leaves are the ground truth: whatever
// contains the avatar/name/time/message IS the card. Where the two disagree, prefer the derived
// answer and say so loudly rather than trusting a plan node that may be stale or disproven.
if (found.card && leafChains.length >= 2) {
  let common = leafChains[0];
  for (const c of leafChains.slice(1)) { let i = 0; while (i < common.length && i < c.length && common[i] === c[i]) i++; common = common.slice(0, i); }
  const derived = common[common.length - 1] ? `.${common[common.length - 1]}` : null;
  if (derived && derived !== found.card.selector) {
    console.log(`⚠ card: the plan's container tag resolves to '${found.card.selector}', but the ${leafChains.length} thread-card leaves all live under '${derived}'.`);
    console.log(`   Preferring '${derived}' — the leaves are ground truth. If '${found.card.selector}' is a real card wrapper, the plan and the tree disagree and one of them is stale.`);
    found.card = { selector: derived, via: `${leafChains.length} thread-card leaves (overrode container '${found.card.via}')`,
                   how: "deepest own-markup ancestor common to every thread-card leaf — the container tag disagreed and was not trusted" };
    if (found.dialog && found.dialog.selector !== derived) found.dialog = { ...found.card, how: found.card.how + " — dialog shares the card box" };
  }
}
if (!found.card && leafChains.length >= 2) {
  let common = leafChains[0];
  for (const c of leafChains.slice(1)) {
    let i = 0; while (i < common.length && i < c.length && common[i] === c[i]) i++;
    common = common.slice(0, i);
  }
  const deepest = common[common.length - 1];
  if (deepest) {
    found.card = { selector: `.${deepest}`, via: `${leafChains.length} thread-card leaves`,
                   how: "deepest own-markup ancestor common to every thread-card leaf (container primitive not composed)" };
    if (!found.dialog) found.dialog = { ...found.card, how: found.card.how + " — dialog shares the card box" };
  }
}

// The connector is drawn by the customer, never by a primitive — it has no defining tag, so it is
// recognised by role in the plan's own class names rather than invented.
for (const s of plan.surfaces || []) {
  const j = JSON.stringify(s);
  const m = j.match(/"vc-[a-z0-9-]*(?:rail|connector)[a-z0-9-]*"/);
  if (m && !found.connector) found.connector = { selector: "." + m[0].replace(/"/g, ""), via: "plan class name", how: "customer-drawn connector — no primitive defines it" };
}

const selectors = Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.selector]));
const missing = Object.keys(ROLE_PRIMITIVE).filter((r) => !found[r]);
if (argv.includes("--write")) {
  await fs.writeFile(P("probe-selectors.json"), JSON.stringify(selectors, null, 2) + "\n");
}
if (argv.includes("--json")) console.log(JSON.stringify({ selectors, resolved: found, missing }, null, 2));
else {
  for (const [r, v] of Object.entries(found)) console.log(`✓ ${r.padEnd(10)} ${v.selector.padEnd(24)} ← ${v.via}`);
  for (const r of missing) console.log(`· ${r.padEnd(10)} not in this plan — the probe for it will be skipped, not guessed`);
  console.log(`\n${argv.includes("--write") ? "✓ wrote" : "dry run — pass --write for"} ${path.join(phaseDir, "probe-selectors.json")}`);
}

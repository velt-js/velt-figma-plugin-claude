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
const walk = (node, ownAncestor) => {
  if (!node || typeof node !== "object") return;
  const cls = (node.vcClass || "").split(/\s+/)[0];
  const nextOwn = node.element && cls ? cls : ownAncestor;
  if (node.primitive) {
    for (const [role, tags] of Object.entries(ROLE_PRIMITIVE)) {
      if (!tags.includes(node.primitive) || found[role]) continue;
      found[role] = { selector: nextOwn ? `.${nextOwn}` : node.primitive, via: node.primitive,
                      how: nextOwn ? "nearest own-markup ancestor (carries the design's box)" : "the primitive's own tag (no own-markup wrapper)" };
    }
  }
  for (const c of node.children || []) walk(c, nextOwn);
};
for (const s of plan.surfaces || []) walk(s.root, null);

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

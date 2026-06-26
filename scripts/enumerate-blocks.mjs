#!/usr/bin/env node
// enumerate-blocks.mjs — derive the BLOCK LIST (the completeness oracle) from a Figma file.
//
// The Figma design is a row of state-variant frames (each a full surface mockup, e.g. the 354px
// comments sidebar) with a TEXT label naming the state. Every such frame is one BLOCK the build
// must reach + match. Enumerating from the frames (not a hardcoded list) is what makes "stopped at
// the happy path" impossible: an unbuilt frame is an unaccounted block → the verdict gate returns
// INCOMPLETE. (See BLOCK-BY-BLOCK-REDESIGN-PLAN.md §0b, §4.)
//
// Deterministic skeleton only: id, figma node, exported frame PNG, the label, a best-guess state
// slug + drive/fixture/liveSelector DEFAULTS. The Planner (LLM) refines drive/fixture per block; the
// list is shown at the coverage gate before it is frozen.
//
// Usage:
//   node scripts/enumerate-blocks.mjs rest <fileKey> <nodeId> [--out <dir>] [--scale 2] [--width 354]
//   node scripts/enumerate-blocks.mjs from-nodes <nodes.json> <nodeId> [--out <dir>] [--scale 2]
// Token: FIGMA_TOKEN env, else the OS keychain entry used by figma-extract (never the repo .env).

import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SERVICE = "velt-customize", ACCOUNT = "figma-token";
const API = "https://api.figma.com/v1";

// ---- token (same resolution order as figma-extract: env, then OS secure store; never repo .env) ----
function keychainGet() {
  try {
    if (process.platform === "darwin")
      return execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
    if (process.platform === "linux")
      return execFileSync("secret-tool", ["lookup", "service", SERVICE, "account", ACCOUNT], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch { /* not stored */ }
  return null;
}
const resolveToken = () => process.env.FIGMA_TOKEN || keychainGet() || null;

// ---- state slug + drive defaults, keyed by the design's label text (comments surface taxonomy) ----
// drive.steps are hints the Judge executes to REACH the state; drive.assert proves it's active.
const LABEL_MAP = [
  [/empty/i,                      { state: "empty",               drive: { steps: ["render with no comments OR all filtered out"], assert: ".hw-empty" } }],
  [/input focused|focus/i,        { state: "composer-focus",      drive: { steps: ["focus the page-mode composer input"], assert: ".velt-composer-open, .hw-composer:focus-within" } }],
  [/@ ?mention|mention/i,         { state: "mention-autocomplete",drive: { steps: ["focus composer", "type '@'"], assert: ".mat-mdc-autocomplete-panel, .velt-autocomplete-panel" } }],
  [/input filled|filled/i,        { state: "composer-filled",     drive: { steps: ["focus composer", "type a message"], assert: ".velt-composer-open" } }],
  [/overflow threaded|overflow.*comment/i, { state: "thread-overflow", drive: { steps: ["seed a thread with > preview replies"], assert: "velt-comment-dialog-more-reply-internal:not(:empty)" } }],
  [/threaded.*input|reply.*input/i,{ state: "thread-composer",     drive: { steps: ["open a thread", "focus its reply composer"], assert: ".velt-comment-dialog--selected .velt-composer-open" } }],
  [/threaded.*left|threaded/i,    { state: "threaded",            drive: { steps: ["seed a thread with >= 1 reply"], assert: "velt-comment-dialog-thread-card-internal:nth-child(2)" } }],
  [/additional/i,                 { state: "multiple",            drive: { steps: ["seed >= 2 separate comments"], assert: "velt-comment-dialog-internal:nth-of-type(2)" } }],
  [/filter dropdown|filter.*open/i,{ state: "filter-open",         drive: { steps: ["click the sidebar filter trigger"], assert: ".velt-comments-sidebar-minimal-filter-dropdown-content" } }],
  [/overflow menu|options/i,      { state: "options-open",        drive: { steps: ["hover a card", "click its kebab trigger"], assert: ".snippyly-menu, .hw-menu:not([style*='display: none'])" } }],
  [/resolved.*toast|toast/i,      { state: "resolved-toast",      drive: { steps: ["resolve a comment", "capture the toast"], assert: "velt-toast-popup, .velt-toast" } }],
  [/link copied|copied/i,         { state: "link-copied",         drive: { steps: ["open options", "click Copy link", "capture the tooltip/toast"], assert: ".s-tooltip, velt-toast-popup" } }],
  [/resolved.*filter/i,           { state: "filter-resolved",     drive: { steps: ["open filter", "enable Show resolved comments"], assert: ".velt-comments-sidebar-minimal-filter-dropdown-content" } }],
  [/resolved/i,                   { state: "resolved",            drive: { steps: ["resolve a comment", "show resolved"], assert: ".velt-comment-dialog--resolved" } }],
  [/hover/i,                      { state: "hover",               drive: { steps: ["seed a comment", "hover the thread card"], assert: ".hw-comment-actions" } }],
  [/comment left|^comment/i,      { state: "default",             drive: { steps: ["seed one root comment"], assert: "velt-comment-dialog-thread-card-internal" } }],
];
// Per-block liveSelector — the element that DEFINES the block (what the Judge captures + the frame is
// cropped to). NOT the whole rail: scoping to the defining element keeps other comments below the
// composer/card out of the diff (the §0d pollution fix). The capture is that element; the frame is
// cropped to the element's surface-relative box. The Planner refines these against the live DOM.
const SELECTOR_BY_STATE = {
  "empty": ".hw-empty",
  "composer-focus": ".hw-panel-composer",
  "composer-filled": ".hw-panel-composer",
  "mention-autocomplete": ".hw-panel-composer",   // panel overlaps the autocomplete popover
  "default": "velt-comment-dialog-internal",       // the (first) thread card
  "hover": "velt-comment-dialog-internal",
  "threaded": "velt-comment-dialog-internal",
  "thread-composer": "velt-comment-dialog-internal",
  "thread-overflow": "velt-comment-dialog-internal",
  "multiple": ".hw-panel-body",                    // several cards → the list region
  "filter-open": ".hw-panel-header",               // header + the filter popover overlapping it
  "options-open": "velt-comment-dialog-internal",  // the card + its kebab popover overlapping it
  "filter-resolved": ".hw-panel-header",
  "resolved": "velt-comment-dialog-internal",
  "resolved-toast": "velt-toast-popup, .velt-toast",
  "link-copied": ".s-tooltip, velt-toast-popup",
};
const DEFAULT_SELECTOR = ".hw-rail-inner";          // whole-sidebar states fall back to the rail

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function classifyLabel(label) {
  for (const [re, v] of LABEL_MAP) if (re.test(label)) return v;
  return { state: slug(label), drive: { steps: [`reach the "${label}" state`], assert: null } };
}

// ---- enumeration: every ~`width`px-wide top-level FRAME is a block; map to its nearest TEXT label ----
export function enumerateBlocks(sectionDoc, { width = 354, scale = 2 } = {}) {
  const children = sectionDoc.children || [];
  const B = (n) => n.absoluteBoundingBox;
  const frames = children.filter((c) => c.type === "FRAME" && B(c) && Math.abs(B(c).width - width) < 6);
  const labels = children.filter((c) => c.type === "TEXT" && B(c));
  const nearestLabel = (f) => {
    const fb = B(f); let best = null, bd = Infinity;
    for (const l of labels) {
      const lb = B(l), dx = Math.abs(lb.x - fb.x), dy = fb.y - (lb.y + lb.height);
      const score = dx + (dy >= 0 ? dy : 1000 + Math.abs(dy));   // label sits just above its frame
      if (score < bd) { bd = score; best = l; }
    }
    return best;
  };
  const popoverNames = (f) => [...new Set((f.children || []).flatMap((c) => [c, ...(c.children || [])])
    .map((c) => c.name).filter((n) => /menu|toast|tooltip/i.test(n)))];

  const blocks = frames
    .map((f) => {
      const label = (nearestLabel(f)?.characters || nearestLabel(f)?.name || "").trim() || "(unlabeled)";
      const { state, drive } = classifyLabel(label);
      return {
        id: slug(label) || f.id.replace(":", "-"),
        name: label, figmaNodeId: f.id,
        framePng: `frames/${slug(label) || f.id.replace(":", "-")}.png`,
        surface: "sidebar",
        state, drive,
        liveSelector: SELECTOR_BY_STATE[state] || DEFAULT_SELECTOR,
        // frameRegion = the defining element's box in the frame (device px x,y,w,h) — the Judge crops
        // the frame to this so only the block's region is diffed (excludes unrelated comments). The
        // Planner fills it from the designSpec node box of the element this block is about (× scale).
        frameRegion: null,
        popovers: popoverNames(f),
        fixture: { note: "Planner fills canonical content from the frame text (author/message/replyCount)" },
        x: Math.round(B(f).x),                     // canvas x — used only to keep source order stable
      };
    })
    .sort((a, b) => a.x - b.x)
    .map((b, i) => { const { x, ...rest } = b; return { ...rest, order: i }; });

  return { width, scale, count: blocks.length, blocks };
}

// ---- main: fetch section node + export frame PNGs via the Figma REST API ----
async function figmaGet(url, token) {
  const r = await fetch(url, { headers: { "X-Figma-Token": token } });
  const j = await r.json();
  if (!r.ok || j.err || j.error) throw new Error(`Figma API: ${j.err || j.error || r.status}`);
  return j;
}
async function exportFrames(fileKey, ids, scale, token, outDir) {
  // Figma caps ids per /images call; chunk to be safe.
  const images = {};
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30).join(",");
    const j = await figmaGet(`${API}/images/${fileKey}?ids=${encodeURIComponent(chunk)}&format=png&scale=${scale}`, token);
    Object.assign(images, j.images || {});
  }
  await fs.mkdir(path.join(outDir, "frames"), { recursive: true });
  return images;
}

async function main() {
  const [mode, ...a] = process.argv.slice(2);
  const argv = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const scale = +argv("--scale", "2"), width = +argv("--width", "354");
  const outDir = path.resolve(argv("--out", "."));

  let sectionDoc, fileKey;
  if (mode === "rest") {
    const [fk, nodeId] = a; fileKey = fk;
    const token = resolveToken();
    if (!token) { console.error("✗ no Figma token (set FIGMA_TOKEN or store it via figma-extract token set)"); process.exit(1); }
    const id = nodeId.replace(/-/g, ":");
    const j = await figmaGet(`${API}/files/${fileKey}/nodes?ids=${id}`, token);
    sectionDoc = j.nodes[id]?.document;
    if (!sectionDoc) { console.error(`✗ node ${id} not found in ${fileKey}`); process.exit(1); }

    const result = enumerateBlocks(sectionDoc, { width, scale });
    const images = await exportFrames(fileKey, result.blocks.map((b) => b.figmaNodeId), scale, token, outDir);
    for (const b of result.blocks) {
      const url = images[b.figmaNodeId];
      if (!url) { b.framePngMissing = true; continue; }
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      await fs.writeFile(path.join(outDir, b.framePng), buf);
    }
    result.source = `figma:${fileKey}`; result.nodeId = id;
    await fs.writeFile(path.join(outDir, "blocks.json"), JSON.stringify(result, null, 2) + "\n");
    report(result, outDir);
  } else if (mode === "from-nodes") {
    const [nodesPath, nodeId] = a;
    const id = nodeId.replace(/-/g, ":");
    const j = JSON.parse(await fs.readFile(nodesPath, "utf8"));
    sectionDoc = (j.nodes?.[id]?.document) || j.document || j;
    const result = enumerateBlocks(sectionDoc, { width, scale });
    result.source = `nodes:${path.basename(nodesPath)}`; result.nodeId = id;
    await fs.writeFile(path.join(outDir, "blocks.json"), JSON.stringify(result, null, 2) + "\n");
    report(result, outDir);
  } else {
    console.error("usage: enumerate-blocks.mjs rest <fileKey> <nodeId> | from-nodes <nodes.json> <nodeId> [--out <dir>] [--scale 2]");
    process.exit(1);
  }
}
function report(result, outDir) {
  console.log(`✓ ${result.count} blocks → ${path.relative(process.cwd(), path.join(outDir, "blocks.json"))}`);
  for (const b of result.blocks) console.log(`  ${String(b.order).padStart(2)}. ${b.id.padEnd(22)} state=${b.state.padEnd(20)} ${b.popovers?.length ? "popover" : ""}`);
  console.log("  The verdict gate requires a PASS for EVERY block — a run that builds fewer is INCOMPLETE.");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });

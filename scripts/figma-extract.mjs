#!/usr/bin/env node
// figma-extract.mjs — deterministic Figma design extraction for velt-customize.
// Turns Figma nodes into a `designSpec`: EXACT spacing/sizing/radius/typography/colours as
// CSS-ready declarations (so the Builder/Judge use real numbers, never eyeballed), plus
// per-node SVG icon export. Two sources, one schema:
//   * REST  (token present): api.figma.com node JSON  -> designSpec   [fully deterministic]
//   * MCP   (no token): the Planner saves get_variable_defs/get_metadata to a JSON dump,
//                       which this script parses into the SAME designSpec schema.
// Also the secure Figma-token helpers (resolve/set/status/remove) — see plan §G.
//
// Usage:
//   node scripts/figma-extract.mjs token status|remove
//   node scripts/figma-extract.mjs token set            (reads token from STDIN, not argv)
//   node scripts/figma-extract.mjs rest <fileKey> <nodeId> [--out <dir>] [--svg]
//   node scripts/figma-extract.mjs from-mcp <dump.json> [--out <dir>]
//
// Layout mapping follows bernaferrari/FigmaToCode: auto-layout -> flex, with the two
// non-obvious rules — gap is suppressed on SPACE_BETWEEN, and "fill" is axis-dependent
// (flex:1 on the parent's primary axis vs align-self:stretch on the counter axis).

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const SERVICE = "velt-customize";
const ACCOUNT = "figma-token";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const MANIFEST_PATH = path.resolve(HERE, "../manifest/velt-codeconnect.json");

// ---------------- secure token handling (plan §G) ----------------
function keychainGet() {
  try {
    if (process.platform === "darwin")
      return execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
    if (process.platform === "linux")
      return execFileSync("secret-tool", ["lookup", "service", SERVICE, "account", ACCOUNT], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch { /* not stored */ }
  return null;
}
function keychainSet(token) {
  if (process.platform === "darwin")
    execFileSync("security", ["add-generic-password", "-U", "-s", SERVICE, "-a", ACCOUNT, "-w", token], { stdio: "ignore" });
  else if (process.platform === "linux")
    execFileSync("secret-tool", ["store", "--label=velt-customize Figma token", "service", SERVICE, "account", ACCOUNT], { input: token, stdio: ["pipe", "ignore", "ignore"] });
  else throw new Error(`secure store not supported on ${process.platform}; use the FIGMA_TOKEN env var instead`);
}
function keychainRemove() {
  try {
    if (process.platform === "darwin") execFileSync("security", ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT], { stdio: "ignore" });
    else if (process.platform === "linux") execFileSync("secret-tool", ["clear", "service", SERVICE, "account", ACCOUNT], { stdio: "ignore" });
    return true;
  } catch { return false; }
}
// Resolution order: env var first, then OS secure store. NEVER reads the repo's .env.
function resolveToken() {
  return process.env.FIGMA_TOKEN || keychainGet() || null;
}
const mask = (t) => (t && t.length > 4 ? `${t.slice(0, 4)}…${t.slice(-4)}` : "set");

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString().trim();
}

// ---------------- colour + helpers ----------------
function hex({ r, g, b }, a = 1) {
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, "0");
  const base = `#${h(r)}${h(g)}${h(b)}`;
  return a >= 1 ? base : `${base}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
}
function firstSolid(fills) {
  const f = (fills || []).find((x) => x.type === "SOLID" && x.visible !== false);
  return f ? hex(f.color, f.opacity ?? f.color.a ?? 1) : null;
}
function concisePadding(t, r, b, l) {
  if (t === r && r === b && b === l) return t ? `${t}px` : null;
  if (t === b && l === r) return `${t}px ${r}px`;
  return `${t}px ${r}px ${b}px ${l}px`;
}
const JUSTIFY = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", SPACE_BETWEEN: "space-between" };
const ALIGN = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", BASELINE: "baseline" };

// ---------------- node -> designSpec node (FigmaToCode rules) ----------------
function mapNode(node, parent) {
  const css = {};
  const box = node.absoluteBoundingBox || {};
  const pMode = parent?.layoutMode && parent.layoutMode !== "NONE" ? parent.layoutMode : null;

  // auto-layout container -> flex
  if (node.layoutMode && node.layoutMode !== "NONE") {
    css.display = "flex";
    css["flex-direction"] = node.layoutMode === "VERTICAL" ? "column" : "row";
    const primary = node.primaryAxisAlignItems || "MIN";
    const counter = node.counterAxisAlignItems || "MIN";
    if (JUSTIFY[primary] && primary !== "MIN") css["justify-content"] = JUSTIFY[primary];
    if (ALIGN[counter] && counter !== "MIN") css["align-items"] = ALIGN[counter];
    // gap — suppressed on SPACE_BETWEEN (the browser distributes the space)
    if (node.itemSpacing && primary !== "SPACE_BETWEEN") css.gap = `${node.itemSpacing}px`;
    if (node.layoutWrap === "WRAP") css["flex-wrap"] = "wrap";
    const pad = concisePadding(node.paddingTop || 0, node.paddingRight || 0, node.paddingBottom || 0, node.paddingLeft || 0);
    if (pad) css.padding = pad;
  }

  // sizing — axis-dependent fill (the rule naive converters get wrong)
  const sh = node.layoutSizingHorizontal, sv = node.layoutSizingVertical;
  if (pMode === "HORIZONTAL") {
    if (sh === "FILL") css.flex = "1 1 0";
    else if (sh === "FIXED" && box.width) css.width = `${Math.round(box.width)}px`;
    if (sv === "FILL") css["align-self"] = "stretch";
    else if (sv === "FIXED" && box.height) css.height = `${Math.round(box.height)}px`;
  } else if (pMode === "VERTICAL") {
    if (sv === "FILL") css.flex = "1 1 0";
    else if (sv === "FIXED" && box.height) css.height = `${Math.round(box.height)}px`;
    if (sh === "FILL") css["align-self"] = "stretch";
    else if (sh === "FIXED" && box.width) css.width = `${Math.round(box.width)}px`;
  } else {
    if (sh === "FIXED" && box.width) css.width = `${Math.round(box.width)}px`;
    if (sv === "FIXED" && box.height) css.height = `${Math.round(box.height)}px`;
  }
  // HUG (content-driven) => emit nothing for that axis

  // radius
  const radius = node.cornerRadius ?? (Array.isArray(node.rectangleCornerRadii) ? node.rectangleCornerRadii : null);
  if (typeof radius === "number" && radius) css["border-radius"] = `${radius}px`;
  else if (Array.isArray(radius)) css["border-radius"] = radius.map((n) => `${n}px`).join(" ");

  // strokes -> border
  const stroke = firstSolid(node.strokes);
  if (stroke && node.strokeWeight) css.border = `${node.strokeWeight}px solid ${stroke}`;

  // fills: text -> color, else background
  const fill = firstSolid(node.fills);
  const isText = node.type === "TEXT";
  if (fill) css[isText ? "color" : "background"] = fill;

  // typography
  let text;
  if (isText && node.style) {
    const s = node.style;
    css["font-family"] = `"${s.fontFamily}"`;
    css["font-size"] = `${Math.round(s.fontSize)}px`;
    if (s.fontWeight) css["font-weight"] = String(s.fontWeight);
    if (s.lineHeightPx) css["line-height"] = `${Math.round(s.lineHeightPx)}px`;
    if (s.letterSpacing) css["letter-spacing"] = `${+s.letterSpacing.toFixed(2)}px`;
    text = { content: node.characters || "", family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeightPx, letterSpacing: s.letterSpacing };
  }

  return {
    id: node.id, name: node.name, type: node.type,
    box: box.width ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null,
    cssDecls: css,
    ...(text ? { text } : {}),
  };
}

// normalize (AltNode-lite) + recurse, dropping invisibles, promoting groups
function walk(node, parent, out) {
  if (node.visible === false) return;
  const type = node.type === "GROUP" ? "FRAME" : node.type;
  const mapped = mapNode({ ...node, type }, parent);
  out.push(mapped);
  for (const child of node.children || []) walk(child, node, out);
}

// likely-icon heuristic (FigmaToCode) — small vector-only subtree
function isIconNode(node) {
  if (["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "LINE"].includes(node.type)) return true;
  const b = node.absoluteBoundingBox;
  if (b && b.width <= 64 && b.height <= 64 && ["FRAME", "GROUP", "INSTANCE", "COMPONENT"].includes(node.type)) {
    const onlyVec = (n) => (n.children || []).every((c) => ["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "LINE", "ELLIPSE", "RECTANGLE"].includes(c.type) && onlyVec(c));
    return (node.children || []).length > 0 && onlyVec(node);
  }
  return false;
}
function firstText(node, depth = 0) {
  if (!node || depth > 3) return null;
  if (node.type === "TEXT" && node.characters) return node.characters;
  for (const c of node.children || []) { const t = firstText(c, depth + 1); if (t) return t; }
  return null;
}
function collectIcons(node, parents, out) {
  if (node.visible === false) return;
  if (isIconNode(node)) {
    const parent = parents[parents.length - 1];
    // the label/ancestry are how we deterministically assign an icon to a slot: a menu row is
    // [icon, "Edit"], the reply affordance is [icon, "Reply"]; icon-only controls fall back to
    // an ancestry frame-name keyword.
    out.push({ id: node.id, name: node.name, label: parent ? firstText(parent) : null, ancestry: parents.map((p) => p.name).filter(Boolean) });
    return; // don't descend into an icon
  }
  for (const c of node.children || []) collectIcons(c, [...parents, node], out);
}

// Assign exported icons → slots via the manifest's iconHint. nearText (icon's adjacent label) is
// the strong signal; ancestryKeyword is the fallback. What we can't confidently match is reported
// UNASSIGNED (for the agent to resolve by inspecting the SVGs) — never guessed.
async function assignIcons(icons, assets) {
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8")); }
  catch { return { assignments: {}, unassigned: [], note: "manifest not built — run scripts/build-manifest.mjs to enable icon→slot assignment" }; }
  const assetByNode = Object.fromEntries(assets.map((a) => [a.nodeId, a.file]));
  const assignments = {}, unassigned = [];
  const used = new Set(); // one SVG file → one slot (a kebab is not a reply arrow)
  const free = (i) => assetByNode[i.id] && !used.has(assetByNode[i.id]);
  for (const comp of Object.values(manifest.components || {})) {
    for (const slot of comp.slots || []) {
      const h = slot.iconHint;
      if (!h) continue;
      let match = null, by = null;
      // nearText (the icon's adjacent label) is the reliable signal — assign the first free match.
      if (h.nearText) { const c = icons.filter((i) => i.label && i.label.toLowerCase().includes(h.nearText.toLowerCase()) && free(i)); if (c.length) { match = c[0]; by = `nearText:"${h.nearText}"`; } }
      // ancestryKeyword is weak — accept ONLY when it resolves to a single free icon (unambiguous);
      // a broad keyword like "comment" matches many → left unassigned rather than guessed.
      if (!match && h.ancestryKeyword) { const c = icons.filter((i) => i.ancestry.some((a) => a.toLowerCase().includes(h.ancestryKeyword.toLowerCase())) && free(i)); if (c.length === 1) { match = c[0]; by = `ancestry:"${h.ancestryKeyword}"(unique)`; } }
      if (match) { assignments[slot.reactPath] = { file: assetByNode[match.id], by, glyph: h.glyph || null }; used.add(assetByNode[match.id]); }
      else unassigned.push({ slot: slot.reactPath, hint: h, note: "no confident match — inspect the exported SVGs for the glyph and assign manually" });
    }
  }
  return { assignments, unassigned };
}

// ---------------- REST ----------------
async function figmaFetch(url, token) {
  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!res.ok) throw new Error(`Figma REST ${res.status} ${res.statusText} for ${url.replace(/ids=[^&]*/, "ids=…")}`);
  return res.json();
}
async function extractRest(fileKey, nodeId, outDir, doSvg) {
  const token = resolveToken();
  if (!token) throw new Error("no Figma token (env FIGMA_TOKEN or keychain) — use the MCP fallback (from-mcp) or run `figma-extract token set`");
  const id = nodeId.replace(/-/g, ":");
  const data = await figmaFetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(id)}&geometry=paths`, token);
  const root = data.nodes?.[id]?.document;
  if (!root) throw new Error(`node ${id} not found in file ${fileKey}`);

  const nodes = [];
  walk(root, null, nodes);

  const icons = [];
  collectIcons(root, [], icons);
  const assets = [];
  if (doSvg && icons.length) {
    const ids = icons.map((i) => i.id).join(",");
    const img = await figmaFetch(`https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=svg`, token);
    await fs.mkdir(path.join(outDir, "assets"), { recursive: true });
    for (const ic of icons) {
      const u = img.images?.[ic.id];
      if (!u) continue;
      const svg = await (await fetch(u)).text();
      // Disambiguate with the node id — Figma layer names are often generic ("Icon", "Vector")
      // and would collide/overwrite otherwise.
      const slug = (ic.name || "icon").replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") || "icon";
      const fname = `${slug}-${ic.id.replace(/[^a-z0-9]+/gi, "-")}.svg`;
      await fs.writeFile(path.join(outDir, "assets", fname), svg);
      assets.push({ nodeId: ic.id, name: ic.name, file: `assets/${fname}` });
    }
  }
  const iconAssign = doSvg ? await assignIcons(icons, assets) : { assignments: {}, unassigned: [] };
  return { source: "rest", fileKey, nodeId: id, nodeCount: nodes.length, nodes, assets, icons: icons.length,
    iconAssignments: iconAssign.assignments, unassignedIcons: iconAssign.unassigned };
}

// ---------------- MCP fallback ----------------
// Parses a dump the Planner saves: { variableDefs?: {name:value}, nodes?: <REST-shaped node tree> }.
// get_variable_defs gives the token map; if the agent also captured a node tree we map it too.
async function extractMcp(dumpPath) {
  const dump = JSON.parse(await fs.readFile(dumpPath, "utf8"));
  const tokens = dump.variableDefs || dump.variables || {};
  const nodes = [];
  if (dump.nodes || dump.document) walk(dump.document || dump.nodes, null, nodes);
  return { source: "mcp", tokens, nodeCount: nodes.length, nodes, note: "MCP fallback: exact numbers limited to what get_variable_defs/metadata expose; prefer REST (set a token) for full fidelity." };
}

// ---------------- main ----------------
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const outIdx = rest.indexOf("--out");
  const outDir = outIdx >= 0 ? path.resolve(rest[outIdx + 1]) : process.cwd();

  if (cmd === "token") {
    const sub = rest[0];
    if (sub === "status") {
      const env = process.env.FIGMA_TOKEN ? `env FIGMA_TOKEN (${mask(process.env.FIGMA_TOKEN)})` : null;
      const kc = keychainGet();
      if (env) console.log(`✓ token from ${env}`);
      else if (kc) console.log(`✓ token in OS keychain (${mask(kc)})`);
      else console.log("⚠ no token — REST extraction unavailable; MCP fallback will be used. Set one: `figma-extract token set` (or export FIGMA_TOKEN).");
      return;
    }
    if (sub === "remove") { console.log(keychainRemove() ? "✓ token removed from keychain" : "no keychain token to remove"); return; }
    if (sub === "set") {
      if (process.stdin.isTTY) console.error("Paste the Figma token then Ctrl-D (it is read from STDIN, never argv/history):");
      const tok = await readStdin();
      if (!tok) throw new Error("no token on STDIN");
      keychainSet(tok);
      console.log(`✓ stored in OS keychain (${mask(tok)}). Read-only/file-content-scoped PATs recommended.`);
      return;
    }
    throw new Error("usage: token status|set|remove");
  }

  let spec;
  if (cmd === "rest") {
    const [fileKey, nodeId] = rest;
    if (!fileKey || !nodeId) throw new Error("usage: rest <fileKey> <nodeId> [--out <dir>] [--svg]");
    spec = await extractRest(fileKey, nodeId, outDir, rest.includes("--svg"));
  } else if (cmd === "from-mcp") {
    if (!rest[0]) throw new Error("usage: from-mcp <dump.json> [--out <dir>]");
    spec = await extractMcp(path.resolve(rest[0]));
  } else {
    throw new Error("usage: figma-extract.mjs token|rest|from-mcp …");
  }

  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "designSpec.json");
  await fs.writeFile(out, JSON.stringify(spec, null, 2) + "\n");
  const nA = spec.iconAssignments ? Object.keys(spec.iconAssignments).length : 0;
  const nU = spec.unassignedIcons ? spec.unassignedIcons.length : 0;
  console.log(`✓ wrote ${path.relative(process.cwd(), out)} — source=${spec.source}, ${spec.nodeCount} nodes${spec.assets ? `, ${spec.assets.length} SVG assets` : ""}${spec.iconAssignments ? `, ${nA} icon→slot assigned${nU ? `, ${nU} unassigned (inspect SVGs)` : ""}` : ""}`);
}

main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });

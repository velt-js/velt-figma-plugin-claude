#!/usr/bin/env node
// build-manifest.mjs — generate manifest/velt-codeconnect.json, the deterministic
// "Velt Code Connect" backbone: each Velt component -> typed slots -> props/variants ->
// which HOST props produce which structure -> icon/text/menu slots that MUST be supplied.
//
// Strategy (auto ∪ overlay):
//   - AUTO from the guide's already-structured data:
//       * the 770-tag appendix in reference/wireframe-components.md  (completeness universe)
//       * the §6 slot-props table                                    (slot input props)
//       * reference/css-classes.md                                   (stateful classes/conditions)
//       * reference/feature-flags.md + reference/props.md            (host-prop catalog)
//   - OVERLAY (manifest/overlay/*.json) carries the structural + semantic truth the guide
//     can't express deterministically: reactPath nesting, slotType, mustSupply, dataField,
//     hostProps-that-produce-structure, recognition cues. Grounded in the proven velt-harvey-demo.
//   - The generator VALIDATES every overlay slot tag against the appendix (no invented names, R10),
//     and reports appendix slots not yet covered by an overlay (visibility, not an error).
//
// Usage: node scripts/build-manifest.mjs [--check-only] [--source <guide-src>]

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check-only");
const srcIdx = args.indexOf("--source");
const GUIDE = path.resolve(ROOT, srcIdx >= 0 ? args[srcIdx + 1] : "customization-guide");
const OVERLAY_DIR = path.resolve(ROOT, "manifest/overlay");
const OUT = path.resolve(ROOT, "manifest/velt-codeconnect.json");

const SLOT_TYPES = ["icon", "text", "container", "action", "input", "menu-item"];

function read(rel) {
  return fs.readFile(path.join(GUIDE, "reference", rel), "utf8");
}
function gitSha(p) {
  try {
    return execSync(`git -C "${p}" rev-parse --short HEAD`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch { return "nogit"; }
}

// ---------- parsers (guide -> raw catalogs) ----------

// Appendix: "### Section (N)" headers followed by code-fenced flat lists of velt-*-wireframe tags.
function parseAppendix(md) {
  const tags = new Set();
  const sections = {};
  const appendix = md.slice(md.indexOf("## Appendix"));
  const re = /^### (.+?)\s*\((\d+)\)\s*$/gm;
  const heads = [...appendix.matchAll(re)];
  for (let i = 0; i < heads.length; i++) {
    const name = heads[i][1].trim();
    const start = heads[i].index + heads[i][0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : appendix.length;
    const body = appendix.slice(start, end);
    const list = [...body.matchAll(/^(velt-[a-z0-9-]+-wireframe)\s*$/gm)].map((m) => m[1]);
    sections[name] = list;
    for (const t of list) tags.add(t);
  }
  return { tags, sections };
}

// §6 table: | Slot | Prop | Allowed values | — slot like `…Composer.ActionButton` or `VeltX.Y`.
function parseSlotProps(md) {
  const out = [];
  const sec = md.slice(md.indexOf("## 6."), md.indexOf("## 6.") >= 0 ? md.indexOf("\n---", md.indexOf("## 6.")) : 0);
  const re = /^\|\s*`?([^|`]+?)`?\s*\|\s*`?([^|`]+?)`?\s*\|\s*(.+?)\s*\|\s*$/gm;
  for (const m of sec.matchAll(re)) {
    const slot = m[1].trim();
    if (slot === "Slot" || slot.startsWith("---")) continue;
    out.push({ slot, prop: m[2].trim(), values: m[3].trim() });
  }
  return out;
}

// css-classes.md: "**<component-slug>**" then "- `velt-...` — applied when <cond>"
function parseCssClasses(md) {
  const byClass = [];
  const re = /^- `([^`]+)`\s*(?:—|-)\s*applied when (.+)$/gim;
  for (const m of md.matchAll(re)) {
    byClass.push({ cls: m[1].trim(), condition: m[2].trim() });
  }
  return byClass; // flat list; we attach by stem prefix at merge time
}

// feature-flags.md + props.md (+ component-config.md): collect the set of real host-prop
// names for validation. Part 1 of props.md backticks prop names; Part 2 / config tables use
// bare names — so match either form in the first table column.
const NON_PROP_HEADERS = new Set(["Default", "React", "Feature", "Prop", "Component", "Slot", "Type", "Description", "Values", "Allowed", "Imperative"]);
function collectFirstColProps(md, source, props) {
  for (const m of md.matchAll(/^\|\s*`?([a-zA-Z][a-zA-Z0-9]+)`?\s*\|/gm)) {
    if (!NON_PROP_HEADERS.has(m[1]) && !props.has(m[1])) props.set(m[1], { source });
  }
}
function parseHostProps(flagsMd, propsMd, configMd) {
  const props = new Map();
  // feature-flags tables: the React-prop is the 2nd column
  for (const m of flagsMd.matchAll(/^\|[^|]*\|\s*`?([a-zA-Z][a-zA-Z0-9]+)`?\s*\|/gm)) {
    if (!NON_PROP_HEADERS.has(m[1])) props.set(m[1], { source: "feature-flags" });
  }
  collectFirstColProps(propsMd, "props", props);
  if (configMd) collectFirstColProps(configMd, "component-config", props);
  return props;
}

// ---------- overlay loading ----------
async function loadOverlays() {
  let files = [];
  try { files = (await fs.readdir(OVERLAY_DIR)).filter((f) => f.endsWith(".json")); } catch { /* none yet */ }
  const comps = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(OVERLAY_DIR, f), "utf8");
    let json;
    try { json = JSON.parse(raw); } catch (e) { throw new Error(`overlay ${f} is invalid JSON: ${e.message}`); }
    for (const c of json.components || []) comps.push({ ...c, _overlay: f });
  }
  return { comps, files };
}

// ---------- merge + validate ----------
function stem(tag) { return tag.replace(/^velt-/, "").replace(/-wireframe$/, ""); }

function build({ appendix, slotProps, cssClasses, hostPropCatalog, overlays }) {
  const errors = [];
  const warnings = [];
  const covered = new Set();
  const components = {};

  for (const c of overlays.comps) {
    if (!c.name || !c.rootWireframe) { errors.push(`overlay ${c._overlay}: component missing name/rootWireframe`); continue; }
    const slots = [];
    for (const s of c.slots || []) {
      if (!s.tag) { errors.push(`${c.name}: slot ${s.reactPath || "?"} missing tag`); continue; }
      if (!appendix.tags.has(s.tag)) { errors.push(`${c.name}: slot tag not in appendix (invented/renamed): ${s.tag}`); continue; }
      if (!s.slotType || !SLOT_TYPES.includes(s.slotType)) { errors.push(`${c.name}: slot ${s.tag} has invalid/missing slotType (${s.slotType}); allowed: ${SLOT_TYPES.join("|")}`); continue; }
      covered.add(s.tag);
      // CSS classes are CURATED in the overlay (the real class the Builder overrides). Velt's
      // class names drop the component prefix the tags carry, so auto-matching tag→class is
      // unreliable; we validate each curated class exists in css-classes.md OR note it as structural.
      const classes = Array.isArray(s.cssClasses) ? s.cssClasses : [];
      for (const cl of classes) {
        if (!cssClasses.some((x) => x.cls === cl)) warnings.push(`${c.name}: curated cssClass '${cl}' not in css-classes.md (ok if it's an always-on structural class found by inspection)`);
      }
      const props = slotProps.filter((x) => s.reactPath && s.reactPath.endsWith(x.slot.replace(/^…|^\.{3}/, "").split(".").slice(-2).join(".")))
        .map((x) => ({ prop: x.prop, values: x.values }));
      slots.push({
        reactPath: s.reactPath,
        tag: s.tag,
        parent: s.parent || null,
        slotType: s.slotType,
        mustSupply: !!s.mustSupply,
        defaultContent: s.defaultContent || "none",
        dataField: s.dataField || null,
        cssClasses: classes,
        ...(s.iconHint ? { iconHint: s.iconHint } : {}),
        ...(props.length ? { slotProps: props } : {}),
      });
    }
    // validate hostProps exist
    for (const hp of c.hostProps || []) {
      if (hp.prop && !hostPropCatalog.has(hp.prop)) warnings.push(`${c.name}: hostProp '${hp.prop}' not found in feature-flags/props catalog`);
    }
    components[c.name] = {
      name: c.name,
      reactImport: c.reactImport || c.name,
      rootWireframe: c.rootWireframe,
      onComponent: c.onComponent || null,
      slots,
      hostProps: c.hostProps || [],
      variants: c.variants || [],
    };
  }

  // coverage report (visibility, not error)
  const coverageBySection = {};
  for (const [sec, list] of Object.entries(appendix.sections)) {
    const cov = list.filter((t) => covered.has(t)).length;
    coverageBySection[sec] = { covered: cov, total: list.length };
  }

  return { components, errors, warnings, coverageBySection, coveredCount: covered.size, totalSlots: appendix.tags.size };
}

// ---------- main ----------
async function main() {
  const [wf, css, flags, propsMd, configMd] = await Promise.all([
    read("wireframe-components.md"),
    read("css-classes.md"),
    read("feature-flags.md"),
    read("props.md"),
    read("component-config.md").catch(() => ""),
  ]);

  const appendix = parseAppendix(wf);
  if (appendix.tags.size === 0) { console.error("✗ failed to parse appendix slot tags"); process.exit(1); }
  const slotProps = parseSlotProps(wf);
  const cssClasses = parseCssClasses(css);
  const hostPropCatalog = parseHostProps(flags, propsMd, configMd);
  const overlays = await loadOverlays();

  const { components, errors, warnings, coverageBySection, coveredCount, totalSlots } =
    build({ appendix, slotProps, cssClasses, hostPropCatalog, overlays });

  // recognition: merge any `recognition` arrays from overlays
  const recognition = [];
  for (const f of overlays.files) {
    const j = JSON.parse(await fs.readFile(path.join(OVERLAY_DIR, f), "utf8"));
    for (const r of j.recognition || []) recognition.push(r);
  }

  if (errors.length) {
    console.error("✗ manifest build FAILED:");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  for (const w of warnings) console.warn("  ⚠ " + w);

  const payload = { components, recognition };
  const hash = crypto.createHash("sha256")
    .update(JSON.stringify(payload) + wf.length + css.length + flags.length + propsMd.length)
    .digest("hex").slice(0, 12);

  console.log(`parsed appendix: ${totalSlots} slot tags in ${Object.keys(appendix.sections).length} sections`);
  console.log(`slot-props: ${slotProps.length} · css-classes: ${cssClasses.length} · host-prop catalog: ${hostPropCatalog.size}`);
  console.log(`overlay components: ${Object.keys(components).length} (from ${overlays.files.length} file(s)) · slots covered: ${coveredCount}/${totalSlots}`);
  for (const [sec, c] of Object.entries(coverageBySection)) {
    if (c.covered > 0) console.log(`   ${sec}: ${c.covered}/${c.total}`);
  }

  if (checkOnly) {
    console.log("✓ manifest check passed (overlays valid, all slot tags exist in appendix, slot types set)");
    return;
  }

  const manifest = {
    version: { hash, sha: gitSha(GUIDE), isoTime: new Date().toISOString(),
      totalSlots, coveredSlots: coveredCount, components: Object.keys(components).length },
    components,
    recognition,
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ wrote ${path.relative(ROOT, OUT)}  hash=${hash}  (${Object.keys(components).length} components, ${coveredCount} slots)`);
}

main().catch((e) => { console.error(e); process.exit(1); });

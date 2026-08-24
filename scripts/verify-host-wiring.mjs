#!/usr/bin/env node
// verify-host-wiring.mjs — GOLDEN-PATH gate: plan-structure hostProps + always-on infra
// must be present in the host (APPLY + KEEP per R18 exception / knowledge/host-wiring.json).
//
// Usage:
//   node scripts/verify-host-wiring.mjs <phaseDir> [--cwd <appRoot>] [--apply]
// Exit 0 = all required wiring present (report written)
// Exit 2 = missing required wiring (after --apply if still missing)
// Exit 1 = usage / missing plan

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Host tags a required prop may legitimately live on. V2 variants are listed explicitly because
// `<VeltCommentsSidebar\b` cannot match `<VeltCommentsSidebarV2` — see evaluateHostSource().
// Order matters: most-specific mounts first so --apply targets the tag the host actually renders.
const HOST_TAG_FALLBACKS = [
  "VeltCommentsSidebarV2",
  "VeltCommentsSidebar",
  "VeltComments",
];

async function loadJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

async function walkTsx(root, out = [], depth = 0) {
  if (depth > 8) return out;
  let entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".next" || e.name === "dist") continue;
    const p = path.join(root, e.name);
    if (e.isDirectory()) await walkTsx(p, out, depth + 1);
    else if (/\.(tsx|jsx|ts|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

function jsxTagForComponent(comp) {
  const on = comp?.veltComponents?.onComponent || "";
  if (/Sidebar/i.test(on) || /sidebar/i.test(comp?.id || "")) return "VeltCommentsSidebar";
  if (/Comments/i.test(on) || /dialog|thread|comment/i.test(comp?.id || "")) return "VeltComments";
  if (/^Velt[A-Za-z]+$/.test(on) && !/Wireframe/.test(on)) return on;
  return null;
}

/** @returns {true|false|null} null = tag not found in this file */
export function checkPropInSource(src, tag, prop, value) {
  const re = new RegExp(`<${tag}\\b([\\s\\S]*?)(/?>)`, "g");
  let m;
  let sawTag = false;
  while ((m = re.exec(src))) {
    sawTag = true;
    const attrs = m[1] || "";
    if (!new RegExp(`\\b${prop}\\b`).test(attrs)) continue;
    if (value === undefined) return true;
    if (value === true) {
      // Explicit false in either spelling never satisfies a required-true prop.
      if (new RegExp(`\\b${prop}\\s*=\\s*\\{\\s*false\\s*\\}`).test(attrs)) continue;
      if (new RegExp(`\\b${prop}\\s*=\\s*(["'\`])false\\1`).test(attrs)) continue;
      if (new RegExp(`\\b${prop}\\s*=\\s*\\{\\s*(["'\`])false\\1\\s*\\}`).test(attrs)) continue;
      if (new RegExp(`\\b${prop}\\s*=\\s*\\{\\s*true\\s*\\}`).test(attrs)) return true;
      // Some V2 prop interfaces TYPE a boolean-intent flag as `string` (the V2 React
      // wrapper forwards the attribute raw instead of stringifying a boolean — e.g.
      // IVeltCommentSidebarV2Props.embedMode?: string, where the host must write
      // embedMode="true" to emit the same embed-mode="true" attribute V1 emitted).
      // A plan hostProp of `true` is SATISFIED by that string spelling; without this
      // the gate demanded a prop the host could not type-check its way into.
      if (new RegExp(`\\b${prop}\\s*=\\s*(["'\`])true\\1`).test(attrs)) return true;
      if (new RegExp(`\\b${prop}\\s*=\\s*\\{\\s*(["'\`])true\\1\\s*\\}`).test(attrs)) return true;
      if (new RegExp(`\\b${prop}(\\s|/|$)`).test(attrs) && !new RegExp(`\\b${prop}\\s*=`).test(attrs)) return true;
      continue;
    }
    if (value === false) {
      if (new RegExp(`\\b${prop}\\s*=\\s*\\{\\s*false\\s*\\}`).test(attrs)) return true;
      continue;
    }
    if (typeof value === "string") {
      const esc = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${prop}\\s*=\\s*["'\`]${esc}["'\`]`).test(attrs)) return true;
      if (new RegExp(`\\b${prop}\\s*=\\s*\\{\\s*["'\`]${esc}["'\`]\\s*\\}`).test(attrs)) return true;
      continue;
    }
    if (new RegExp(`\\b${prop}\\s*=`).test(attrs)) return true;
  }
  return sawTag ? false : null;
}

function insertProp(src, tag, prop, value) {
  const re = new RegExp(`<${tag}\\b([\\s\\S]*?)(/?>)`);
  const m = re.exec(src);
  if (!m) return { src, changed: false, reason: `no <${tag}> opening found` };
  const attrs = m[1] || "";
  if (new RegExp(`\\b${prop}\\b`).test(attrs)) return { src, changed: false, reason: "already present" };
  let attr;
  if (value === true) attr = `\n          ${prop}`;
  else if (value === false) attr = `\n          ${prop}={false}`;
  else if (typeof value === "string") attr = `\n          ${prop}=${JSON.stringify(value)}`;
  else attr = `\n          ${prop}={${JSON.stringify(value)}}`;
  const replacement = `<${tag}${attrs}${attr}\n        ${m[2]}`;
  return { src: src.slice(0, m.index) + replacement + src.slice(m.index + m[0].length), changed: true };
}

export function collectRequiredWiring(plan, knowledge) {
  const required = [];
  for (const a of knowledge?.alwaysOn || []) {
    required.push({ kind: "alwaysOn", id: a.id, check: a.check });
  }
  const seen = new Set();
  const addHp = (row) => {
    const k = `${row.tag}:${row.prop}:${JSON.stringify(row.value)}`;
    if (seen.has(k)) return;
    seen.add(k);
    required.push(row);
  };
  let pageMode = false;
  for (const comp of plan?.components || []) {
    const tag = jsxTagForComponent(comp);
    for (const hp of comp.hostProps || []) {
      if (!hp?.prop) continue;
      if (hp.prop === "pageMode" && hp.value !== false) pageMode = true;
      addHp({
        kind: "hostProp",
        componentId: comp.id,
        // The PLAN's target wins. A prop's meaning is per-host — `position` on a sidebar decides
        // which edge it anchors to and does not exist on <VeltComments> at all — so deriving the
        // target from the surface id lands structure-producing props on the wrong component, where
        // they typecheck as unknown props and do nothing. The planner now records `tag` for exactly
        // this (plan gate P22 requires it and checks it against the host-prop inventory); honour it,
        // and fall back to the derived tag only when the plan does not say.
        tag: hp.tag || tag || "VeltComments",
        prop: hp.prop,
        value: hp.value,
        designEvidence: hp.designEvidence || null,
      });
    }
  }
  // GOLDEN: pageMode without pageModeComposerVariant → invisible page composer (CSS cannot invent it).
  const planBlob = JSON.stringify(plan || {});
  if (pageMode || /pageMode|PageModeComposer|page-mode composer/i.test(planBlob)) {
    const hasVariant = required.some((r) => r.prop === "pageModeComposerVariant");
    if (!hasVariant) {
      addHp({
        kind: "hostProp",
        componentId: "(inferred)",
        tag: "VeltCommentsSidebar",
        prop: "pageModeComposerVariant",
        value: "pageModeComposer",
        designEvidence: "inferred: pageMode sidebar requires composer wireframe variant (golden host wiring)",
      });
    }
    // commentPlaceholder often belongs on the sidebar in pageMode (golden stash)
    if (!required.some((r) => r.prop === "commentPlaceholder" && r.tag === "VeltCommentsSidebar")) {
      const fromComments = required.find((r) => r.prop === "commentPlaceholder");
      if (fromComments) {
        addHp({
          ...fromComments,
          tag: "VeltCommentsSidebar",
          componentId: "(inferred-sidebar)",
          designEvidence: "inferred: page-mode placeholder is on VeltCommentsSidebar (golden)",
        });
      }
    }
  }
  return required;
}

export function evaluateHostSource(sources, required) {
  const joined = sources.map((s) => s.text).join("\n");
  const missing = [];
  const present = [];
  for (const r of required) {
    if (r.kind === "alwaysOn") {
      if (r.id === "unstyled-base") {
        ( /setUnstyledMode\s*\(\s*true/.test(joined) ? present : missing ).push(r);
      } else if (r.id === "velt-customization-mount") {
        ( /<VeltCustomization\b/.test(joined) ? present : missing ).push(r);
      } else if (r.id === "shadow-dom-false") {
        ( /shadowDom\s*=\s*\{\s*false\s*\}/.test(joined) ? present : missing ).push(r);
      } else {
        present.push({ ...r, note: "unchecked alwaysOn id" });
      }
      continue;
    }
    let found = false;
    // NOTE: `<VeltCommentsSidebar\b` does NOT match `<VeltCommentsSidebarV2` (no word boundary
    // between "r" and "V"), so a V2 host mount was invisible to this gate and every sidebar
    // hostProp reported MISSING forever. A `strictly primitives` build is REQUIRED to mount V2
    // (V1 comment surfaces are in the primitives-unreachable set), so V2 tags must be tried too.
    for (const tag of [r.tag, ...HOST_TAG_FALLBACKS]) {
      for (const s of sources) {
        if (checkPropInSource(s.text, tag, r.prop, r.value) === true) { found = true; break; }
      }
      if (found) break;
    }
    (found ? present : missing).push(r);
  }
  return { present, missing };
}

async function main() {
  const args = process.argv.slice(2);
  const phaseDir = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--cwd");
  const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const apply = args.includes("--apply");
  if (!phaseDir) {
    console.error("usage: verify-host-wiring.mjs <phaseDir> [--cwd <appRoot>] [--apply]");
    process.exit(1);
  }
  const cwd = path.resolve(flag("--cwd") || process.cwd());
  let plan;
  try { plan = await loadJson(path.join(phaseDir, "plan-structure.json")); }
  catch {
    console.error("✗ plan-structure.json missing — cannot verify host wiring");
    process.exit(1);
  }
  const knowledge = await loadJson(path.join(PLUGIN_ROOT, "knowledge", "host-wiring.json")).catch(() => ({ alwaysOn: [] }));
  const required = collectRequiredWiring(plan, knowledge);

  const prefer = [
    path.join(cwd, "components/velt/VeltCollaboration.tsx"),
    path.join(cwd, "components/velt/VeltProvider.tsx"),
    path.join(cwd, "src/components/velt/VeltCollaboration.tsx"),
    path.join(cwd, "app/components/velt/VeltCollaboration.tsx"),
  ];
  const files = [];
  for (const p of prefer) {
    try { await fs.access(p); files.push(p); } catch { /* */ }
  }
  // The wireframe-mount component is a legitimate home for setUnstyledMode (colocated with the
  // customization it enables), so the scan must UNION the walk with the prefer list — short-circuiting
  // on the prefer list alone reported a present unstyled-base call as missing.
  const all = await walkTsx(path.join(cwd, "components")).catch(() => []);
  for (const p of all) {
    if (files.includes(p)) continue;
    const t = await fs.readFile(p, "utf8").catch(() => "");
    if (/VeltComments|setUnstyledMode|VeltCustomization|VeltWireframe/.test(t)) files.push(p);
  }
  if (!files.length) {
    console.error(`✗ no host Velt files found under ${cwd}`);
    process.exit(2);
  }

  let sources = [];
  for (const f of files) sources.push({ file: f, text: await fs.readFile(f, "utf8") });

  let { present, missing } = evaluateHostSource(sources, required);
  const applied = [];

  if (apply && missing.length) {
    const byFile = new Map(sources.map((s) => [s.file, s.text]));
    for (const m of missing) {
      if (m.kind === "alwaysOn") {
        // Safe always-on patches only — never invent a host architecture.
        let target = [...byFile.keys()].find((f) => /useVeltClient|VeltComments/.test(byFile.get(f))) || [...byFile.keys()][0];
        let text = byFile.get(target);
        if (m.id === "shadow-dom-false") {
          for (const tag of HOST_TAG_FALLBACKS) {
            if (!new RegExp(`<${tag}\\b`).test(text)) continue;
            const { src, changed } = insertProp(text, tag, "shadowDom", false);
            if (changed) { text = src; applied.push({ ...m, file: target, tag }); }
          }
          byFile.set(target, text);
          continue;
        }
        if (m.id === "velt-customization-mount") {
          if (/<VeltCustomization\b/.test(text)) continue;
          if (!/VeltCustomization/.test(text)) {
            // add import next to other velt imports when possible
            if (/from\s+["']\.\/ui-customization\//.test(text) === false && /from\s+["']@veltdev\/react["']/.test(text)) {
              text = text.replace(
                /(from\s+["']@veltdev\/react["'];?\s*\n)/,
                `$1import { VeltCustomization } from "./ui-customization/VeltCustomization";\n`,
              );
            }
          }
          if (/return\s*\(/.test(text) && !/<VeltCustomization\b/.test(text)) {
            text = text.replace(/return\s*\(\s*<>/, "return (\n    <>\n      <VeltCustomization />");
            if (!/<VeltCustomization\b/.test(text)) {
              text = text.replace(/(<VeltComments\b)/, "<VeltCustomization />\n      $1");
            }
            byFile.set(target, text);
            applied.push({ ...m, file: target });
          } else {
            m.applyNote = "could not locate a safe mount point for <VeltCustomization />";
          }
          continue;
        }
        if (m.id === "unstyled-base") {
          if (/setUnstyledMode\s*\(\s*true/.test(text)) continue;
          if (/useVeltClient/.test(text) && /useEffect/.test(text)) {
            const snip = `
  // [Velt customization · standard host change — R11/R18] unstyled base for class CSS
  useEffect(() => {
    if (!client) return;
    client.setUnstyledMode(true, { keepFunctionalStyles: true });
  }, [client]);
`;
            // insert after first useVeltClient destructure
            if (/const\s*\{\s*client\s*\}\s*=\s*useVeltClient\s*\(\s*\)/.test(text)) {
              text = text.replace(
                /(const\s*\{\s*client\s*\}\s*=\s*useVeltClient\s*\(\s*\)\s*;?)/,
                `$1\n${snip}`,
              );
              byFile.set(target, text);
              applied.push({ ...m, file: target });
            } else {
              m.applyNote = "useVeltClient present but no `{ client }` destructure to patch";
            }
          } else {
            m.applyNote = "host lacks useVeltClient+useEffect pattern — wire setUnstyledMode manually";
          }
          continue;
        }
        m.applyNote = "unknown alwaysOn id — skipped";
        continue;
      }
      // Try the planned tag first, then the known host mounts (incl. the V2 sidebar, which the
      // planned tag "VeltCommentsSidebar" can never regex-match). Without this, a V2-only host
      // fell through to byFile[0] and insertProp always returned "no <VeltCommentsSidebar> opening".
      let target = null;
      let useTag = m.tag;
      for (const tag of [m.tag, ...HOST_TAG_FALLBACKS]) {
        const hit = [...byFile.keys()].find((f) => new RegExp(`<${tag}\\b`).test(byFile.get(f)));
        if (hit) { target = hit; useTag = tag; break; }
      }
      if (!target) target = [...byFile.keys()][0];
      const before = byFile.get(target);
      const { src, changed, reason } = insertProp(before, useTag, m.prop, m.value);
      if (changed) {
        byFile.set(target, src);
        applied.push({ ...m, tag: useTag, file: target });
      } else {
        m.applyNote = reason;
      }
    }
    for (const [f, text] of byFile) {
      if (text !== sources.find((s) => s.file === f)?.text) await fs.writeFile(f, text);
    }
    sources = [...byFile.entries()].map(([file, text]) => ({ file, text }));
    ({ present, missing } = evaluateHostSource(sources, required));
  }

  const report = {
    at: new Date().toISOString(),
    cwd,
    files: sources.map((s) => s.file),
    required: required.length,
    present: present.length,
    missing: missing.map((m) => ({
      kind: m.kind,
      id: m.id || null,
      tag: m.tag || null,
      prop: m.prop || null,
      value: m.value,
      check: m.check || null,
      designEvidence: m.designEvidence || null,
      applyNote: m.applyNote || null,
    })),
    applied,
    ok: missing.length === 0,
    doctrine: "APPLY+KEEP plan hostProps (R18 exception) — do not temporary-revert; do not mark BLOCKED without --apply attempt",
  };
  await fs.mkdir(phaseDir, { recursive: true });
  await fs.writeFile(path.join(phaseDir, "host-wiring.json"), JSON.stringify(report, null, 2) + "\n");

  if (!report.ok) {
    console.error(`✗ host-wiring: ${missing.length} required item(s) missing`);
    for (const m of report.missing.slice(0, 12)) {
      console.error(`  - ${m.kind === "alwaysOn" ? `${m.id}: ${m.check}` : `${m.tag} ${m.prop}=${JSON.stringify(m.value)}`}`);
    }
    if (!apply) console.error("  hint: re-run with --apply to bake plan hostProps into the host (R18 exception)");
    process.exit(2);
  }
  console.log(`✓ host-wiring: ${present.length} required item(s) present${applied.length ? ` (${applied.length} applied)` : ""} → ${path.join(phaseDir, "host-wiring.json")}`);
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
}

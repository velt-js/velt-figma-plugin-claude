#!/usr/bin/env node
// compile-assertions.mjs — Phase 1 of the design-compiled oracle.
//
// Compiles the DESIGN (plan-style.json rules, plan-fills slot boxes, designSpec nodes)
// into a machine-runnable assertion suite. The Judge stops hand-authoring expectations:
// every expected value here carries designPath + specNodeId provenance from an artifact
// that predates the code under test (R-B), results are pass|fail|blocked only (R-C),
// tolerances follow R-E (geometry ±4 MAX, colors exact after rgba-normalization,
// typography exact), spacing compiles to RECT relations, never CSS property reads (R-F).
//
// Outputs <phaseDir>/compiled-assertions.json:
//   { assertions[], unsupported[], planHoles[], conflicts[], stats }
// plus a coverage diff: every designSpec property on family nodes with no plan decl
// → plan-hole row (the planner-completeness feed for Phase 5).
//
// Gates (exit 2 — the suite itself is invalid):
//   G1 every plan decl in scope is either compiled or listed in unsupported[] with a reason
//   G2 every assertion carries designPath + specNodeId(s) + a design expectedSource
//   G3 the vocabulary contains no "na" status anywhere
//   G4 no tolerance exceeds the R-E cap without a written justification row
//
// Usage:
//   node scripts/compile-assertions.mjs <phaseDir> [--family <regex>] [--write] [--quiet]
// Default family scope: the Phase-1 prototype (single-comment-dialog resting+hover+selected
// plus the sidebar chrome rules that the acceptance list names).

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const GEOMETRY_TOL_MAX = 4; // R-E: wider than this requires a justification row

const KEYWORD_PROPS = new Set([
  "display", "flex-direction", "justify-content", "align-items", "align-self", "align-content",
  "flex-wrap", "overflow", "overflow-x", "overflow-y", "text-align", "position", "flex",
  "opacity", "cursor", "pointer-events", "text-overflow", "white-space", "object-fit",
]);
const TYPOGRAPHY_PROPS = new Set(["font-family", "font-size", "font-weight", "line-height", "letter-spacing"]);
const PAINT_PROPS = new Set(["background", "background-color", "color", "border", "border-color", "border-width", "border-radius", "box-shadow", "fill", "stroke", "outline", "outline-color"]);
const UNMEASURABLE = new Set(["text-box", "content", "transition", "animation", "backdrop-filter", "-webkit-line-clamp", "font-feature-settings", "text-wrap"]);

const px = (v) => {
  if (typeof v === "number") return v;
  const m = String(v ?? "").match(/(-?\d+(?:\.\d+)?)\s*px/i);
  return m ? parseFloat(m[1]) : null;
};

/** Gap/inset tolerance: tight enough that a 2× spacing defect can never hide inside it. */
export function gapTolerance(expected) {
  return Math.min(GEOMETRY_TOL_MAX, Math.max(1, Math.ceil(Math.abs(expected) * 0.25)));
}
/** Size tolerance: atomic controls (≤24px) are exact-size boxes — ±1; larger rects ±4. */
export function sizeTolerance(dim) {
  return dim <= 24 ? 1 : GEOMETRY_TOL_MAX;
}

function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadJson(p) { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; } }
async function fileSha(p) { try { return createHash("sha256").update(await fs.readFile(p)).digest("hex"); } catch { return null; } }

/** Extract slot rows ({slot?, vcClass, box, specNodeId}) from the raw plan-fills bundle. */
export function extractSlots(planFills) {
  const out = [];
  const seen = new Set();
  (function walk(o, trail) {
    if (!o || typeof o !== "object") return;
    if (o.vcClass && o.box && typeof o.box.w === "number") {
      const key = `${o.slot || ""}|${o.vcClass}|${o.specNodeId || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ slot: o.slot || null, vcClass: o.vcClass, box: o.box, specNodeId: o.specNodeId || null, designPath: trail });
      }
      return;
    }
    if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${trail}[${i}]`));
    else for (const [k, v] of Object.entries(o)) walk(v, trail ? `${trail}.${k}` : k);
  })(planFills, "");
  return out;
}

/**
 * Pseudo-slots for the PRIMITIVES path, where plan-fills has no wireframe slots.
 *
 * Design-agnostic: the plan tells us which design node each selector builds
 * (rule.specNodeId), designSpec tells us that node's box. Nesting is recovered
 * geometrically -- a node's parent is the smallest OTHER mapped node whose box
 * strictly contains it -- so the sibling/relation compilers see the same shape
 * they would get from wireframe slots, on any design.
 */
export function slotsFromDesign(planStyle, designSpec) {
  const nodes = designSpec?.nodes || [];
  if (!nodes.length) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // specNodeId -> selector. Prefer a base rule; state rules restyle the same box.
  const sel = new Map();
  for (const r of planStyle?.rules || []) {
    if (!r?.specNodeId || !r.selector) continue;
    if (r.notAssertable || r.purpose === "suppress-default") continue;
    const isBase = !r.state || r.state === "base" || r.state === "default";
    if (!sel.has(r.specNodeId) || (isBase && sel.get(r.specNodeId).stateOnly)) {
      sel.set(r.specNodeId, { selector: r.selector, stateOnly: !isBase });
    }
  }

  const mapped = [];
  for (const [id, v] of sel) {
    const n = byId.get(id);
    if (!n?.box || typeof n.box.w !== "number") continue;
    if (n.box.w <= 0 || n.box.h <= 0) continue;
    mapped.push({ id, selector: v.selector, box: n.box, name: n.name || id, frameId: n.frameId || null });
  }
  if (mapped.length < 2) return [];

  const area = (b) => b.w * b.h;
  const contains = (o, i) =>
    o.box.x <= i.box.x + 0.5 && o.box.y <= i.box.y + 0.5 &&
    o.box.x + o.box.w >= i.box.x + i.box.w - 0.5 &&
    o.box.y + o.box.h >= i.box.y + i.box.h - 0.5 &&
    area(o.box) > area(i.box);

  // parent = smallest strict container among the mapped nodes
  for (const m of mapped) {
    let best = null;
    for (const o of mapped) {
      if (o === m || !contains(o, m)) continue;
      if (!best || area(o.box) < area(best.box)) best = o;
    }
    m.parent = best || null;
  }

  // dotted slot paths; roots get a synthetic top segment so every real
  // container ends up with a dotted parent (the relation compiler needs one).
  const pathOf = (m, guard = 0) => {
    if (m._path) return m._path;
    if (guard > 32) return (m._path = `design.${m.id.replace(/[:;]/g, "_")}`);
    const seg = m.id.replace(/[:;]/g, "_");
    m._path = m.parent ? `${pathOf(m.parent, guard + 1)}.${seg}` : `design.${seg}`;
    return m._path;
  };

  return mapped.map((m) => ({
    slot: pathOf(m),
    vcClass: m.selector,
    box: m.box,
    specNodeId: m.id,
    parentSelector: m.parent ? m.parent.selector : null,
    frameId: m.frameId || null,
    designPath: `designSpec.nodes[${m.id}]`,
  }));
}

/** Family membership for designSpec nodes: containment inside a family frame's box. */
export function familyNodes(designSpec, familyRegex) {
  const nodes = designSpec?.nodes || [];
  const frames = nodes.filter((n) => n.type === "FRAME" && familyRegex.test(n.name || ""));
  const members = new Map(); // id → {node, frame}
  for (const f of frames) members.set(f.id, { node: f, frame: f });
  for (const n of nodes) {
    if (members.has(n.id) || !n.box) continue;
    for (const f of frames) {
      const b = f.box;
      if (n.box.x >= b.x - 1 && n.box.y >= b.y - 1 && n.box.x + n.box.w <= b.x + b.w + 1 && n.box.y + n.box.h <= b.y + b.h + 1) {
        members.set(n.id, { node: n, frame: f });
        break;
      }
    }
  }
  return { frames, members: [...members.values()] };
}

/** Compile ONE plan-style decl → assertion(s) | {unsupported}. Never falls through silently. */
export function compileDecl({ selector, state, property, value, specNodeId, blockIds, ruleIndex }) {
  const base = {
    selector,
    state: state || "default",
    requiresState: !!(state && state !== "default"),
    expectedSource: "plan-style.json",
    designPath: `rules[${ruleIndex}:selector=${selector}${state && state !== "default" ? `,state=${state}` : ""}].decls.${property}`,
    specNodeId: specNodeId || null,
    blockIds: blockIds || [],
  };
  const mkId = (kind, suffix) => `${slugify(selector)}${base.requiresState ? `.${state}` : ""}.${suffix || property}`;
  const out = [];

  if (UNMEASURABLE.has(property) || /^--/.test(property)) {
    return { unsupported: { ...base, property, value, reason: "not observable via computed style / browser-internal" } };
  }
  if (property === "gap" || property === "row-gap" || property === "column-gap") {
    const v = px(value);
    if (v == null) return { unsupported: { ...base, property, value, reason: "non-px gap value" } };
    out.push({ ...base, id: mkId("rect-gap"), kind: "rect-gap", property, expected: v, tolerance: gapTolerance(v), axis: property === "column-gap" ? "x" : "auto" });
    return { assertions: out };
  }
  if (property === "width" || property === "height" || property === "min-width" || property === "min-height" || property === "max-width" || property === "max-height") {
    const v = px(value);
    if (v == null) {
      if (/%|auto|fit-content|100dvh|100vh/.test(String(value))) return { unsupported: { ...base, property, value, reason: "relative size — rect expectation not derivable from decl alone" } };
      return { unsupported: { ...base, property, value, reason: "non-px size" } };
    }
    out.push({ ...base, id: mkId("rect-size"), kind: "rect-size", property, dim: /width/.test(property) ? "w" : "h", cmp: /^min/.test(property) ? "min" : /^max/.test(property) ? "max" : "eq", expected: v, tolerance: sizeTolerance(v) });
    return { assertions: out };
  }
  if (property === "padding" || /^padding-/.test(property)) {
    const parts = String(value).trim().split(/\s+/).map(px);
    if (parts.some((p) => p == null)) return { unsupported: { ...base, property, value, reason: "non-px padding component" } };
    let sides;
    if (property === "padding") {
      const [t, r, b, l] = parts.length === 1 ? [parts[0], parts[0], parts[0], parts[0]]
        : parts.length === 2 ? [parts[0], parts[1], parts[0], parts[1]]
        : parts.length === 3 ? [parts[0], parts[1], parts[2], parts[1]]
        : parts;
      sides = { top: t, right: r, bottom: b, left: l };
    } else {
      sides = { [property.replace("padding-", "")]: parts[0] };
    }
    out.push({ ...base, id: mkId("rect-inset"), kind: "rect-inset", property, expected: sides, tolerance: gapTolerance(Math.max(...Object.values(sides), 1)) });
    return { assertions: out };
  }
  if (property === "margin" || /^margin-/.test(property)) {
    return { unsupported: { ...base, property, value, reason: "margin compiles via sibling rect-gap (plan-fills boxes), not a per-element assertion" } };
  }
  if (TYPOGRAPHY_PROPS.has(property)) {
    out.push({ ...base, id: mkId("typography"), kind: "typography", property, expected: String(value), tolerance: property === "font-size" || property === "line-height" ? 0.5 : 0 });
    if (property === "font-family") {
      const fam = String(value).split(",")[0].replace(/["']/g, "").trim();
      if (fam && !/^(serif|sans-serif|monospace|system-ui)$/i.test(fam)) {
        out.push({ ...base, id: mkId("font-face", "font-face"), kind: "font-face", property: "font-face", expected: fam, tolerance: 0 });
      }
    }
    return { assertions: out };
  }
  if (property === "border-radius") {
    const v = px(value);
    if (v == null) return { unsupported: { ...base, property, value, reason: "non-px radius (e.g. %)" } };
    out.push({ ...base, id: mkId("paint"), kind: "paint", property, expected: `${v}px`, tolerance: 1 });
    return { assertions: out };
  }
  if (PAINT_PROPS.has(property)) {
    out.push({ ...base, id: mkId("paint"), kind: "paint", property, expected: String(value), tolerance: /border$|width/.test(property) ? 1 : 0 });
    return { assertions: out };
  }
  if (KEYWORD_PROPS.has(property)) {
    out.push({ ...base, id: mkId("keyword"), kind: "keyword", property, expected: String(value), tolerance: 0 });
    return { assertions: out };
  }
  // Explicit fall-through → unsupported (G1 forbids silence, not incompleteness)
  return { unsupported: { ...base, property, value, reason: `no compiler for property '${property}' yet` } };
}

/** Sibling rect-gap assertions from plan-fills slot boxes (R-F: rects between landmarks). */
export function compileSlotRelations(slots) {
  const assertions = [];
  const byParent = new Map();
  for (const s of slots) {
    if (!s.slot) continue;
    const parent = s.slot.split(".").slice(0, -1).join(".");
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(s);
  }
  const emit = (a, b, axis, gap, parent) => {
    if (!Number.isFinite(gap) || gap < 0 || gap > 64) return;
    assertions.push({
      id: `${slugify(a.vcClass)}--${slugify(b.vcClass)}.rect-gap`,
      kind: "rect-rel-gap",
      a: { selector: a.vcClass, specNodeId: a.specNodeId },
      b: { selector: b.vcClass, specNodeId: b.specNodeId },
      axis,
      property: `rect-gap(${a.vcClass}→${b.vcClass})`,
      expected: gap,
      tolerance: gapTolerance(gap),
      state: "default",
      requiresState: false,
      expectedSource: "plan-fills.json",
      designPath: `${a.designPath}.box → ${b.designPath}.box (siblings of ${parent})`,
      specNodeId: `${a.specNodeId}→${b.specNodeId}`,
      blockIds: [],
    });
  };
  for (const [parent, sibs] of byParent) {
    if (sibs.length < 2) continue;
    // Root-level "siblings" (parent = the wireframe itself) mix boxes from DIFFERENT variant
    // contexts (Composer from selected-state vs MoreReply from the multi-reply list) — their
    // relative geometry is meaningless. Only leaf parents (a real slot) yield relations.
    if (!parent.includes(".")) continue;
    // ROW-BAND the siblings: a naive (y,x) sort interleaves right-aligned controls
    // (Options at x296,y12) between left-row neighbours (Name→Time) and loses the pair.
    // Rows = y-range overlap ≥ 50% of the smaller box; horizontal gaps within a row,
    // vertical gaps between consecutive row bounding boxes.
    const rows = [];
    for (const s of [...sibs].sort((a, b) => a.box.y - b.box.y)) {
      const row = rows.find((r) => {
        const overlap = Math.min(r.y2, s.box.y + s.box.h) - Math.max(r.y1, s.box.y);
        return overlap >= Math.min(r.y2 - r.y1, s.box.h) * 0.5;
      });
      if (row) {
        row.items.push(s);
        row.y1 = Math.min(row.y1, s.box.y);
        row.y2 = Math.max(row.y2, s.box.y + s.box.h);
      } else {
        rows.push({ y1: s.box.y, y2: s.box.y + s.box.h, items: [s] });
      }
    }
    for (const row of rows) {
      const inRow = row.items.sort((a, b) => a.box.x - b.box.x);
      for (let i = 0; i < inRow.length - 1; i++) {
        const a = inRow[i], b = inRow[i + 1];
        emit(a, b, "x", b.box.x - (a.box.x + a.box.w), parent);
      }
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i].items.reduce((m, s) => (s.box.y + s.box.h > m.box.y + m.box.h ? s : m));
      const b = rows[i + 1].items.reduce((m, s) => (s.box.y < m.box.y ? s : m));
      emit(a, b, "y", b.box.y - (a.box.y + a.box.h), parent);
    }
  }
  return assertions;
}

/** Slot box sizes (leaf slots) — skipped when a plan-style assertion already covers it; disagreement → conflict. */
export function compileSlotSizes(slots, styleAssertions) {
  const assertions = [];
  const conflicts = [];
  const covered = new Map();
  for (const a of styleAssertions) {
    if (a.kind === "rect-size") covered.set(`${a.selector}|${a.dim}`, a);
  }
  const containerPaths = new Set(
    slots.map((s) => s.slot).filter(Boolean)
      .map((p) => p.split(".").slice(0, -1).join("."))
      .filter(Boolean)
  );
  for (const s of slots) {
    for (const dim of ["w", "h"]) {
      const v = s.box[dim];
      if (!Number.isFinite(v) || v <= 0) continue;
      // Containers stretch with content; leaves don't. Decide that STRUCTURALLY --
      // a slot nobody nests inside is a leaf -- rather than by recognising class
      // names, which only ever worked for the one design they were written for.
      const atomic = v <= 40 || !containerPaths.has(s.slot);
      if (!atomic) continue;
      const prior = covered.get(`${s.vcClass}|${dim}`);
      if (prior) {
        if (Math.abs(prior.expected - v) > Math.max(prior.tolerance, 2)) {
          conflicts.push({ selector: s.vcClass, dim, planStyle: prior.expected, planFills: v, designPath: `${prior.designPath} vs ${s.designPath}.box.${dim}`, note: "plan-style and plan-fills disagree — planner must reconcile" });
        }
        continue;
      }
      assertions.push({
        id: `${slugify(s.vcClass)}.rect-size-${dim}`,
        kind: "rect-size",
        selector: s.vcClass,
        dim,
        cmp: "eq",
        property: dim === "w" ? "width" : "height",
        expected: v,
        tolerance: sizeTolerance(v),
        state: "default",
        requiresState: false,
        expectedSource: "plan-fills.json",
        designPath: `${s.designPath}.box.${dim}`,
        specNodeId: s.specNodeId,
        blockIds: [],
      });
    }
  }
  return { assertions, conflicts };
}

/** A host whose selector already targets SVG geometry IS the glyph — don't nest another svg. */
function glyphSelector(hostSel) {
  return /(^|[\s>])(svg|path|g|line|polyline|circle|rect|ellipse|polygon)\s*$/.test(hostSel)
    ? hostSel : `${hostSel} svg`;
}

/**
 * Glyph paint mode from designSpec VECTOR nodes (R-B: expectation comes from the design).
 *
 * Figma exports a stroked vector as `border: <w>px solid <color>` and a filled one as
 * `fill: <color>`. A glyph drawn with the wrong mode looks wrong at every size, and no
 * size/colour assertion catches it -- an outline icon shipped as a solid silhouette
 * measures perfectly. Design-agnostic: reads the mode off the design, never a hardcoded
 * icon list.
 */
export function compileGlyphPaint(designSpec, slots) {
  const nodes = designSpec?.nodes || [];
  const out = [];
  const perHost = new Map();
  for (const n of nodes) {
    if (n.type !== "VECTOR" || !n.box) continue;
    const d = n.cssDecls || {};
    const stroked = typeof d.border === "string" && /solid/.test(d.border);
    const filled = typeof d.fill === "string" && d.fill !== "none";
    if (stroked === filled) continue; // both or neither -> mode is not decidable from the design
    let host = null, hostArea = Infinity;
    for (const s2 of slots) {
      const b = s2.box;
      if (!b) continue;
      const inside = b.x <= n.box.x + 0.5 && b.y <= n.box.y + 0.5 &&
        b.x + b.w >= n.box.x + n.box.w - 0.5 && b.y + b.h >= n.box.y + n.box.h - 0.5;
      const area = b.w * b.h;
      if (inside && area < hostArea && area <= 48 * 48) { host = s2; hostArea = area; }
    }
    if (!host) continue;
    const mode = stroked ? "stroke" : "fill";
    const prev = perHost.get(host.vcClass);
    if (prev && prev.mode !== mode) { perHost.set(host.vcClass, { ...prev, mixed: true }); continue; }
    if (prev) continue;
    perHost.set(host.vcClass, { host, mode, nodeId: n.id, decl: stroked ? d.border : d.fill });
  }
  for (const g of perHost.values()) {
    if (g.mixed) continue;
    out.push({
      id: `${slugify(g.host.vcClass)}.glyph-paint`,
      kind: "glyph-paint",
      selector: glyphSelector(g.host.vcClass),
      parentSelector: g.host.vcClass,
      property: "glyph-paint-mode",
      expected: g.mode,
      tolerance: 0,
      state: "default",
      requiresState: false,
      expectedSource: "designSpec.json",
      designPath: `nodes[${g.nodeId}].cssDecls.${g.mode === "stroke" ? "border" : "fill"} = ${g.decl}`,
      specNodeId: g.nodeId,
      blockIds: [],
    });
  }
  return out;
}

/**
 * Icon glyph sizes from designSpec VECTOR children of slot-mapped parents.
 * A glyph may be several vectors (kebab = three 3px dots) — the assertable size is the
 * UNION bounding box of all vectors inside the host, not any single path.
 */
export function compileIconSizes(designSpec, slots) {
  const nodes = designSpec?.nodes || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const perHost = new Map(); // vcClass → {host, x1,y1,x2,y2, nodeIds[]}
  for (const n of nodes) {
    if (n.type !== "VECTOR" && n.type !== "BOOLEAN_OPERATION") continue;
    // nearest (smallest) slot-mapped ancestor by box containment
    let host = null, hostArea = Infinity;
    for (const s of slots) {
      const p = nodeById.get(s.specNodeId);
      if (!p || !p.box) continue;
      const inside = n.box.x >= p.box.x - 1 && n.box.y >= p.box.y - 1
        && n.box.x + n.box.w <= p.box.x + p.box.w + 1 && n.box.y + n.box.h <= p.box.y + p.box.h + 1;
      const area = p.box.w * p.box.h;
      if (inside && area < hostArea && area <= 48 * 48) { host = s; hostArea = area; }
    }
    if (!host) continue;
    const g = perHost.get(host.vcClass) || { host, x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity, nodeIds: [] };
    g.x1 = Math.min(g.x1, n.box.x); g.y1 = Math.min(g.y1, n.box.y);
    g.x2 = Math.max(g.x2, n.box.x + n.box.w); g.y2 = Math.max(g.y2, n.box.y + n.box.h);
    g.nodeIds.push(n.id);
    perHost.set(host.vcClass, g);
  }
  const assertions = [];
  for (const g of perHost.values()) {
    const dim = Math.round(Math.max(g.x2 - g.x1, g.y2 - g.y1));
    if (!Number.isFinite(dim) || dim < 6 || dim > 32) continue; // sub-6px unions are decorative fragments
    assertions.push({
      id: `${slugify(g.host.vcClass)}.icon-size`,
      kind: "rect-size",
      selector: glyphSelector(g.host.vcClass),
      // the glyph's host is its container: host absent => that state isn't drawn
      parentSelector: g.host.vcClass,
      dim: "max",
      cmp: "eq",
      property: "icon-size",
      // Measure the DRAWN GLYPH, not its frame: the design node is a VECTOR, and an
      // <svg> is usually a larger icon slot around it (a 12x10 arrow in a 16x16 box).
      // Comparing the vector's size to the slot's reports every correct icon as wrong.
      measure: "geometry",
      expected: dim,
      tolerance: 1,
      state: "default",
      requiresState: false,
      expectedSource: "designSpec.json",
      designPath: `nodes[${g.nodeIds.join(",")}].box union inside ${g.host.vcClass}`,
      specNodeId: g.nodeIds[0],
      blockIds: [],
    });
  }
  return assertions;
}

/**
 * State-frame paint deltas straight from designSpec (Phase 2): for each family frame with a
 * state (hover/selected), any paint prop whose value DIFFERS from the resting frame compiles
 * to a state assertion on the card shell — the interim channel for hover-bg until the plan
 * closes the decl hole (Phase 5). expectedSource=designSpec.json keeps R-B provenance.
 */
export function compileStateFramePaint(frames, cardSelector) {
  const resting = frames.find((f) => !/hover|selected/i.test(f.name || ""));
  if (!resting) return [];
  const out = [];
  const PAINT = ["background", "box-shadow", "border", "border-radius"];
  for (const f of frames) {
    const state = /hover/i.test(f.name || "") ? "hover" : /selected/i.test(f.name || "") ? "selected" : null;
    if (!state) continue;
    for (const prop of PAINT) {
      const v = f.cssDecls?.[prop];
      if (v == null || v === resting.cssDecls?.[prop]) continue;
      out.push({
        id: `${slugify(cardSelector)}.${state}.${prop}`,
        kind: "paint",
        selector: cardSelector,
        property: prop,
        expected: String(v),
        tolerance: prop === "border-radius" ? 1 : 0,
        state,
        requiresState: true,
        expectedSource: "designSpec.json",
        designPath: `nodes[id=${f.id}:${f.name}].cssDecls.${prop} (differs from resting ${resting.id})`,
        specNodeId: f.id,
        blockIds: [],
      });
    }
  }
  return out;
}

/** Coverage diff (Phase 1 step 4): design properties with no plan decl → plan-hole rows. */
export function coverageDiff(designSpec, planStyle, members, slots) {
  const holes = [];
  const rules = planStyle?.rules || [];
  const rulesBySpec = new Map();
  for (const [i, r] of rules.entries()) {
    if (!r.specNodeId) continue;
    if (!rulesBySpec.has(r.specNodeId)) rulesBySpec.set(r.specNodeId, []);
    rulesBySpec.get(r.specNodeId).push({ ...r, ruleIndex: i });
  }
  const slotSpecIds = new Set(slots.map((s) => s.specNodeId).filter(Boolean));
  const LAYOUT_WRAPPER = new Set(["display", "flex-direction", "justify-content", "align-items", "align-self", "align-content", "flex", "flex-wrap"]);
  for (const { node, frame } of members) {
    const decls = node.cssDecls || {};
    const nodeRules = rulesBySpec.get(node.id) || [];
    const isHoverFrame = /hover/i.test(frame.name || "");
    const isSelectedFrame = /selected/i.test(frame.name || "");
    const state = isHoverFrame ? "hover" : isSelectedFrame ? "selected" : "default";
    if (!nodeRules.length && !slotSpecIds.has(node.id)) {
      const paintProps = Object.keys(decls).filter((p) => !LAYOUT_WRAPPER.has(p));
      if (paintProps.length) {
        holes.push({
          kind: "unmapped-node",
          specNodeId: node.id,
          nodeName: node.name,
          state,
          frame: frame.name,
          properties: paintProps,
          designPath: `nodes[id=${node.id}:${node.name}].cssDecls`,
          note: "design node carries paint/spacing the plan never mapped to a selector",
        });
      }
      continue;
    }
    for (const [prop, value] of Object.entries(decls)) {
      if (LAYOUT_WRAPPER.has(prop)) continue;
      const stateRules = nodeRules.filter((r) => (r.state || "default") === state);
      const anyRule = stateRules.length ? stateRules : nodeRules;
      const declared = anyRule.some((r) => prop in (r.decls || {}));
      const stateDeclared = stateRules.some((r) => prop in (r.decls || {}));
      if (!declared || (state !== "default" && !stateDeclared)) {
        holes.push({
          kind: "missing-decl",
          specNodeId: node.id,
          nodeName: node.name,
          state,
          frame: frame.name,
          property: prop,
          designValue: value,
          designPath: `nodes[id=${node.id}:${node.name}].cssDecls.${prop}`,
          selector: anyRule[0]?.selector || slots.find((s) => s.specNodeId === node.id)?.vcClass || null,
          note: state !== "default" && declared ? `decl exists but not for state=${state}` : "design property with no plan decl",
        });
      }
    }
  }
  return holes;
}

export function validateAssertion(a) {
  if (!a.designPath) return { ok: false, reason: "designPath required (R-B)" };
  if (!a.specNodeId) return { ok: false, reason: "specNodeId required (R-B)" };
  if (!a.expectedSource || a.expectedSource === "live-dom") return { ok: false, reason: `expectedSource must be a design artifact (got ${a.expectedSource || "null"})` };
  if (a.expected === undefined || a.expected === null || a.expected === "") return { ok: false, reason: "expected value required" };
  if (typeof a.tolerance === "number" && a.tolerance > GEOMETRY_TOL_MAX && !a.justification) {
    return { ok: false, reason: `tolerance ${a.tolerance} exceeds R-E cap ${GEOMETRY_TOL_MAX} without a justification row` };
  }
  return { ok: true };
}

export async function compileAssertions(input, opts = {}) {
  const fromDir = typeof input === "string";
  const phaseDir = fromDir ? input : null;
  const planStyle = fromDir ? await loadJson(path.join(phaseDir, "plan-style.json")) : input.planStyle;
  const planFillsRaw = fromDir ? await loadJson(path.join(phaseDir, "plan-fills.json")) : input.planFills;
  const designSpec = fromDir ? await loadJson(path.join(phaseDir, "designSpec.json")) : input.designSpec;
  if (!planStyle?.rules?.length) throw new Error("plan-style.json with rules[] required");
  const familyRegex = new RegExp(opts.family || "single comment dialog|selected state", "i");
  const blockRegex = new RegExp(opts.blocks || "single-comment-dialog|selected-state|flow|sidebar-header", "i");

  const slots = extractSlots(planFillsRaw || {});
  // Primitives path: no wireframe slots. Recover the same shape from the design
  // tree so the relation/size/icon/coverage compilers are not silently starved.
  if (designSpec) {
    const have = new Set(slots.map((s) => s.specNodeId).filter(Boolean));
    for (const s of slotsFromDesign(planStyle, designSpec)) {
      if (!have.has(s.specNodeId)) slots.push(s);
    }
  }
  // Drive targets for state-driven assertions come from the plan's own structure:
  // the containers that nest the most slots are this design's rows/cards, whatever
  // they happen to be called. Briefs' explicit `drive` contracts still override this.
  const childCount = new Map();
  for (const s2 of slots) {
    if (!s2.slot) continue;
    const par = s2.slot.split(".").slice(0, -1).join(".");
    if (par) childCount.set(par, (childCount.get(par) || 0) + 1);
  }
  const pathToSel = new Map(slots.filter((s2) => s2.slot).map((s2) => [s2.slot, s2.vcClass]));
  const driveTarget = [...childCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pth]) => pathToSel.get(pth))
    .filter(Boolean)
    .slice(0, 3)
    .join(", ") || "[data-velt-comment-dialog], [class*='card']";
  // Anything a user can type into marks the "selected/active" state, in any design.
  const EDITABLE_GUARD = "[contenteditable='true'], textarea, input[type='text']";

  const { frames, members } = designSpec ? familyNodes(designSpec, familyRegex) : { frames: [], members: [] };

  const assertions = [];
  const unsupported = [];

  // A. plan-style rules → assertions
  for (const [i, rule] of planStyle.rules.entries()) {
    // A SUPPRESSION has no design node by nature — the design draws NOTHING there, which is the
    // whole point of the rule. It is the one legitimate value with no provenance, so it is excluded
    // from the suite rather than failing R-B and taking the entire compile down with it.
    if (rule.purpose === "suppress-default" || rule.notAssertable) continue;
    const inScope = !rule.blockIds?.length || rule.blockIds.some((b) => blockRegex.test(b));
    if (!inScope) continue;
    for (const [prop, value] of Object.entries(rule.decls || {})) {
      const r = compileDecl({ selector: rule.selector, state: rule.state, property: prop, value, specNodeId: rule.specNodeId, blockIds: rule.blockIds, ruleIndex: i });
      if (r.assertions) assertions.push(...r.assertions.map((a) => ({ ...a, stateUnreachable: rule.stateUnreachable || undefined })));
      else if (r.unsupported) unsupported.push(r.unsupported);
      else throw new Error(`G1 violation: decl ${rule.selector}.${prop} neither compiled nor unsupported`);
    }
  }

  // B. plan-fills sibling rect-gaps + slot sizes
  const relGaps = compileSlotRelations(slots);
  const { assertions: sizeAsserts, conflicts } = compileSlotSizes(slots, assertions);
  // C. designSpec icon glyph sizes (all slot-mapped hosts — icons live outside the family frames too)
  const iconAsserts = designSpec ? compileIconSizes(designSpec, slots) : [];
  const glyphPaint = designSpec ? compileGlyphPaint(designSpec, slots) : [];
  // D. state-frame paint deltas (hover-bg et al) from designSpec, until the plan closes the hole
  const statePaint = compileStateFramePaint(frames, driveTarget.split(",")[0].trim());

  const all = [...assertions, ...relGaps, ...sizeAsserts, ...iconAsserts, ...glyphPaint, ...statePaint];

  // Precision: carry each element's design-tree parent so the executor can tell
  // "missing because this whole state isn't drawn" (blocked) from "missing while
  // its container is right there" (a real defect). Design-agnostic: the parent
  // comes from box containment, not from any hand-written state label.
  const parentBySpec = new Map();
  for (const s2 of slots) {
    if (s2.specNodeId && s2.parentSelector) parentBySpec.set(s2.specNodeId, s2.parentSelector);
  }
  const frameBySpec = new Map();
  const cohortByFrame = new Map();
  const framesBySelector = new Map();
  for (const s2 of slots) {
    if (!s2.specNodeId || !s2.frameId) continue;
    frameBySpec.set(s2.specNodeId, s2.frameId);
    if (!cohortByFrame.has(s2.frameId)) cohortByFrame.set(s2.frameId, []);
    cohortByFrame.get(s2.frameId).push(s2.vcClass);
    if (!framesBySelector.has(s2.vcClass)) framesBySelector.set(s2.vcClass, new Set());
    framesBySelector.get(s2.vcClass).add(s2.frameId);
  }
  for (const a of all) {
    if (!a.specNodeId) continue;
    if (!a.parentSelector) {
      const psel = parentBySpec.get(a.specNodeId);
      if (psel && psel !== a.selector) a.parentSelector = psel;
    }
    const fid = frameBySpec.get(a.specNodeId);
    // Only selectors drawn in THIS frame and nowhere else are evidence that the
    // frame's state is on screen. A selector reused across frames (a composer the
    // empty-state artboard also depicts) resolves against the other state's copy
    // and would wrongly prove this one is drawn.
    const cohort = fid
      ? (cohortByFrame.get(fid) || []).filter((c) => c !== a.selector && (framesBySelector.get(c)?.size || 0) === 1)
      : [];
    if (cohort.length) a.frameCohort = cohort.slice(0, 12);
  }

  // dedupe by id (first wins — plan-style before fills before spec)
  const byId = new Map();
  for (const a of all) if (!byId.has(a.id)) byId.set(a.id, a);
  const suite = [...byId.values()];

  // D. coverage diff
  const planHoles = designSpec ? coverageDiff(designSpec, planStyle, members, slots) : [];

  // G2/G4 validation
  const invalid = [];
  for (const a of suite) {
    const v = validateAssertion(a);
    if (!v.ok) invalid.push({ id: a.id, reason: v.reason });
  }
  // G3: "na" ban across the whole doc vocabulary
  const doc = {
    generatedAt: new Date().toISOString(),
    family: familyRegex.source,
    sources: fromDir ? {
      "plan-style.json": await fileSha(path.join(phaseDir, "plan-style.json")),
      "plan-fills.json": await fileSha(path.join(phaseDir, "plan-fills.json")),
      "designSpec.json": await fileSha(path.join(phaseDir, "designSpec.json")),
    } : { inline: true },
    resultVocabulary: ["pass", "fail", "blocked"],
    stateGuards: {
      hover: { drive: "hover", driveTarget: driveTarget, guard: ":hover-on-target" },
      selected: { drive: "click", driveTarget: driveTarget, guard: EDITABLE_GUARD },
    },
    assertions: suite,
    unsupported,
    conflicts,
    planHoles,
    stats: {
      assertions: suite.length,
      byKind: suite.reduce((m, a) => ((m[a.kind] = (m[a.kind] || 0) + 1), m), {}),
      byState: suite.reduce((m, a) => ((m[a.state] = (m[a.state] || 0) + 1), m), {}),
      unsupported: unsupported.length,
      conflicts: conflicts.length,
      planHoles: planHoles.length,
      familyFrames: frames.map((f) => `${f.id}:${f.name}`),
      familyNodes: members.length,
    },
  };
  if (JSON.stringify(doc).includes('"na"')) invalid.push({ id: "(doc)", reason: 'G3: vocabulary contains "na"' });
  return { doc, invalid };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const phaseDir = args.find((a, i) => !a.startsWith("--") && (i === 0 || !["--family", "--blocks"].includes(args[i - 1])));
  if (!phaseDir) {
    console.error("usage: compile-assertions.mjs <phaseDir> [--family <regex>] [--blocks <regex>] [--write]");
    process.exit(1);
  }
  // Phase 5 gate: --require-coverage refuses to compile against a plan whose completeness
  // report (plan-coverage.mjs) is missing or stale, or whose regeneration silently dropped
  // decls (plan-drift.mjs check).
  if (args.includes("--require-coverage")) {
    const cov = JSON.parse(await fs.readFile(path.join(phaseDir, "plan-coverage.json"), "utf8").catch(() => "null"));
    const sha = await fileSha(path.join(phaseDir, "plan-style.json"));
    if (!cov) { console.error("✗ plan-coverage.json missing — planner must ship its completeness report (plan-coverage.mjs --write)"); process.exit(2); }
    if (cov.planStyleSha !== sha) { console.error("✗ plan-coverage.json is STALE (plan-style.json changed since the report) — re-run plan-coverage.mjs --write"); process.exit(2); }
    const { spawnSync } = await import("node:child_process");
    const drift = spawnSync("node", [new URL("./plan-drift.mjs", import.meta.url).pathname, phaseDir, "check"], { encoding: "utf8" });
    process.stdout.write(drift.stdout || "");
    if (drift.status === 2) { process.stderr.write(drift.stderr || ""); process.exit(2); }
  }
  const { doc, invalid } = await compileAssertions(phaseDir, { family: flag("--family"), blocks: flag("--blocks") });
  if (!args.includes("--quiet")) {
    console.log(JSON.stringify({ stats: doc.stats, conflicts: doc.conflicts, planHoles: doc.planHoles.slice(0, 12), invalid }, null, 2));
  }
  if (invalid.length) {
    console.error(`✗ suite INVALID (${invalid.length} gate violation(s)) — nothing written`);
    for (const v of invalid) console.error(`  - ${v.id}: ${v.reason}`);
    process.exit(2);
  }
  if (args.includes("--write")) {
    const out = path.join(phaseDir, "compiled-assertions.json");
    await fs.writeFile(out, JSON.stringify(doc, null, 2) + "\n");
    console.log(`✓ wrote ${out} (${doc.stats.assertions} assertions, ${doc.stats.planHoles} plan holes, ${doc.stats.unsupported} unsupported)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
}

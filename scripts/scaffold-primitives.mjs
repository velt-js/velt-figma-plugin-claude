#!/usr/bin/env node
// scaffold-primitives.mjs — the PRIMITIVES plan scaffold + plan gate (the analogue of
// brief-scaffold.mjs --structure / --lint-structure, which stay wireframe-only and untouched).
//
// WHY THIS EXISTS
// Planning here is mechanically scaffolded on purpose: the orchestrator generates skeletons and the
// Planner only FILLS `_todo` fields, because "hand-authoring these files is what made planning
// sprawl". The primitives planner had no scaffold, so it would have hand-authored a compose tree
// from scratch — the exact failure mode the architecture exists to prevent — and then hit
// pre-build gates keyed to the slot-shaped plan and never reached the builder.
//
// TWO OUTPUTS, ON PURPOSE
//   plan-primitives.json   the compose tree (primitives-native: children, context anchors, R3 reads)
//   plan-structure.json    a PROJECTION carrying only the LAYER-AGNOSTIC fields the shared gates
//                          read — vcClasses, designTokens, baseStyling, hostProps — with `slots: []`.
//                          That is honest (a primitives build genuinely has no wireframe slots) and
//                          it lets verify-host-wiring / skeleton-check / resume-check / the whole
//                          STYLE stage run UNCHANGED. The style stage is layer-agnostic already: it
//                          plans selectors against a dom-snapshot of the REAL DOM plus vcClasses,
//                          neither of which cares how the DOM was produced.
//
// USAGE
//   node scripts/scaffold-primitives.mjs <phaseDir>            # scaffold both files
//   node scripts/scaffold-primitives.mjs <phaseDir> --lint     # the pre-build gate
//   node scripts/scaffold-primitives.mjs <phaseDir> --reproject  # refresh plan-structure.json AFTER the Planner fills the plan
//   ... --json for machine-readable lint output
//
// EXIT: 0 clean · 2 unfilled _todo / contract violations · 1 usage or missing inputs.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Reused from the shared scaffolder, NOT reimplemented. scaffoldProbes builds the per-element rows
// (`browser.elements`) that the STYLE stage iterates; it is wireframe-agnostic apart from a
// rootWireframe fallback for the live selector, which a primitives build supplies itself.
// Without these rows `brief-scaffold --style` enriches nothing and exits 0 — silently (finding F14).
import { scaffoldProbes } from "./brief-scaffold.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const phaseDir = argv.find((a) => !a.startsWith("--"));
if (!phaseDir) { console.error("usage: scaffold-primitives.mjs <phaseDir> [--lint] [--json]"); process.exit(1); }

const P = (f) => path.join(phaseDir, f);
const readJson = async (p, dflt = undefined) => {
  try { return JSON.parse(await fs.readFile(p, "utf8")); }
  catch (e) { if (dflt !== undefined) return dflt; console.error(`✗ cannot read ${p}: ${e.message}`); process.exit(1); }
};

const M = await readJson(path.join(ROOT, "manifest/velt-primitives.json"));
const DRIVE_VERBS = "click|dblclick|hover|waitFor|type|press|sleep|eval|clear|selectUser";
// enumerate-blocks' prose hints are strings; an executable drive is an array of {action,...} objects.
const isExecutableDrive = (d) => Array.isArray(d?.steps) && d.steps.length > 0 && d.steps.every((x) => x && typeof x === "object" && typeof x.action === "string");

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Map a block's component/name onto the reachability vocabulary. Order matters — first match wins,
// and the UNREACHABLE families are tested first so a recorder surface can never be mis-read as a
// dialog and quietly planned as primitives.
const SURFACE_RULES = [
  [/record|transcri/i, "recorder"],
  [/cursor/i, "cursor"],
  [/presence/i, "presence"],
  [/reaction/i, "reactions"],
  [/live.?state|state.?sync/i, "live-state-sync"],
  [/notification.*tool|bell/i, "notifications-tool"],
  [/notification/i, "notifications"],
  [/activity.?log/i, "activity-log"],
  [/inline.*(section|comment)/i, "inline-section"],
  [/multi.?thread/i, "multi-thread"],
  [/autocomplete|mention/i, "autocomplete"],
  [/sidebar.?button/i, "sidebar-button"],
  [/sidebar/i, "sidebar"],
  [/bubble/i, "bubble"],
  [/text.?comment/i, "text-comment"],
  [/comments?.?tool/i, "comments-tool"],
  [/pin/i, "pin"],
  [/dialog|thread|comment/i, "dialog"],
];
const surfaceFor = (s) => (SURFACE_RULES.find(([re]) => re.test(String(s || "")))?.[1]) || null;

const FAMILY_FOR_SURFACE = Object.fromEntries(
  Object.entries(M.surfaceReachability).filter(([, v]) => v.reachable).map(([k, v]) => [k, v.family]));

// ---------------------------------------------------------------------------------- scaffold ----
async function scaffold() {
  const blocks = await readJson(P("blocks.json"));
  // FAIL LOUD, do not record null. The first run of this pipeline reached the STYLE stage before
  // anyone noticed designSpec.json had never been produced (figma-extract was skipped in intake) —
  // the scaffold had quietly written `designSpec: null` and everything downstream inherited a run
  // with no design numbers at all. Fine for structure, fatal for styling, and invisible until the
  // style stage silently enriched nothing.
  const spec = await readJson(P("designSpec.json"), null);
  if (!spec) {
    console.error(`✗ designSpec.json missing in ${phaseDir}`);
    console.error(`  The style stage needs per-element design values; without it every style rule is unplannable.`);
    console.error(`  Run intake's extraction step first:`);
    console.error(`    node scripts/figma-extract.mjs rest <fileKey> <nodeId> --svg --out ${phaseDir}`);
    process.exit(1);
  }
  const families = blocks.families || [];
  if (!families.length) { console.error("✗ blocks.json has no families — run enumerate-blocks.mjs first"); process.exit(1); }

  const surfaces = [];
  const vcClasses = [];
  for (const fam of families) {
    if (fam.role === "flow") continue;                       // flows compose already-planned surfaces
    const label = fam.component || fam.id;
    const surface = surfaceFor(label);
    const reach = surface ? M.surfaceReachability[surface] : null;
    const primFamily = surface ? FAMILY_FOR_SURFACE[surface] : null;
    const r3 = primFamily ? M.r3.getters[primFamily] : null;
    const vc = `vc-${slug(label)}`;
    vcClasses.push(vc);

    surfaces.push({
      id: fam.id,
      component: label,
      blockIds: fam.blockIds || [],
      surface,
      reachable: reach ? reach.reachable : null,
      ...(reach && !reach.reachable
        ? { modeBlocked: { reason: reach.reason, unmatchedSlots: reach.unmatchedSlots, note: "No primitive exists for these positions. Report mode_blocked; do NOT insert a wireframe (the mode forbids the layer switch) and do NOT plan this surface." } }
        : {}),
      ...(surface ? {} : { _todo_surface: `could not classify '${label}' — set one of: ${Object.keys(M.surfaceReachability).join(", ")}` }),

      // The compose tree. The Planner fills `children`; every node it adds must be a real primitive.
      root: {
        element: "div",
        vcClass: vc,
        _todo_children: "the compose tree for this surface. TWO node shapes: a PRIMITIVE node { primitive: <velt-* tag from manifest/velt-primitives.json>, children: [...], ownAttributes: {}, specNodeId?: string } and an OWN-MARKUP node { element: <html tag>, vcClass: string, text?: string, children: [...], specNodeId?: string }. RULES: (a) a primitive whose manifest entry has requiresTriggerAncestor MUST sit inside that ancestor or the control renders and does nothing; (b) velt-comment-dialog / velt-comment-dialog-thread are NOT containers (velt-comment-dialog-composer is); (c) children on a repeating container render ONCE — own the loop instead; (d) vcClass belongs on OWN-MARKUP nodes ONLY — 325 of the React wrappers destructure their declared props and drop className, so a class on a primitive never reaches the DOM (manifest forwardsClassName); address a primitive by its emitsTag instead; (e) a primitive whose manifest entry has ownsVisibility ALREADY decides when to render — do not gate it again from r3.",
        children: [],
      },

      // R2 — anchor the id ONCE; the consuming primitives inherit it.
      contextAnchor: {
        _todo_anchor: "which attribute(s) this subtree anchors and on which node, e.g. { node: '<vcClass or primitive>', attributes: { 'annotation-id': '<expr>' } }. Put an attribute on a DESCENDANT only to override an inherited value.",
      },

      // R3 — only the six published getters exist.
      r3: r3
        ? { getter: r3.getter, element: r3.element, args: r3.args, reactHook: r3.reactHook, _todo_reads: "the exact state fields this surface's conditionals read, e.g. ['uiState.darkMode','data.annotation.status']. [] if none. Never name a field you have not verified." }
        : { getter: null, note: primFamily ? `no published config getter for family ${primFamily} — state reads are NOT available for this surface; do not invent a getter name` : "surface unclassified", _todo_reads: "[] — or record a gap if the design needs state this surface cannot expose" },

      // Decisions the Planner must make explicitly rather than leave implicit.
      _todo_parentConditions: "for every planned primitive carrying parentOwnedConditions in the manifest: { primitive, condition, decision: 're-express' | 'accept-divergence', how }. [] if none apply.",
      _todo_shadowDom: "the RESOLVED effective shadowDom value for this surface (true|false) — hand-placed primitives INHERIT it, and with it on, class-based CSS silently stops applying while --velt-* variables keep working. Decide it here; the style stage depends on it.",
      hostProps: [],
      _todo_hostProps: "structure-producing host props this surface needs (collapsedComments, collapsedRepliesPreview, pageMode…), each gated on a recognized design cue (R24). [] if none. CSS cannot fake these.",
    });
  }

  // Which design nodes appear ONLY in a Flow frame — i.e. in no State family's slice. Derived, not
  // assumed: the flow briefs and the state briefs are both on disk by now.
  const flowOnlyIds = await computeFlowOnlyNodeIds(P, blocks);

  const planPrimitives = {
    _doc: "PRIMITIVES compose plan (R1 children / R2 context / R3 data). Scaffolded by scripts/scaffold-primitives.mjs; the Planner FILLS the _todo_* fields and never authors this from scratch. Gate: scaffold-primitives.mjs <phaseDir> --lint (exit 0) before the build.",
    layer: "primitives",
    mode: "strictly primitives",
    availability: M.availability,
    generatedFrom: { blocks: "blocks.json", designSpec: spec ? "designSpec.json" : null, manifest: "manifest/velt-primitives.json" },
    surfaces,
    // FLOW-ONLY CONTENT. `Flows` frames are full-surface ACCEPTANCE screens; they are skipped as
    // build units because they compose surfaces the State families already cover. Anything drawn
    // ONLY in a flow frame therefore has no surface entry and is planned NOWHERE — run 5 lost an
    // entire thread list this way, and the scaffold's console warning was the only trace. A warning
    // nothing reads is not a gate, so the disposition is now a required field.
    flowOnly: flowOnlyIds.length
      ? {
          nodeCount: flowOnlyIds.length,
          sampleNodeIds: flowOnlyIds.slice(0, 12),
          _todo_adoption: "Every cluster of design nodes that appears ONLY in a Flow frame must be dispositioned: [{ what: '<what it is>', decision: 'adopt' | 'defer', into?: '<surface id it is adopted into>', why: '<reason>' }]. `adopt` means you extend that surface's compose tree to cover it in THIS phase. `defer` means it is a later phase's work — say which, so the omission is a decision on the record rather than an oversight. [] is only valid when the flow frames add nothing the State families already cover.",
        }
      : null,
  };

  // The layer-agnostic projection. Deliberately `slots: []` — a primitives build has no wireframe
  // slots, and planStructureProblems() iterates slots, so this validates clean and honestly.
  const planStructure = {
    _doc: "PROJECTION of plan-primitives.json — the layer-agnostic fields the shared gates and the STYLE stage read (vcClasses, designTokens, baseStyling, hostProps). `slots` is empty because a primitives build has no wireframe slots. Do not hand-edit: regenerate with scaffold-primitives.mjs.",
    derivedFrom: "plan-primitives.json",
    layer: "primitives",
    components: surfaces.filter((s) => s.reachable !== false).map((s) => ({
      id: s.id, veltComponents: {}, slots: [], hostProps: s.hostProps || [],
    })),
    vcClasses,
    designTokens: spec?.designTokens || {},
    baseStyling: { unstyledBase: true, note: "Every run works on the unstyled base — client.setUnstyledMode(true, { keepFunctionalStyles: true })." },
  };

  await fs.writeFile(P("plan-primitives.json"), JSON.stringify(planPrimitives, null, 2) + "\n");
  await fs.writeFile(P("plan-structure.json"), JSON.stringify(planStructure, null, 2) + "\n");

  // PROBE BRIEFS — one per block. dom-snapshot.mjs reads briefs/<blockId>.probes.json for the block's
  // liveSelector and refuses to snapshot without one; the style stage and the Judge then read the
  // snapshot. Without these the whole post-build half of the pipeline has nothing to run against.
  //
  // A primitives build can DERIVE the selector deterministically, which the wireframe path cannot:
  // the vcClass is authored by our own builder onto our own markup, so it is post-build-stable by
  // construction. (The wireframe path has to guess a selector that survives Velt replacing the tree.)
  //
  // Scoping matters: a block gets its SURFACE's vcClass, so a thread-card block snapshots ONE card
  // rather than the whole list. Snapshotting the list root captured 7,315 nodes on this design,
  // because a hand-composed loop renders every row where the built-in virtualises.
  const briefDir = P("briefs");
  await fs.mkdir(briefDir, { recursive: true });
  const blockById = new Map((blocks.blocks || []).map((b) => [b.id, b]));
  let briefCount = 0;
  for (const s of surfaces) {
    if (s.reachable === false) continue;
    for (const id of s.blockIds || []) {
      const b = blockById.get(id);
      if (!b) continue;
      const primary = `.${s.root.vcClass.split(/\s+/)[0]}`;

      // Per-element style rows, built from the block's spec slice (spec-slice.mjs must have run).
      //
      // Per-element selectors are deliberately LEFT AS _todo for the style planner to resolve against
      // the dom-snapshot. It is tempting to auto-fill `.vc-<figma-layer-name>` — the plan does own its
      // vcClasses — but those are per-SURFACE ("vc-comment-thread-components"), while the per-element
      // classes are chosen by the builder from the DOM it is building ("vc-comment", "vc-comment-avatar").
      // Deriving a selector from a Figma layer name invents classes that never render: on this design
      // it produced `.vc-single-comment-dialog` and `.vc-avatar` against a build that emits
      // `.vc-comment` and `.vc-comment-avatar`. Only the snapshot knows the real ones.
      // FAIL LOUD. enrichBriefForStyle iterates brief.browser.elements; with no slice there are no
      // elements, so `--style` enriches nothing and still exits 0. A missing prerequisite must stop
      // the scaffold, not produce a brief that passes every gate and measures nothing.
      const slice = await readJson(path.join(briefDir, `${id}.spec.json`), null);
      if (!slice) {
        console.error(`✗ no spec slice for block '${id}' (briefs/${id}.spec.json)`);
        console.error(`  Without it the STYLE stage has no per-element rows and silently enriches nothing.`);
        console.error(`  Run this BEFORE scaffolding:`);
        console.error(`    node scripts/spec-slice.mjs ${phaseDir}/designSpec.json ${phaseDir}/blocks.json --out-dir ${phaseDir}`);
        process.exit(1);
      }
      const probes = scaffoldProbes({ ...b, liveSelector: primary }, slice.nodes || slice, null, { mode: "full" });
      const browser = probes.browser || probes;

      await fs.writeFile(path.join(briefDir, `${id}.probes.json`), JSON.stringify({
        blockId: id,
        browser,
        state: b.state || null,
        surface: s.surface,
        familyId: s.id,
        // Post-build-stable by construction — our builder owns this class.
        liveSelector: primary,
        selectorProvenance: "derived from the primitives plan's vcClass (authored by our own builder, not Velt's DOM)",
        // enumerate-blocks emits PROSE steps ("seed one root comment") as a starting hint. dom-snapshot
        // needs machine-executable step OBJECTS and records the block state-unreachable otherwise —
        // which silently degrades every style rule for that block to unknown→verify. So carry the
        // prose as a hint and make the conversion an explicit _todo, exactly as the wireframe path does.
        drive: isExecutableDrive(b.drive)
          ? b.drive
          : {
              steps: [],
              assert: null,
              _hint_prose: (b.drive?.steps || []).join(" · ") || null,
              // Three rules, each learned from a real false pass on the first run of this pipeline.
              _todo_steps: `Machine-executable step OBJECTS to reach state '${b.state}'. Shape: [{"action":"click","selector":"<sel>"}]. Vocabulary: ${DRIVE_VERBS}.
  (1) IDEMPOTENT — every block shares ONE reused page. A bare toggle click makes block 1 open the surface and block 2 close it; that scored 1/8 captured while the same block passed 1/1 in isolation. Reach the state if it is not already reached; never toggle. Use {"action":"eval","js":"if(!document.querySelector('<marker>')){ …open… }"}.
  (2) REACH THE STATE, not just the surface — opening a sidebar is not reaching "has 2+ replies". Six state blocks once captured the SAME first card and every gate stayed green.
  (3) An empty drive on a surface that must be opened is the classic false-pass: the capture succeeds against nothing.`,
              _todo_assert: `a live selector proving THIS STATE is active — not merely that the surface rendered. Asserting the generic surface marker is what let six states pass while capturing one card; for a "more than 1 reply" state assert the reply-collapser, not the card.`,
              _todo_liveSelector: `OPTIONAL override. The default '${primary}' matches EVERY instance of this surface and the snapshot roots at the FIRST VISIBLE one. If this block is a per-instance STATE, scope it to the instance that exhibits the state (e.g. ':has(<state marker>)' / ':not(:has(<marker>))'), or you will measure a different instance than the one you drove.`,
            },
        frame: b.framePng || null,
        specNodeId: b.figmaNodeId || null,
      }, null, 2) + "\n");
      briefCount++;
    }
  }

  const blockedList = surfaces.filter((s) => s.reachable === false);
  // FLOW blocks still need a brief. A flow family is not PLANNED (it composes already-planned
  // surfaces), but every downstream consumer iterates blocks.blocks — and brief-scaffold --style
  // exits(2) on the first block without a brief, so one missing flow brief silently blocks style
  // enrichment for the entire phase. The wireframe path briefs every block; so must this one.
  const covered = new Set(surfaces.flatMap((s) => s.blockIds || []));
  const rootSurface = surfaces.find((s) => s.reachable !== false);
  for (const b of blocks.blocks || []) {
    if (covered.has(b.id) || !rootSurface) continue;
    const slice = await readJson(path.join(briefDir, `${b.id}.spec.json`), null);
    const sel = `.${rootSurface.root.vcClass.split(/\s+/)[0]}`;
    let browser = null;
    if (slice) browser = (scaffoldProbes({ ...b, liveSelector: sel }, slice.nodes || slice, null, { mode: "full" })).browser || null;
    await fs.writeFile(path.join(briefDir, `${b.id}.probes.json`), JSON.stringify({
      blockId: b.id,
      state: b.state || null,
      role: b.role || null,
      composesSurfaces: surfaces.filter((s) => s.reachable !== false).map((s) => s.id),
      liveSelector: sel,
      selectorProvenance: "flow block — composes already-planned surfaces; rooted at the first planned surface",
      ...(browser ? { browser } : {}),
      drive: { steps: [], assert: null, _todo_steps: `Machine-executable step OBJECTS for this flow. Vocabulary: ${DRIVE_VERBS}. Steps run against a REUSED page shared with every other block — they must be IDEMPOTENT (reach the state if it is not already reached; never toggle).`, _todo_assert: "a live selector proving the flow's end state" },
      frame: b.framePng || null,
      specNodeId: b.figmaNodeId || null,
    }, null, 2) + "\n");
    briefCount++;
  }

  // SMOKE SPEC per family — `--lint-style` requires one per family and fails with
  // "family <id>: smoke.json MISSING" otherwise. The wireframe scaffolder emits these; mine did not.
  for (const fam of families) {
    const s = surfaces.find((x) => x.id === fam.id);
    await fs.writeFile(path.join(briefDir, `${fam.id}.smoke.json`), JSON.stringify({
      familyId: fam.id,
      component: fam.component || null,
      role: fam.role || null,
      blockIds: fam.blockIds || [],
      layer: "primitives",
      ...(s?.reachable === false ? { modeBlocked: s.modeBlocked } : {}),
      surfaceSelector: s ? `.${s.root.vcClass.split(/\s+/)[0]}` : null,
      // Behavioural smoke checks for a primitives build. The compound-trigger one is the important
      // one: a dead control renders pixel-perfect, so only a real click can tell you it is dead.
      checks: [
        { id: "renders", assert: s ? `.${s.root.vcClass.split(/\s+/)[0]}` : null, note: "the composed surface is present and non-zero-size" },
        { id: "no-wireframe-registered", assert: "velt-wireframe", expectCount: 0, note: "a primitives build must register no wireframe" },
        { id: "interactive-controls-live", note: "click every composed interactive element with a REAL pointer at freshly-measured coordinates and assert something changed — synthetic .click() silently fails on Velt controls, and a compound-trigger leaf without its -trigger renders perfectly and does nothing" },
      ],
      _todo_expectedTexts: "canonical visible strings this family must render (author/message/counts) taken from the frame text — or [] if none",
    }, null, 2) + "\n");
  }

  const skippedFlows = families.filter((f) => f.role === "flow").map((f) => f.id);
  console.log(`✓ scaffolded plan-primitives.json (${surfaces.length} surface(s)) + plan-structure.json projection + ${briefCount} probe brief(s)`);
  // Say what was dropped. "Intentionally skipped" and "lost" look identical otherwise (finding F5).
  if (skippedFlows.length) console.log(`  ⓘ skipped ${skippedFlows.length} flow family/families (${skippedFlows.join(", ")}) — flows compose already-planned surfaces. Anything appearing ONLY in a flow frame must be adopted by a surface or it is planned nowhere.`);
  console.log(`  vcClasses: ${vcClasses.join(", ") || "(none)"}`);
  if (blockedList.length) {
    console.log(`  ⚠ ${blockedList.length} surface(s) are NOT reachable by primitives and are excluded from planning:`);
    for (const b of blockedList) console.log(`      ${b.component} → ${b.surface} (${b.modeBlocked.unmatchedSlots} slots, ${b.modeBlocked.reason})`);
  }
  const todos = JSON.stringify(planPrimitives).match(/"_todo_/g)?.length || 0;
  console.log(`  ${todos} _todo field(s) for the Planner to fill · gate with: node scripts/scaffold-primitives.mjs ${phaseDir} --lint`);
}

// -------------------------------------------------------------------------------------- lint ----
// The PLAN-TIME contract gate. Catching a dead compound trigger here is strictly better than
// catching it in the built code: nothing has been written yet.
// Every `note`/`gap` string in a compose tree, own-markup nodes included — `walk` visits primitives
// only, but a declared absence is just as likely to be written on a plain <button> the planner chose
// BECAUSE it believed no primitive existed.
function collectNotes(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.note) out.push(node.note);
  if (node.gap) out.push(String(node.gap));
  for (const c of node.children || []) collectNotes(c, out);
  return out;
}

function walk(node, ancestors, fn) {
  if (!node || typeof node !== "object") return;
  fn(node, ancestors);
  for (const c of node.children || []) walk(c, [...ancestors, node], fn);
}


// Which 611-style design node ids appear ONLY in a Flow frame's spec slice — never in a State
// family's. Read off the slices on disk so it holds for any design, not just one with a thread list.
async function computeFlowOnlyNodeIds(P, blocks) {
  const idsIn = async (file) => {
    const raw = await fs.readFile(P(file), "utf8").catch(() => null);
    if (!raw) return new Set();
    return new Set([...raw.matchAll(/"(\d+:\d+)"/g)].map((m) => m[1]));
  };
  const flowIds = new Set();
  const stateIds = new Set();
  for (const b of blocks.blocks || []) {
    const target = b.role === "flow" ? flowIds : stateIds;
    for (const id of await idsIn(`briefs/${b.id}.spec.json`)) target.add(id);
  }
  return [...flowIds].filter((id) => !stateIds.has(id)).sort();
}

// Rebuild the layer-agnostic PROJECTION from a plan-primitives.json that the Planner has already
// filled. This exists because the projection used to be frozen at scaffold time, when hostProps is
// necessarily still [] — the Planner fills them afterwards, and re-running the scaffold to refresh
// the projection would rebuild `surfaces` from scratch and destroy every fill. verify-host-wiring
// reads ONLY the projection, so on the primitives path planner-planned host props could never reach
// the host at all: a page-mode composer would be planned, never wired, and silently never mount.
async function reproject(P) {
  const plan = await readJson(P("plan-primitives.json"));
  const surfaces = plan.surfaces || [];
  const existing = await readJson(P("plan-structure.json"), null);
  const projection = {
    ...(existing || {}),
    _doc: "PROJECTION of plan-primitives.json — the layer-agnostic fields the shared gates and the STYLE stage read (vcClasses, designTokens, baseStyling, hostProps). `slots` is empty because a primitives build has no wireframe slots. Regenerate with scaffold-primitives.mjs <phaseDir> --reproject after the Planner fills the plan; never hand-edit.",
    derivedFrom: "plan-primitives.json",
    layer: "primitives",
    components: surfaces.filter((s) => s.reachable !== false).map((s) => ({
      id: s.id, veltComponents: {}, slots: [], hostProps: s.hostProps || [],
    })),
    vcClasses: surfaces.map((s) => s.root?.vcClass).filter(Boolean),
  };
  await fs.writeFile(P("plan-structure.json"), JSON.stringify(projection, null, 2) + "\n");
  const hp = projection.components.reduce((n, c) => n + (c.hostProps || []).length, 0);
  console.log(`\u2713 reprojected plan-structure.json from the filled plan — ${projection.components.length} component(s), ${hp} host prop(s) now visible to verify-host-wiring`);

  // Carry the flow-only DEFERRALS into a machine-readable artifact. verdict-gate-blocks requires a
  // PASS or an explicit terminal disposition for every block in blocks.json; a deferral recorded
  // only in the plan reaches it as nothing at all, and the phase reports INCOMPLETE hours later
  // with no trace of the decision that caused it. This is the paper trail between the two.
  const deferred = (plan.flowOnly?.adoption || []).filter((d) => d.decision === "defer");
  if (deferred.length) {
    const blocks = deferred.flatMap((d) => (d.blocks || []).map((b) => ({
      blockId: b, what: d.what, deferredTo: d.deferredTo, why: d.why,
      accountWith: `node scripts/report-block.mjs account ${b} --disposition BLOCKED --evidence <file> --note "deferred to ${d.deferredTo}"`,
    })));
    await fs.writeFile(P("flow-coverage.json"), JSON.stringify({
      _doc: "Blocks this phase deliberately does NOT cover, derived from plan-primitives.json flowOnly.adoption. Each must be accounted with report-block.mjs before verdict-gate-blocks can terminate; an unaccounted block is INCOMPLETE by design.",
      deferredBlocks: blocks,
    }, null, 2) + "\n");
    console.log(`\u2713 flow-coverage.json — ${blocks.length} block(s) deferred and needing explicit accounting before the verdict gate can terminate`);
  }
}

async function lint() {
  const plan = await readJson(P("plan-primitives.json"));
  const blocks = await readJson(P("blocks.json"), { blocks: [] });
  const problems = [];
  const bad = (kind, where, note) => problems.push({ kind, where, note });
  // Advisory channel. A finding that is TRUE but does not make the plan wrong belongs here: an
  // error that blocks a build the golden reference ships is a worse defect than the one it reports.
  const warnings = [];
  const warn = (kind, where, note) => warnings.push({ kind, where, note });

  // 1. no unfilled scaffolding
  const leftovers = [];
  (function scan(o, p = "") {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith("_todo_")) leftovers.push(`${p}${k}`);
      else if (typeof v === "object") scan(v, `${p}${k}.`);
    }
  })(plan);
  for (const l of leftovers) bad("unfilled-todo", l, "the Planner must fill or explicitly empty this field");

  for (const s of plan.surfaces || []) {
    const at = s.id || s.component;

    // 2. reachability was honoured
    if (s.reachable === false && (s.root?.children || []).length)
      bad("planned-unreachable", at, `${s.surface} has no primitive layer — it must be mode_blocked, not planned`);
    if (s.reachable === false) continue;

    // 3. every primitive is real, and every compound-trigger leaf has its ancestor
    walk(s.root, [], (node, ancestors) => {
      const tag = node.primitive;
      if (!tag) return;
      const meta = M.primitives[tag];
      if (!meta) {
        const isRoot = tag === "velt-comment-dialog" || tag === "velt-comment-dialog-thread";
        bad("unknown-primitive", `${at} → ${tag}`, isRoot
          ? "the dialog root/thread host is NOT a container — markup inside it does not render; compose its parts directly (the composer IS a container)"
          : "not in the SDK primitive registry — never invent an identifier (R10)");
        return;
      }
      // In the SDK's tag registry but never registered as a custom element: the browser creates an
      // HTMLUnknownElement, which renders nothing and throws nothing. Neither the compiler nor a
      // pixel diff can see it, and if it is the context anchor the whole subtree is silently dead.
      if (meta.registered === false)
        bad("not-registered", `${at} → ${tag}`,
          `present in the SDK tag registry but NOT registered as a custom element — it would render as HTMLUnknownElement (nothing). ${meta.notRegisteredReason || ""}`);

      if (meta.requiresTriggerAncestor && !ancestors.some((a) => a.primitive === meta.requiresTriggerAncestor))
        bad("dead-trigger", `${at} → ${tag}`, `missing ancestor ${meta.requiresTriggerAncestor} — the click handler lives on the trigger, so this control would render pixel-perfect and do nothing`);

      // 4. parent-owned conditions must be DECIDED, not left implicit
      if (meta.parentOwnedConditions) {
        const decided = (s.parentConditions || []).some((d) => d.primitive === tag);
        if (!decided) bad("undecided-condition", `${at} → ${tag}`,
          `carries parent-owned condition(s) [${meta.parentOwnedConditions.map((c) => c.condition).join(", ")}] it cannot evaluate standalone — record a decision: re-express or accept-divergence`);
      }
    });

    // 5. R3 reads only name published getters
    const reads = s.r3?.reads;
    if (Array.isArray(reads) && reads.length && !s.r3?.getter)
      bad("no-getter", at, "state reads are planned but this surface has no published config getter — record a gap instead of inventing one");
    if (s.r3?.getter && !Object.values(M.r3.getters).some((g) => g.getter === s.r3.getter))
      bad("unpublished-getter", `${at} → ${s.r3.getter}`, `not one of the published getters: ${Object.values(M.r3.getters).map((g) => g.getter).join(", ")}`);

    // 6. shadowDom must be resolved before the style stage plans against it
    if (typeof s.shadowDom !== "boolean")
      bad("unresolved-shadowdom", at, "resolve the effective shadowDom value — with it on, class-based CSS silently stops applying while --velt-* variables keep working");
  }

  // --- P14..P18: the four "renders right, behaves wrong" classes run 5 shipped past every gate ---
  //
  // Each is derived from the manifest, so each holds for ANY design rather than for the one that
  // exposed it. All are ERRORS: every one of them produced a plan that linted clean and was wrong.
  const apis = M.elementApis;
  for (const s2 of plan.surfaces || []) {
    if (s2.reachable === false) continue;
    const at = s2.id || s2.component;
    const plannedTags = [];
    walk(s2.root, [], (node) => { if (node.primitive) plannedTags.push(node); });

    // P14 — a contract class on a primitive whose wrapper drops className can never reach the DOM.
    // The style stage would then plan selectors against a class that does not exist, which surfaces
    // three stages later at skeleton-check as "planned class missing everywhere".
    for (const node of plannedTags) {
      const meta = M.primitives[node.primitive];
      if (!meta) continue;
      if (node.vcClass && meta.forwardsClassName === false)
        bad("undeliverable-vcclass", `${at} → ${node.primitive}`,
          `vcClass '${node.vcClass}' is placed on a primitive whose React wrapper destructures its declared props and DROPS className, so this class never reaches the DOM. Put it on your own markup and address the primitive as '${meta.emitsTag || node.primitive}'.`);
      // Independent of vcClass: the rendered tag differs from the registry name on 762 wrappers, and
      // anything built from the manifest name (selector, probe, assertion) addresses nothing.
      if (meta.emitsTag && meta.emitsTag !== node.primitive && node.addressAs !== meta.emitsTag)
        warn("tag-rename", `${at} → ${node.primitive}`,
          `the React wrapper renders <${meta.emitsTag}>, not <${node.primitive}> — any selector, probe or snapshot assertion built from the manifest tag addresses an element that is not in the DOM.`);
    }

    // P15 — re-implementing a gate the primitive already owns. The SDK's condition is the stricter
    // one (it separates "empty" from "empty under filters"; a row count cannot), so a customer-side
    // re-derivation can only disagree with it.
    const reads = new Set(Array.isArray(s2.r3?.reads) ? s2.r3.reads : []);
    for (const node of plannedTags) {
      const own = M.primitives[node.primitive]?.ownsVisibility;
      if (!own?.computesOwnVisibility) continue;
      const collide = (own.reads || []).filter((f) => reads.has(f));
      if (!collide.length) continue;
      // PRECISION vs RECALL, split deliberately. Fields read by the component's OWN shouldShow are
      // hard evidence — that is a copy of a gate the primitive definitively computes, so it blocks.
      // Fields reached only through an inherited base helper are a heuristic: the union walks the
      // whole `extends` chain and a component does not necessarily call every helper it inherits,
      // so a collision there is a question, not a verdict. Blocking on it would let an over-inclusive
      // derivation stop a correct plan, which is a worse failure than the one this rule prevents.
      const msg = `r3.reads ${JSON.stringify(collide)} are fields this primitive's own visibility condition already evaluates. Mount it unconditionally and let it decide; a customer-side copy of an SDK gate can only ever disagree with it.`;
      if (own.viaBaseClass) warn("maybe-reimplements-own-condition", `${at} → ${node.primitive}`,
        `${msg} (Derived through an inherited base helper, so confirm the component actually calls it before acting.)`);
      else bad("reimplements-own-condition", `${at} → ${node.primitive}`, msg);
    }

    // P16 — a declared ABSENCE that the published facade contradicts. "No method on the element
    // facade" is not "no public API", and a plan that records a gap here sends the builder to
    // hand-roll something the SDK ships.
    if (apis) {
      const known = new Set([...(apis.methods || []), ...(apis.events || [])]);
      const claims = JSON.stringify(s2.r3?.gaps || []) +
                     JSON.stringify(collectNotes(s2.root));
      // Deliberately narrow: this must fire on "the SDK publishes nothing for this", NOT on the
      // ordinary design judgement "no primitive needed here". The first is a claim that can be
      // checked against the facade; the second is a choice and none of this rule's business.
      const denial = /\bno\s+(?:published\s+|public\s+)?(?:action|api|method|event|getter|stream|field)s?\b/i;
      if (denial.test(claims)) {
        const named = [...known].filter((n) => n.length > 6 && new RegExp(`\\b${n}\\b`).test(claims));
        if (!named.length)
          bad("unchecked-absence", at,
            `this surface declares a capability unavailable ("no published …"), but names no element API it checked. The installed facade publishes ${apis.methods.length} methods and ${apis.events.length} events (manifest elementApis) — cite the ones you ruled out, or drop the claim.`);
      }
    }

    // P17 — defaultCondition is a DECISION wherever the primitive actually reads it. P10 already
    // warns about passing it where it is inert; the opposite case had no check at all, so a real
    // visibility gate could be left unaddressed silently.
    for (const node of plannedTags) {
      const meta = M.primitives[node.primitive];
      if (!meta?.readsDefaultCondition) continue;
      const attrs = node.ownAttributes || {};
      const has = "defaultCondition" in attrs || "default-condition" in attrs;
      const decided = (s2.parentConditions || []).some((d) => d.primitive === node.primitive && /defaultCondition/i.test(JSON.stringify(d)));
      if (!has && !decided)
        bad("undecided-defaultcondition", `${at} → ${node.primitive}`,
          `this primitive CALLS defaultCondition(), so the prop is a live opt-out of a real gate here. Either pass it in ownAttributes (and say which condition you are taking over) or record the decision in parentConditions.`);
    }

    // P19 — composed OUTSIDE the primitive's built-in parent. The SDK's own templates render the
    // filter dropdown inside the sidebar header, and the header / composer / list / empty
    // placeholder inside the sidebar panel. Lifted out, a primitive silently forfeits whatever the
    // parent supplied — positioning, a local UI state, a popover anchor. Advisory, because a HOST
    // may legitimately supply the container: acknowledge that with containerProvidedBy on the node.
    walk(s2.root, [], (node, ancestors) => {
      const meta = M.primitives[node.primitive];
      if (!meta?.sdkParents?.length) return;
      if (node.containerProvidedBy) return;                       // explicitly acknowledged
      const inTree = ancestors.some((a) => meta.sdkParents.includes(a.primitive));
      if (inTree) return;
      const registered = meta.sdkParents.filter((t) => M.primitives[t]?.registered !== false);
      warn("outside-builtin-container", `${at} → ${node.primitive}`,
        `the SDK's own templates render this inside ${meta.sdkParents.join(" | ")}, and none of those is an ancestor here. Either place ${registered[0] || meta.sdkParents[0]} in the tree, or set containerProvidedBy on this node to record that the host supplies it.`);
    });
  }

  // P22 — a host prop must name the component it targets, and exist on it. Structure-producing
  // host props cannot be faked in CSS, and a planner working from memory gets them subtly wrong:
  // run 5 rejected `commentPlaceholder` after reasoning about placeholders, while the prop that
  // feeds a sidebar's page-mode composer is `pageModePlaceholder` — both are real, so "does it
  // exist" alone would not have caught it. Requiring the TARGET makes the planner look the
  // component up rather than recall it, and the error prints the real inventory.
  const HP = M.hostProps;
  if (HP) {
    for (const s3 of plan.surfaces || []) {
      const rows = [...(s3.hostProps || []), ...(s3.hostPropsRejected || [])];
      for (const r of rows) {
        if (!r?.prop) continue;
        const tag = r.tag || r.component || r.on;
        if (!tag) {
          bad("hostprop-without-target", `${s3.id} → ${r.prop}`,
            `name the host component this prop is set on (tag: "<VeltComponent>"). The same prop name can exist on several hosts and mean different things, and verify-host-wiring needs the target to bake it in.`);
          continue;
        }
        const known = HP.byComponent[tag];
        if (!known) bad("hostprop-unknown-component", `${s3.id} → ${tag}`,
          `not a Velt host component in the installed package. Known hosts carry ${Object.keys(HP.byComponent).length} distinct prop sets (manifest hostProps.byComponent).`);
        else if (!known.includes(r.prop))
          bad("hostprop-not-on-component", `${s3.id} → ${tag}.${r.prop}`,
            `${tag} declares no '${r.prop}'. Its structure-producing props include: ${known.filter((k) => /^(page|position|embed|collapsed|variant|mode)/i.test(k)).slice(0, 10).join(", ") || known.slice(0, 10).join(", ")}.`);
      }
    }
  }

  // P20 — "unverified" must carry its own verification plan. Run 5 recorded three unverified items
  // and shipped the plan; nothing downstream knew how any of them would ever be settled, so they
  // would have survived to the handoff as prose. An unverified claim with no measurement attached is
  // indistinguishable from a guess, and the submit path is the case in point: whether a composed
  // composer can persist a comment depends on which of three runtime modes it lands in, which is not
  // statically decidable — so it MUST be measured, and the plan must say by what.
  for (const u of plan.unverified || []) {
    if (!u?.verifyBy)
      bad("unverified-without-measurement", `unverified → ${(u?.what || "?").slice(0, 60)}`,
        "record verifyBy: how this gets settled (a drive + assert on a named block, a gate, a probe). An unverified item with no measurement attached cannot be distinguished from a guess, and nothing downstream will ever close it.");
  }

  // P18 — flow-only design content must be dispositioned, not silently dropped.
  const fo = plan.flowOnly;
  if (fo && fo.nodeCount) {
    const ad = fo.adoption;
    if (!Array.isArray(ad))
      bad("undispositioned-flow-content", "flowOnly",
        `${fo.nodeCount} design node(s) appear ONLY in Flow frames and belong to no surface. Record an adoption decision for each cluster (adopt into a surface, or defer to a named later phase) — an omission by oversight and an omission by decision must not look the same.`);
    else
      for (const d of ad) {
        if (!d?.decision || !["adopt", "defer"].includes(d.decision))
          bad("bad-flow-disposition", `flowOnly → ${d?.what || "?"}`, "decision must be 'adopt' or 'defer'");
        else if (d.decision === "defer" && !d.deferredTo)
          bad("defer-without-target", `flowOnly → ${d.what}`,
            "a deferral must name where the work went (deferredTo) — otherwise it is an omission with better manners, and the next run cannot tell the difference.");
        else if (d.decision === "defer" && !Array.isArray(d.blocks))
          // verdict-gate-blocks requires a PASS or an explicit terminal disposition for EVERY block
          // in blocks.json. A deferral that names no blocks therefore leaves them neither measured
          // nor accounted, and the phase silently reports INCOMPLETE at the very end of the run
          // instead of at plan time, when it is still cheap to change.
          bad("defer-without-blocks", `flowOnly → ${d.what}`,
            "a deferral must list the blockIds it leaves uncovered (blocks: [...]), so they can be accounted with report-block.mjs. Otherwise verdict-gate-blocks sees blocks that are neither measured nor dispositioned and the phase is INCOMPLETE.");
        else if (d.decision === "defer") {
          // A blockId that is not in blocks.json accounts for nothing — the real block stays
          // unmeasured and the deferral only looks like coverage.
          const known = new Set((blocks.blocks || []).map((b) => b.id));
          for (const b of d.blocks) if (!known.has(b))
            bad("defer-names-unknown-block", `flowOnly → ${d.what}`, `blockId '${b}' is not in blocks.json — it accounts for nothing`);
        }
        else if (d.decision === "adopt" && !(plan.surfaces || []).some((x) => x.id === d.into))
          bad("adopt-into-unknown-surface", `flowOnly → ${d.what}`, `'into' must name a surface in this plan; got ${JSON.stringify(d.into)}`);
      }
  }

  // --- drive contract, mechanically enforced ------------------------------------------------
  // The three rules above are only worth stating if something checks them. Each of these caught a
  // real false pass on the first run, where every other gate stayed green.
  const briefDir = P("briefs");
  const briefFiles = (await fs.readdir(briefDir).catch(() => [])).filter((f) => f.endsWith(".probes.json"));
  if (!briefFiles.length) bad("no-briefs", "briefs/", "no probe briefs — dom-snapshot has nothing to capture and the whole post-build half of the pipeline silently no-ops");

  const stateBlocks = new Map();
  for (const s of plan.surfaces || []) for (const id of s.blockIds || []) stateBlocks.set(id, s);

  for (const f of briefFiles) {
    const b = await readJson(path.join(briefDir, f), null);
    if (!b) continue;
    const steps = b.drive?.steps || [];
    const at = b.blockId || f;

    // (1) idempotent: a bare click as the FIRST step toggles across the reused page.
    if (steps[0]?.action === "click")
      bad("non-idempotent-drive", at,
        "the first step is a bare click — every block shares ONE reused page, so this toggles what the previous block set up. Guard it: {\"action\":\"eval\",\"js\":\"if(!document.querySelector('<marker>')){ …open… }\"}");

    // (3) a surface that needs opening must assert something.
    if (steps.length && !b.drive?.assert)
      bad("drive-without-assert", at, "drive has steps but no assert — the capture can succeed against nothing (classic false-pass)");

    // (2) a per-instance STATE block must not measure the generic surface selector.
    const surf = stateBlocks.get(b.blockId);
    const generic = surf ? `.${surf.root.vcClass.split(/\s+/)[0]}` : null;
    const isStateBlock = b.state && !/^(default|state)$/.test(b.state);
    if (isStateBlock && generic && b.liveSelector === generic)
      bad("state-block-measures-generic-surface", at,
        `state '${b.state}' uses the generic surface selector '${generic}', which matches every instance — the snapshot roots at the FIRST VISIBLE one, so this measures whichever instance happens to be first, not the one you drove. Scope it with :has()/:not(:has()).`);
    if (isStateBlock && b.drive?.assert && generic && b.drive.assert === generic)
      bad("assert-proves-surface-not-state", at,
        `assert '${b.drive.assert}' only proves the surface rendered, not that state '${b.state}' was reached`);
  }

  if (flag("--json")) { console.log(JSON.stringify({ problems, warnings, ok: !problems.length }, null, 2)); }
  else {
    for (const w of warnings) console.error(`⚠ ${w.kind.padEnd(20)} ${w.where}\n    ${w.note}`);
    if (problems.length) {
      for (const p of problems) console.error(`✗ ${p.kind.padEnd(20)} ${p.where}\n    ${p.note}`);
      console.error(`\n✗ ${problems.length} primitives-plan problem(s) — the build must not start`);
    } else console.log(`✓ primitives plan gate clean (compose tree, triggers, own-conditions, getters, class delivery, flow coverage, shadowDom)${warnings.length ? ` — ${warnings.length} advisory` : ""}`);
  }

  process.exit(problems.length ? 2 : 0);
}

if (flag("--lint")) await lint();
else if (flag("--reproject")) await reproject(P);
else await scaffold();

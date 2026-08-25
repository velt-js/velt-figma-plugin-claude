// primitives-calibration.mjs — offline regression net for the PRIMITIVES path (R1/R2/R3).
//
// Additive: the wireframe calibration suites in run-golden.mjs are untouched and do not import this.
//
// What it pins:
//   1. the capability manifest's load-bearing invariants (a silent under-count here would make
//      `strictly primitives` look achievable on surfaces where it is not);
//   2. the reachability gate's verdicts for a reachable and an unreachable surface;
//   3. that lint-primitives actually catches the dead-compound-trigger bug from PR snippyly/sdk#4506
//      (issues #3/#4) and does NOT fire on the correctly-composed equivalent.
//
// (3) is the one that matters most: that defect renders pixel-perfect, so no chromatic judge can see
// it, and the SDK states the class is not instrumented upstream.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (script, args) => {
  try { return { code: 0, out: execFileSync("node", [path.join(ROOT, "scripts", script), ...args], { encoding: "utf8" }) }; }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};

export async function calibratePrimitives() {
  const checks = [];
  const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

  const M = JSON.parse(await fs.readFile(path.join(ROOT, "manifest/velt-primitives.json"), "utf8"));

  // --- 1. manifest invariants ---------------------------------------------------------------
  const paritySum = Object.values(M.parity.byRegistry).reduce((a, b) => a + b, 0);
  ok("parity rows sum to the stated total", paritySum === M.parity.slotsWithNoPrimitive, `${paritySum} vs ${M.parity.slotsWithNoPrimitive}`);
  ok("parity total is the measured 392/770", M.parity.slotsWithNoPrimitive === 392 && M.parity.wireframeSlotKeys === 770);
  ok("tag registry count matches the SDK snapshot", M.counts.tagsAcceptingChildren === 441, String(M.counts.tagsAcceptingChildren));
  ok("all 13 SDK families are present", Object.keys(M.families).length === 13);
  ok("exactly 6 R3 getters are recorded as published", Object.keys(M.r3.getters).length === 6);

  // Element accessors, verified against a RUNNING local SDK build (v1.0.0). These were the one
  // place a family-name-derived guess slipped through: the activity log hangs off
  // getActivityElement, not getActivityLogElement, and the wrong name throws on undefined.
  const ACCESSORS_VERIFIED_LIVE = {
    CommentDialogPrimitive: "getCommentElement", SidebarV2: "getCommentElement",
    InlineSection: "getCommentElement", MultiThread: "getCommentElement",
    NotificationsPanel: "getNotificationElement", ActivityLog: "getActivityElement",
  };
  for (const [fam, el] of Object.entries(ACCESSORS_VERIFIED_LIVE))
    ok(`${fam} R3 accessor is ${el} (verified live)`, M.r3.getters[fam]?.element === el, M.r3.getters[fam]?.element);
  ok("families without a named R3 getter are listed, not inferred", Array.isArray(M.r3.familiesWithoutNamedGetter) && M.r3.familiesWithoutNamedGetter.length === 7);

  // The dialog ROOT does not accept children (capability exception); the COMPOSER does. Getting this
  // backwards would have the builder wrap everything in <VeltCommentDialog> and render nothing.
  ok("dialog root is absent from the children registry", !("velt-comment-dialog" in M.primitives));
  ok("dialog thread host is absent from the children registry", !("velt-comment-dialog-thread" in M.primitives));
  ok("dialog composer IS in the children registry", "velt-comment-dialog-composer" in M.primitives);

  const triggerLeaves = Object.values(M.primitives).filter((p) => p.requiresTriggerAncestor);
  ok("compound-trigger leaves are indexed", triggerLeaves.length >= 20, `${triggerLeaves.length} leaves`);
  const gated = Object.values(M.primitives).filter((p) => p.parentOwnedConditions);
  ok("parent-owned conditions are indexed", gated.length >= 70, `${gated.length} primitives`);
  ok("availability is flagged unpublished", M.availability.published === false);

  // --- 2. reachability gate ------------------------------------------------------------------
  const reach = run("check-primitive-reachability.mjs", ["--surface", "dialog,sidebar", "--json"]);
  ok("reachable surfaces exit 0", reach.code === 0);
  const blocked = run("check-primitive-reachability.mjs", ["--surface", "recorder,cursor", "--mode", "strictly primitives", "--json"]);
  ok("unreachable surfaces exit 1 under strictly primitives", blocked.code === 1);
  const blockedJson = JSON.parse(blocked.out);
  ok("recorder is MODE_BLOCKED, not silently downgraded", blockedJson.results.every((r) => r.verdict === "MODE_BLOCKED"));
  const mixed = run("check-primitive-reachability.mjs", ["--surface", "recorder", "--mode", "wireframes + primitives", "--json"]);
  ok("under a mixed mode the same surface is NEEDS_WIREFRAME, not blocked", mixed.code === 0 && JSON.parse(mixed.out).results[0].verdict === "NEEDS_WIREFRAME");

  // --- 3. lint catches the real defect --------------------------------------------------------
  const bad = run("lint-primitives.mjs", [path.join(ROOT, "golden/primitives/bad"), "--json"]);
  const badJson = JSON.parse(bad.out);
  const p1 = badJson.findings.filter((f) => f.rule === "P1");
  ok("lint FAILS the dead-chip fixture", bad.code === 1);
  ok("P1 fires on BOTH compound-trigger leaves", p1.length === 2, `${p1.length} P1 finding(s)`);
  ok("P7 names the dialog root as a non-container", badJson.findings.some((f) => f.rule === "P7" && /VeltCommentDialog\b/.test(f.message)));
  ok("P3 blames the element that actually holds the text", badJson.findings.some((f) => f.rule === "P3" && /ThreadCardName/.test(f.message)));
  ok("P8 rejects an unpublished config hook", badJson.findings.some((f) => f.rule === "P8"));

  // The five defect classes the harvey `strictly primitives` run shipped and a human found by hand
  // (cursor/harvey-primitives-run-4-98f8, 39edf95 + 68214b6). Each renders correctly and is wrong,
  // so nothing upstream of the lint can catch them — see golden/primitives/bad/StaleFilterRow.tsx.
  const rule = (r) => badJson.findings.filter((f) => f.rule === r);
  ok("P9 catches a CONDITIONAL top-level child (the React removeChild crash)", rule("P9").length === 1, `${rule("P9").length} P9`);
  ok("P9 is an error, not advice", rule("P9").every((f) => f.severity === "error"));
  ok("P10 flags defaultCondition on every tag whose component never reads it", rule("P10").length === 3, `${rule("P10").length} P10`);
  ok("P10 stays a WARNING — the readsDefaultCondition derivation is a heuristic", rule("P10").every((f) => f.severity === "warn"));
  ok("P11 names all three fallback status ids", rule("P11").length === 3, `${rule("P11").length} P11`);
  ok("P12 catches commentId anchored without commentIndex", rule("P12").length === 1, `${rule("P12").length} P12`);
  ok("P13 catches an SDK mutation inside a setState updater", rule("P13").length === 1, `${rule("P13").length} P13`);

  // A conditional that spans tags (`{open ? (` … `) : null}`) splits its braces across two text
  // chunks. Before the fix that fragment survived the expression strip and P3 blamed the primitive
  // for literal text it never had — a false-positive ERROR on correct code.
  ok("P3 does not fire on a multi-line conditional child", !badJson.findings.some((f) => f.rule === "P3" && /open \?/.test(f.message)));

  const good = run("lint-primitives.mjs", [path.join(ROOT, "golden/primitives/good"), "--json"]);
  const goodJson = JSON.parse(good.out);
  ok("lint PASSES the correctly-composed fixture", good.code === 0, `${goodJson.errors} error(s)`);
  ok("no P1 on the correct composition", !goodJson.findings.some((f) => f.rule === "P1"));
  ok("no P3 false positive on wrapped text", !goodJson.findings.some((f) => f.rule === "P3"));
  for (const r of ["P9", "P10", "P11", "P12", "P13"])
    ok(`no ${r} on the corrected composition`, !goodJson.findings.some((f) => f.rule === r));

  // The manifest field P10 reads. Derived from the SDK's own component sources; if the derivation
  // silently produced nothing, P10 would go quiet and this suite would still pass without it.
  const dcReaders = Object.values(M.primitives).filter((p) => p.readsDefaultCondition === true).length;
  const dcInert = Object.values(M.primitives).filter((p) => p.readsDefaultCondition === false).length;
  ok("manifest records readsDefaultCondition for every primitive", dcReaders + dcInert === Object.keys(M.primitives).length,
    `${dcReaders} read + ${dcInert} inert of ${Object.keys(M.primitives).length}`);
  ok("both outcomes are actually represented (the derivation is not stuck)", dcReaders > 50 && dcInert > 50, `${dcReaders}/${dcInert}`);
  ok("the sidebar-V2 filter-dropdown family is recorded as INERT",
    M.primitives["velt-comment-sidebar-filter-dropdown-content-list-item-v2"].readsDefaultCondition === false);
  ok("a primitive that really gates on it is recorded as a READER",
    M.primitives["velt-comment-dialog-composer"].readsDefaultCondition === true);

  // --- 4. the agents are actually REACHABLE ---------------------------------------------------
  // The scripts and agent files can all be perfect and still never run. This pins the dispatch wiring:
  // without it, `strictly primitives` silently falls through to the wireframe planner/builder.
  const orch = await fs.readFile(path.join(ROOT, "agents/velt-orchestrator.md"), "utf8");
  ok("orchestrator dispatches the primitives planner", orch.includes("velt-planner-primitives"));
  ok("orchestrator dispatches the primitives builder", orch.includes("velt-builder-primitives"));
  ok("orchestrator runs the reachability gate before planning", orch.includes("check-primitive-reachability.mjs"));
  ok("orchestrator gates handoff on the primitives lint", orch.includes("lint-primitives.mjs"));
  const judge = await fs.readFile(path.join(ROOT, "agents/velt-judge-2.md"), "utf8");
  ok("judge carries a primitives probe block", judge.includes("primitives-probe"));

  // The primitives branch must be MODE-SCOPED, or it would change wireframe runs.
  ok("primitives branch is scoped to `strictly primitives`", /PRIMITIVES BRANCH \(mode `strictly primitives` ONLY/.test(orch));
  ok("primitives build stage is scoped to `strictly primitives`", /5a-P\. BUILD-PRIMITIVES \(mode `strictly primitives` ONLY/.test(orch));

  for (const f of ["agents/velt-planner-primitives.md", "agents/velt-builder-primitives.md"]) {
    const src = await fs.readFile(path.join(ROOT, f), "utf8").catch(() => "");
    ok(`${f} exists and pins an Opus model`, /^---[\s\S]*?\bmodel:\s*(opus|claude-opus-)/m.test(src));
  }

  // --- 5. the plan scaffold + plan-time gate (end-to-end, on a synthetic phase) ----------------
  // Without a scaffold the planner hand-authors the compose tree — the sprawl failure mode the
  // architecture exists to prevent — and then hits pre-build gates keyed to the slot-shaped plan.
  const os = await import("node:os");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "velt-prim-"));
  await fs.writeFile(path.join(tmp, "blocks.json"), JSON.stringify({
    families: [
      { id: "fam-comment-dialog", role: "state", component: "Comment Dialog", blockIds: ["b1"], buildOrder: 0 },
      { id: "fam-screen-recorder", role: "state", component: "Screen Recorder", blockIds: ["b2"], buildOrder: 1 },
    ],
    blocks: [
      { id: "b1", role: "state", component: "Comment Dialog", state: "default", order: 0, figmaNodeId: "1:1" },
      { id: "b2", role: "state", component: "Screen Recorder", state: "default", order: 1, figmaNodeId: "1:2" },
    ],
  }));
  // The scaffold now REFUSES to run without designSpec.json and per-block spec slices (fail-loud —
  // both were silently absent on the first real run and the style stage enriched nothing).
  await fs.writeFile(path.join(tmp, "designSpec.json"), JSON.stringify({ nodes: [], designTokens: {} }));
  await fs.mkdir(path.join(tmp, "briefs"), { recursive: true });
  for (const id of ["b1", "b2"]) {
    await fs.writeFile(path.join(tmp, "briefs", `${id}.spec.json`), JSON.stringify({
      nodes: [{ id: "1:1", name: "Card", cssDecls: [{ prop: "background", value: "#ffffff" }], box: { x: 0, y: 0, w: 10, h: 10 } }],
    }));
  }

  const sc = run("scaffold-primitives.mjs", [tmp]);
  ok("scaffold emits both plan files", sc.code === 0);
  const pp = JSON.parse(await fs.readFile(path.join(tmp, "plan-primitives.json"), "utf8"));
  const ps = JSON.parse(await fs.readFile(path.join(tmp, "plan-structure.json"), "utf8"));
  ok("an unreachable surface is excluded from the projection", ps.components.length === 1 && ps.components[0].id === "fam-comment-dialog");
  ok("the unreachable surface is recorded mode_blocked with a reason", !!pp.surfaces.find((s) => s.id === "fam-screen-recorder")?.modeBlocked?.reason);
  ok("the projection declares no wireframe slots", ps.components.every((c) => Array.isArray(c.slots) && !c.slots.length));
  ok("the projection carries vcClasses for the style stage", Array.isArray(ps.vcClasses) && ps.vcClasses.length > 0);

  // The SHARED wireframe-path validator must accept the projection unchanged.
  const { planStructureProblems } = await import("../scripts/brief-scaffold.mjs");
  const codeconnect = JSON.parse(await fs.readFile(path.join(ROOT, "manifest/velt-codeconnect.json"), "utf8"));
  ok("shared planStructureProblems() accepts the projection", planStructureProblems(ps, codeconnect).length === 0);

  ok("plan gate FAILS an unfilled scaffold", run("scaffold-primitives.mjs", [tmp, "--lint"]).code === 2);

  // Fill it the way a Planner would, but with the dead-trigger bug — the gate must catch it.
  const dlg = pp.surfaces.find((s) => s.id === "fam-comment-dialog");
  const stripTodos = (o) => { if (!o || typeof o !== "object") return; for (const k of Object.keys(o)) { if (k.startsWith("_todo_")) delete o[k]; else stripTodos(o[k]); } };
  dlg.root.children = [{ primitive: "velt-comment-dialog-status-dropdown", children: [{ primitive: "velt-comment-dialog-status-dropdown-trigger-icon", children: [] }] }];
  dlg.contextAnchor = { node: "vc-comment-dialog", attributes: { "annotation-id": "{id}" } };
  dlg.r3.reads = []; dlg.shadowDom = false; dlg.parentConditions = [];
  stripTodos(pp);
  await fs.writeFile(path.join(tmp, "plan-primitives.json"), JSON.stringify(pp, null, 2));
  const buggy = run("scaffold-primitives.mjs", [tmp, "--lint", "--json"]);
  ok("plan gate catches a dead compound trigger BEFORE any code exists", buggy.code === 2 && JSON.parse(buggy.out).problems.some((p) => p.kind === "dead-trigger"));

  // Registry-but-not-an-element. Found on the first real run: a planner picked
  // velt-comment-dialog-body as the R2 anchor for a whole thread card. It is in the SDK's tag
  // registry and is NOT a registered custom element, so it renders as HTMLUnknownElement — nothing,
  // with no error — and every descendant loses its context. Six of the eight such tags are
  // container-shaped names, which is exactly what a planner reaches for to wrap and anchor.
  ok("unregistered tags are marked in the manifest", M.primitives["velt-comment-dialog-body"]?.registered === false);
  ok("registered tags are marked true", M.primitives["velt-comment-dialog-thread-card"]?.registered === true);
  ok("the singular sidebar host is flagged unregistered", M.primitives["velt-comment-sidebar-v2"]?.registered === false);
  ok("manifest counts the unregistered tags", M.counts.notRegisteredAtRuntime === 8, String(M.counts.notRegisteredAtRuntime));
  dlg.root.children = [{ primitive: "velt-comment-dialog-body", children: [] }];
  await fs.writeFile(path.join(tmp, "plan-primitives.json"), JSON.stringify(pp, null, 2));
  const unreg = run("scaffold-primitives.mjs", [tmp, "--lint", "--json"]);
  ok("plan gate REJECTS a tag that is not a registered custom element", unreg.code === 2 && JSON.parse(unreg.out).problems.some((p) => p.kind === "not-registered"));

  // Correct it: the trigger wraps its leaves. NOTE the extra obligations that came in with run 5 —
  // all three of these tags CALL defaultCondition(), so each needs a recorded decision, and none may
  // carry a vcClass because their wrappers drop className. "Correct" got stricter on purpose.
  const chain = { primitive: "velt-comment-dialog-status-dropdown", children: [{ primitive: "velt-comment-dialog-status-dropdown-trigger", children: [{ primitive: "velt-comment-dialog-status-dropdown-trigger-icon", children: [] }] }] };
  const decisions = [
    { primitive: "velt-comment-dialog-status-dropdown-trigger", condition: "hasCustomTrigger", decision: "re-express", how: "hide default content when children supplied" },
    // A SECOND, distinct gate on the same tag. hasCustomTrigger and defaultCondition are not the
    // same decision, so recording one does not discharge the other.
    { primitive: "velt-comment-dialog-status-dropdown-trigger", condition: "defaultCondition", decision: "accept-divergence", how: "not passed — the trigger's own gate is wanted here" },
    { primitive: "velt-comment-dialog-status-dropdown", condition: "defaultCondition", decision: "accept-divergence", how: "not passed — the primitive's own gate is the desired behaviour" },
    { primitive: "velt-comment-dialog-status-dropdown-trigger-icon", condition: "defaultCondition", decision: "accept-divergence", how: "not passed — inherits the trigger's visibility" },
  ];
  dlg.root.children = [JSON.parse(JSON.stringify(chain))];
  dlg.parentConditions = decisions;
  await fs.writeFile(path.join(tmp, "plan-primitives.json"), JSON.stringify(pp, null, 2));
  ok("plan gate PASSES a correct compose tree", run("scaffold-primitives.mjs", [tmp, "--lint"]).code === 0);

  // --- run-5 regressions: four plans that linted CLEAN and were wrong -------------------------
  const lintJson = async () => { await fs.writeFile(path.join(tmp, "plan-primitives.json"), JSON.stringify(pp, null, 2));
                                 const r = run("scaffold-primitives.mjs", [tmp, "--lint", "--json"]); return { code: r.code, ...JSON.parse(r.out) }; };
  const kinds = (r) => new Set(r.problems.map((p) => p.kind));

  // (a) a contract class on a primitive whose wrapper drops className can never reach the DOM.
  const classed = JSON.parse(JSON.stringify(chain)); classed.vcClass = "vc-status";
  dlg.root.children = [classed];
  ok("plan gate REJECTS a vcClass on a className-dropping primitive", kinds(await lintJson()).has("undeliverable-vcclass"));

  // (b) re-deriving a gate the primitive already computes.
  dlg.root.children = [{ primitive: "velt-comment-sidebar-empty-placeholder-v2", children: [] }];
  dlg.parentConditions = [{ primitive: "velt-comment-sidebar-empty-placeholder-v2", condition: "defaultCondition", decision: "accept-divergence", how: "not passed" }];
  dlg.r3 = { getter: "getCommentSidebarConfig", element: "getCommentElement", args: [], reactHook: null, reads: ["uiState.noCommentsFound"] };
  ok("plan gate REJECTS re-implementing a primitive's own visibility condition", kinds(await lintJson()).has("reimplements-own-condition"));

  // (c) a declared absence that cites nothing, while the facade publishes 229 methods.
  dlg.r3 = { getter: "getCommentSidebarConfig", element: "getCommentElement", args: [], reactHook: null, reads: [],
             gaps: [{ need: "clear the composer", why: "there is no published action for this" }] };
  ok("plan gate REJECTS an unchecked 'no published API' claim", kinds(await lintJson()).has("unchecked-absence"));
  // ...and ACCEPTS the same claim once it names what it ruled out.
  dlg.r3.gaps = [{ need: "clear the composer", why: "no published action beyond clearComposer, which needs a targetComposerElementId we do not have" }];
  ok("plan gate ACCEPTS a declared absence that names the API it checked", !kinds(await lintJson()).has("unchecked-absence"));

  // (d) flow-only design content must be dispositioned rather than silently dropped.
  dlg.root.children = [JSON.parse(JSON.stringify(chain))]; dlg.parentConditions = decisions;
  dlg.r3 = { getter: "getCommentSidebarConfig", element: "getCommentElement", args: [], reactHook: null, reads: [] };
  pp.flowOnly = { nodeCount: 12, sampleNodeIds: ["1:1"] };
  ok("plan gate REJECTS undispositioned flow-only content", kinds(await lintJson()).has("undispositioned-flow-content"));
  pp.flowOnly.adoption = [{ what: "thread list", decision: "defer", why: "no State frame this Loop" }];
  ok("plan gate ACCEPTS flow-only content once dispositioned", !kinds(await lintJson()).has("undispositioned-flow-content"));
  pp.flowOnly.adoption = [{ what: "thread list", decision: "adopt", into: "nope", why: "x" }];
  ok("plan gate REJECTS adoption into a surface that does not exist", kinds(await lintJson()).has("adopt-into-unknown-surface"));

  // (h) host props must name the component they target and exist on it.
  dlg.hostProps = [{ prop: "pageMode", value: true, designEvidence: "x" }];
  ok("plan gate REJECTS a host prop with no target component", kinds(await lintJson()).has("hostprop-without-target"));
  dlg.hostProps = [{ prop: "notARealProp", value: true, tag: "VeltCommentsSidebarV2", designEvidence: "x" }];
  ok("plan gate REJECTS a host prop that the target component does not declare", kinds(await lintJson()).has("hostprop-not-on-component"));
  dlg.hostProps = [{ prop: "pageMode", value: true, tag: "NotAVeltHost", designEvidence: "x" }];
  ok("plan gate REJECTS an unknown host component", kinds(await lintJson()).has("hostprop-unknown-component"));
  dlg.hostProps = [{ prop: "pageMode", value: true, tag: "VeltCommentsSidebarV2", designEvidence: "x" }];
  ok("plan gate ACCEPTS a host prop that names a real component and prop", !kinds(await lintJson()).has("hostprop-not-on-component"));
  dlg.hostProps = [];

  ok("the manifest carries a host-prop inventory", (M.hostProps?.all || []).length > 50 &&
     (M.hostProps.byComponent?.VeltCommentsSidebarV2 || []).includes("position"));

  // (i) P21 — a handler wrapped around a primitive that owns its own click double-fires. Gated on
  // bindsClick, derived from the SDK templates: a presentational primitive is MEANT to be wrapped,
  // and the first cut of this rule flagged the golden fixture's own correct label-in-a-button.
  ok("the manifest records which primitives bind their own click",
     Object.values(M.primitives).filter((v) => v.bindsClick).length > 50 &&
     M.primitives["velt-comment-dialog-composer-action-button"]?.bindsClick === true &&
     M.primitives["velt-comment-sidebar-filter-dropdown-content-list-item-label-v2"]?.bindsClick === false);

  // --- GENERICITY GUARDS -----------------------------------------------------------------------
  // Every rule added after run 5 was derived from ONE demo's failures. The risk is not that the
  // rules are wrong, it is that they quietly end up describing that one demo: a deriver that only
  // matches the shape the comment tree happens to use reports a confident ZERO for every other
  // family, which reads as "checked, nothing found". Both of these regressed exactly that way once
  // (element APIs scanned a single facade of 19; self-conditions matched a single declaration style
  // and reported 0 for NotificationsPanel, ActivityLog and NotificationsTool), so the coverage is
  // asserted here rather than trusted.
  const famOf = (t) => M.primitives[t]?.family;
  const famsWith = (pred) => new Set(Object.entries(M.primitives).filter(([, v]) => pred(v)).map(([t]) => famOf(t)).filter(Boolean));

  ok("ownsVisibility spans many families, not just the one that exposed the rule",
     famsWith((v) => v.ownsVisibility).size >= 8, `${famsWith((v) => v.ownsVisibility).size} families`);
  ok("ownsVisibility covers BOTH declaration styles (own computed and inherited base helper)",
     Object.values(M.primitives).some((v) => v.ownsVisibility && !v.ownsVisibility.viaBaseClass) &&
     Object.values(M.primitives).some((v) => v.ownsVisibility?.viaBaseClass));
  ok("sdkParents spans many families", famsWith((v) => v.sdkParents).size >= 8, `${famsWith((v) => v.sdkParents).size} families`);
  ok("forwardsClassName is resolved (not null) across families", famsWith((v) => v.forwardsClassName !== null).size >= 8);
  ok("elementApis covers every element facade, not only the comment one",
     (M.elementApis?.facades || 0) >= 15 && Object.keys(M.elementApis?.byFacade || {}).length >= 15,
     `${M.elementApis?.facades} facades`);
  ok("elementApis includes non-comment members (the single-facade regression)",
     (M.elementApis?.byFacade?.notification || []).length > 0 && (M.elementApis?.byFacade?.recorder || []).length > 0);

  // No rule may name a specific primitive, surface or design. The manifest is the only place tag
  // names belong; a tag hardcoded in a rule body is a rule that works for one design.
  const lintSrc = await fs.readFile(path.join(ROOT, "scripts/scaffold-primitives.mjs"), "utf8");
  const ruleRegion = lintSrc.slice(lintSrc.indexOf("P14..P18"));
  const hardTags = [...ruleRegion.matchAll(/["'`](velt-[a-z0-9-]{4,})["'`]/g)].map((m) => m[1]);
  ok("no plan-lint rule hardcodes a primitive tag", hardTags.length === 0, hardTags.join(", "));
  const designWords = [...ruleRegion.matchAll(/\b(harvey|sidebar|composer|thread ?list|notification)\b/gi)]
    .map((m) => m[0].toLowerCase()).filter((w) => !ruleRegion.includes(`// ${w}`));
  ok("no plan-lint rule branches on a surface or design name", !/if\s*\([^)]*\b(harvey|sidebar|composer)\b/i.test(ruleRegion),
     designWords.slice(0, 4).join(", "));

  // (d2) a deferral that does not say where the work went is an omission with better manners.
  pp.flowOnly.adoption = [{ what: "thread list", decision: "defer", why: "no State frame this Loop" }];
  ok("plan gate REJECTS a deferral that names no destination", kinds(await lintJson()).has("defer-without-target"));
  pp.flowOnly.adoption = [{ what: "thread list", decision: "defer", why: "x", deferredTo: "the 369 variant Loop" }];
  ok("plan gate ACCEPTS a deferral that names where it went", !kinds(await lintJson()).has("defer-without-target"));

  // (d3) a deferral must name the BLOCKS it uncovers, and they must be real. verdict-gate-blocks
  // needs a PASS or an explicit terminal disposition for every block; a deferral that names none
  // leaves them neither measured nor accounted, and the phase reports INCOMPLETE hours later.
  pp.flowOnly.adoption = [{ what: "thread list", decision: "defer", why: "x", deferredTo: "the 369 Loop" }];
  ok("plan gate REJECTS a deferral that names no blocks", kinds(await lintJson()).has("defer-without-blocks"));
  pp.flowOnly.adoption[0].blocks = ["not-a-real-block"];
  ok("plan gate REJECTS a deferral naming a block that is not in blocks.json", kinds(await lintJson()).has("defer-names-unknown-block"));
  pp.flowOnly.adoption[0].blocks = ["b1"];
  ok("plan gate ACCEPTS a deferral that names real blocks", !kinds(await lintJson()).has("defer-without-blocks"));

  // (g) an "unverified" claim with no measurement attached is indistinguishable from a guess.
  pp.unverified = [{ what: "submit round trip", why: "runtime branch" }];
  ok("plan gate REJECTS an unverified claim with no verification plan", kinds(await lintJson()).has("unverified-without-measurement"));
  pp.unverified[0].verifyBy = "smoke check submit-round-trip: assert the list row count increases";
  ok("plan gate ACCEPTS an unverified claim that says how it gets settled", !kinds(await lintJson()).has("unverified-without-measurement"));
  delete pp.unverified;

  // (f) composed OUTSIDE the built-in container: advisory, and silenceable by acknowledging it.
  const parented = M.primitives["velt-comment-sidebar-filter-dropdown-v2"]?.sdkParents || [];
  ok("the manifest carries the SDK's own containment graph", parented.includes("velt-comment-sidebar-header-v2"));
  dlg.root.children = [{ primitive: "velt-comment-sidebar-filter-dropdown-v2", children: [] }];
  dlg.parentConditions = []; dlg.r3 = { getter: "getCommentSidebarConfig", element: "getCommentElement", args: [], reactHook: null, reads: [] };
  let r = await lintJson();
  ok("plan gate WARNS when a primitive is composed outside its built-in container",
     r.warnings.some((w) => w.kind === "outside-builtin-container") && r.code === 0);
  dlg.root.children = [{ primitive: "velt-comment-sidebar-header-v2", children: [{ primitive: "velt-comment-sidebar-filter-dropdown-v2", children: [] }] }];
  r = await lintJson();
  ok("the warning clears once the built-in container is in the tree",
     !r.warnings.some((w) => w.kind === "outside-builtin-container" && /filter-dropdown/.test(w.where)));
  dlg.root.children = [{ primitive: "velt-comment-sidebar-filter-dropdown-v2", children: [], containerProvidedBy: "host renders the header" }];
  r = await lintJson();
  ok("acknowledging a host-provided container silences the warning",
     !r.warnings.some((w) => w.kind === "outside-builtin-container"));
  dlg.root.children = [JSON.parse(JSON.stringify(chain))]; dlg.parentConditions = decisions;
  pp.flowOnly = null;

  // (e) the projection must carry host props the PLANNER filled — it is scaffolded before they exist.
  // flowOnly was already cleared by (f) above.
  dlg.hostProps = [{ prop: "pageMode", value: true, designEvidence: "composer above the list" }];
  await fs.writeFile(path.join(tmp, "plan-primitives.json"), JSON.stringify(pp, null, 2));
  const beforeProj = JSON.parse(await fs.readFile(path.join(tmp, "plan-structure.json"), "utf8"));
  const scaffoldedHostProps = (beforeProj.components || []).reduce((n, c) => n + (c.hostProps || []).length, 0);
  run("scaffold-primitives.mjs", [tmp, "--reproject"]);
  const afterProj = JSON.parse(await fs.readFile(path.join(tmp, "plan-structure.json"), "utf8"));
  const reprojectedHostProps = (afterProj.components || []).reduce((n, c) => n + (c.hostProps || []).length, 0);
  ok("the scaffolded projection cannot carry planner host props", scaffoldedHostProps === 0);
  ok("--reproject lifts planner host props into the projection verify-host-wiring reads", reprojectedHostProps === 1);

  await fs.rm(tmp, { recursive: true, force: true });

  const orch2 = await fs.readFile(path.join(ROOT, "agents/velt-orchestrator.md"), "utf8");
  ok("orchestrator scaffolds before dispatching the primitives planner", orch2.includes("scaffold-primitives.mjs"));

  // --- 6. FAIL LOUD ---------------------------------------------------------------------------
  // Every expensive detour in the first real run was a step that silently did nothing and reported
  // success: --style enriched 0 briefs and exited 0; six state blocks captured the same card while
  // every gate stayed green. A missing prerequisite must stop the run, not produce artifacts that
  // pass every gate and measure nothing.
  const t2 = await fs.mkdtemp(path.join(os.tmpdir(), "velt-loud-"));
  const blocksDoc = { families: [{ id: "fam-x", role: "state", component: "Comment Dialog", blockIds: ["b1"], buildOrder: 0 }],
                      blocks: [{ id: "b1", role: "state", component: "Comment Dialog", state: "default", order: 0 }] };
  await fs.writeFile(path.join(t2, "blocks.json"), JSON.stringify(blocksDoc));
  ok("scaffold REFUSES to run without designSpec.json", run("scaffold-primitives.mjs", [t2]).code === 1);
  await fs.writeFile(path.join(t2, "designSpec.json"), JSON.stringify({ nodes: [] }));
  ok("scaffold REFUSES to run without spec slices", run("scaffold-primitives.mjs", [t2]).code === 1);

  const t3 = await fs.mkdtemp(path.join(os.tmpdir(), "velt-empty-"));
  await fs.writeFile(path.join(t3, "a.tsx"), "export const x = 1;\n");
  const emptyLint = run("lint-primitives.mjs", [t3, "--json"]);
  ok("lint FAILS on a scan that found no primitives (not a clean pass)",
     emptyLint.code === 1 && JSON.parse(emptyLint.out).findings.some((f) => f.rule === "P0"));

  // --- 7. DRIVE CONTRACT ----------------------------------------------------------------------
  // The three rules that produced false passes on the first run, now mechanically enforced.
  const t4 = await fs.mkdtemp(path.join(os.tmpdir(), "velt-drive-"));
  await fs.writeFile(path.join(t4, "plan-primitives.json"), JSON.stringify({
    surfaces: [{ id: "fam-x", surface: "dialog", reachable: true, blockIds: ["b1"],
      root: { element: "div", vcClass: "vc-x", children: [] },
      contextAnchor: { node: "x", attributes: {} }, r3: { getter: "getCommentDialogConfig", reads: [] },
      parentConditions: [], shadowDom: false, hostProps: [] }],
  }));
  await fs.mkdir(path.join(t4, "briefs"), { recursive: true });
  const writeBrief = (drive, liveSelector) => fs.writeFile(path.join(t4, "briefs", "b1.probes.json"),
    JSON.stringify({ blockId: "b1", state: "with-replies", liveSelector, drive }));

  await writeBrief({ steps: [{ action: "click", selector: "button" }], assert: ".vc-x--reply" }, ".vc-x:has(.r)");
  let out = JSON.parse(run("scaffold-primitives.mjs", [t4, "--lint", "--json"]).out);
  ok("drive contract catches a non-idempotent (toggle) first step", out.problems.some((p) => p.kind === "non-idempotent-drive"));

  await writeBrief({ steps: [{ action: "eval", js: "…" }], assert: null }, ".vc-x:has(.r)");
  out = JSON.parse(run("scaffold-primitives.mjs", [t4, "--lint", "--json"]).out);
  ok("drive contract catches steps with no assert", out.problems.some((p) => p.kind === "drive-without-assert"));

  await writeBrief({ steps: [{ action: "eval", js: "…" }], assert: ".vc-x" }, ".vc-x");
  out = JSON.parse(run("scaffold-primitives.mjs", [t4, "--lint", "--json"]).out);
  ok("drive contract catches a state block measuring the generic surface", out.problems.some((p) => p.kind === "state-block-measures-generic-surface"));
  ok("drive contract catches an assert that only proves the surface", out.problems.some((p) => p.kind === "assert-proves-surface-not-state"));

  // ---- relation/geometry compilers must not be starved on the primitives path ----
  // Regression net for the class of defect nothing used to see: gaps, overlaps and
  // glyph paint mode. The wireframe path fed these from plan-fills slots; a primitives
  // build has none, so every relation assertion silently vanished.
  {
    const CA = await import(path.join(ROOT, "scripts", "compile-assertions.mjs"));
    // Two siblings 10px apart inside a parent, plus a stroked glyph in the right one.
    const designSpec = { nodes: [
      { id: "n:root", name: "Root", type: "FRAME", frameId: "f1", box: { x: 0, y: 0, w: 200, h: 100 }, cssDecls: {} },
      { id: "n:a", name: "A", type: "FRAME", frameId: "f1", box: { x: 10, y: 10, w: 40, h: 20 }, cssDecls: {} },
      { id: "n:b", name: "B", type: "FRAME", frameId: "f1", box: { x: 60, y: 10, w: 40, h: 20 }, cssDecls: {} },
      { id: "n:g", name: "Glyph", type: "VECTOR", frameId: "f1", box: { x: 64, y: 14, w: 12, h: 12 }, cssDecls: { border: "1px solid #000" } },
    ] };
    const planStyle = { rules: [
      { selector: ".root", specNodeId: "n:root", decls: {} },
      { selector: ".a", specNodeId: "n:a", decls: {} },
      { selector: ".b", specNodeId: "n:b", decls: {} },
    ] };
    const slots = CA.slotsFromDesign(planStyle, designSpec);
    ok("design tree yields pseudo-slots when plan-fills has none", slots.length === 3, `${slots.length}`);
    const kid = slots.find((x) => x.vcClass === ".a");
    ok("containment recovers the parent from boxes alone", kid?.parentSelector === ".root", String(kid?.parentSelector));

    const rel = CA.compileSlotRelations(slots);
    const ab = rel.find((r) => r.a?.selector === ".a" && r.b?.selector === ".b");
    ok("sibling gap is compiled from the design boxes", !!ab && ab.expected === 10, `${ab && ab.expected}`);
    ok("sibling gap is a rect-rel-gap on the x axis", ab?.kind === "rect-rel-gap" && ab?.axis === "x");

    const glyph = CA.compileGlyphPaint(designSpec, slots);
    ok("a Figma `border` vector compiles to an expected STROKE glyph",
      glyph.length === 1 && glyph[0].expected === "stroke", JSON.stringify(glyph.map((g) => g.expected)));
    ok("glyph paint assertion keeps design provenance", /designSpec/.test(glyph[0]?.expectedSource || ""));

    // A filled vector must compile to `fill` — the mode is READ, never assumed.
    const filledSpec = { nodes: [...designSpec.nodes.slice(0, 3),
      { id: "n:g2", name: "G2", type: "VECTOR", frameId: "f1", box: { x: 64, y: 14, w: 12, h: 12 }, cssDecls: { fill: "#111" } }] };
    const glyph2 = CA.compileGlyphPaint(filledSpec, CA.slotsFromDesign(planStyle, filledSpec));
    ok("a Figma `fill` vector compiles to an expected FILL glyph", glyph2[0]?.expected === "fill", String(glyph2[0]?.expected));

    // Genericity: nothing above may hardcode a selector or icon name from any one design.
    const srcCA = await fs.readFile(path.join(ROOT, "scripts", "compile-assertions.mjs"), "utf8");
    ok("relation/glyph compilers name no design-specific class",
      !/\bvc-(composer|thread|sidebar|empty)[a-z-]*\b/.test(srcCA));
  }

  // ---- console-health must see WARNINGS, not only errors ----
  // The SDK reports structural misuse ("children replace the default content",
  // "not rendering the markup you placed inside it", unresolved identity) at warn
  // level. Counting only `error` made a broken surface read "console healthy".
  {
    const CH = await import(path.join(ROOT, "scripts", "console-health.mjs"));
    const warn = (text) => ({ sev: "warning", text });
    const r = CH.assess([...Array(12)].map(() => warn("[Velt] Children passed to <x-y> replace its default content.")));
    ok("a repeating SDK WARNING is a storm, not silence", r.storm === true);
    ok("warnings are counted and reported", r.totalWarnings === 12 && r.totalErrors === 0,
      `err=${r.totalErrors} warn=${r.totalWarnings}`);
    ok("a warning signature keeps its severity", r.signatures[0]?.sev === "warning");
    ok("plain-string entries still read as errors (legacy shape)",
      CH.assess(["boom", "boom"]).totalErrors === 2);
    const srcCH = await fs.readFile(path.join(ROOT, "scripts", "console-health.mjs"), "utf8");
    ok("console-health listens for warnings on the page", /=== *["']warning["']/.test(srcCH));
  }

  // ---- the judge must CREATE data conditions, not excuse them ----
  {
    const RCA = await import(path.join(ROOT, "scripts", "run-compiled-assertions.mjs"));
    const EXEC = RCA.EXEC;
    ok("the executor excuses a missing element when its container is absent",
      /!INPUT\.conditionsForced && a\.parentSelector/.test(EXEC));
    ok("the executor STOPS excusing once conditions are forced",
      /INPUT\.conditionsForced/.test(EXEC) && /stateConfirmed \|\| INPUT\.conditionsForced/.test(EXEC));
    const drv = JSON.parse(await fs.readFile(path.join(ROOT, "knowledge", "data-state-drivers.json"), "utf8"));
    ok("a data-state driver is installed", (drv.drivers || []).length >= 1);
    const d0 = drv.drivers[0];
    ok("the driver captures before it clears, and can restore",
      !!(d0.capture && d0.clear?.method && d0.restore?.method), JSON.stringify(Object.keys(d0)));
    ok("the driver names SDK APIs, not a design's selectors",
      !/\.vc-|#|velt-comment-dialog-thread/.test(JSON.stringify(d0)));
    const srcR = await fs.readFile(path.join(ROOT, "scripts", "run-compiled-assertions.mjs"), "utf8");
    ok("captured data is written to disk BEFORE the clear is measured",
      srcR.indexOf("data-backup.") < srcR.indexOf("conditionsForced: true"));
    ok("losing data during a drive is reported as DATA LOSS", /DATA LOSS/.test(srcR));
  }

  // ---- a MEASURED defect must never be routed as an unknown ----
  {
    const DC = await import(path.join(ROOT, "scripts", "defect-contract.mjs"));
    const geom = DC.classifyDefect({
      source: "compiled-assertion", assertionKind: "rect-rel-gap",
      element: ".x", property: "rect-gap(.x→.y)", spec: 24, rendered: 96,
    });
    ok("a measured geometry miss routes to layout/style, not replan",
      geom.category === "layout" && geom.requiredMode === "style", `${geom.category}/${geom.requiredMode}`);
    ok("a measured defect is HIGH confidence", geom.confidence === "high");
    ok("its root cause states design vs rendered", /24/.test(geom.rootCause) && /96/.test(geom.rootCause));

    const missing = DC.classifyDefect({
      source: "compiled-assertion", assertionKind: "rect-size",
      element: ".x", property: "height", spec: 24, rendered: "(element missing)",
    });
    ok("an element that never rendered is STRUCTURE, not CSS",
      missing.category === "structure" && missing.requiredMode === "structure",
      `${missing.category}/${missing.requiredMode}`);

    const glyph = DC.classifyDefect({ source: "compiled-assertion", assertionKind: "glyph-paint",
      element: ".i", property: "glyph-paint-mode", spec: "stroke", rendered: "fill" });
    ok("wrong glyph paint mode is markup (structure), not CSS", glyph.requiredMode === "structure");

    // an unrelated row still falls through to the safe default
    const unknown = DC.classifyDefect({ source: "visual-diff", element: "(composed)" });
    ok("a genuinely unknown row still defaults to replan, never CSS",
      unknown.category === "uncertain" && unknown.requiredMode === "replan");
  }

  // ---- a data driver must never act on an unsettled collection ----
  {
    const srcR = await fs.readFile(path.join(ROOT, "scripts", "run-compiled-assertions.mjs"), "utf8");
    ok("capture settles before it is trusted", /stable >= 2 && n > 0/.test(srcR));
    ok("a zero/unsettled read REFUSES to drive rather than clearing", /refusing to drive/.test(srcR));
    ok("restore is verified against a reloaded page, not the in-memory store",
      /page\.reload\(/.test(srcR) && srcR.indexOf("page.reload(") < srcR.indexOf("return { restored: n, liveCount: live }"));
  }

  // ---- measuring NOTHING must never read as measuring FAILURE ----
  {
    const srcR = await fs.readFile(path.join(ROOT, "scripts", "run-compiled-assertions.mjs"), "utf8");
    ok("the runner waits for planned landmarks before measuring", /planned landmarks are visible/.test(srcR));
    ok("an unready app aborts instead of reporting defects", /Refusing to measure/.test(srcR));
    ok("readiness is checked BEFORE the assertion pass", srcR.indexOf("Refusing to measure") < srcR.indexOf("const byState = new Map()"));
    ok("the runner picks the tab the app is live in, not the first URL match",
      /remember a fallback, keep looking for a live one/.test(srcR));
  }

  // ---- a collapsed surface must not score like an open one ----
  {
    const srcR = await fs.readFile(path.join(ROOT, "scripts", "run-compiled-assertions.mjs"), "utf8");
    ok("readiness walks the ancestor chain for clipping", /clips && \(ar\.width < 1 \|\| ar\.height < 1\)/.test(srcR));
    ok("a collapsed surface is named as such, not reported as defects", /COLLAPSED/.test(srcR));
  }

  for (const d of [t2, t3, t4]) await fs.rm(d, { recursive: true, force: true });

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n— primitives (R1/R2/R3) calibration —`);
  for (const c of checks) console.log(`  ${c.pass ? "✓" : "✗"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
  if (failed.length) { console.error(`  ✗ ${failed.length} primitives calibration check(s) failed`); return false; }
  console.log(`  ✓ ${checks.length} primitives checks green`);
  return true;
}

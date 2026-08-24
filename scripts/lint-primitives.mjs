#!/usr/bin/env node
// lint-primitives.mjs — mechanical checks for a PRIMITIVES build (R1 children / R2 context / R3 data).
//
// WHY THIS EXISTS
// PR snippyly/sdk#4506 names two systemic defect classes found by building the thing, and states that
// one of them ("actions the wrapper owns") is NOT instrumented upstream. Both are exactly the mistakes
// a code generator makes: it reads a design, sees an icon and a label, and composes the two leaf
// primitives — skipping the -trigger that carries the click handler. The result renders perfectly and
// does nothing, which no pixel diff will catch.
//
// PRIMITIVES-ONLY. This is a SEPARATE file from scripts/lint-customization.mjs, which is unchanged and
// still owns the wireframe rules (R1/R4/R8/R23). Nothing here runs on a wireframe build.
//
// RULES
//   P1  dead compound trigger    error  a -trigger-* leaf without its -trigger ancestor = dead control
//   P2  non-composable host      error  children inside a tag that does not accept them (e.g. VeltCommentDialog)
//   P3  bare text children       error  plain text inside a primitive does not render
//   P4  unstable react root      error  children are MOVED, not cloned — needs one stable root element
//   P5  repeater children        error  children on a repeating container render ONCE, not per item
//   P6  parent-owned condition   warn   the built-in surface gates this primitive; standalone it will not
//   P7  unknown primitive        error  identifier is not in the SDK tag registry
//   P8  unnamed R3 getter        error  a config getter that the SDK does not publish
//   P9  conditional moved child   error  a RELOCATED top-level child unmounted mid-life crashes React
//   P10 inert defaultCondition    warn   the prop is passed to a tag whose SDK component never reads it
//   P11 hardcoded status id       error  "RESOLVED"/"OPEN"/"IN_PROGRESS" are fallbacks, not the catalog
//   P12 commentId without index   warn   index-resolving descendants silently target the wrong comment
//   P13 SDK call in a setState updater  error  updaters must be pure; React runs them twice in StrictMode
//
// USAGE
//   node scripts/lint-primitives.mjs <file-or-dir> [...]   # defaults to cwd
//   node scripts/lint-primitives.mjs --json
//   node scripts/lint-primitives.mjs --warn-only           # never exit non-zero
//
// EXIT: 0 clean (or --warn-only), 1 errors found, 2 bad usage.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const targets = argv.filter((a) => !a.startsWith("--"));

const M = await fs.readFile(path.join(ROOT, "manifest/velt-primitives.json"), "utf8")
  .then(JSON.parse).catch(() => null);
if (!M) { console.error("✗ manifest/velt-primitives.json missing — run: node scripts/sync-primitives.mjs"); process.exit(2); }

// React name -> tag, and the reverse, so we can lint JSX and HTML with one rule set.
const byReact = new Map();
for (const [tag, p] of Object.entries(M.primitives)) if (p.reactName) byReact.set(p.reactName, { tag, ...p });
const isVeltReact = (n) => /^Velt[A-Z]/.test(n);

const R3_GETTER_NAMES = new Set(Object.values(M.r3.getters).map((g) => g.getter));
const R3_HOOK_NAMES = new Set(Object.values(M.r3.getters).map((g) => g.reactHook).filter(Boolean));

// Names that LOOK like primitives but are not, and must never be reported as unknown (P7):
//
//   a) SDK hosts / mount points — VeltProvider, VeltComments, VeltCommentsSidebarV2, … The manifest
//      counts 51 of these but does not list them, so we resolve them from the app's OWN installed
//      @veltdev/react: exported there + absent from the primitive registry = a host.
//   b) The customer's own components that happen to start with "Velt" — VeltCollaboration,
//      VeltInitializeDocument, … A regex cannot tell these from a primitive; the import does.
//
// Without this, P7 fires on every real app that mounts <VeltProvider> and the gate can never pass.
// (Found on the first real run: 7 P7 errors, 6 of which reproduced on the untouched app.)
async function loadSdkExports(roots) {
  // Prefer the vendored list (extracted from the app's own @veltdev/react, which uses a single
  // `export { Internal as Public, ... }` block — a `declare const` scan misses every aliased name,
  // e.g. `SnippylySidebarButton as VeltSidebarButton`).
  const vendored = await fs.readFile(path.join(ROOT, "manifest/primitives-src/react-exports.json"), "utf8")
    .then((s) => new Set(JSON.parse(s).exports || [])).catch(() => null);
  if (vendored?.size) return vendored;
  const names = new Set();
  for (const r of roots) {
    for (const rel of ["node_modules/@veltdev/react/index.d.ts", "../node_modules/@veltdev/react/index.d.ts"]) {
      const src = await fs.readFile(path.resolve(r, rel), "utf8").catch(() => null);
      if (!src) continue;
      const blk = src.match(/export \{([\s\S]*?)\};?\s*$/);
      for (const part of (blk ? blk[1] : "").split(",")) {
        const n = part.trim().split(/\s+as\s+/).pop().trim();
        if (/^Velt[A-Z]/.test(n)) names.add(n);
      }
      if (names.size) return names;
    }
  }
  return names;
}

// Containers whose children render once rather than per item (P5). A repeating container is one whose
// name marks it as a list/collection; the SDK renders the loop itself.
const REPEATER_RE = /(List|Threads|Comments|Reactions|Attachments|Recordings|Options|Items)$/;

// P11 — the three ids `CustomFilterService` falls back to when a workspace has configured no status
// catalog. They are NOT the catalog. A workspace that configured its own gets different ids, classified
// by `status.type` ('terminal' for resolved-like), so code keyed to these literals hands that customer a
// filter that silently empties their list. Derive from live data (`status.type`) instead.
const FALLBACK_STATUS_IDS = /['"](RESOLVED|OPEN|IN_PROGRESS)['"]/g;

// P13 — element methods that mutate Velt state. None of them may run inside a setState updater: React
// invokes updaters twice in development StrictMode specifically to prove they are pure.
const VELT_MUTATORS = /\b(setCommentSidebarFilters|setCommentSidebarSort|addComment|deleteComment|editComment|updateComment|clearComposer|setCustomStatus|resolveComment|unresolveComment)\s*\(/;

// P9 — a JSX expression container that OPENS with a conditional: `{x ? …`, `{x && …`.
// `?.` is optional chaining, not a ternary. `.map(` is excluded because a predicate inside a loop
// callback (`items.filter(x => x.a && x.b).map(…)`) is not a conditional child.
const COND_CHILD_RE = /\{[^{}]*(?:&&|\?(?![.:]))/;

const findings = [];
const add = (rule, severity, file, line, message, fix) => findings.push({ rule, severity, file, line, message, fix });

// --- tiny JSX scanner --------------------------------------------------------------------------
// Not a parser. It walks the source as a token stream so that ancestry AND the text between tags are
// attributed to the element that actually contains them — a line-based pass gets this wrong, because
// `<Name><span>x</span></Name>` on one line would blame the enclosing element for `x`.
// Deliberately conservative: anything it cannot resolve is skipped rather than guessed at.
const VOID_HTML = new Set(["br", "img", "input", "hr", "meta", "link", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);

function scan(src, file) {
  // Blank out comments and string literals so their contents never look like markup or text.
  const masked = src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => " ".repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));

  const lineAt = (idx) => masked.slice(0, idx).split("\n").length;

  // name -> module specifier, and names declared in THIS file. Both are needed to tell a primitive
  // from a host or from the customer's own Velt*-named component.
  const imports = new Map();
  // The default binding must NOT require a trailing comma — `import X from "y"` is the common form,
  // and requiring `X,` made every default-imported customer component look like an unknown primitive.
  for (const m of masked.matchAll(/import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?[^'"]*['"]([^'"]+)['"]/g)) {
    const spec = m[3];
    if (m[1]) imports.set(m[1], spec);
    for (const part of (m[2] || "").split(",")) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) imports.set(n, spec);
    }
  }
  const locals = new Set();
  for (const m of masked.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:function|const|let|var|class)\s+(Velt\w+)/g)) locals.add(m[1]);

  const stack = [];
  const tagRe = /<(\/)?([A-Za-z][\w.:-]*)((?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\}|[^>"'{])*?)(\/)?>/g;

  let cursor = 0;
  let m;
  while ((m = tagRe.exec(masked))) {
    // Text sitting between the previous tag and this one belongs to the current innermost element.
    consumeText(masked.slice(cursor, m.index), cursor, stack, lineAt);
    cursor = m.index + m[0].length;

    const [full, closing, name, attrs, selfClose] = m;
    const lineNo = lineAt(m.index);
    const known = byReact.get(name);

    if (closing) {
      for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === name) { checkClose(stack.splice(k, 1)[0], file); break; }
      continue;
    }

    if (stack.length) stack[stack.length - 1].sawElementChild = true;

    if (isVeltReact(name)) {
      if (!known) {
        // P7 — not in the registry. Suppress the two false-positive classes: SDK hosts/mount points
        // and the customer's own Velt*-named components (identified by a non-@veltdev import or a
        // local declaration). Only a name that is neither is genuinely unknown.
        const isDialogRoot = name === "VeltCommentDialog" || name === "VeltCommentDialogThread";
        const hazard = M.compositionHazards.find((h) => h.id === "dialog-root-rejects-children");
        const localOrigin = locals.has(name) || (imports.has(name) && !imports.get(name).startsWith("@veltdev/"));
        if (isDialogRoot) {
          add("P7", "error", file, lineNo, `${name} is not a container — markup placed inside it does not render.`, hazard.rule);
        } else if (!localOrigin && !SDK_EXPORTS.has(name)) {
          add("P7", "error", file, lineNo,
            `${name} is not in the SDK primitive registry (${M.counts.tagsAcceptingChildren} tags) and is not exported by the installed @veltdev/react.`,
            "Verify the name against the registry; never invent a primitive.");
        }
      }

      // P6 — the built-in surface gates this primitive; hand-placed it cannot gate itself.
      const conds = known?.parentOwnedConditions?.map((c) => c.condition) || [];
      if (conds.length) add("P6", "warn", file, lineNo,
        `${name} has parent-owned visibility condition(s) it cannot evaluate standalone: ${[...new Set(conds)].join(", ")}.`,
        "Re-express the condition in your own code, or accept that this renders whenever mounted.");

      // P1 — a compound-trigger leaf without its -trigger ancestor is a dead control.
      if (known?.requiresTriggerAncestor) checkTriggerAncestor({ name, meta: known, line: lineNo }, stack, file);

      // P10 — `defaultCondition` is declared on the shared primitive BASES, so it typechecks on every
      // primitive; on most tags nothing consumes it. Passing it there is not neutral — it reads as
      // deliberate visibility control and there is no gate behind it. `readsDefaultCondition` is
      // derived from the SDK's own component sources (see sync-primitives.mjs) and is advisory, so
      // this is a warning: a false negative must never block a correct build.
      if (known && known.readsDefaultCondition === false && /\bdefaultCondition\s*=/.test(attrs))
        add("P10", "warn", file, lineNo,
          `${name} is given defaultCondition, but its SDK component never calls defaultCondition() — the prop is inert here.`,
          "Drop it. If you meant to take over a visibility condition, name the condition you are overriding and check the primitive actually has one (P6).");

      // P12 — a descendant that resolves its comment by INDEX cannot fall back to one you never
      // published. Anchoring only `commentId` leaves every index-resolving primitive in the subtree
      // reading position 0, which renders correctly and describes the wrong comment.
      if (known && /\bcommentId\s*=/.test(attrs) && !/\bcommentIndex\s*=/.test(attrs))
        add("P12", "warn", file, lineNo,
          `${name} anchors commentId without commentIndex — descendants that resolve by index will read position 0.`,
          "Pass both, and make the index the position in the FULL comment list, not in a collapsed/filtered slice.");
    }

    const isVoid = selfClose || VOID_HTML.has(name.toLowerCase());
    if (!isVoid) stack.push({ name, tag: known?.tag, line: lineNo, meta: known || null, sawElementChild: false, sawExpressionChild: false, textChild: null, hasMap: false, conditionalChild: null });
  }
  consumeText(masked.slice(cursor), cursor, stack, lineAt);
  for (const leftover of stack.reverse()) checkClose(leftover, file);

  // P8 — a config getter or hook the SDK does not publish. Whole-file scan; ancestry is irrelevant.
  for (const g of masked.matchAll(/\.(get[A-Z]\w*Config)\s*\(/g))
    if (!R3_GETTER_NAMES.has(g[1])) add("P8", "error", file, lineAt(g.index), `${g[1]}() is not a published Velt config getter.`, `Published getters: ${[...R3_GETTER_NAMES].join(", ")}.`);
  // P11 — hardcoded status ids. Scoped to files that actually deal with status, so an unrelated
  // "OPEN" literal elsewhere in an app cannot trip it.
  if (/status/i.test(masked)) {
    for (const m2 of masked.matchAll(FALLBACK_STATUS_IDS))
      add("P11", "error", file, lineAt(m2.index),
        `${m2[0]} is one of CustomFilterService's FALLBACK status ids, not the workspace's catalog.`,
        "A workspace with a configured catalog has its own ids. Classify by status.type ('terminal' for resolved-like) and derive the id set from live annotations — there is no public getter for the catalog.");
  }

  // P13 — a Velt mutation inside a setState updater. React invokes updaters twice in development
  // StrictMode to prove they are pure, so the SDK call fires twice per toggle.
  for (const m3 of masked.matchAll(/\bset[A-Z]\w*\(\s*\(?\s*\w+\s*\)?\s*=>/g)) {
    const body = masked.slice(m3.index, m3.index + 800);
    const hit = body.match(VELT_MUTATORS);
    if (hit) add("P13", "error", file, lineAt(m3.index),
      `${hit[1]}() is called inside a setState updater — updaters must be pure, and React runs them twice in StrictMode.`,
      "Compute the next value, call setState with it, then call the SDK from the handler.");
  }

  for (const h of masked.matchAll(/\b(use[A-Z]\w*Config)\s*\(/g))
    if (!R3_HOOK_NAMES.has(h[1])) add("P8", "error", file, lineAt(h.index), `${h[1]}() is not a published Velt config hook.`, `The only published React config hook is ${[...R3_HOOK_NAMES][0] || "(none)"}. For every other surface use the element method + useEffect/subscribe.`);
}

// Attribute a run of inter-tag text to the innermost open element.
function consumeText(chunk, offset, stack, lineAt) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (/\{[^}]*\.map\s*\(/.test(chunk)) top.hasMap = true;
  if (/\{/.test(chunk)) top.sawExpressionChild = true;
  // P9 — a conditional DIRECTLY inside a primitive. Tested on the RAW chunk, before expression
  // containers are stripped, and only when the innermost open element is the primitive itself:
  // markup nested inside your own element is never relocated and is safe to toggle.
  if (top.meta && !/\.map\s*\(/.test(chunk) && COND_CHILD_RE.test(chunk)) {
    top.conditionalChild ??= { line: lineAt(offset + chunk.search(COND_CHILD_RE)) };
  }
  // Strip JSX expression containers — {x} is an expression child, not literal text.
  // A container that SPANS tags (`{open ? (` … `) : null}`) has its braces split across two chunks,
  // so the balanced-pair strip leaves the fragment behind and P3 blames the primitive for literal
  // text it never had. Drop an unterminated opener and a dangling closer as well.
  const stripped = chunk
    .replace(/\{(?:[^{}]|\{[^{}]*\})*\}/g, " ")
    .replace(/\{[^{}]*$/, " ")
    .replace(/^[^{}]*\}/, " ");
  const text = stripped.trim();
  if (text && !/^[(),;=>{}\[\]]*$/.test(text)) {
    top.textChild ??= { text: text.slice(0, 60), line: lineAt(offset + stripped.indexOf(text[0])) };
  }
}

function checkTriggerAncestor(node, stack, file) {
  const need = node.meta.requiresTriggerAncestor;
  const has = stack.some((s) => s.tag === need);
  if (has) return;
  const needReact = M.primitives[need]?.reactName || need;
  add("P1", "error", file, node.line,
    `${node.name} is a compound-trigger leaf but ${needReact} is not an ancestor — the control will render and do nothing.`,
    `Wrap it: <${needReact}>…</${needReact}>. The click handler lives on the trigger, not its leaves.`);
}

function checkClose(node, file) {
  if (!node.meta) return;
  const { name, meta, line } = node;

  // P3 — plain-text children are not supported.
  if (node.textChild) add("P3", "error", file, node.textChild.line,
    `${name} was given plain text ("${node.textChild.text}") as content, which does not render.`,
    "Wrap it in an element: <span>text</span>.");

  // P5 — children on a repeating container render once, not per item.
  if (REPEATER_RE.test(name) && node.sawElementChild && !node.hasMap)
    add("P5", "error", file, line,
      `${name} is a repeating container — children placed inside it render ONCE, not per item.`,
      "Own the loop: fetch the collection, .map() it, and let R2 context feed each row.");

  // P9 — R1 MOVES customer children out of the host into the primitive's anchor, but React still
  // records the HOST as their parent. Unmounting one makes React call removeChild(host, node) on a
  // node whose real parent is now elsewhere, and the DOM throws
  //   NotFoundError: The node to be removed is not a child of this node
  // taking the whole React root down with it. This is a crash, not a dropped element.
  if (node.conditionalChild) add("P9", "error", file, node.conditionalChild.line,
    `${name} has a CONDITIONAL top-level child. R1 relocates that node, so unmounting it makes React call removeChild() on the wrong parent and the DOM throws NotFoundError.`,
    "Mount it unconditionally and hide it with CSS off a data-* attribute on YOUR OWN ancestor element. (Conditionals nested inside your own markup are safe — only a direct child of the primitive is relocated.)");

  // P4 — children are MOVED, so the top-level child must be stable across renders.
  if (node.sawExpressionChild && !node.sawElementChild)
    add("P4", "warn", file, line,
      `${name} has a bare expression as its only child — children are MOVED (not cloned), so a top-level child that changes identity each render breaks.`,
      "Wrap variable content in one stable element: <span>{value}</span>.");
}

// --- walk --------------------------------------------------------------------------------------
const EXT = new Set([".jsx", ".tsx", ".js", ".ts", ".html"]);
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".velt-customize"]);

async function walk(p, out = []) {
  const st = await fs.stat(p).catch(() => null);
  if (!st) return out;
  if (st.isFile()) { if (EXT.has(path.extname(p))) out.push(p); return out; }
  for (const e of await fs.readdir(p, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    await walk(path.join(p, e.name), out);
  }
  return out;
}

const roots = targets.length ? targets : [process.cwd()];
const SDK_EXPORTS = await loadSdkExports(roots);
const files = (await Promise.all(roots.map((r) => walk(path.resolve(r))))).flat();

for (const f of files) {
  const src = await fs.readFile(f, "utf8").catch(() => null);
  if (src == null || !/Velt[A-Z]|velt-/.test(src)) continue;
  scan(src, path.relative(process.cwd(), f));
}

// FALSE-PASS GUARD. "0 errors" from a scan that examined no primitives is not a pass — it is the
// same silent-no-op class as a style stage that enriches nothing and exits 0. If the target has no
// Velt primitives at all, say so loudly rather than reporting clean.
let primitivesSeen = 0;
for (const f of files) {
  const src = await fs.readFile(f, "utf8").catch(() => null);
  if (src && [...src.matchAll(/\bVelt[A-Z]\w*/g)].some((m) => byReact.has(m[0]))) primitivesSeen++;
}
if (!files.length) add("P0", "error", roots.join(", "), 0, "no scannable files found — the lint examined nothing, which is not the same as clean.", "Check the path; a passing lint over zero files is a false pass.");
else if (!primitivesSeen) add("P0", "error", roots.join(", "), 0, `scanned ${files.length} file(s) and found NO Velt primitives — a primitives build that contains no primitives did not build.`, "If this is intentional (pre-build), do not treat this run as a passing gate.");

const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");

if (flag("--json")) {
  console.log(JSON.stringify({ files: files.length, errors: errors.length, warnings: warns.length, findings }, null, 2));
} else {
  for (const f of [...errors, ...warns]) {
    console[f.severity === "error" ? "error" : "warn"](`${f.severity === "error" ? "✗" : "⚠"} ${f.rule} ${f.file}:${f.line} — ${f.message}`);
    if (f.fix) console.log(`    fix: ${f.fix}`);
  }
  console.log(`\n${files.length} file(s) scanned · ${errors.length} error(s) · ${warns.length} warning(s)`);
  if (!findings.length) console.log("✓ primitives lint clean");
}

process.exit(!flag("--warn-only") && errors.length ? 1 : 0);

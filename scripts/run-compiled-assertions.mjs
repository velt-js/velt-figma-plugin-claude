#!/usr/bin/env node
// run-compiled-assertions.mjs — execute the design-compiled assertion suite on the live app.
//
// Counterpart of compile-assertions.mjs (Phase 1). Results are pass | fail | blocked(reason)
// ONLY (R-C). Spacing/size assertions measure RECTS between resolved landmarks (R-F).
// Paint assertions walk from the matched element to the first painted descendant (R-G).
// Colors compare exact after rgba-normalization; shadows canonically (R-E).
//
// State-scoped assertions run ONLY behind their driver guard: the state is driven via real
// input (Playwright hover/click) and confirmed active — else every assertion of that state
// is blocked(reason), never silently skipped and never "pass" (Phase 2 gate, spike form).
//
// Usage:
//   node scripts/run-compiled-assertions.mjs <phaseDir> [--connect <ws>] [--url <url>]
//        [--suite <path>] [--write]
// Writes <phaseDir>/compiled-results.json; --write also merges fails into
// appearance/<block>.json unresolved[] (source "compiled-assertion") so emit forwards them.
// Exit 0 = all runnable assertions pass; 2 = one or more fails; 1 = harness error.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseColor } from "./delta-compare.mjs";

const require = createRequire(import.meta.url);

async function loadJson(p) { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; } }

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_CORE,
    "playwright-core",
    path.join(process.env.HOME || "", ".claude/skills/gstack/node_modules/playwright-core/index.js"),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      const mod = c.startsWith("/") || c.startsWith(".") ? require(c) : await import(c);
      const pw = mod.default || mod;
      if (pw.chromium) return pw.chromium;
    } catch { /* next */ }
  }
  throw new Error("playwright-core not found — set $PLAYWRIGHT_CORE or npm i -D playwright-core");
}

// In-page executor. Injected with parseColor; receives {assertions, stateConfirmed}.
// Exported for mutation-drill.mjs (Phase 6) — the drill runs the SAME detector, not a copy.
export const EXEC = `(function(INPUT){
  ${parseColor.toString()}
  const assertions = INPUT.assertions || [];
  function vis(el){ if(!el||!el.getBoundingClientRect) return false; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return r.width>1 && r.height>1 && cs.display!=='none' && cs.visibility!=='hidden'; }
  const panel = [...document.querySelectorAll('app-comment-sidebar-panel, .vc-panel, .hw-rail-inner, .hw-rail')].filter(vis)[0] || document.body;
  function q(sel, root){ try { return [...(root||panel).querySelectorAll(sel)].filter(vis); } catch(e){ return []; } }
  // Planned vc-classes the builder may not have adopted verbatim have known LIVE TWINS
  // (registry/internal mounts) — same structural map apply-plan-fills uses. Selectors are
  // bindings, not expectations, so falling back does not touch R-B provenance; the result
  // records which alternative bound (resolvedVia).
  const ALTERNATIVES = {
    '.vc-list': 'app-comment-sidebar-list, [class*="sidebar-list"]',
    '.vc-card': 'velt-comment-dialog-thread-card-internal',
    '.vc-dialogcontainer': 'app-comment-sidebar-list-item, velt-comment-dialog-body-internal',
    '.vc-threads': 'velt-comment-dialog-threads-internal',
    '.vc-reply': '.vc-togglereply, velt-comment-dialog-toggle-reply-internal, [class*="toggle-reply"]',
    '.vc-more-reply': 'velt-comment-dialog-more-reply-internal, [class*="more-reply"]',
    '.vc-pagemodecomposer': 'app-comment-sidebar-page-mode-composer, [class*="page-mode-composer"]',
    '.vc-composer': 'velt-comment-dialog-composer-internal, [class*="dialog-composer"]',
    '.vc-resolvebutton': 'velt-comment-dialog-resolve-button-internal, [class*="resolve-button"], [aria-label*="esolve" i]',
    '.vc-options': 'velt-comment-dialog-options-internal, [class*="options-dropdown"]',
  };
  function resolveOne(sel){ return q(sel)[0] || q(sel, document)[0] || null; }
  function resolve(sel){
    let el = resolveOne(sel);
    if (el) return el;
    // per-token alternatives: ".vc-reply svg" → alternatives for ".vc-reply" + " svg"
    for (const [k, alts] of Object.entries(ALTERNATIVES)) {
      if (!sel.startsWith(k)) continue;
      const tail = sel.slice(k.length);
      for (const alt of alts.split(',')) {
        el = resolveOne(alt.trim() + tail);
        if (el) { el.__resolvedVia = alt.trim() + tail; return el; }
      }
    }
    return null;
  }
  function paintsAny(cs){ const bg=parseColor(cs.backgroundColor); return (bg&&bg.a>0)||((parseFloat(cs.borderTopWidth)||0)>0&&cs.borderTopStyle!=='none')||(!!cs.boxShadow&&cs.boxShadow!=='none')||((parseFloat(cs.borderTopLeftRadius)||0)>0); }
  function walkToPainted(el){ // R-G
    if (!el) return el;
    if (paintsAny(getComputedStyle(el))) return el;
    const hb = el.getBoundingClientRect();
    const cand = el.querySelectorAll('*');
    for (let i=0;i<cand.length&&i<40;i++){ const d=cand[i]; const db=d.getBoundingClientRect();
      if (db.width < hb.width*0.6 || db.height < 4) continue;
      if (db.left<hb.left-4||db.top<hb.top-4||db.right>hb.right+4||db.bottom>hb.bottom+4) continue;
      if (paintsAny(getComputedStyle(d))) return d;
    }
    return el;
  }
  function canonColor(tok){ const c=parseColor(tok); return c ? ('rgba('+c.r+','+c.g+','+c.b+','+(+c.a.toFixed(3))+')') : String(tok); }
  function canonColorsIn(s){ return String(s).replace(/#[0-9a-f]{3,8}\\b|rgba?\\([^)]+\\)/gi, canonColor); }
  function normKeyword(s){ return canonColorsIn(String(s)).trim().toLowerCase().replace(/\\s+/g,' ').replace(/0px|0%/g,'0'); }
  function shadowEqual(exp, ren, tolPx){
    const split = (s)=>String(s).split(/,(?![^(]*\\))/).map(x=>x.trim()).filter(x=>x&&x!=='none');
    const es=split(exp), rs=split(ren);
    if (es.length!==rs.length) return { pass:false, why:'shadow count '+es.length+'≠'+rs.length };
    for (let i=0;i<es.length;i++){
      const tok=(s)=>((s.match(/#[0-9a-f]{3,8}|rgba?\\([^)]+\\)|transparent/i)||[''])[0]);
      const et=tok(es[i]), rt=tok(rs[i]);
      if (canonColor(et)!==canonColor(rt)) return { pass:false, why:'shadow '+i+' colour '+canonColor(et)+' ≠ '+canonColor(rt) };
      const nums=(s)=>((String(s).replace(tok(s)||'','').match(/-?\\d+(\\.\\d+)?/g))||[]).map(Number);
      const en=nums(es[i]), rn=nums(rs[i]);
      while(en.length<4)en.push(0); while(rn.length<4)rn.push(0);
      for (let j=0;j<4;j++) if (Math.abs((en[j]||0)-(rn[j]||0))>tolPx) return { pass:false, why:'shadow '+i+' length['+j+'] Δ'+((en[j]||0)-(rn[j]||0)) };
      if (/\\binset\\b/.test(es[i]) !== /\\binset\\b/.test(rs[i])) return { pass:false, why:'shadow '+i+' inset differs' };
    }
    return { pass:true };
  }
  function gapsOf(container, axis){
    const kids=[...container.children].filter(vis);
    if (kids.length<2) return null;
    let ax = axis;
    if (ax==='auto'){ const fd=getComputedStyle(container).flexDirection||''; ax = /row/.test(fd) ? 'x' : 'y'; }
    const rects=kids.map(k=>k.getBoundingClientRect()).sort((a,b)=> ax==='x' ? a.left-b.left : a.top-b.top);
    const gaps=[];
    for (let i=0;i<rects.length-1;i++){ gaps.push(ax==='x' ? rects[i+1].left-rects[i].right : rects[i+1].top-rects[i].bottom); }
    return { gaps: gaps.map(g=>Math.round(g*10)/10), axis: ax, kids: kids.length };
  }
  function median(arr){ const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; }

  const results = [];
  for (const a of assertions){
    const res = { id:a.id, kind:a.kind, property:a.property, state:a.state, expected:a.expected, tolerance:a.tolerance, designPath:a.designPath, specNodeId:a.specNodeId, expectedSource:a.expectedSource, selector:a.selector||null };
    try {
      if (a.kind==='font-face'){
        const loaded=[]; try { document.fonts.forEach(f=>{ if(f.status==='loaded') loaded.push(String(f.family).replace(/["']/g,'')); }); } catch(e){}
        const ok = loaded.some(l=>l.toLowerCase()===String(a.expected).toLowerCase());
        res.measured = [...new Set(loaded)].slice(0,10);
        res.status = ok ? 'pass' : 'fail';
        if (!ok) res.note = 'font face not in document.fonts (loaded)';
        results.push(res); continue;
      }
      if (a.kind==='rect-rel-gap'){
        const ea=resolve(a.a.selector), eb=resolve(a.b.selector);
        if (!ea||!eb){ res.status='blocked'; res.reason='landmark unresolved: '+(!ea?a.a.selector:'')+' '+(!eb?a.b.selector:''); results.push(res); continue; }
        const ra=ea.getBoundingClientRect(), rb=eb.getBoundingClientRect();
        const g = a.axis==='x' ? rb.left-ra.right : rb.top-ra.bottom;
        res.measured = Math.round(g*10)/10;
        res.status = Math.abs(g-a.expected)<=a.tolerance ? 'pass' : 'fail';
        results.push(res); continue;
      }
      const el0 = resolve(a.selector);
      if (!el0){
        // A PLANNED selector with no live match (even via twins) while its state is
        // CONFIRMED ACTIVE is a missing element — a defect, not an unrunnable assertion.
        // (INPUT.stateConfirmed is true for default, and true for driven states whose guard
        // passed — assertions of unconfirmed states never reach this executor at all.)
        // This is the machine-named form of "resolve button absent on hover".
        // Its design-tree parent is absent too -> this whole surface/state simply
        // isn't drawn right now (e.g. the empty state while the list has rows).
        // Not a defect; not measurable. Missing while the parent IS on screen is
        // a genuine mount defect and still fails below.
        // Nothing else from this element's design frame is on screen either --
        // the frame is a whole drawn state (Figma puts each state on its own
        // artboard), so this state isn't showing right now.
        if (!INPUT.conditionsForced && a.frameCohort && a.frameCohort.length && !a.frameCohort.some((c)=>resolve(c))){
          res.status='blocked';
          res.reason='no element of this design frame is drawn in the current state — nothing to measure';
          results.push(res); continue;
        }
        if (!INPUT.conditionsForced && a.parentSelector && !resolve(a.parentSelector)){
          res.status='blocked';
          res.reason='container '+a.parentSelector+' not drawn in this state — nothing to measure';
          results.push(res); continue;
        }
        if (a.expectedSource==='plan-style.json' || INPUT.stateConfirmed || INPUT.conditionsForced){
          res.status='fail'; res.measured='(element missing'+(a.state!=='default'?' in '+a.state+' state':'')+')';
          res.note='planned selector matches nothing on the live DOM'+(a.state!=='default'?' with state \\''+a.state+'\\' confirmed active (reveal/mount defect)':' (adoption/mount defect)');
        } else { res.status='blocked'; res.reason='selector unresolved: '+a.selector; }
        results.push(res); continue;
      }
      if (el0.__resolvedVia) res.resolvedVia = el0.__resolvedVia;
      if (a.kind==='glyph-paint'){
        // Decide the mode the way a viewer sees it: which channel actually paints.
        const paths = el0.matches('path,line,polyline,circle,rect,ellipse,polygon')
          ? [el0] : Array.from(el0.querySelectorAll('path,line,polyline,circle,rect,ellipse,polygon'));
        if (!paths.length){ res.status='blocked'; res.reason='no drawable geometry inside '+a.selector; results.push(res); continue; }
        const on = (v)=> v && v!=='none' && v!=='transparent' && !/^rgba\(.*,\s*0\)$/.test(v);
        let strokes=0, fills=0;
        for (const pth of paths){
          const cs = getComputedStyle(pth);
          const sw = parseFloat(cs.strokeWidth||'0')||0;
          if (on(cs.stroke) && sw>0) strokes++;
          if (on(cs.fill)) fills++;
        }
        res.measured = strokes&&!fills ? 'stroke' : fills&&!strokes ? 'fill' : strokes&&fills ? 'both' : 'none';
        res.status = res.measured===a.expected ? 'pass' : 'fail';
        if (res.status==='fail') res.note='design paints this glyph with '+a.expected+', markup paints '+res.measured+' ('+paths.length+' path(s))';
        results.push(res); continue;
      }
      if (a.kind==='rect-gap'){
        const g = gapsOf(el0, a.axis||'auto');
        if (!g){ res.status='blocked'; res.reason='fewer than 2 visible children'; results.push(res); continue; }
        res.measured = g.gaps; res.axis = g.axis;
        const m = median(g.gaps);
        res.status = Math.abs(m-a.expected)<=a.tolerance ? 'pass' : 'fail';
        if (res.status==='fail') res.note='median gap '+m+' vs '+a.expected;
        results.push(res); continue;
      }
      if (a.kind==='rect-size'){
        const r = el0.getBoundingClientRect();
        const v = a.dim==='w' ? r.width : a.dim==='h' ? r.height : Math.max(r.width,r.height);
        res.measured = Math.round(v*10)/10;
        const d = v - a.expected;
        res.status = (a.cmp==='min' ? v>=a.expected-a.tolerance : a.cmp==='max' ? v<=a.expected+a.tolerance : Math.abs(d)<=a.tolerance) ? 'pass' : 'fail';
        results.push(res); continue;
      }
      if (a.kind==='rect-inset'){
        const cs=getComputedStyle(el0);
        const r=el0.getBoundingClientRect();
        const kids=[...el0.children].filter(vis);
        if (!kids.length){ res.status='blocked'; res.reason='no visible children to measure inset'; results.push(res); continue; }
        const bl=parseFloat(cs.borderLeftWidth)||0, bt=parseFloat(cs.borderTopWidth)||0, br=parseFloat(cs.borderRightWidth)||0, bb=parseFloat(cs.borderBottomWidth)||0;
        const kr=kids.map(k=>k.getBoundingClientRect());
        const inset={ left: Math.min(...kr.map(k=>k.left)) - (r.left+bl), top: Math.min(...kr.map(k=>k.top)) - (r.top+bt), right: (r.right-br) - Math.max(...kr.map(k=>k.right)), bottom: (r.bottom-bb) - Math.max(...kr.map(k=>k.bottom)) };
        res.measured = Object.fromEntries(Object.entries(inset).map(([k,v])=>[k,Math.round(v*10)/10]));
        let ok=true; const off=[];
        for (const [side,exp] of Object.entries(a.expected)){
          if (Math.abs(inset[side]-exp)>a.tolerance){ ok=false; off.push(side+' '+Math.round(inset[side])+' vs '+exp); }
        }
        res.status = ok?'pass':'fail'; if(!ok) res.note=off.join(', ');
        results.push(res); continue;
      }
      if (a.kind==='paint'){
        const el = walkToPainted(el0);
        if (el!==el0) res.boundTo = ((el.className&&el.className.toString)?el.className.toString().split(/\\s+/)[0]:el.tagName.toLowerCase());
        const cs=getComputedStyle(el);
        const prop=a.property;
        let measured, pass, note;
        if (prop==='background'||prop==='background-color'){ measured=cs.backgroundColor; pass=canonColor(measured)===canonColor((String(a.expected).match(/#[0-9a-f]{3,8}|rgba?\\([^)]+\\)/i)||[a.expected])[0]); }
        else if (prop==='color'||prop==='border-color'||prop==='fill'||prop==='stroke'||prop==='outline-color'){ measured=cs[prop==='border-color'?'borderTopColor':prop]; pass=canonColor(measured)===canonColor(a.expected); }
        else if (prop==='border'){ const w=parseFloat(cs.borderTopWidth)||0; const c=cs.borderTopColor; const ew=(String(a.expected).match(/(-?\\d+(?:\\.\\d+)?)px/)||[])[1]; const ec=(String(a.expected).match(/#[0-9a-f]{3,8}|rgba?\\([^)]+\\)/i)||[])[0];
          measured=w+'px '+cs.borderTopStyle+' '+c;
          const wOk=ew==null||Math.abs(w-parseFloat(ew))<=a.tolerance; const cOk=!ec||canonColor(c)===canonColor(ec);
          pass=wOk&&cOk; note=!wOk?'border width':( !cOk?'border colour '+canonColor(c)+' ≠ '+canonColor(ec||''):''); }
        else if (prop==='border-width'){ measured=cs.borderTopWidth; pass=Math.abs((parseFloat(measured)||0)-(parseFloat(a.expected)||0))<=a.tolerance; }
        else if (prop==='border-radius'){ measured=cs.borderTopLeftRadius; pass=Math.abs((parseFloat(measured)||0)-(parseFloat(a.expected)||0))<=a.tolerance; }
        else if (prop==='box-shadow'){ measured=cs.boxShadow; const r2=shadowEqual(a.expected, measured, Math.max(1,a.tolerance)); pass=r2.pass; note=r2.why; }
        else if (prop==='outline'){ measured=cs.outlineWidth+' '+cs.outlineStyle+' '+cs.outlineColor; pass=normKeyword(measured)===normKeyword(a.expected); }
        else { measured=cs.getPropertyValue(prop); pass=normKeyword(measured)===normKeyword(a.expected); }
        res.measured=String(measured); res.status=pass?'pass':'fail'; if(note) res.note=note;
        results.push(res); continue;
      }
      if (a.kind==='typography'){
        const cs=getComputedStyle(el0);
        const prop=a.property; let measured, pass;
        if (prop==='font-family'){ measured=cs.fontFamily; const fam=String(a.expected).split(',')[0].replace(/["']/g,'').trim().toLowerCase(); pass=String(measured).toLowerCase().split(',')[0].replace(/["']/g,'').trim()===fam; }
        else if (prop==='font-weight'){ const map={normal:400,bold:700}; const m=map[cs.fontWeight]||parseFloat(cs.fontWeight); const e=map[a.expected]||parseFloat(a.expected); measured=cs.fontWeight; pass=m===e; }
        else { measured=cs.getPropertyValue(prop); pass=Math.abs((parseFloat(measured)||0)-(parseFloat(a.expected)||0))<=(a.tolerance||0); }
        res.measured=String(measured); res.status=pass?'pass':'fail';
        results.push(res); continue;
      }
      if (a.kind==='keyword'){
        const cs=getComputedStyle(el0);
        const measured=cs.getPropertyValue(a.property);
        res.measured=String(measured);
        res.status = normKeyword(measured)===normKeyword(a.expected) ? 'pass' : 'fail';
        results.push(res); continue;
      }
      res.status='blocked'; res.reason='no executor for kind '+a.kind;
      results.push(res);
    } catch(e){ res.status='blocked'; res.reason='executor error: '+e.message; results.push(res); }
  }
  return results;
})`;

async function driveState(page, state, guards) {
  const g = guards?.[state];
  if (!g) return { driven: false, ok: false, reason: `no state guard configured for ${state}` };
  const targets = String(g.driveTarget || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const t of targets) {
    try {
      const el = page.locator(t).first();
      if (!(await el.count())) continue;
      if (g.drive === "hover") await el.hover({ timeout: 3000 });
      else if (g.drive === "click") await el.click({ timeout: 3000 });
      await page.waitForTimeout(400);
      // guard check
      if (g.guard === ":hover-on-target") {
        const ok = await page.evaluate((sel) => !!document.querySelector(sel.split(",").map((s) => s.trim() + ":hover").join(",")), t);
        if (ok) return { driven: true, ok: true, target: t };
      } else {
        const ok = await page.evaluate((sel) => {
          const el2 = document.querySelector(sel);
          if (!el2) return false;
          const r = el2.getBoundingClientRect();
          return r.width > 1 && r.height > 1;
        }, g.guard);
        if (ok) return { driven: true, ok: true, target: t };
      }
    } catch { /* next target */ }
  }
  return { driven: true, ok: false, reason: `state '${state}' guard not confirmed (${g.guard})` };
}

/** Read a value the SDK may hand back as a promise or as a subscription. */
const FIRST_VALUE = `(async function(thing, ms){
  return await new Promise((res)=>{
    if (thing && typeof thing.subscribe === 'function'){
      let done=false;
      const sub = thing.subscribe((v)=>{ if(done) return; done=true; try{sub&&sub.unsubscribe&&sub.unsubscribe();}catch(e){} res(v); });
      setTimeout(()=>{ if(!done) res(null); }, ms);
    } else Promise.resolve(thing).then(res, ()=>res(null));
  });
})`;

/**
 * Create the data conditions a state needs, measure, then put the data back.
 *
 * A design state that depends on data (a collection's empty surface) can never be
 * observed while the app holds data, so those assertions used to come back blocked
 * forever. Blocked should mean "the judge could not create the conditions" -- not
 * "the judge did not try". Once the conditions ARE created, an element that still
 * fails to lay out is a defect and is reported as one.
 */
async function driveDataState(page, drv) {
  // Capture only once the collection has SETTLED. Reading it while it is still
  // loading returns [] (or worse, a partial list): the driver would then clear a
  // subset, "restore" that subset, and destroy the rest. Poll until the count is
  // stable across consecutive reads, and refuse to drive on a count of 0, which is
  // indistinguishable from "not loaded yet".
  const backup = await page.evaluate(`(async () => {
    const el = window.Velt && window.Velt.${drv.elementGetter} && window.Velt.${drv.elementGetter}();
    if (!el || typeof el.${drv.capture} !== 'function') return { ok:false, reason:'${drv.capture} unavailable on ${drv.elementGetter}()' };
    let last = -1, stable = 0, items = [];
    for (let i = 0; i < 20; i++) {
      const v = await ${FIRST_VALUE}(el.${drv.capture}(), 8000);
      const n = Array.isArray(v) ? v.length : -1;
      if (n >= 0 && n === last) stable++; else stable = 0;
      if (Array.isArray(v)) items = v;
      last = n;
      if (stable >= 2 && n > 0) return { ok: true, items, settledAt: n };
      await new Promise((r) => setTimeout(r, 750));
    }
    return { ok: false, reason: last === 0
      ? 'collection read as empty after settle window — cannot tell "no data" from "not loaded", refusing to drive'
      : 'collection never settled to a stable count — refusing to drive' };
  })()`);
  if (!backup.ok) return { ok: false, reason: backup.reason };

  const cleared = await page.evaluate(`(async (ids) => {
    const el = window.Velt.${drv.elementGetter}();
    let n = 0;
    for (const id of ids) { try { await el.${drv.clear.method}({ ${drv.clear.argKey}: id }); n++; } catch (e) {} }
    return n;
  })(${JSON.stringify(backup.items.map((i) => i[drv.clear.idField]).filter(Boolean))})`);
  await page.waitForTimeout(drv.settleMs || 4000);

  return { ok: true, captured: backup.items, cleared };
}

async function restoreDataState(page, drv, items) {
  const n = await page.evaluate(`(async (anns) => {
    const el = window.Velt.${drv.elementGetter}();
    let n = 0;
    for (const a of anns) { try { await el.${drv.restore.method}({ ${drv.restore.argKey}: a }); n++; } catch (e) {} }
    return n;
  })(${JSON.stringify(items)})`);
  await page.waitForTimeout(drv.settleMs || 4000);
  // Verify against a RELOADED page: the in-memory store echoes an add back before the
  // backend has it, so re-reading it in place can report a restore that did not persist.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(Math.max(drv.settleMs || 4000, 8000));
  const live = await page.evaluate(`(async () => {
    const el = window.Velt && window.Velt.${drv.elementGetter} && window.Velt.${drv.elementGetter}();
    if (!el) return null;
    let last = -1, stable = 0;
    for (let i = 0; i < 16; i++) {
      const v = await ${FIRST_VALUE}(el.${drv.capture}(), 8000);
      const c = Array.isArray(v) ? v.length : -1;
      if (c >= 0 && c === last) stable++; else stable = 0;
      last = c;
      if (stable >= 2) return c;
      await new Promise((r) => setTimeout(r, 750));
    }
    return last;
  })()`);
  return { restored: n, liveCount: live };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const phaseDir = args.find((a, i) => !a.startsWith("--") && (i === 0 || !["--connect", "--url", "--suite"].includes(args[i - 1])));
  if (!phaseDir) { console.error("usage: run-compiled-assertions.mjs <phaseDir> [--connect <ws>] [--url <url>] [--suite <path>] [--write]"); process.exit(1); }
  const noDriveData = args.includes("--no-drive-data");
  const suitePath = flag("--suite") || path.join(phaseDir, "compiled-assertions.json");
  const suite = await loadJson(suitePath);
  if (!suite?.assertions?.length) { console.error(`✗ no compiled suite at ${suitePath} — run compile-assertions.mjs --write first`); process.exit(1); }
  const ws = flag("--connect") || "http://localhost:9222";
  const url = flag("--url");

  const chromium = await loadPlaywright();
  const browser = await chromium.connectOverCDP(ws);
  const context = browser.contexts()[0];
  // Pick the tab the APP is actually mounted in, not merely one whose URL matches.
  // A dead or half-loaded tab on the same URL measures as "every element missing" and
  // turns a healthy build into a wall of false failures.
  let page = null;
  for (const cand of context.pages()) {
    if (!/localhost|127\.0\.0\.1/.test(cand.url())) continue;
    const alive = await cand.evaluate(() => !!(window.Velt) && document.body && document.body.children.length > 0)
      .catch(() => false);
    if (alive) { page = cand; break; }
    if (!page) page = cand; // remember a fallback, keep looking for a live one
  }
  page = page || context.pages()[0];
  if (!page) { console.error("✗ no page in connected browser"); process.exit(1); }
  if (url && !page.url().includes(new URL(url).host)) await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  // open sidebar if collapsed (same affordance as composed-audit)
  await page.evaluate(async () => {
    const rail = document.querySelector(".hw-rail");
    if (rail && rail.getBoundingClientRect().width < 50) {
      const tog = document.querySelector(".hw-sidebar-toggle, [aria-label*='comment' i]");
      if (tog) { tog.click(); await new Promise((r) => setTimeout(r, 500)); }
    }
  });

  // ---- refuse to measure an app that is not ready ----
  // A page caught mid-reload (or mid-HMR-recompile) resolves almost nothing, and the
  // suite then reports EVERY assertion as "(element missing)" -- a wall of false
  // defects indistinguishable from a genuinely broken build. Measuring nothing is not
  // the same as measuring zero: wait for the planned landmarks, then refuse if they
  // never arrive.
  const landmarks = [...new Set(suite.assertions.map((a) => a.selector).filter(Boolean))];
  if (landmarks.length) {
    // A box is not the same as being on screen. Content inside a collapsed
    // (width:0 / height:0, overflow:hidden) ancestor keeps a full bounding rect
    // and measures perfectly while painting nowhere -- so a CLOSED drawer scores
    // the same as an open one. Require an unclipped ancestor chain.
    const resolvedCount = async () => page.evaluate((sels) => sels.filter((sel) => {
      try {
        const el = document.querySelector(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        if (!(r.width > 1 && r.height > 1)) return false;
        for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.display === "none" || cs.visibility === "hidden") return false;
          const ar = a.getBoundingClientRect();
          const clips = cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible";
          if (clips && (ar.width < 1 || ar.height < 1)) return false;
        }
        return true;
      } catch { return false; }
    }).length, landmarks);
    let best = 0, stable = 0, prev = -1;
    for (let i = 0; i < 40; i++) {
      const n = await resolvedCount();
      best = Math.max(best, n);
      stable = n === prev && n > 0 ? stable + 1 : 0;
      prev = n;
      if (stable >= 2 && n >= Math.ceil(landmarks.length * 0.25)) break;
      await page.waitForTimeout(750);
    }
    const ready = best >= Math.ceil(landmarks.length * 0.25);
    if (!ready) {
      console.error(`✗ surface not on screen at ${page.url()} — only ${best}/${landmarks.length} planned landmarks are visible after 30s.`);
      console.error("  Refusing to measure. Either the page is mid-rebuild, or the surface under test is");
      console.error("  COLLAPSED: content inside a width:0/overflow:hidden ancestor keeps a full bounding");
      console.error("  box, so a closed drawer would otherwise score the same as an open one.");
      console.error("  Reveal the surface (open the drawer) or wait for the rebuild, then re-run.");
      process.exit(3);
    }
  }

  const byState = new Map();
  for (const a of suite.assertions) {
    const s = a.state || "default";
    if (!byState.has(s)) byState.set(s, []);
    byState.get(s).push(a);
  }

  const results = [];
  const stateReport = {};
  for (const [state, assertions] of [...byState.entries()].sort(([a], [b]) => (a === "default" ? -1 : b === "default" ? 1 : 0))) {
    if (state === "default") {
      results.push(...await page.evaluate(`(${EXEC})(${JSON.stringify({ assertions, stateConfirmed: true })})`));
      continue;
    }
    const drive = await driveState(page, state, suite.stateGuards);
    stateReport[state] = drive;
    if (!drive.ok) {
      // Phase-2 gate (spike form): a state assertion NEVER runs unguarded — blocked, not skipped.
      for (const a of assertions) {
        results.push({ id: a.id, kind: a.kind, property: a.property, state, expected: a.expected, designPath: a.designPath, specNodeId: a.specNodeId, expectedSource: a.expectedSource, selector: a.selector || null, status: "blocked", reason: drive.reason });
      }
      continue;
    }
    results.push(...await page.evaluate(`(${EXEC})(${JSON.stringify({ assertions, stateConfirmed: true })})`));
    // leave the state (escape resets hover focus/selection side effects for the next batch)
    await page.keyboard.press("Escape").catch(() => {});
    await page.mouse.move(4, 4).catch(() => {});
    await page.waitForTimeout(250);
  }

  // ---- second pass: states whose CONDITIONS the judge can create itself ----
  const driveReport = { attempted: [], skipped: null };
  const undrawn = results.filter((r) => r.status === "blocked" && /not drawn|nothing to measure/i.test(r.reason || ""));
  if (!undrawn.length) {
    driveReport.skipped = "no assertion was blocked for an undrawn surface";
  } else if (noDriveData) {
    driveReport.skipped = `--no-drive-data set; ${undrawn.length} assertion(s) left blocked`;
  } else {
    const byId = new Map(suite.assertions.map((a) => [a.id, a]));
    const retry = undrawn.map((r) => byId.get(r.id)).filter(Boolean);
    const driversPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "knowledge", "data-state-drivers.json");
    let drivers = [];
    try { drivers = JSON.parse(await fs.readFile(driversPath, "utf8")).drivers || []; } catch { /* none installed */ }
    for (const drv of drivers) {
      if (!retry.length) break;
      const drove = await driveDataState(page, drv);
      if (!drove.ok) { driveReport.attempted.push({ driver: drv.id, ok: false, reason: drove.reason }); continue; }
      // Back the data up BEFORE anything else can go wrong with the restore.
      const backupPath = path.join(phaseDir, `data-backup.${drv.id}.json`);
      await fs.writeFile(backupPath, JSON.stringify(drove.captured, null, 1));
      let measured = [];
      try {
        measured = await page.evaluate(`(${EXEC})(${JSON.stringify({ assertions: retry, stateConfirmed: true, conditionsForced: true })})`);
      } finally {
        const back = await restoreDataState(page, drv, drove.captured);
        driveReport.attempted.push({
          driver: drv.id, ok: true, cleared: drove.cleared, captured: drove.captured.length,
          restored: back.restored, liveCountAfterRestore: back.liveCount, backup: path.basename(backupPath),
          restoreClean: back.liveCount >= drove.captured.length,
          dataLoss: back.liveCount != null && back.liveCount < drove.captured.length,
        });
        // Fewer items live than we captured means the judge DESTROYED data — loud, and
        // the backup on disk is the recovery path. More is only drift (a comment added
        // while we measured) and is not a failure.
        if (back.liveCount != null && back.liveCount < drove.captured.length) {
          console.error(`  !! ${drv.id}: DATA LOSS — captured ${drove.captured.length}, only ${back.liveCount} live after restore.`);
          console.error(`     Recover from ${backupPath} before trusting this app's data again.`);
        } else if (back.liveCount !== drove.captured.length) {
          console.error(`  ! ${drv.id}: ${back.liveCount} live vs ${drove.captured.length} captured (extra items, no loss)`);
        }
      }
      // Conditions were created, so these verdicts are real: an element that still
      // will not lay out is a defect, not an unmeasurable one.
      const byRetryId = new Map(measured.map((m) => [m.id, m]));
      for (let i = 0; i < results.length; i++) {
        const m = byRetryId.get(results[i].id);
        if (m && results[i].status === "blocked") results[i] = { ...m, drivenBy: drv.id };
      }
      const stillBlocked = new Set(measured.filter((m) => m.status === "blocked").map((m) => m.id));
      for (let k = retry.length - 1; k >= 0; k--) if (!stillBlocked.has(retry[k].id)) retry.splice(k, 1);
    }
  }

  const summary = {
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    blocked: results.filter((r) => r.status === "blocked").length,
  };
  if (results.some((r) => !["pass", "fail", "blocked"].includes(r.status))) {
    throw new Error("R-C violation: executor produced a status outside pass|fail|blocked");
  }
  const doc = {
    at: new Date().toISOString(),
    suite: suitePath,
    suiteSources: suite.sources,
    url: page.url(),
    states: stateReport,
    dataStates: driveReport,
    summary,
    results,
  };
  await fs.writeFile(path.join(phaseDir, "compiled-results.json"), JSON.stringify(doc, null, 2) + "\n");
  for (const at of driveReport.attempted) {
    console.log(at.ok
      ? `  ↻ drove ${at.driver}: cleared ${at.cleared}/${at.captured}, restored ${at.restored} (${at.restoreClean ? "clean" : "DRIFT — see " + at.backup})`
      : `  ↻ ${at.driver} unavailable: ${at.reason}`);
  }
  console.log(`compiled-assertions: ${summary.pass} pass · ${summary.fail} fail · ${summary.blocked} blocked → compiled-results.json`);
  for (const r of results.filter((x) => x.status === "fail").slice(0, 40)) {
    console.log(`  ✗ ${r.id} [${r.state}] expected ${JSON.stringify(r.expected)} measured ${JSON.stringify(r.measured)} (${r.designPath})`);
  }
  for (const [s, d] of Object.entries(stateReport)) if (!d.ok) console.log(`  ⛔ state '${s}' blocked: ${d.reason}`);

  if (args.includes("--write")) {
    const fails = results.filter((r) => r.status === "fail");
    const apPath = path.join(phaseDir, "appearance", "flow.json");
    const prev = (await loadJson(apPath)) || { blockId: "flow" };
    const kept = (prev.unresolved || []).filter((u) => u && u.source !== "compiled-assertion");
    const rows = fails.map((r) => ({
      id: r.id,
      // Name the element and the property AT ROW LEVEL. A compiled assertion is not a
      // visual glance: it knows which element, which property, what the design says and
      // what the app rendered. Burying that in `evidence` made downstream classify it
      // "uncertain -> replan" and hand the Builder 50 anonymous "(composed)" tickets.
      selector: r.selector || (r.property || "").replace(/^rect-gap\((.*)→.*$/, "$1") || null,
      element: r.selector || null,
      property: r.property || r.kind,
      spec: r.expected,
      rendered: r.measured,
      assertionKind: r.kind,
      issue: `${r.property} ${JSON.stringify(r.measured)} vs design ${JSON.stringify(r.expected)}±${r.tolerance ?? 0} (${r.expectedSource})`,
      summary: `compiled assertion fail: ${r.id}`,
      kind: r.state === "hover" ? "hover" : "measurement",
      evidence: { expected: r.expected, measured: r.measured, designPath: r.designPath, specNodeId: r.specNodeId, selector: r.selector, state: r.state },
      source: "compiled-assertion",
    }));
    prev.unresolved = [...kept, ...rows];
    prev.disposition = prev.unresolved.length ? "open" : prev.disposition || "open";
    await fs.mkdir(path.dirname(apPath), { recursive: true });
    await fs.writeFile(apPath, JSON.stringify(prev, null, 2) + "\n");
    console.log(`✓ merged ${rows.length} fail(s) into appearance/flow.json (source=compiled-assertion)`);
  }
  process.exit(summary.fail ? 2 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
}

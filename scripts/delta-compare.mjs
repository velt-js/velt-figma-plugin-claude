#!/usr/bin/env node
// delta-compare.mjs — the measurement engine for the Judge. Compares a designSpec's exact
// cssDecls against rendered computed styles, per element, per property, and returns a delta
// table + a STRICT verdict (pass only if every property of every present element passes).
// No aggregate score (Design2Code) — a model can't hide a failure behind an average.
//
// The SAME functions power two consumers, so the logic is written once:
//   * the Judge injects `BROWSER_PROBE` via the Chrome MCP javascript_tool to read live
//     getComputedStyle/getBoundingClientRect and produce the delta table in-page;
//   * golden/ calibration imports compareDecls/verdictOf to prove the engine FAILs a known-bad
//     render and PASSes a known-good one (vs velt-harvey-demo).
//
// Tolerances: lengths ±1px, colour ΔE(CIEDE2000) < 2, keywords exact, font-family by family name.

// ---- colour ----
export function parseColor(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; }
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  return null;
}
function rgbToLab({ r, g, b }) {
  let [R, G, B] = [r, g, b].map((v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; });
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  [x, y, z] = [x, y, z].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function ciede2000(c1, c2) {
  const [L1, a1, b1] = rgbToLab(c1), [L2, a2, b2] = rgbToLab(c2);
  const avgL = (L1 + L2) / 2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2), avgCp = (C1p + C2p) / 2;
  const h = (x, y) => { let d = Math.atan2(y, x) * 180 / Math.PI; return d < 0 ? d + 360 : d; };
  const h1p = h(a1p, b1), h2p = h(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = h2p - h1p; if (Math.abs(dhp) > 180) dhp -= Math.sign(dhp) * 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI / 180) / 2);
  let avghp = (h1p + h2p) / 2; if (Math.abs(h1p - h2p) > 180) avghp += 180;
  const T = 1 - 0.17 * Math.cos((avghp - 30) * Math.PI / 180) + 0.24 * Math.cos((2 * avghp) * Math.PI / 180)
    + 0.32 * Math.cos((3 * avghp + 6) * Math.PI / 180) - 0.2 * Math.cos((4 * avghp - 63) * Math.PI / 180);
  const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const SC = 1 + 0.045 * avgCp, SH = 1 + 0.015 * avgCp * T;
  const dTheta = 30 * Math.exp(-(((avghp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const RT = -RC * Math.sin(2 * dTheta * Math.PI / 180);
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

// ---- per-property comparison ----
const COLOR_PROPS = new Set(["color", "background", "background-color", "border-color", "fill", "stroke", "outline-color"]);
const LEN_PROPS = new Set(["gap", "padding", "margin", "border-radius", "font-size", "line-height", "letter-spacing", "width", "height", "row-gap", "column-gap"]);
const nums = (s) => (String(s).match(/-?\d+(\.\d+)?/g) || []).map(Number);

export function compareProp(prop, expected, rendered, tol = {}) {
  const px = tol.px ?? 1, dE = tol.dE ?? 2;
  if (COLOR_PROPS.has(prop)) {
    const a = parseColor(expected), b = parseColor(rendered);
    if (!a || !b) return { pass: a === b, why: "unparseable colour" };
    if ((a.a === 0) !== (b.a === 0)) return { pass: false, why: "alpha/transparency differs" };
    const d = ciede2000(a, b);
    return { pass: d < dE, delta: `ΔE ${d.toFixed(2)}` };
  }
  if (prop === "border") {
    const ew = nums(expected)[0] ?? 0, rw = nums(rendered)[0] ?? 0;
    const ec = parseColor((expected.match(/#[0-9a-f]+|rgba?\([^)]+\)/i) || [])[0]);
    const rc = parseColor((rendered.match(/#[0-9a-f]+|rgba?\([^)]+\)/i) || [])[0]);
    const wOk = Math.abs(ew - rw) <= px;
    const cOk = ec && rc ? ciede2000(ec, rc) < dE : true;
    return { pass: wOk && cOk, why: wOk ? (cOk ? "" : "border colour") : "border width" };
  }
  if (prop === "font-family") {
    const fam = String(expected).replace(/["']/g, "").split(",")[0].trim().toLowerCase();
    return { pass: String(rendered).toLowerCase().includes(fam), why: "family not in computed stack" };
  }
  if (LEN_PROPS.has(prop)) {
    const e = nums(expected), r = nums(rendered);
    if (e.length !== r.length) {
      // padding "14px 16px" vs computed 4-value — compare the set leniently
      const ok = e.every((v) => r.some((x) => Math.abs(x - v) <= px));
      return { pass: ok, expected, rendered, why: ok ? "" : "length mismatch" };
    }
    const ok = e.every((v, i) => Math.abs(v - r[i]) <= px);
    return { pass: ok, why: ok ? "" : `Δ ${e.map((v, i) => (v - r[i]).toFixed(0)).join(",")}px` };
  }
  // font-weight: 500 vs "500"; flex/keywords: normalize whitespace + trailing units
  const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ").replace(/0px|0%/g, "0");
  if (prop === "flex" || prop === "align-self") {
    return { pass: norm(rendered).startsWith(norm(expected).split(" ").slice(0, 2).join(" ")), expected, rendered };
  }
  return { pass: norm(expected) === norm(rendered), expected, rendered };
}

export function compareDecls(expected, rendered, tol) {
  const rows = [];
  for (const prop of Object.keys(expected)) {
    const r = compareProp(prop, expected[prop], rendered[prop] ?? "", tol);
    rows.push({ property: prop, spec: expected[prop], rendered: rendered[prop] ?? "(missing)", pass: r.pass, note: r.delta || r.why || "" });
  }
  return rows;
}

// verdict over a set of elements: each {name, present, table[]} ; FAIL on any absent/mismatch.
export function verdictOf(elements) {
  const diffs = [];
  for (const el of elements) {
    if (el.present === false) { diffs.push({ element: el.name, property: "(present)", spec: "rendered + supplied content", rendered: "MISSING", note: "mustSupply slot absent / element not found" }); continue; }
    for (const row of el.table || []) if (!row.pass) diffs.push({ element: el.name, ...row });
  }
  return { verdict: diffs.length === 0 ? "PASS" : "FAIL", diffs };
}

// ---- browser probe (built from the SAME functions; injected via Chrome MCP javascript_tool) ----
const READ_PROP = `function readProp(cs, prop){
  const map={background:'backgroundColor','border-radius':'borderRadius','font-family':'fontFamily','font-size':'fontSize','font-weight':'fontWeight','line-height':'lineHeight','letter-spacing':'letterSpacing','flex-direction':'flexDirection','justify-content':'justifyContent','align-items':'alignItems','align-self':'alignSelf'};
  if(prop==='border'){return cs.borderTopWidth+' solid '+cs.borderTopColor;}
  const k=map[prop]||prop; return cs[k] || cs.getPropertyValue(prop);
}`;
export const BROWSER_PROBE = `(function(SPECS){
  ${parseColor.toString()}
  ${rgbToLab.toString()}
  ${ciede2000.toString()}
  ${compareProp.toString()}
  ${compareDecls.toString()}
  ${verdictOf.toString()}
  ${READ_PROP}
  var COLOR_PROPS=${JSON.stringify([...COLOR_PROPS])}; var LEN_PROPS=${JSON.stringify([...LEN_PROPS])};
  COLOR_PROPS=new Set(COLOR_PROPS); LEN_PROPS=new Set(LEN_PROPS);
  var els=[];
  for(var i=0;i<SPECS.length;i++){var s=SPECS[i];var el=document.querySelector(s.selector);
    if(!el||el.getBoundingClientRect().width===0){els.push({name:s.name,present:false});continue;}
    var cs=getComputedStyle(el),rendered={};
    for(var p in s.expected){rendered[p]=readProp(cs,p);}
    els.push({name:s.name,present:true,table:compareDecls(s.expected,rendered)});
  }
  return verdictOf(els);
})`;

// CLI smoke: node delta-compare.mjs <expected.json> <rendered.json>
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs/promises");
  const [eF, rF] = process.argv.slice(2);
  if (eF && rF) {
    const exp = JSON.parse(await fs.readFile(eF, "utf8")), ren = JSON.parse(await fs.readFile(rF, "utf8"));
    const els = exp.map((e, i) => ({ name: e.name, present: ren[i].present !== false, table: compareDecls(e.expected, ren[i].rendered || {}) }));
    console.log(JSON.stringify(verdictOf(els), null, 2));
  } else console.log("usage: delta-compare.mjs <expected.json> <rendered.json>");
}

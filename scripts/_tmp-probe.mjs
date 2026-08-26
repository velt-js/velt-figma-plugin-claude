import path from "node:path";
const candidates = [process.env.PLAYWRIGHT_CORE, "playwright-core", path.join(process.env.HOME || "", ".claude/skills/gstack/node_modules/playwright-core/index.js")].filter(Boolean);
let chromium = null;
for (const c of candidates) { try { const m = await import(c); chromium = (m.default || m).chromium; break; } catch {} }
const ws = process.argv[2], expr = process.argv[3];
const b = await chromium.connectOverCDP(ws, { timeout: 20000 });
let page = null;
for (const c of b.contexts()) for (const p of c.pages()) { if (p.url().includes('localhost:3002')) { page = p; } }
if (!page) { console.error('NO PAGE; urls=' + b.contexts().flatMap(c=>c.pages().map(p=>p.url())).join(' , ')); process.exit(1); }
const out = await page.evaluate(expr);
console.log(JSON.stringify(out, null, 1));
await b.close();

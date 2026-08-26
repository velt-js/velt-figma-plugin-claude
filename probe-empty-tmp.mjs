import { loadChromium } from "./scripts/measure-block.mjs";
const chromium = await loadChromium();
const b = await chromium.connectOverCDP('ws://127.0.0.1:9222/devtools/browser/ea98af99-f6d4-4cb8-a30b-53958abec214');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().startsWith('http://localhost:3002'));
const snap = () => page.evaluate(() => ({
  rows: document.querySelectorAll('.vc-thread-rows velt-comment-sidebar-list-item-v2').length,
  placeholderHidden: document.querySelector('velt-comment-sidebar-empty-placeholder-v2')?.getAttribute('data-velt-hidden'),
  emptyTitleBox: (() => { const e = document.querySelector('.vc-empty-title'); const r = e?.getBoundingClientRect(); return e ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })(),
  listHidden: document.querySelector('velt-comment-sidebar-list-v2')?.getAttribute('data-velt-hidden'),
}));
console.log('BASE            :', JSON.stringify(await snap()));
await page.evaluate(() => window.Velt.getCommentElement().setCommentSidebarFilters({ people: [{ userId: '__velt_customize_no_such_user__' }] }));
await page.waitForTimeout(2500);
console.log('FILTERED(people):', JSON.stringify(await snap()));
await page.evaluate(() => window.Velt.getCommentElement().setCommentSidebarFilters({}));
await page.waitForTimeout(2500);
console.log('RESET           :', JSON.stringify(await snap()));
await b.close();

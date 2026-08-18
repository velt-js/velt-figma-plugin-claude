import { loadChromium, acquireBrowser } from './scripts/measure-block.mjs';
const ws = 'ws://localhost:9223/devtools/browser/a0cae75c-27a0-4b77-a1d1-b085fe71ecd2';
const chromium = await loadChromium();
const b = await acquireBrowser(chromium, ws, { requireConnect: true });
let page=null;
for (const c of b.contexts()) for (const p of c.pages()) { if (/localhost:3001/.test(p.url())) page=p; }
if(!page){ console.log('NO PAGE :3001 →', b.contexts().flatMap(c=>c.pages().map(p=>p.url()))); process.exit(0); }
console.log('URL', page.url());
const out = await page.evaluate(() => {
  const r = {}; const q=(s)=>document.querySelector(s);
  const desc=(el)=> el? {tag:el.tagName.toLowerCase(), cls:el.getAttribute('class'), attrs:[...el.attributes].map(a=>a.name+'='+a.value).join(' ').slice(0,300), cs:(()=>{const c=getComputedStyle(el);return {display:c.display,visibility:c.visibility,position:c.position,opacity:c.opacity,height:c.height,overflow:c.overflow};})(), rect:(()=>{const b=el.getBoundingClientRect();return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)];})()} : null;
  r.menu=desc(q('.vc-sb-status-menu')); r.content=desc(q('velt-comment-sidebar-filter-dropdown-content-v2')); r.container=desc(q('.velt-sidebar-filter-dropdown-container'));
  const init=q('span.s-user-avatar-initial');
  if(init){const c=getComputedStyle(init); r.avatarInitial={text:JSON.stringify(init.textContent),attrs:[...init.attributes].map(a=>a.name+'='+a.value).join(' '),display:c.display,fontSize:c.fontSize,w:c.width,h:c.height,color:c.color,before:getComputedStyle(init,'::before').content};}
  const av=q('div.s-user-avatar-initial-container');
  if(av){const c=getComputedStyle(av); r.avatarBox={display:c.display,bg:c.backgroundColor,radius:c.borderRadius,w:c.width,h:c.height,overflow:c.overflow,align:c.alignItems,justify:c.justifyContent}; r.avatarHTML=av.outerHTML.slice(0,350);}
  r.sheets=[...document.styleSheets].map(s=>{try{return (s.href||'inline')+' rules='+s.cssRules.length}catch(e){return (s.href||'inline')+' [cors]'}}).slice(0,30);
  r.hasVcRule=[...document.styleSheets].some(s=>{try{return [...s.cssRules].some(x=>x.selectorText&&/\.vc-(sb-header|composer|icon)\b/.test(x.selectorText))}catch(e){return false}});
  r.bodyFont=getComputedStyle(document.body).fontFamily;
  const tr=q('velt-comment-dialog-toggle-reply-text-internal'); if(tr) r.toggleReply={text:tr.textContent,display:getComputedStyle(tr).display};
  const res=q('velt-comment-dialog-resolve-button'); if(res) r.resolve={display:getComputedStyle(res).display,rect:res.getBoundingClientRect().width+'x'+res.getBoundingClientRect().height};
  return r;
});
console.log(JSON.stringify(out,null,1));

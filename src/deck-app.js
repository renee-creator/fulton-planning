/* ---------- A module's slide deck, presented in TREE and as a PowerPoint ----------
   One set of slides, made from a PD module and, when it comes from a Presenting entry, from that entry's plan, guiding
   question and chosen photos. Present fills the screen in the browser, with slides that fade, points that appear one at a
   time and photos that ease in. The presenter view, in a second window, carries the speaker notes, the facilitator
   script, the next slide and the time planned for each part. The PowerPoint uses the same designs, with the notes and
   script in each slide's notes, and without the movement. It sits after Presenting in tree-staff.js and shares its
   helpers (November 1, 2026). */
(function(){
"use strict";
const T=window.TreeStaff,X=T._;const Dk={};window.TreeDeck=Dk;
const H=X.H;
const kit=()=>(window.TreeGrowth&&window.TreeGrowth.deckKit)||{};
const C={moss:"#2b5a40",sky:"#245b78",clay:"#984331",mari:"#f2b955",ink:"#1b2920",soft:"#55605a",cream:"#fbf8f1",white:"#ffffff"};
const PARTS=["moss","sky","clay","mari"];
// the parts of our PD template, for a deck made straight from the PD library with no Presenting entry
const PLAN0=[{title:"Opening",minutes:10,do:"Each person shares a personal question or a memory that brings them into the topic."},{title:"Framing",minutes:15,do:""},{title:"Key ideas",minutes:15,do:""},
  {title:"The experience",minutes:45,do:"A tour, a lab or a case study with real documentation of our own."},{title:"Reflection",minutes:20,do:"Notice and Wonder about the experience, then table talk."},{title:"Commitment",minutes:10,do:"Each person names one thing they will try."},{title:"Plus and delta",minutes:5,do:""}];

/* ---------- words ---------- */
const plain=t=>String(t||"").replace(/\*\*/g,"").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/^#+\s*/gm,"").replace(/^\s*([-*]|\d+\.)\s+/gm,"").replace(/[ \t]+/g," ").trim();
const sentences=t=>(String(t||"").replace(/\s+/g," ").match(/[^.!?]+(?:[.!?]+["”’)]?|$)/g)||[]).map(x=>x.trim()).filter(Boolean);
const first=(t,n)=>sentences(plain(t)).slice(0,n||1).join(" ");
const PIC=/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
const paras=t=>String(t||"").split(/\n\s*\n/).map(p=>p.split("\n").filter(l=>!PIC.test(l)).join("\n").trim()).filter(p=>p&&!/^\|/.test(p));
// the parts of one Reading subsection that can stand on a slide. A bold lead, such as **The gate board.**, is a point of its own
function pointsOf(body){const lines=String(body||"").split("\n").filter(l=>!PIC.test(l));const leads=[],items=[];
  for(const l of lines){const b=l.match(/^\s*(?:[-*]\s+)?\*\*([^*]+?)\*\*/);if(b)leads.push(b[1].trim().replace(/[.:]$/,""));else if(/^\s*([-*]|\d+\.)\s+/.test(l))items.push(first(l,1))}
  if(leads.length>=2)return leads.slice(0,5);if(items.length>=2)return items.slice(0,4);const ps=paras(body);return ps.length>=2?ps.slice(0,3).map(p=>first(p,1)):[]}
const subsOf=body=>String(body||"").split(/^###\s+/m).slice(1).map(p=>{const i=p.indexOf("\n");return {h:(i<0?p:p.slice(0,i)).trim(),body:i<0?"":p.slice(i+1).trim()}});
const picsOf=body=>String(body||"").split("\n").map(l=>l.match(PIC)).filter(Boolean).map(g=>({key:"pic:"+g[2],cap:g[1]||""}));

/* ---------- the slides ---------- */
/* Each slide is one of ten designs. title, part (a part opener), idea (a key idea, or a few points that appear one at a
   time), pw (a photo with words), photo, q (the guiding question), talk (turn and talk), reflect, try and plus. */
function slidesFor(m,o){o=o||{};const K=kit();const out=o.outside;
  const mm=K.deckModule?K.deckModule(m,o.depth,out):m;const ow=t=>out&&K.outsideWords?K.outsideWords(t).replace(/\s+from TREE\b/g,""):t;
  const sec=h=>(mm.sections||[]).find(x=>x.heading.toLowerCase().startsWith(h));
  const why=sec("why it matters"),rd=sec("reading"),tr=sec("try this week"),rf=sec("reflect");
  const q=String(o.question||"").trim()||((String(why&&why.body||"").match(/asks one question throughout\.\s*([^\n]+)/i)||[])[1]||"").trim();
  // the photos, in the order chosen. The first is the title slide's. With none chosen, the module's own pictures are used
  const chosen=(o.photos||[]).filter(p=>p&&p.key);const own=(mm.sections||[]).flatMap(x=>picsOf(x.body));
  const plan=((o.plan||[]).length?o.plan:PLAN0).filter(p=>p&&String(p.title||"").trim());
  /* the evidence, the entry's chosen moments, each in the part of the plan it was given to, and the others during the
     experience. A deck for outside audiences carries only the moments the director cleared for them */
  const mom=(o.moments||[]).filter(x=>x&&x.text&&(!out||x.outside));const evKey=x=>x.photo&&x.photo.id?"obs:"+x.photo.id:"";
  const given=new Map();for(const [i,p] of plan.entries())for(const id of p.moments||[]){const x=mom.find(y=>y.id===id);if(x&&!given.has(x.id))given.set(x.id,i)}
  const home=(()=>{const f=re=>plan.findIndex(p=>re.test(String(p.title).toLowerCase()));const a=f(/experience/);return a>=0?a:f(/key/)>=0?f(/key/):Math.max(0,plan.findIndex(p=>!/plus|delta/i.test(p.title)))})();
  const evFor=i=>mom.filter(x=>(given.has(x.id)?given.get(x.id):home)===i).map(x=>{const k=evKey(x);
    const when=x.date?new Date(x.date+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"";
    const meta=[when,x.room?(/,/.test(x.room)?x.room+" classes":x.room+" class"):"",x.language||""].filter(Boolean).join(", ");
    return {k:"ev",quote:ow(plain(x.text)),meta,photo:k?{key:k,thumb:x.photo.thumb||"",cap:meta}:null,notes:[ow(plain(x.text)),x.wonder?"Wondering. "+ow(plain(x.wonder)):"",meta].filter(Boolean).join("\n\n")}});
  // a photo that comes with a moment is shown with its words, so it is not used again elsewhere
  const evKeys=new Set(mom.map(evKey).filter(Boolean));
  const cover=chosen[0]||null;const pool=(chosen.length?chosen.slice(1):own).filter(p=>!evKeys.has(p.key));
  const S=[];const add=(s,part)=>{s.part=part;S.push(s);return s};
  add({k:"title",title:o.title||m.title,sub:o.subtitle||"",photo:cover,notes:o.subtitle||""},-1);
  plan.forEach((p,i)=>{const t=String(p.title).toLowerCase(),min=+p.minutes||0,doT=ow(plain(p.do||""));const at0=S.length;
    add({k:"part",n:i+1,of:plan.length,title:p.title,minutes:min,color:PARTS[i%PARTS.length],notes:[doT,p.script?"Script. "+ow(plain(p.script)):""].filter(Boolean).join("\n\n")},i);
    if(/open/.test(t)){if(q)add({k:"q",text:q,notes:"The question we hold through the whole session."},i);
      add({k:"talk",prompt:doT||"Share a memory or a question that brings you into today's topic.",minutes:min,notes:doT},i)}
    else if(/fram/.test(t)){const ps=paras(why&&why.body).filter(x=>!/^this module is about/i.test(plain(x))).slice(0,2);
      if(!ps.length&&doT)add({k:"idea",label:p.title,phrase:first(doT,2),points:[],notes:doT},i);
      ps.forEach(x=>add({k:"idea",label:"Why it matters",phrase:first(x,1),points:[],notes:plain(x)},i))}
    else if(/key/.test(t)){let alt=0;for(const sb of subsOf(rd&&rd.body)){const pts=pointsOf(sb.body),notes=plain(sb.body.split("\n").filter(l=>!PIC.test(l)).join("\n"));
        if(pool.length&&alt%2===1)add({k:"pw",label:sb.h,points:(pts.length?pts:[first(sb.body,1)]).slice(0,3),photo:pool.shift(),notes},i);
        else add({k:"idea",label:sb.h,phrase:first(sb.body,1),points:pts,notes},i);alt++}
      add({k:"talk",prompt:"Where do you see these ideas in your own class?",minutes:min,notes:doT},i)}
    else if(/experience/.test(t)){add({k:"idea",label:p.title,phrase:first(doT,2)||"Our own documentation, together.",points:[],notes:doT},i);
      while(pool.length){const ph=pool.shift();add({k:"photo",photo:ph,cap:ph.cap||"",notes:ph.cap||""},i)}}
    else if(/reflect/.test(t)){const qs=plain(rf&&rf.body).split("\n").map(x=>x.trim()).filter(Boolean).slice(0,6);const L=qs.length?qs:[doT||"What did you notice, and what do you wonder?"];
      L.forEach((x,j)=>add({k:"reflect",text:x,n:j+1,of:L.length,notes:x},i))}
    else if(/commit/.test(t)){const tt=first(tr&&tr.body,2)||doT||"Name one thing you will try.";add({k:"try",text:tt,notes:plain(tr&&tr.body)||doT},i);if(q)add({k:"q",text:q,notes:"The question again, to carry forward."},i)}
    else if(/plus|delta/.test(t))add({k:"plus",notes:doT||"One plus, what worked, and one delta, what to change next time."},i);
    else add({k:"idea",label:p.title,phrase:first(doT,2)||p.title,points:[],notes:doT},i);
    // the part's evidence comes after the experience's opening words, or before the part's turn and talk, or at its end
    const ev=evFor(i);if(ev.length){const last=S[S.length-1];const at=/experience/.test(t)?Math.min(S.length,at0+2):last&&last.k==="talk"&&last.part===i&&S.length-1>at0?S.length-1:S.length;
      S.splice(at,0,...ev.map(x=>Object.assign(x,{part:i})))}});
  if(!plan.some(p=>/plus|delta/i.test(p.title)))add({k:"plus",notes:"One plus, what worked, and one delta, what to change next time."},plan.length-1);
  return {slides:S,plan,credit:out?"Fulton Community School & Farm":"Fulton Community School",title:o.title||m.title}}
Dk.slidesFor=slidesFor;
// for the tests, which draw each design on its own
Dk._draw=(s,d)=>slideHtml(s,d);Dk._css=()=>CSS;

/* ---------- photos ---------- */
// each photo is read once, made no larger than 1920 pixels wide and kept as a picture the page and the PowerPoint can use
const PH=new Map();
async function blobOf(key){if(key.startsWith("pic:"))return await (await fetch(await X.picData(key.slice(4)).then(d=>d.url))).blob();
  const id=key.slice(4);if(!window.FP_ORIGINAL_URL)throw new Error("Photos are not open here.");const f=typeof fetchPhoto==="function"?fetchPhoto:fetch;const r=await f(window.FP_ORIGINAL_URL(id));if(!r.ok)throw new Error("The photo could not be read.");return await r.blob()}
function photo(key){if(!PH.has(key))PH.set(key,(async()=>{const b=await blobOf(key);const u=URL.createObjectURL(b);
  try{const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});const sc=Math.min(1,1920/Math.max(1,im.naturalWidth));
    const cv=document.createElement("canvas");cv.width=Math.round(im.naturalWidth*sc);cv.height=Math.round(im.naturalHeight*sc);const g=cv.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,cv.width,cv.height);g.drawImage(im,0,0,cv.width,cv.height);
    return {url:cv.toDataURL("image/jpeg",0.86),w:cv.width,h:cv.height}}finally{URL.revokeObjectURL(u)}})().catch(e=>{PH.delete(key);throw e}));return PH.get(key)}
// a photo cut to the shape of its place on the slide, for the PowerPoint, which has no way to fill a box by itself
async function cropTo(p,ratio){const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=p.url});let w=im.naturalWidth,h=im.naturalHeight,sx=0,sy=0;
  if(w/h>ratio){const nw=h*ratio;sx=(w-nw)/2;w=nw}else{const nh=w/ratio;sy=(h-nh)/2;h=nh}
  const cv=document.createElement("canvas");cv.width=Math.round(w);cv.height=Math.round(h);cv.getContext("2d").drawImage(im,sx,sy,w,h,0,0,cv.width,cv.height);return cv.toDataURL("image/jpeg",0.86)}
async function loadPhotos(d){const keys=[...new Set(d.slides.map(s=>s.photo&&s.photo.key).filter(Boolean))];const got={};
  await Promise.all(keys.map(async k=>{try{got[k]=await photo(k)}catch(e){}}));
  // a photo that cannot be read leaves its slide as words, or out when it was only a photo
  d.slides=d.slides.filter(s=>{if(!s.photo)return true;if(got[s.photo.key]){s.pic=got[s.photo.key];return true}if(s.k==="photo")return false;if(s.k==="pw"){s.k="idea";s.phrase=s.points[0]||"";s.points=s.points.length>1?s.points:[]}s.photo=null;return true});return d}

/* ---------- drawing a slide ---------- */
const size=(t,big)=>{const n=String(t||"").length;return big?(n<50?84:n<90?72:n<140?62:n<200?54:46):(n<60?72:n<110?62:n<170?54:n<240?48:42)};
const ptSize=L=>{const n=L.join(" ").length;return n<120?50:n<200?44:n<300?40:36};
function slideHtml(s,d){const cr=`<div class="dk-credit">${H(d.credit)}</div>`;const B=(i,html)=>`<div class="dk-b" data-b="${i}">${html}</div>`;
  const img=(p,cls)=>p?`<img class="dk-img ${cls||""}" src="${p.url}" alt="">`:"";
  switch(s.k){
    case"title":return s.pic?`<div class="dk-s dk-title has">${img(s.pic,"dk-ease")}<div class="dk-band"><div class="dk-t1">${H(s.title)}</div>${s.sub?`<div class="dk-t2">${H(s.sub)}</div>`:""}<div class="dk-t3">${H(d.credit)}</div></div></div>`
      :`<div class="dk-s dk-title" style="background:${C.moss}"><div class="dk-mid"><div class="dk-t1">${H(s.title)}</div>${s.sub?`<div class="dk-t2">${H(s.sub)}</div>`:""}<div class="dk-rule light"></div><div class="dk-t3">${H(d.credit)}</div></div></div>`;
    case"part":return `<div class="dk-s dk-part ${s.color==="mari"?"inkon":""}" style="background:${C[s.color]}"><div class="dk-kick">Part ${s.n} of ${s.of}</div><div class="dk-ptitle" style="font-size:${s.title.length<16?132:s.title.length<28?110:88}px">${H(s.title)}</div>${s.minutes?`<div class="dk-pmin">About ${s.minutes} minutes</div>`:""}${cr}</div>`;
    case"idea":return s.points.length?`<div class="dk-s dk-idea"><div class="dk-label">${H(s.label)}</div><div class="dk-pts" style="font-size:${ptSize(s.points)}px">${s.points.map((p,i)=>B(i,`<span class="dk-bar"></span>${H(p)}`)).join("")}</div>${cr}</div>`
      :`<div class="dk-s dk-idea"><div class="dk-label">${H(s.label)}</div><div class="dk-phrase" style="font-size:${size(s.phrase)}px">${H(s.phrase)}</div>${cr}</div>`;
    case"pw":return `<div class="dk-s dk-pw"><div class="dk-half">${img(s.pic,"dk-ease")}</div><div class="dk-side"><div class="dk-label">${H(s.label)}</div><div class="dk-pts" style="font-size:${Math.min(42,ptSize(s.points))}px">${s.points.map((p,i)=>B(i,`<span class="dk-bar"></span>${H(p)}`)).join("")}</div></div>${cr}</div>`;
    case"ev":return s.pic?`<div class="dk-s dk-pw dk-ev"><div class="dk-half">${img(s.pic,"dk-ease")}</div><div class="dk-side"><div class="dk-label">From our documentation</div><div class="dk-evq" style="font-size:${Math.min(40,size(s.quote))}px">${H(clipQ(s.quote))}</div><div class="dk-evm">${H(s.meta)}</div></div>${cr}</div>`
      :`<div class="dk-s dk-ev"><div class="dk-label">From our documentation</div><div class="dk-qm">“</div><div class="dk-evq" style="font-size:${size(s.quote)}px">${H(clipQ(s.quote))}</div><div class="dk-evm">${H(s.meta)}</div>${cr}</div>`;
    case"photo":return `<div class="dk-s dk-photo">${img(s.pic,"dk-ease")}${s.cap?`<div class="dk-cap">${H(s.cap)}</div>`:""}</div>`;
    case"q":return `<div class="dk-s dk-q"><div class="dk-qm">“</div><div class="dk-qt" style="font-size:${size(s.text,true)}px">${H(s.text)}</div>${cr}</div>`;
    case"talk":return `<div class="dk-s dk-talk" style="background:${C.mari}"><div class="dk-kick">Turn and talk</div><div class="dk-phrase" style="font-size:${size(s.prompt)}px">${H(s.prompt)}</div>${s.minutes?`<div class="dk-pmin">About ${s.minutes} minutes</div>`:""}${cr}</div>`;
    case"reflect":return `<div class="dk-s dk-reflect" style="background:${C.sky}"><div class="dk-kick">Reflect${s.of>1?`, ${s.n} of ${s.of}`:""}</div><div class="dk-phrase" style="font-size:${size(s.text)}px">${H(s.text)}</div>${cr}</div>`;
    case"try":return `<div class="dk-s dk-try" style="background:${C.moss}"><div class="dk-kick">Try this week</div><div class="dk-phrase" style="font-size:${size(s.text)}px">${H(s.text)}</div>${cr}</div>`;
    case"plus":return `<div class="dk-s dk-plus"><div class="dk-label">Plus and delta</div><div class="dk-cols">${B(0,`<div class="dk-col"><div class="dk-ch" style="color:${C.moss}">Plus</div><div class="dk-cq">What went well today?</div></div>`)}${B(1,`<div class="dk-col"><div class="dk-ch" style="color:${C.clay}">Delta</div><div class="dk-cq">What would we change?</div></div>`)}</div>${cr}</div>`}
  return `<div class="dk-s"></div>`}
// a long observation shows its opening on the slide, and the whole of it in the notes
const clipQ=t=>{t=String(t||"");if(t.length<=320)return t;const c=t.slice(0,320).replace(/\s+\S*$/,"");return c+"…"};
const builds=s=>s.k==="plus"?2:(s.k==="idea"||s.k==="pw")?(s.points||[]).length:0;

const CSS=`.dk-ov{position:fixed;inset:0;background:#0d120f;z-index:2147483000;overflow:hidden;cursor:default;user-select:none;-webkit-user-select:none}
.dk-ov.idle{cursor:none}.dk-stage{position:absolute;left:50%;top:50%;width:1600px;height:900px;transform-origin:0 0}
.dk-slot{position:absolute;inset:0;opacity:0;transition:opacity .7s ease}.dk-slot.on{opacity:1}
.dk-s{position:absolute;inset:0;overflow:hidden;background:${C.cream};color:${C.ink};font-family:Georgia,"Times New Roman",serif;box-sizing:border-box}
.dk-s *{box-sizing:border-box}.dk-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dk-slot.on .dk-ease{animation:dkEase 9s ease-out both}@keyframes dkEase{from{opacity:0;transform:scale(1.07)}12%{opacity:1}to{opacity:1;transform:scale(1)}}
.dk-credit{position:absolute;left:0;right:0;bottom:30px;text-align:center;font-size:20px;letter-spacing:.06em;color:${C.soft};opacity:.85}
.dk-part .dk-credit,.dk-try .dk-credit,.dk-reflect .dk-credit{color:#fff;opacity:.7}.dk-talk .dk-credit,.dk-part.inkon .dk-credit{color:${C.ink};opacity:.65}
.dk-title.has .dk-band{position:absolute;left:0;right:0;bottom:0;padding:180px 110px 70px;background:linear-gradient(to bottom,rgba(10,16,12,0),rgba(10,16,12,.78))}
.dk-t1{font-size:88px;font-weight:bold;line-height:1.05;color:#fff}.dk-t2{font-size:34px;color:#fff;opacity:.92;margin-top:18px;font-style:italic}.dk-t3{font-size:24px;color:#fff;opacity:.85;margin-top:26px;letter-spacing:.08em}
.dk-mid{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 140px}
.dk-rule{width:120px;height:4px;background:${C.mari};margin:34px auto 0}.dk-rule.light{background:${C.mari}}
.dk-part,.dk-talk,.dk-reflect,.dk-try{display:flex;flex-direction:column;justify-content:center;padding:0 150px;color:#fff}
.dk-talk,.dk-part.inkon{color:${C.ink}}
.dk-kick{font-size:30px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:36px;opacity:.9}
.dk-ptitle{font-weight:bold;line-height:1.02}.dk-pmin{font-size:32px;margin-top:40px;opacity:.85}
.dk-idea{padding:120px 150px 110px;display:flex;flex-direction:column}
.dk-label{font-size:28px;letter-spacing:.14em;text-transform:uppercase;color:${C.moss};padding-bottom:22px;border-bottom:4px solid ${C.mari};align-self:flex-start;margin-bottom:56px}
.dk-phrase{line-height:1.22;max-width:1300px}.dk-idea .dk-phrase{margin-top:auto;margin-bottom:auto}
.dk-pts{display:grid;gap:34px;line-height:1.2;align-content:center;flex:1}.dk-pts .dk-b{display:flex;gap:28px;align-items:baseline}
.dk-bar{flex:0 0 14px;height:14px;border-radius:50%;background:${C.clay};transform:translateY(-6px)}
.dk-b{opacity:0;transform:translateY(18px);transition:opacity .55s ease,transform .55s ease}.dk-b.in{opacity:1;transform:none}
.dk-pw .dk-half{position:absolute;left:0;top:0;bottom:0;width:50%;overflow:hidden}
.dk-pw .dk-side{position:absolute;left:50%;right:0;top:0;bottom:0;padding:110px 90px 100px;display:flex;flex-direction:column}
.dk-pw .dk-credit{left:50%}.dk-ev:not(.dk-pw){padding:110px 150px 110px;display:flex;flex-direction:column;background:#fff}.dk-ev .dk-qm{height:110px}.dk-evq{font-style:italic;line-height:1.3;flex:0 1 auto}.dk-pw .dk-evq{margin-top:auto}.dk-evm{font-size:26px;color:${C.soft};margin-top:30px;letter-spacing:.03em}.dk-pw .dk-evm{margin-bottom:auto}.dk-photo{background:#000}.dk-cap{position:absolute;left:0;right:0;bottom:0;padding:22px 90px;background:rgba(10,16,12,.72);color:#fff;font-size:28px;line-height:1.3}
.dk-q{display:flex;flex-direction:column;justify-content:center;padding:0 170px;background:#fff}.dk-qm{font-size:260px;line-height:.6;color:${C.clay};height:120px}.dk-qt{font-style:italic;line-height:1.2}
.dk-plus{padding:120px 150px;display:flex;flex-direction:column;background:#fff}.dk-cols{display:grid;grid-template-columns:1fr 1fr;gap:90px;flex:1;align-items:center}
.dk-ch{font-size:84px;font-weight:bold}.dk-cq{font-size:48px;margin-top:20px;line-height:1.2}
.dk-bar0{display:none}
.dk-tools{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:rgba(20,28,23,.88);color:#fff;border-radius:999px;padding:6px 10px;font:15px system-ui,sans-serif;transition:opacity .4s}
.dk-ov.idle .dk-tools{opacity:0;pointer-events:none}.dk-tools button{background:none;border:0;color:#fff;font:inherit;padding:8px 12px;border-radius:999px;cursor:pointer}.dk-tools button:hover{background:rgba(255,255,255,.14)}
.dk-tools .dk-n{opacity:.8;padding:0 6px;min-width:64px;text-align:center}`;
const css=()=>{if(document.getElementById("dk-css"))return;const s=document.createElement("style");s.id="dk-css";s.textContent=CSS;document.head.appendChild(s)};

/* ---------- presenting ---------- */
let P=null;
async function deckFrom(o){const K=kit();if(!K.loadMods)throw new Error("Open the PD library once, then try again.");const ms=await K.loadMods();const m=ms.modules[o.slug];if(!m)throw new Error("That module is not in the PD library yet.");
  const e=o.entry||null;const outside=e?(e.audienceType==="external"||e.audienceType==="both"):!!o.outside;
  const d=slidesFor(m,{depth:o.depth,outside,plan:e&&e.plan,question:e&&e.question,photos:e&&e.deck&&e.deck.photos,moments:e&&e.chosen,title:e&&e.title||m.title,subtitle:e&&e.subtitle||""});
  d.outside=outside;d.depth=!!o.depth;await loadPhotos(d);return d}
Dk.present=async function(o){if(typeof progress==="function")progress("Opening the presentation");let d;try{d=await deckFrom(o)}catch(er){if(typeof toast==="function")toast(er.message||"The presentation could not open.");return}
  if(typeof toast==="function")toast("Click or press the arrow keys to move. Full screen and the presenter view are in the bar at the bottom.");css();
  const ov=document.createElement("div");ov.className="dk-ov";ov.innerHTML=`<div class="dk-stage"></div><div class="dk-tools"><button data-dk="back" aria-label="Back">‹ Back</button><span class="dk-n"></span><button data-dk="next" aria-label="Next">Next ›</button><button data-dk="notes">Presenter view</button><button data-dk="full">Full screen</button><button data-dk="exit">Exit</button></div>`;
  document.body.appendChild(ov);const stage=ov.querySelector(".dk-stage");
  P={d,ov,stage,i:0,b:0,start:Date.now(),partStart:{},win:null};
  const fit=()=>{const sc=Math.min(innerWidth/1600,innerHeight/900);stage.style.transform=`translate(${-800*sc}px,${-450*sc}px) scale(${sc})`};
  fit();P.fit=fit;addEventListener("resize",fit);
  let idle;const wake=()=>{ov.classList.remove("idle");clearTimeout(idle);idle=setTimeout(()=>ov.classList.add("idle"),2500)};ov.addEventListener("mousemove",wake);wake();
  ov.addEventListener("click",ev=>{const b=ev.target.closest("[data-dk]");if(b){ev.stopPropagation();const a=b.dataset.dk;if(a==="back")go(-1);else if(a==="next")go(1);else if(a==="notes")openNotes();else if(a==="full")full();else if(a==="exit")close();return}
    go(ev.clientX<innerWidth/3?-1:1)});
  addEventListener("keydown",keys,true);
  try{if(ov.requestFullscreen)ov.requestFullscreen().catch(()=>{})}catch(er){}
  show(0,0,true)};
function full(){try{if(document.fullscreenElement)document.exitFullscreen();else if(P&&P.ov.requestFullscreen)P.ov.requestFullscreen()}catch(er){}}
function keys(ev){if(!P)return;const k=ev.key;if(/^(ArrowRight|ArrowDown|PageDown| |Enter|n)$/.test(k)){ev.preventDefault();go(1)}else if(/^(ArrowLeft|ArrowUp|PageUp|Backspace|p)$/.test(k)){ev.preventDefault();go(-1)}
  else if(k==="Escape"){ev.preventDefault();if(!document.fullscreenElement)close()}else if(k==="Home"){ev.preventDefault();show(0,0)}else if(k==="End"){ev.preventDefault();show(P.d.slides.length-1,99)}}
function go(dir){if(!P)return;const s=P.d.slides[P.i],n=builds(s);
  if(dir>0){if(P.b<n){P.b++;reveal();sync();return}if(P.i<P.d.slides.length-1)show(P.i+1,0)}
  else{if(P.b>0&&n){P.b--;reveal();sync();return}if(P.i>0)show(P.i-1,99)}}
function reveal(){const cur=P.stage.querySelector(".dk-slot.on");if(cur)cur.querySelectorAll(".dk-b").forEach(x=>x.classList.toggle("in",+x.dataset.b<P.b))}
function show(i,b,firstTime){const s=P.d.slides[i];P.i=i;P.b=Math.min(b,builds(s));if(!(s.part in P.partStart))P.partStart[s.part]=Date.now();
  const old=[...P.stage.querySelectorAll(".dk-slot")];const slot=document.createElement("div");slot.className="dk-slot";slot.innerHTML=slideHtml(s,P.d);P.stage.appendChild(slot);
  // the new slide fades in over the one before, which leaves once it is covered
  requestAnimationFrame(()=>requestAnimationFrame(()=>{slot.classList.add("on");reveal()}));setTimeout(()=>old.forEach(x=>x.remove()),firstTime?0:800);
  P.ov.querySelector(".dk-n").textContent=(i+1)+" of "+P.d.slides.length;
  // the next slide's photo is read ahead, so it is ready
  sync()}
function close(){if(!P)return;removeEventListener("keydown",keys,true);removeEventListener("resize",P.fit);try{if(document.fullscreenElement)document.exitFullscreen()}catch(er){}
  try{if(P.win&&!P.win.closed)P.win.close()}catch(er){}clearInterval(P.tick);P.ov.remove();P=null}
Dk.close=close;

/* ---------- the presenter view ---------- */
const mins=ms=>{const s=Math.max(0,Math.floor(ms/1000));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
function openNotes(){if(!P)return;if(P.win&&!P.win.closed){P.win.focus();return}
  const w=window.open("","tree-presenter","width=1180,height=760");if(!w){if(typeof toast==="function")toast("Allow pop-ups for TREE to open the presenter view.");return}P.win=w;
  w.document.open();w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Presenter view, ${H(P.d.title)}</title><style>${CSS}
  body{margin:0;background:#141b17;color:#eef2ee;font:16px system-ui,sans-serif}.pv{display:grid;grid-template-columns:1.25fr 1fr;grid-template-rows:auto 1fr;gap:16px;padding:16px;height:100vh;box-sizing:border-box}
  .pvbox{position:relative;background:#000;border-radius:8px;overflow:hidden}.pvbox .dk-stage{left:0;top:0}.pvbox .dk-b{opacity:1;transform:none}.pvbox .dk-ease{animation:none!important}
  .pvside{display:flex;flex-direction:column;gap:12px;min-height:0}.pvlbl{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.65;margin-bottom:6px}
  .pvnotes{grid-column:1/3;display:grid;grid-template-columns:1fr 1fr;gap:16px;min-height:0}.pvtext{background:#1d2620;border-radius:8px;padding:14px 16px;overflow:auto;white-space:pre-line;font-size:19px;line-height:1.45}
  .pvbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.pvbar button{background:#2b5a40;color:#fff;border:0;border-radius:8px;padding:10px 16px;font:inherit;cursor:pointer}.pvbar .gh{background:#2a332d}
  .pvclock{font-size:30px;font-variant-numeric:tabular-nums}.pvpart{font-size:16px;opacity:.85}.late{color:#f2b955}</style></head><body><div class="pv">
  <div><div class="pvlbl">Now</div><div class="pvbox" id="pvnow"></div></div>
  <div class="pvside"><div><div class="pvlbl">Next</div><div class="pvbox" id="pvnext"></div></div>
    <div class="pvbar"><button class="gh" data-pv="back">‹ Back</button><button data-pv="next">Next ›</button><span id="pvn"></span></div>
    <div><div class="pvclock" id="pvclock"></div><div class="pvpart" id="pvpart"></div></div></div>
  <div class="pvnotes"><div class="pvtext"><div class="pvlbl">Speaker notes</div><div id="pvsn"></div></div><div class="pvtext"><div class="pvlbl">This part, what participants do and the script</div><div id="pvsc"></div></div></div></div></body></html>`);w.document.close();
  w.addEventListener("click",ev=>{const b=ev.target.closest("[data-pv]");if(!b)return;go(b.dataset.pv==="next"?1:-1)});
  w.addEventListener("keydown",ev=>{keys(ev)});
  clearInterval(P.tick);P.tick=setInterval(clock,1000);sync()}
function box(w,el,s){if(!el)return;const W=el.clientWidth||400;el.style.height=Math.round(W*9/16)+"px";el.innerHTML=s?`<div class="dk-stage" style="transform:scale(${W/1600})"><div class="dk-slot on">${slideHtml(s,P.d)}</div></div>`:`<div style="padding:20px;opacity:.6">The end of the deck</div>`}
function sync(){if(!P||!P.win||P.win.closed)return;const w=P.win,doc=w.document,s=P.d.slides[P.i];const g=id=>doc.getElementById(id);
  box(w,g("pvnow"),s);box(w,g("pvnext"),P.d.slides[P.i+1]);const n=builds(s);
  g("pvn").textContent=`Slide ${P.i+1} of ${P.d.slides.length}${n?`, ${P.b} of ${n} points showing`:""}`;
  g("pvsn").textContent=s.notes||"";const part=P.d.plan[s.part];g("pvsc").textContent=part?[part.title+(part.minutes?", about "+part.minutes+" minutes":""),plain(part.do||""),part.script?"Script. "+plain(part.script):""].filter(Boolean).join("\n\n"):"";clock()}
function clock(){if(!P||!P.win||P.win.closed)return;const doc=P.win.document,s=P.d.slides[P.i],part=P.d.plan[s.part];const el=doc.getElementById("pvclock"),pp=doc.getElementById("pvpart");if(!el)return;
  el.textContent=mins(Date.now()-P.start);if(part){const used=Date.now()-(P.partStart[s.part]||Date.now());pp.textContent=`${part.title}, ${mins(used)} of about ${part.minutes||0} minutes`;pp.classList.toggle("late",!!part.minutes&&used>part.minutes*60000)}else pp.textContent=""}

/* ---------- the PowerPoint ---------- */
const IN=px=>px/120,PT=px=>Math.round(px*0.6);
Dk.pptx=async function(m,o){o=o||{};const K=kit();const e=o.entry||null;const outside=e?(e.audienceType==="external"||e.audienceType==="both"):!!o.outside;
  const d=slidesFor(m,{depth:o.depth,outside,plan:e&&e.plan,question:e&&e.question,photos:e&&e.deck&&e.deck.photos,moments:e&&e.chosen,title:e&&e.title||m.title,subtitle:e&&e.subtitle||""});if(o._kinds)d.slides=d.slides.filter(s=>o._kinds.includes(s.k));await loadPhotos(d);
  const Pp=await K.loadPptx();const pres=new Pp();pres.layout="LAYOUT_WIDE";// the PowerPoint maker writes these two into the file as they are, so an ampersand is written the way the file needs
  const xml=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");pres.title=xml(d.title);pres.company=xml("Fulton Community School & Farm");
  const hex=c=>c.replace("#","");const F="Georgia";
  for(const s of d.slides){const sd=pres.addSlide();const part=d.plan[s.part];
    const notes=String(s.notes||"");if(notes)sd.addNotes(notes);
    const credit=(color,half)=>sd.addText(d.credit,{x:half?6.665:0,y:IN(840),w:half?6.665:13.33,h:0.35,fontFace:F,fontSize:11,color:color||hex(C.soft),align:"center"});
    const bg=c=>{sd.background={color:hex(c)}};
    const pic=async(p,x,y,w,h)=>{if(!p)return;sd.addImage({data:await cropTo(p,w/h),x,y,w,h})};
    const label=(t,x,y,w)=>{sd.addText(String(t).toUpperCase(),{x,y,w,h:0.45,fontFace:F,fontSize:15,color:hex(C.moss),charSpacing:3});sd.addShape(pres.ShapeType.rect,{x,y:y+0.5,w:Math.min(w,Math.max(1.2,String(t).length*0.13)),h:0.04,fill:{color:hex(C.mari)},line:{color:hex(C.mari)}})};
    const bullets=(L,x,y,w,h,sz,color)=>sd.addText(L.map(t=>({text:t,options:{bullet:{code:"25CF",indent:24},paraSpaceAfter:18,color:color||hex(C.ink)}})),{x,y,w,h,fontFace:F,fontSize:sz,valign:"middle"});
    if(s.k==="title"){if(s.pic){await pic(s.pic,0,0,13.33,7.5);sd.addShape(pres.ShapeType.rect,{x:0,y:4.3,w:13.33,h:3.2,fill:{color:"0A100C",transparency:30},line:{color:"0A100C",transparency:100}});
        sd.addText(s.title,{x:0.9,y:4.5,w:11.5,h:1.4,fontFace:F,fontSize:48,bold:true,color:"FFFFFF",valign:"bottom"});if(s.sub)sd.addText(s.sub,{x:0.9,y:5.95,w:11.5,h:0.6,fontFace:F,fontSize:20,italic:true,color:"FFFFFF"});
        sd.addText(d.credit,{x:0.9,y:6.6,w:11.5,h:0.4,fontFace:F,fontSize:14,color:"FFFFFF",charSpacing:2})}
      else{bg(C.moss);sd.addText(s.title,{x:1,y:2,w:11.33,h:1.8,fontFace:F,fontSize:50,bold:true,color:"FFFFFF",align:"center",valign:"middle"});if(s.sub)sd.addText(s.sub,{x:1,y:3.8,w:11.33,h:0.7,fontFace:F,fontSize:22,italic:true,color:"FFFFFF",align:"center"});
        sd.addShape(pres.ShapeType.rect,{x:6.17,y:4.75,w:1,h:0.05,fill:{color:hex(C.mari)},line:{color:hex(C.mari)}});sd.addText(d.credit,{x:1,y:5.1,w:11.33,h:0.5,fontFace:F,fontSize:15,color:"FFFFFF",align:"center",charSpacing:2})}}
    else if(s.k==="part"){const ink=s.color==="mari";const fg=ink?hex(C.ink):"FFFFFF";bg(C[s.color]);
      sd.addText(`PART ${s.n} OF ${s.of}`,{x:1.25,y:1.9,w:10.8,h:0.5,fontFace:F,fontSize:18,color:fg,charSpacing:5});sd.addText(s.title,{x:1.25,y:2.5,w:10.8,h:2,fontFace:F,fontSize:s.title.length<16?72:s.title.length<28?60:48,bold:true,color:fg,valign:"top"});
      if(s.minutes)sd.addText(`About ${s.minutes} minutes`,{x:1.25,y:4.7,w:10.8,h:0.6,fontFace:F,fontSize:20,color:fg});credit(fg)}
    else if(s.k==="idea"){bg(C.cream);label(s.label,1.25,0.95,10.8);
      if(s.points.length)bullets(s.points,1.25,1.8,10.8,4.9,PT(ptSize(s.points)));else sd.addText(s.phrase,{x:1.25,y:1.8,w:10.8,h:4.9,fontFace:F,fontSize:PT(size(s.phrase)),color:hex(C.ink),valign:"middle"});credit()}
    else if(s.k==="pw"){bg(C.cream);await pic(s.pic,0,0,6.665,7.5);label(s.label,7.4,0.9,5.3);bullets(s.points,7.4,1.7,5.3,5,PT(Math.min(42,ptSize(s.points))));credit(null,true)}
    else if(s.k==="ev"){bg(s.pic?C.cream:C.white);const qt=clipQ(s.quote);
      if(s.pic){await pic(s.pic,0,0,6.665,7.5);label("From our documentation",7.4,0.9,5.3);sd.addText(qt,{x:7.4,y:1.7,w:5.3,h:4.2,fontFace:F,fontSize:PT(Math.min(40,size(s.quote))),italic:true,color:hex(C.ink),valign:"middle"});
        sd.addText(s.meta,{x:7.4,y:6,w:5.3,h:0.5,fontFace:F,fontSize:14,color:hex(C.soft)});credit(null,true)}
      else{label("From our documentation",1.25,0.95,10.8);sd.addText("“",{x:1.2,y:1.7,w:1.5,h:1.1,fontFace:F,fontSize:110,color:hex(C.clay)});sd.addText(qt,{x:1.25,y:2.5,w:10.8,h:3.3,fontFace:F,fontSize:PT(size(s.quote)),italic:true,color:hex(C.ink),valign:"top"});
        sd.addText(s.meta,{x:1.25,y:6,w:10.8,h:0.5,fontFace:F,fontSize:15,color:hex(C.soft)});credit()}}
    else if(s.k==="photo"){bg("#000000");await pic(s.pic,0,0,13.33,7.5);if(s.cap){sd.addShape(pres.ShapeType.rect,{x:0,y:6.75,w:13.33,h:0.75,fill:{color:"0A100C",transparency:25},line:{color:"0A100C",transparency:100}});sd.addText(s.cap,{x:0.75,y:6.75,w:11.8,h:0.75,fontFace:F,fontSize:16,color:"FFFFFF",valign:"middle"})}}
    else if(s.k==="q"){bg(C.white);sd.addText("“",{x:1.3,y:0.9,w:2,h:1.6,fontFace:F,fontSize:150,color:hex(C.clay)});sd.addText(s.text,{x:1.4,y:2.2,w:10.5,h:3.8,fontFace:F,fontSize:PT(size(s.text,true)),italic:true,color:hex(C.ink),valign:"top"});credit()}
    else if(s.k==="talk"||s.k==="reflect"||s.k==="try"){const c=s.k==="talk"?C.mari:s.k==="reflect"?C.sky:C.moss,fg=s.k==="talk"?hex(C.ink):"FFFFFF";bg(c);
      const kick=s.k==="talk"?"TURN AND TALK":s.k==="try"?"TRY THIS WEEK":"REFLECT"+(s.of>1?`, ${s.n} OF ${s.of}`:"");sd.addText(kick,{x:1.25,y:1.5,w:10.8,h:0.5,fontFace:F,fontSize:18,color:fg,charSpacing:5});
      const t=s.k==="talk"?s.prompt:s.text;sd.addText(t,{x:1.25,y:2.15,w:10.8,h:3.6,fontFace:F,fontSize:PT(size(t)),color:fg,valign:"top"});if(s.k==="talk"&&s.minutes)sd.addText(`About ${s.minutes} minutes`,{x:1.25,y:5.9,w:10.8,h:0.5,fontFace:F,fontSize:18,color:fg});credit(fg)}
    else if(s.k==="plus"){bg(C.white);label("Plus and delta",1.25,0.95,10.8);sd.addText([{text:"Plus",options:{fontSize:48,bold:true,color:hex(C.moss),breakLine:true}},{text:"What went well today?",options:{fontSize:28,color:hex(C.ink)}}],{x:1.25,y:2.3,w:5.2,h:3,fontFace:F,valign:"top"});
      sd.addText([{text:"Delta",options:{fontSize:48,bold:true,color:hex(C.clay),breakLine:true}},{text:"What would we change?",options:{fontSize:28,color:hex(C.ink)}}],{x:6.9,y:2.3,w:5.2,h:3,fontFace:F,valign:"top"});credit()}}
  const name=String(d.title+(o.depth?", in depth":"")+(outside?", outside audiences":"")).replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim();
  await pres.writeFile({fileName:name+".pptx"})};

/* ---------- the entry's photos ---------- */
// the photos a deck can use, from the module itself, the entry's chosen moments and any observation with a photo
Dk.moduleSources=async function(slug){const K=kit();try{const ms=await K.loadMods();const m=ms.modules[slug];if(!m)return [];const all=[...(m.sections||[]),...((m.depth||{}).sections||[])];const seen=new Set();
  return all.flatMap(x=>picsOf(x.body)).filter(p=>!seen.has(p.key)&&seen.add(p.key))}catch(e){return []}};
Dk.thumb=async function(p){if(p.key.startsWith("obs:"))return window.FP_ORIGINAL_URL?window.FP_ORIGINAL_URL(p.thumb||p.key.slice(4)):"";try{return (await photo(p.key)).url}catch(e){return ""}};
})();

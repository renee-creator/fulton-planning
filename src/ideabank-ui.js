/* ---------- The Idea bank ----------
   Plans, then Planning resources, then Idea bank. Invitations and provocations for every material, space, interest and
   season, and ideas ready for a hard day, read from the private records through the signed-in server (ideabank.js).
   How We Offer Ideas and What are you seeing? open first. Cards are browsed by group, searched and filtered by what
   they feed, what they support and their setting. A card shows its educator side or its At home side with one control,
   prints one card to a page through the one print kit, attaches to a plan, and offers possibilities to a team inquiry.
   The director edits, adds, removes and highlights cards, decides educators' suggestions and shares a card's home side.
   This file is set into src/app.html where it is marked, by tools/build.py. */
let ib=null,ibBusy=null;
const ibSt=Object.assign({group:"Paint",q:"",needs:[],sups:[],levels:[],sel:"",side:"edu",mode:"card",bq:"",bsel:"",fromPlan:"",newOpen:false,addOpen:false,sugOpen:""},LS.get("tree.ib",{})||{},{fromPlan:"",mode:"card",newOpen:false,addOpen:false,sugOpen:""});
const ibPick=new Set();
const ibKeep=()=>LS.set("tree.ib",{group:ibSt.group,side:ibSt.side,sel:ibSt.sel});
const IB_NAV=[["Materials",["Paint","Drawing","Color and print","Shaping","Building","Paper and joining","Textiles","Elements and mixing","Light and looking","Sound and movement","Story and play","Living things"]],["Bodies",["Movement and risky play"]],["Spaces",["Indoor spaces","Shared spaces","Outdoor spaces"]],["Children",["Children's interests"]],["Seasons",["Across the year on our site"]],["Hard days",["Ready for today"]]];
const IB_KIND={medium:"Material",area:"Space",interest:"Children's interest",year:"Across the year",ready:"Ready for today"};
const IB_KINDS=[["medium","A material"],["area","A space"],["interest","A children's interest"],["year","Across the year on our site"],["ready","Ready for today"]];
// the seven materials guides now open these cards, from their Materials library group, their Classroom area or a plan
// that attached a guide before
const IB_GUIDE={slug:{atelier:"studio-and-class-ateliers",clay:"clay",dramatic:"home-and-dramatic-play-area",noticing:"photography","piazza-tools":"piazza-and-culinary-atelier",workshop:"water",writing:"writing-center"},
  group:{"atelier":"studio-and-class-ateliers","sculpture":"clay","loose parts":"home-and-dramatic-play-area","recording":"photography","culinary":"piazza-and-culinary-atelier","natural":"water","mark-making":"writing-center"},
  area:{"art":"studio-and-class-ateliers","dramatic play":"home-and-dramatic-play-area","science and discovery":"photography","piazza":"piazza-and-culinary-atelier","sensory table":"water","writing center":"writing-center"}};
const IB_STANCE=[["Arrive and stay","Choose a spot and stay in it. Coming and going pulls children's attention with us. Sit at their level, within arm's reach. If you need to raise your voice to be heard, you are too far away."],
  ["Calm travels","Children borrow our regulation. Slow your breath, your hands and your words. A child who is struggling needs a steady adult first. We co-regulate first and offer something new second."],
  ["Describe what you see","Narrate the work. \"You pressed hard and the line got darker.\" Describing tells children we are paying attention and invites them to say more. Words like \"beautiful\" or \"good job\" tend to end the conversation."],
  ["Know your own feelings","Notice how you feel about mud, heights, spills, noise, bugs and broken towers. Children read it on our faces. Name the feeling to yourself and choose your response. When a material is hard for you, ask a colleague to share the space."],
  ["Hands off the product","Model how to care for a brush, wedge clay or thread a needle, then step back. We never draw, fix or finish a child's work. The ideas belong to the children."],
  ["Plan so you can say yes","Set up the space so mess, noise, risk and collapse are welcome. Towers fall, paint mixes to brown and clay cracks. These are part of the work, and our relaxed body tells children so."],
  ["Wonder alongside","Use I notice, I wonder and It reminds me of. Leave room for silence. Discovering alongside children often matters more than knowing the answer."],
  ["Children close the cycle","Setting up and closing belong to the children. They carry materials out, wash their own brushes, wipe the table, sweep, and return every tool to its home for the next friend. We set up so this is easy. A wash bucket or low sink, a damp sponge at each table, a drying rack and a labeled home for each tool. Closing happens on the floor with the children, as part of the work. Nothing waits for an educator to put away later."],
  ["Expected and still guided","Much of what children do fits their age and stage (developmentally appropriate). Twos bite and grab, threes say no, fours test who is in and who is out. We understand the reason, and we still guide, so everyone stays safe and included (socially acceptable). Understanding and guiding go together."],
  ["Connected to","Art of Presence and Language (PD) · The Image of the Child lens"]];
const IB_DEV_NOTE="A behavior can be expected for a child's age and stage (developmentally appropriate) and still need our guidance, so everyone stays safe and included (socially acceptable). We understand the reason and we still guide.";
const IB_STANCE_LEAD="Every card in the Idea bank begins with us. Children read our faces, our bodies and our voices before they touch a material. How we are present decides whether an invitation opens up or closes.";
(()=>{const st=document.createElement("style");st.textContent=`.ibwrap{display:grid;grid-template-columns:210px minmax(0,330px) minmax(0,1fr);gap:14px;align-items:start}
.ibnav{display:grid;gap:12px}.ibnav .ibh{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#666)}
.ibg{display:flex;justify-content:space-between;width:100%;text-align:left;border:0;background:transparent;padding:7px 9px;border-radius:8px;cursor:pointer;font:inherit;color:inherit}
.ibg[aria-current="true"]{background:var(--moss-soft,#e3ece2);font-weight:700}.ibrow{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1px solid var(--line,#ddd);border-radius:10px;margin:0 0 6px}
.ibrow[aria-current="true"]{border-color:var(--moss,#2f5d50)}.ibrow input{margin-top:4px}.ibrow button{flex:1;text-align:left;background:none;border:0;cursor:pointer;font:inherit;color:inherit;padding:0}
.ibcardv h3{font-size:17px;margin:14px 0 4px}.ibcardv ul,.ibcardv ol{margin:4px 0;padding-left:20px}.ibset{border-left:4px solid var(--moss,#2f5d50);padding:6px 10px;margin:8px 0;background:var(--moss-soft,#f1f6ef);border-radius:6px}
.ibtip{font-size:14px;margin-top:4px}.ibtop{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.iblines span{display:block}
.planres{margin-top:4px}.planres>summary{cursor:pointer}.planres .subrow{margin-top:4px}
@media (max-width:900px){.ibwrap{grid-template-columns:minmax(0,1fr)}.ibnav{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}`;document.head.appendChild(st)})();
async function ibLoad(force){if(!window.FP_API)return ib;if(ib&&!force)return ib;if(ibBusy)return ibBusy;
  ibBusy=(async()=>{try{ib=await window.FP_API("/api/staff/ideabank",{});ibIndex=null}catch(e){if(!ib)ib=false}finally{ibBusy=null}
    if(["ideabank","inquiries","plans"].includes(view)&&!document.activeElement?.closest?.("#main textarea,#main input"))renderMain();if(view==="search"&&typeof gsResults==="function")gsResults();if(libSheetOn)libSheetPaint();return ib})();
  return ibBusy}
const ibCards=()=>(ib&&ib.cards)||[];
let ibIndex=null;
function ibIdx(){if(!ibIndex){ibIndex=new Map();for(const c of ibCards())ibIndex.set(c.id,(c.title+" "+c.group+" "+(c.summary||"")+" "+(c.sections||[]).map(s=>s.h+" "+(s.text||"")+" "+(s.items||[]).join(" ")).join(" ")).toLowerCase())}return ibIndex}
const ibCard=id=>ibCards().find(c=>c.id===id)||null;
const ibByTitle=t=>{const l=String(t||"").toLowerCase().trim();return ibCards().find(c=>c.title.toLowerCase()===l)||null};
const ibHigh=id=>!!ib&&(ib.highlights||[]).includes(id);
const ibDir=()=>isDirector()&&!VIEW_AS;
function ibLines(s){return s.style==="text"?[s.text||""]:(s.items||[])}
// the parts of a card the editor holds, the same list the server keeps, so a suggestion names the part it changes
function ibFields(c){const out=[["title","Title"],["summary","Summary"]];const sf=(pre,s,i,l)=>s.style==="text"?[`${pre}.${i}.text`,l+s.h]:[`${pre}.${i}.items`,l+s.h+", one on each line","lines"];
  (c.sections||[]).forEach((s,i)=>out.push(sf("sections",s,i,"")));
  out.push(["setting.level","Setting"],["setting.why","Setting, why"],["feeds","What it feeds, one on each line","lines"],["supports","What it supports, one on each line","lines"],["seeks","For a child who seeks more"],["avoids","For a child who finds it too much"],["connected","Connected to, one on each line","lines"]);
  if(c.home){out.push(["home.title","At home, the title"]);(c.home.sections||[]).forEach((s,i)=>out.push(sf("home.sections",s,i,"At home, ")))}return out}
const ibAt=(o,k)=>k.split(".").reduce((t,x)=>t&&typeof t==="object"?t[x]:undefined,o);
// cards ranked by the needs and systems they share, with the line that says why and the seeks or avoids line
function ibMatch(needs,sys,mode,n){const S=sys||{};const names=Object.keys(S);
  return ibCards().map(x=>{const hits=(x.feeds||[]).filter(f=>needs.includes(f)),shits=(x.supports||[]).filter(f=>names.includes(f));
    return {x,hits,shits,score:hits.length*2+shits.length*2+(hits.length&&shits.length?1:0)}}).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.x.title.localeCompare(b.x.title)).slice(0,n||12).map(r=>{
    const parts=[];if(r.hits.length)parts.push("Can feed "+r.hits.map(h=>h.toLowerCase()).join(" and ")+".");if(r.shits.length)parts.push("Supports "+r.shits.map(h=>h.toLowerCase()).join(" and ")+".");
    const modes=new Set(r.shits.map(h=>S[h]||mode||"seek"));const tips=[];if(r.shits.length&&(modes.has("seek")||modes.has("both"))&&has(r.x.seeks))tips.push(r.x.seeks);if(r.shits.length&&(modes.has("avoid")||modes.has("both"))&&has(r.x.avoids))tips.push(r.x.avoids);
    return {card:r.x,why:parts.join(" "),tips}})}
const ibRowHtml=(r,extra)=>`<div class="prow" style="align-items:flex-start"><div style="min-width:0;display:grid;gap:2px"><div><b>${esc(r.card.title)}</b> <span class="cnt">${esc(IB_KIND[r.card.type]||"")}</span></div><div class="cnt">${esc(r.why)}</div>${r.tips.map(t=>`<div class="ibtip">${esc(t)}</div>`).join("")}</div><div class="actions" style="margin:0;flex-wrap:nowrap"><button class="btn small ghost" data-ibopen="${esc(r.card.id)}">Open card</button>${extra?extra(r):""}</div></div>`;

/* ---------- the list ---------- */
function ibShown(){const st=ibSt,q=st.q.trim().toLowerCase(),I=ibIdx();
  return ibCards().filter(c=>{if(q){if(!q.split(/\s+/).every(w=>I.get(c.id).includes(w)))return false}
    else if(!st.needs.length&&!st.sups.length&&!st.levels.length&&c.group!==st.group)return false;
    if(st.levels.length&&(!c.setting||!st.levels.includes(c.setting.level)))return false;
    if(st.needs.length&&!st.needs.some(n=>(c.feeds||[]).includes(n)))return false;
    if(st.sups.length&&!st.sups.some(n=>(c.supports||[]).includes(n)))return false;return true})}
// the cards that fit a plan, from its own words, its space and its focus
function ibForPlan(p){if(!p)return [];const words=new Set(attWords([...Object.values(p.fields||{}),p.where,...(p.groups||[]),...(p.languages||[])].join(" ")));const where=String(p.where||"").toLowerCase();
  return ibCards().map(c=>{let sc=0;const tw=attWords(c.title+" "+c.group);for(const w of new Set(tw))if(words.has(w))sc+=3;for(const w of new Set(attWords(ibIdx().get(c.id))))if(words.has(w))sc+=.25;
    if(where&&(where.includes(c.title.toLowerCase())||c.title.toLowerCase().includes(where)))sc+=8;if(p.focus==="area"&&IB_GUIDE.area[where]===c.id)sc+=8;return {c,sc}}).filter(r=>r.sc>=3).sort((a,b)=>b.sc-a.sc).slice(0,10).map(r=>r.c)}
const chipRow=(all,on,key)=>`<div class="chips" style="margin-top:6px">${all.map(n=>`<button class="chip ${on.includes(n)?"on":""}" type="button" aria-pressed="${on.includes(n)}" data-ibchip="${key}" data-val="${esc(n)}">${esc(n)}</button>`).join("")}</div>`;
function ibListHtml(){const st=ibSt,shown=ibShown();const plan=st.fromPlan&&plans.get(st.fromPlan);const fits=plan?ibForPlan(plan):[];
  const row=c=>`<div class="ibrow" aria-current="${st.mode==="card"&&c.id===st.sel}"><input type="checkbox" data-ibpick="${esc(c.id)}" ${ibPick.has(c.id)?"checked":""} aria-label="Select ${esc(c.title)} for printing"><button type="button" data-ibsel="${esc(c.id)}"><b>${esc(c.title)}</b><span class="cnt" style="display:block">${esc(c.group)}${c.setting&&c.setting.level?" · "+esc(c.setting.level):""}</span></button>${ibHigh(c.id)?`<span class="pill" style="pointer-events:none">At school now</span>`:""}</div>`;
  return `<section class="card">${plan?`<div class="ibset"><b>Ideas for ${esc(planTitle(plan))}</b><div class="cnt">From the plan's own words, its space and its focus.</div>${fits.map(row).join("")||`<div class="cnt">No card matches the plan's words yet. Browse the groups or search.</div>`}<div class="actions"><button class="linkbtn" data-ibplanback="1">Back to the plan</button><button class="linkbtn" data-ibplanoff="1">Browse without the plan</button></div></div>`:""}
    <label class="lbl" for="ib-q">Search</label><input type="search" id="ib-q" value="${esc(st.q)}" placeholder="clay, rain, opening things" data-noproof="1">
    <details style="margin-top:8px"><summary class="linkbtn">Filter by what it feeds${st.needs.length?" ("+st.needs.length+")":""}</summary>${chipRow(ib.needs||[],st.needs,"needs")}</details>
    <details><summary class="linkbtn">Filter by what it supports${st.sups.length?" ("+st.sups.length+")":""}</summary>${chipRow(ib.supports||[],st.sups,"sups")}</details>
    <details><summary class="linkbtn">Filter by setting${st.levels.length?" ("+st.levels.length+")":""}</summary>${chipRow(ib.levels||[],st.levels,"levels")}</details>
    ${st.needs.length||st.sups.length||st.levels.length?`<div class="actions"><button class="linkbtn" data-ibclearf="1">Clear the filters</button></div>`:""}
    <div class="actions" style="justify-content:space-between"><span class="cnt">${shown.length} ${shown.length===1?"card":"cards"}</span><button class="btn small ghost" data-ibselall="1">Select all shown</button></div>
    ${ibPick.size?`<div class="ibset"><b>${ibPick.size} selected for printing</b><div class="actions">${printBtns("ibcards",esc(st.side+"|"+[...ibPick].join(",")),"Print selected",true)}<button class="linkbtn" data-ibclearsel="1">Clear</button></div><div class="cnt">${st.side==="home"?"The At home side prints":"The educator side prints"}, one card to a page.</div></div>`:""}
    <div style="margin-top:8px">${shown.map(row).join("")||`<div class="empty">No card fits. Try other words or clear the filters.</div>`}</div></section>`}

/* ---------- a card ---------- */
function ibConnHtml(k){const hit=ibByTitle(k);if(hit)return `<button class="linkbtn" data-ibopen="${esc(hit.id)}">${esc(k)}</button>`;
  const go=/ on the Artists page\b/.test(k)?"artists":/^Garden page$/.test(k)?"garden":/^Recipe library$/.test(k)?"recipes":/^(Song book|Book collection)$/.test(k)?"songs":/ lens$/.test(k)?"lens":/cultural place|Museums and cultural places/.test(k)?"museums":"";
  return go?`<button class="linkbtn" data-tview="${go}">${esc(k)}</button>`:esc(k)}
function ibSectionHtml(s){return `<h3>${esc(s.h)}</h3>${s.style==="text"?`<p>${esc(s.text||"")}</p>`:s.style==="numbered"?`<ol>${(s.items||[]).map(t=>`<li>${esc(t)}</li>`).join("")}</ol>`:s.style==="lines"?`<div class="iblines">${(s.items||[]).map(t=>`<span>${esc(t)}</span>`).join("")}</div>`:`<ul>${(s.items||[]).map(t=>`<li>${esc(t)}</li>`).join("")}</ul>`}`}
function ibCardHtml(c){const home=ibSt.side==="home"&&!!c.home,dir=ibDir(),plan=ibSt.fromPlan&&plans.get(ibSt.fromPlan);
  const used=plan&&(plan.attached||[]).some(a=>a.kind==="idea"&&a.id===c.id);const fl=ibFields(c);
  return `<section class="card ibcardv"><span class="eyebrow">${esc(IB_KIND[c.type]||"")} · ${esc(c.group)}</span><h2 style="margin:4px 0 6px">${esc(home?c.home.title:c.title)}</h2>
    <p>${esc(home?"For families to try at home.":c.summary||"")}</p>
    ${!home&&c.setting&&c.setting.level?`<div class="ibset"><b>${esc(c.setting.level)}</b>${has(c.setting.why)?` <span>${esc(c.setting.why)}</span>`:""}</div>`:""}
    ${c.home?`<div class="seg" role="group" aria-label="Card version"><button data-ibside="edu" aria-pressed="${!home}">For educators</button><button data-ibside="home" aria-pressed="${home}">At home</button></div>`:""}
    <div class="actions">${printBtns("ibcards",esc((home?"home":"edu")+"|"+c.id),"Print this card",true)}${plan?(used?`<span class="cnt">In the plan</span>`:`<button class="btn small" data-ibuse="${esc(c.id)}">Use in plan</button>`):""}
      ${dir&&c.home?`<button class="btn small ghost" data-ibhigh="${esc(c.id)}|${ibHigh(c.id)?0:1}">${ibHigh(c.id)?"Highlighted for families":"Highlight for families"}</button><button class="btn small ghost" data-ibshare="${esc(c.id)}">Share</button>`:""}
      ${dir?pageEditBtn("staff/library/ideabank/cards.json","Edit",c.id):""}</div>
    ${(home?c.home.sections:c.sections||[]).map(ibSectionHtml).join("")}
    ${home?"":`<h3>Feeds</h3><div class="chips">${(c.feeds||[]).map(f=>`<span class="pill" style="pointer-events:none">${esc(f)}</span>`).join("")}</div>
      ${(c.supports||[]).length?`<h3>Supports</h3><div class="chips">${c.supports.map(f=>`<span class="pill" style="pointer-events:none">${esc(f)}</span>`).join("")}</div>${has(c.seeks)?`<p class="ibtip">${esc(c.seeks)}</p>`:""}${has(c.avoids)?`<p class="ibtip">${esc(c.avoids)}</p>`:""}`:""}
      <h3>Connected to</h3><ul>${(c.connected||[]).map(k=>`<li>${ibConnHtml(k)}</li>`).join("")}</ul>`}
    ${dir?`<div class="actions" style="margin-top:12px"><button class="linkbtn" data-ibremove="${esc(c.id)}">Remove this card</button></div>`
      :!VIEW_AS?`<details style="margin-top:12px" ${ibSt.sugOpen===c.id?"open":""}><summary class="linkbtn">Suggest a change</summary><div class="kfields">
        <label>The part to change<select id="ib-sgf" data-ibsgf="${esc(c.id)}">${fl.map(([k,l])=>`<option value="${esc(k)}">${esc(l)}</option>`).join("")}</select></label>
        <label>The new wording<textarea id="ib-sgt" rows="5">${esc((v=>Array.isArray(v)?v.join("\n"):v||"")(ibAt(c,fl[0][0])))}</textarea></label>
        <label>Why, in a few words<input type="text" id="ib-sgn"></label></div><div class="actions"><button class="btn small" data-ibsgsend="${esc(c.id)}">Send to the director</button></div><div class="cnt">The director approves it or sets it aside.</div></details>`:""}</section>`}
function ibStanceHtml(){return `<section class="card ibcardv"><span class="eyebrow">Before any card</span><h2 style="margin:4px 0 8px">How We Offer Ideas</h2><p>${esc(IB_STANCE_LEAD)}</p>${IB_STANCE.map(([h,t])=>`<h3>${esc(h)}</h3><p>${esc(t)}</p>`).join("")}</section>`}
function ibSeeingHtml(){const B=(ib.behaviors||[]),q=ibSt.bq.trim().toLowerCase();const list=B.filter(b=>!q||(b.label+" "+(b.keywords||[]).join(" ")).toLowerCase().includes(q));const b=B.find(x=>x.id===ibSt.bsel);
  const rows=b?ibMatch(b.needs||[],Object.fromEntries((b.supports||[]).map(s=>[s,b.mode==="avoid"?"avoid":b.mode==="both"?"both":"seek"])),b.mode,12):[];
  return `<section class="card ibcardv"><span class="eyebrow">Search by what is happening</span><h2 style="margin:4px 0 8px">What are you seeing?</h2>
    <p>Behavior is how a child meets a need. These are possibilities to wonder about, never labels. Try the first steps and write down what happened. If it keeps happening after what we tried, open a team inquiry. One hard moment is never an inquiry.</p><p class="ibset">${esc(IB_DEV_NOTE)}</p>
    <label class="lbl" for="ib-bq">Describe it in a word or two</label><input type="search" id="ib-bq" value="${esc(ibSt.bq)}" placeholder="throwing, biting, covering ears, climbing on tables" data-noproof="1">
    <div class="chips" style="margin-top:8px">${list.map(x=>`<button class="chip ${x.id===ibSt.bsel?"on":""}" type="button" data-ibbeh="${esc(x.id)}">${esc(x.label)}</button>`).join("")||`<span class="cnt">Nothing matches those words. Try another word.</span>`}</div>
    ${b?`<h3>${esc(b.label)}</h3><p>${esc(b.what_we_might_see||"")}</p><h3>What the child might be seeking</h3><p>${esc(b.might_be_seeking||"")}</p>
      ${has(b.development)?`<h3>Where it can fit in development (developmental stage)</h3><p>${esc(b.development)}</p>${(b.sources||[]).length?`<div class="cnt">From ${(b.sources||[]).map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(", ")}</div>`:""}`:""}
      <h3>First steps</h3><ul>${(b.first_steps||[]).map(t=>`<li>${esc(t)}</li>`).join("")}</ul><h3>Keeping everyone safe</h3><p>${esc(b.keep_safe||"")}</p>
      <div class="chips">${[...(b.needs||[]),...(b.supports||[])].map(f=>`<span class="pill" style="pointer-events:none">${esc(f)}</span>`).join("")}</div>
      ${ibFromUsHtml(b.from_us||[])}${ibTriedHtml(b)}
      <h3>Ideas that may help</h3>${rows.map(r=>ibRowHtml(r)).join("")||`<div class="cnt">No card shares these needs yet.</div>`}`:""}</section>`}
// what the child might need from us, each with what it can look like
function ibFromUsHtml(names){const L=(ib.fromUs||[]).filter(u=>names.includes(u.name));if(!L.length)return "";
  return `<h3>What the child might need from us</h3>${L.map(u=>`<p><b>${esc(u.name)}.</b> ${esc(u.look)}</p>`).join("")}`}
// the first steps the class tried for this behavior, on which days, and the way to a team inquiry once there are two days
const ibTriedOf=(b,room)=>(ib.tried||[]).filter(t=>t.behavior===b.id&&(room==null||(t.room||"")===room)).sort((x,y)=>(y.at||0)-(x.at||0));
function ibTriedHtml(b){const dir=isDirector(),room=myRoom()||"";
  const mine=ibTriedOf(b,dir?null:room),ready=ibTriedOf(b,room).some(t=>has(t.happened));
  const rows=mine.map(t=>`<div class="pdir"><b>${esc(t.step)}</b>${has(t.happened)?`<div>${esc(t.happened)}</div>`:""}<div class="cnt">${esc([t.room?t.room+" class":"",t.by,shortDate(t.at)].filter(has).join(", "))}${!VIEW_AS&&(dir||String(t.by||"").toLowerCase()===String(whoAmI()||"").toLowerCase())?` <button class="linkbtn" data-ibuntry="${esc(t.id)}">Remove</button>`:""}</div></div>`).join("");
  const form=VIEW_AS?"":`<details ${ibSt.tryOpen===b.id?"open":""}><summary class="linkbtn" data-ibtryopen="${esc(b.id)}">We tried this</summary><div class="kfields">
    <label>What we tried<select id="ib-trs">${(b.first_steps||[]).map(f=>`<option>${esc(f)}</option>`).join("")}<option value="">Something else, written below</option></select></label>
    <label>Something else<input type="text" id="ib-tro"></label>
    <label>What happened<textarea id="ib-trh" rows="3"></textarea></label></div>
    <div class="hint">Leave children's names out. Write what you saw.</div><div class="actions"><button class="btn small" data-ibtry="${esc(b.id)}">Save the try</button></div></details>`;
  const inq=VIEW_AS?"":dir?`<button class="btn small" data-ibinq="${esc(b.id)}">Start a team inquiry with this</button>`
    :ready?`<label class="cnt"><input type="checkbox" id="ib-keeps"> It keeps happening after what we tried</label><button class="btn small" data-ibinq="${esc(b.id)}">Open a team inquiry with this</button>`
    :`<span class="cnt">A team inquiry opens once your class has tried the first steps and written what happened.</span>`;
  return `<h3>What we tried</h3><div class="hint">Try the first steps, then write down what happened. The director sees every try.</div>${rows||`<div class="cnt">Nothing written yet.</div>`}${form}<div class="actions">${inq}</div>`}
function ibSugHtml(){if(!ib)return "";const dir=ibDir(),L=ib.suggestions||[],done=ib.decided||[];if(!L.length&&!done.length)return "";
  const body=x=>x.kind==="new"?`<b>A new idea, ${esc(x.title)}</b><div class="cnt">${esc((IB_KIND[x.type]||"")+", "+x.group)}</div><div style="white-space:pre-line">${esc(x.text)}</div>`
    :x.kind==="change"?`<b>A change to ${esc(x.cardTitle||"")}, ${esc(x.label||"")}</b><div style="white-space:pre-line">${esc(x.text)}</div>`
    :`<b>A team inquiry about ${esc(x.title||"")}</b><div class="cnt">${esc([...(x.needs||[]),...(x.supports||[])].join(", "))}</div>`;
  return `<section class="card"><div class="lbl">${dir?"Suggestions waiting":"Your suggestions"}</div>
    ${L.map(x=>`<div class="pdir">${body(x)}${has(x.note)?`<div class="cnt">${esc(x.note)}</div>`:""}<div class="cnt">${esc(x.by)}, ${esc(shortDate(x.at))}</div>
      <div class="actions">${dir?`<button class="btn small" data-ibdecide="${esc(x.id)}|1">Approve</button><button class="btn small ghost" data-ibdecide="${esc(x.id)}|0">Set aside</button>${x.card?`<button class="linkbtn" data-ibopen="${esc(x.card)}">Open the card</button>`:""}`:`<span class="cnt">Waiting for the director</span>`}</div></div>`).join("")}
    ${done.map(x=>`<div class="cnt">${esc(x.kind==="change"?x.cardTitle+", "+x.label:x.title)}. ${x.status==="approved"?"Approved":"Set aside"} ${esc(shortDate(x.decidedAt))}.</div>`).join("")}</section>`}
function ibToolsHtml(){const dir=ibDir();if(VIEW_AS)return "";const T=ib.types||{};const kinds=IB_KINDS.map(([k,l])=>`<option value="${k}">${esc(l)}</option>`).join("");const groups=k=>(T[k]||[]).map(g=>`<option>${esc(g)}</option>`).join("");
  const form=(id,btn)=>`<div class="kfields"><label>What kind<select id="${id}-type" data-ibtype="${id}">${kinds}</select></label><label>Its group<select id="${id}-group">${groups("medium")}</select></label><label>Its title<input type="text" id="${id}-title"></label>
    ${id==="ib-new"?`<label>A few lines. The first is what the card offers, and each line after it is one way to offer it.<textarea id="ib-new-text" rows="5"></textarea></label>`:""}</div><div class="actions"><button class="btn small" data-${id==="ib-add"?"ibaddgo":"ibnewgo"}="1">${btn}</button></div>`;
  return dir?`<details ${ibSt.addOpen?"open":""}><summary class="linkbtn">Add a card</summary>${form("ib-add","Add it and write it in Edit")}<div class="cnt">A new card starts from the blank template of its kind.</div></details>
    ${(ib.removed||[]).length?`<details><summary class="linkbtn">Removed cards, ${ib.removed.length}</summary>${ib.removed.map(r=>`<div class="prow"><span>${esc(r.title)} <span class="cnt">${esc(r.by||"")}, ${esc(shortDate(r.at))}</span></span><button class="btn small ghost" data-ibrestore="${esc(r.id)}">Put it back</button></div>`).join("")}</details>`:""}`
    :`<details ${ibSt.newOpen?"open":""}><summary class="linkbtn">Suggest a new idea</summary>${form("ib-new","Send to the director")}<div class="cnt">It waits for the director, who approves it or sets it aside.</div></details>`}
function renderIdeaBank(){const m=$("#main");if(!m)return;
  const head=`<div class="head"><span class="eyebrow">Plans, Planning resources</span><h2 style="margin-top:4px">Idea bank</h2><div class="sub">Invitations and provocations for every material, space, interest and season, and ideas ready for a hard day.</div></div>`;
  if(!ib){m.innerHTML=head+`<section class="card"><div class="empty">${ib===false?"The Idea bank could not be opened. Check the connection and try again.":`<span class="spin"></span> Opening the Idea bank`}</div></section>`;if(ib===null)ibLoad();else if(ib===false){ib=null}return}
  const st=ibSt;let c=st.mode==="card"&&(ibCard(st.sel)||ibShown()[0]||ibCards()[0]);if(c)st.sel=c.id;
  const counts={};for(const x of ibCards())counts[x.group]=(counts[x.group]||0)+1;
  const filt=!!(st.q||st.needs.length||st.sups.length||st.levels.length);
  const nav=`<nav class="ibnav" aria-label="Idea bank groups">${IB_NAV.map(([h,gs])=>`<div><div class="ibh">${esc(h)}</div>${gs.filter(g=>counts[g]).map(g=>`<button class="ibg" type="button" data-ibgroup="${esc(g)}" aria-current="${!filt&&st.group===g}"><span>${esc(g)}</span><span class="cnt">${counts[g]}</span></button>`).join("")}</div>`).join("")}</nav>`;
  const top=`<div class="ibtop"><button class="btn small${st.mode==="stance"?"":" ghost"}" data-ibmode="stance">How We Offer Ideas</button><button class="btn small${st.mode==="seeing"?"":" ghost"}" data-ibmode="seeing">What are you seeing?</button></div>`
  const famSwitch=ib&&ib.director&&!VIEW_AS?`<section class="card"><div class="lbl">Ideas to try at home</div><div class="hint">${ib.familyOn?"Families see the At home side of every card on the Family page, with your highlights first.":"Families do not see these ideas yet. Turn them on when you are ready."}</div><div class="actions"><button class="btn small${ib.familyOn?" ghost":""}" data-ibfamily="${ib.familyOn?0:1}">${ib.familyOn?"Turn off for families":"Turn on for families"}</button></div></section>`:"";
  const right=st.mode==="stance"?ibStanceHtml():st.mode==="seeing"?ibSeeingHtml():c?ibCardHtml(c):"";
  const phone=window.innerWidth<=900;
  m.innerHTML=head+top+famSwitch+ibSugHtml()+`<div class="actions" style="margin:0 0 8px">${ibToolsHtml()}</div>`+(phone&&(st.mode!=="card"||st.picked)?`<div class="actions"><button class="linkbtn" data-ibmode="list">‹ Back to the cards</button></div>${right}`
    :`<div class="ibwrap"><div>${nav}</div><div>${ibListHtml()}</div><div id="ibright">${right}</div></div>`)}
// a picked card on a phone shows on its own, with Back to the cards
function ibOpen(id,side){const c=ibCard(id);if(!c)return;ibSt.sel=id;ibSt.mode="card";ibSt.picked=true;if(side)ibSt.side=side;else if(ibSt.side==="home"&&!c.home)ibSt.side="edu";ibKeep();
  if(view!=="ideabank")goView("ideabank");else{renderMain();const r=$("#ibright");if(r&&window.innerWidth>900)r.scrollIntoView({block:"start"});else jumpTop()}}
window.TREE_IDEA_OPEN=ibOpen;
document.addEventListener("input",e=>{const t=e.target;if(view!=="ideabank"||!t)return;
  if(t.id==="ib-q"||t.id==="ib-bq"){if(t.id==="ib-q"){ibSt.q=t.value;ibSt.mode=ibSt.mode==="card"?"card":ibSt.mode}else ibSt.bq=t.value;const at=t.selectionStart,id=t.id;clearTimeout(ibInputT);ibInputT=setTimeout(()=>{renderMain();const q=$("#"+id);if(q){q.focus();try{q.setSelectionRange(at,at)}catch(er){}}},150)}});
let ibInputT=null;
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset)return;
  if(t.dataset.ibpick){if(t.checked)ibPick.add(t.dataset.ibpick);else ibPick.delete(t.dataset.ibpick);renderMain();return}
  if(t.dataset.ibtype){const g=$("#"+t.dataset.ibtype+"-group");if(g&&ib)g.innerHTML=((ib.types||{})[t.value]||[]).map(x=>`<option>${esc(x)}</option>`).join("");return}
  if(t.dataset.ibsgf){const c=ibCard(t.dataset.ibsgf),ta=$("#ib-sgt");if(c&&ta){const v=ibAt(c,t.value);ta.value=Array.isArray(v)?v.join("\n"):v||""}return}});
document.addEventListener("click",async e=>{const t=e.target.closest("[data-ibopen],[data-ibgroup],[data-ibsel],[data-ibmode],[data-ibchip],[data-ibclearf],[data-ibselall],[data-ibclearsel],[data-ibside],[data-ibuse],[data-ibhigh],[data-ibremove],[data-ibrestore],[data-ibaddgo],[data-ibnewgo],[data-ibsgsend],[data-ibdecide],[data-ibbeh],[data-ibinq],[data-ibplanback],[data-ibplanoff],[data-ibshare],[data-ibfind],[data-ibfamily],[data-ibtry],[data-ibuntry],[data-ibtryopen]");if(!t)return;const d=t.dataset;
  if(d.ibopen){e.preventDefault();if(libSheetOn){libSheetOn=null;libSheetPaint()}if(!ib)await ibLoad();ibOpen(d.ibopen);return}
  if(d.ibfind){const p=plans.get(d.ibfind);if(!p)return;ibSt.fromPlan=p.id;ibSt.mode="card";ibSt.q="";ibSt.needs=[];ibSt.sups=[];ibSt.levels=[];ibSt.picked=false;if(!ib)ibLoad();const f=ib?ibForPlan(p)[0]:null;if(f)ibSt.sel=f.id;goView("ideabank",{keepPlan:true});return}
  if(view!=="ideabank"&&!d.ibshare)return;
  if(d.ibgroup){ibSt.group=d.ibgroup;ibSt.q="";ibSt.needs=[];ibSt.sups=[];ibSt.levels=[];ibSt.mode="card";ibSt.picked=false;ibSt.sel=(ibShown()[0]||{}).id||"";ibKeep();renderMain();return}
  if(d.ibsel){ibOpen(d.ibsel);return}
  if(d.ibmode){if(d.ibmode==="list"){ibSt.picked=false;ibSt.mode="card"}else{ibSt.mode=ibSt.mode===d.ibmode?"card":d.ibmode;ibSt.picked=ibSt.mode!=="card"}renderMain();jumpTop();return}
  if(d.ibchip){const k=d.ibchip,a=ibSt[k],i=a.indexOf(d.val);if(i>=0)a.splice(i,1);else a.push(d.val);ibSt.mode="card";renderMain();return}
  if(d.ibclearf){ibSt.needs=[];ibSt.sups=[];ibSt.levels=[];renderMain();return}
  if(d.ibselall){for(const c of ibShown())ibPick.add(c.id);renderMain();return}
  if(d.ibclearsel){ibPick.clear();renderMain();return}
  if(d.ibside){ibSt.side=d.ibside;ibKeep();renderMain();return}
  if(d.ibplanback){const id=ibSt.fromPlan;ibSt.fromPlan="";if(id&&plans.get(id)){currentId=id;goView("plans",{keepPlan:true})}return}
  if(d.ibplanoff){ibSt.fromPlan="";renderMain();return}
  if(d.ibbeh){ibSt.bsel=ibSt.bsel===d.ibbeh?"":d.ibbeh;renderMain();return}
  if(d.ibshare){const c=ibCard(d.ibshare);if(c&&isDirector()&&!VIEW_AS)ideaShare(c);return}
  if(VIEW_AS){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  if(d.ibuse){const p=plans.get(ibSt.fromPlan),c=ibCard(d.ibuse);if(!p||!c)return;if(!(p.attached||[]).some(a=>a.kind==="idea"&&a.id===c.id)){p.attached=[...(p.attached||[]),{kind:"idea",id:c.id,title:c.title}];persist(p)}
    toastAct(c.title+" is attached to the plan.","Back to the plan",()=>{ibSt.fromPlan="";currentId=p.id;goView("plans",{keepPlan:true})});renderMain();return}
  if(d.ibinq){const b=(ib.behaviors||[]).find(x=>x.id===d.ibinq);if(!b)return;const mode=b.mode==="avoid"?"avoid":"seek",dir=isDirector(),room=myRoom()||"";
    const tried=ibTriedOf(b,dir?null:room).slice().reverse().map(t=>({step:t.step,happened:t.happened||"",by:t.by,at:t.at,room:t.room||""}));
    const base={name:b.label,ibNeeds:(b.needs||[]).slice(),ibSys:Object.fromEntries((b.supports||[]).map(s=>[s,mode])),ibMode:mode,ibUs:(b.from_us||[]).slice(),ibFrom:b.id,tried};
    if(dir){startInquiry(base);return}
    if(!ibTriedOf(b,room).some(t=>has(t.happened))){toast("Write what you tried and what happened first.");return}
    if(!$("#ib-keeps")||!$("#ib-keeps").checked){toast("A team inquiry is for something that keeps happening after what we tried. Check the box if it does.");return}
    startInquiry(Object.assign(base,{room,startedBy:whoAmI(),display:false}));return}
  if(d.ibtryopen){ibSt.tryOpen=ibSt.tryOpen===d.ibtryopen?"":d.ibtryopen;return}
  if(d.ibtry){const sel=$("#ib-trs").value,other=($("#ib-tro").value||"").trim(),happened=($("#ib-trh").value||"").trim(),step=other||sel;
    if(!step){toast("Choose or write what you tried.");return}if(!happened){toast("Write what happened when you tried it.");return}
    try{ib=await window.FP_API("/api/staff/ideabank/tried",{behavior:d.ibtry,room:myRoom()||"",step,happened});ibIndex=null;ibSt.tryOpen="";toast("Saved. The team can see what was tried.");renderMain()}catch(er){toast(er&&er.message||"That did not save.")}return}
  if(d.ibuntry){if(!confirm("Remove this try?"))return;try{ib=await window.FP_API("/api/staff/ideabank/untried",{id:d.ibuntry});ibIndex=null;renderMain()}catch(er){toast(er&&er.message||"That did not save.")}return}
  const call=async(path,body,ok)=>{try{ib=await window.FP_API("/api/staff/ideabank/"+path,body);ibIndex=null;if(ok)toast(ok);renderMain();return ib}catch(er){toast(er&&er.message||"That did not save.");return null}};
  if(d.ibfamily!=null){await call("family",{on:d.ibfamily==="1"},d.ibfamily==="1"?"Families see Ideas to try at home now.":"Ideas to try at home is hidden from families.");return}
  if(d.ibhigh){const [id,on]=d.ibhigh.split("|");await call("highlight",{id,on:on==="1"},on==="1"?"Highlighted. Families see it first.":"Taken off the highlights.");return}
  if(d.ibremove){if(!confirm("Remove this card? It waits under Removed cards, where you can put it back."))return;const id=d.ibremove;if(await call("remove",{id},"Removed. It waits under Removed cards.")){ibSt.sel="";renderMain()}return}
  if(d.ibrestore){await call("restore",{id:d.ibrestore},"Put back.");return}
  if(d.ibaddgo){const type=$("#ib-add-type").value,group=$("#ib-add-group").value,title=($("#ib-add-title").value||"").trim();if(!title){toast("Give the card a title.");return}
    const r=await call("add",{type,group,title});if(r&&r.id){ibSt.addOpen=false;ibSt.group=group;ibOpen(r.id);window.TREE_EDIT_PAGE({path:"staff/library/ideabank/cards.json",item:r.id},async()=>{await ibLoad(true)})}return}
  if(d.ibnewgo){const type=$("#ib-new-type").value,group=$("#ib-new-group").value,title=($("#ib-new-title").value||"").trim(),text=($("#ib-new-text").value||"").trim();if(!title||!text){toast("Give the idea a title and a few lines about it.");return}
    if(await call("suggest",{kind:"new",type,group,title,text},"Sent. Your idea waits for the director."))ibSt.newOpen=false;return}
  if(d.ibsgsend){const field=$("#ib-sgf").value,text=($("#ib-sgt").value||"").trim(),note=($("#ib-sgn").value||"").trim();if(!text){toast("Write the new wording first.");return}
    await call("suggest",{kind:"change",card:d.ibsgsend,field,text,note},"Sent. Your suggestion waits for the director.");return}
  if(d.ibdecide){const [id,ok]=d.ibdecide.split("|");const x=(ib.suggestions||[]).find(y=>y.id===id);const r=await call("decide",{id,approve:ok==="1"},ok==="1"?"Approved.":"Set aside.");
    if(r&&ok==="1"&&x&&x.kind==="inquiry"){const mode=x.mode==="avoid"?"avoid":"seek";startInquiry({name:x.title||"",room:x.room||"",ibNeeds:x.needs||[],ibSys:Object.fromEntries((x.supports||[]).map(s=>[s,mode])),ibMode:mode,ibFrom:x.behavior||""})}
    else if(r&&r.card)ibOpen(r.card);return}});

/* ---------- printing ---------- */
// one card to a letter page, centred when it fits, with only what matters most, the educator side or the At home side
const IB_PRINT_EDU=["Invitations","A starting point","What it might look like","Through the year","What you need","Set it up"];
function ibDoc(c,side){const home=side==="home"&&!!c.home;const S=home?c.home.sections:c.sections||[];const by=h=>S.find(s=>s.h===h);
  const pick=home?["Ways to try it","Your child's role","Wonder together","What your child is learning"].map(by).filter(Boolean)
    :[S.find(s=>IB_PRINT_EDU.includes(s.h)),c.type==="ready"?by("Why it works on hard days"):by("The child's role"),by("Wondering alongside")].filter(Boolean);
  const sub=home?"To try at home":[IB_KIND[c.type],c.setting&&c.setting.level].filter(has).join(", ");const title=home?c.home.title:c.title;
  const make=n=>pick.map(s=>s.style==="text"?dText(s.h,s.text):dList(s.h,(s.items||[]).slice(0,n)));
  for(const n of [6,4,3]){const card=asCard({display:true,type:"report",acc:"story",title,meta:[],blocks:make(n)},{sub});if(card&&card.centered){card.over=c.group;if(volFit(card))return card}}
  return {display:true,type:"report",acc:"story",title,meta:[sub],blocks:make(6)}}
async function ibPrintDocs(spec){if(!ib)await ibLoad();const i=String(spec||"").indexOf("|"),side=spec.slice(0,i),ids=spec.slice(i+1).split(",").filter(Boolean);
  if(!window.jspdf)await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf,"jspdf").catch(()=>{});try{await loadPrintFonts()}catch(e){}
  return ids.map(ibCard).filter(Boolean).map(c=>ibDoc(c,side))}
const ibPrintName=spec=>{const ids=String(spec).split("|")[1].split(",");const one=ids.length===1&&ibCard(ids[0]);return one?(spec.startsWith("home|")&&one.home?one.home.title:one.title+" Idea bank card"):"Idea bank cards"};

/* ---------- a team inquiry ----------
   What the class tried before the inquiry opened, when it came from What are you seeing?, then three hypothesis
   pickers. What the child might need from us is the third, each choice with what it can look like. The first two are what the child might be trying to get and which senses or body systems might be asking for
   more or for less, saved with the inquiry. Possibilities to try lists matching cards with why each connects, and
   We'll try this adds the card's title and link to What we will try. Nothing is added unless the team chooses. */
function ibInquiryHtml(x){if(!ib){ibLoad();return `<section class="card"><div class="lbl">Possibilities to try</div><div class="cnt"><span class="spin"></span> Opening the Idea bank</div></section>`}
  const dir=isDirector()&&!VIEW_AS,needs=x.ibNeeds||[],sys=x.ibSys||{},mode=x.ibMode==="avoid"?"avoid":"seek";
  const sysLabel=n=>sys[n]?n+(sys[n]==="avoid"?", finding it too much":", seeking more"):n;
  const rows=ibMatch(needs,sys,mode,14);const tried=new Set((x.tries||[]).map(t=>t.idea).filter(Boolean));
  const us=x.ibUs||[],before=(x.tried||[]).filter(t=>t&&has(t.step));
  const triedHtml=before.length?`<section class="card"><div class="lbl">What we tried before this inquiry</div><div class="hint">The first steps the class tried and wrote down under What are you seeing?</div>
    ${before.map(t=>`<div class="pdir"><b>${esc(t.step)}</b>${has(t.happened)?`<div>${esc(t.happened)}</div>`:""}<div class="cnt">${esc([t.room?t.room+" class":"",t.by,t.at?shortDate(t.at):""].filter(has).join(", "))}</div></div>`).join("")}</section>`:"";
  const devHtml=`<section class="card"><div class="lbl">Could this fit this child's age and stage (developmental stage)?</div><div class="hint">Think about development first. ${esc(IB_DEV_NOTE)}</div>
    ${dir?`<textarea data-ibiqdev="1" rows="3">${esc(x.ibDev||"")}</textarea>`:has(x.ibDev)?`<p>${esc(x.ibDev)}</p>`:`<div class="cnt">The director writes this with the team.</div>`}</section>`;
  return `${triedHtml}${devHtml}<section class="card"><div class="lbl">What might this child be trying to get?</div><div class="hint">Choose one or more. These are the team's hypotheses and can change as we learn.</div>
    <div class="chips">${(ib.needs||[]).map(n=>`<button class="chip ${needs.includes(n)?"on":""}" type="button" aria-pressed="${needs.includes(n)}" data-ibiqneed="${esc(n)}" ${dir?"":"disabled"}>${esc(n)}</button>`).join("")}</div>
    <div class="lbl" style="margin-top:12px">Which senses or body systems might be asking for more, or for less?</div><div class="hint">Also a hypothesis. We describe what we see and never label a child.</div>
    ${dir?`<div class="seg" role="group" aria-label="More or less"><button data-ibiqmode="seek" aria-pressed="${mode==="seek"}">Seeking more</button><button data-ibiqmode="avoid" aria-pressed="${mode==="avoid"}">Finding it too much</button></div>`:""}
    <div class="chips">${(ib.supports||[]).map(n=>`<button class="chip ${sys[n]?"on":""}" type="button" aria-pressed="${!!sys[n]}" data-ibiqsys="${esc(n)}" ${dir?"":"disabled"}>${esc(sysLabel(n))}</button>`).join("")}</div>
    <div class="lbl" style="margin-top:12px">What might this child need from us?</div><div class="hint">Behavior often asks something of the adults. Choose what the team wonders about.</div>
    <div class="chips">${(ib.fromUs||[]).map(u=>`<button class="chip ${us.includes(u.name)?"on":""}" type="button" aria-pressed="${us.includes(u.name)}" data-ibiqus="${esc(u.name)}" ${dir?"":"disabled"}>${esc(u.name)}</button>`).join("")}</div>
    ${(ib.fromUs||[]).filter(u=>us.includes(u.name)).map(u=>`<p class="ibtip"><b>${esc(u.name)}.</b> ${esc(u.look)}</p>`).join("")}
    ${dir?"":`<div class="cnt">The director chooses these with the team.</div>`}</section>
    <section class="card"><div class="lbl">Possibilities to try</div><div class="hint">From the Idea bank, matched to what the team chose. Each shows why it connects. The team decides what to try, and what happens goes back into this inquiry.</div>
    ${rows.map(r=>ibRowHtml(r,r=>tried.has(r.card.id)?`<span class="cnt">In What we will try</span>`:VIEW_AS?"":`<button class="btn small" data-ibiqtry="${esc(r.card.id)}">We'll try this</button>`)).join("")||`<div class="cnt">Choose what the child might be trying to get, or a sense, and matching cards show here.</div>`}</section>`}
document.addEventListener("input",e=>{const t=e.target;if(!t.dataset||!t.dataset.ibiqdev||view!=="inquiries"||VIEW_AS||!isDirector())return;const x=inqId&&inquiries.get(inqId);if(!x)return;x.ibDev=t.value;saveInquirySoon(x)});
document.addEventListener("click",e=>{const t=e.target.closest("[data-ibiqneed],[data-ibiqsys],[data-ibiqmode],[data-ibiqtry],[data-ibiqus]");if(!t||view!=="inquiries")return;const x=inqId&&inquiries.get(inqId);if(!x)return;const d=t.dataset;
  if(VIEW_AS){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  if(d.ibiqtry){const c=ibCard(d.ibiqtry);if(!c||(x.tries||[]).some(o=>o.idea===c.id))return;const r=ibMatch(x.ibNeeds||[],x.ibSys||{},x.ibMode,40).find(y=>y.card.id===c.id);
    x.tries=[...(x.tries||[]),{id:uid(),text:c.title+", from the Idea bank."+(r&&r.why?" "+r.why:""),idea:c.id,by:whoAmI(),at:Date.now(),curriculum:false,result:""}];saveInquiry(x);renderMain();toast("Added to What we will try.");return}
  if(!isDirector())return;
  if(d.ibiqneed){const a=(x.ibNeeds||[]).slice(),i=a.indexOf(d.ibiqneed);if(i>=0)a.splice(i,1);else a.push(d.ibiqneed);x.ibNeeds=a}
  if(d.ibiqmode)x.ibMode=d.ibiqmode;
  if(d.ibiqus){const a=(x.ibUs||[]).slice(),i=a.indexOf(d.ibiqus);if(i>=0)a.splice(i,1);else a.push(d.ibiqus);x.ibUs=a}
  if(d.ibiqsys){const s=Object.assign({},x.ibSys||{}),mode=x.ibMode==="avoid"?"avoid":"seek";if(s[d.ibiqsys]===mode)delete s[d.ibiqsys];else s[d.ibiqsys]=mode;x.ibSys=s}
  saveInquirySoon(x);renderMain()});

/* ---------- Share, director only ----------
   A card's home side as an Instagram carousel draft through Share. A photo slot the director fills from our
   documentation, checked for faces as every post is, then What children are learning, Try it at home, Wonder together
   and a line inviting families to the family page, with a caption drafted from the same parts. Nothing posts until
   she does. */
function ideaShareParts(c){const hs={};for(const s of (c.home&&c.home.sections)||[])hs[s.h]=s;const learn=hs["What your child is learning"]?String(hs["What your child is learning"].text||""):"";
  const tries=hs["Ways to try it"]?(hs["Ways to try it"].items||[]).slice(0,3):[],wonder=hs["Wonder together"]?(hs["Wonder together"].items||[]).slice(0,2):[];
  const close="Find more ideas to try at home on our family page.";
  return {learn,tries,wonder,close,cards:[{h:"What children are learning",t:shSentences(learn,48),on:true},{h:"Try it at home",t:tries.join(" "),on:true},{h:"Wonder together",t:wonder.join(" "),on:true},{h:"Learning together",t:close,on:true}].filter(x=>has(x.t)),
    caption:[c.title,learn,"Try it at home.\n"+tries.map(t=>"• "+t).join("\n"),wonder.join(" "),close].filter(has).join("\n\n"),tags:"#reggioinspired #naturebasedlearning #learningthroughplay #playislearning #earlychildhoodeducation #santarosa #sonomacounty"}}
function ideaShare(c){if(!c.home){toast("Only a card with an At home side can be shared.");return}const P=ideaShareParts(c),src="idea:"+c.id;const ns=shareGather(src);
  if(shareMade)shareMade.urls.forEach(u=>URL.revokeObjectURL(u));shareMade=null;shareBusy.tried=false;shView=false;shStarting=false;
  shareSt={id:"post"+Date.now().toString(36),status:"draft",createdAt:Date.now(),src,one:true,pick:"",ids:ns.map(n=>n.id),off:[],add:[],titleOn:true,title:c.title,linesOn:false,menuOn:false,farmsOn:false,lines:{},quote:"",quotePhoto:"none",wordsOn:false,words:{},cardsOn:true,cards:P.cards,caption:P.caption,tags:P.tags,at:Date.now()};
  shareSave();goView("share");shareCheckFaces()}
window.TREE_IDEA_SHARE=id=>{const c=ibCard(id);if(c)ideaShare(c)};

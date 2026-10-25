/* ---------- Educator growth in TREE ----------
   The growth continuum and scores, the end of year evaluation, the self-assessment and the starting-point conversation,
   the Educator Reflection and Growth Plan, the reflective journal, the monthly check-ins, Proud Moments and Kudos, the
   PD library's modules and PD days. It sits after the Educators pages in tree-staff.js, loaded only when opened, and
   shares their helpers. The server decides who receives each record. It never shows counts or tallies. */
(function(){
"use strict";
const T=window.TreeStaff,X=T._;const Gr={};window.TreeGrowth=Gr;
const {api,fail,H,card,chip,head,md,report,out,fd,fms,today,meName,D}=X;
Gr.views=["stgrow","stplan","stjour","stci","stmom","stpdd"];
const ga=(p,b)=>api("g/"+p,b||{});
const st={boot:null,docs:{},sel:"",tab:"",view:"",self:false,editCont:false,jr:null,jrWho:"",moments:null,mform:{kind:"moment",audience:"everyone"},pd:null,pdSel:"",pdEdit:null,mods:null,ci:null,ciWho:"",readings:null,starting:false,examplesPick:null,searching:false};
Gr.st=st;
let bootP=null;
Gr.ready=()=>{if(!(X.boot()&&X.boot().can&&X.boot().can.growth))return Promise.resolve(null);bootP=bootP||ga("boot").then(b=>{st.boot=b;return b}).catch(e=>{bootP=null;throw e});return bootP};
const B=()=>st.boot;
const areaName=k=>((B().areas||[]).find(a=>a[0]===k)||[])[1]||"";
const AK=()=>(B().areas||[]).map(a=>a[0]);
const cont=()=>B().continuum||{areas:[],points:[]};
const contArea=k=>(cont().areas||[]).find(a=>a.k===k)||{points:[]};
const PN=["","Beginning","Developing","Established","Mentoring"];
const modTitle=s=>((B().modules||[]).find(m=>m.slug===s)||{}).title||"";
const modReady=s=>((B().modules||[]).find(m=>m.slug===s)||{}).ready;
const yr=()=>B().year;const yrLabel=y=>`${y} to ${+y+1}`;
const isDir=()=>D();
async function doc(name,force){if(!st.docs[name]||force)st.docs[name]=await ga("mine",{name});return st.docs[name]}
const setDoc=(name,d)=>{st.docs[name]=d;return d};
const who=()=>isDir()?st.sel:meName();
// the journal being read: the director reads an educator's as a partner, or writes in her own, which only she reads
const jWho=()=>isDir()&&st.jself?meName():who();
const seg=(attr,opts,cur)=>`<div class="tseg" role="group">${opts.map(([v,l])=>`<button ${attr}="${H(v)}" aria-pressed="${String(cur)===String(v)}">${H(l)}</button>`).join("")}</div>`;
const pills=(attr,list,cur)=>`<div class="actions" style="margin:0 0 10px;flex-wrap:wrap">${list.map(n=>`<button class="pill" aria-pressed="${n===cur}" data-${attr}="${H(n)}">${H(n)}</button>`).join("")}</div>`;
const draw=(my,h)=>X.draw(my,h);
const redraw=()=>X.redraw();

/* ---------- looks ---------- */
if(!document.getElementById("growcss")){const c=document.createElement("style");c.id="growcss";c.textContent=`
.gpts{display:grid;gap:6px;grid-template-columns:repeat(4,minmax(0,1fr))}.gpt{border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--paper);font-size:13.5px;line-height:1.45;text-align:left;color:var(--ink);cursor:default}
button.gpt{cursor:pointer;font:inherit;display:flex;flex-direction:column;justify-content:flex-start}.gpt b{display:block;font-size:12.5px;margin-bottom:3px}.gpt.on{border-color:var(--moss);box-shadow:0 0 0 2px var(--moss);background:#eef5f0}.gpt.next{border-style:dashed;border-color:var(--marigold)}
.gpt.dir{box-shadow:inset 0 -4px 0 var(--marigold)}
@media (max-width:760px){.gpts{grid-template-columns:1fr}}
.garea{border-top:1px solid var(--line);padding:12px 0}.garea:first-of-type{border-top:0}
.gex{display:grid;gap:4px;margin-top:6px}.gex .cnt{line-height:1.45}
.gscore{font-size:22px;font-weight:700;color:var(--moss)}.gnys{font-size:13px;color:var(--muted)}
.gcols{display:grid;gap:10px;grid-template-columns:1fr 1fr}@media (max-width:640px){.gcols{grid-template-columns:1fr}}
.gq{border-left:3px solid var(--moss);padding:2px 0 2px 10px;margin:8px 0}
.gblock{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--paper);display:grid;gap:6px}
.gsug{border:1px dashed var(--line);border-radius:10px;padding:8px 10px;display:grid;gap:4px}
.gmom{border-top:1px solid var(--line);padding:10px 0;display:grid;gap:4px}.gmom img{max-width:min(320px,100%);border-radius:8px}
.gtrend svg{width:100%;max-width:420px;height:70px}
.gscroll{max-width:100%;overflow-x:auto}
`;document.head.appendChild(c)}

/* ---------- examples from an educator's own work, never counted ---------- */
const clip=(s,n)=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n).replace(/\s+\S*$/,"")+"…":s};
const byIs=(x,n)=>String(x||"").toLowerCase()===String(n||"").toLowerCase();
const tsOf=p=>p.updatedAt||Date.parse((p.weekOf||"")+"T12:00:00")||0;
function workOf(name,since){since=since||0;const room=(st.docs[name]&&st.docs[name].profile||{}).room||"";
  const obs=[...notices.values()].filter(n=>n&&!n.deleted&&byIs(n.by,name)&&(n.at||0)>=since).sort((a,b)=>(b.at||0)-(a.at||0));
  const pl=[...plans.values()].filter(p=>p&&!p.blank&&p.id!=="example"&&byIs(p.educator,name)&&tsOf(p)>=since).sort((a,b)=>tsOf(b)-tsOf(a));
  const sl=[...slides.values()].filter(x=>x&&byIs(x.by,name)&&(x.at||0)>=since).sort((a,b)=>(b.at||0)-(a.at||0));
  const sto=[...stories.values()].filter(x=>x&&byIs(x.by,name)&&(x.at||0)>=since).sort((a,b)=>(b.at||0)-(a.at||0));
  const roomPlans=[...plans.values()].filter(p=>p&&!p.blank&&p.type==="classroom"&&room&&p.classroom===room&&tsOf(p)>=since).sort((a,b)=>tsOf(b)-tsOf(a));
  const roomThreads=[...threads.values()].filter(t=>t&&room&&(t.classroom||t.room)===room&&(t.updatedAt||0)>=since);
  const inq=[...inquiries.values()].filter(x=>x&&JSON.stringify(x).toLowerCase().includes(`"by":"${String(name).toLowerCase()}"`));
  const conf=[...conferences.values()].filter(c=>c&&byIs(c.teacher,name));
  return {obs,pl,sl,sto,roomPlans,roomThreads,inq,conf}}
const exObs=n=>({kind:"obs",id:n.id,label:clip(n.noticed,140),when:n.at?fms(n.at):"",open:`data-obsgo="${H(n.id)}"`});
const planName=p=>({individual:"Individual plan",classroom:"Classroom plan",smallgroup:"Small Group plan"}[p.type]||"Plan");
const exPlan=(p,f)=>({kind:"plan",id:p.id,label:`${planName(p)}${(p.groups||[]).length?", "+p.groups.join(" and "):p.group?", "+p.group:""}, week of ${fd(p.weekOf)}${f?". "+clip((p.fields||{})[f],110):""}`,when:""});
const exSlide=x=>({kind:"slide",id:x.id,label:"Documentation slide, "+clip(x.title||x.text,110),when:x.at?fms(x.at):""});
const exStory=x=>({kind:"story",id:x.id,label:"Story, "+clip(x.title,110),when:x.at?fms(x.at):""});
const exThread=t=>({kind:"thread",id:t.id,label:"Thread, "+clip(t.name,110),when:""});
const exInq=x=>({kind:"inquiry",id:x.id,label:"Team inquiry, "+clip(x.name,110),when:""});
function examplesFor(name,area,since){const w=workOf(name,since);const d=st.docs[name]||{};const pr=d.profile||{};const L=[];const add=(xs,f,n)=>xs.slice(0,n).forEach(x=>L.push(f(x)));
  const moments=(st.moments||[]).filter(m=>(byIs(m.by,name)&&m.kind==="moment"&&m.area===area)||(m.kind==="kudos"&&byIs(m.to,name)&&area==="team")).slice(0,2).map(m=>({kind:"moment",id:m.id,label:(m.kind==="kudos"?"Kudos from "+m.by+", ":"Proud moment, ")+clip(m.text,110),when:fms(m.at)}));
  if(area==="img"){add(w.obs.filter(n=>String(n.wonder||"").trim()),n=>Object.assign(exObs(n),{label:"Wondering. "+clip(n.wonder,130)}),2);add(w.pl.filter(p=>(p.fields||{}).remarks),p=>exPlan(p,"remarks"),1);add(w.inq,exInq,1)}
  if(area==="env"){add(w.pl.filter(p=>(p.fields||{}).materials||(p.fields||{}).provocation),p=>exPlan(p,(p.fields||{}).provocation?"provocation":"materials"),2);add(w.obs.filter(n=>n.photo),exObs,1);add(w.sl,exSlide,1)}
  if(area==="lang"){add(w.obs,exObs,2);add(w.inq,exInq,1);(d.checkins||[]).filter(c=>c.focus&&c.focus.area==="lang").slice(0,1).forEach(c=>L.push({kind:"focus",id:c.id,label:"Focus Until Next Time, "+clip(c.focus.settled,110),when:fd(c.date)}))}
  if(area==="obs"){add(w.obs,exObs,2);add(w.sl,exSlide,1);add(w.sto,exStory,1)}
  if(area==="cur"){const sg=pr.curriculumFrom==="smallgroup";const own=sg?w.pl.filter(p=>p.focus==="smallgroup"||p.type==="smallgroup"||(p.groups||[]).length):w.pl;
    if(own.length)add(own,p=>exPlan(p,p.fields&&p.fields.intent?"intent":"remarks"),3);
    // for roles that do not write plans, this area reads from contributions to the team's plans and threads
    else{add(w.roomPlans,p=>Object.assign(exPlan(p),{label:"The team's "+exPlan(p).label}),2);add(w.roomThreads,exThread,1)}}
  if(area==="fam"){add(w.conf,c=>({kind:"conf",id:c.id||"",label:`Family conference, ${c.term||""} ${c.schoolYear||""}`.trim(),when:c.confDate?fd(c.confDate):""}),2);add(w.inq,exInq,1)}
  if(area==="team"){add(w.roomPlans,p=>Object.assign(exPlan(p),{label:"The team's "+exPlan(p).label}),1);add(w.inq,exInq,1)}
  if(area==="refl"){(d.checkins||[]).filter(c=>c.focus&&c.focus.settled).slice(0,2).forEach(c=>L.push({kind:"focus",id:c.id,label:"Focus Until Next Time, "+clip(c.focus.settled,110)+(c.followed?". Tried":""),when:fd(c.date)}));
    Object.entries(d.modules||{}).filter(([,m])=>m&&m.reflection).slice(0,2).forEach(([k,m])=>L.push({kind:"module",id:k,label:modTitle(k)+", reflection. "+clip(m.reflection,100),when:m.done?fms(m.done):""}))}
  return [...L,...moments].slice(0,5)}
const exHtml=xs=>xs.length?`<div class="gex">${xs.map(x=>`<div class="cnt">${x.open?`<button class="linkbtn" ${x.open} style="text-align:left">${H(x.label)}</button>`:H(x.label)}${x.when?` <span class="muted">${H(x.when)}</span>`:""}</div>`).join("")}</div>`:`<div class="cnt">Examples appear here as work is kept in TREE.</div>`;

/* ---------- the continuum ---------- */
function pointsHtml(k,opts){opts=opts||{};const a=contArea(k);const mine=!!opts.mine;
  return `<div class="gpts">${a.points.map((p,i)=>{const n=i+1;const on=opts.on===n,dirOn=opts.dir===n,next=opts.next===n;const tag=opts.tap?"button":"div";
    return `<${tag} class="gpt ${on?"on":""} ${dirOn?"dir":""} ${next?"next":""}" ${opts.tap?`type="button" ${opts.tap}="${k}|${n}" aria-pressed="${on}"`:""}><b>${n} ${PN[n]}${next?", the next step":""}</b>${H(mine?p.mine:p.text)}</${tag}>`}).join("")}</div>`}

/* ---------- scores ---------- */
const numeric=v=>[1,2,3,4].includes(+v)&&v!=="nys"?+v:0;
function scoresOf(d,y){const ev=(d.evals||{})[y]||{};const lighter=d.profile&&d.profile.lighter;
  // the atelierista's own placements are her scores
  const src=lighter?((ev.self||{}).placements||{}):((ev.dir||{}).placements||{});const out={};
  for(const k of AK()){const v=src[k];out[k]=v==="nys"?"nys":numeric(v)}
  const nums=Object.values(out).filter(v=>v&&v!=="nys");return {by:out,overall:nums.length?Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*10)/10:0,any:nums.length>0||Object.values(out).includes("nys")}}
const scoreCell=v=>v==="nys"?`<span class="gnys">Not yet seen</span>`:v?`<span class="gscore">${v}</span> <span class="cnt">${PN[v]}</span>`:`<span class="cnt">No score yet</span>`;

/* ---------- pages ---------- */
Gr.render=async function(v,my){await Gr.ready();if(!B()){draw(my,head("Educators","Growth")+card("Not open yet",`<div class="hint">Growth opens once the director turns it on in Settings.</div>`));return}
  st.view=v;
  try{st.moments=st.moments||(X.boot().me&&X.boot().me.newHire?[]:(await ga("moments")).list)}catch(e){st.moments=[]}
  if(v==="stgrow")return isDir()&&!st.sel?growList(my):growPage(my);
  if(v==="stplan")return planPage(my);
  if(v==="stjour")return journalPage(my);
  if(v==="stci")return checkinPage(my);
  if(v==="stmom")return momentsPage(my);
  if(v==="stpdd")return pdPage(my)};

/* the director's view of every educator */
async function growList(my){const all=(await ga("all")).people;all.forEach(d=>setDoc(d.name,d));const y=yr();
  if(st.editCont)return contEditor(my);
  const rows=all.map(d=>{const pl=(d.plans||{})[y];const ev=(d.evals||{})[y]||{};const pr=d.profile||{};const tr=(d.trend||[]).slice(-6);
    const started=pl&&(String(((pl.wentWell||{}).text)||"").trim()||(pl.goals||[]).some(x=>String(x.text||"").trim()));
    const startDue=pr.startDate&&X.daysTo(pr.startDate,today())<365&&!(d.starting&&d.starting.done)?X.addMonths(pr.startDate,2):"";
    return `<tr data-gsel="${H(d.name)}" style="cursor:pointer"><td><b>${H(d.name)}</b><div class="cnt">${H([pr.room?pr.room+" Class":"",pr.role==="apprentice"?"Apprentice":""].filter(Boolean).join(", "))}</div></td>
      <td>${started?chip("ok","Started"):pl?chip("missing","Blank, to fill in TREE"):chip("missing","Not entered yet")}</td>
      <td>${ev.self&&ev.self.done?chip("ok","Self-assessment done"):""} ${ev.dir&&ev.dir.done?chip("ok","Your placements done"):""} ${ev.meeting?chip("ok","Met"):""}</td>
      <td>${startDue?chip(startDue<=today()?"soon":"soonish",(startDue<=today()?"Starting point due ":"Starting point ")+fd(startDue)):""}</td>
      <td class="gtrend">${tr.length?trendSvg(tr,true):`<span class="cnt">No check-in yet</span>`}</td></tr>`}).join("");
  draw(my,head("Educators","Growth",`Each educator's growth, Growth Plan, check-ins and evaluation. ${X.boot().open.growth?"Educators see their own.":"Only you see these pages until you turn on growth in Settings."} Tap an educator to open theirs.`)+
    card("Every educator",`<div class="tablewrap"><table class="grid2" style="min-width:760px"><thead><tr><th>Educator</th><th>Growth Plan</th><th>End of year</th><th>New educator</th><th>Temperature and alignment</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="hint" style="margin-top:6px">The trend shows the educator's temperature in green, yours in gold and team alignment in grey, from monthly check-ins. It is a support trend and never touches scores.</div>`)+
    card("The continuum's words",`<div class="hint">At each August PD day, educators read the descriptions together and suggest changes. You approve the final words, and TREE updates them for the year.</div><div class="actions"><button class="btn small ghost" data-gcont="1">Edit the words for ${H(yrLabel(yr()))}</button></div>`))}
function trendSvg(tr,small){const W=small?160:420,Hh=small?40:70,n=tr.length;const x=i=>n<2?W/2:8+i*(W-16)/(n-1);const y=v=>v?Hh-6-(v-1)*(Hh-12)/4:null;
  const line=(k,c)=>{const pts=tr.map((t,i)=>y(t[k])==null?null:`${x(i)},${y(t[k])}`).filter(Boolean);return pts.length?`<polyline fill="none" stroke="${c}" stroke-width="2" points="${pts.join(" ")}"/>${tr.map((t,i)=>y(t[k])==null?"":`<circle cx="${x(i)}" cy="${y(t[k])}" r="2.5" fill="${c}"/>`).join("")}`:""};
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Temperature and alignment over time" style="max-width:${W}px;height:${Hh}px">${line("align","#9aa19a")}${line("dir","#c8922a")}${line("self","#3d6b4f")}</svg>`}

/* one educator's growth, the educator's own or, for the director, anyone's */
async function growPage(my){const name=who();const d=await doc(name,true);const y=yr();const dir=isDir();const pr=d.profile||{};
  if(st.self&&!dir)return selfPage(my,d);
  if(st.starting&&dir)return startingPage(my,d);
  const pl=(d.plans||{})[y]||{};const ev=(d.evals||{})[y]||{};const met=!!(ev.meeting&&ev.meeting.at);
  const pref=pl.feedback&&pl.feedback!=="conversation"?pl.feedback:"scores";const viewK=st.tab||(pl.feedback==="conversation"?"narrative":pref);
  const tabs=[["scores","Scores"],["continuum","Continuum"],["narrative","Narrative"],["notes","Written notes"]];
  const past=Object.keys(d.evals||{}).filter(k=>k<y).sort();
  const sc=scoresOf(d,y);const showScores=met||pr.lighter;
  const self=(ev.self||{}).placements||{};const dirP=(ev.dir||{}).placements||{};
  const newEd=pr.startDate&&X.daysTo(pr.startDate,today())<365;
  let body="";
  if(viewK==="scores"){
    const cols=[...past.map(p=>[p,yrLabel(p)]),[y,yrLabel(y)]];
    body=`<div class="hint">The score for an area is the number of the continuum point, from 1 to 4. Established is the expectation for an experienced educator here, and Mentoring is not expected of everyone.${newEd?" New educators commonly sit at 1 or 2 in their first year.":""}</div>
      ${showScores||past.length?`<div class="tablewrap"><table class="grid2" style="min-width:${360+cols.length*120}px"><thead><tr><th>Area</th>${cols.map(c=>`<th>${H(c[1])}</th>`).join("")}<th>${dir?"Their":"Your"} own placement</th></tr></thead><tbody>
      ${AK().map(k=>`<tr><td><b>${H(areaName(k))}</b></td>${cols.map(([cy])=>{const s=scoresOf(d,cy);const vis=cy!==y||showScores;return `<td>${vis?scoreCell(s.by[k]):`<span class="cnt">At the end of the year</span>`}</td>`}).join("")}<td>${self[k]?`${self[k]} <span class="cnt">${PN[self[k]]}</span>`:`<span class="cnt">Not placed yet</span>`}</td></tr>`).join("")}
      <tr><td><b>Overall</b><div class="cnt">The average of the areas that were scored</div></td>${cols.map(([cy])=>{const s=scoresOf(d,cy);const vis=cy!==y||showScores;return `<td>${vis&&s.overall?`<span class="gscore">${s.overall}</span>`:""}</td>`}).join("")}<td></td></tr></tbody></table></div>`
      :`<div class="cnt" style="margin-top:6px">Scores come with the end of year evaluation. ${newEd?"In the first year there are no scores until then.":"Until then each area shows the continuum and examples from "+(dir?"their":"your")+" own work."}</div>`}
      ${showScores?`<div class="cnt" style="margin-top:6px">Each score sits beside the narrative and ${dir?"the educator's":"your"} own placement, never alone. When an area shows Not yet seen, there was too little evidence to judge, so a gap in evidence never reads as a low score.</div>`:""}`}
  if(viewK==="continuum")body=`<div class="hint">What each point looks like in daily work at our school, so ${dir?"the educator":"you"} can see where ${dir?"they are":"you are"} and what the next step looks like. The points describe practice. They never describe the person.</div>
    ${AK().map(k=>{const cur=showScores&&numeric(sc.by[k])?numeric(sc.by[k]):numeric(self[k]);return `<div class="garea"><b>${H(areaName(k))}</b>${(cont().notes||{})[k]?`<div class="cnt">${H(cont().notes[k])}</div>`:""}
      <div style="margin-top:6px">${pointsHtml(k,{on:cur||0,dir:met&&numeric(dirP[k])&&!pr.lighter?numeric(dirP[k]):0,next:cur&&cur<4?cur+1:0})}</div>
      <details style="margin-top:6px"><summary class="cnt">Examples from ${dir?"their":"your"} own work</summary>${exHtml(examplesFor(name,k))}</details></div>`}).join("")}`;
  if(viewK==="narrative"){const dv=ev.dir||{};body=met||pr.lighter&&met?`${dv.strengths?`<h4 style="margin:4px 0">Strengths</h4>${md(dv.strengths)}`:""}${dv.narrative?`<h4 style="margin:10px 0 4px">Growth across the year</h4>${md(dv.narrative)}`:""}${AK().filter(k=>(dv.notes||{})[k]).map(k=>`<div class="gq"><b>${H(areaName(k))}</b>${md(dv.notes[k])}</div>`).join("")}${!dv.narrative&&!dv.strengths?`<div class="cnt">The narrative is written at the end of the year.</div>`:""}`
      :`<div class="cnt">${dir?"Your narrative is written in the evaluation below and shared during the meeting.":"The director's narrative comes with the end of year evaluation, during your meeting, with story and example."}${pl.feedback==="conversation"?" You said you take in feedback best in conversation, so it is talked through together first.":""}</div>`;
    past.forEach(p=>{const dv2=((d.evals||{})[p]||{}).dir||{};if(dv2.narrative)body+=`<details style="margin-top:10px"><summary class="cnt">${H(yrLabel(p))}</summary>${md(dv2.narrative)}</details>`})}
  if(viewK==="notes"){const cis=(d.checkins||[]).filter(c=>(c.focus&&c.focus.settled)||c.followup);
    body=`<div class="hint">Written notes to read whenever ${dir?"they like":"you like"}, away from the children.</div>${cis.length?cis.map(c=>`<div class="garea"><b>Check-in, ${H(fd(c.date))}</b>${c.focus&&c.focus.settled?`<div class="gq"><div class="cnt">Focus Until Next Time${c.focus.area?", "+H(areaName(c.focus.area)):""}</div>${md(c.focus.settled)}</div>`:""}${c.followup?`<div class="cnt">Follow-up notes</div>${md(c.followup)}`:""}</div>`).join(""):`<div class="cnt">Notes from check-ins appear here.</div>`}`}
  const tabsHtml=`<div class="actions" style="margin:0 0 8px">${seg("data-gtab",tabs,viewK)}</div>${!pl.feedback?`<div class="cnt" style="margin-bottom:6px">${dir?"They have not chosen how they take in feedback best yet, so this opens in the scores view.":"Choose how you take in feedback best in your Growth Plan, and this opens in that view first."} Every view is one tap away.</div>`:`<div class="cnt" style="margin-bottom:6px">Opens in ${H({scores:"the scores view",continuum:"the continuum view",narrative:"the narrative",conversation:"the narrative, talked through together first",notes:"written notes"}[pl.feedback])}, as ${dir?"they":"you"} chose in the Growth Plan. Every view is one tap away.</div>`}`;
  const people=dir?B().people.map(p=>p.name):[];
  let h=head(dir?"Growth":"My growth",dir?name+", growth":"My growth",dir?`Only ${H(name)} and you see this page.`:"Where your practice stands in the eight areas, in the form that makes sense to you. Only you and the director see it.");
  if(dir)h+=`<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gsel="">‹ All educators</button></div>`+pills("gsel",people,name);
  // the starting-point conversation for a new educator, with no scores
  if(newEd&&!(d.starting&&d.starting.done)){const due=pr.startDate?X.addMonths(pr.startDate,2):"";h+=card("Starting-point conversation",`<div class="cnt">Two months after ${dir?"a new educator starts":"you start"}, ${dir?"you meet":"you and the director meet"} for a starting-point conversation. ${dir?"You place them":"You place yourself"} on the continuum together and finish ${dir?"their":"your"} Growth Plan goals. There are no scores until the end of the year.${due?` ${due<=today()?"It is due now":"It is scheduled for "+H(fd(due))}${due<=today()?", from the start date "+H(fd(pr.startDate))+".":"."}`:""}</div>${dir?`<div class="actions"><button class="btn small" data-gstart="1">Open the starting-point conversation</button></div>`:""}`,due&&due<=today()?chip("soon","Due now"):"")}
  else if(d.starting&&d.starting.done&&d.starting.shared)h+=card("Starting point",`<div class="cnt">From the starting-point conversation, ${H(fd(new Date(d.starting.done).toISOString().slice(0,10)))}. These are not scores.</div>${AK().filter(k=>(d.starting.placements||{})[k]).map(k=>`<div class="cnt"><b>${H(areaName(k))}</b>, ${PN[d.starting.placements[k]]}</div>`).join("")}`);
  h+=card("Where "+(dir?"they stand":"you stand"),tabsHtml+body,`<span class="actions" style="margin:0"><button class="btn small ghost" data-gprint="eval">Print</button><button class="linkbtn" data-gword="eval">Word</button></span>`);
  // the talks and sessions led, from Presenting entries marked presented
  if((d.led||[]).length)h+=card(dir?"What they led":"What I led",d.led.map(x=>`<div class="cnt"><b>${H(x.title)}</b>${x.audience?", for "+H(x.audience):""}${x.date?", "+H(fd(x.date)):""}${x.minutes?", "+H(dur(+x.minutes)):""}</div>`).join(""));
  // the self-assessment, the director's own placements and the meeting
  h+=evalCards(d,name,ev,met);
  draw(my,h)}

function evalCards(d,name,ev,met){const dir=isDir(),pr=d.profile||{};const self=ev.self||{},dv=ev.dir||{};let h="";
  if(!dir){h+=card("Self-assessment",`<div class="cnt">Before the end of year evaluation, you place yourself on the continuum. It takes about twenty minutes. You tap the point where you see your practice now and write about two or three areas you choose.${pr.lighter?" Your own placements become your scores, and the director adds a short narrative.":""}</div>
    <div class="actions">${self.done?chip("ok","Done "+fms(self.done)):self.at?chip("soonish","Started"):""}<button class="btn small ${self.done?"ghost":""}" data-gself="1">${self.at?"Open my self-assessment":"Place myself on the continuum"}</button></div>`)}
  else{h+=card(pr.lighter?"Her placements and your narrative":"Your placements",`<div class="hint">${pr.lighter?"After thirteen years as atelierista, her evaluation is lighter. She places herself on the continuum, her own placements become her scores, and you add a short narrative.":"Complete your own placements without seeing theirs. Each score is the number of the continuum point, from 1 to 4, or Not yet seen when evidence is thin."}</div>
    ${self.done?`<div class="cnt">${H(name)} finished the self-assessment ${H(fms(self.done))}.${pr.lighter?"":" Their placements stay hidden from you here until the meeting view opens."}</div>`:`<div class="cnt">${H(name)} has not finished the self-assessment yet.</div>`}
    ${pr.lighter?AK().map(k=>`<div class="garea"><b>${H(areaName(k))}</b> ${self.placements&&self.placements[k]?`<span class="cnt">${self.placements[k]}, ${PN[self.placements[k]]}</span>`:`<span class="cnt">Not placed yet</span>`}</div>`).join(""):AK().map(k=>{const v=(dv.placements||{})[k];return `<div class="garea"><b>${H(areaName(k))}</b><div style="margin-top:6px">${pointsHtml(k,{on:numeric(v),tap:"data-gdir"})}</div>
      <div class="actions" style="margin:6px 0 0"><button class="pill" aria-pressed="${v==="nys"}" data-gdir="${k}|nys">Not yet seen</button></div>
      <label class="fld-label">A note for this area, optional<textarea rows="2" data-gdirnote="${k}">${H((dv.notes||{})[k]||"")}</textarea></label>
      <details><summary class="cnt">Examples from their own work</summary>${exHtml(examplesFor(name,k))}</details></div>`}).join("")}
    <label class="fld-label">Strengths${pr.lighter?"":", drawn from their Proud Moments, Kudos and the areas you both placed highest"}<textarea rows="3" id="g-strengths">${H(dv.strengths||strengthsDraft(d))}</textarea></label>
    <label class="fld-label">${pr.lighter?"A short narrative":"Your narrative, growth across the year"}<textarea rows="${pr.lighter?4:7}" id="g-narr">${H(dv.narrative||"")}</textarea></label>
    <div class="actions"><button class="btn small ghost" data-gdirsave="0">Save</button><button class="btn small" data-gdirsave="1">${dv.done?"Save, placements done":"My placements are done"}</button>${met?chip("ok","Meeting view open"):`<button class="btn small ghost" data-gmeet="1">Open the meeting view</button>`}</div>
    <div class="cnt">${met?`${H(name)} sees both placements side by side now.`:`The educator first sees your placements during the meeting, when you open the meeting view.`}</div>`)}
  if(met||(dir&&self.done&&dv.done)){
    h+=card("Side by side",`<div class="hint">The conversation begins where the two views meet and where they differ.</div>${AK().map(k=>{const a=(self.placements||{})[k],b=(dv.placements||{})[k];return `<div class="garea"><b>${H(areaName(k))}</b><div class="gcols" style="margin-top:4px"><div class="cnt">${dir?"Their":"Your"} placement, ${a?`${a} ${PN[a]}`:"not placed"}</div><div class="cnt">${pr.lighter?"":dir?"Your placement, ":"The director's placement, "}${pr.lighter?"":b==="nys"?"Not yet seen":b?`${b} ${PN[b]}`:"not placed"}</div></div>${(self.writes||{})[k]?`<div class="gq">${md(self.writes[k])}</div>`:""}</div>`}).join("")}${self.closing?`<h4 style="margin:10px 0 4px">Where ${dir?"they want":"I want"} to grow next year</h4>${md(self.closing)}`:""}`);
    const goals=ev.goals||[];
    h+=card("Next year's goals",`<div class="hint">${dir?"The educator names":"Name"} two or three goals for next year. They carry into ${dir?"their":"your"} next Educator Reflection and Growth Plan, so each year begins where the last one ended.</div>${[0,1,2].map(i=>`<label class="fld-label">Goal ${i+1}<textarea rows="2" data-gnext="${i}">${H((goals[i]||{}).text||"")}</textarea></label>`).join("")}<div class="actions"><button class="btn small" data-gnextsave="1">Save the goals</button>${goals.length?chip("ok","In next year's Growth Plan"):""}</div>`)}
  return h}
function strengthsDraft(d){const y=yr();const ev=(d.evals||{})[y]||{};const s=(ev.self||{}).placements||{},b=(ev.dir||{}).placements||{};
  const both=AK().filter(k=>numeric(s[k])&&numeric(b[k]));const hi=both.length?Math.max(...both.map(k=>Math.min(s[k],b[k]))):0;
  const top=both.filter(k=>Math.min(s[k],b[k])===hi&&hi>=2).map(areaName);
  const ms=(st.moments||[]).filter(m=>(byIs(m.by,d.name)&&m.kind==="moment")||(m.kind==="kudos"&&byIs(m.to,d.name))).slice(0,3).map(m=>(m.kind==="kudos"?"Kudos from "+m.by+". ":"")+clip(m.text,160));
  return [top.length?"Where we both placed you highest. "+top.join(", ")+".":"",...ms].filter(Boolean).join("\n\n")}

/* the self-assessment, in the first person */
async function selfPage(my,d){const y=yr();const ev=(d.evals||{})[y]||{};const s=Object.assign({placements:{},writes:{},examples:{},closing:""},ev.self||{});st.selfDraft=st.selfDraft||JSON.parse(JSON.stringify(s));const sd=st.selfDraft;
  const chosen=Object.keys(sd.writes||{});
  const opts=k=>examplesFor(d.name,k).filter(x=>x.id);
  let jr="";try{if(st.jr&&st.jrWho===d.name)jr=st.jr.entries.filter(e=>e.bring&&e.bring.self).map(e=>`<div class="gq"><div class="cnt">From your journal, ${H(fd(e.date))}</div>${["joy","challenge","connection","language"].filter(k=>e[k]).map(k=>`<div class="cnt">${H(e[k])}</div>`).join("")}</div>`).join("")}catch(e){}
  draw(my,head("My growth","Self-assessment","About twenty minutes. For each area, tap the point where you see your practice now. Then write about two or three areas you choose, with an example from your own work if you like.")+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gselfback="1">‹ My growth</button></div>`+
    card("Where I see my practice now",AK().map(k=>`<div class="garea"><b>${H(areaName(k))}</b><div style="margin-top:6px">${pointsHtml(k,{mine:true,on:numeric(sd.placements[k]),tap:"data-gselfpt"})}</div>
      <div class="actions" style="margin:6px 0 0"><label class="radio"><input type="checkbox" data-gwrite="${k}" ${chosen.includes(k)?"checked":""}><span>I will write about this area</span></label></div>
      ${chosen.includes(k)?`<label class="fld-label">In my own words<textarea rows="3" data-gselfw="${k}">${H(sd.writes[k]||"")}</textarea></label>
        ${opts(k).length?`<label class="fld-label">An example from my own work, if I like<select data-gselfex="${k}"><option value="">None</option>${opts(k).map(x=>`<option value="${H(x.kind+"|"+x.id)}" ${((sd.examples||{})[k]||[]).some(e=>e.id===x.id)?"selected":""}>${H(x.label)}</option>`).join("")}</select></label>`:""}`:""}</div>`).join(""),chosen.length>3?`<span class="warnline">Two or three areas is enough</span>`:"")+
    (jr?card("Brought from my journal",jr):"")+
    card("One closing question",`<label class="fld-label">Where do I want to grow next year?<textarea rows="3" id="g-closing">${H(sd.closing||"")}</textarea></label>
      <div class="actions"><button class="btn small ghost" data-gselfsave="0">Save for now</button><button class="btn" data-gselfsave="1">${ev.self&&ev.self.done?"Save":"I am done"}</button></div>
      <div class="cnt">The director completes their own placements without seeing yours, and you first see the director's placements during the meeting, side by side.</div>`));}

/* the starting-point conversation, for the director */
function startingPage(my,d){const s=Object.assign({placements:{},notes:""},d.starting||{});st.startDraft=st.startDraft||JSON.parse(JSON.stringify(s));const sd=st.startDraft;
  draw(my,head("Growth","Starting-point conversation, "+d.name,"You place them on the continuum together and finish their Growth Plan goals. There are no scores until the end of the year. They can bring their go-to person into the conversation if they like.")+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gstartback="1">‹ ${H(d.name)}, growth</button></div>`+
    card("Placed together",AK().map(k=>`<div class="garea"><b>${H(areaName(k))}</b><div style="margin-top:6px">${pointsHtml(k,{on:numeric(sd.placements[k]),tap:"data-gstartpt"})}</div><details><summary class="cnt">Examples from their own work</summary>${exHtml(examplesFor(d.name,k))}</details></div>`).join(""))+
    card("Notes",`<label class="fld-label">What you talked about<textarea rows="4" id="g-startnotes">${H(sd.notes||"")}</textarea></label>
      <div class="actions"><button class="btn small ghost" data-gstartsave="0">Save</button><button class="btn small" data-gstartsave="1">The conversation is done, share with them</button><button class="btn small ghost" data-tview="stplan">Their Growth Plan goals</button></div>`))}

/* the continuum's words, edited by the director after the August PD day */
function contEditor(my){const c=cont();
  draw(my,head("Growth","The continuum's words, "+yrLabel(yr()),"Educators read the descriptions together at the August PD day and suggest changes. You approve the final words here. The second box for each point is how it reads in the self-assessment, in the first person.")+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gcont="0">‹ Growth</button></div>`+
    (c.areas||[]).map(a=>card(a.name,a.points.map((p,i)=>`<div class="garea"><b>${i+1} ${PN[i+1]}</b><label class="fld-label">As the director reads it<textarea rows="3" data-gct="${a.k}|${i}|text">${H(p.text)}</textarea></label><label class="fld-label">In the self-assessment<textarea rows="3" data-gct="${a.k}|${i}|mine">${H(p.mine)}</textarea></label></div>`).join(""))).join("")+
    `<div class="actions"><button class="btn" data-gcontsave="1">Approve these words for ${H(yrLabel(yr()))}</button></div>`)}

/* ---------- the Educator Reflection and Growth Plan ---------- */
const AREA_WORDS={img:/child|children'?s? (thinking|theor|ideas)|competent|capable|image of the child|trust|co-construct/i,env:/environment|space|material|provocation|aesthetic|beaut|room|outdoor|atelier|garden|wall/i,lang:/language|tone|words|praise|regulat|calm|conflict|voice|behavio|describ|narrat/i,
  obs:/observ|document|photo|notic|wonder|panel|portfolio|slide|stor(y|ies)/i,cur:/plan|curricul|inquir|project|thread|small group|intent|investigat/i,fam:/famil|parent|conference|home/i,team:/team|colleague|collaborat|co-educator|communit|support (each|one)/i,refl:/reflect|feedback|grow|learn|journal|training|course|PD\b|professional/i};
const suggestArea=t=>{let best="",n=0;for(const [k,re] of Object.entries(AREA_WORDS)){const m=(String(t||"").match(new RegExp(re.source,"gi"))||[]).length;if(m>n){n=m;best=k}}return best};
// the August form's other answers, kept as written in the Reflection part
const REFL=[["difficult","What was difficult for me"],["proud","A moment I'm proud of"],["natural","What comes naturally"],["drains","What drains me"],["pattern","A pattern I keep noticing"],["why","Why these goals"]];
async function planPage(my){const dir=isDir();if(dir&&!st.sel)st.sel=(B().people[0]||{}).name||"";const name=who();if(!name){draw(my,head("Educators","Growth Plan")+card("No educator yet",`<div class="hint">Educators appear here once they have a sign-in.</div>`));return}
  const d=await doc(name,true);const y=yr();const pl=Object.assign({wentWell:{choice:"last",text:""},goals:[],challenges:"",need:{director:"",team:"",training:""},feedback:""},(d.plans||{})[y]||{});pl.reflection=Object.assign({},pl.reflection||{});
  st.planDraft=st.planDraft&&st.planDraft.__who===name?st.planDraft:Object.assign(JSON.parse(JSON.stringify(pl)),{__who:name});const p=st.planDraft;
  while((p.goals||[]).length<2)p.goals.push({id:"g"+Math.random().toString(36).slice(2,8),text:"",area:"",areaOk:false});
  const goalHtml=(x,i)=>{const sug=x.area||suggestArea(x.text);const mod=sug&&B().modules.find(m=>m.ready&&m.areas.includes(sug)&&!["howto","licensing"].includes(m.slug));
    return `<div class="gblock"><label class="fld-label" style="margin:0">Goal ${i+1}<textarea rows="2" data-gpgoal="${i}">${H(x.text)}</textarea></label>
    <div class="cnt">${x.areaOk?`Linked to <b>${H(areaName(x.area))}</b>. `:sug?`TREE suggests <b>${H(areaName(sug))}</b> from ${dir?"the":"your"} words. `:"Choose the area this goal belongs to. "}<select data-gparea="${i}" aria-label="Area for goal ${i+1}"><option value="">Choose an area</option>${AK().map(k=>`<option value="${k}" ${(x.area||sug)===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select> ${x.areaOk?chip("ok","Confirmed"):`<button class="btn small ghost" data-gpok="${i}">Confirm</button>`}</div>
    ${mod?`<div class="cnt">A module that supports it, <button class="linkbtn" data-tview="stpd" data-stmod="m:${H(mod.slug)}">${H(mod.title)}</button></div>`:""}</div>`};
  const people=dir?B().people.map(x=>x.name):[];const isNew=d.profile&&d.profile.startDate&&X.daysTo(d.profile.startDate,today())<365;
  draw(my,head(dir?"Growth Plan":"My Growth Plan","Educator Reflection and Growth Plan",`This plan begins ${dir?"their":"your"} year. It shapes ${dir?"their":"your"} check-ins, ${dir?"their":"your"} journal and ${dir?"their":"your"} evaluation, and it is ${dir?"theirs":"yours"} to return to.`)+
    (dir?pills("gsel",people,name)+`<div class="cnt" style="margin:-4px 0 10px">${pl.source==="august"?"Entered from the August plan, exactly as written.":pl.source==="tree"?"Started in TREE.":"Not entered yet. Enter the August plan exactly as written, or leave it for them to start in TREE."}</div>`:"")+
    card("1. What went well",`${seg("data-gpww",[["last","What went well for me last year"],["new","What has gone well in my first weeks here, or in my work before coming here"]],p.wentWell.choice||"last")}${isNew&&p.wentWell.choice!=="new"?`<div class="cnt" style="margin-top:4px">New educators can choose the second.</div>`:""}<textarea rows="4" id="gp-ww" style="margin-top:8px;width:100%" aria-label="What went well">${H(p.wentWell.text||"")}</textarea>`)+
    card("2. Reflection",`<div class="hint">Kept as written and seen only by ${dir?"the educator and you":"you and the director"}.</div>${REFL.map(([k,l])=>`<label class="fld-label">${H(l)}<textarea rows="3" data-gprefl="${k}">${H((p.reflection||{})[k]||"")}</textarea></label>`).join("")}`)+
    card("3. My goals for this year, two or three",`<div class="hint">Each goal links to one of the eight areas. TREE suggests the area from the words, and ${dir?"the educator confirms":"you confirm"} it.</div><div style="display:grid;gap:8px">${p.goals.map(goalHtml).join("")}</div>${p.goals.length<3?`<div class="actions"><button class="btn small ghost" data-gpadd="1">Add a third goal</button></div>`:""}`)+
    card("4. Challenges I'm anticipating",`<div class="hint">Kept as written and seen only by ${dir?"the educator and you":"you and the director"}.</div><textarea rows="3" id="gp-ch" style="width:100%" aria-label="Challenges">${H(p.challenges||"")}</textarea>`)+
    card("5. What I need",`<label class="fld-label">From the director<textarea rows="2" id="gp-nd">${H(p.need.director||"")}</textarea></label><label class="fld-label">From my team<textarea rows="2" id="gp-nt">${H(p.need.team||"")}</textarea></label><label class="fld-label">From training<textarea rows="2" id="gp-nr">${H(p.need.training||"")}</textarea></label>`)+
    card("6. How I take in feedback best",`<div class="hint">${dir?"Left for the educator to choose.":"Your evaluation opens in this view first, with every view one tap away."}</div>${[["scores","As scores"],["continuum","As descriptions of what comes next"],["narrative","As a narrative"],["conversation","In conversation"],["notes","Written to read later"]].map(([v,l])=>`<label class="radio"><input type="radio" name="gpfb" value="${v}" ${p.feedback===v?"checked":""} ${dir?"disabled":""}><span>${l}</span></label>`).join("")}${!p.feedback?`<div class="cnt">Not chosen yet, so the evaluation opens in the scores view.</div>`:""}`)+
    (dir?card("For you",`<label class="radio"><input type="checkbox" id="gp-aug" ${pl.source==="august"?"checked":""}><span>Entered from the August plan, exactly as written</span></label><label class="fld-label">An answer to the check-in plan or meeting frequency question, kept as a note only since check-ins are set monthly<textarea rows="2" id="gp-note">${H(pl.note||"")}</textarea></label>`):"")+
    `<div class="actions"><button class="btn" data-gpsave="1">Save the plan</button>${pl.at?`<span class="cnt">Saved ${H(fms(pl.at))}</span>`:""}</div>`)}

/* ---------- the reflective journal ---------- */
const PROMPTS=[["joy","A moment of joy","A moment that brought me joy this week."],["challenge","A challenge I navigated","A challenge I worked through this week, and what I learned from it."],["connection","A connection I made","One meaningful connection I made with a child, a family or a colleague."],["language","My language this week","Something I noticed about my own words or tone this week, and one language strategy I will practice next week."]];
async function journalPage(my){const boss=isDir();if(boss&&!st.sel)st.sel=(B().people[0]||{}).name||"";const name=jWho();const people=boss?B().people.map(x=>x.name):[];
  // the director's own journal reads as anyone's own, and only she reads it
  const dir=boss&&!st.jself;
  const open=st.jr&&st.jrWho===name;const every=dir?((B().people.find(p=>p.name===name)||{}).journalEvery||1):boss?1:B().me.journalEvery;
  let h=head(dir?"Journal":"My journal",dir?name+"'s journal":"Reflective journal",dir?`Read as a partner in ${H(name)}'s reflection. Only ${H(name)} and you see it, and it is never scored and never used to judge them.`:`The weekly journal is an integral part of our reflective practice. ${every===2?"Part time educators who do not work Mondays write every other week":"You write once a week"}, in about ten minutes, and a few honest sentences are enough.`);
  if(boss)h+=`<div class="actions" style="margin:0 0 10px;flex-wrap:wrap"><button class="pill" aria-pressed="${!!st.jself}" data-gjself="1">My own journal</button>${people.map(n=>`<button class="pill" aria-pressed="${!st.jself&&n===name}" data-gsel="${H(n)}">${H(n)}</button>`).join("")}</div>`;
  if(!open){draw(my,h+card("Open the journal",`<div class="hint">The journal asks for ${dir?"your":"your"} TREE passcode each time it opens, in case ${dir?"you forget":"you forget"} to sign out on a shared computer.</div>
    <div class="kfields"><label>Your TREE passcode<input type="password" inputmode="numeric" autocomplete="current-password" id="gj-pass" maxlength="40"></label></div><div class="actions"><button class="btn" data-gjopen="1">Open</button></div>`));setTimeout(()=>{const i=$("#gj-pass");if(i)i.focus()},50);return}
  const J=st.jr;const p=J.period;const cur=J.entries.find(e=>e.date>=p.start&&e.date<=p.end&&!dir)||null;const draft=st.jDraft||(cur?Object.assign({},cur):{});
  h+=card("A no judgment space",`<div class="cnt">${dir?"What is written here is never scored and never used to judge the educator. They can choose to bring an entry into a check-in or the self-assessment.":(boss?"What you write in your own journal is for you. Only you read it, behind your passcode, and it never enters an evaluation, a check-in, a count, a reminder or the staff room display.":"What you write in the journal is never scored and never used in your evaluation. It is seen only by you and the director, never by colleagues. You can choose to bring an entry into a check-in or your self-assessment.")}</div><div class="actions"><button class="btn small ghost" data-gjclose="1">Close the journal</button></div>`);
  if(!dir)h+=card(p.every===2?"These two weeks":"This week",`<div class="cnt" style="margin-bottom:6px">${J.wrote?`You have written ${p.every===2?"in these two weeks":"this week"}. You can add to it or change it.`:`${fd(p.start)} to ${fd(p.end)}.`}</div>${PROMPTS.map(([k,l,q])=>`<label class="fld-label"><b>${H(l)}.</b> ${H(q)}<textarea rows="3" data-gjf="${k}">${H(draft[k]||"")}</textarea></label>`).join("")}${J.carry&&J.carry.prompt?`<label class="fld-label"><b>From ${H(J.carry.title)}.</b> ${H(J.carry.prompt)}<textarea rows="3" data-gjf="module">${H(draft.module||"")}</textarea></label>`:""}
    <div class="actions"><button class="btn" data-gjsave="${H(cur?cur.id:"")}">Save</button></div>`);
  const earlier=J.entries.filter(e=>dir||!cur||e.id!==cur.id);
  h+=card(dir?"Entries":"Earlier entries",earlier.length?earlier.map(e=>`<div class="garea"><b>${H(fd(e.date))}</b>${PROMPTS.filter(([k])=>e[k]).map(([k,l])=>`<div class="gq"><div class="cnt">${H(l)}</div><div style="white-space:pre-line">${H(e[k])}</div></div>`).join("")}${e.module?`<div class="gq"><div class="cnt">${H(e.modulePrompt||"From a module")}</div><div style="white-space:pre-line">${H(e.module)}</div></div>`:""}
    ${boss&&!dir?"":dir?(e.bring&&(e.bring.checkin||e.bring.self)?`<div class="cnt">${H(name)} chose to bring this into ${[e.bring.checkin?"a check-in":"",e.bring.self?"the self-assessment":""].filter(Boolean).join(" and ")}.</div>`:""):`<div class="actions" style="margin:4px 0 0"><button class="pill" aria-pressed="${!!(e.bring&&e.bring.checkin)}" data-gjbring="${H(e.id)}|checkin">Bring to my next check-in</button><button class="pill" aria-pressed="${!!(e.bring&&e.bring.self)}" data-gjbring="${H(e.id)}|self">Bring to my self-assessment</button></div>`}</div>`).join(""):`<div class="cnt">${dir?"No entries yet.":"Entries you save appear here."}</div>`);
  draw(my,h)}

/* ---------- the monthly check-in ---------- */
// each check-in page links to How Check-Ins Work, in the Teacher Policies and Procedures
const ciLink=()=>staffSubOk("sthb")?` Read <button class="linkbtn" data-hbopen="how-check-ins-work">How Check-Ins Work</button> in the Teacher Policies and Procedures.`:"";
// five parts in about twenty minutes, in this order, then what the director writes on her own after the educator leaves
const Q=[["temp","Professional temperature, about 2 minutes","How has the last month felt? The educator gives their own number from 1 to 5, and you add yours beside it."],
  ["plusdelta","Plus delta, about 7 minutes","What went well this month, and what they would change, side by side. This is the place for strong moments, stretches and challenges."],
  ["goals","Growth Plan check, about 3 minutes","A line on where they are with their Growth Plan goals."],
  ["support","One support, about 2 minutes","One support they need from you or their teammates."],
  ["focus","Focus Until Next Time, about 5 minutes","The educator names what they want to focus on first. You add what you have seen, and the two of you settle on one focus together."]];
const AFTER=[["followup","Follow-up notes","Specific actions, agreements and timelines, with any leadership follow-up."],["align","Team alignment","How aligned the team is in routines, expectations and communication, from 1 to 5."],["effect","Check-in effectiveness","How well the check-in served them, from 1 to 5."]];
const rate=(attr,v)=>`<div class="tseg" role="group">${[1,2,3,4,5].map(n=>`<button data-${attr}="${n}" aria-pressed="${+v===n}">${n}</button>`).join("")}</div>`;
const tm=t=>t?X.hourText(t):"";
const dur=n=>n===90?"an hour and a half":n===60?"an hour":n%60===0?(n/60)+" hours":n>60?Math.floor(n/60)+" hours and "+(n%60)+" minutes":n+" minutes";
async function checkinPage(my){const dir=isDir();const b=B();
  if(!dir){const d=await doc(meName(),true);const s=[b.schedule.now,b.schedule.next].filter(Boolean).flatMap(x=>x.list).filter(x=>x.date>=today()&&x.name===meName());const nxt=s[0];const mode=d.profile.checkin;
    const ym=today().slice(0,7);const pre=(d.pre||{})[ym]||{};const cis=d.checkins||[];const last=cis.find(c=>c.focus&&c.focus.settled);
    draw(my,head("Check-ins","My check-ins","A regular, supportive space to talk about your practice, your Class and the children, and to agree together on what comes next. Nothing needs to be prepared beforehand."+ciLink())+
      card("My next check-in",nxt?`<div><b>${H(new Date(nxt.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))}</b>${nxt.time?", "+H(tm(nxt.time)):""}, about twenty minutes${nxt.kind==="second"?", on the short second Monday":nxt.kind==="slot"?", during your Monday planning hour":""}.</div><div class="cnt">It is on the TREE calendar too.</div>`:`<div class="cnt">${mode==="asneeded"?"Your check-ins happen as needed. The director sets a time with you.":"The next check-in appears here once it is on the calendar."}</div>`)+
      card("Before we meet",`<div class="hint">You name what you want to focus on first, if you like. You are always welcome to bring a journal entry, a proud moment, a question or a piece of documentation.</div><label class="fld-label">What I want to focus on<textarea rows="3" id="gc-pre">${H(pre.focus||"")}</textarea></label><div class="actions"><button class="btn small" data-gcpre="1">Save</button>${pre.at?`<span class="cnt">Saved ${H(fms(pre.at))}</span>`:""}</div>`)+
      card("Focus Until Next Time",last?`<div class="gq">${md(last.focus.settled)}</div><div class="cnt">${last.focus.area?"Linked to "+H(areaName(last.focus.area))+". ":""}From the check-in on ${H(fd(last.date))}.</div>${last.focus.module&&modReady(last.focus.module)?`<div class="actions"><button class="btn small ghost" data-tview="stpd" data-stmod="m:${H(last.focus.module)}">${H(modTitle(last.focus.module))}</button></div>`:""}
        <div class="actions"><button class="pill" aria-pressed="${!!last.followed}" data-gcfollow="${H(last.id)}">I have tried it</button><span class="cnt">Your focus and your follow-through count toward Reflective Practice and Professional Growth.</span></div>`:`<div class="cnt">Settled together at your next check-in.</div>`)+
      card("Follow-up notes",cis.filter(c=>c.followup||c.focus&&c.focus.settled).map(c=>`<div class="garea"><b>${H(fd(c.date))}</b>${c.focus&&c.focus.settled?`<div class="cnt">Focus Until Next Time. ${H(c.focus.settled)}</div>`:""}${c.followup?`<div style="white-space:pre-line;margin-top:4px">${H(c.followup)}</div>`:""}</div>`).join("")||`<div class="cnt">Notes from your check-ins appear here, to read whenever you like.</div>`));return}
  // the director's month, and one check-in
  if(st.ciWho){return checkinForm(my,st.ciWho)}
  const S2=[b.schedule.now,b.schedule.next].filter(Boolean);const asNeeded=b.people.filter(p=>p.checkin==="asneeded");
  draw(my,head("Check-ins","Check-ins","Each educator has one check-in a month in their Monday planning slot, about twenty minutes. TREE lays out each month from the planning hours in Settings, moving a holiday or the Monday after a long break to the next open Monday, and rotating the order within each slot."+ciLink())+
    S2.map(s=>card(new Date(s.ym+"-01T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"}),`${s.moved?`<div class="cnt">Moved from ${H(fd(s.moved))}, which is a holiday or the Monday after a long break.</div>`:""}
      ${s.list.length?`<div class="tablewrap"><table class="grid2" style="min-width:420px"><thead><tr><th>Day</th><th>Time</th><th>Educator</th><th></th></tr></thead><tbody>${s.list.map(x=>`<tr><td>${H(fd(x.date))}${x.kind==="second"?` <span class="cnt">short second Monday</span>`:""}</td><td>${H(tm(x.time))}</td><td><b>${H(x.name)}</b></td><td><button class="btn small ghost" data-gci="${H(x.name)}" data-gcidate="${H(x.date)}">Open</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="cnt">No check-ins this month yet.</div>`}`)).join("")+
    card("As needed",`<div class="hint">${asNeeded.length?H(asNeeded.map(p=>p.name).join(" and "))+" have check-ins as needed.":"Everyone meets in a planning slot."} Set a day here and it joins the TREE calendar.</div>
      ${asNeeded.map(p=>`<div class="prow"><b>${H(p.name)}</b><span class="actions" style="margin:0"><input type="date" data-gbookd="${H(p.name)}" aria-label="Day for ${H(p.name)}"><input type="time" data-gbookt="${H(p.name)}" aria-label="Time for ${H(p.name)}"><button class="btn small ghost" data-gbook="${H(p.name)}">Set</button><button class="btn small ghost" data-gci="${H(p.name)}">Open a check-in</button></span></div>`).join("")}`)+
    card("Every educator",`<div class="actions" style="flex-wrap:wrap;margin:0">${b.people.map(p=>`<button class="pill" data-gci="${H(p.name)}">${H(p.name)}</button>`).join("")}</div>`))}
async function checkinForm(my,name){const d=await doc(name,true);const y=yr();const goals=(((d.plans||{})[y]||{}).goals||[]).filter(x=>String(x.text||"").trim());
  if(!st.ci||st.ci.__who!==name){const ym=(st.ciDate||today()).slice(0,7);const existing=(d.checkins||[]).find(c=>String(c.date).slice(0,7)===ym);
    st.ci=Object.assign({temp:{},align:{},goals:{},focus:{}},existing?JSON.parse(JSON.stringify(existing)):{date:st.ciDate||today()},{__who:name});
    const pre=(d.pre||{})[ym];if(pre&&pre.focus&&!st.ci.focus.mine)st.ci.focus.mine=pre.focus}
  const c=st.ci;const since=Date.now()-35*864e5;const w=workOf(name,since);
  const prep=[...w.pl.slice(0,4).map(p=>exPlan(p,"intent")),...w.roomThreads.slice(0,2).map(exThread),...w.obs.slice(0,3).map(exObs),...w.sl.slice(0,2).map(exSlide),...w.sto.slice(0,1).map(exStory)];
  const sugArea=c.focus.area||suggestArea([c.focus.settled,c.focus.mine,c.focus.seen].join(" "));const sugMod=c.focus.module||(B().modules.find(m=>m.ready&&m.areas.includes(sugArea)&&!["howto","licensing"].includes(m.slug))||{}).slug||"";
  const past=(d.checkins||[]).filter(x=>x.id!==c.id);
  const fld=(k,rows)=>`<textarea rows="${rows||3}" data-gcf="${k}" style="width:100%">${H(c[k]||"")}</textarea>`;
  draw(my,head("Check-ins","Check-in with "+name,`About twenty minutes. Nothing needs to be prepared beforehand. You ask the questions in the conversation and capture the answers.`+ciLink())+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gciback="1">‹ Check-ins</button><label class="cnt">Day <input type="date" id="gc-date" value="${H(c.date||today())}"></label></div>`+
    card("Their last month",prep.length?exHtml(prep):`<div class="cnt">Nothing kept in TREE in the last month yet.</div>`,"")+
    card(Q[0][1],`<div class="cnt gq">${H(Q[0][2])}</div><div class="gcols"><div><div class="cnt">Their number, from 1 to 5</div>${rate("gctemps",c.temp.self)}</div><div><div class="cnt">Your number beside it</div>${rate("gctempd",c.temp.dir)}</div></div><textarea rows="2" data-gcf="temp.words" style="width:100%;margin-top:6px" aria-label="Their words">${H(c.temp.words||"")}</textarea>`)+
    card(Q[1][1],`<div class="cnt gq">${H(Q[1][2])}</div><div class="gcols"><label class="fld-label">Plus, what went well<textarea rows="4" data-gcf="plus">${H(c.plus||"")}</textarea></label><label class="fld-label">Delta, what to change<textarea rows="4" data-gcf="delta">${H(c.delta||"")}</textarea></label></div>`)+
    card(Q[2][1],`<div class="cnt gq">${H(Q[2][2])}</div>${goals.length?`<ul class="cnt" style="margin:4px 0 6px;padding-left:20px">${goals.map(x=>`<li>${H(x.text)}${x.area?", "+H(areaName(x.area)):""}</li>`).join("")}</ul>`:`<div class="cnt">No Growth Plan goals entered yet.</div>`}<input type="text" data-gcf="goalsLine" value="${H(c.goalsLine||"")}" style="width:100%" aria-label="Where they are with their goals">${Object.values(c.goals||{}).some(v=>String(v||"").trim())?`<div class="cnt" style="margin-top:6px">Written earlier, goal by goal.</div>${goals.concat(Object.keys(c.goals).filter(k=>!goals.some(x=>x.id===k)).map(k=>({id:k,text:"A goal no longer in the plan"}))).filter(x=>String((c.goals||{})[x.id]||"").trim()).map(x=>`<div class="garea"><b>${H(x.text)}</b><div style="white-space:pre-line">${H(c.goals[x.id])}</div></div>`).join("")}`:""}`)+
    card(Q[3][1],`<div class="cnt gq">${H(Q[3][2])}</div>${fld("support",2)}`)+
    card(Q[4][1],`<div class="cnt gq">${H(Q[4][2])}</div><label class="fld-label">What they want to focus on<textarea rows="2" data-gcf="focus.mine">${H(c.focus.mine||"")}</textarea></label><label class="fld-label">What you have seen<textarea rows="2" data-gcf="focus.seen">${H(c.focus.seen||"")}</textarea></label><label class="fld-label">The focus you settled on together<textarea rows="2" data-gcf="focus.settled">${H(c.focus.settled||"")}</textarea></label>
      <div class="kfields"><label>Area<select id="gc-area"><option value="">Choose</option>${AK().map(k=>`<option value="${k}" ${sugArea===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select></label><label>PD module, where one fits<select id="gc-mod"><option value="">None</option>${B().modules.filter(m=>m.ready&&m.slug!=="howto").map(m=>`<option value="${m.slug}" ${sugMod===m.slug?"selected":""}>${H(m.title)}</option>`).join("")}</select></label></div>`)+
    (String(c.work||"").trim()||String(c.challenge||"").trim()||String(c.align&&c.align.note||"").trim()?card("Earlier answers",`<div class="hint">Kept from this check-in as it was written before the check-in had five parts.</div>${[["work","Curriculum, environment and child goals"],["challenge","One challenge"]].filter(([k])=>String(c[k]||"").trim()).map(([k,l])=>`<div class="garea"><b>${l}</b><div style="white-space:pre-line">${H(c[k])}</div></div>`).join("")}${String(c.align&&c.align.note||"").trim()?`<div class="garea"><b>How leadership can support alignment</b><div style="white-space:pre-line">${H(c.align.note)}</div></div>`:""}`):"")+
    card("After the check-in",`<div class="hint">On your own, after ${H(name)} leaves. Only you see the two ratings.</div>
      <div class="garea"><b>${AFTER[0][1]}</b><div class="cnt gq">${H(AFTER[0][2])}</div>${fld("followup",4)}</div>
      <div class="garea"><b>${AFTER[1][1]}</b><div class="cnt gq">${H(AFTER[1][2])}</div>${rate("gcalign",c.align.rating)}</div>
      <div class="garea"><b>${AFTER[2][1]}</b><div class="cnt gq">${H(AFTER[2][2])}</div>${rate("gceffect",c.effect)}</div>`)+
    `<div class="actions"><button class="btn" data-gcsave="1">Save the check-in</button><span class="cnt">${H(name)} sees only the Focus Until Next Time and follow-up notes.</span></div>`+
    ((d.trend||[]).length?card("Support trend",`<div class="gtrend">${trendSvg(d.trend)}</div><div class="cnt">Their temperature in green, yours in gold and team alignment in grey. A dip shows early, and these never touch evaluation scores.</div>`):"")+
    (past.length?card("Earlier check-ins",past.map(x=>`<div class="prow"><span><b>${H(fd(x.date))}</b> <span class="cnt">${H(clip(x.focus&&x.focus.settled,90))}</span></span><button class="btn small ghost" data-gciopen="${H(x.id)}">Open</button></div>`).join("")):""))}

/* ---------- Proud Moments and Kudos ---------- */
async function momentsPage(my){st.moments=(await ga("moments")).list;const f=st.mform;const team=B().team.filter(t=>t.name!==meName());
  const mine=workOf(meName(),Date.now()-120*864e5);const links=[...(f.link&&f.link.kind==="presenting"?[f.link]:[]),...mine.obs.slice(0,8).map(exObs),...mine.pl.slice(0,5).map(p=>exPlan(p)),...mine.sl.slice(0,5).map(exSlide)];
  const aud={everyone:"Everyone at our school",class:"My Class team",director:"Only the director"};
  draw(my,head("Proud Moments","Proud Moments and Kudos","Keep what you are proud of and recognize one another. Moments and Kudos shared with everyone also rotate on the staff room display. Nothing is counted or tallied.")+
    card(f.kind==="kudos"?"Kudos for a colleague":"My proud moment",`${seg("data-gmkind",[["moment","My proud moment"],["kudos","Kudos for a colleague"]],f.kind)}
      ${f.kind==="kudos"?`<label class="fld-label">Colleague<select id="gm-to"><option value="">Choose</option>${team.map(t=>`<option ${f.to===t.name?"selected":""}>${H(t.name)}</option>`).join("")}</select></label><label class="fld-label">What they did that made a difference<textarea rows="3" id="gm-text">${H(f.text||"")}</textarea></label>`
        :`<label class="fld-label">Something I'm proud of, in a sentence or two<textarea rows="3" id="gm-text">${H(f.text||"")}</textarea></label>
        <div class="kfields"><label>Link one of my observations, plans or documentation pieces<select id="gm-link"><option value="">None</option>${links.map(x=>`<option value="${H(x.kind+"|"+x.id+"|"+x.label)}" ${f.link&&f.link.id===x.id?"selected":""}>${H(x.label)}</option>`).join("")}</select></label>
        <label>The area it fits best<select id="gm-area"><option value="">TREE suggests one</option>${AK().map(k=>`<option value="${k}" ${f.area===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select></label></div>
        <div class="actions"><button class="btn small ghost" data-gmphoto="1">${f.photo?"Photo added, change it":"Add a photo"}</button></div>`}
      <div class="chiprow-label" style="margin-top:8px">Who sees it${f.kind==="kudos"?". The colleague always sees it.":""}</div>${seg("data-gmaud",Object.entries(aud),f.audience||"everyone")}
      <div class="actions"><button class="btn" data-gmshare="1">Share</button></div>`)+
    card("Moments and Kudos",st.moments.length?st.moments.map(m=>`<div class="gmom"><div class="cnt"><b>${H(m.by)}</b>${m.kind==="kudos"?`, Kudos for <b>${H(m.to)}</b>`:", a proud moment"} <span class="muted">${H(fms(m.at))}, ${H(aud[m.audience]||"")}</span></div><div style="white-space:pre-line">${H(m.text)}</div>
      ${m.link?`<div class="cnt">${m.link.kind==="obs"?`<button class="linkbtn" data-obsgo="${H(m.link.id)}">${H(m.link.label)}</button>`:H(m.link.label)}</div>`:""}${m.photo?`<div><button class="linkbtn" data-gmview="${H(m.photo)}">See the photo</button></div>`:""}
      ${m.mine||isDir()?`<div><button class="linkbtn" data-gmrm="${H(m.id)}">Remove</button></div>`:""}</div>`).join(""):`<div class="cnt">Moments and Kudos you can see appear here.</div>`))}

/* ---------- the PD library's modules ---------- */
async function loadMods(force){if(!st.mods||force)st.mods=await ga("modules");return st.mods}
Gr.libraryHtml=async function(pcs,dn){const b=B();if(!b)return "";const d=await doc(meName()).catch(()=>({modules:{}}));const m=d.modules||{};
  const last=(d.checkins||[]).find(c=>c.focus&&c.focus.area);const fit=last?b.modules.find(x=>x.ready&&x.areas.includes(last.focus.area)&&!["howto","licensing"].includes(x.slug)):null;
  const ready=b.modules.filter(x=>x.ready);
  const stat=x=>x.slug==="licensing"||x.slug==="howto"?((pcs[x.slug]||[]).length&&(pcs[x.slug]||[]).every(p=>dn[p.id])?chip("ok","Finished"):(pcs[x.slug]||[]).some(p=>dn[p.id])?chip("soonish","Started"):""):m[x.slug]&&m[x.slug].done?chip("ok","Finished "+fms(m[x.slug].done)):m[x.slug]&&m[x.slug].opened?chip("soonish","Started"):"";
  return card("Modules",`<div class="hint">You choose the order you take modules in.${fit?` TREE suggests ${H(fit.title)}, which fits your Focus Until Next Time.`:""} Each module ends with a practice to try in your own Class and a few minutes of sharing at a staff meeting.</div>
    <div class="stgrid" style="margin-top:8px">${ready.map(x=>`<div class="stmod"><b>${H(x.title)}</b><div class="cnt">${H(x.desc)}</div><div class="actions" style="margin:4px 0 0"><button class="btn small ghost" data-stmod="${x.slug==="licensing"||x.slug==="howto"?x.slug:"m:"+x.slug}">Open</button>${x.waiting?chip("soonish","Draft, only you see it"):""}${stat(x)}${fit&&fit.slug===x.slug?chip("soonish","Fits your focus"):""}</div></div>`).join("")}</div>
`)};
/* the readings library, grouped by area of practice, each a link to its publisher. The library added since waits for the director. */
async function loadReadings(force){if(!st.rlib||force){try{st.rlib=await ga("readings")}catch(e){st.rlib={list:[]}}}return st.rlib}
// a book shows In our library when we have it on site. An article opens in a new tab and shows its publisher and
// year. The director turns In our library on site on or off for each book, and changes or removes any entry.
const isBookR=x=>x&&x.library&&x.kind!=="article";
const readingMeta=x=>x.kind==="article"?[[x.author,[x.source,x.year].filter(Boolean).join(", ")].filter(Boolean).join(". "),x.note].filter(Boolean):[x.cite||x.source||"",x.note||""].filter(Boolean);
const readingRow=x=>`<div class="strow"><div>${x.url?treeReadLink(x.url,x.title):`<b>${H(x.title)}</b>`}${x.onSite&&isBookR(x)?` <span class="stchip ok">In our library</span>`:""}${x.check?" "+chip("soonish","Link to check"):x.confirmed&&isDir()?` <span class="cnt">Confirmed ${H(fd(x.confirmed))}</span>`:""}</div>${readingMeta(x).map(t=>`<div class="cnt">${H(t)}</div>`).join("")}${x.supports&&x.kind!=="article"?`<div class="cnt">${H(x.supports)}</div>`:""}${isDir()&&x.library?`<div class="actions" style="margin:4px 0 0">${isBookR(x)?`<label class="radio" style="margin:0"><input type="checkbox" data-grlonsite="${H(x.id)}" ${x.onSite?"checked":""}><span>In our library on site</span></label>`:""}<button class="linkbtn" data-grledit="${H(x.id)}">Change</button><button class="linkbtn" data-grlremove="${H(x.id)}">Remove</button></div>`:""}${st.rlEdit===x.id?readingForm(x):""}</div>`;
// the form to add or change a book or an article in the library, for the director
function readingForm(x){x=x||{kind:st.rlEdit==="new-article"?"article":"book",modules:[],areas:[]};const ms=(st.mods&&st.mods.modules)||{};
  return `<div class="gq" data-grlform="${H(x.id||"")}"><div class="kfields"><label>Kind<select data-grlf="kind"><option value="book" ${x.kind!=="article"?"selected":""}>Book</option><option value="article" ${x.kind==="article"?"selected":""}>Article to read online</option></select></label>
    <label style="grid-column:span 2">Title<input type="text" data-grlf="title" value="${H(x.title||"")}"></label><label>Author<input type="text" data-grlf="author" value="${H(x.author||"")}"></label><label>Publisher<input type="text" data-grlf="source" value="${H(x.source||"")}"></label><label>Year<input type="text" data-grlf="year" value="${H(x.year||"")}"></label>
    <label style="grid-column:span 2">Link, the source, the publisher's page or a catalog page. For a place in TREE, tree: and the place<input type="text" inputmode="url" data-grlf="url" value="${H(x.url||"")}"></label><label style="grid-column:span 2">Citation, for a book<input type="text" data-grlf="cite" value="${H(x.cite||"")}"></label><label style="grid-column:span 2">What it offers<textarea rows="2" data-grlf="note">${H(x.note||"")}</textarea></label></div>
    <div class="cnt">Modules</div><div class="chips">${Object.entries(ms).map(([k,m])=>`<label class="radio" style="margin:0 8px 0 0"><input type="checkbox" data-grlmod="${H(k)}" ${(x.modules||[]).includes(k)?"checked":""}><span>${H(m.title)}</span></label>`).join("")}</div>
    <div class="actions"><button class="btn small" data-grlsave="${H(x.id||"")}">Save</button><button class="linkbtn" data-grlcancel="1">Cancel</button></div></div>`}
Gr.readingsHtml=async function(){const r=await loadReadings();const all=r.list||[];if(!all.length)return "";const dir=isDir();const waiting=dir&&r.library&&!r.libraryReady;if(dir)await loadMods().catch(()=>null);
  const onSite=st.rlFilter==="onsite",L=onSite?all.filter(x=>x.onSite&&isBookR(x)):all;
  const groups=AK().map(k=>[k,L.filter(x=>(x.areas||[]).includes(k))]).filter(([,g])=>g.length);const other=L.filter(x=>!(x.areas||[]).length);
  return card("Readings",`<div class="hint">Books, articles and public resources, each linked to its publisher, grouped by area of practice. Open one to read it where it lives.</div>
    ${waiting?`<div class="gq"><div>${chip("soonish","Draft, only you see it")} The readings added from the works cited list and the public resources wait for you. Educators see the shared list until you mark them ready.</div><div class="actions"><button class="btn small" data-grlready="1">Mark them ready</button></div></div>`:dir&&r.library?`<div class="actions"><button class="linkbtn" data-grlready="0">Hide the added readings again</button></div>`:""}
    <div class="tseg" role="group" aria-label="Which readings" style="margin:6px 0"><button data-grlfilter="all" aria-pressed="${!onSite}">All</button><button data-grlfilter="onsite" aria-pressed="${onSite}">In our library</button></div>
    ${dir&&r.library?`<div class="actions" style="margin:0 0 6px"><button class="btn small ghost" data-grledit="new-book">Add a book</button><button class="btn small ghost" data-grledit="new-article">Add an article</button></div>${String(st.rlEdit||"").startsWith("new-")?readingForm(null):""}`:""}
    ${onSite&&!L.length?`<div class="empty">No book is marked In our library yet.</div>`:""}
    ${groups.map(([k,g])=>`<details ${onSite?"open":""}><summary class="chiprow-label" style="cursor:pointer">${H(areaName(k))}, ${g.length}</summary>${g.map(readingRow).join("")}</details>`).join("")}${other.length?`<details ${onSite?"open":""}><summary class="chiprow-label" style="cursor:pointer">More, ${other.length}</summary>${other.map(readingRow).join("")}</details>`:""}`,`${all.length} readings`)};
Gr.module=async function(my,slug){await Gr.ready();const ms=await loadMods();const m=ms.modules[slug];if(!m){draw(my,card("Not here",`<div class="hint">This module is not in the PD library yet.</div>`));return}
  const d=await doc(meName(),true);const pr=(d.modules||{})[slug]||{};const dir=isDir();const ex=(ms.examples||{})[slug]||{examples:[]};
  const sec=h=>m.sections.find(s=>s.heading.toLowerCase().startsWith(h));
  const why=sec("why it matters"),reading=sec("reading"),own=sec("from fulton")||sec("from our own"),tr=sec("try this week"),rf=sec("reflect"),sh=sec("share at"),rd=sec("readings");
  const serves=(m.serves||[]).map(areaName).filter(Boolean);
  // the reflection prompts, one per line or list item, each one can be carried into the weekly journal
  const prompts=rf?String(rf.body).split("\n").map(l=>l.replace(/^\s*[-*]\s+/,"").trim()).filter(Boolean):[];const carry=(d.carry||{}).prompt||"";
  const draftCard=dir&&m.draft?card(m.waiting?"Draft":"Ready",`<div class="hint">${m.waiting?"Only you see this module. Educators see it once you mark it ready.":"Educators see this module."}</div><div class="actions"><button class="btn small${m.waiting?"":" ghost"}" data-gmready="${H(slug)}|${m.waiting?1:0}">${m.waiting?"Mark it ready":"Hide it again"}</button></div>`):"";
  const leadBtn=dir?`<button class="btn small ghost" data-gmlead="${H(slug)}">Turn into a live or virtual presentation</button><button class="btn small ghost" data-gmedit="${H(slug)}">Edit</button>`:"";
  let exBody="";
  if(dir){const pick=st.examplesPick&&st.examplesPick.slug===slug?st.examplesPick:{slug,list:(ex.examples||[]).slice(),shown:!!ex.shown};st.examplesPick=pick;
    const pool=[...[...notices.values()].filter(n=>n&&String(n.noticed||"").length>60).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,30).map(n=>({kind:"obs",id:n.id,label:clip(n.noticed,120)+" ("+(n.by||"")+")",text:clip(n.noticed,600)})),...[...slides.values()].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,12).map(x=>({kind:"slide",id:x.id,label:"Slide, "+clip(x.title,80)+" ("+(x.by||"")+")",text:clip([x.title,x.text].filter(Boolean).join(". "),600)}))];
    exBody=`<div class="hint">Choose two or three examples from our observations and documentation. They stay hidden from educators until you show them.</div>${pick.list.map((x,i)=>`<div class="gq"><div>${H(x.text)}</div><button class="linkbtn" data-gexrm="${i}">Take it out</button></div>`).join("")}
      ${pick.list.length<3?`<label class="fld-label">Add an example<select id="gex-add"><option value="">Choose from recent observations and slides</option>${pool.filter(p=>!pick.list.some(x=>x.id===p.id)).map(p=>`<option value="${H(p.kind+"|"+p.id)}">${H(p.label)}</option>`).join("")}</select></label>`:""}
      <label class="radio"><input type="checkbox" id="gex-shown" ${pick.shown?"checked":""}><span>Show these to educators</span></label><div class="actions"><button class="btn small" data-gexsave="${H(slug)}">Save the examples</button></div>`;
    st._exPool=pool}
  else exBody=ex.shown&&(ex.examples||[]).length?ex.examples.map(x=>`<div class="gq">${H(x.text)}</div>`).join(""):"";
  draw(my,`<div class="head"><div><span class="eyebrow">PD library</span><h2 style="margin-top:4px">${H(m.title)}</h2>${serves.length?`<div class="sub">Serves ${H(serves.join(" and "))}.</div>`:""}</div></div>
    <div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stmodback="1">‹ PD library</button>${pr.done?chip("ok","Finished "+fms(pr.done)):pr.opened?chip("soonish","Started"):""}${leadBtn}</div>${draftCard}
    ${why?card("Why it matters",md(why.body)):""}${reading?card("Reading",md(reading.body)):""}
    ${exBody||dir?card("From our own documentation",exBody):""}
    ${tr?card("Try this week",`${md(tr.body)}<label class="radio"><input type="checkbox" data-gmtried="${H(slug)}" ${pr.tried?"checked":""}><span>I tried it in my Class</span></label>`):""}
    ${rf?card("Reflect",`${prompts.map(q=>`<div class="gq"><div class="stq">${H(q)}</div><div class="actions" style="margin:4px 0 0"><button class="pill" aria-pressed="${carry===q}" data-gmcarry="${H(slug)}">${carry===q?"In my journal this week":"Carry to my journal"}</button></div></div>`).join("")}<label class="fld-label">What happened when I tried it<textarea rows="4" id="gmod-ref">${H(pr.reflection||"")}</textarea></label><div class="cnt">Your reflection counts as evidence for ${H(serves.join(" and "))}. Only you and the director read it.</div>`):""}
    ${sh?card("Share at a staff meeting",`${md(sh.body)}<label class="fld-label">What I will share, if I want a note<textarea rows="2" id="gmod-share">${H(pr.share||"")}</textarea></label>`):""}
    ${rd?card("Readings",md(rd.body)):""}${await (async()=>{const R2=((await loadReadings()).list||[]).filter(x=>(x.modules||[]).includes(slug));const bk=R2.filter(x=>x.kind!=="article"),ar=R2.filter(x=>x.kind==="article");
      return (bk.length?card("Books",bk.map(readingRow).join("")):"")+(ar.length?card("Articles to read online",`<div class="hint">Each opens in a new tab.</div>${ar.map(readingRow).join("")}`):"")})()}
    ${dir&&(m.source||(m.sources||[]).length)?`<div class="cnt" style="margin:8px 0">Source, seen only by you. ${H([m.source,...(m.sources||[])].filter(Boolean).join(". "))}</div>`:""}
    <div class="actions"><button class="btn small ghost" data-gmodsave="${H(slug)}">Save</button>${pr.done?"":`<button class="btn" data-gmodfinish="${H(slug)}">Finish the module</button><span class="cnt">Its hours go on your records page as our PD hours.</span>`}</div>`);window.scrollTo(0,0)};

/* ---------- PD days and monthly PD staff meetings ---------- */
const HOW={whole:"Whole group",class:"By Class",pairs:"In pairs",quiet:"Quiet individual time"};
async function pdPage(my){const dir=isDir();const r=await ga("pd/list");st.pd=[...r.list,...(r.team||[])];st.team=r.team||[];st.readings=r.readings;
  // the director's Presenting entries, which a block can open
  if(dir){try{st.presList=(await api("pres/list")).list}catch(e){st.presList=[]}}
  {const want=Gr._wantDate||LS.get("tree.pdwant","");if(want){LS.set("tree.pdwant",null);Gr._wantDate="";const it=st.pd.find(x=>x.id===want)||st.pd.find(x=>x.date===want&&x.kind!=="team");if(it){st.pdSel=it.id;st.pdEdit=null}}}
  if(st.pdSel){const it=st.pd.find(x=>x.id===st.pdSel);
    if(it&&it.kind==="team"){if(!it.agenda&&!it.startBlocks){try{it.startBlocks=(await ga("pd/team",{room:it.room,date:it.date})).start||[]}catch(e){it.startBlocks=[]}}return st.pdEdit?teamBuilder(my,it):teamView(my,it)}
    if(it)return dir&&st.pdEdit?agendaBuilder(my,it):agendaView(my,it)}
  const up=st.pd.filter(x=>x.kind!=="team"&&x.date>=today()),past=st.pd.filter(x=>x.kind!=="team"&&x.date<today()).reverse();
  // team meetings, each Class on the open Mondays without the all-staff meeting, the director's every Class and an educator's own
  const tRow=x=>`<div class="prow"><span><b>${H(new Date(x.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric"}))}</b> ${H(x.room)} Class team meeting${x.start?` <span class="cnt">${H(tm(x.start))}${x.end?" to "+H(tm(x.end)):""}</span>`:""}</span><span class="actions" style="margin:0">${x.agenda&&((x.agenda.blocks||[]).length||x.agenda.notes)?chip("ok","Agenda"):""}${(x.carried||[]).length?chip("soon",(x.carried.length)+" next step"+(x.carried.length===1?"":"s")+" open"):""}<button class="btn small ghost" data-gpd="${H(x.id)}">Open</button></span></div>`;
  const tUp=st.team.filter(x=>x.date>=today()),tPast=st.team.filter(x=>x.date<today()).reverse();
  const teamCard=st.team.length?card("Team meetings",`<div class="hint">Each Class team meets on the open Mondays without the all-staff meeting, and on every open Monday of December, February and any month the director marks. The agenda starts from the Class's own week.</div>${tUp.slice(0,8).map(tRow).join("")}${tPast.length?`<details><summary class="cnt">Earlier team meetings</summary>${tPast.slice(0,8).map(tRow).join("")}</details>`:""}`):"";
  const row=x=>`<div class="prow"><span><b>${H(new Date(x.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric"}))}</b> ${H(x.title||(x.kind==="meeting"?"PD staff meeting":"PD day"))} <span class="cnt">${x.kind==="meeting"?"Monthly PD staff meeting":"PD day"}</span></span><span class="actions" style="margin:0">${dir?(x.agenda&&(x.agenda.blocks||[]).length?chip("ok",x.agenda.mode==="light"?"Light agenda":"Agenda ready"):chip("missing","No agenda yet")):""}<button class="btn small ghost" data-gpd="${H(x.id)}">${dir?"Open":"Read the agenda"}</button></span></div>`;
  draw(my,head("PD days","PD days and PD staff meetings",dir?"Each PD day and monthly PD staff meeting on the TREE calendar opens an agenda builder. Staff see an agenda two weeks before the day, hear a reminder a few days before, and every agenda ends with plus delta.":"PD days are the shared work, and each one builds on the individual work in the PD library. You can see each agenda two weeks before the day, with readings one tap away.")+
    teamCard+(!dir&&!up.length&&!past.length&&st.team.length?"":card("Coming up",up.length?up.map(row).join(""):`<div class="cnt">${dir?"No PD day or PD staff meeting is on the calendar in the next months. Add one below.":"Agendas appear here two weeks before the day."}</div>`))+
    (past.length?card("Recent",past.slice(0,6).map(row).join("")):"")+
    (dir?card("Add a day",`<div class="hint">PD days and staff meetings already on the calendar appear by themselves. Add one here when it is not.</div><div class="kfields"><label>Day<input type="date" id="gpd-date"></label><label>Kind<select id="gpd-kind"><option value="pdday">PD day</option><option value="meeting">Monthly PD staff meeting, ${H(tm(B().settings.meeting.start))} to ${H(tm(B().settings.meeting.end))}</option></select></label><label>Title<input type="text" id="gpd-title" placeholder="Optional"></label></div><div class="actions"><button class="btn small" data-gpdadd="1">Add to the calendar</button></div>`):""))}
// a guest session's presenters, organization, length and links, as one line
const guestLine=b=>b.guest?[b.guestBy?"Given by "+b.guestBy+(b.guestOrg?" of "+b.guestOrg:""):b.guestOrg?"Given by "+b.guestOrg:"A guest session",b.guestMinutes?dur(+b.guestMinutes):"",b.guestPeople?"for "+b.guestPeople+" people":""].filter(Boolean).join(", "):"";
function agendaBlocksHtml(a){const R=st.readings||[];return (a.blocks||[]).map(b=>`<div class="gblock">${b.guest?`<div class="cnt"><span class="stchip ok">Guest session</span> ${H(guestLine(b))}${b.guestLink?`. <a href="${H(b.guestLink)}" target="_blank" rel="noopener">Link</a>`:""}${b.guestHandout?`. <a href="${H(b.guestHandout)}" target="_blank" rel="noopener">Handout</a>`:""}</div>`:""}<div class="sttop" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${b.time?H(tm(b.time))+", ":""}${H(b.title)}</b>${b.how?`<span class="cnt">${H(HOW[b.how]||"")}</span>`:""}</div>${b.why?`<div class="cnt" style="white-space:pre-line">${H(b.why)}</div>`:""}${b.prepare?`<div class="cnt"><b>To prepare.</b> ${H(b.prepare)}</div>`:""}
  ${(b.readings||[]).length?`<div class="cnt">${b.readings.map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>(x.url?treeReadLink(x.url,x.title):H(x.title))+(x.source||x.cite?", "+H(x.source||x.cite):"")+(x.onSite&&isBookR(x)?` <span class="stchip ok">In our library</span>`:"")).join("<br>")}</div>`:""}${b.module&&modReady(b.module)?`<div><button class="linkbtn" data-tview="stpd" data-stmod="${b.module==="licensing"||b.module==="howto"?b.module:"m:"+b.module}">${H(modTitle(b.module))}</button></div>`:""}${b.presenting&&b.presTitle?`<div><button class="linkbtn" data-gpres="${H(b.presenting)}">Presenting, ${H(b.presTitle)}</button></div>`:""}</div>`).join("")}
/* A Class team meeting, with the same agenda builder as PD days. Its agenda starts from the Class's own week, the team
   removes or adds items, and keeps notes and next steps, each with a person. A next step stays on the next team
   meeting's agenda until it is marked done. Team meetings are not logged as PD hours. */
const teamWho=it=>{const ps=(B().people||[]).filter(p=>p.room===it.room).map(p=>p.name);return ps.length?ps:(B().people||[]).map(p=>p.name)};
const stepRow=(x,from)=>`<div class="prow"><label class="radio" style="flex:1;min-width:0"><input type="checkbox" data-gstep="${H(from)}|${H(x.id)}" ${x.done?"checked":""}><span>${H(x.text)}${x.who?` <span class="cnt">${H(x.who)}</span>`:""}${x.fromDate?` <span class="cnt">from ${H(fd(x.fromDate))}</span>`:""}</span></label></div>`;
function teamView(my,it){const a=it.agenda||{};const day=H(new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}));
  const blocks=(a.blocks||[]).length?a.blocks:(it.startBlocks||[]);
  draw(my,head("Team meeting",it.room+" Class team meeting",day+(it.start?", "+H(tm(it.start))+(it.end?" to "+H(tm(it.end)):""):""))+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gpd="">‹ PD days</button><button class="btn small" data-gpdedit="1">${(a.blocks||[]).length||a.notes?"Change the agenda and notes":"Build the agenda"}</button><button class="btn small ghost" data-gprint="team">Print</button><button class="linkbtn" data-gword="team">Word</button></div>`+
    ((it.carried||[]).length?card("Next steps from earlier team meetings",`<div class="hint">Each stays here until it is marked done.</div>${it.carried.map(x=>stepRow(x,x.from)).join("")}`):"")+
    card(a.blocks?"The agenda":"The agenda, started from the Class's week",blocks.length?`<div style="display:grid;gap:8px">${agendaBlocksHtml({blocks})}</div>`:`<div class="cnt">Nothing from the Class's week yet. Build the agenda to add items.</div>`)+
    (a.notes?card("Notes",`<div style="white-space:pre-wrap">${H(a.notes)}</div>`):"")+
    ((a.steps||[]).length?card("Next steps",(a.steps||[]).map(x=>stepRow(x,it.id)).join("")):""))}
function teamBuilder(my,it){
  if(!st.pdEdit.blocks){const a=it.agenda||{};st.pdEdit={date:it.date,kind:"team",room:it.room,title:a.title||"",start:a.start||"",end:a.end||"",blocks:JSON.parse(JSON.stringify((a.blocks||[]).length?a.blocks:(it.startBlocks||[]))),notes:a.notes||"",steps:JSON.parse(JSON.stringify(a.steps||[])),loaded:true,found:{}}}
  const E=st.pdEdit;const who=teamWho(it);
  const blk=(b,i)=>`<div class="gblock"><label class="fld-label">Item<input type="text" data-gbk="${i}|title" value="${H(b.title||"")}"></label><label class="fld-label">What it holds<textarea rows="2" data-gbk="${i}|why">${H(b.why||"")}</textarea></label>
    <div class="actions" style="margin:0"><button class="linkbtn" data-gbkmv="${i}|-1">Move up</button><button class="linkbtn" data-gbkmv="${i}|1">Move down</button><button class="linkbtn" data-gbkrm="${i}">Remove</button></div></div>`;
  const stp=(x,i)=>`<div class="gblock"><label class="fld-label">Next step<input type="text" data-gstp="${i}|text" value="${H(x.text||"")}"></label><div class="kfields"><label>Who<select data-gstp="${i}|who"><option value="">Choose</option>${[...new Set([...who,x.who].filter(Boolean))].map(n=>`<option ${x.who===n?"selected":""}>${H(n)}</option>`).join("")}</select></label><label class="radio"><input type="checkbox" data-gstp="${i}|done" ${x.done?"checked":""}><span>Done</span></label></div><div class="actions" style="margin:0"><button class="linkbtn" data-gstprm="${i}">Remove</button></div></div>`;
  draw(my,head("Team meeting",it.room+" Class team meeting",H(new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))+". The Class team and the director see it.")+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gpdedit="0">‹ The team meeting</button></div>`+
    card("Agenda",`<div class="hint">Started from the Class's week, plans waiting to be finished, the threads, projects and team inquiries the team is following, and a few recent observations. Remove or add what you want.</div><div style="display:grid;gap:8px">${E.blocks.map(blk).join("")}</div><div class="actions"><button class="btn small ghost" data-gbkadd="1">Add an item</button></div>`)+
    card("Notes",`<textarea id="gte-notes" rows="5" placeholder="What the team talked about">${H(E.notes||"")}</textarea>`)+
    card("Next steps",`<div class="hint">Each with a person. A next step stays on the next team meeting's agenda until it is marked done.</div><div style="display:grid;gap:8px">${E.steps.map(stp).join("")}</div><div class="actions"><button class="btn small ghost" data-gstpadd="1">Add a next step</button></div>`)+
    `<div class="actions"><button class="btn" data-gteamsave="1">Save the team meeting</button></div>`)}
const collectTeam=()=>collectAgenda();
function teamDoc(it){const a=it.agenda||{};const blocks=(a.blocks||[]).length?a.blocks:(it.startBlocks||[]);
  return report(it.room+" Class team meeting",[["Day",new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})]],[
    ...blocks.map(b=>({t:"text",label:b.title,text:b.why||""})),a.notes?{t:"text",label:"Notes",text:a.notes}:null,
    [...(it.carried||[]),...(a.steps||[])].length?{t:"list",label:"Next steps",items:[...(it.carried||[]),...(a.steps||[])].map(x=>x.text+(x.who?", "+x.who:"")+(x.done?", done":""))}:null].filter(Boolean))}
function agendaView(my,it){const a=it.agenda||{};const dir=isDir();const closed=it.date<=today();const mine=it.mine||{};
  draw(my,head(it.kind==="meeting"?"PD staff meeting":"PD day",a.title||it.title||(it.kind==="meeting"?"PD staff meeting":"PD day"),H(new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))+(a.start?", "+H(tm(a.start))+(a.end?" to "+H(tm(a.end)):""):""))+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gpd="">‹ PD days</button>${dir?`<button class="btn small" data-gpdedit="1">Build the agenda</button>`:""}<button class="btn small ghost" data-gprint="agenda">Print</button><button class="linkbtn" data-gword="agenda">Word</button></div>`+
    card("The agenda",(a.blocks||[]).length?`<div style="display:grid;gap:8px">${agendaBlocksHtml(a)}</div>`:`<div class="cnt">The director has not built this agenda yet.</div>`)+
    (dir&&it.kind==="meeting"&&it.date>=today()?card("Move this meeting",`<div class="hint">Choose another day this month. The agenda, the reminders and Today follow it, and no Class team meeting falls on the new day.</div><div class="kfields"><label>New day<input type="date" id="gpd-move" min="${H(it.date.slice(0,7))}-01" max="${H(it.date.slice(0,7))}-31" value="${H(it.date)}"></label></div><div class="actions"><button class="btn small ghost" data-gpdmove="${H(it.date.slice(0,7))}">Move it</button><button class="linkbtn" data-gpdmovenone="${H(it.date.slice(0,7))}">No all-staff meeting this month</button></div>`):"")+
    (!dir&&(a.blocks||[]).length?card("My plus delta",closed?`<div class="hint">What went well and what to change. The director reads them together, and they shape the next PD day.</div><div class="gcols"><label class="fld-label">Plus<textarea rows="3" id="gpdd-plus">${H(mine.plus||"")}</textarea></label><label class="fld-label">Delta<textarea rows="3" id="gpdd-delta">${H(mine.delta||"")}</textarea></label></div><div class="actions"><button class="btn" data-gpddsave="${H(it.id)}">Save</button>${mine.at?`<span class="cnt">Saved ${H(fms(mine.at))}</span>`:""}</div>`:`<div class="cnt">Written in TREE on your phone in the last fifteen minutes of the day.</div>`):""))}
function agendaBuilder(my,it){const R=st.readings||[];
  if(!st.pdEdit.blocks){const a=it.agenda||{};st.pdEdit=Object.assign({date:it.date,kind:it.kind,mode:a.mode||"full",title:a.title||it.title||"",start:a.start||it.start||(it.kind==="meeting"?B().settings.meeting.start:""),end:a.end||it.end||(it.kind==="meeting"?B().settings.meeting.end:""),blocks:JSON.parse(JSON.stringify((a.blocks||[]).filter(b=>!b.closing)))},{loaded:true,sug:st.pdEdit.sug||null,found:{}})}
  const E=st.pdEdit;const full=E.mode==="full";const pdl=(it.agenda||{}).plusDeltaList||[];
  const relevant=b=>{const kw=String(b.title+" "+b.why).toLowerCase().split(/[^a-z]+/).filter(w=>w.length>4);return R.filter(x=>!(b.readings||[]).includes(x.id)&&((b.area&&(x.areas||[]).includes(b.area))||(b.module&&(x.modules||[]).includes(b.module))||kw.some(w=>String(x.title+" "+x.supports).toLowerCase().includes(w)))).slice(0,8)};
  const blk=(b,i)=>`<div class="gblock"><div class="kfields"><label>Time<input type="time" data-gbk="${i}|time" value="${H(b.time||"")}"></label><label style="grid-column:span 2">Title<input type="text" data-gbk="${i}|title" value="${H(b.title||"")}"></label></div>
    ${full?`<label class="fld-label">Why it matters for the children<input type="text" data-gbk="${i}|why" value="${H(b.why||"")}"></label>
    <div class="kfields"><label>How the time is spent<select data-gbk="${i}|how"><option value="">Choose</option>${Object.entries(HOW).map(([k,l])=>`<option value="${k}" ${b.how===k?"selected":""}>${l}</option>`).join("")}</select></label><label>Area<select data-gbk="${i}|area"><option value="">None</option>${AK().map(k=>`<option value="${k}" ${b.area===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select></label><label>PD module it supports<select data-gbk="${i}|module"><option value="">None</option>${B().modules.filter(m=>m.ready).map(m=>`<option value="${m.slug}" ${b.module===m.slug?"selected":""}>${H(m.title)}</option>`).join("")}</select></label></div>
    <label class="fld-label">What to prepare<input type="text" data-gbk="${i}|prepare" value="${H(b.prepare||"")}"></label>
    <div class="cnt">Linked readings</div>${(b.readings||[]).map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>`<div class="cnt">${H(x.title)}, ${H(x.source)} <button class="linkbtn" data-gbkrd="${i}|${H(x.id)}|0">Take it out</button></div>`).join("")||`<div class="cnt muted">None chosen yet</div>`}
    <details><summary class="cnt">Suggested readings for this block</summary><div class="gex">${relevant(b).map(x=>`<div class="cnt">${x.url?treeReadLink(x.url,x.title):H(x.title)}, ${H(x.source)}${x.supports?` <span class="muted">${H(x.supports)}</span>`:""} <button class="linkbtn" data-gbkrd="${i}|${H(x.id)}|1">Choose</button></div>`).join("")||`<div class="cnt">Give the block an area, a module or a title to see readings.</div>`}
      ${(E.found[i]||[]).map((x,j)=>`<div class="cnt"><a href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a>, ${H(x.source)} <button class="linkbtn" data-gbkfound="${i}|${j}">Add to the library and choose</button></div>`).join("")}
      <div class="actions"><button class="btn small ghost" data-gbksearch="${i}">${st.searching===i?"Searching trusted sources":"Search trusted sources for new ones"}</button></div></div></details>`:""}
    <label class="fld-label">Who gives it<select data-gbk="${i}|guest"><option value="">Our team</option><option value="yes" ${b.guest&&b.guest!=="no"?"selected":""}>A guest session, outside presenters</option></select></label>
    ${b.guest&&b.guest!=="no"?`<div class="kfields"><label style="grid-column:span 2">Presenters<input type="text" data-gbk="${i}|guestBy" value="${H(b.guestBy||"")}"></label><label style="grid-column:span 2">Their organization<input type="text" data-gbk="${i}|guestOrg" value="${H(b.guestOrg||"")}"></label><label>Length, in minutes<input type="number" min="0" step="15" data-gbk="${i}|guestMinutes" value="${H(b.guestMinutes||"")}"></label><label>People<input type="number" min="0" data-gbk="${i}|guestPeople" value="${H(b.guestPeople||"")}"></label><label style="grid-column:span 2">Link<input type="url" data-gbk="${i}|guestLink" value="${H(b.guestLink||"")}" placeholder="https://"></label><label style="grid-column:span 2">Handout, a link if there is one<input type="url" data-gbk="${i}|guestHandout" value="${H(b.guestHandout||"")}" placeholder="https://"></label></div><div class="cnt">A guest session counts toward PD hours for each educator marked present.</div>`:""}
    <label class="fld-label">Opens a Presenting entry<select data-gbk="${i}|presenting"><option value="">None</option>${(st.presList||[]).map(x=>`<option value="${H(x.id)}" ${b.presenting===x.id?"selected":""}>${H(x.title)}${x.date?", "+H(fd(x.date)):""}</option>`).join("")}</select></label>
    <div class="actions" style="margin:0"><button class="linkbtn" data-gbkmv="${i}|-1">Move up</button><button class="linkbtn" data-gbkmv="${i}|1">Move down</button><button class="linkbtn" data-gbkrm="${i}">Remove</button></div></div>`;
  draw(my,head(it.kind==="meeting"?"PD staff meeting":"PD day","Build the agenda",H(new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))+`. Staff see it from ${H(fd(X.addDays(it.date,-14)))}, two weeks ahead, and hear a reminder three days before.`)+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gpdedit="0">‹ The agenda</button></div>`+
    card("This time",`${seg("data-gpdmode",[["full","Full, with TREE's suggested topics and readings"],["light","Light, I type the items myself"]],E.mode)}<div class="kfields" style="margin-top:8px"><label style="grid-column:span 2">Title<input type="text" id="gpde-title" value="${H(E.title)}"></label><label>Starts<input type="time" id="gpde-start" value="${H(E.start||"")}"></label><label>Ends<input type="time" id="gpde-end" value="${H(E.end||"")}"></label></div>`)+
    (full?card("Suggestions from TREE",E.sug?`<div class="hint">Each with the reasons TREE noticed. Nothing from an individual check-in, journal or evaluation appears with a name.</div><div style="display:grid;gap:8px">${E.sug.map((s,i)=>`<div class="gsug"><b>${H(s.topic)}</b>${s.why.map(w=>`<div class="cnt">${H(w)}</div>`).join("")}<div><button class="btn small ghost" data-gsugadd="${i}">Add as a block</button></div></div>`).join("")||`<div class="cnt">Nothing stands out right now.</div>`}</div>`:`<div class="actions" style="margin:0"><button class="btn small ghost" data-gsugload="1">Show TREE's suggestions</button></div>`):"")+
    card("Blocks",`<div style="display:grid;gap:8px">${E.blocks.map(blk).join("")}</div><div class="actions"><button class="btn small ghost" data-gbkadd="1">Add a block</button></div><div class="gblock" style="margin-top:8px"><b>Plus delta</b><div class="cnt">Every agenda ends here. In the last fifteen minutes, each educator writes what went well and what to change in TREE on their phone, and the group shares a few aloud before leaving.</div></div>`)+
    `<div class="actions"><button class="btn" data-gpdsave="1">Save the agenda</button></div>`+
    (pdl.length?card("Plus delta from this day",`<div class="hint">Read together. They shape the next PD day's suggestions.</div><div class="gcols"><div><b>Plus</b>${pdl.filter(x=>x.plus).map(x=>`<div class="gq">${H(x.plus)}</div>`).join("")}</div><div><b>Delta</b>${pdl.filter(x=>x.delta).map(x=>`<div class="gq">${H(x.delta)}</div>`).join("")}</div></div>`):"")+
    card("Hours",`<div class="hint">Logged on each attendee's records page as our PD hours, ${H(it.hours)} hours.</div><div class="chips">${B().people.map(p=>`<button class="chip ${((it.agenda||{}).logged||{names:[]}).names.includes(p.name)?"":"on"}" type="button" data-gpdname="${H(p.name)}">${H(p.name)}</button>`).join("")}</div><div class="actions"><button class="btn small" data-gpdhours="${H(it.id)}">Log the hours for everyone chosen</button>${(it.agenda||{}).logged?`<span class="cnt">Logged ${H(fms(it.agenda.logged.at))}</span>`:""}</div>`))}

/* ---------- settings ---------- */
Gr.settingsHtml=function(SB){const b=B();if(!b)return "";const c=b.settings.checkin,m=b.settings.meeting;
  return `<div class="prow" style="margin-top:12px"><div><b>Check-ins</b><div class="cnt">Class educators meet on one Monday a month in their planning slot. Those on the short second Monday meet the next open Monday.</div></div>
    <span class="actions" style="margin:0"><label class="cnt">Monday<select id="gs-week">${[1,2,3,4].map(n=>`<option value="${n}" ${+c.week===n?"selected":""}>${["","First","Second","Third","Fourth"][n]} Monday</option>`).join("")}</select></label><label class="cnt">Short second Monday at<input type="time" id="gs-second" value="${H(c.secondTime||"")}"></label></span></div>
    <div class="prow"><div><b>Monthly PD staff meetings</b><div class="cnt">On the TREE calendar, with the same agenda builder</div></div><span class="actions" style="margin:0"><input type="time" id="gs-mstart" value="${H(m.start)}" aria-label="Starts"><input type="time" id="gs-mend" value="${H(m.end)}" aria-label="Ends"></span></div>
    <div class="actions"><button class="btn small" data-gsset="1">Save the check-in and meeting times</button></div>`};

/* ---------- printouts and Word files ---------- */
function evalDoc(d){const y=yr();const ev=(d.evals||{})[y]||{};const sc=scoresOf(d,y);const past=Object.keys(d.evals||{}).filter(k=>k<y).sort();const dv=ev.dir||{},self=ev.self||{};const pr=d.profile||{};
  const strengths=dv.strengths||strengthsDraft(d);
  return report("End of year evaluation, "+d.name,[["School year",yrLabel(y)],["Class",pr.room?pr.room+" Class":""],["Printed",fd(today())]],[
    {t:"text",label:"Strengths",text:strengths||"Written with the director at the end of the year."},
    {t:"table",label:"Growth across the year",head:["Area",...past.map(yrLabel),yrLabel(y),"Own placement"],rows:[...AK().map(k=>[areaName(k),...past.map(p=>{const v=scoresOf(d,p).by[k];return v==="nys"?"Not yet seen":v?v+" "+PN[v]:""}),sc.by[k]==="nys"?"Not yet seen":sc.by[k]?sc.by[k]+" "+PN[sc.by[k]]:"",(self.placements||{})[k]?self.placements[k]+" "+PN[self.placements[k]]:""]),["Overall, the average of scored areas",...past.map(p=>String(scoresOf(d,p).overall||"")),String(sc.overall||""),""]]},
    ...AK().filter(k=>numeric(sc.by[k])).map(k=>({t:"text",label:areaName(k),text:(contArea(k).points[numeric(sc.by[k])-1]||{}).text||""})),
    dv.narrative?{t:"text",label:"The director's narrative",text:X.plain(dv.narrative)}:null,
    ...AK().filter(k=>(self.writes||{})[k]).map(k=>({t:"text",label:"In "+(d.name)+"'s words, "+areaName(k),text:self.writes[k]})),
    self.closing?{t:"text",label:"Where I want to grow next year",text:self.closing}:null,
    {t:"list",label:"Goals for next year",items:(ev.goals||[]).map(x=>x.text+(x.area?", "+areaName(x.area):""))}])}
function agendaDoc(it){const a=it.agenda||{};const R=st.readings||[];
  return report(a.title||it.title||(it.kind==="meeting"?"PD staff meeting":"PD day"),[["Day",new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})],["Time",a.start?tm(a.start)+(a.end?" to "+tm(a.end):""):""]],
    (a.blocks||[]).map(b=>({t:"text",label:(b.time?tm(b.time)+", ":"")+b.title,text:[b.guest?"Guest session. "+guestLine(b)+"."+(b.guestLink?" "+b.guestLink:"")+(b.guestHandout?" Handout, "+b.guestHandout:""):"",b.why,b.how?HOW[b.how]+".":"",b.prepare?"To prepare. "+b.prepare:"",(b.readings||[]).map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>[x.title,x.source||x.cite].filter(Boolean).join(", ")+(x.onSite&&isBookR(x)?", in our library":"")+(x.url?" ("+treeReadPlace(x.url)+")":"")).join(". ")].filter(Boolean).join(" ")})))}

/* ---------- a former educator's growth, read only, for the director in Former educators ---------- */
const fold=(k,title,side,inner)=>`<details class="card fold" data-fold="sf:${H(k)}" ${typeof foldOpen!=="undefined"&&foldOpen.has("sf:"+k)?"open":""}><summary class="foldhead"><span class="lbl" style="margin:0">${H(title)}</span>${side?`<span class="cnt">${H(side)}</span>`:""}</summary><div class="foldbody" style="display:grid;gap:8px">${inner}</div></details>`;
const said=(l,v)=>String(v||"").trim()?`<div class="gq"><div class="cnt">${H(l)}</div><div style="white-space:pre-line">${H(v)}</div></div>`:"";
const placed=pl=>AK().filter(k=>pl&&pl[k]).map(k=>`<div class="cnt">${H(areaName(k))}, ${pl[k]==="nys"?"Not yet seen":H(PN[+pl[k]]||"")}</div>`).join("");
Gr.formerHtml=async function(name){await Gr.ready();if(!B())return "";const r=await ga("former",{name});const d=r.growth||{};const k=name.toLowerCase().replace(/[^a-z0-9]+/g,"-");
  const years=o=>Object.keys(o||{}).sort().reverse();
  const plans=years(d.plans).map(y=>{const p=d.plans[y]||{};return `<div class="garea"><b>${H(yrLabel(y))}</b>${said("What went well",(p.wentWell||{}).text)}${REFL.map(([x,l])=>said(l,(p.reflection||{})[x])).join("")}
    ${(p.goals||[]).filter(g=>String(g.text||"").trim()).map((g,i)=>said(`Goal ${i+1}${g.area?", "+areaName(g.area):""}`,g.text)).join("")}${said("Challenges I'm anticipating",p.challenges)}${said("What I need from the director",(p.need||{}).director)}${said("From my team",(p.need||{}).team)}${said("From training",(p.need||{}).training)}${said("A note",p.note)}</div>`}).join("");
  const cis=(d.checkins||[]).map(c=>`<div class="garea"><b>${H(fd(c.date))}</b>${(c.temp||{}).self||(c.temp||{}).dir?`<div class="cnt">Professional temperature, ${H((c.temp||{}).self||"not given")} and the director's ${H((c.temp||{}).dir||"not given")}</div>`:""}${said("Temperature in their words",(c.temp||{}).words)}${said("Plus",c.plus)}${said("Delta",c.delta)}${said("Growth Plan check",c.goalsLine)}${said("One support",c.support)}
    ${said("Focus Until Next Time",(c.focus||{}).settled)}${said("Follow-up notes",c.followup)}${said("Earlier answer, the work",c.work)}${said("Earlier answer, a challenge",c.challenge)}</div>`).join("");
  const evs=years(d.evals).map(y=>{const ev=d.evals[y]||{},s=ev.self||{},v=ev.dir||{};return `<div class="garea"><b>${H(yrLabel(y))}</b>${placed(s.placements)?`<div class="cnt" style="margin-top:6px"><b>Their own placements</b></div>${placed(s.placements)}`:""}${Object.entries(s.writes||{}).map(([a,t])=>said(areaName(a),t)).join("")}${said("Closing",s.closing)}
    ${placed(v.placements)?`<div class="cnt" style="margin-top:6px"><b>Your placements</b></div>${placed(v.placements)}`:""}${said("Strengths",v.strengths)}${said("Narrative",v.narrative)}${(ev.goals||[]).map((g,i)=>said(`Next year's goal ${i+1}${g.area?", "+areaName(g.area):""}`,g.text)).join("")}</div>`}).join("")+
    (d.starting&&(d.starting.notes||placed(d.starting.placements))?`<div class="garea"><b>Starting-point conversation</b>${placed(d.starting.placements)}${said("Notes",d.starting.notes)}</div>`:"");
  const ms=(r.moments||[]).map(m=>`<div class="gmom"><div class="cnt">${H(m.kind==="kudos"?`Kudos from ${m.by} to ${m.to}`:`A proud moment by ${m.by}`)}, ${H(fms(m.at))}</div><div style="white-space:pre-line">${H(m.text)}</div></div>`).join("");
  const J=st.fj&&st.fj.who===name?st.fj:null;
  const jr=J?(J.entries.length?J.entries.map(e=>`<div class="garea"><b>${H(fd(e.date))}</b>${PROMPTS.filter(([x])=>e[x]).map(([x,l])=>said(l,e[x])).join("")}</div>`).join(""):`<div class="cnt">No journal entries.</div>`)
    :`<div class="hint">The journal asks for your TREE passcode each time it opens.</div><div class="kfields"><label>Your TREE passcode<input type="password" inputmode="numeric" autocomplete="current-password" id="gfj-pass" maxlength="40"></label></div><div class="actions"><button class="btn small" data-gfjopen="${H(name)}">Open the journal</button></div>`;
  return fold(k+":plan","Growth Plan",years(d.plans).length?years(d.plans).map(yrLabel).join(", "):"",plans||`<div class="cnt">No Growth Plan was kept.</div>`)+
    fold(k+":ci","Check-ins",(d.checkins||[]).length?String(d.checkins.length):"",cis||`<div class="cnt">No check-ins were kept.</div>`)+
    fold(k+":eval","Evaluations",years(d.evals).map(yrLabel).join(", "),evs||`<div class="cnt">No evaluation was kept.</div>`)+
    fold(k+":jour","Journal",J?String(J.entries.length):"",jr)+
    fold(k+":mom","Proud Moments",(r.moments||[]).length?String(r.moments.length):"",ms||`<div class="cnt">No Proud Moments or Kudos.</div>`)};

/* ---------- taps ---------- */
const val=s=>{const e=$(s);return e?e.value:""};
Gr.leave=()=>{st.jr=null;st.fj=null;st.jDraft=null};
document.addEventListener("click",e=>{const t=e.target.closest("#tsubnav [data-tview],#ttab [data-tsec],#tnav [data-tsec]");if(!t)return;
  // leaving a page closes the journal, so it asks for the passcode again
  // the typing in an agenda being built is kept for that day, and opens again with Build the agenda
  try{collectAgenda()}catch(er){}if(st.pdEdit&&st.pdEdit.blocks&&st.pdSel)st.pdStash={id:st.pdSel,edit:st.pdEdit};
  st.jr=null;st.fj=null;st.jDraft=null;st.self=false;st.selfDraft=null;st.starting=false;st.startDraft=null;st.tab="";st.ci=null;st.ciWho="";st.pdSel="";st.pdEdit=null;st.editCont=false;st.planDraft=null;st.examplesPick=null},true);
document.addEventListener("click",e=>{const t=e.target.closest("[data-gsel],[data-gtab],[data-gself],[data-gselfback],[data-gselfpt],[data-gwrite],[data-gselfsave],[data-gdir],[data-gdirsave],[data-gmeet],[data-gnextsave],[data-gstart],[data-gstartback],[data-gstartpt],[data-gstartsave],[data-gcont],[data-gcontsave],[data-gpww],[data-gpok],[data-gpadd],[data-gpsave],[data-gjopen],[data-gjself],[data-gjclose],[data-gjsave],[data-gjbring],[data-gcpre],[data-gcfollow],[data-gci],[data-gciback],[data-gciopen],[data-gctemps],[data-gctempd],[data-gcalign],[data-gceffect],[data-gcsave],[data-gbook],[data-gmkind],[data-gmaud],[data-gmshare],[data-gmphoto],[data-gmview],[data-gmrm],[data-gexrm],[data-gexsave],[data-gmodsave],[data-grlready],[data-gmready],[data-gmcarry],[data-gmlead],[data-gmodfinish],[data-gpd],[data-gpdedit],[data-gpdadd],[data-gpdmode],[data-gsugload],[data-gsugadd],[data-gbkadd],[data-gbkrm],[data-gbkmv],[data-gbkrd],[data-gbksearch],[data-gbkfound],[data-gpdsave],[data-gpdname],[data-gpdhours],[data-gpddsave],[data-gprint],[data-gword],[data-gsset],[data-gfjopen],[data-gpres],[data-gstpadd],[data-gstprm],[data-gteamsave]");
  if(!t)return;X.tapOnce(t,()=>gTap(e,t))},true);
async function gTap(e,t){const d=t.dataset;
  if(d.gpres){if(window.TreePres){TreePres.open(d.gpres);goView("stpres")}return}
  const ro=VIEW_AS&&!d.gsel&&!d.gtab&&!d.gpd&&!d.gprint&&!d.gword&&!d.gciback&&!d.gselfback;if(ro){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  try{
  if(d.gsel!=null){st.sel=d.gsel;st.jself=false;st.tab="";st.planDraft=null;st.jr=null;st.self=false;st.starting=false;redraw();return}
  if(d.gtab){st.tab=d.gtab;redraw();return}
  if(d.gself){st.self=true;st.selfDraft=null;T.render("stgrow");return}
  if(d.gselfback){st.self=false;T.render("stgrow");return}
  if(d.gselfpt){const [k,n]=d.gselfpt.split("|");st.selfDraft.placements[k]=+n;redraw();return}
  if(d.gselfsave!=null){collectSelf();const r=await ga("eval/self",{self:Object.assign({},st.selfDraft,{done:d.gselfsave==="1"})});setDoc(meName(),r);toast(d.gselfsave==="1"?"Thank you. It is ready for the meeting.":"Saved.");if(d.gselfsave==="1"){st.self=false;st.selfDraft=null}T.render("stgrow");return}
  if(d.gdir){const [k,v]=d.gdir.split("|");const dd=st.docs[st.sel];const ev=(dd.evals[yr()]=dd.evals[yr()]||{});ev.dir=ev.dir||{placements:{}};ev.dir.placements=ev.dir.placements||{};collectDir();ev.dir.placements[k]=v==="nys"?"nys":+v;st._dirDirty=true;
    const r=await ga("eval/director",{name:st.sel,dir:Object.assign({},ev.dir,{done:false})});setDoc(st.sel,r);redraw();return}
  if(d.gdirsave!=null){const dd=st.docs[st.sel];const ev=(dd.evals[yr()]=dd.evals[yr()]||{});ev.dir=ev.dir||{placements:{}};collectDir();const r=await ga("eval/director",{name:st.sel,dir:Object.assign({},ev.dir,{done:d.gdirsave==="1"})});setDoc(st.sel,r);toast("Saved.");redraw();return}
  if(d.gmeet){if(!confirm(`Open the meeting view? ${st.sel} will see both placements side by side.`))return;const r=await ga("eval/meeting",{name:st.sel});setDoc(st.sel,r);toast("The meeting view is open.");redraw();return}
  if(d.gnextsave){const goals=[...document.querySelectorAll("[data-gnext]")].map(x=>({text:x.value,area:suggestArea(x.value)}));const r=await ga("eval/goals",{name:who(),goals});setDoc(who(),r);toast("Saved, and carried into next year's Growth Plan.");redraw();return}
  if(d.gstart){st.starting=true;st.startDraft=null;redraw();return}
  if(d.gstartback){st.starting=false;redraw();return}
  if(d.gstartpt){const [k,n]=d.gstartpt.split("|");st.startDraft.placements[k]=+n;redraw();return}
  if(d.gstartsave!=null){st.startDraft.notes=val("#g-startnotes");const done=d.gstartsave==="1";const r=await ga("starting",{name:st.sel,starting:Object.assign({},st.startDraft,{done,shared:done})});setDoc(st.sel,r);toast(done?"Done. It shows on their growth page and their checklist.":"Saved.");if(done){st.starting=false}redraw();return}
  if(d.gcont!=null){st.editCont=d.gcont==="1";redraw();return}
  if(d.gcontsave){const areas={};document.querySelectorAll("[data-gct]").forEach(x=>{const [k,i,f]=x.dataset.gct.split("|");areas[k]=areas[k]||[];areas[k][+i]=areas[k][+i]||{};areas[k][+i][f]=x.value});const r=await ga("continuum/save",{areas});st.boot.continuum=r.continuum;toast("Approved for the year.");st.editCont=false;redraw();return}
  if(d.gpww){collectPlan();st.planDraft.wentWell.choice=d.gpww;redraw();return}
  if(d.gpok!=null){collectPlan();const x=st.planDraft.goals[+d.gpok];x.area=x.area||suggestArea(x.text);if(!x.area){toast("Choose the area first.");return}x.areaOk=true;redraw();return}
  if(d.gpadd){collectPlan();st.planDraft.goals.push({id:"g"+Math.random().toString(36).slice(2,8),text:"",area:"",areaOk:false});redraw();return}
  if(d.gpsave){collectPlan();const p=st.planDraft;const body={wentWell:p.wentWell,goals:p.goals.filter(x=>String(x.text||"").trim()),challenges:p.challenges,need:p.need,reflection:p.reflection};
    if(!isDir())body.feedback=p.feedback||"";else{body.note=val("#gp-note");body.source=$("#gp-aug")&&$("#gp-aug").checked?"august":"tree"}
    const r=await ga("plan",{name:who(),plan:body});setDoc(who(),r);st.planDraft=null;toast("Saved.");redraw();return}
  if(d.gfjopen){const pass=val("#gfj-pass");if(!pass){toast("Type your TREE passcode.");return}const r=await ga("journal/open",{name:d.gfjopen,passcode:pass});st.fj={who:d.gfjopen,entries:r.entries||[]};if(typeof foldOpen!=="undefined")foldOpen.add("sf:"+d.gfjopen.toLowerCase().replace(/[^a-z0-9]+/g,"-")+":jour");redraw();return}
  if(d.gjself){st.jself=true;st.jr=null;st.jDraft=null;redraw();return}
  if(d.gjopen){const pass=val("#gj-pass");if(!pass){toast("Type your TREE passcode.");return}const r=await ga("journal/open",{name:jWho(),passcode:pass});st.jr=r;st.jrWho=jWho();st.jDraft=null;redraw();return}
  if(d.gjclose){st.jr=null;st.jDraft=null;redraw();return}
  if(d.gjsave!=null){const entry={id:d.gjsave||""};document.querySelectorAll("[data-gjf]").forEach(x=>entry[x.dataset.gjf]=x.value);if(![...PROMPTS.map(([k])=>k),"module"].some(k=>String(entry[k]||"").trim())){toast("Write a few honest sentences first.");return}
    const r=await ga("journal/save",{name:jWho(),key:st.jr.key,entry});Object.assign(st.jr,r);st.jDraft=null;toast(isDir()?"Saved. Only you read it.":"Saved. Only you and the director see it.");redraw();return}
  if(d.gjbring){const [id,to]=d.gjbring.split("|");const r=await ga("journal/bring",{name:jWho(),key:st.jr.key,id,to});st.jr.entries=r.entries;redraw();return}
  if(d.gcpre){const r=await ga("checkin/pre",{focus:val("#gc-pre")});setDoc(meName(),r);toast("Saved. You can talk it through at your check-in.");redraw();return}
  if(d.gcfollow){const r=await ga("checkin/followed",{id:d.gcfollow});setDoc(meName(),r);redraw();return}
  if(d.gci){st.ciWho=d.gci;st.ciDate=d.gcidate||"";st.ci=null;redraw();window.scrollTo(0,0);return}
  if(d.gciback){st.ciWho="";st.ci=null;redraw();return}
  if(d.gciopen){const dd=st.docs[st.ciWho];st.ci=Object.assign({temp:{},align:{},goals:{},focus:{}},JSON.parse(JSON.stringify((dd.checkins||[]).find(c=>c.id===d.gciopen))),{__who:st.ciWho});redraw();window.scrollTo(0,0);return}
  if(d.gctemps||d.gctempd||d.gcalign||d.gceffect){collectCi();const c=st.ci;if(d.gctemps)c.temp.self=+d.gctemps;if(d.gctempd)c.temp.dir=+d.gctempd;if(d.gcalign)c.align.rating=+d.gcalign;if(d.gceffect)c.effect=+d.gceffect;redraw();return}
  if(d.gcsave){collectCi();const r=await ga("checkin/save",{name:st.ciWho,checkin:st.ci});setDoc(st.ciWho,r);st.ci=Object.assign({temp:{},align:{},goals:{},focus:{}},JSON.parse(JSON.stringify((r.checkins||[]).find(c=>c.date===st.ci.date)||st.ci)),{__who:st.ciWho});toast("Saved.");redraw();return}
  if(d.gbook){const day=$(`[data-gbookd="${CSS.escape(d.gbook)}"]`),time=$(`[data-gbookt="${CSS.escape(d.gbook)}"]`);await ga("checkin/book",{name:d.gbook,date:day&&day.value,time:time&&time.value});bootP=null;await Gr.ready();toast("Set, and on the TREE calendar.");redraw();return}
  if(d.gmkind){collectMoment();st.mform.kind=d.gmkind;redraw();return}
  if(d.gmaud){collectMoment();st.mform.audience=d.gmaud;redraw();return}
  if(d.gmphoto){collectMoment();const f=await X.pickFile();if(!f)return;if(!/image\/(jpeg|png)/.test(f.type)){toast("Choose a JPEG or PNG photo.");return}progress("Keeping the photo");const r=await api("upload",{moment:true,filename:f.name||"photo.jpg",data:await X.b64(f)});st.mform.photo=r.fid;toast("Photo added.");redraw();return}
  if(d.gmview){progress("Opening the photo");const r=await fetch(window.FP_SERVER+"/api/staff/moment/file",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(localStorage.getItem("fp-token")||"")},body:JSON.stringify({fid:d.gmview})});if(!r.ok){toast("The photo could not be opened.");return}const u=URL.createObjectURL(await r.blob());window.open(u,"_blank","noopener");return}
  if(d.gmshare){collectMoment();const f=st.mform;if(f.kind!=="kudos"&&!f.area)f.area=suggestArea(f.text);const r=await ga("moments/add",{moment:f});st.mform={kind:f.kind,audience:"everyone"};st.moments=null;toast(r.moment.audience==="everyone"?"Shared with everyone at our school.":"Shared.");redraw();return}
  if(d.gmrm){if(!confirm("Remove this?"))return;await ga("moments/remove",{id:d.gmrm});st.moments=null;redraw();return}
  if(d.gexrm!=null){st.examplesPick.list.splice(+d.gexrm,1);redraw();return}
  if(d.gexsave){const p=st.examplesPick;const add=val("#gex-add");if(add){const [k,id]=add.split("|");const x=(st._exPool||[]).find(y=>y.id===id);if(x)p.list.push({kind:k,id,text:x.text,label:x.label})}p.shown=!!($("#gex-shown")&&$("#gex-shown").checked);
    await ga("module/examples",{slug:d.gexsave,examples:p.list,shown:p.shown});st.mods=null;st.examplesPick=null;toast(p.shown?"Saved and shown to educators.":"Saved, hidden from educators.");redraw();return}
  if(d.grlready){const r=await ga("readings/ready",{on:d.grlready==="1"});st.rlib=r;toast(d.grlready==="1"?"Marked ready. Educators see them now.":"Hidden again.");redraw();return}
  if(d.gmready){const [slug,on]=d.gmready.split("|");const r=await ga("module/ready",{slug,on:on==="1"});st.mods.modules=r.modules;if(B())B().modules=r.list;toast(on==="1"?"Marked ready. Educators see it now.":"Hidden again. Only you see it.");redraw();return}
  if(d.gmcarry){const q=t.closest(".gq").querySelector(".stq").textContent;const on=t.getAttribute("aria-pressed")==="true";const r=await ga("module/carry",{slug:d.gmcarry,prompt:on?"":q});toast(on?"Taken out of your journal.":"It shows in your journal this week.");redraw();return}
  if(d.gmlead){const m=(st.mods.modules||{})[d.gmlead];const r=await api("pres/new",{title:m.title,template:true,module:d.gmlead});if(window.TreePres){TreePres.open(r.id);goView("stpres")}return}
  if(d.gmodsave||d.gmodfinish){const slug=d.gmodsave||d.gmodfinish;const r=await ga("module/progress",{slug,progress:{reflection:val("#gmod-ref"),share:val("#gmod-share"),finish:!!d.gmodfinish}});setDoc(meName(),r);toast(d.gmodfinish?"Finished. Its hours are on your records page as our PD hours.":"Saved.");redraw();return}
  if(d.gpdmove||d.gpdmovenone){const ym=d.gpdmove||d.gpdmovenone;const date=d.gpdmovenone?"none":val("#gpd-move");if(!date){toast("Choose the new day.");return}
    await ga("pd/move",{ym,date});st.pd=null;st.pdSel="";toast(date==="none"?"No all-staff meeting that month. Each Class team meets every open Monday.":"Moved. The agenda, the reminders and Today follow it.");T.render("stpdd");window.scrollTo(0,0);return}
  if(d.gpd!=null){st.pdSel=d.gpd;st.pdEdit=null;T.render("stpdd");window.scrollTo(0,0);return}
  if(d.gpdedit!=null){st.pdEdit=d.gpdedit==="1"?(st.pdStash&&st.pdStash.id===st.pdSel?st.pdStash.edit:{}):null;st.pdStash=null;redraw();return}
  if(d.gpdadd){await ga("pd/add",{date:val("#gpd-date"),kind:val("#gpd-kind"),title:val("#gpd-title")});toast("Added to the TREE calendar.");redraw();return}
  if(d.gpdmode){collectAgenda();st.pdEdit.mode=d.gpdmode;redraw();return}
  if(d.gsugload){collectAgenda();st.pdEdit.sug=(await ga("pd/suggest")).topics;redraw();return}
  if(d.gsugadd!=null){collectAgenda();const s=st.pdEdit.sug[+d.gsugadd];st.pdEdit.blocks.push({id:"k"+Date.now().toString(36),time:"",title:s.topic,why:"",how:"whole",prepare:"",readings:[],area:s.area||"",module:s.module||""});redraw();return}
  if(d.gbkadd){collectAgenda();st.pdEdit.blocks.push({id:"k"+Date.now().toString(36),time:"",title:"",why:"",how:"",prepare:"",readings:[],area:"",module:""});redraw();return}
  if(d.gbkrm!=null){collectAgenda();st.pdEdit.blocks.splice(+d.gbkrm,1);redraw();return}
  if(d.gbkmv){collectAgenda();const [i,dd]=d.gbkmv.split("|").map(Number);const b=st.pdEdit.blocks;const j=i+dd;if(j<0||j>=b.length)return;[b[i],b[j]]=[b[j],b[i]];redraw();return}
  if(d.gbkrd){collectAgenda();const [i,id,on]=d.gbkrd.split("|");const b=st.pdEdit.blocks[+i];b.readings=(b.readings||[]).filter(x=>x!==id);if(on==="1")b.readings.push(id);redraw();return}
  if(d.gbksearch!=null){collectAgenda();const i=+d.gbksearch;const b=st.pdEdit.blocks[i];if(!b.title){toast("Give the block a title first.");return}if(!sample){toast("Suggested readings are not available right now. Add your own instead.");return}
    st.searching=i;redraw();
    try{const res=await sample.json(`Find 3 or 4 readings for early childhood educators at a Reggio-inspired, nature-based preschool, for a professional development session on this topic. Search the web, and use only pages you actually found in your search results, with their exact web addresses. Weigh every site you can search equally, and choose the best and most current pages.\n\nTopic. ${b.title}. ${b.why||""}\n\nReturn only a JSON object with one key "items", an array of objects with "title" (with any colon replaced by a comma), "url", "source" (the organization) and "why" (one short sentence).`,{modelTier:"complex",cache:false,purpose:"pd-reading"});
      st.pdEdit.found[i]=(Array.isArray(res&&res.items)?res.items:[]).filter(x=>x&&/^https:\/\//.test(x.url||"")).map(x=>({title:String(x.title||"").replace(/[:—–]/g,","),url:String(x.url),source:String(x.source||"").replace(/[:—–]/g,",")})).slice(0,4);
      toast(st.pdEdit.found[i].length?"Found some. Open each one before choosing it.":"Nothing came back from trusted sites. Add your own instead.")}catch(er){toast("Suggested readings are not available right now.")}
    st.searching=false;redraw();return}
  if(d.gbkfound){collectAgenda();const [i,j]=d.gbkfound.split("|").map(Number);const x=st.pdEdit.found[i][j];const b=st.pdEdit.blocks[i];const r=await ga("readings/add",{reading:{title:x.title,url:x.url,source:x.source,areas:b.area?[b.area]:[],modules:b.module?[b.module]:[]}});st.readings=r.list;const got=r.list.find(y=>y.url===x.url);if(got){b.readings=[...(b.readings||[]),got.id]}st.pdEdit.found[i].splice(j,1);redraw();return}
  if(d.gstpadd){collectTeam();st.pdEdit.steps.push({id:"s"+Date.now().toString(36),text:"",who:"",done:false});redraw();return}
  if(d.gstprm!=null){collectTeam();st.pdEdit.steps.splice(+d.gstprm,1);redraw();return}
  if(d.gteamsave){collectTeam();const E=st.pdEdit;await ga("pd/save",{agenda:{date:E.date,kind:"team",room:E.room,title:E.title,start:E.start,end:E.end,blocks:E.blocks,notes:E.notes,steps:E.steps}});toast("Saved. The Class team and the director see it.");st.pdEdit=null;T.render("stpdd");return}
  if(d.gpdsave){collectAgenda();const E=st.pdEdit;st.pdStash=null;await ga("pd/save",{agenda:{date:E.date,kind:E.kind,mode:E.mode,title:E.title,start:E.start,end:E.end,blocks:E.blocks}});toast(`Saved. Staff see it from ${fd(X.addDays(E.date,-14))}.`);st.pdEdit=null;T.render("stpdd");return}
  if(d.gpdname){t.classList.toggle("on");return}
  if(d.gpdhours){const names=[...document.querySelectorAll("[data-gpdname].on")].map(x=>x.dataset.gpdname);if(!names.length){toast("Choose who attended.");return}const r=await ga("pd/hours",{id:d.gpdhours,names});toast(r.n?`Logged ${r.hours} hours for ${names.length===1?names[0]:"everyone chosen"}.`:"Already logged.");T.render("stpdd");return}
  if(d.gpddsave){await ga("pd/plusdelta",{id:d.gpddsave,plus:val("#gpdd-plus"),delta:val("#gpdd-delta")});toast("Saved. Thank you.");T.render("stpdd");return}
  if(d.gprint||d.gword){const k=d.gprint||d.gword;const kind=d.gword?"word":"pdf";progress("Making the file");
    if(k==="eval"){const dd=st.docs[who()];return out(kind,[evalDoc(dd)],"End of year evaluation "+dd.name+" "+yr())}
    if(k==="team"){const it=st.pd.find(x=>x.id===st.pdSel);return out(kind,[teamDoc(it)],it.room+" Class team meeting "+it.date)}
    if(k==="agenda"){const it=st.pd.find(x=>x.id===st.pdSel);return out(kind,[agendaDoc(it)],(it.kind==="meeting"?"PD staff meeting ":"PD day ")+it.date)}}
  if(d.gsset){await api("school",{school:{checkin:{week:+val("#gs-week"),secondTime:val("#gs-second")},meeting:{start:val("#gs-mstart"),end:val("#gs-mend")}}});bootP=null;await Gr.ready();toast("Saved. The calendar follows.");return}
  }catch(er){fail(er)}
}
document.addEventListener("change",async e=>{const t=e.target;if(!t.dataset||!t.dataset.gstep)return;const [id,step]=t.dataset.gstep.split("|");try{await ga("pd/step",{id,step,done:t.checked});toast(t.checked?"Marked done.":"Open again.");T.render("stpdd")}catch(er){toast(er&&er.message||"That did not save.")}});
document.addEventListener("change",e=>{const t=e.target;if(!t.closest||!t.closest("#main"))return;const d=t.dataset;
  if(d.gwrite){collectSelf();if(t.checked){st.selfDraft.writes[d.gwrite]=st.selfDraft.writes[d.gwrite]||""}else delete st.selfDraft.writes[d.gwrite];redraw();return}
  if(d.gparea!=null){collectPlan();const x=st.planDraft.goals[+d.gparea];x.area=t.value;x.areaOk=false;redraw();return}
  if(t.name==="gpfb"&&st.planDraft){st.planDraft.feedback=t.value;return}
  if(d.gmtried){ga("module/progress",{slug:d.gmtried,progress:{tried:t.checked}}).then(r=>{setDoc(meName(),r);toast(t.checked?"Noted. Write what happened below when you are ready.":"Unmarked.")}).catch(fail);return}
});
function collectSelf(){const s=st.selfDraft;if(!s)return;document.querySelectorAll("[data-gselfw]").forEach(x=>s.writes[x.dataset.gselfw]=x.value);s.examples=s.examples||{};
  document.querySelectorAll("[data-gselfex]").forEach(x=>{const k=x.dataset.gselfex;if(!x.value){delete s.examples[k];return}const [kind,id]=x.value.split("|");s.examples[k]=[{kind,id,label:x.options[x.selectedIndex].text}]});const c=$("#g-closing");if(c)s.closing=c.value}
function collectDir(){const dd=st.docs[st.sel];const ev=dd.evals[yr()];ev.dir=ev.dir||{};ev.dir.notes=ev.dir.notes||{};document.querySelectorAll("[data-gdirnote]").forEach(x=>ev.dir.notes[x.dataset.gdirnote]=x.value);if($("#g-narr"))ev.dir.narrative=val("#g-narr");if($("#g-strengths"))ev.dir.strengths=val("#g-strengths")}
function collectPlan(){const p=st.planDraft;if(!p)return;if($("#gp-ww"))p.wentWell.text=val("#gp-ww");document.querySelectorAll("[data-gpgoal]").forEach(x=>{p.goals[+x.dataset.gpgoal].text=x.value});if($("#gp-ch"))p.challenges=val("#gp-ch");p.reflection=p.reflection||{};document.querySelectorAll("[data-gprefl]").forEach(x=>{p.reflection[x.dataset.gprefl]=x.value});
  p.need={director:val("#gp-nd"),team:val("#gp-nt"),training:val("#gp-nr")};const fb=document.querySelector('input[name="gpfb"]:checked');if(fb&&!isDir())p.feedback=fb.value}
function collectCi(){const c=st.ci;if(!c)return;document.querySelectorAll("[data-gcf]").forEach(x=>{const [a,b]=x.dataset.gcf.split(".");if(b){c[a]=c[a]||{};c[a][b]=x.value}else c[a]=x.value});
  document.querySelectorAll("[data-gcgoal]").forEach(x=>{c.goals=c.goals||{};c.goals[x.dataset.gcgoal]=x.value});const dt=$("#gc-date");if(dt&&dt.value)c.date=dt.value;if($("#gc-area"))c.focus.area=val("#gc-area");if($("#gc-mod"))c.focus.module=val("#gc-mod")}
function collectMoment(){const f=st.mform;if($("#gm-text"))f.text=val("#gm-text");if($("#gm-to"))f.to=val("#gm-to");if($("#gm-area"))f.area=val("#gm-area");const l=val("#gm-link");if($("#gm-link")){if(l){const [kind,id,...rest]=l.split("|");f.link={kind,id,label:rest.join("|")}}else f.link=null}}
function collectAgenda(){const E=st.pdEdit;if(!E||!E.blocks)return;if($("#gpde-title"))E.title=val("#gpde-title");if($("#gpde-start"))E.start=val("#gpde-start");if($("#gpde-end"))E.end=val("#gpde-end");
  document.querySelectorAll("[data-gbk]").forEach(x=>{const [i,f]=x.dataset.gbk.split("|");const b=E.blocks[+i];if(b)b[f]=x.value});
  // a team meeting's notes and next steps
  if(E.kind==="team"){if($("#gte-notes"))E.notes=val("#gte-notes");document.querySelectorAll("[data-gstp]").forEach(x=>{const [i,f]=x.dataset.gstp.split("|");const s0=E.steps[+i];if(!s0)return;s0[f]=f==="done"?x.checked:x.value})}}
// the calendar's PD day opens its agenda, and a reminder's link opens the journal or the PD days
Gr.openAgenda=function(date){st.pdSel="";st.pdEdit=null;Gr._wantDate=date};
// the Readings library's filter, and the director's changes to its books and articles
document.addEventListener("click",async e=>{const t=e.target.closest("[data-grlfilter],[data-grledit],[data-grlremove],[data-grlsave],[data-grlcancel]");if(!t)return;const d=t.dataset;
  if(d.grlfilter){st.rlFilter=d.grlfilter;redraw();return}
  if(d.grlcancel){st.rlEdit="";redraw();return}
  if(typeof VIEW_AS!=="undefined"&&VIEW_AS)return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  if(d.grledit){await loadMods().catch(()=>null);st.rlEdit=d.grledit;redraw();return}
  try{
    if(d.grlremove){const x=((st.rlib||{}).list||[]).find(y=>y.id===d.grlremove);if(!confirm(`Remove ${x?x.title:"this reading"} from the Readings library?`))return;st.rlib=await ga("readings/lib/remove",{id:d.grlremove});toast("Removed.");redraw();return}
    if(d.grlsave!=null){const f=t.closest("[data-grlform]");const v=k=>(f.querySelector(`[data-grlf="${k}"]`)||{}).value||"";
      const entry={id:d.grlsave||undefined,kind:v("kind"),title:v("title"),author:v("author"),source:v("source"),year:v("year"),url:v("url"),cite:v("cite"),note:v("note"),modules:[...f.querySelectorAll("[data-grlmod]:checked")].map(x=>x.dataset.grlmod)};
      const keep=d.grlsave&&((st.rlib||{}).list||[]).find(y=>y.id===d.grlsave);if(keep)entry.areas=keep.areas||[];
      st.rlib=await ga("readings/lib/save",{entry});st.rlEdit="";toast("Saved.");redraw();return}
  }catch(er){toast(er&&er.message||"That did not save. Check the connection and try again.")}});
// choosing a guest session opens its fields
document.addEventListener("change",e=>{const t=e.target;if(!t.dataset||!/\|guest$/.test(t.dataset.gbk||""))return;collectAgenda();redraw()});
document.addEventListener("change",async e=>{const t=e.target;if(!t.dataset||t.dataset.grlonsite==null)return;
  if(typeof VIEW_AS!=="undefined"&&VIEW_AS){t.checked=!t.checked;return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".")}
  try{st.rlib=await ga("readings/onsite",{id:t.dataset.grlonsite,on:t.checked});toast(t.checked?"Marked In our library.":"No longer marked In our library.");redraw()}catch(er){t.checked=!t.checked;toast(er&&er.message||"That did not save.")}});

// the director's Edit button on a module, the same editor as a How To guide and the PD library letter
document.addEventListener("click",e=>{const t=e.target.closest("[data-gmedit]");if(!t||!window.TREE_PAGEEDIT)return;e.preventDefault();
  window.TREE_PAGEEDIT({module:t.dataset.gmedit},async()=>{st.mods=null;redraw()})});
})();

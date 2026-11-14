/* ---------- The Book, the story of a child's time at our school ----------
   One book for each child, made cover to cover in TREE, for the child and the family. It takes the place of the
   Shutterfly keepsake. A book holds one page for a month, told from what educators wrote that month, with the child's
   own words when an educator wrote them down, a line of our reflection, and the photos kept with those days. The years
   before TREE come from the Moments kept for the book (the server sends one child's, /api/book/moments).

   Truth comes first. TREE drafts a page only from the educators' words, describes the days and never the child's
   character, and keeps a quote only when it is in the source letter for letter. Every page can be changed, left out,
   given other photos or told from another story. Someone who knows the child reads the whole book before the print
   file is made, and any change after that asks for the reading again. Everyone who signs in to the classroom side
   sees the Book. The director drafts and changes it. An educator reads it, leaves a note on a page for the director
   and marks it read, and the server holds an educator's save to those two things. Only the director keeps the list
   of who signs each class year (settings/book). */
let books=new Map(),bookBase=new Map(),bookSet={signs:{}};
const BK={mom:new Map(),momP:new Map(),busy:"",pick:"",add:"",timers:new Map(),bmp:new Map(),making:false};
const BK_BLEED=9,BK_W=810,BK_H=630,BK_SAFE=45,BK_MIN=24;
const BK_MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const BK_NUM=["zero","one","two","three","four","five","six","seven","eight"];
const bkYmLabel=ym=>BK_MONTHS[+ym.slice(5,7)-1]+" "+ym.slice(0,4);
const bkYearOf=ym=>{const y=+ym.slice(0,4),m=+ym.slice(5,7);const a=m>=8?y:y-1;return a+"-"+String(a+1).slice(2)};
const bkClean=s=>String(s||"").replace(/\s*[—–]\s*/g,", ").replace(/\s*;\s*/g,". ").replace(/:\s+/g,". ").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
const bkNorm=s=>String(s||"").toLowerCase().replace(/[‘’]/g,"'").replace(/[“”"]/g,"").replace(/\s+/g," ").replace(/[.!?,]+$/,"").trim();
function bkBook(c){return books.get(c.id)||{id:c.id,child:c.id,pages:[],across:[],letter:"",opening:null,cover:"",last:"",readBy:null,draftedAt:{}}}
const bkCan=()=>isDirector();
// notes educators left for the director, each on a page, an across page or the letter
const bkNotes=(b,on)=>Object.entries((b&&b.notes)||{}).filter(([,n])=>n&&has(n.text)&&(on===undefined||n.on===on)).map(([id,n])=>Object.assign({id},n)).sort((a,z)=>(a.at||0)-(z.at||0));
function bkNotesHtml(b,on,first){const ns=bkNotes(b,on);return `<div class="bknotes">${ns.map(n=>`<div class="bkflag"><b>${esc(n.by||"An educator")}</b>, ${esc(shortDate(n.at))}. ${esc(n.text)}${bkCan()?` <button class="linkbtn" data-bknotedone="${n.id}">Done</button>`:""}</div>`).join("")}${bkCan()?"":`<label class="cnt">Is something here not true, or missing? Tell the director.<textarea data-bknotetext="${esc(on)}" rows="2" placeholder="What you know about ${esc(first)} that this page gets wrong"></textarea></label><div class="actions"><button class="btn small ghost" data-bknote="${esc(on)}">Send the note</button></div>`}</div>`}
function bkSave(b){b.updatedAt=Date.now();books.set(b.id,b);if(db)savePart("books",bookBase,b,"book")}
function bkSaveSoon(b){books.set(b.id,b);clearTimeout(BK.timers.get(b.id));BK.timers.set(b.id,setTimeout(()=>{BK.timers.delete(b.id);bkSave(b)},700))}
// a change to the words or the pictures asks for the reading again
function bkTouched(b){if(b.readBy)b.readBy=null}
const bkKeepLocal=id=>view==="child"&&kidTab==="book"&&kidOpen===id&&!!document.activeElement?.closest?.("#main textarea,#main input");

/* everything kept about one child, as entries. An entry is one piece of an educator's writing with the photos kept with
   it. An observation in TREE is one entry. Earlier Moments that share a day and the same words are one entry. */
function bkLoad(c){if(BK.mom.has(c.id)||BK.momP.has(c.id)||!window.FP_API)return;
  BK.momP.set(c.id,window.FP_API("/api/book/moments",{child:c.id}).then(j=>{BK.mom.set(c.id,Array.isArray(j&&j.items)?j.items:[])}).catch(()=>{BK.mom.set(c.id,[])}).finally(()=>{BK.momP.delete(c.id);if(view==="child"&&kidTab==="book"&&!document.activeElement?.closest?.("#main textarea,#main input"))renderMain()}))}
function bkEntries(c){const out=[],by=new Map(),inTree=new Set();
  const name=id=>{const k=children.get(id);return k?k.first:""};
  for(const n of kidMoments(c)){if(!n||!n.at||!has(n.noticed))continue;inTree.add(n.id);const day=iso(new Date(n.at));
    out.push({k:"n:"+n.id,at:n.at,day,ym:day.slice(0,7),room:obsRoomsChosen(n)[0]||c.classroom||"",words:String(n.noticed).trim(),wonder:String(n.wonder||"").trim(),kids:(n.children||[]).map(name).filter(Boolean),photos:n.photo&&(n.photo.id||n.photo.data)?[{k:"n:"+n.id,w:n.photo.w||4,h:n.photo.h||3}]:[]})}
  for(const it of BK.mom.get(c.id)||[]){if(it.notice&&inTree.has(it.notice))continue;if(!has(it.words))continue;
    const day=it.day||iso(new Date(it.at)),key=day+"|"+bkNorm(it.words);let e=by.get(key);
    if(!e){e={k:"m:"+it.m,at:it.at,day,ym:day.slice(0,7),room:it.room||"",words:String(it.words).trim(),wonder:"",kids:(it.kids||[]).map(name).filter(Boolean),photos:[]};by.set(key,e);out.push(e)}
    if(it.photo&&!e.photos.some(p=>p.k==="m:"+it.m))e.photos.push({k:"m:"+it.m,id:it.photo,w:it.w||4,h:it.h||3})}
  return out.sort((a,b)=>a.at-b.at)}
// where a photo is, by its key. n:<observation> is the observation's photo, m:<Moment> is a photo kept for the book.
function bkUrl(c,k){if(!k)return"";if(k.startsWith("n:")){const n=notices.get(k.slice(2));return n?photoSrc(n):""}
  const it=(BK.mom.get(c.id)||[]).find(x=>"m:"+x.m===k);return it&&it.photo&&window.FP_ORIGINAL_URL?window.FP_ORIGINAL_URL(it.photo):""}
function bkYears(c){const m=new Map();for(const e of bkEntries(c)){const y=bkYearOf(e.ym);let v=m.get(y);if(!v){v={year:y,entries:[],rooms:{}};m.set(y,v)}v.entries.push(e);if(e.room)v.rooms[e.room]=(v.rooms[e.room]||0)+1}
  return [...m.values()].sort((a,b)=>a.year<b.year?-1:1).map(v=>Object.assign(v,{room:Object.entries(v.rooms).sort((a,b)=>b[1]-a[1]).map(x=>x[0])[0]||""}))}
function bkAgeWords(c,at){const a=kidAgeAt(c,at),m=a.match(/^(\d+) year/);if(!m)return"";const y=+m[1];return (BK_NUM[y]||y)+" year"+(y===1?"":"s")+" old"}
// words that make a claim about who a child is, or break our language, shown under a page for the reader
function bkFlags(c,p){const t=[p.title,p.body,p.see].join(" "),out=[];
  const m=t.match(/\b(always|never|loves|every living|is known for|natural leader|is a (?:very )?(?:kind|gentle|careful|caring|curious|thoughtful) (?:child|boy|girl|friend))\b/i);
  if(m)out.push(`This page says "${m[1]}". A page describes the days and does not say who ${c.first} is. Change it unless you know it is true.`);
  if(/\bteachers?\b/i.test(t))out.push("This page says teacher. We say educator.");
  if(/\btoddlers?\b/i.test(t))out.push("This page says toddler. We name the class or say children.");
  if(/\bFulton\b(?! Community School)/.test(t))out.push("This page says Fulton alone. We write Fulton Community School & Farm or our school.");
  if(has(p.quote)&&!p.quoteOk)out.push(`The words in quotation marks are not in what educators wrote. Keep them only if you heard ${c.first} say them.`);
  return out}

/* ----- drafting ----- */
function bkPrompt(c,yr,ents,only){const first=c.first,room=yr.room;const E=new Map(),P=new Map();let pn=0;
  const body=ents.map((e,i)=>{const lab="E"+(i+1);E.set(lab,e);const ph=e.photos.map(p=>{const l="P"+(++pn);P.set(l,p.k);return l});
    return `${lab}, ${longDate(e.day)}${e.room?", "+e.room+" class":""}${ph.length?", photos "+ph.join(" "):", no photo"}${e.kids.length?". Children in the photos, "+e.kids.join(", "):""}.
Words. ${e.words.slice(0,1400)}${e.wonder?`
Wondered. ${e.wonder.slice(0,500)}`:""}`}).join("\n\n");
  const text=`You are helping the educators of Fulton Community School & Farm, a Reggio-inspired, nature-based preschool, make a keepsake book for one child and the child's family. The book tells the story of ${first}'s time at our school, one page for a month. An educator who knows ${first} reads and changes every page before the book prints.

Below is what educators wrote in the school year ${yearLabel(yr.year)}${room?`, when ${first} was in the ${room} class`:""}. Each entry has a label, a date, the photos kept with it and the educators' own words.

${only?`Write one page for ${bkYmLabel(only.ym)}, told from entry ${only.lab}. You may add up to two more entries from the list when they are the same story on another day.`:`Choose one story for each month that has entries. Prefer, in this order, a story that came back over more than one day, one where ${first}'s own words were written down, one where ${first} is at the center and not one of a crowd, one where an educator wondered about what they saw, and one with a photo. Let the pages differ across the year, so the book shows many sides of it. Skip a month whose entries say nothing about ${first} in particular.`}

How to write a page.
Write about ${first} in the third person, for ${first} and the family to read together for years. The voice is warm, composed and plain. It is never sing-song, never cute, never blunt or casual, and it never talks down to a child. Vary the sentences. Tell what happened in the order it happened, with the particulars the educators wrote, the materials, the place, the friends by first name. Weave what ${first} was learning into the telling in plain words, with no assessment or rating language and no list of developmental terms.

Truth rules.
Use only what the educators wrote. Never add an event, a place, a feeling, a friend, a quote or a reason they did not write.
Describe the days and never ${first}'s character. Do not write that ${first} always or never does something, loves something, is known for something, or is a kind of child. Do not turn one day into a trait.
Do not write that ${first} taught, led or reminded others unless an entry says so in those words.
If an entry describes something hard for ${first}, leave it out and choose another story.
Give a quote only when the educators wrote ${first}'s exact spoken words. Copy them letter for letter and name the entry they are in. If there are none, leave quote empty.

The line called see is one sentence in the educators' voice, as we, about what we saw in these days. It is about these days only.

Words. Say educator, never teacher. Name a class as a class, like the ${room||"South"} class. Never write toddler. Write Fulton Community School & Farm or our school, never Fulton alone. First names only. No dashes, no colons, no semicolons, no parentheses, no figures of speech, no comparisons, and no exclamation marks outside a quote.

Length. title is two to five words. body is 60 to 110 words in one or two paragraphs. see is at most 30 words.

Answer with JSON only, in this shape.
{"months":[{"ym":"2025-10","title":"","body":"","quote":"","quoteFrom":"E3","see":"","entries":["E3","E5"],"photos":["P7","P9","P4"],"others":["E8","E2"]}]}
entries are the one to four entries the page is told from. photos are up to three photo labels from those entries, the strongest first. others are up to two other entries from that month that could make a page instead.

The entries.

${body}`;
  return {text,E,P}}
// a page made from one month of the answer, checked against the sources
function bkPageFrom(c,m,E,P){const ym=String(m&&m.ym||"");if(!/^\d{4}-\d\d$/.test(ym))return null;
  const src=[...new Set((Array.isArray(m.entries)?m.entries:[]).map(l=>E.get(String(l).trim())).filter(Boolean))].slice(0,4);if(!src.length)return null;
  const body=bkClean(m.body);if(!has(body))return null;
  const own=new Set(src.flatMap(e=>e.photos.map(p=>p.k)));
  let photos=[...new Set((Array.isArray(m.photos)?m.photos:[]).map(l=>P.get(String(l).trim())).filter(k=>k&&own.has(k)))].slice(0,3);
  if(!photos.length)photos=[...own].slice(0,3);
  let quote=String(m.quote||"").replace(/^["“]+|["”]+$/g,"").trim(),qat=0;
  if(quote){const q=bkNorm(quote);const from=src.find(e=>bkNorm(e.words).includes(q));if(from&&q.length>1)qat=from.at;else quote=""}
  return {id:"p"+ym+"-"+Math.random().toString(36).slice(2,7),ym,year:bkYearOf(ym),room:src[0].room||"",title:classCase(bkClean(String(m.title||"").replace(/\s*:\s+/g,", ")).replace(/[:.]+$/,"")),body,quote,quoteOk:!!quote,qat,see:bkClean(m.see).replace(/\n+/g," "),photos,sources:src.map(e=>e.k),
    others:[...new Set((Array.isArray(m.others)?m.others:[]).map(l=>E.get(String(l).trim())).filter(e=>e&&e.ym===ym&&!src.includes(e)).map(e=>e.k))].slice(0,2),edited:false,hidden:false}}
async function bkDraftYear(c,year){
  if(!sample){toast("Drafting is not available here. Open TREE and sign in.");return}
  const yr=bkYears(c).find(y=>y.year===year);if(!yr||!yr.entries.length){toast("Nothing is written for that year yet.");return}
  const b=bkBook(c);const keep=new Set(b.pages.filter(p=>p.year===year&&p.edited).map(p=>p.ym));
  BK.busy="y:"+year;renderMain();
  try{const {text,E,P}=bkPrompt(c,yr,yr.entries);
    const out=await sample.json(text,{modelTier:"complex",cache:false,purpose:"book"});
    const made=[];const seen=new Set();for(const m of Array.isArray(out?.months)?out.months:[]){const p=bkPageFrom(c,m,E,P);if(!p||p.year!==year||seen.has(p.ym)||keep.has(p.ym))continue;seen.add(p.ym);made.push(p)}
    if(!made.length){toast("No pages came back. Try again in a moment.");return}
    const cur=bkBook(c);cur.pages=[...cur.pages.filter(p=>p.year!==year||p.edited),...made].sort((a,b)=>a.ym<b.ym?-1:a.ym>b.ym?1:0);
    cur.draftedAt=Object.assign({},cur.draftedAt,{[year]:Date.now()});bkTouched(cur);bkSave(cur);
    toast(`${made.length} page${made.length===1?"":"s"} drafted for ${yearLabel(year)}. Read each one as someone who knows ${c.first}.`);
  }catch(err){toast(assistError(err||"unknown","Nothing was changed."))}
  finally{BK.busy="";if(view==="child"&&kidTab==="book")renderMain()}
}
// one page told from one chosen entry, to take a page's place (pid) or to stand as another page for the month
async function bkDraftOne(c,key,pid){
  if(!sample){toast("Drafting is not available here. Open TREE and sign in.");return}
  const all=bkEntries(c),e=all.find(x=>x.k===key);if(!e)return;const year=bkYearOf(e.ym);const yr=bkYears(c).find(y=>y.year===year);
  const ents=all.filter(x=>x.ym===e.ym);const lab="E"+(ents.indexOf(e)+1);
  BK.busy="e:"+key;renderMain();
  try{const {text,E,P}=bkPrompt(c,yr,ents,{ym:e.ym,lab});
    const out=await sample.json(text,{modelTier:"complex",cache:false,purpose:"book"});
    const m=(Array.isArray(out?.months)?out.months:[])[0];if(m){m.ym=e.ym;if(!Array.isArray(m.entries)||!m.entries.includes(lab))m.entries=[lab,...(Array.isArray(m.entries)?m.entries:[])]}
    const p=m&&bkPageFrom(c,m,E,P);if(!p){toast("No page came back. Try again in a moment.");return}
    const cur=bkBook(c);const i=pid?cur.pages.findIndex(x=>x.id===pid):-1;
    if(i>=0)cur.pages[i]=p;else{cur.pages.push(p);cur.pages.sort((a,b)=>a.ym<b.ym?-1:a.ym>b.ym?1:0)}
    bkTouched(cur);bkSave(cur);BK.add="";
  }catch(err){toast(assistError(err||"unknown","Nothing was changed."))}
  finally{BK.busy="";if(view==="child"&&kidTab==="book")renderMain()}
}
/* closing pages. Each follows one thread through time, an early, a middle and a late day in order, with the month under
   each photo and words that tell what happened at each. A class year closes with its own, read from that year alone. A
   book of more than one year may have a culminating page before the letter, whose days come from more than one year.
   year is a school year like 2025-26, or "" for all the years. thread is a thread the director names, or "". */
const bkAcYear=a=>a.year||"";
async function bkDraftAcross(c,year,thread){
  if(!sample){toast("Drafting is not available here. Open TREE and sign in.");return}
  const all=!year;const ents=bkEntries(c).filter(e=>e.photos.length&&(all||bkYearOf(e.ym)===year));
  if(ents.length<3||(all&&new Set(ents.map(e=>bkYearOf(e.ym))).size<2)){toast(all?"A culminating page needs days from more than one year.":"There is not enough written that year for a closing page.");return}
  BK.busy="across:"+(year||"all");renderMain();
  try{const E=new Map();const list=ents.map((e,i)=>{E.set("E"+(i+1),e);return `E${i+1}, ${longDate(e.day)}${e.room?", "+e.room+" class":""}. ${e.words.replace(/\s+/g," ").slice(0,all?260:420)}`}).join("\n");
    const span=all?"over all the years at our school":`in the school year ${yearLabel(year)}`,apart=all?"from at least two different school years":"from at least two different months";
    const out=await sample.json(`You are helping the educators of Fulton Community School & Farm make a keepsake book for ${c.first} and the family. Below is a short form of what educators wrote about ${c.first} ${span}, each with a label and a date.

${has(thread)?`Follow this one thread through time. ${String(thread).slice(0,120)}. If the entries do not show it at more than one time, answer with no threads.`:`Find ${all?"one or two threads":"up to two threads"} that ${c.first} came back to ${span}, such as a material, a place, a kind of work, an animal or a friendship.`} For each thread choose three entries in the order they happened, an early one, a middle one and a late one, ${apart}. Give a title of one to three words, and words of 40 to 70 words that tell in order what happened at each of the three times, naming the month${all?" and year":""} of each.

Truth rules. Use only what the educators wrote. Tell what happened on those days and never say who ${c.first} is. Do not write always, never, loves or every. Do not write that ${c.first} taught, led or reminded others unless an entry says so. Do not say ${c.first} grew, improved or changed unless the entries themselves show a difference you can name plainly, such as what ${c.first} did the first time and what ${c.first} did the last time. Leave out anything hard. Third person, warm, composed and plain. No dashes, no colons, no semicolons, no figures of speech, no comparisons. Say educator, never teacher. Name a class as a class, like the South class.

Answer with JSON only, in this shape. {"threads":[{"title":"","words":"","entries":["E4","E31","E80"]}]}

The entries.

${list}`,{modelTier:"complex",cache:false,purpose:"book"});
    const made=(Array.isArray(out?.threads)?out.threads:[]).map(a=>{const src=[...new Set((Array.isArray(a?.entries)?a.entries:[]).map(l=>E.get(String(l).trim())).filter(Boolean))].sort((x,y)=>x.at-y.at).slice(0,3);
      if(src.length<2||!has(a.title)||!has(a.words)||new Set(src.map(e=>all?bkYearOf(e.ym):e.ym)).size<2)return null;
      return {id:"a"+Math.random().toString(36).slice(2,8),year:year||"",title:classCase(bkClean(String(a.title||"").replace(/\s*:\s+/g,", ")).replace(/[:.]+$/,"")),see:bkClean(a.words).replace(/\n+/g," "),photos:src.map(e=>e.photos[0].k),whens:src.map(e=>e.ym),sources:src.map(e=>e.k),edited:false,hidden:false}}).filter(Boolean).slice(0,has(thread)?1:2);
    if(!made.length){toast(has(thread)?"The entries do not show that thread at more than one time.":"No closing page came back. Try again in a moment.");return}
    const cur=bkBook(c);cur.across=[...(cur.across||[]).filter(a=>bkAcYear(a)!==(year||"")||a.edited||has(thread)),...made];bkTouched(cur);bkSave(cur);
  }catch(err){toast(assistError(err||"unknown","Nothing was changed."))}
  finally{BK.busy="";if(view==="child"&&kidTab==="book")renderMain()}
}
// a start for the letter on the last page, written to the child from what the pages say
async function bkDraftLetter(c){
  if(!sample){toast("Drafting is not available here. Open TREE and sign in.");return}
  const b=bkBook(c),pages=b.pages.filter(p=>!p.hidden);if(pages.length<3){toast("Draft the pages first. The letter is written from them.");return}
  const years=new Set(pages.map(p=>p.year)).size;
  BK.busy="letter";renderMain();
  try{const out=await sample.json(`You are helping the educators of Fulton Community School & Farm write the letter on the last page of a keepsake book for ${c.first}. Below are the pages of the book. An educator who knows ${c.first} will read and change the letter.

Write the letter to ${c.first} directly, as you, from the educators, as we. Begin with Dear ${c.first}, and then one sentence that says for ${years===1?"one year":(BK_NUM[years]||years)+" years"} we have been learning alongside you. Then two or three sentences about what we saw ${c.first} do, each one true to more than one page. Then one sentence that begins From you we learned, about something the pages show. ${b.opening&&has(b.opening.quote)?`Then bring back ${c.first}'s words "${b.opening.quote}" in one sentence. `:""}End with This book is for your family, and it is for you. Do not sign it.

It is not a list of the pages and it does not retell the photos. What ${c.first} learned is said as learned, in the past, such as You learned how to. Stay with what the pages say. Do not write always, never or every. Do not write that ${c.first} taught or led others. Nothing hard or negative. The voice is warm, composed and plain. No dashes, no colons, no figures of speech, no comparisons. About 90 to 120 words, in short paragraphs.

Answer with JSON only, in this shape. {"letter":""}

The pages.

${pages.map(p=>`${bkYmLabel(p.ym)}. ${p.title}. ${p.body}${has(p.quote)?` ${c.first} said, "${p.quote}"`:""}`).join("\n\n")}`,{modelTier:"complex",cache:false,purpose:"book"});
    const t=bkClean(out?.letter);if(!has(t)){toast("No letter came back. Try again in a moment.");return}
    const cur=bkBook(c);cur.letter=t;bkTouched(cur);bkSave(cur);
  }catch(err){toast(assistError(err||"unknown","Nothing was changed."))}
  finally{BK.busy="";if(view==="child"&&kidTab==="book")renderMain()}
}

/* ----- what the book holds, in order, for the screen count and the print ----- */
function bkSigns(b){const seen=new Set(),out=[];for(const p of (b.pages||[]).filter(p=>!p.hidden)){const k=p.year+" "+p.room;if(seen.has(k))continue;seen.add(k);const v=String((bookSet.signs||{})[k]||"").trim();if(v)out.push(v)}return out}
function bkCoverKey(b){return b.cover||((b.pages||[]).find(p=>!p.hidden&&p.photos[0])||{photos:[]}).photos[0]||""}
function bkLastKey(b){if(b.last)return b.last;const ps=(b.pages||[]).filter(p=>!p.hidden&&p.photos[0]);return ps.length?ps[ps.length-1].photos[0]:""}
function bkSheets(c,b){const out=[{t:"cover"}];if(b.opening&&has(b.opening.quote))out.push({t:"open"});
  const pages=(b.pages||[]).filter(p=>!p.hidden);const years=[...new Set(pages.map(p=>p.year))];let side=0;
  for(const y of years){const ps=pages.filter(p=>p.year===y);if(years.length>1)out.push({t:"year",year:y,room:ps[0].room,photo:(ps.find(p=>p.photos[1])||ps[0]).photos.slice(-1)[0]||""});
    for(const p of ps)out.push({t:"page",p,side:side++%2});
    for(const a of (b.across||[]).filter(a=>!a.hidden&&bkAcYear(a)===y))out.push({t:"across",a})}
  for(const a of (b.across||[]).filter(a=>!a.hidden&&(!bkAcYear(a)||!years.includes(bkAcYear(a)))))out.push({t:"across",a});
  out.push({t:"last"});return out}

/* ----- the Book on the child's page ----- */
function bkThumb(c,k,cls){const u=bkUrl(c,k);return u?`<img class="${cls||"bkth"}" src="${esc(u)}" alt="" loading="lazy" onerror="this.style.visibility=&#39;hidden&#39;">`:`<span class="${cls||"bkth"} bkno">No photo</span>`}
function bkPageHtml(c,b,p,ents){if(!bkCan())return bkPageRead(c,b,p,ents);const busy=!!BK.busy;const src=p.sources.map(k=>ents.find(e=>e.k===k)).filter(Boolean);const flags=p.hidden?[]:bkFlags(c,p);
  const cand=[...new Set([...p.photos,...src.flatMap(e=>e.photos.map(x=>x.k)),...ents.filter(e=>e.ym===p.ym).flatMap(e=>e.photos.map(x=>x.k))])].slice(0,36);
  const others=[...new Set([...(p.others||[]),...ents.filter(e=>e.ym===p.ym&&!p.sources.includes(e.k)).map(e=>e.k)])].map(k=>ents.find(e=>e.k===k)).filter(Boolean).slice(0,12);
  return `<section class="card bkpage${p.hidden?" bkout":""}" id="bk-${p.id}" data-bkpage="${p.id}">
    <div class="secthead"><span class="eyebrow">${esc(bkYmLabel(p.ym))}${p.edited?" · changed by an educator":""}${p.hidden?" · left out of the book":""}</span>
      <span class="actions"><button class="linkbtn" data-bkpick="${p.id}">${BK.pick===p.id?"Close photos":"Photos"}</button><button class="linkbtn" data-bkadd="${p.id}">${BK.add===p.id?"Close stories":"Another story"}</button><button class="linkbtn" data-bkhide="${p.id}">${p.hidden?"Put back":"Leave out"}</button></span></div>
    <div class="bkrow"><div class="bkphotos">${bkThumb(c,p.photos[0],"bkmain")}<div class="bksup">${p.photos.slice(1,3).map(k=>bkThumb(c,k)).join("")}</div></div>
      <div class="bkwords"><input data-bkf="title" data-bkp="${p.id}" value="${esc(p.title)}" aria-label="Title of the page" placeholder="Title">
        <textarea data-bkf="body" data-bkp="${p.id}" rows="7" aria-label="The story">${esc(p.body)}</textarea>
        <label class="cnt">${esc(c.first)}'s own words, exactly as an educator wrote them<input data-bkf="quote" data-bkp="${p.id}" value="${esc(p.quote)}" placeholder="Leave empty when no words were written down"></label>
        <label class="cnt">What we saw in these days<input data-bkf="see" data-bkp="${p.id}" value="${esc(p.see)}"></label>
        ${has(p.quote)?`<div class="actions"><button class="linkbtn" data-bkopen="${p.id}">${b.opening&&b.opening.page===p.id?"These words open the book":"Open the book with these words"}</button></div>`:""}
        <div data-bkflags="${p.id}">${flags.map(f=>`<div class="bkflag">${esc(f)}</div>`).join("")}</div>${bkNotesHtml(b,p.id,c.first)}</div></div>
    ${BK.pick===p.id?`<div class="bkpick"><div class="cnt">Choose the large photo and up to two more. A photo can also go on the cover or the last page.</div><div class="bkgrid">${cand.map(k=>{const i=p.photos.indexOf(k);return `<figure>${bkThumb(c,k,"bkcand")}<figcaption><button class="pill" aria-pressed="${i===0}" data-bkmain="${p.id}" data-k="${esc(k)}">Large</button><button class="pill" aria-pressed="${i>0}" data-bksup="${p.id}" data-k="${esc(k)}">${i>0?"Remove":"Add"}</button><button class="pill" aria-pressed="${b.cover===k}" data-bkcover="${esc(k)}">Cover</button><button class="pill" aria-pressed="${b.last===k}" data-bklast="${esc(k)}">Last page</button></figcaption></figure>`}).join("")||`<div class="empty">No photos are kept for this month.</div>`}</div></div>`:""}
    ${BK.add===p.id?`<div class="bkpick"><div class="cnt">Other days in ${esc(bkYmLabel(p.ym))}. TREE writes a page from the one you choose, only from these words.</div>${others.map(e=>`<div class="bkother"><div><b>${esc(longDate(e.day))}</b> ${esc(firstLine(e.words,160))}</div><span class="actions"><button class="btn small ghost" data-bkuse="${esc(e.k)}" data-bkfor="${p.id}" ${busy?"disabled":""}>Tell this one here</button><button class="btn small ghost" data-bkuse="${esc(e.k)}" ${busy?"disabled":""}>Add as another page</button></span></div>`).join("")||`<div class="empty">Nothing else is written for this month.</div>`}</div>`:""}
    <details class="bksrc"><summary>What educators wrote</summary>${src.map(e=>`<p><b>${esc(longDate(e.day))}${e.room?", "+esc(e.room)+" class":""}</b><br>${esc(e.words)}${e.wonder?`<br><i>${esc(e.wonder)}</i>`:""}</p>`).join("")||`<p class="empty">The observations for this page are no longer here.</p>`}</details>
  </section>`}
function bkSrcHtml(src){return `<details class="bksrc"><summary>What educators wrote</summary>${src.map(e=>`<p><b>${esc(longDate(e.day))}${e.room?", "+esc(e.room)+" class":""}</b><br>${esc(e.words)}${e.wonder?`<br><i>${esc(e.wonder)}</i>`:""}</p>`).join("")||`<p class="empty">The observations for this page are no longer here.</p>`}</details>`}
function bkPageRead(c,b,p,ents){if(p.hidden)return"";const src=p.sources.map(k=>ents.find(e=>e.k===k)).filter(Boolean);
  return `<section class="card bkpage" id="bk-${p.id}" data-bkpage="${p.id}"><div class="secthead"><span class="eyebrow">${esc(bkYmLabel(p.ym))}</span></div>
    <div class="bkrow"><div class="bkphotos">${bkThumb(c,p.photos[0],"bkmain")}<div class="bksup">${p.photos.slice(1,3).map(k=>bkThumb(c,k)).join("")}</div></div>
      <div class="bkwords"><h3 style="font-size:17px;margin:0">${esc(p.title)}</h3>${String(p.body||"").split(/\n+/).filter(has).map(t=>`<p style="margin:0">${esc(t)}</p>`).join("")}
        ${has(p.quote)?`<p style="margin:0;font-weight:700;color:var(--moss)">“${esc(p.quote)}”</p>`:""}${has(p.see)?`<p class="cnt" style="margin:0">${esc(p.see)}</p>`:""}${bkNotesHtml(b,p.id,c.first)}</div></div>
    ${bkSrcHtml(src)}</section>`}
function bkClosingHtml(c,b,year,multi){const can=bkCan(),busy=!!BK.busy,all=!year;if(all&&!multi)return"";
  const known=new Set((b.pages||[]).map(p=>p.year));const list=(b.across||[]).filter(a=>all?(!bkAcYear(a)||!known.has(bkAcYear(a))):bkAcYear(a)===year).filter(a=>can||!a.hidden);
  if(!can&&!list.length)return"";const what=all?"The culminating page, all the years":"How "+yearLabel(year)+" closes";
  return `<div class="sethead">${esc(what)}</div>${list.map(a=>`<section class="card bkpage${a.hidden?" bkout":""}" data-bkacross="${a.id}">${can?`<div class="secthead"><span class="eyebrow">One thread through ${all?"the years":"the year"}${a.hidden?" · left out of the book":""}</span><button class="linkbtn" data-bkahide="${a.id}">${a.hidden?"Put back":"Leave out"}</button></div>`:""}
      <div class="bksup wide">${a.photos.map((k,i)=>`<figure style="margin:0">${bkThumb(c,k)}<figcaption class="cnt">${esc(a.whens&&a.whens[i]?bkYmLabel(a.whens[i]):"")}</figcaption></figure>`).join("")}</div>
      ${can?`<input data-bkaf="title" data-bka="${a.id}" value="${esc(a.title)}" aria-label="Title"><textarea data-bkaf="see" data-bka="${a.id}" rows="4" aria-label="What happened at each time">${esc(a.see)}</textarea>`:`<h3 style="font-size:17px;margin:0">${esc(a.title)}</h3><p style="margin:0">${esc(a.see)}</p>`}${bkNotesHtml(b,a.id,c.first)}</section>`).join("")}
    ${can?`<div class="actions"><button class="btn small ghost" data-bkacrossgo="${year||"all"}" ${busy?"disabled":""}>${BK.busy==="across:"+(year||"all")?"Reading":list.length?"Draft again":all?"Draft the culminating page":"Draft this year's closing pages"}</button><input class="bkthread" data-bkthread="${year||"all"}" placeholder="Or name a thread, such as a friend or a material" aria-label="A thread to follow"><button class="btn small ghost" data-bkthreadgo="${year||"all"}" ${busy?"disabled":""}>Follow it</button></div>
    <div class="cnt">${all?"One thread followed across more than one year, with an early, a middle and a late day. It prints just before the letter.":"One or two threads followed through this year, each with an early, a middle and a late day. They print after the year's last month."}</div>`:""}`}
function bookHtml(c){bkLoad(c);const b=bkBook(c),ents=bkEntries(c),years=bkYears(c),busy=!!BK.busy;const loading=BK.momP.has(c.id);
  const shown=b.pages.filter(p=>!p.hidden),n=bkSheets(c,b).length,signs=bkSigns(b),open=bkNotes(b),can=bkCan();
  const head=`<section class="card"><div class="secthead"><h3 style="font-size:17px">${esc(c.first)}'s book</h3>${shown.length?`<span class="cnt">${n} pages${n<BK_MIN?`, and a printed hardcover needs at least ${BK_MIN}`:""}</span>`:""}</div>
    <div class="cnt">The story of ${esc(c.first)}'s time at our school, for ${esc(c.first)} and the family. TREE drafts each page only from what educators wrote, with ${esc(c.first)}'s own words where they were written down. A page tells about the days. TREE does not know ${esc(c.first)}, so read every page as someone who does and change what is not true.</div>
    ${loading?`<div class="empty">Getting the earlier years.</div>`:""}
    ${!bkCan()?(b.pages.length?"":`<div class="empty">The director has not drafted ${esc(c.first)}'s book yet.</div>`):years.length?`<div class="actions">${years.map(y=>{const has1=b.pages.some(p=>p.year===y.year);return `<button class="btn small${has1?" ghost":""}" data-bkyear="${y.year}" ${busy?"disabled":""}>${BK.busy==="y:"+y.year?"Reading "+esc(yearLabel(y.year)):(has1?"Draft again, ":"Draft ")+esc(yearLabel(y.year))+(y.room?", "+esc(y.room)+" class":"")}</button>`}).join("")}</div>
      <div class="cnt">Drafting a year reads everything written that year and takes a few minutes. Pages an educator changed are kept when a year is drafted again.</div>`:(loading?"":`<div class="empty">Nothing is written about ${esc(c.first)} yet. The book begins with observations.</div>`)}
    ${shown.length?`<div class="actions">${b.readBy?`<span class="cnt">Read by ${esc(b.readBy.name)} on ${esc(shortDate(b.readBy.at))}.</span>`:`${open.length?`<span class="cnt">${open.length} note${open.length===1?"":"s"} from educators ${open.length===1?"is":"are"} open. The reading comes after ${bkCan()?"you have looked at them":"the director has looked at them"}.</span>`:`<button class="btn small" data-bkread="1">I know ${esc(c.first)} and I have read every page</button>`}`}
      <button class="btn small ghost" data-bkpdf="proof" ${BK.making?"disabled":""}>Proof PDF</button>${can?`<button class="btn small ghost" data-bkpdf="print" ${BK.making||!b.readBy?"disabled":""}>Print file</button><button class="btn small ghost" data-bkword="1" ${BK.making?"disabled":""}>Word file</button>`:""}</div>
      ${b.readBy?"":`<div class="cnt">The print file opens once someone who knows ${esc(c.first)} has read the book. Any change after that asks for the reading again.</div>`}`:""}</section>`;
  if(!b.pages.length)return head;
  const multi=new Set(b.pages.map(p=>p.year)).size>1;
  const body=[...new Set(b.pages.map(p=>p.year))].map(y=>{const ps=b.pages.filter(p=>p.year===y);const yr=years.find(v=>v.year===y);const have=new Set(ps.map(p=>p.ym));
    const gaps=yr?[...new Set(yr.entries.map(e=>e.ym))].filter(m=>!have.has(m)):[];
    return `<div class="sethead">${esc((ps[0].room?ps[0].room+" class, ":"")+yearLabel(y))}</div>${ps.map(p=>bkPageHtml(c,b,p,ents)).join("")}
      ${can&&gaps.length?`<div class="cnt bkgaps">No page yet for ${gaps.map(m=>{const e=yr.entries.find(x=>x.ym===m);return `<button class="linkbtn" data-bkuse="${esc(e.k)}" ${busy?"disabled":""}>${esc(bkYmLabel(m))}</button>`}).join(", ")}. Choosing a month writes a page from its first day, and Another story on that page offers the rest.</div>`:""}${bkClosingHtml(c,b,y,multi)}`}).join("");
  const closing=bkClosingHtml(c,b,"",multi);
  if(!can)return head+body+closing+(has(b.letter)?`<div class="sethead">The last page</div><section class="card">${String(b.letter).split(/\n+/).filter(has).map(t=>`<p style="margin:0">${esc(t)}</p>`).join("")}<p style="margin:0">With love,${signs.length?" "+esc(signs.join(" and ")):""}</p>${bkNotesHtml(b,"letter",c.first)}</section>`:"");
  const letter=`<div class="sethead">The last page</div><section class="card"><div class="cnt">A letter to ${esc(c.first)} from the educators, beside the photo chosen for the last page. It ends with the school's name.</div>
    <textarea data-bkletter="1" rows="10" aria-label="The letter" placeholder="Dear ${esc(c.first)},">${esc(b.letter||"")}</textarea>
    <div class="actions"><button class="btn small ghost" data-bkletgo="1" ${busy?"disabled":""}>${BK.busy==="letter"?"Writing a start":has(b.letter)?"Draft the letter again":"Draft a start from the pages"}</button></div>
    ${bkNotesHtml(b,"letter",c.first)}<div class="cnt">${signs.length?"Signed with love by "+esc(signs.join(" and "))+".":"Signed With love. "+(isDirector()?"Add the educators' first names for each class year on the Books page.":"The director can add the educators' first names for each class year.")}</div></section>`;
  return head+body+closing+letter}

/* ----- the Books page, every child's book in one list ----- */
function renderBooks(){const dir=isDirector();const kids=kidsAt().sort((a,b)=>(a.classroom||"").localeCompare(b.classroom||"")||a.first.localeCompare(b.first));
  const rooms=[...new Set(kids.map(c=>c.classroom).filter(Boolean))];const yNow=yearFromTime(Date.now()),y0=+yNow.slice(0,4);
  const ys=[0,1,2,3].map(i=>(y0-i)+"-"+String(y0-i+1).slice(2));
  $("#main").innerHTML=`<div class="head"><span class="eyebrow">Children</span><h2 style="margin-top:4px">Books</h2>
    <div class="sub">One book for each child, the story of their time at our school. Open a child to draft, read and print the book.</div></div>
    ${rooms.map(r=>`<div class="sethead">${esc(r)} class</div><section class="card">${kids.filter(c=>c.classroom===r).map(c=>{const b=books.get(c.id);const n=b?b.pages.filter(p=>!p.hidden).length:0;
      return `<div class="bkline"><button class="linkbtn" data-bkkid="${c.id}">${esc(kidName(c))}</button><span class="cnt">${n?`${n} page${n===1?"":"s"}${b.readBy?", read by "+esc(b.readBy.name):", not read yet"}${bkNotes(b).length?`, ${bkNotes(b).length} note${bkNotes(b).length===1?"":"s"} from educators`:""}`:"Not started"}</span></div>`}).join("")}</section>`).join("")||`<div class="empty">No children are on the roster yet.</div>`}
    ${dir?`<div class="sethead">Who signs each class year</div><section class="card"><div class="cnt">First names of the educators of each class, as they sign the letter on the last page, such as Ana, Bo and Cy. Leave one empty and that year signs With love only.</div>
      <div class="bksigns"><span></span>${CLASSROOMS.map(r=>`<b>${esc(r)}</b>`).join("")}${ys.map(y=>`<span>${esc(yearLabel(y))}</span>${CLASSROOMS.map(r=>`<input data-bksign="${esc(y+" "+r)}" value="${esc((bookSet.signs||{})[y+" "+r]||"")}" aria-label="${esc(r+" class, "+yearLabel(y))}">`).join("")}`).join("")}</div></section>`:""}`;
  const g=$("#main .bksigns");if(g)g.style.gridTemplateColumns=`8em repeat(${CLASSROOMS.length},minmax(0,1fr))`}

/* ----- the print, 11 by 8.5 inches with an eighth of an inch of bleed on every side ----- */
async function bkBmp(c,k){if(!k)return null;if(BK.bmp.has(k))return BK.bmp.get(k);let v=null;
  try{const u=bkUrl(c,k);if(u){const r=await fetchPhoto(u);v=await decodeImage(await r.blob())}}catch(e){}
  BK.bmp.set(k,v);return v}
// a photo cut to fill a box, kept a little above the middle, where faces usually are
function bkCut(bmp,w,h){const ratio=w/h;let sw=bmp.width,sh=sw/ratio;if(sh>bmp.height){sh=bmp.height;sw=sh*ratio}
  const sx=(bmp.width-sw)/2,sy=(bmp.height-sh)*.35;const sc=Math.min(1,(w/72*300)/sw);const cv=document.createElement("canvas");cv.width=Math.max(1,Math.round(sw*sc));cv.height=Math.max(1,Math.round(sh*sc));
  const g=cv.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,cv.width,cv.height);g.drawImage(bmp,sx,sy,sw,sh,0,0,cv.width,cv.height);return cv.toDataURL("image/jpeg",.9)}
async function bkPdf(c,proof){const b=bkBook(c);if(!b.pages.some(p=>!p.hidden))return;if(!proof&&!bkCan())return;
  if(!proof&&!b.readBy){toast(`Someone who knows ${c.first} reads the book before the print file is made.`);return}
  BK.making=true;renderMain();progress("Getting photos");
  try{await loadPrintFonts();const sheets=bkSheets(c,b);const doc=TREE_KIT.pdf({unit:"pt",format:[BK_W,BK_H],orientation:"landscape"});
    const INK=[27,41,32],MUTED=[95,105,98],MOSS=[43,90,64];const S=BK_SAFE,half=BK_W/2;let missed=0;
    const font=bold=>{if(PF.b64)doc.setFont(bold?"pfB":"pfR","normal");else doc.setFont("helvetica",bold?"bold":"normal")};
    const col=v=>doc.setTextColor(v[0],v[1],v[2]);
    const wrap=(t,w,size,bold)=>{font(bold);doc.setFontSize(size);return String(t||"").split(/\n+/).map(s=>s.trim()).filter(Boolean).map(s=>doc.splitTextToSize(s,w))};
    const put=(paras,x,y,size,lh,gap,color,bold,align)=>{font(bold);doc.setFontSize(size);col(color);for(const ls of paras){for(const l of ls){doc.text(l,x,y,align?{align}:undefined);y+=size*lh}y+=gap}return y};
    const tall=(paras,size,lh,gap)=>paras.reduce((s,ls)=>s+ls.length*size*lh+gap,0);
    const photo=async(k,x,y,w,h)=>{const bmp=await bkBmp(c,k);if(!bmp){if(k)missed++;return false}try{doc.addImage(bkCut(bmp,w,h),"JPEG",x,y,w,h,undefined,"FAST");return true}catch(e){missed++;return false}};
    const school=(x,y,align)=>{font(true);doc.setFontSize(9);col(MOSS);doc.setCharSpace(.6);doc.text("FULTON COMMUNITY SCHOOL & FARM",x,y,align?{align}:undefined);doc.setCharSpace(0)};
    const years=[...new Set(b.pages.filter(p=>!p.hidden).map(p=>p.year))];const span=years.length?years[0].slice(0,4)+" to "+(+years[years.length-1].slice(0,4)+1):"";
    let i=0;for(const s of sheets){if(i++)doc.addPage([BK_W,BK_H],"landscape");progress(`Making the book, page ${i} of ${sheets.length}`);
      if(s.t==="cover"){const ok=await photo(bkCoverKey(b),0,0,BK_W,BK_H-150);const y0=ok?BK_H-150:BK_H/2-60;
        font(true);doc.setFontSize(34);col(INK);doc.text(kidName(c),BK_W/2,y0+62,{align:"center"});
        font(false);doc.setFontSize(13);col(MUTED);if(span)doc.text(span,BK_W/2,y0+86,{align:"center"});school(BK_W/2,y0+112,"center")}
      else if(s.t==="open"){const q=wrap("“"+b.opening.quote+"”",BK_W-2*S-160,26,true);let y=BK_H/2-tall(q,26,1.3,0)/2;y=put(q,BK_W/2,y,26,1.3,0,INK,true,"center");
        if(has(b.opening.who))put(wrap(b.opening.who,400,12,false),BK_W/2,y+6,12,1.3,0,MUTED,false,"center")}
      else if(s.t==="year"){const ok=await photo(s.photo,0,0,BK_W,BK_H-130);const y0=ok?BK_H-130:BK_H/2-40;
        font(true);doc.setFontSize(28);col(INK);doc.text(s.room?s.room+" class":yearLabel(s.year),BK_W/2,y0+52,{align:"center"});
        if(s.room){font(false);doc.setFontSize(13);col(MUTED);doc.text(yearLabel(s.year),BK_W/2,y0+76,{align:"center"})}}
      else if(s.t==="page"){const p=s.p,left=s.side===0;const px=left?0:half;await photo(p.photos[0],px,0,half,BK_H);
        const tx=left?half+32:S,tw=half-32-S;const sup=p.photos.slice(1,3);const sh=sup.length?112:0;const top=S+14,bottom=BK_H-S-(sh?sh+16:0);
        const who=has(p.quote)?[c.first,bkAgeWords(c,p.qat)].filter(Boolean).join(", "):"";
        let size=12.5,parts;for(;;){parts={title:wrap(p.title,tw,22,true),body:wrap(p.body,tw,size,false),quote:has(p.quote)?wrap("“"+p.quote+"”",tw,size+3,true):[],see:has(p.see)?wrap(p.see,tw,size-1.5,false):[]};
          const h=30+tall(parts.title,22,1.15,0)+10+tall(parts.body,size,1.5,size*.5)+(parts.quote.length?tall(parts.quote,size+3,1.35,0)+18+10:0)+(parts.see.length?tall(parts.see,size-1.5,1.4,0)+8:0);
          if(top+h<=bottom||size<=8.5)break;size-=.5}
        font(true);doc.setFontSize(9);col(MOSS);doc.setCharSpace(.6);doc.text(bkYmLabel(p.ym).toUpperCase(),tx,top);doc.setCharSpace(0);
        let y=put(parts.title,tx,top+30,22,1.15,0,INK,true)+4;y=put(parts.body,tx,y+6,size,1.5,size*.5,INK,false);
        if(parts.quote.length){y=put(parts.quote,tx,y+8,size+3,1.35,0,MOSS,true);if(who){font(false);doc.setFontSize(9.5);col(MUTED);doc.text(who,tx,y);y+=18}}
        if(parts.see.length)put(parts.see,tx,y+6,size-1.5,1.4,0,MUTED,false);
        if(sup.length){const gw=10,w=(tw-gw)/2;for(let j=0;j<sup.length;j++)await photo(sup[j],tx+j*(w+gw),BK_H-S-sh,w,sh)}}
      else if(s.t==="across"){const a=s.a;font(true);doc.setFontSize(26);col(INK);doc.text(a.title,BK_W/2,S+46,{align:"center"});
        const n=Math.max(1,a.photos.length),gw=14,w=Math.min(230,(BK_W-2*S-(n-1)*gw)/n),h=w*1.3,x0=(BK_W-(n*w+(n-1)*gw))/2,y0=S+72;
        for(let j=0;j<a.photos.length;j++){await photo(a.photos[j],x0+j*(w+gw),y0,w,h);if(a.whens&&a.whens[j]){font(true);doc.setFontSize(8.5);col(MOSS);doc.setCharSpace(.5);doc.text(bkYmLabel(a.whens[j]).toUpperCase(),x0+j*(w+gw)+w/2,y0+h+15,{align:"center"});doc.setCharSpace(0)}}
        if(has(a.see)){const tw=BK_W-2*S-150;let size=12.5,ps;for(;;){ps=wrap(a.see,tw,size,false);if(y0+h+44+tall(ps,size,1.45,0)<=BK_H-S||size<=9)break;size-=.5}put(ps,BK_W/2,y0+h+44,size,1.45,0,INK,false,"center")}}
      else if(s.t==="last"){const ok=await photo(bkLastKey(b),0,0,half,BK_H);const tx=ok?half+32:S+90,tw=ok?half-32-S:BK_W-2*S-180;const signs=bkSigns(b);
        let size=12,paras;for(;;){paras=wrap(b.letter||"",tw,size,false);if(S+30+tall(paras,size,1.5,size*.6)+(signs.length+1)*size*1.5<=BK_H-S-30||size<=9)break;size-=.5}
        let y=put(paras,tx,S+30,size,1.5,size*.6,INK,false);if(has(b.letter)){y=put([["With love,"]],tx,y+4,size,1.5,0,INK,false);for(const g of signs)y=put(wrap(g,tw,size,false),tx,y,size,1.5,0,INK,false)}
        school(tx,BK_H-S)}
      if(proof){font(false);doc.setFontSize(8);col(MUTED);doc.text("Proof, not yet read for printing",BK_W-BK_BLEED-8,BK_BLEED+12,{align:"right"})}}
    if(missed)toast(`${missed} photo${missed>1?"s":""} could not be loaded, so the book leaves ${missed>1?"them":"it"} out.`);
    await saveFile(doc.output("blob"),safeFile(`${kidName(c)} book${proof?" proof":" for print"} ${iso(new Date())}`)+".pdf");
  }catch(e){toast("The book could not be made just now. Try again in a moment.")}
  finally{for(const v of BK.bmp.values())try{v&&v.close&&v.close()}catch(e){}BK.bmp.clear();BK.making=false;if(view==="child"&&kidTab==="book")renderMain()}
}
// the words of the book as a Word file, in the order they print
async function bkWord(c){const b=bkBook(c);if(!b.pages.some(p=>!p.hidden))return;BK.making=true;renderMain();
  try{const X=await TREE_KIT.word();const {Paragraph,TextRun,AlignmentType}=X;const kids=[];
    const para=(t,o)=>kids.push(new Paragraph(Object.assign({spacing:{after:160}},o&&o.p||{},{children:[new TextRun(Object.assign({text:String(t||""),size:24,font:"Arial"},o&&o.r||{}))]})));
    para(kidName(c),{p:{alignment:AlignmentType.CENTER},r:{bold:true,size:44}});para("Fulton Community School & Farm",{p:{alignment:AlignmentType.CENTER}});
    for(const s of bkSheets(c,b)){
      if(s.t==="open"){para("“"+b.opening.quote+"”",{p:{pageBreakBefore:true,alignment:AlignmentType.CENTER},r:{bold:true,size:32}});if(has(b.opening.who))para(b.opening.who,{p:{alignment:AlignmentType.CENTER}})}
      else if(s.t==="year")para((s.room?s.room+" class, ":"")+yearLabel(s.year),{p:{pageBreakBefore:true},r:{bold:true,size:36}});
      else if(s.t==="page"){const p=s.p;para(bkYmLabel(p.ym),{p:{spacing:{before:320,after:60}},r:{size:20}});para(p.title,{r:{bold:true,size:30}});
        for(const t of String(p.body).split(/\n+/).filter(has))para(t);if(has(p.quote)){para("“"+p.quote+"”",{r:{bold:true}});const who=[c.first,bkAgeWords(c,p.qat)].filter(Boolean).join(", ");if(who)para(who,{r:{size:20}})}
        if(has(p.see))para(p.see,{r:{color:"5F6962"}})}
      else if(s.t==="across"){para(s.a.title,{p:{spacing:{before:320,after:60}},r:{bold:true,size:30}});if(has(s.a.see))para(s.a.see)}
      else if(s.t==="last"&&has(b.letter)){let first=true;for(const t of String(b.letter).split(/\n+/).filter(has)){para(t,first?{p:{pageBreakBefore:true}}:null);first=false}para("With love,");for(const g of bkSigns(b))para(g)}}
    const d=TREE_KIT.wordFile(X,{creator:"Fulton Community School",title:kidName(c)+", book",sections:[{properties:{page:{margin:{top:1080,bottom:1080,left:1080,right:1080}}},children:kids}]});
    await saveFile(await TREE_KIT.wordBlob(X,d),safeFile(`${kidName(c)} book words ${iso(new Date())}`)+".docx");
  }catch(e){toast("The Word file could not be made just now. Try again in a moment.")}
  finally{BK.making=false;if(view==="child"&&kidTab==="book")renderMain()}
}

/* ----- what the buttons and the fields do ----- */
document.addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;
  if(view==="books"&&t.dataset.bkkid){kidOpen=t.dataset.bkkid;LS.set("tree.kid",kidOpen);kidTab="book";LS.set("tree.kidtab","book");goView("child");return}
  if(view!=="child"||kidTab!=="book")return;const c=children.get(kidOpen);if(!c)return;const d=t.dataset;
  const b=bkBook(c),page=id=>b.pages.find(p=>p.id===id);
  if(d.bkpdf==="proof"){if(!BK.making)bkPdf(c,true);return}
  if(d.bkread){if(!bkNotes(b).length&&b.pages.length){b.readBy={name:whoAmI(),at:Date.now()};bkSave(b);renderMain()}return}
  if(d.bknote){const ta=document.querySelector(`textarea[data-bknotetext="${d.bknote}"]`),text=ta?ta.value.trim():"";if(!text||!books.has(c.id))return;
    b.notes=Object.assign({},b.notes,{["n"+Date.now().toString(36)+Math.random().toString(36).slice(2,5)]:{on:d.bknote,by:whoAmI(),at:Date.now(),text:text.slice(0,1200)}});b.readBy=null;bkSave(b);toast("The director will see your note.");renderMain();return}
  if(!bkCan())return;
  if(d.bknotedone){if(b.notes&&b.notes[d.bknotedone]){b.notes=Object.assign({},b.notes);delete b.notes[d.bknotedone];bkSave(b);renderMain()}return}
  if(d.bkyear){if(!BK.busy)bkDraftYear(c,d.bkyear);return}
  if(d.bkuse){if(!BK.busy)bkDraftOne(c,d.bkuse,d.bkfor||"");return}
  if(d.bkacrossgo){if(!BK.busy)bkDraftAcross(c,d.bkacrossgo==="all"?"":d.bkacrossgo,"");return}
  if(d.bkthreadgo){const inp=document.querySelector(`input[data-bkthread="${d.bkthreadgo}"]`),th=inp?inp.value.trim():"";if(!th){toast("Name the thread to follow first.");return}if(!BK.busy)bkDraftAcross(c,d.bkthreadgo==="all"?"":d.bkthreadgo,th);return}
  if(d.bkletgo){if(!BK.busy)bkDraftLetter(c);return}
  if(d.bkpdf){if(!BK.making)bkPdf(c,d.bkpdf==="proof");return}
  if(d.bkword){if(!BK.making)bkWord(c);return}
  if(d.bkpick){BK.pick=BK.pick===d.bkpick?"":d.bkpick;BK.add="";renderMain();return}
  if(d.bkadd){BK.add=BK.add===d.bkadd?"":d.bkadd;BK.pick="";renderMain();return}
  if(d.bkhide){const p=page(d.bkhide);if(p){p.hidden=!p.hidden;bkTouched(b);bkSave(b);renderMain()}return}
  if(d.bkahide){const a=(b.across||[]).find(x=>x.id===d.bkahide);if(a){a.hidden=!a.hidden;bkTouched(b);bkSave(b);renderMain()}return}
  if(d.bkopen){const p=page(d.bkopen);if(p&&has(p.quote)){b.opening=b.opening&&b.opening.page===p.id?null:{page:p.id,quote:p.quote,who:[c.first,bkAgeWords(c,p.qat)].filter(Boolean).join(", ")};bkTouched(b);bkSave(b);renderMain()}return}
  if(d.bkmain){const p=page(d.bkmain);if(p){p.photos=[d.k,...p.photos.filter(k=>k!==d.k)].slice(0,3);p.edited=true;bkTouched(b);bkSave(b);renderMain()}return}
  if(d.bksup){const p=page(d.bksup);if(p){const i=p.photos.indexOf(d.k);if(i>0)p.photos.splice(i,1);else if(i<0){if(p.photos.length>=3)p.photos.pop();p.photos.push(d.k)}p.edited=true;bkTouched(b);bkSave(b);renderMain()}return}
  if(d.bkcover){b.cover=b.cover===d.bkcover?"":d.bkcover;bkTouched(b);bkSave(b);renderMain();return}
  if(d.bklast){b.last=b.last===d.bklast?"":d.bklast;bkTouched(b);bkSave(b);renderMain();return}
});
document.addEventListener("input",e=>{const t=e.target;if(!t||!t.dataset)return;
  if(view==="books"&&t.dataset.bksign&&isDirector()){bookSet=Object.assign({id:"book"},bookSet,{signs:Object.assign({},bookSet.signs,{[t.dataset.bksign]:t.value.trim()})});clearTimeout(BK.timers.get("set"));BK.timers.set("set",setTimeout(()=>{BK.timers.delete("set");if(db)db.doc("settings/book").set(JSON.parse(JSON.stringify(bookSet))).catch(()=>toast("Could not save the names. Check your connection."))},700));return}
  if(view!=="child"||kidTab!=="book"||!bkCan())return;const c=children.get(kidOpen);if(!c)return;const b=bkBook(c);
  if(t.dataset.bkf){const p=b.pages.find(x=>x.id===t.dataset.bkp);if(!p)return;p[t.dataset.bkf]=t.value;p.edited=true;
    if(t.dataset.bkf==="quote"){const q=bkNorm(t.value),ents=bkEntries(c).filter(x=>p.sources.includes(x.k));const from=q.length>1&&ents.find(x=>bkNorm(x.words).includes(q));p.quoteOk=!!from;p.qat=from?from.at:(p.qat||0);if(b.opening&&b.opening.page===p.id)b.opening=has(t.value)?Object.assign({},b.opening,{quote:t.value.trim()}):null}
    const fl=document.querySelector(`[data-bkflags="${p.id}"]`);if(fl)fl.innerHTML=bkFlags(c,p).map(f=>`<div class="bkflag">${esc(f)}</div>`).join("");
    bkTouched(b);bkSaveSoon(b);return}
  if(t.dataset.bkaf){const a=(b.across||[]).find(x=>x.id===t.dataset.bka);if(!a)return;a[t.dataset.bkaf]=t.value;a.edited=true;bkTouched(b);bkSaveSoon(b);return}
  if(t.dataset.bkletter){b.letter=t.value;bkTouched(b);bkSaveSoon(b);return}
});
// leaving a field shows the page as it now stands, with the reading asked for again
document.addEventListener("focusout",e=>{const t=e.target;if(view!=="child"||kidTab!=="book"||!bkCan()||!t||!t.dataset||!(t.dataset.bkf||t.dataset.bkaf||t.dataset.bkletter))return;
  const c=children.get(kidOpen);if(!c)return;const b=bkBook(c);clearTimeout(BK.timers.get(b.id));BK.timers.delete(b.id);bkSave(b);
  setTimeout(()=>{if(view==="child"&&kidTab==="book"&&!document.activeElement?.closest?.("#main textarea,#main input"))renderMain()},150)});

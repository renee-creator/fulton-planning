/* ---------- Demonstration recipe sheets ----------
   Every food and sensory recipe also prints as a step by step demonstration set for the piazza, through the one print
   kit. Washing our hands is always the first step. Each step has its own large sheet with one action and very few words,
   in Andika. Ingredients and tools show realistic pictures from our picture library, one per item, each on white in one
   consistent style, with the item's name in large type beside it, so sugar and salt are never mistaken. A step shows the
   picture for exactly the item it names. An item with no picture yet shows its words only, never a drawing, and waits on
   the recipe library's Pictures still needed list. A measurement shows the real photo of the right measuring cup or spoon
   when the library has one, repeated for how many are needed, with the amount in large type beside it. Waiting and
   cooking times show a clock, and a step only an adult does carries the adult hand. A photo from our own observations
   can stand on a step once the face check finds no faces. One overview sheet lists the ingredients and tools. */
const DEMO_INK="#2f3b2f",DEMO_SOFT="#e9efe2",DEMO_WARM="#f4e2c2",DEMO_LINE=6;
// a measure read from an ingredient line, such as 2 1/2 cups milk or 1/4 teaspoon salt
const DEMO_UNITS=[["cup",/^(cups?|c\.?)\b/i],["tablespoon",/^(tablespoons?|tbsp\.?|tbs\.?|T)\b/],["teaspoon",/^(teaspoons?|tsp\.?|t)\b/]];
function demoQty(line){const m=String(line||"").trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+|[½¼¾⅓⅔])\s*(.*)$/);if(!m)return null;
  const frac={"½":.5,"¼":.25,"¾":.75,"⅓":1/3,"⅔":2/3};let n=0;for(const p of m[1].split(/\s+/)){n+=frac[p]!=null?frac[p]:/\//.test(p)?(+p.split("/")[0])/(+p.split("/")[1]):+p}
  let rest=m[2].trim(),unit=null;for(const [u,re] of DEMO_UNITS){const x=rest.match(re);if(x){unit=u;rest=rest.slice(x[0].length).trim();break}}
  rest=rest.replace(/^of\s+/i,"");return {n,unit,item:rest}}
// how many cups or spoons to draw, and how full each is
function demoFills(q){if(!q||!q.unit||!(q.n>0))return [];const out=[];let left=q.n;while(left>1e-6&&out.length<10){const f=Math.min(1,left);out.push(f);left-=f}return out}
const demoFracText=n=>{const w=Math.floor(n+1e-9),f=n-w,F=[[.25,"1/4"],[1/3,"1/3"],[.5,"1/2"],[2/3,"2/3"],[.75,"3/4"]].find(([v])=>Math.abs(v-f)<.02);return (w?w+(F?" ":""):"")+(F?F[1]:f>.02?String(Math.round(f*100)/100):"")||String(n)};
// a canvas, drawn at a set size in pixels, as a picture for both the PDF and the Word file
function demoCanvas(w,h,draw){const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");g.lineCap="round";g.lineJoin="round";g.strokeStyle=DEMO_INK;g.fillStyle=DEMO_SOFT;g.lineWidth=DEMO_LINE;draw(g,w,h);return c.toDataURL("image/png")}
const demoRR=(g,x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()};
// the picture library's key for an item, such as whole_wheat_flour for 2 3/4 cups whole wheat flour, or banana for 5 bananas, mashed
const demoKey=t=>{let x=String(t||"").toLowerCase().replace(/\(.*?\)/g,"").split(",")[0].replace(/^(a|an|the|some|our)\s+/,"").replace(/[^a-z\s]/g," ").trim().replace(/\s+/g," ");
  x=x.replace(/\b(large|small|medium|fresh|dried|ripe|chopped|mashed|sliced|grated|softened|melted|warm|cold|boiling|ground|raw|cooked|about|plus|more|for|the|to|taste)\b/g," ").replace(/\s+/g," ").trim();
  const w=x.split(" ");const last=w.pop()||"";const sing=/(ss|us)$/.test(last)?last:last.replace(/(ches|shes|sses|xes)$/,m=>m.slice(0,-2)).replace(/ies$/,"y").replace(/oes$/,"o").replace(/s$/,"");return [...w,sing].filter(Boolean).join("_")};
const demoPicOf=key=>{const P=(libData&&libData.pictures)||{};if(P[key])return Object.assign({key},P[key]);const parts=key.split("_");for(let i=1;i<parts.length;i++){const k=parts.slice(i).join("_");if(P[k]&&P[k].from==="photo"&&false)return Object.assign({key:k},P[k])}return null};
const demoPicCache=new Map();
// a picture as a data address for the PDF and the Word file, read once
async function demoPicData(pic){if(!pic)return null;const ck=pic.from+"|"+(pic.id||pic.path);if(demoPicCache.has(ck))return demoPicCache.get(ck);let blob=null;
  try{if(pic.from==="photo"&&window.FP_ORIGINAL_URL)blob=await (await fetch(window.FP_ORIGINAL_URL(pic.id))).blob();
    else{const r=await fetch(window.FP_SERVER+"/api/staff/library/img",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(localStorage.getItem("fp-token")||"")},body:JSON.stringify({name:pic.key})});if(r.ok)blob=await r.blob()}}catch(e){blob=null}
  if(!blob||!blob.size){demoPicCache.set(ck,null);return null}
  // drawn onto white as a JPEG, so the PDF and Word file stay small and every picture sits on the same white
  const url=await new Promise(ok=>{const im=new Image();const u=URL.createObjectURL(blob);im.onload=()=>{const m=900,k=Math.min(1,m/Math.max(im.width,im.height));const c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);ok({data:c.toDataURL("image/jpeg",.86),w:c.width,h:c.height})};im.onerror=()=>{URL.revokeObjectURL(u);ok(null)};im.src=u});
  demoPicCache.set(ck,url);return url}
// every item the recipes name, ingredients and tools, by key, for the Pictures still needed list
function demoItemsAll(){const out=new Map();for(const x of ((libData&&libData.recipes)||[]).filter(r=>!r.draft)){
    for(const l of libLines(recPart(x,"Ingredients"))){const q=demoQty(l);const k=demoKey(q?q.item:l);if(k&&!out.has(k))out.set(k,{key:k,name:k.replace(/_/g," "),kind:"ingredient",recipes:new Set()});if(k)out.get(k).recipes.add(x.title)}
    for(const l of libLines(recPart(x,"Tools"))){const k=demoKey(l);if(k&&!out.has(k))out.set(k,{key:k,name:k.replace(/_/g," "),kind:"tool",recipes:new Set()});if(k)out.get(k).recipes.add(x.title)}
    for(const l of libLines(recPart(x,"Ingredients"))){const q=demoQty(l);if(q&&q.unit){const k=q.unit==="cup"?"measuring_cup":q.unit;if(!out.has(k))out.set(k,{key:k,name:q.unit==="cup"?"measuring cup":q.unit,kind:"measure",recipes:new Set()});out.get(k).recipes.add(x.title)}}}
  return [...out.values()]}
// the adult hand, for a step only an adult does
function demoHand(){return demoCanvas(300,300,(g)=>{g.fillStyle="#f3d7c7";g.beginPath();g.moveTo(90,280);g.lineTo(90,150);for(const [x,h] of [[90,90],[125,60],[160,55],[195,75]]){g.lineTo(x,h);g.arc(x+17,h,17,Math.PI,0);g.lineTo(x+34,150)}
  g.lineTo(229,150);g.quadraticCurveTo(275,120,262,180);g.lineTo(229,260);g.lineTo(210,280);g.closePath();g.fill();g.stroke()})}
// a clock for waiting or cooking
function demoClock(){return demoCanvas(300,300,(g)=>{g.beginPath();g.arc(150,150,110,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.moveTo(150,150);g.lineTo(150,75);g.moveTo(150,150);g.lineTo(205,165);g.stroke()})}
// hands under running water, for the first step
function demoWash(){return demoCanvas(300,300,(g)=>{g.fillStyle="#cfe5f2";for(const x of [120,150,180]){g.beginPath();g.moveTo(x,30);g.quadraticCurveTo(x+14,70,x,90);g.quadraticCurveTo(x-14,70,x,30);g.fill();g.stroke()}
  g.fillStyle="#f3d7c7";demoRR(g,70,140,160,110,50);g.fill();g.stroke()})}
// the sheets of a recipe, each with its words and pictures, laid out the same way on paper and in Word
async function demoPlan(x){if(!libData)await loadLibrary();const ings=libLines(recPart(x,"Ingredients")),tools=libLines(recPart(x,"Tools"));let steps=libLines(recPart(x,"Steps"));
  // the washing sheet is always first, so a recipe's own first step about washing is not shown twice
  if(steps.length&&/^wash our hands\b/i.test(steps[0]))steps=steps.slice(1);
  const qs=ings.map(l=>({line:l,q:demoQty(l)}));const photos={};String((x.meta||{}).photos||"").split(/[;,]\s*/).forEach(p=>{const m=p.match(/^(\d+)=(.+)$/);if(m)photos[+m[1]]=m[2].trim()});
  const sheets=[{n:1,text:"Wash our hands.",pics:[{img:demoWash(),w:1.2,drawn:true}],words:[],adult:false}];
  const measured=new Set();
  for(let i=0;i<steps.length;i++){const s=steps[i];const adult=/^an adult\b/i.test(s);const pics=[],words=[];
    for(const {q,line} of qs){const name=(q?q.item:line).split(",")[0].toLowerCase().replace(/^(a|an|the)\s+/,"");const keys=name.split(/[\s,]+/).filter(w=>w.length>=3&&!/^(the|and|for|our|you|use)$/i.test(w)&&!/^(like|each|child|from|some|more|with|your|they|that|large|small|fresh|dried|ground|boiling|warm|school)$/i.test(w));
      if(!keys.length||!keys.every(k=>new RegExp("\\b"+k.replace(/(es|s)$/,"")+"(e?s)?\\b","i").test(s)))continue;
      const first=!measured.has(line);measured.add(line);const key=demoKey(q?q.item:line);const label=name.replace(/\s*\(.*\)$/,"");
      // the measure first, the right cup or spoon repeated for how many, with the amount in large type
      const amount=first&&q&&q.n?demoFracText(q.n)+(q.unit?" "+q.unit+(q.n>1?"s":""):""):"";
      if(first&&q&&q.unit){const mk=q.unit==="cup"?"measuring_cup":q.unit;const mp=await demoPicData(demoPicOf(mk));if(mp)demoFills(q).forEach(f=>pics.push({img:mp.data,w:.6,cap:demoFracText(f)+" "+q.unit}))}
      const pd=await demoPicData(demoPicOf(key));if(pd)pics.push({img:pd.data,w:.85,cap:[amount,label].filter(Boolean).join(" "),big:true});else words.push({big:[amount,label].filter(Boolean).join(" "),small:""});if(pics.length>10)break}
    if(!pics.length&&!words.length)for(const t of tools){const last=(t.split(/\s+/).slice(-1)[0]||"").replace(/s$/,"");if(!last||!new RegExp("\\b"+last+"s?\\b","i").test(s))continue;const pd=await demoPicData(demoPicOf(demoKey(t)));if(pd)pics.push({img:pd.data,w:.85,cap:t.replace(/^(a|an|the)\s+/i,""),big:true});else words.push({big:t.replace(/^(a|an|the)\s+/i,""),small:""});break}
    const tm=s.match(/(\d+)(?:\s*(?:to|or)\s*(\d+))?\s*minutes?/i);if(tm)pics.push({img:demoClock(),w:.7,cap:tm[2]?tm[1]+" to "+tm[2]+" minutes":tm[1]+" minutes",drawn:true});else if(/\b(wait|let it (rest|cool)|cools?)\b/i.test(s))pics.push({img:demoClock(),w:.7,cap:"wait",drawn:true});
    sheets.push({n:i+2,text:s,adult,pics,words,photo:photos[i+2]||photos[String(i+2)]||""})}
  const item=async t=>{const q=demoQty(t);const pd=await demoPicData(demoPicOf(demoKey(q?q.item:t)));return {text:t,img:pd?pd.data:null}};
  const overview={title:x.title,ings:await Promise.all(qs.map(({line})=>item(line))),tools:await Promise.all(tools.map(item))};
  return {overview,sheets,hand:demoHand()}}
// the set as a PDF, letter or poster, Andika throughout
const demoFmt=d=>/^data:image\/png/.test(d)?"PNG":"JPEG";
async function demoPdf(x,size){if(!window.jspdf)await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf,"jspdf");await TREE_KIT.fonts();const P=await demoPlan(x);const S=TREE_KIT.SIZES[size];const doc=TREE_KIT.pdf({size,orientation:"portrait"});const k=S.w/612,M=40*k;
  const font=b=>{try{doc.setFont(b?"pfB":"pfR","normal")}catch(e){doc.setFont("helvetica",b?"bold":"normal")}};
  // the overview, for setting up, with a picture where the library has one and the words always
  font(true);doc.setFontSize(34*k);doc.text(P.overview.title,M,M+30*k);doc.setFontSize(20*k);doc.text("What we need",M,M+70*k);
  let y=M+86*k;const row=(it)=>{if(it.img)doc.addImage(it.img,demoFmt(it.img),M,y,44*k,44*k);font(false);doc.setFontSize(16*k);doc.text(doc.splitTextToSize(it.text,S.w-M*2-60*k),M+(it.img?56*k:0),y+27*k);y+=50*k;if(y>S.h-M-50*k){doc.addPage([S.w,S.h]);y=M}};
  P.overview.ings.forEach(row);if(P.overview.tools.length){font(true);doc.setFontSize(20*k);doc.text("Tools",M,y+20*k);y+=34*k;P.overview.tools.forEach(row)}
  for(const sh of P.sheets){doc.addPage([S.w,S.h]);font(true);doc.setFillColor(47,59,47);doc.circle(M+28*k,M+28*k,28*k,"F");doc.setTextColor(255,255,255);doc.setFontSize(28*k);doc.text(String(sh.n),M+28*k,M+38*k,{align:"center"});doc.setTextColor(47,59,47);
    doc.setFontSize(44*k);const lines=doc.splitTextToSize(sh.text,S.w-M*2-(sh.adult?130*k:0));doc.text(lines,M,M+110*k);let top=M+110*k+lines.length*50*k;
    if(sh.adult){doc.addImage(P.hand,"PNG",S.w-M-90*k,M,90*k,90*k);font(false);doc.setFontSize(14*k);doc.text("An adult does this step",S.w-M,M+104*k,{align:"right"})}
    if(sh.photo&&window.FP_ORIGINAL_URL){try{const b=await (await fetch(window.FP_ORIGINAL_URL(sh.photo))).blob();const u=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});doc.addImage(u,"JPEG",M,top,S.w-M*2,(S.w-M*2)*.6);top+=(S.w-M*2)*.6+16*k}catch(e){}}
    // the amounts and the items with no picture yet, in large type
    for(const w of sh.words){if(top>S.h-M-60*k)break;font(true);doc.setFontSize(30*k);const wl=doc.splitTextToSize(w.big,S.w-M*2);doc.text(wl,M,top+30*k);top+=wl.length*36*k+6*k}
    if(sh.words.length)top+=10*k;
    let x0=M,lineH=0;for(const p of sh.pics){const w=150*k*p.w,h=w;if(x0+w>S.w-M){x0=M;top+=lineH+(p.big?44:30)*k;lineH=0}if(top+h>S.h-M)break;doc.addImage(p.img,demoFmt(p.img),x0,top,w,h);if(p.cap){font(!!p.big);doc.setFontSize((p.big?24:15)*k);doc.text(doc.splitTextToSize(p.cap,w+10*k),x0+w/2,top+h+(p.big?26:16)*k,{align:"center"})}x0+=w+14*k;lineH=Math.max(lineH,h)}}
  return doc.output("blob")}
// the same set as a Word file, one page for each sheet
async function demoWord(x,size){const D=await TREE_KIT.word();await TREE_KIT.fonts();const P=await demoPlan(x);const S=TREE_KIT.SIZES[size],k=S.w/612;
  const img=(data,w)=>new D.ImageRun({data:Uint8Array.from(atob(data.split(",")[1]),c=>c.charCodeAt(0)),type:/^data:image\/png/.test(data)?"png":"jpg",transformation:{width:Math.round(w),height:Math.round(w)}});
  const run=(t,pt,b)=>new D.TextRun({text:t,size:Math.round(pt*2*k),bold:!!b,font:"Andika"});
  const sections=[{children:[new D.Paragraph({children:[run(P.overview.title,30,true)]}),new D.Paragraph({children:[run("What we need",18,true)]}),
    ...P.overview.ings.map(it=>new D.Paragraph({children:[...(it.img?[img(it.img,44*k)]:[]),run("  "+it.text,15)]})),...(P.overview.tools.length?[new D.Paragraph({children:[run("Tools",18,true)]}),...P.overview.tools.map(it=>new D.Paragraph({children:[...(it.img?[img(it.img,44*k)]:[]),run("  "+it.text,15)]}))]:[])]}];
  for(const sh of P.sheets)sections.push({children:[new D.Paragraph({children:[run(String(sh.n),28,true),...(sh.adult?[run("     ",12),img(P.hand,70*k),run("  An adult does this step",13)]:[])]}),new D.Paragraph({spacing:{before:300,after:300},children:[run(sh.text,40,true)]}),
    ...sh.words.map(w=>new D.Paragraph({children:[run(w.big,32,true)]})),
    new D.Paragraph({children:sh.pics.flatMap(p=>[img(p.img,120*k*p.w),run("  ",10)])}),...(sh.pics.some(p=>p.cap)?[new D.Paragraph({children:[run(sh.pics.map(p=>p.cap).filter(Boolean).join(",  "),20,true)]})]:[])]});
  const docx=TREE_KIT.wordFile(D,{size,sections,styles:{default:{document:{run:{font:"Andika"}}}},fonts:TREE_KIT.wordFonts()});return TREE_KIT.wordBlob(D,docx)}

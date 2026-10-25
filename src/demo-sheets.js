/* ---------- Demonstration recipe sheets ----------
   Every food and sensory recipe also prints as a step by step demonstration set for the piazza, through the one print
   kit. Washing our hands is always the first step. Each step has its own large sheet with one action and very few words,
   in Andika. Each measurement is drawn, a measuring cup or spoon at its true size beside the others, filled to its level
   and repeated for how many to add, so 2 cups shows two full cups and 1/2 teaspoon shows a half full teaspoon. Each
   ingredient and tool has a simple drawing, waiting and cooking times show a clock, and a step only an adult does, such
   as the oven, the griddle or a knife, carries the adult hand. A photo from our own observations can stand on a step once
   the face check finds no faces. One overview sheet lists the ingredients and tools for setting up. Letter and poster. */
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
// a measuring cup or spoon at its true size beside the others, filled to its level. A cup holds 16 tablespoons and a
// tablespoon 3 teaspoons, so each is drawn by the cube root of what it holds.
const DEMO_SCALE={cup:1,tablespoon:Math.cbrt(1/16),teaspoon:Math.cbrt(1/48)};
function demoMeasure(unit,fill){const S=DEMO_SCALE[unit]||1,W=360,H=300;return demoCanvas(W,H,(g)=>{
  if(unit==="cup"){const w=200*S,h=170*S,x=40,y=H-30-h;
    g.save();demoRR(g,x,y,w,h,18*S);g.clip();g.fillStyle=DEMO_WARM;g.fillRect(x,y+h*(1-fill),w,h*fill);g.restore();
    demoRR(g,x,y,w,h,18*S);g.stroke();g.beginPath();g.moveTo(x+w,y+h*.25);g.lineTo(x+w+110*S,y+h*.2);g.lineTo(x+w+110*S,y+h*.42);g.lineTo(x+w,y+h*.45);g.stroke();
    if(fill<1){g.setLineDash([10,10]);g.beginPath();g.moveTo(x,y+h*(1-fill));g.lineTo(x+w,y+h*(1-fill));g.stroke();g.setLineDash([])}}
  else{const r=110*S,cx=40+r,cy=H-40-r*.6;g.save();g.beginPath();g.ellipse(cx,cy,r,r*.6,0,0,Math.PI*2);g.clip();g.fillStyle=DEMO_WARM;g.fillRect(cx-r,cy+r*.6-r*1.2*fill,2*r,r*1.2*fill);g.restore();
    g.beginPath();g.ellipse(cx,cy,r,r*.6,0,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(cx+r,cy);g.lineTo(cx+r+220*Math.max(.5,S),cy-30);g.stroke();
    if(fill<1){g.setLineDash([8,8]);g.beginPath();g.moveTo(cx-r,cy+r*.6-r*1.2*fill);g.lineTo(cx+r,cy+r*.6-r*1.2*fill);g.stroke();g.setLineDash([])}}})}
// a simple drawing for an ingredient or a tool, chosen by its words
const DEMO_ICONS=[["egg",/\begg/i],["banana",/banana/i],["milk",/milk/i],["bottle",/\b(oil|vanilla|vinegar|glue)\b/i],["butter",/butter|spread/i],["water",/\bwater\b/i],["bread",/bread|toast/i],
  ["sack",/flour|oats|rice|noodle|pasta/i],["shaker",/\bsalt\b|pepper|seasoning|cinnamon|sugar|powder|soda|tartar|thyme|parsley|herb|spice|borax/i],["veg",/carrot|celery|onion|garlic|tomato|bean|pear|apple|fruit|squash|chicken|berr/i],
  ["paint",/colou?r/i],["bowl",/bowl/i],["whisk",/whisk/i],["spoon",/spoon|spatula|fork/i],["pan",/griddle|pan|pot|kettle|waffle|tin|oven/i],["knife",/knife|cutting board|food processor/i],["brush",/brush/i],["plate",/plate|tray/i]];
function demoIconKind(t){const x=DEMO_ICONS.find(([,re])=>re.test(t||""));return x?x[0]:"dot"}
function demoIcon(kind){return demoCanvas(300,300,(g,W,H)=>{const c=W/2;g.fillStyle=DEMO_SOFT;
  const circ=(x,y,r,f)=>{g.beginPath();g.arc(x,y,r,0,Math.PI*2);if(f)g.fill();g.stroke()};
  if(kind==="egg"){g.beginPath();g.ellipse(c,c+10,80,105,0,0,Math.PI*2);g.fill();g.stroke()}
  else if(kind==="banana"){g.fillStyle="#f6e08a";g.beginPath();g.moveTo(50,110);g.quadraticCurveTo(150,290,260,110);g.quadraticCurveTo(150,220,50,110);g.fill();g.stroke()}
  else if(kind==="milk"){demoRR(g,95,90,110,180,10);g.fill();g.stroke();g.beginPath();g.moveTo(95,90);g.lineTo(150,40);g.lineTo(205,90);g.stroke()}
  else if(kind==="bottle"){demoRR(g,105,110,90,160,20);g.fill();g.stroke();demoRR(g,130,50,40,60,8);g.stroke()}
  else if(kind==="butter"){demoRR(g,60,120,180,90,8);g.fillStyle="#fbefb0";g.fill();g.stroke()}
  else if(kind==="water"){g.fillStyle="#cfe5f2";g.beginPath();g.moveTo(c,50);g.quadraticCurveTo(250,200,c,250);g.quadraticCurveTo(50,200,c,50);g.fill();g.stroke()}
  else if(kind==="bread"){g.fillStyle=DEMO_WARM;g.beginPath();g.moveTo(70,250);g.lineTo(70,140);g.arc(c,140,80,Math.PI,0);g.lineTo(230,250);g.closePath();g.fill();g.stroke()}
  else if(kind==="sack"){g.beginPath();g.moveTo(80,260);g.lineTo(90,100);g.lineTo(210,100);g.lineTo(220,260);g.closePath();g.fill();g.stroke();g.beginPath();g.moveTo(100,100);g.lineTo(150,70);g.lineTo(200,100);g.stroke()}
  else if(kind==="shaker"){demoRR(g,100,110,100,150,16);g.fill();g.stroke();demoRR(g,100,70,100,40,10);g.stroke();for(const x of [125,150,175])circ(x,90,4,false)}
  else if(kind==="veg"){g.fillStyle="#f2b880";circ(c,170,80,true);g.beginPath();g.moveTo(c,90);g.quadraticCurveTo(c+40,40,c+70,60);g.stroke()}
  else if(kind==="paint"){g.fillStyle="#e8c25a";g.beginPath();g.moveTo(c,60);g.quadraticCurveTo(240,200,c,250);g.quadraticCurveTo(60,200,c,60);g.fill();g.stroke()}
  else if(kind==="bowl"){g.beginPath();g.moveTo(50,140);g.lineTo(250,140);g.quadraticCurveTo(250,250,c,250);g.quadraticCurveTo(50,250,50,140);g.fill();g.stroke()}
  else if(kind==="whisk"){g.beginPath();g.moveTo(c,270);g.lineTo(c,170);g.stroke();for(const d of [-40,-15,15,40]){g.beginPath();g.moveTo(c,170);g.quadraticCurveTo(c+d*2,90,c,40);g.stroke()}}
  else if(kind==="spoon"){g.beginPath();g.ellipse(c,90,40,55,0,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.moveTo(c,145);g.lineTo(c,270);g.stroke()}
  else if(kind==="pan"){g.beginPath();g.ellipse(130,170,90,40,0,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.moveTo(220,170);g.lineTo(285,150);g.stroke()}
  else if(kind==="knife"){g.beginPath();g.moveTo(60,200);g.lineTo(200,120);g.lineTo(215,140);g.lineTo(80,215);g.closePath();g.fill();g.stroke();g.beginPath();g.moveTo(205,128);g.lineTo(260,95);g.stroke()}
  else if(kind==="brush"){demoRR(g,120,40,60,80,8);g.fill();g.stroke();g.beginPath();g.moveTo(c,120);g.lineTo(c,270);g.stroke()}
  else if(kind==="plate"){g.beginPath();g.ellipse(c,170,120,55,0,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.ellipse(c,170,70,30,0,0,Math.PI*2);g.stroke()}
  else circ(c,c,70,true)})}
// the adult hand, for a step only an adult does
function demoHand(){return demoCanvas(300,300,(g)=>{g.fillStyle="#f3d7c7";g.beginPath();g.moveTo(90,280);g.lineTo(90,150);for(const [x,h] of [[90,90],[125,60],[160,55],[195,75]]){g.lineTo(x,h);g.arc(x+17,h,17,Math.PI,0);g.lineTo(x+34,150)}
  g.lineTo(229,150);g.quadraticCurveTo(275,120,262,180);g.lineTo(229,260);g.lineTo(210,280);g.closePath();g.fill();g.stroke()})}
// a clock for waiting or cooking
function demoClock(){return demoCanvas(300,300,(g)=>{g.beginPath();g.arc(150,150,110,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.moveTo(150,150);g.lineTo(150,75);g.moveTo(150,150);g.lineTo(205,165);g.stroke()})}
// hands under running water, for the first step
function demoWash(){return demoCanvas(300,300,(g)=>{g.fillStyle="#cfe5f2";for(const x of [120,150,180]){g.beginPath();g.moveTo(x,30);g.quadraticCurveTo(x+14,70,x,90);g.quadraticCurveTo(x-14,70,x,30);g.fill();g.stroke()}
  g.fillStyle="#f3d7c7";demoRR(g,70,140,160,110,50);g.fill();g.stroke()})}
// the sheets of a recipe, each with its words and pictures, drawn the same way on paper and in Word
function demoPlan(x){const ings=libLines(recPart(x,"Ingredients")),tools=libLines(recPart(x,"Tools")),steps=libLines(recPart(x,"Steps"));
  const qs=ings.map(l=>({line:l,q:demoQty(l)}));const photos={};String((x.meta||{}).photos||"").split(/[;,]\s*/).forEach(p=>{const m=p.match(/^(\d+)=(.+)$/);if(m)photos[+m[1]]=m[2].trim()});
  const sheets=[{n:1,text:"Wash our hands.",pics:[{img:demoWash(),w:1.2}],adult:false}];
  // an ingredient's measure is drawn the first time a step names it, and later steps show only its picture
  const measured=new Set();
  steps.forEach((s,i)=>{const adult=/^an adult\b/i.test(s);const text=s;const pics=[];
    for(const {q,line} of qs){const name=(q?q.item:line).split(",")[0].toLowerCase().replace(/^(a|an|the)\s+/,"");const keys=name.split(/[\s,]+/).filter(w=>w.length>=3&&!/^(the|and|for|our|you|use)$/i.test(w)&&!/^(like|each|child|from|some|more|with|your|they|that|whole|wheat|large|small|fresh|dried|ground|white|boiling|warm|school)$/i.test(w));if(!keys.some(k=>new RegExp("\\b"+k.replace(/(es|s)$/,"")+"(e?s)?\\b","i").test(s)))continue;
      const first=!measured.has(line);measured.add(line);const fills=first?demoFills(q):[];fills.forEach(f=>pics.push({img:demoMeasure(q.unit,f),w:.8,cap:demoFracText(f)+" "+q.unit}));
      pics.push({img:demoIcon(demoIconKind(name)),w:.7,cap:(first&&q&&q.n&&!fills.length?demoFracText(q.n)+" ":"")+name.replace(/\s*\(.*\)$/,"")});if(pics.length>12)break}
    if(!pics.length)for(const t of tools)if(new RegExp("\\b"+(t.split(/\s+/).slice(-1)[0]||"").replace(/s$/,"")+"\\b","i").test(s))pics.push({img:demoIcon(demoIconKind(t)),w:.8,cap:t.replace(/^(a|an|the)\s+/i,"")});
    const tm=s.match(/(\d+)(?:\s*(?:to|or)\s*(\d+))?\s*minutes?/i);if(tm)pics.push({img:demoClock(),w:.8,cap:tm[2]?tm[1]+" to "+tm[2]+" minutes":tm[1]+" minutes"});else if(/\b(wait|let it (rest|cool)|cools?)\b/i.test(s))pics.push({img:demoClock(),w:.8,cap:"wait"});
    sheets.push({n:i+2,text,adult,pics,photo:photos[i+2]||photos[String(i+2)]||""})});
  const overview={title:x.title,ings:qs.map(({line,q})=>({text:line,img:demoIcon(demoIconKind(q?q.item:line))})),tools:tools.map(t=>({text:t,img:demoIcon(demoIconKind(t))}))};
  return {overview,sheets,hand:demoHand()}}
// the set as a PDF, letter or poster, Andika throughout
async function demoPdf(x,size){if(!window.jspdf)await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf,"jspdf");await TREE_KIT.fonts();const P=demoPlan(x);const S=TREE_KIT.SIZES[size];const doc=TREE_KIT.pdf({size,orientation:"portrait"});const k=S.w/612,M=40*k;
  const font=b=>{try{doc.setFont(b?"pfB":"pfR","normal")}catch(e){doc.setFont("helvetica",b?"bold":"normal")}};
  // the overview, for setting up
  font(true);doc.setFontSize(34*k);doc.text(P.overview.title,M,M+30*k);doc.setFontSize(20*k);doc.text("What we need",M,M+70*k);
  let y=M+86*k;const row=(it)=>{doc.addImage(it.img,"PNG",M,y,44*k,44*k);font(false);doc.setFontSize(16*k);doc.text(doc.splitTextToSize(it.text,S.w-M*2-60*k),M+56*k,y+27*k);y+=50*k;if(y>S.h-M-50*k){doc.addPage([S.w,S.h]);y=M}};
  P.overview.ings.forEach(row);if(P.overview.tools.length){font(true);doc.setFontSize(20*k);doc.text("Tools",M,y+20*k);y+=34*k;P.overview.tools.forEach(row)}
  for(const sh of P.sheets){doc.addPage([S.w,S.h]);font(true);doc.setFillColor(47,59,47);doc.circle(M+28*k,M+28*k,28*k,"F");doc.setTextColor(255,255,255);doc.setFontSize(28*k);doc.text(String(sh.n),M+28*k,M+38*k,{align:"center"});doc.setTextColor(47,59,47);
    doc.setFontSize(44*k);const lines=doc.splitTextToSize(sh.text,S.w-M*2-(sh.adult?130*k:0));doc.text(lines,M,M+110*k);let top=M+110*k+lines.length*50*k;
    if(sh.adult){doc.addImage(P.hand,"PNG",S.w-M-90*k,M,90*k,90*k);font(false);doc.setFontSize(14*k);doc.text("An adult does this step",S.w-M,M+104*k,{align:"right"})}
    if(sh.photo&&window.FP_ORIGINAL_URL){try{const b=await (await fetch(window.FP_ORIGINAL_URL(sh.photo))).blob();const u=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});doc.addImage(u,"JPEG",M,top,S.w-M*2,(S.w-M*2)*.6);top+=(S.w-M*2)*.6+16*k}catch(e){}}
    let x0=M,lineH=0;for(const p of sh.pics){const w=150*k*p.w,h=w;if(x0+w>S.w-M){x0=M;top+=lineH+30*k;lineH=0}if(top+h>S.h-M)break;doc.addImage(p.img,"PNG",x0,top,w,h);if(p.cap){font(false);doc.setFontSize(15*k);doc.text(p.cap,x0+w/2,top+h+16*k,{align:"center"})}x0+=w+14*k;lineH=Math.max(lineH,h)}}
  return doc.output("blob")}
// the same set as a Word file, one page for each sheet
async function demoWord(x,size){const D=await TREE_KIT.word();await TREE_KIT.fonts();const P=demoPlan(x);const S=TREE_KIT.SIZES[size],k=S.w/612;
  const img=(data,w)=>new D.ImageRun({data:Uint8Array.from(atob(data.split(",")[1]),c=>c.charCodeAt(0)),type:"png",transformation:{width:Math.round(w),height:Math.round(w)}});
  const run=(t,pt,b)=>new D.TextRun({text:t,size:Math.round(pt*2*k),bold:!!b,font:"Andika"});
  const sections=[{children:[new D.Paragraph({children:[run(P.overview.title,30,true)]}),new D.Paragraph({children:[run("What we need",18,true)]}),
    ...P.overview.ings.map(it=>new D.Paragraph({children:[img(it.img,44*k),run("  "+it.text,15)]})),...(P.overview.tools.length?[new D.Paragraph({children:[run("Tools",18,true)]}),...P.overview.tools.map(it=>new D.Paragraph({children:[img(it.img,44*k),run("  "+it.text,15)]}))]:[])]}];
  for(const sh of P.sheets)sections.push({children:[new D.Paragraph({children:[run(String(sh.n),28,true),...(sh.adult?[run("     ",12),img(P.hand,70*k),run("  An adult does this step",13)]:[])]}),new D.Paragraph({spacing:{before:300,after:300},children:[run(sh.text,40,true)]}),
    new D.Paragraph({children:sh.pics.flatMap(p=>[img(p.img,120*k*p.w),run("  ",10)])}),...(sh.pics.some(p=>p.cap)?[new D.Paragraph({children:[run(sh.pics.map(p=>p.cap).filter(Boolean).join(",  "),14)]})]:[])]});
  const docx=TREE_KIT.wordFile(D,{size,sections,styles:{default:{document:{run:{font:"Andika"}}}},fonts:TREE_KIT.wordFonts()});return TREE_KIT.wordBlob(D,docx)}

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
/* the item's own name, with counts, amounts, units, who it is for and alternatives taken away, so "1 pound fava pods
   each child", "two soup pots" and "child knives and a knife adult" read as fava pod, soup pot and child knife */
const DEMO_NUM=/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|a few|several|half|a|an)\b/g;
const DEMO_UNIT=/\b(spoonfuls?|pounds?|lbs?|ounces?|oz|cups?|tablespoons?|teaspoons?|handfuls?|pinch(es)?|bunch(es)?|heads?|cloves?|stalks?|sprigs?|slices?|pieces?|cans?|bags?|boxes?|jars?|bottles?|packages?|sticks?|quarts?|pints?|gallons?|liters?|grams?|servings?|dash(es)?|drops?|leaves of|of)\b/g;
const DEMO_FIX={knive:"knife",knives:"knife",leaves:"leaf",loaves:"loaf",halves:"half",scissor:"scissors",tongs:"tongs",glasses:"glass",dishes:"dish",peaches:"peach",radishes:"radish",potatoes:"potato",tomatoes:"tomato"};
function demoClean(t){let x=String(t||"").toLowerCase().replace(/\(.*?\)/g," ").split(",")[0];
  x=x.replace(/\b(for |per )?(each|every) (child|children|person|pair|table|group|bowl|cup|plate)\b|\bper (child|person)\b|\bfor (the )?(children|adults?|table)\b|\bwith (a |its )?lid\b|\(adult\)|\badult\b/g," ").replace(/^\s*(and|or)\s+/,"");
  // "dry black or pinto beans" keeps black beans, and "water for rice" keeps water
  {const o=x.split(/\s+or\s+/);if(o.length>1&&o[1].trim().split(/\s+/).length===2&&/s$/.test(o[1].trim())&&!/s$/.test(o[0].trim()))x=o[0].trim()+" "+o[1].trim().split(/\s+/).slice(-1)[0];else x=o[0]}
  x=x.split(/\s+and an?\s+|\s*\/\s*|\s+(for|to|in|on)\s+/)[0].replace(/\s+each\s*$/,"");
  x=x.replace(/\bmeasuring (cups?|spoons?)\b/g,(m,u)=>"measuring_"+u.replace(/s$/,""));x=x.replace(/\bsqueeze bottles?\b/g,"squeeze_bottle");
  x=x.replace(/[0-9½¼¾⅓⅔.\/-]+/g," ").replace(DEMO_NUM," ").replace(DEMO_UNIT," ").replace(/[^a-z_\s]/g," ").replace(/\s+/g," ").trim().replace(/^(and|or)\s+/,"");
  return x}
const demoKey=t=>{const x0=demoClean(t);let x=x0.replace(/^(some|our|the)\s+/,"");
  x=x.replace(/\b(large|small|medium|fresh|dried|ripe|chopped|mashed|sliced|grated|softened|melted|warm|cold|boiling|ground|raw|cooked|about|plus|more|for|the|to|taste|extra|clean|whole)\b/g," ").replace(/\s+/g," ").trim();
  const w=x.split(" ");let last=w.pop()||"";if(DEMO_FIX[last])last=DEMO_FIX[last];else last=/(ss|us|scissors|tongs)$/.test(last)?last:last.replace(/(ches|shes|sses|xes)$/,m=>m.slice(0,-2)).replace(/ies$/,"y").replace(/oes$/,"o").replace(/s$/,"");
  if(DEMO_FIX[last])last=DEMO_FIX[last];return [...w,last].filter(Boolean).join("_")};
const demoKeyOld=t=>{let x=String(t||"").toLowerCase().replace(/\(.*?\)/g,"").split(",")[0].replace(/^(a|an|the|some|our)\s+/,"").replace(/[^a-z\s]/g," ").trim().replace(/\s+/g," ");
  x=x.replace(/\b(large|small|medium|fresh|dried|ripe|chopped|mashed|sliced|grated|softened|melted|warm|cold|boiling|ground|raw|cooked|about|plus|more|for|the|to|taste)\b/g," ").replace(/\s+/g," ").trim();
  const w=x.split(" ");const last=w.pop()||"";const sing=/(ss|us)$/.test(last)?last:last.replace(/(ches|shes|sses|xes)$/,m=>m.slice(0,-2)).replace(/ies$/,"y").replace(/oes$/,"o").replace(/s$/,"");return [...w,sing].filter(Boolean).join("_")};
const demoPicOf=(key,old)=>{const P=(libData&&libData.pictures)||{};if(P[key])return Object.assign({key},P[key]);if(old&&P[old])return Object.assign({key:old},P[old]);const parts=key.split("_");for(let i=1;i<parts.length;i++){const k=parts.slice(i).join("_");if(P[k]&&P[k].from==="photo"&&false)return Object.assign({key:k},P[k])}return null};
// the credits for the web pictures on a sheet, each once, printed small at its foot
const demoCredits=list=>{const c=[...new Set((list||[]).map(p=>p&&p.credit).filter(Boolean))];return c.length?"Pictures from Wikimedia Commons. "+c.join(". ")+".":""};
const demoPicCache=new Map();
// a picture as a data address for the PDF and the Word file, read once
async function demoPicData(pic){if(!pic)return null;const ck=pic.from+"|"+(pic.id||pic.path||pic.url);if(demoPicCache.has(ck))return demoPicCache.get(ck);let blob=null;
  try{if(pic.from==="web"&&/^https:\/\/upload\.wikimedia\.org\//.test(pic.url||""))blob=await (await fetch(pic.url)).blob();
    else if(pic.from==="photo"&&window.FP_ORIGINAL_URL)blob=await (await fetch(window.FP_ORIGINAL_URL(pic.id))).blob();
    else{const r=await fetch(window.FP_SERVER+"/api/staff/library/img",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(localStorage.getItem("fp-token")||"")},body:JSON.stringify({name:pic.key})});if(r.ok)blob=await r.blob()}}catch(e){blob=null}
  if(!blob||!blob.size){demoPicCache.set(ck,null);return null}
  // drawn onto white as a JPEG, so the PDF and Word file stay small and every picture sits on the same white
  const url=await new Promise(ok=>{const im=new Image();const u=URL.createObjectURL(blob);im.onload=()=>{const m=900,k=Math.min(1,m/Math.max(im.width,im.height));const c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);ok({data:c.toDataURL("image/jpeg",.86),w:c.width,h:c.height})};im.onerror=()=>{URL.revokeObjectURL(u);ok(null)};im.src=u});
  const out=url&&pic.from==="web"?Object.assign({},url,{credit:pic.credit||""}):url;demoPicCache.set(ck,out);return out}
// every item the recipes name, ingredients and tools, by key, for the Pictures still needed list
function demoItemsAll(){const out=new Map();for(const x of ((libData&&libData.recipes)||[]).filter(r=>!r.draft)){
    for(const l of libLines(recPart(x,"Ingredients"))){const q=demoQty(l);const k=demoKey(q?q.item:l);if(k&&!out.has(k))out.set(k,{key:k,old:demoKeyOld(q?q.item:l),name:k.replace(/_/g," "),kind:"ingredient",recipes:new Set()});if(k)out.get(k).recipes.add(x.title)}
    for(const l of libLines(recPart(x,"Tools"))){const k=demoKey(l);if(k&&!out.has(k))out.set(k,{key:k,old:demoKeyOld(l),name:k.replace(/_/g," "),kind:"tool",recipes:new Set()});if(k)out.get(k).recipes.add(x.title)}
    for(const l of libLines(recPart(x,"Ingredients"))){const q=demoQty(l);if(q&&q.unit){const k=q.unit==="cup"?"measuring_cup":q.unit;if(!out.has(k))out.set(k,{key:k,name:q.unit==="cup"?"measuring cup":q.unit,kind:"measure",recipes:new Set()});out.get(k).recipes.add(x.title)}}}
  // the three pictures every demonstration set uses, washing hands, the timer and the adult hand
  for(const [k,name] of [["washing_hands","washing hands"],["kitchen_timer","kitchen timer"],["adult_hand","adult hand"]])if(!out.has(k))out.set(k,{key:k,name,kind:"every demonstration set",recipes:new Set(((libData&&libData.recipes)||[]).filter(r=>!r.draft).map(r=>r.title))});
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
// what an action needs, read from the recipe's own tools, so cooking shows the pot and the hot plate (November 5, 2026)
const DEMO_COOK=/\b(cooks?|simmers?|boils?|heats(?! off)|heat the|melts?|warms\b|brings? .* to a boil|sautes?)\b/i,DEMO_BAKE=/\b(bakes?|roasts?|toasts)\b/i;
const DEMO_ACTS=[[DEMO_COOK,/(soup_pot|^pot$|_pot$|pan$|griddle|kettle)/],[DEMO_COOK,/(hot_plate|stove)/],[DEMO_BAKE,/(oven|toaster)/],[DEMO_BAKE,/(baking_sheet|baking_dish|loaf_pan|muffin_tin)/],
  [/\bscrub/i,/scrubber/],[/\b(cuts?|chops?|trims?|cores?)\b|\bhalves (the|each)\b|^(an adult )?slices?\b/i,/cutting_board/],[/\b(cuts?|chops?|trims?|cores?)\b|\bhalves (the|each)\b|^(an adult )?slices?\b/i,/child_knife/],[/\bblend/i,/(blender|food_processor)/],[/\bwhisk/i,/whisk/],[/\bmash/i,/(masher|fork)/],
  [/\b(stirs?|spoon)\b/i,/(large_spoon|^spoon$|wooden_spoon)/],[/\bgrat(e|es|ing)\b/i,/grater/],[/^(press|squeeze|juice)\b.*\b(lemons?|limes?|oranges?|citrus)\b/i,/(juicer|squeezer)/],[/\bpeel/i,/peeler/],[/\b(dehydrator|dries|dry)\b/i,/dehydrator/],[/\bsnip/i,/scissors/],[/\bstrain/i,/(strainer|colander|cheesecloth)/],[/^paint\b/i,/brush/],[/^gather\b/i,/basket/]];
async function demoPlan(x){if(!libData)await loadLibrary();const ings=libLines(recPart(x,"Ingredients")),tools=libLines(recPart(x,"Tools"));let steps=libLines(recPart(x,"Steps"));
  // the washing sheet is always first, so a recipe's own first step about washing is not shown twice
  if(steps.length&&/^wash our hands\b/i.test(steps[0]))steps=steps.slice(1);
  const qs=ings.map(l=>({line:l,q:demoQty(l)}));const photos={};String((x.meta||{}).photos||"").split(/[;,]\s*/).forEach(p=>{const m=p.match(/^(\d+)=(.+)$/);if(m)photos[+m[1]]=m[2].trim()});
  // washing hands, the timer and the adult hand show our own pictures once the library has them, and a drawing until then
  const wash=await demoPicData(demoPicOf("washing_hands")),timer=await demoPicData(demoPicOf("kitchen_timer")),hand=await demoPicData(demoPicOf("adult_hand"));
  const clockImg=()=>timer?timer.data:demoClock();
  const sheets=[{n:1,text:"Wash our hands.",pics:[{img:wash?wash.data:demoWash(),w:1.2,drawn:!wash}],words:[],adult:false}];
  const measured=new Set();
  // an item's head word, such as apple for 6 apples, cream for cream of tartar or color for color from our dye bed, found
  // in a step in its singular or plural (November 5, 2026)
  const DEMO_GENERIC=/^(small|large|handful|pinch|piece|bunch|cup|spoon|bowl|some|our|the|and)$/;
  const headOf=k=>{const w=String(k||"").split("_").filter(Boolean);const i=w.findIndex(x=>/^(of|from|with|for)$/.test(x));const h=(i>0?w.slice(0,i):w).filter(x=>!DEMO_GENERIC.test(x));return h.length?h[h.length-1]:""};
  const says=(s,word)=>{if(!word||word.length<3)return false;const st=word.replace(/(ies)$/,"y").replace(/(oes|ses|xes|ches|shes)$/,m=>m.slice(0,-2)).replace(/s$/,"");const root=st.replace(/y$/,"");const fv=/(fe|f)$/.test(st)?"|"+st.replace(/(fe|f)$/,"")+"ves":"";return new RegExp("\\b("+(st.endsWith("y")?root+"(y|ies)":st+"(e|es|s)?")+fv+")\\b","i").test(s)};
  for(let i=0;i<steps.length;i++){const s=steps[i];const adult=/^an adult\b/i.test(s);const pics=[],words=[];
    // water for washing, such as a basin for scrubbing, is never the water the recipe measures
    const washing=/\b(scrub|wash|rinse|basin)\b/i.test(s);
    /* each item the step names. When two lines share a name, such as water and warm water, the one whose own words the step
       says is shown, or else the one not yet used, so each amount lands on the step that uses it */
    const cand=qs.filter(({q,line})=>{const key=demoKey(q?q.item:line);return says(s,headOf(key))&&!(washing&&headOf(key)==="water")});
    const byHead=new Map();for(const c of cand){const h=headOf(demoKey(c.q?c.q.item:c.line));if(!byHead.has(h))byHead.set(h,[]);byHead.get(h).push(c)}
    const chosen=[];for(const [h,cs] of byHead){if(cs.length===1){chosen.push(cs[0]);continue}
      const own=cs.filter(c=>demoKey(c.q?c.q.item:c.line).split("_").filter(w=>w!==h&&w.length>2&&!DEMO_GENERIC.test(w)).every(w=>says(s,w))&&demoKey(c.q?c.q.item:c.line).split("_").length>1);
      chosen.push(own[0]||cs.find(c=>!measured.has(c.line))||cs[0])}
    for(const {q,line} of qs.filter(c=>chosen.includes(c))){const key=demoKey(q?q.item:line);
      const name=(q?q.item:line).split(",")[0].toLowerCase().replace(/^(a|an|the)\s+/,"");let label=name.replace(/\s*\(.*\)$/,"");
      const first=!measured.has(line);measured.add(line);
      // the amount once, the first time the item is used, with the right cup or spoon shown once beside it
      const amount=first&&q&&q.n?demoFracText(q.n)+(q.unit?" "+q.unit+(q.n>1?"s":""):""):"";
      // after its first use an item reads by its name alone, such as radishes for 1 1/2 pounds radishes
      if(!amount)label=label.replace(/^(or\s+\d+\s+)/,"").replace(/^((pounds?|ounces?|cloves?|stalks?|bunch(es)?|handfuls?|pinch(es)?|slices?|ears?|heads?|cans?|sticks?|pieces?|quarts?)\s+(of\s+)?)+/,"").replace(/\s+for (each|every|the) .*$|\s+for serving$/,"");
      let measure=null;if(first&&q&&q.unit){const mp=await demoPicData(demoPicOf(q.unit==="cup"?"measuring_cup":q.unit));if(mp)measure={img:mp.data,text:amount}}
      const pd=await demoPicData(demoPicOf(key,demoKeyOld(q?q.item:line)));const cap=[amount,label].filter(Boolean).join(" ");
      if(pd)pics.push({img:pd.data,w:.85,cap,label,amount,big:true,credit:pd.credit||"",measure});else words.push({big:cap,small:"",measure})}
    /* the tools the step names, and the tool its action needs from this recipe's own list, such as the soup pot and the hot
       plate for cooking, the scrubber for scrubbing or the large spoon for spooning (November 5, 2026). Measuring cups and
       spoons show with their amounts, so they are left out here. */
    // the tools the step names come first, then the tools its actions need, one of each kind. Heating the oven needs no pot.
    const ovenStep=/\boven\b/i.test(s),sNoHot=s.replace(/\bhot plates?\b/gi," ");
    const tinfo=tools.map(t=>{const tk=demoKey(t)||String(t).toLowerCase().split(",")[0].replace(/[^a-z\s]/g," ").trim().split(/\s+/).pop().replace(/s$/,"");
      const tw=tk.split("_");const ti=tw.findIndex(x=>/^(of|from|with|for)$/.test(x));const th=(ti>0?tw.slice(0,ti):tw).filter(x=>!/^(small|large|some|our|the|and)$/.test(x)).pop()||"";
      // a tool for the adult only on an adult's step
      const skip=!tk||/^measuring_/.test(tk)||(/\badult\b/i.test(t)&&!/\bchild/i.test(t)&&!adult);
      const second=/^(second|other)_/.test(tk);const last=tw[tw.length-1];
      const named=!skip&&!(second&&!/\b(second|other)\b/i.test(s))&&(/hot_plate/.test(tk)?/\bhot plate\b/i.test(s):(says(th==="plate"?sNoHot:s,th)||(tw.includes("with")&&!/^(lid|cover)$/.test(last)&&says(s,last))||(th==="knife"&&/\bknives\b/i.test(s))));
      return {t,tk,skip,second,named}});
    // the second pot, when the step names it, stands alone, never beside the first
    for(const x of tinfo)if(x.second&&x.named)for(const y of tinfo)if(y!==x&&!y.second&&y.named&&y.tk.split("_").pop()===x.tk.split("_").filter(w=>!/^(for|the|noodle|rice)$/.test(w)).slice(1).pop())y.named=false;
    const toolPics=[],fam=re=>tinfo.some(x=>x.named&&re.test(x.tk));
    for(const x of tinfo){if(x.skip)continue;let actRe=null;
      if(!x.named){if(x.second)continue;const hit=DEMO_ACTS.find(([verb,re])=>verb.test(s)&&re.test(x.tk)&&!(ovenStep&&verb===DEMO_COOK)&&!(/child_knife/.test(x.tk)&&adult)&&!fam(re)&&!toolPics.some(y=>y.act===re.source));if(!hit)continue;actRe=hit[1]}
      if(toolPics.some(y=>y.key===x.tk))continue;const pd=await demoPicData(demoPicOf(x.tk,demoKeyOld(x.t)));const lb=x.t.replace(/^(a|an|the|two|three)\s+/i,"").split(",")[0];
      if(pd)toolPics.push({key:x.tk,act:actRe?actRe.source:"",img:pd.data,w:.85,cap:lb,label:lb,big:true,credit:pd.credit||"",tool:true});else words.push({big:lb,small:""})}
    pics.push(...toolPics.slice(0,Math.max(1,5-pics.length)).map(({key,act,...r})=>r));
    // a cooking or waiting time shows the timer, for minutes, hours, overnight or a wait, and never for cool water
    const DN="(\\d+(?:\\s+\\d\\/\\d)?|\\d\\/\\d)";const tm=s.match(new RegExp(DN+"(?:\\s*(?:to|or)\\s*"+DN+")?\\s*(minutes?|hours?)","i"));
    if(tm)pics.push({img:clockImg(),w:.7,cap:tm[1]+(tm[2]?" to "+tm[2]:"")+" "+tm[3].toLowerCase().replace(/s?$/,(+(tm[2]||tm[1])===1?"":"s")),timer:true,drawn:!timer});
    else if(/\b(wait|overnight|let (it|them) (rest|cool|sit|rise)|until (it is |they are )?cool)\b/i.test(s))pics.push({img:clockImg(),w:.7,cap:/overnight/i.test(s)?"overnight":"wait",timer:true,drawn:!timer});
    sheets.push({n:i+2,text:s,adult,pics,words,photo:photos[i+2]||photos[String(i+2)]||""})}
  const item=async t=>{const q=demoQty(t);const pd=await demoPicData(demoPicOf(demoKey(q?q.item:t),demoKeyOld(q?q.item:t)));return {text:t,img:pd?pd.data:null,credit:(pd&&pd.credit)||""}};
  const fin=await demoPicData(demoPicOf("finished_"+String(x.id||"").replace(/-/g,"_")));
  const overview={title:x.title,finished:fin?fin.data:null,ings:await Promise.all(qs.map(({line})=>item(line))),tools:await Promise.all(tools.map(item))};
  return {overview,sheets,hand:hand?hand.data:demoHand()}}
// the set as a PDF, letter or poster, Andika throughout
const demoFmt=d=>/^data:image\/png/.test(d)?"PNG":"JPEG";
/* the poster is one sheet for the wall, 18 by 24 inches. The recipe's name and what we need across the top, then every
   step in order in numbered panels, each with its words, its picture or its amounts, so children follow the whole recipe
   at a glance. The letter set keeps one step to a sheet for the table. */
async function demoPosterPdf(x){if(!window.jspdf)await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf,"jspdf");await TREE_KIT.fonts();const P=await demoPlan(x);const S=TREE_KIT.SIZES.poster;const doc=TREE_KIT.pdf({size:"poster",orientation:"portrait"});
  const font=b=>{try{doc.setFont(b?"pfB":"pfR","normal")}catch(e){doc.setFont("helvetica",b?"bold":"normal")}};const M=54,W=S.w-M*2;
  // the title, with the finished picture beside it, so children see what we are making
  const fin=P.overview.finished,fw=fin?190:0;font(true);doc.setTextColor(47,59,47);doc.setFontSize(72);const tl=doc.splitTextToSize(P.overview.title,W-fw-24).slice(0,2);doc.text(tl,M,M+64);
  if(fin)doc.addImage(fin,demoFmt(fin),M+W-fw,M,fw,fw);
  // what we need, in one band of pictures with their names
  let y=Math.max(M+64+tl.length*76,M+40)+20;font(true);doc.setFontSize(30);doc.text("What we need",M,y);y+=16;
  const need=[...P.overview.ings,...P.overview.tools];const per=Math.max(8,Math.ceil(need.length/2));const cell=W/per;let nx=M;
  for(const it of need){if(nx+cell>M+W+1){nx=M;y+=cell+40}if(it.img)doc.addImage(it.img,demoFmt(it.img),nx+8,y+6,cell-16,cell-16);font(false);const fz=Math.max(11,Math.min(16,cell/8));doc.setFontSize(fz);doc.text(doc.splitTextToSize(it.text,cell-6).slice(0,it.img?2:5),nx+4,y+(it.img?cell+fz:24));nx+=cell}
  y+=cell+56;doc.setDrawColor(200,190,170);doc.setLineWidth(2);doc.line(M,y-22,M+W,y-22);
  // the steps in numbered panels, two, three or four across by how many steps there are
  const st=P.sheets;const cols=st.length<=4?2:st.length<=9?3:4;const rows=Math.ceil(st.length/cols);const gap=22;const pw=(W-gap*(cols-1))/cols,ph=Math.min(560,(S.h-M-y-gap*(rows-1))/rows);
  st.forEach((sh,i)=>{const cx=M+(i%cols)*(pw+gap),cy=y+Math.floor(i/cols)*(ph+gap);// each step on white, so its pictures sit on the same white, with a border to mark the square
    doc.setFillColor(255,255,255);doc.setDrawColor(200,190,170);doc.setLineWidth(3);doc.roundedRect(cx,cy,pw,ph,18,18,"FD");
    doc.setFillColor(47,59,47);doc.circle(cx+36,cy+36,24,"F");font(true);doc.setTextColor(255,255,255);doc.setFontSize(28);doc.text(String(sh.n),cx+36,cy+46,{align:"center"});doc.setTextColor(47,59,47);
    if(sh.adult)doc.addImage(P.hand,demoFmt(P.hand),cx+pw-66,cy+10,52,52);
    const fs=ph>380?(cols>3?24:28):22;doc.setFontSize(fs);const tlines=doc.splitTextToSize(sh.text,pw-36).slice(0,4);doc.text(tlines,cx+18,cy+84);let ty=cy+84+tlines.length*fs*1.15+6;
    // one picture for each item, with its amount and name once beneath it, never crowding into the next
    // three pictures at most in a narrow panel, four in a wide one, the timer always kept
    const maxN=cols>=4?3:4,tms=sh.pics.filter(p=>p.timer),rest=sh.pics.filter(p=>!p.timer);const pics=[...rest.slice(0,Math.max(0,maxN-tms.length)),...tms].slice(0,maxN);const n=pics.length;
    if(n){const capF=Math.max(12,Math.min(18,(pw-36)/n/7));font(true);doc.setFontSize(capF);const caps=pics.map(pc=>pc.cap?doc.splitTextToSize(pc.cap,(pw-36-(n-1)*10)/n).slice(0,3):[]);const capH=Math.max(0,...caps.map(c=>c.length))*capF*1.15+6;
      const room=cy+ph-ty-14-capH;const w=Math.max(0,Math.min(room,(pw-36-(n-1)*10)/n));let px=cx+18+(pw-36-(n*w+(n-1)*10))/2;
      pics.forEach((pc,j)=>{if(w>24)doc.addImage(pc.img,demoFmt(pc.img),px,ty,w,w);if(caps[j].length){font(!!pc.big);doc.setFontSize(capF);doc.text(caps[j],px+w/2,ty+w+capF,{align:"center"})}px+=w+10})}
    else if(sh.words.length){font(true);doc.setFontSize(Math.min(26,fs));for(const wd of sh.words.slice(0,4)){doc.text(doc.splitTextToSize(wd.big,pw-36)[0],cx+18,ty+24);ty+=32}}});
  {const c=demoCredits(P.sheets.flatMap(s=>s.pics));if(c){font(false);doc.setFontSize(12);doc.setTextColor(90,100,90);doc.text(doc.splitTextToSize(c,W),M,S.h-M/2)}}
  return doc.output("blob")}
async function demoPosterWord(x){const D=await TREE_KIT.word();await TREE_KIT.fonts();const P=await demoPlan(x);
  const img=(data,w)=>new D.ImageRun({data:Uint8Array.from(atob(data.split(",")[1]),c=>c.charCodeAt(0)),type:/^data:image\/png/.test(data)?"png":"jpg",transformation:{width:Math.round(w),height:Math.round(w)}});
  const run=(t,pt,b)=>new D.TextRun({text:t,size:Math.round(pt*2),bold:!!b,font:"Andika"});const cols=P.sheets.length<=4?2:3;const tw=25920-2880;
  const cellOf=sh=>new D.TableCell({width:{size:Math.floor(tw/cols),type:D.WidthType.DXA},margins:{top:160,bottom:160,left:160,right:160},children:[new D.Paragraph({children:[run(String(sh.n)+"  ",40,true),...(sh.adult?[img(P.hand,50)]:[])]}),new D.Paragraph({spacing:{after:120},children:[run(sh.text,28,true)]}),
    ...(sh.pics.length?[new D.Paragraph({children:sh.pics.slice(0,4).flatMap(pc=>[img(pc.img,cols===2?150:110),run(" ",10)])}),new D.Paragraph({children:[run(sh.pics.map(pc=>pc.cap).filter(Boolean).join(",  "),18,true)]})]:sh.words.map(w=>new D.Paragraph({children:[run(w.big,24,true)]})))]});
  const rows=[];for(let i=0;i<P.sheets.length;i+=cols){const cs=P.sheets.slice(i,i+cols).map(cellOf);while(cs.length<cols)cs.push(new D.TableCell({width:{size:Math.floor(tw/cols),type:D.WidthType.DXA},children:[new D.Paragraph("")]}));rows.push(new D.TableRow({cantSplit:true,children:cs}))}
  const need=[...P.overview.ings,...P.overview.tools];
  const sections=[{children:[new D.Paragraph({children:[run(P.overview.title,60,true)]}),new D.Paragraph({children:[run("What we need",26,true)]}),new D.Paragraph({children:need.map(it=>run(it.text+"     ",18))}),
    new D.Table({width:{size:tw,type:D.WidthType.DXA},columnWidths:Array(cols).fill(Math.floor(tw/cols)),rows}),...(demoCredits(P.sheets.flatMap(s=>s.pics))?[new D.Paragraph({spacing:{before:240},children:[run(demoCredits(P.sheets.flatMap(s=>s.pics)),12)]})]:[])]}];
  const docx=TREE_KIT.wordFile(D,{size:"poster",sections,styles:{default:{document:{run:{font:"Andika"}}}},fonts:TREE_KIT.wordFonts()});return TREE_KIT.wordBlob(D,docx)}
async function demoPdf(x,size){if(size==="poster")return demoPosterPdf(x);if(!window.jspdf)await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf,"jspdf");await TREE_KIT.fonts();const P=await demoPlan(x);const S=TREE_KIT.SIZES[size];const doc=TREE_KIT.pdf({size,orientation:"portrait"});const k=S.w/612,M=40*k,W=S.w-M*2;
  const font=b=>{try{doc.setFont(b?"pfB":"pfR","normal")}catch(e){doc.setFont("helvetica",b?"bold":"normal")}};
  const credit=list=>{const c=demoCredits(list);if(!c)return;font(false);doc.setFontSize(8*k);doc.setTextColor(90,100,90);doc.text(doc.splitTextToSize(c,W),M,S.h-M/2-8*k);doc.setTextColor(47,59,47)};
  // the setup page, on one page. The title and the finished picture, then what we need in two columns, ingredients and tools
  {doc.setTextColor(47,59,47);const fin=P.overview.finished,fw=fin?150*k:0;font(true);doc.setFontSize(34*k);const tl=doc.splitTextToSize(P.overview.title,W-fw-16*k);doc.text(tl,M,M+30*k);
    if(fin)doc.addImage(fin,demoFmt(fin),S.w-M-fw,M,fw,fw);
    const top=Math.max(M+30*k+tl.length*38*k,M+fw)+24*k;const colW=(W-20*k)/2;const avail=S.h-M-24*k-top-34*k;
    const n=Math.max(P.overview.ings.length,P.overview.tools.length,1);const rh=Math.min(62*k,avail/n);const ps=rh-8*k;
    const col=(title,list,x0)=>{font(true);doc.setFontSize(20*k);doc.text(title,x0,top);let y=top+14*k;
      for(const it of list){if(it.img)doc.addImage(it.img,demoFmt(it.img),x0,y,ps,ps);font(false);const fz=Math.min(16*k,Math.max(10*k,rh*.3));doc.setFontSize(fz);doc.text(doc.splitTextToSize(it.text,colW-ps-12*k).slice(0,2),x0+(it.img?ps+10*k:0),y+ps/2+fz*.35);y+=rh}};
    col("What we need",P.overview.ings,M);if(P.overview.tools.length)col("Tools",P.overview.tools,M+colW+20*k);
    credit([...P.overview.ings,...P.overview.tools])}
  for(const sh of P.sheets){doc.addPage([S.w,S.h]);doc.setTextColor(47,59,47);
    // the band across the top, the step's number, and the adult hand with its words when only an adult does the step
    font(true);doc.setFillColor(47,59,47);doc.circle(M+28*k,M+28*k,28*k,"F");doc.setTextColor(255,255,255);doc.setFontSize(28*k);doc.text(String(sh.n),M+28*k,M+38*k,{align:"center"});doc.setTextColor(47,59,47);
    if(sh.adult){doc.addImage(P.hand,demoFmt(P.hand),S.w-M-64*k,M-4*k,64*k,64*k);font(false);doc.setFontSize(13*k);doc.text("An adult does this step",S.w-M-72*k,M+34*k,{align:"right"})}
    font(true);doc.setFontSize(40*k);const lines=doc.splitTextToSize(sh.text,W);doc.text(lines,M,M+104*k);let top=M+104*k+(lines.length-1)*46*k+28*k;
    if(sh.photo&&window.FP_ORIGINAL_URL){try{const b=await (await fetch(window.FP_ORIGINAL_URL(sh.photo))).blob();const u=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});const ph=Math.min((S.h-M-top)*.5,W*.6);doc.addImage(u,"JPEG",M,top,ph/.6,ph);top+=ph+16*k}catch(e){}}
    // one row for each item, its picture large, its amount and name in big type, and the cup or spoon once beside them
    const rows=[...sh.pics.filter(p=>!p.timer),...sh.words.map(w=>Object.assign({word:true},w)),...sh.pics.filter(p=>p.timer)];
    const avail=S.h-M-14*k-top;
    // one item fills the sheet, its picture large, with its amount and the cup or spoon beneath it
    if(rows.length===1&&!rows[0].word){const r=rows[0];const s=Math.min(avail-60*k,W*.7);doc.addImage(r.img,demoFmt(r.img),M+(W-s)/2,top,s,s);
      if(r.cap){font(true);doc.setFontSize(32*k);const c=doc.splitTextToSize(r.cap,W-(r.measure?90*k:0))[0];const cw=doc.getTextWidth(c)+(r.measure?82*k:0);const cx=S.w/2-cw/2;doc.text(c,cx,top+s+38*k);if(r.measure)doc.addImage(r.measure.img,demoFmt(r.measure.img),cx+cw-70*k,top+s+2*k,70*k,70*k)}}
    else if(rows.length){const rh=Math.min(rows.length<=2?290*k:200*k,avail/rows.length);const s=rh-14*k;
      for(const r of rows){const tx=M+(r.word?0:s+22*k);
        if(!r.word)doc.addImage(r.img,demoFmt(r.img),M,top,s,s);
        const fz=Math.min(34*k,Math.max(16*k,rh*.2));font(true);doc.setFontSize(fz);const tw=W-(tx-M)-(r.measure?Math.min(s*.6,110*k)+12*k:0);
        const t=r.word?r.big:(r.timer?r.cap:(r.amount?r.amount+" ":"")+(r.label||r.cap||""));const tlines=doc.splitTextToSize(t,tw).slice(0,3);doc.text(tlines,tx,top+s/2-((tlines.length-1)*fz*1.15)/2+fz*.35);
        if(r.measure){const ms=Math.min(s*.6,110*k);doc.addImage(r.measure.img,demoFmt(r.measure.img),S.w-M-ms,top+(s-ms)/2,ms,ms)}
        top+=rh}}
    credit(sh.pics)}
  return doc.output("blob")}
// the same set as a Word file, one page for each sheet
async function demoWord(x,size){if(size==="poster")return demoPosterWord(x);const D=await TREE_KIT.word();await TREE_KIT.fonts();const P=await demoPlan(x);const S=TREE_KIT.SIZES[size],k=S.w/612;
  const img=(data,w)=>new D.ImageRun({data:Uint8Array.from(atob(data.split(",")[1]),c=>c.charCodeAt(0)),type:/^data:image\/png/.test(data)?"png":"jpg",transformation:{width:Math.round(w),height:Math.round(w)}});
  const run=(t,pt,b)=>new D.TextRun({text:t,size:Math.round(pt*2*k),bold:!!b,font:"Andika"});
  const sections=[{children:[new D.Paragraph({children:[run(P.overview.title,30,true)]}),new D.Paragraph({children:[run("What we need",18,true)]}),
    ...P.overview.ings.map(it=>new D.Paragraph({children:[...(it.img?[img(it.img,44*k)]:[]),run("  "+it.text,15)]})),...(P.overview.tools.length?[new D.Paragraph({children:[run("Tools",18,true)]}),...P.overview.tools.map(it=>new D.Paragraph({children:[...(it.img?[img(it.img,44*k)]:[]),run("  "+it.text,15)]}))]:[])]}];
  for(const sh of P.sheets)sections.push({children:[new D.Paragraph({children:[run(String(sh.n),28,true),...(sh.adult?[run("     ",12),img(P.hand,70*k),run("  An adult does this step",13)]:[])]}),new D.Paragraph({spacing:{before:300,after:300},children:[run(sh.text,40,true)]}),
    ...sh.words.map(w=>new D.Paragraph({children:[run(w.big,32,true)]})),
    new D.Paragraph({children:sh.pics.flatMap(p=>[img(p.img,120*k*p.w),run("  ",10)])}),...(sh.pics.some(p=>p.cap)?[new D.Paragraph({children:[run(sh.pics.map(p=>p.cap).filter(Boolean).join(",  "),20,true)]})]:[]),...(demoCredits(sh.pics)?[new D.Paragraph({spacing:{before:240},children:[run(demoCredits(sh.pics),7)]})]:[])]});
  const docx=TREE_KIT.wordFile(D,{size,sections,styles:{default:{document:{run:{font:"Andika"}}}},fonts:TREE_KIT.wordFonts()});return TREE_KIT.wordBlob(D,docx)}

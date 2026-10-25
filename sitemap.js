/* The site map, the same map and the same space names everywhere TREE shows it: signing up for a space, the Space on a
   plan, the New Educator section, the Family page, the Garden and a Presenting handout. The map photo and where each
   space sits come from the signed-in server, never from this public file. The site is 3.5 acres, so the map zooms,
   by pinching, by the + and - buttons or by a double tap, and drags, and the space names keep their size at every zoom
   so they stay readable on a phone. Each space is a button on the map and in the list under it. */
(function(){
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let css=false;
  function style(){ if(css) return; css=true; const s=document.createElement("style"); s.textContent=
    ".smap{position:relative;overflow:hidden;border-radius:12px;border:1px solid #d6ded4;background:#eef2ea;touch-action:none;user-select:none;-webkit-user-select:none;height:min(70vh,520px)}"+
    ".smap-in{position:absolute;left:0;top:0;transform-origin:0 0}.smap-in img{display:block;width:100%;height:auto;pointer-events:none}"+
    ".smap-spot{position:absolute;transform-origin:0 0;white-space:nowrap;font:600 13px/1.2 system-ui,sans-serif;color:#1f3a2c;background:rgba(255,255,255,.92);border:1.5px solid #2f5a43;border-radius:999px;padding:4px 9px;cursor:pointer;min-height:28px}"+
    ".smap-spot[aria-pressed=true]{background:#2f5a43;color:#fff}"+
    ".smap-zoom{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:6px;z-index:2}.smap-zoom button{width:40px;height:40px;border-radius:10px;border:1px solid #c8d2ca;background:#fff;font:600 20px/1 system-ui,sans-serif;color:#1f3a2c;cursor:pointer}"+
    ".smap-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.smap-list button{font:500 14px/1.2 system-ui,sans-serif;border:1px solid #c8d2ca;background:#fff;border-radius:999px;padding:7px 12px;min-height:36px;cursor:pointer;color:#1f3a2c}.smap-list button[aria-pressed=true]{background:#2f5a43;color:#fff;border-color:#2f5a43}";
    document.head.appendChild(s); }
  // draws the map into el. d is {src, spots:[{id,name,x,y}]}, opts {selected, onPick, list}
  function mount(el,d,opts){
    opts=opts||{}; style(); if(!el) return null;
    const spots=(d&&d.spots||[]).filter(s=>s&&s.name);
    if(!d||!d.src){ el.innerHTML=""; return null; }
    el.innerHTML=`<div class="smap" role="group" aria-label="Site map"><div class="smap-zoom"><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-z="-1" aria-label="Zoom out">−</button></div><div class="smap-in"><img alt="Our site map, from above" src="${esc(d.src)}">${spots.filter(s=>s.x!=null).map((s,i)=>`<button type="button" class="smap-spot" data-spot="${esc(s.id)}" aria-pressed="${s.id===opts.selected}" style="left:${s.x*100}%;top:${s.y*100}%">${esc(s.name)}</button>`).join("")}</div></div>`+
      (opts.list===false?"":`<div class="smap-list">${spots.map(s=>`<button type="button" data-spot="${esc(s.id)}" aria-pressed="${s.id===opts.selected}">${esc(s.name)}</button>`).join("")}</div>`);
    const box=el.querySelector(".smap"), inner=el.querySelector(".smap-in"), img=inner.querySelector("img");
    let z=1,tx=0,ty=0,base=1;
    const fit=()=>{ const w=box.clientWidth; inner.style.width=w+"px"; base=1; apply(); };
    const clamp=()=>{ const w=box.clientWidth,h=box.clientHeight,iw=inner.offsetWidth*z,ih=inner.offsetHeight*z; tx=Math.min(0,Math.max(w-iw,tx)); ty=ih<h?(h-ih)/2:Math.min(0,Math.max(h-ih,ty)); };
    function apply(){ clamp(); inner.style.transform=`translate(${tx}px,${ty}px) scale(${z})`; for(const b of inner.querySelectorAll(".smap-spot")) b.style.transform=`scale(${1/z}) translate(-50%,-50%)`; }
    const zoomAt=(nz,cx,cy)=>{ nz=Math.max(1,Math.min(6,nz)); tx=cx-(cx-tx)*nz/z; ty=cy-(cy-ty)*nz/z; z=nz; apply(); };
    img.addEventListener("load",fit); window.addEventListener("resize",fit); if(img.complete) fit();
    box.querySelector(".smap-zoom").addEventListener("click",e=>{ const b=e.target.closest("[data-z]"); if(!b) return; e.stopPropagation(); zoomAt(z*(b.dataset.z==="1"?1.6:1/1.6),box.clientWidth/2,box.clientHeight/2); });
    // drag and pinch
    const pts=new Map(); let last=null, moved=false, tapAt=0;
    box.addEventListener("pointerdown",e=>{ if(e.target.closest(".smap-zoom")) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=false; last=null; });
    box.addEventListener("pointermove",e=>{ if(!pts.has(e.pointerId)) return; const p=pts.get(e.pointerId); const r=box.getBoundingClientRect();
      if(pts.size===1){ const dx=e.clientX-p.x, dy=e.clientY-p.y; if(Math.abs(dx)+Math.abs(dy)>3) moved=true; tx+=dx; ty+=dy; apply(); }
      else if(pts.size===2){ const [a,b]=[...pts.values()]; const d0=Math.hypot(a.x-b.x,a.y-b.y); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); const [c,f]=[...pts.values()]; const d1=Math.hypot(c.x-f.x,c.y-f.y); if(d0>0){ moved=true; zoomAt(z*d1/d0,(c.x+f.x)/2-r.left,(c.y+f.y)/2-r.top); } return; }
      pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
    const up=e=>{ pts.delete(e.pointerId); };
    box.addEventListener("pointerup",up); box.addEventListener("pointercancel",up); box.addEventListener("pointerleave",up);
    box.addEventListener("wheel",e=>{ e.preventDefault(); const r=box.getBoundingClientRect(); zoomAt(z*(e.deltaY<0?1.2:1/1.2),e.clientX-r.left,e.clientY-r.top); },{passive:false});
    box.addEventListener("dblclick",e=>{ const r=box.getBoundingClientRect(); zoomAt(z*1.8,e.clientX-r.left,e.clientY-r.top); });
    el.addEventListener("click",e=>{ const b=e.target.closest("[data-spot]"); if(!b||(moved&&b.classList.contains("smap-spot"))) return; e.preventDefault();
      for(const x of el.querySelectorAll("[data-spot]")) x.setAttribute("aria-pressed",String(x.dataset.spot===b.dataset.spot));
      if(opts.onPick) opts.onPick(b.dataset.spot); });
    return { zoomAt, fit };
  }
  // the map as one picture with each space numbered, for a print, from the map photo's own file
  async function picture(blob,spots){
    const bmp=await createImageBitmap(blob); const sc=Math.min(1,1800/Math.max(bmp.width,bmp.height));
    const c=document.createElement("canvas"); c.width=Math.round(bmp.width*sc); c.height=Math.round(bmp.height*sc); const g=c.getContext("2d");
    g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(bmp,0,0,c.width,c.height);
    const placed=(spots||[]).filter(s=>s&&s.x!=null&&s.name); const r=Math.max(14,Math.round(c.width/60));
    placed.forEach((s,i)=>{ const x=s.x*c.width,y=s.y*c.height; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fillStyle="#2f5a43"; g.fill(); g.lineWidth=3; g.strokeStyle="#fff"; g.stroke();
      g.fillStyle="#fff"; g.font=`600 ${Math.round(r*1.1)}px system-ui,sans-serif`; g.textAlign="center"; g.textBaseline="middle"; g.fillText(String(i+1),x,y+1); });
    const jb=await new Promise(res=>c.toBlob(res,"image/jpeg",.88));
    return { url:c.toDataURL("image/jpeg",.88), bytes:await jb.arrayBuffer(), w:c.width, h:c.height, names:placed.map((s,i)=>`${i+1}. ${s.name}`) };
  }
  window.SiteMap={ mount, picture };
})();

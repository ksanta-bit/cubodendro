<script>
"use strict";
/* ============================================================
   PARTE G — FOTOCAMERA
   1) mirino per l'ipsometro
   2) misura degli anelli su fotografia, con taratura sul righello
   ============================================================ */

/* ---------------- 1 · mirino ---------------- */
let camStream = null;
async function camAccendi(){
  const err=$('camErr'); err.hidden=true;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !secureOk()){
    err.hidden=false;
    err.innerHTML='<b>Fotocamera non disponibile.</b> Serve una connessione https e un dispositivo con '+
      'fotocamera. Puoi mirare lungo il bordo superiore del telefono: il calcolo è identico.';
    $('camOn').checked=false; return;
  }
  try{
    camStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720} }, audio:false });
    const v=$('camVideo'); v.srcObject=camStream; await v.play().catch(function(){});
    $('camWrap').hidden=false;
  }catch(e){
    $('camOn').checked=false;
    err.hidden=false;
    err.innerHTML = (e.name==='NotAllowedError')
      ? '<b>Permesso negato.</b> Autorizza la fotocamera dalle impostazioni del browser, oppure mira lungo '+
        'il bordo superiore del telefono: il risultato è lo stesso.'
      : '<b>Non è stato possibile aprire la fotocamera:</b> '+e.message;
  }
}
function camSpegni(){
  if(camStream){ camStream.getTracks().forEach(function(t){ t.stop(); }); camStream=null; }
  const v=$('camVideo'); if(v) v.srcObject=null;
  $('camWrap').hidden=true;
}
if($('camOn')) $('camOn').addEventListener('change',function(){
  if(this.checked) camAccendi(); else camSpegni();
});
/* spegni la fotocamera quando si lascia la scheda o l'app va in secondo piano */
document.addEventListener('visibilitychange',function(){ if(document.hidden) { camSpegni();
  if($('camOn')) $('camOn').checked=false; } });

/* ---------------- 2 · misura su fotografia ---------------- */
const FOTO = {
  img:null, scale:1, ox:0, oy:0, cal:[], pts:[], mmPerPx:null, drag:null, pinch:null
};

function fotoCanvas(){ return $('fotoCv'); }
function fotoRidisegna(){
  const cv=fotoCanvas(); if(!cv || !FOTO.img) return;
  const ctx=cv.getContext('2d');
  const w=cv.width, h=cv.height;
  ctx.save();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface-2') || '#eee';
  ctx.fillRect(0,0,w,h);
  ctx.translate(FOTO.ox, FOTO.oy); ctx.scale(FOTO.scale, FOTO.scale);
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(FOTO.img,0,0);
  ctx.restore();

  /* taratura */
  ctx.lineWidth=2;
  if(FOTO.cal.length){
    ctx.strokeStyle='#eb6834'; ctx.fillStyle='#eb6834';
    FOTO.cal.forEach(function(p){ const s=fotoImg2Cv(p);
      ctx.beginPath(); ctx.arc(s.x,s.y,6,0,7); ctx.fill(); });
    if(FOTO.cal.length===2){
      const a=fotoImg2Cv(FOTO.cal[0]), b=fotoImg2Cv(FOTO.cal[1]);
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
  }
  /* limiti degli anelli */
  if(FOTO.pts.length){
    ctx.strokeStyle='#2a78d6'; ctx.fillStyle='#2a78d6';
    FOTO.pts.forEach(function(p,i){
      const s=fotoImg2Cv(p);
      ctx.beginPath(); ctx.arc(s.x,s.y,5.5,0,7); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
      ctx.fillText(String(i+1), s.x, s.y+3.5); ctx.fillStyle='#2a78d6';
      if(i){ const q=fotoImg2Cv(FOTO.pts[i-1]);
        ctx.beginPath(); ctx.moveTo(q.x,q.y); ctx.lineTo(s.x,s.y); ctx.stroke(); }
    });
  }
}
function fotoImg2Cv(p){ return {x:p.x*FOTO.scale+FOTO.ox, y:p.y*FOTO.scale+FOTO.oy}; }
function fotoCv2Img(x,y){ return {x:(x-FOTO.ox)/FOTO.scale, y:(y-FOTO.oy)/FOTO.scale}; }

function fotoAdatta(){
  const cv=fotoCanvas(); if(!FOTO.img) return;
  const s=Math.min(cv.width/FOTO.img.width, cv.height/FOTO.img.height);
  FOTO.scale=s;
  FOTO.ox=(cv.width-FOTO.img.width*s)/2;
  FOTO.oy=(cv.height-FOTO.img.height*s)/2;
  fotoRidisegna();
}
function fotoZoom(k, cx, cy){
  const cv=fotoCanvas();
  cx = cx===undefined ? cv.width/2 : cx;
  cy = cy===undefined ? cv.height/2 : cy;
  const before=fotoCv2Img(cx,cy);
  FOTO.scale=Math.max(0.05, Math.min(40, FOTO.scale*k));
  FOTO.ox = cx - before.x*FOTO.scale;
  FOTO.oy = cy - before.y*FOTO.scale;
  fotoRidisegna();
}

/* lente d'ingrandimento: indispensabile per toccare con precisione su un telefono */
function fotoLente(x,y,mostra){
  const l=$('fotoLoupe'); if(!l) return;
  if(!mostra || !FOTO.img){ l.hidden=true; return; }
  l.hidden=false;
  if(!l.width){ l.width=236; l.height=236; }
  const L=l.width, ctx=l.getContext('2d'), Z=4;
  ctx.clearRect(0,0,L,L);
  ctx.save();
  ctx.beginPath(); ctx.arc(L/2,L/2,L/2-2,0,7); ctx.clip();
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,L,L);
  const p=fotoCv2Img(x,y);
  ctx.translate(L/2,L/2); ctx.scale(Z,Z); ctx.scale(FOTO.scale,FOTO.scale);
  ctx.translate(-p.x,-p.y);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(FOTO.img,0,0);
  ctx.restore();
  ctx.strokeStyle='#eb6834'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(L/2-11,L/2); ctx.lineTo(L/2+11,L/2);
  ctx.moveTo(L/2,L/2-11); ctx.lineTo(L/2,L/2+11); ctx.stroke();
  /* la lente si sposta nell'angolo opposto al dito */
  l.style.left = (x < fotoCanvas().width/2) ? 'auto' : '8px';
  l.style.right= (x < fotoCanvas().width/2) ? '8px' : 'auto';
}

function fotoAggiungiPunto(x,y){
  const p=fotoCv2Img(x,y);
  if(FOTO.mmPerPx===null){
    if(FOTO.cal.length<2) FOTO.cal.push(p);
    $('fCal').textContent = FOTO.cal.length+'/2 tacche';
    $('fStep1').classList.toggle('done', FOTO.cal.length===2);
  } else {
    FOTO.pts.push(p);
    $('fCount').textContent = FOTO.pts.length+' punti';
    $('fStep2').classList.toggle('done', FOTO.pts.length>=2);
    fotoRisultati();
  }
  fotoRidisegna();
}

function fotoRisultati(){
  const out=$('fOut');
  if(FOTO.mmPerPx===null || FOTO.pts.length<2){ out.hidden=true; return; }
  out.hidden=false;
  const w=[];
  for(let i=1;i<FOTO.pts.length;i++){
    const a=FOTO.pts[i-1], b=FOTO.pts[i];
    w.push(Math.hypot(b.x-a.x,b.y-a.y)*FOTO.mmPerPx);
  }
  FOTO.larghezze=w;
  $('fScale').textContent = FOTO.mmPerPx.toFixed(4);
  $('fN').textContent = w.length;
  $('fMean').textContent = fmt(w.reduce(function(a,b){return a+b;},0)/w.length, 2);
  let t='<tr><th>Anello</th><th>Larghezza (mm)</th></tr>';
  w.forEach(function(v,i){ t+='<tr><td>'+(i+1)+'</td><td>'+fmt(v,2)+'</td></tr>'; });
  $('fTab').innerHTML=t;
}

/* --- eventi del canvas --- */
(function(){
  const cv=fotoCanvas(); if(!cv) return;
  let moved=false, startX=0, startY=0, t0=0;

  function pos(e){ const r=cv.getBoundingClientRect();
    return { x:(e.clientX-r.left)*cv.width/r.width, y:(e.clientY-r.top)*cv.height/r.height }; }

  cv.addEventListener('pointerdown',function(e){
    cv.setPointerCapture(e.pointerId);
    const p=pos(e); startX=p.x; startY=p.y; moved=false; t0=Date.now();
    FOTO.drag={x:p.x,y:p.y,ox:FOTO.ox,oy:FOTO.oy};
    fotoLente(p.x,p.y,true);
  });
  cv.addEventListener('pointermove',function(e){
    if(!FOTO.drag) return;
    const p=pos(e);
    if(Math.hypot(p.x-startX,p.y-startY)>7) moved=true;
    FOTO.ox=FOTO.drag.ox+(p.x-FOTO.drag.x);
    FOTO.oy=FOTO.drag.oy+(p.y-FOTO.drag.y);
    fotoRidisegna(); fotoLente(p.x,p.y,true);
  });
  function up(e){
    if(!FOTO.drag) return;
    const p=pos(e);
    fotoLente(0,0,false);
    if(!moved && Date.now()-t0<600) fotoAggiungiPunto(p.x,p.y);
    FOTO.drag=null;
  }
  cv.addEventListener('pointerup',up);
  cv.addEventListener('pointercancel',function(){ FOTO.drag=null; fotoLente(0,0,false); });
  cv.addEventListener('wheel',function(e){ e.preventDefault();
    const p=pos(e); fotoZoom(e.deltaY<0?1.15:1/1.15, p.x, p.y); }, {passive:false});
})();

$('fotoFile').addEventListener('change',function(e){
  const f=e.target.files[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=function(){
    FOTO.img=im; FOTO.cal=[]; FOTO.pts=[]; FOTO.mmPerPx=null;
    $('fotoWork').hidden=false; $('fOut').hidden=true; $('fCalBox').hidden=false;
    $('fCal').textContent='0/2 tacche'; $('fCount').textContent='0 punti';
    $('fStep1').classList.remove('done'); $('fStep2').classList.remove('done');
    const cv=fotoCanvas();
    const larg=Math.min(760, cv.parentElement.clientWidth||360);
    cv.width=Math.round(larg); cv.height=Math.round(larg*0.75);
    fotoAdatta();
    URL.revokeObjectURL(url);
  };
  im.onerror=function(){ alert('Immagine non leggibile.'); };
  im.src=url;
});
$('fCalOk').addEventListener('click',function(){
  if(FOTO.cal.length<2){ alert('Tocca prima due tacche del righello sulla foto.'); return; }
  const mm=num($('fMm').value);
  if(!(mm>0)){ alert('Indica quanti millimetri separano le due tacche.'); return; }
  const px=Math.hypot(FOTO.cal[1].x-FOTO.cal[0].x, FOTO.cal[1].y-FOTO.cal[0].y);
  if(px<8){ alert('Le due tacche sono troppo vicine: la taratura sarebbe imprecisa. Ingrandisci e riprova.'); return; }
  FOTO.mmPerPx = mm/px;
  $('fCalBox').hidden=true;
  $('fCal').textContent = fmt(mm,1)+' mm su '+fmt(px,0)+' px';
  $('fStep1').classList.add('done');
  fotoRidisegna();
});
$('fUndo').addEventListener('click',function(){
  if(FOTO.mmPerPx===null){ FOTO.cal.pop(); $('fCal').textContent=FOTO.cal.length+'/2 tacche'; }
  else { FOTO.pts.pop(); $('fCount').textContent=FOTO.pts.length+' punti'; fotoRisultati(); }
  fotoRidisegna();
});
$('fReset').addEventListener('click',function(){
  FOTO.cal=[]; FOTO.pts=[]; FOTO.mmPerPx=null;
  $('fCalBox').hidden=false; $('fOut').hidden=true;
  $('fCal').textContent='0/2 tacche'; $('fCount').textContent='0 punti';
  $('fStep1').classList.remove('done'); $('fStep2').classList.remove('done');
  fotoRidisegna();
});
$('fzIn').addEventListener('click',function(){ fotoZoom(1.35); });
$('fzOut').addEventListener('click',function(){ fotoZoom(1/1.35); });
$('fzFit').addEventListener('click',fotoAdatta);
$('fSend').addEventListener('click',function(){
  if(!FOTO.larghezze || !FOTO.larghezze.length){ alert('Non ci sono ancora larghezze misurate.'); return; }
  const c = coreById(S.active);
  if(!c){ alert('Crea prima una carota nella scheda Anelli, poi torna qui.'); return; }
  if(c.w.length && !confirm('La carota '+c.id+' contiene già '+c.w.length+' anelli. Sostituirli con i '+
     FOTO.larghezze.length+' misurati sulla foto?')) return;
  c.w = FOTO.larghezze.map(function(v){ return Math.round(v*100)/100; });
  redrawDen();
  alert('Inserite '+c.w.length+' larghezze nella carota '+c.id+'.');
});
</script>

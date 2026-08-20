<script>
"use strict";
/* ============================================================
   PARTE D — IPSOMETRO CON INCLINOMETRO DEL TELEFONO
   Misura trigonometrica a due angoli.  Asse di mira = fotocamera
   posteriore (−Z del dispositivo).  L'elevazione si ricava dal
   vettore di gravità misurato dall'accelerometro:
       sin θ = −a_z / |a|
   valida in qualunque rotazione attorno all'asse di mira.
   ============================================================ */

const IPS = {
  on:false, raw:0, ang:0, off:0, buf:[], src:null,
  base:null, cima:null, hist:[], last:null
};
const DEG = 180/Math.PI;

function ipsSupported(){
  return (typeof window.DeviceMotionEvent !== 'undefined') ||
         (typeof window.DeviceOrientationEvent !== 'undefined');
}
function secureOk(){
  return window.isSecureContext === true ||
         location.protocol === 'https:' ||
         location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

async function ipsAttiva(){
  const err = $('ipsErr');
  err.hidden = true; err.textContent = '';
  if(!ipsSupported()){
    err.hidden=false;
    err.innerHTML = '<b>Questo dispositivo non espone i sensori di movimento.</b> Su un computer è normale: '+
      'l\'ipsometro funziona solo su telefono o tablet. Puoi comunque inserire le altezze a mano nella scheda Cubatura.';
    return;
  }
  if(!secureOk()){
    err.hidden=false;
    err.innerHTML = '<b>Serve una connessione sicura (https).</b> I browser permettono l\'accesso ai sensori '+
      'solo se la pagina è servita da un indirizzo https, non se è aperta come file locale. '+
      'Apri l\'app dall\'indirizzo web che ti ha dato il docente.';
    return;
  }
  try{
    if(typeof DeviceMotionEvent!=='undefined' && typeof DeviceMotionEvent.requestPermission==='function'){
      const r = await DeviceMotionEvent.requestPermission();
      if(r!=='granted'){
        err.hidden=false;
        err.innerHTML='<b>Permesso negato.</b> Su iPhone: Impostazioni → Safari → Movimento e orientamento → attiva, '+
          'poi ricarica la pagina e riprova.';
        return;
      }
    }
    if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
      try{ await DeviceOrientationEvent.requestPermission(); }catch(e){}
    }
  }catch(e){
    err.hidden=false; err.innerHTML='<b>Non è stato possibile attivare i sensori:</b> '+e.message; return;
  }

  let got=false;
  const onMotion=function(ev){
    const a = ev.accelerationIncludingGravity;
    if(!a || (a.x===null&&a.y===null&&a.z===null)) return;
    const m = Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z);
    if(!(m>1)) return;
    got=true; IPS.src='accelerometro';
    ipsPush(Math.asin(Math.max(-1,Math.min(1, -a.z/m)))*DEG);
  };
  const onOrient=function(ev){
    if(got) return;
    if(ev.beta===null||ev.beta===undefined) return;
    IPS.src='orientamento';
    ipsPush(ev.beta - 90);          // ripiego: telefono in verticale, fotocamera in avanti
  };
  window.addEventListener('devicemotion', onMotion, true);
  window.addEventListener('deviceorientation', onOrient, true);

  setTimeout(function(){
    if(IPS.src===null){
      err.hidden=false;
      err.innerHTML='<b>Nessun dato dai sensori.</b> Il dispositivo potrebbe non avere un accelerometro, '+
        'oppure il browser lo blocca. Prova con un altro browser, o inserisci le altezze a mano.';
    }
  },1500);

  IPS.on=true;
  $('ipsGate').hidden=true; $('ipsLive').hidden=false;
  $('ipsCard2').hidden=false; $('ipsCard3').hidden=false;
}

/* filtro passa-basso + valutazione della stabilità */
function ipsPush(deg){
  IPS.raw = deg;
  IPS.ang = IPS.ang===null ? deg : IPS.ang + 0.18*(deg - IPS.ang);
  IPS.buf.push(deg); if(IPS.buf.length>24) IPS.buf.shift();
  ipsRender();
}
function ipsSigma(){
  const n=IPS.buf.length; if(n<6) return NaN;
  const m=IPS.buf.reduce(function(a,b){return a+b;},0)/n;
  return Math.sqrt(IPS.buf.reduce(function(a,b){return a+(b-m)*(b-m);},0)/(n-1));
}
function ipsAngolo(){ return IPS.ang - IPS.off; }

let ipsRaf=null;
function ipsRender(){
  if(ipsRaf) return;
  ipsRaf = requestAnimationFrame(function(){
    ipsRaf=null;
    const a = ipsAngolo();
    $('ipsAng').textContent = fmt(a,1)+'°';
    $('ipsDir').textContent = Math.abs(a)<0.6 ? 'orizzontale' : (a>0?'verso l\'alto':'verso il basso');
    const p = Math.max(0,Math.min(100, 50 + a/70*50));
    $('ipsDot').style.left = p+'%';
    const s = ipsSigma();
    const st = $('ipsStab');
    if(!isFinite(s)){ st.textContent='—'; st.className='v'; }
    else if(s<0.35){ st.textContent='ferma'; st.style.color='var(--good)'; }
    else if(s<1.0){ st.textContent='mossa'; st.style.color='var(--warn)'; }
    else { st.textContent='instabile'; st.style.color='var(--bad)'; }
    $('ipsOff').textContent = fmt(IPS.off,1)+'°';
  });
}

function ipsRegistra(quale){
  const s = ipsSigma();
  if(isFinite(s) && s>1.4){
    if(!confirm('Il telefono sta tremando parecchio (±'+fmt(s,1)+'°). Registrare lo stesso?')) return;
  }
  const v = ipsAngolo();
  if(quale==='base'){ IPS.base=v; $('valB').textContent = fmt(v,1)+'°'; $('stepB').classList.add('done'); }
  else             { IPS.cima=v; $('valC').textContent = fmt(v,1)+'°'; $('stepC').classList.add('done'); }
  ipsCalcola();
}

function ipsCalcola(){
  const out=$('ipsOut');
  if(IPS.base===null || IPS.cima===null){ out.hidden=true; return; }
  const D = num($('ipsD').value);
  if(!(D>0)){ out.hidden=true; return; }
  const ab=IPS.base*Math.PI/180, ac=IPS.cima*Math.PI/180;
  const tb=Math.tan(ab), tc=Math.tan(ac);
  const h = D*(tc-tb);
  const dA = 0.7*Math.PI/180, dD = 0.20;
  const sec2=function(x){ const c=Math.cos(x); return 1/(c*c); };
  const eA = D*(sec2(ac)+sec2(ab))*dA;
  const eD = Math.abs(tc-tb)*dD;
  const dh = Math.sqrt(eA*eA + eD*eD);
  IPS.last = {D:D, base:IPS.base, cima:IPS.cima, h:h, dh:dh, rif:$('ipsAlbero').value.trim()};

  out.hidden=false;
  $('ipsH').textContent = h>0 ? fmt(h,1) : '—';
  $('ipsDh').textContent = fmt(dh,1);

  $('ipsDett').innerHTML =
    '<tr><th style="text-align:left">Grandezza</th><th>Valore</th></tr>'+
    '<tr><td style="text-align:left">Distanza orizzontale D</td><td>'+fmt(D,1)+' m</td></tr>'+
    '<tr><td style="text-align:left">Angolo alla base</td><td>'+fmt(IPS.base,1)+'°</td></tr>'+
    '<tr><td style="text-align:left">Angolo alla cima</td><td>'+fmt(IPS.cima,1)+'°</td></tr>'+
    '<tr><td style="text-align:left">Parte sopra l\'occhio  D·tan α<sub>c</sub></td><td>'+fmt(D*tc,1)+' m</td></tr>'+
    '<tr><td style="text-align:left">Parte sotto l\'occhio  −D·tan α<sub>b</sub></td><td>'+fmt(-D*tb,1)+' m</td></tr>'+
    '<tr><td style="text-align:left">Errore da ±0,7° di angolo</td><td>± '+fmt(eA,2)+' m</td></tr>'+
    '<tr><td style="text-align:left">Errore da ±0,20 m di distanza</td><td>± '+fmt(eD,2)+' m</td></tr>';

  const w=[];
  if(h<=0) w.push('Il risultato è negativo o nullo: probabilmente hai invertito base e cima, oppure la distanza è sbagliata.');
  if(h>0 && D < 0.8*h) w.push('Sei troppo vicino: la distanza ('+fmt(D,1)+' m) è minore dell\'altezza stimata ('+fmt(h,1)+' m). Allontanati fino ad almeno '+fmt(h,0)+' m: l\'errore si riduce molto.');
  if(Math.abs(IPS.cima)>55) w.push('Angolo alla cima molto ripido ('+fmt(IPS.cima,0)+'°): sei vicino alla pianta e la tangente diventa sensibile a piccoli errori. Se puoi, allontanati.');
  if(h>0 && dh/h > 0.12) w.push('L\'incertezza supera il 12% dell\'altezza. Rifai la misura da più lontano o con la distanza misurata meglio.');
  if(IPS.cima < IPS.base) w.push('L\'angolo alla cima è più basso di quello alla base: controlla di non averli scambiati.');
  $('ipsWarn').innerHTML = w.length ? w.map(function(t){return '<div class="warnbox">'+t+'</div>';}).join('') : '';
}

/* --- storico --- */
function ipsRenderHist(){
  const t=$('ipsTab');
  if(!IPS.hist.length){ t.innerHTML='<tr><td class="muted">Nessuna misura salvata.</td></tr>'; return; }
  let h='<tr><th>#</th><th style="text-align:left">Riferimento</th><th>D (m)</th><th>α base</th><th>α cima</th><th>h (m)</th><th>± (m)</th><th></th></tr>';
  IPS.hist.forEach(function(r,i){
    h+='<tr><td>'+(i+1)+'</td><td style="text-align:left">'+(r.rif||'—')+'</td><td>'+fmt(r.D,1)+
       '</td><td>'+fmt(r.base,1)+'°</td><td>'+fmt(r.cima,1)+'°</td><td><b>'+fmt(r.h,1)+'</b></td><td>'+fmt(r.dh,1)+
       '</td><td><button class="chip" data-ipsdel="'+i+'" style="color:var(--bad)">✕</button></td></tr>';
  });
  t.innerHTML=h;
  t.querySelectorAll('button[data-ipsdel]').forEach(function(b){
    b.addEventListener('click',function(){ IPS.hist.splice(+b.dataset.ipsdel,1); ipsRenderHist(); });
  });
}

/* --- eventi --- */
$('ipsStart').addEventListener('click', ipsAttiva);
$('ipsRecB').addEventListener('click', function(){ ipsRegistra('base'); });
$('ipsRecC').addEventListener('click', function(){ ipsRegistra('cima'); });
$('ipsD').addEventListener('input', ipsCalcola);
$('ipsZero').addEventListener('click', function(){
  IPS.off = IPS.ang;
  alert('Zero impostato. L\'inclinometro considera orizzontale la posizione attuale del telefono.');
  ipsRender(); ipsCalcola();
});
$('ipsZeroRes').addEventListener('click', function(){ IPS.off=0; ipsRender(); ipsCalcola(); });
$('ipsReset').addEventListener('click', function(){
  IPS.base=null; IPS.cima=null; IPS.last=null;
  $('valB').textContent='—'; $('valC').textContent='—';
  $('stepB').classList.remove('done'); $('stepC').classList.remove('done');
  $('ipsOut').hidden=true; $('ipsAlbero').value='';
});
$('ipsSave').addEventListener('click', function(){
  if(!IPS.last) return;
  IPS.hist.push(Object.assign({},IPS.last)); ipsRenderHist();
});
$('ipsUse').addEventListener('click', function(){
  if(!IPS.last || !(IPS.last.h>0)){ alert('Non c\'è una misura valida da usare.'); return; }
  $('hm').value = IPS.last.h.toFixed(1);
  if(!IPS.hist.some(function(r){ return r===IPS.last; })){ IPS.hist.push(Object.assign({},IPS.last)); ipsRenderHist(); }
  document.querySelector('nav button[data-tab="cub"]').click();
  $('d1').focus();
});
$('ipsExp').addEventListener('click', function(){
  let csv='n;riferimento;distanza_m;angolo_base_gradi;angolo_cima_gradi;altezza_m;incertezza_m\n';
  IPS.hist.forEach(function(r,i){
    csv+=[i+1,r.rif||'',r.D.toFixed(2),r.base.toFixed(2),r.cima.toFixed(2),r.h.toFixed(2),r.dh.toFixed(2)].join(';')+'\n';
  });
  download('ipsometria_domegge_'+stamp()+'.csv', csv.replace(/\./g,','));
});
$('ipsClr').addEventListener('click', function(){
  if(confirm('Svuotare lo storico delle misure di altezza?')){ IPS.hist=[]; ipsRenderHist(); }
});
ipsRenderHist();
</script>

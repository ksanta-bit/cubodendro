<script>
"use strict";
/* ============================================================
   PARTE D — IPSOMETRO E CLISIMETRO

   Asse di mira = fotocamera posteriore (−Z del dispositivo).
   L'elevazione si ricava dal vettore di gravità:
        sin α = −a_z / |a|
   valida in qualunque rotazione attorno all'asse di mira.

   La stessa lettura, con il telefono appoggiato disteso, dà
   l'inclinazione del piano d'appoggio (pendenza del versante):
        cos β = |a_z| / |a|

   Due formule per l'altezza:
        seni      h = L_c·sin α_c − L_b·sin α_b     (esatta anche
                                                     con la cima
                                                     fuori asse)
        tangenti  h = D·(tan α_c − tan α_b)         (assume la cima
                                                     sulla verticale
                                                     della base)
   ============================================================ */

const IPS = {
  on:false, raw:0, ang:null, off:0, src:null,
  alpha:0.035,                 /* costante del filtro passa-basso   */
  buf:[],                      /* {t, v} angolo di mira, ultimi 3 s */
  tbuf:[],                     /* {t, v} inclinazione del piano     */
  giu:false,                   /* telefono a faccia in giù          */
  base:null, cima:null, hist:[], last:null,
  pend:[]                      /* letture di pendenza salvate       */
};
const DEG = 180/Math.PI;
const RAD = Math.PI/180;
const DALFA = 0.7;             /* incertezza di mira, gradi         */
const DDIST = 0.20;            /* incertezza di distanza, metri     */
function ora(){ return (window.performance && performance.now) ? performance.now() : (new Date()).getTime(); }

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
    /* angolo di mira lungo l'asse della fotocamera */
    ipsPush(Math.asin(Math.max(-1,Math.min(1, -a.z/m)))*DEG);
    /* inclinazione del piano del telefono, per la pendenza */
    IPS.giu = (a.z < 0);
    pendPush(Math.acos(Math.max(0,Math.min(1, Math.abs(a.z)/m)))*DEG);
  };
  const onOrient=function(ev){
    if(got) return;
    if(ev.beta===null||ev.beta===undefined) return;
    IPS.src='orientamento';
    ipsPush(ev.beta - 90);          /* ripiego: telefono in verticale, fotocamera in avanti */
    const b=(ev.beta||0)*RAD, g=(ev.gamma||0)*RAD;
    pendPush(Math.acos(Math.max(0,Math.min(1, Math.abs(Math.cos(b)*Math.cos(g)))))*DEG);
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
  $('ipsCard2').hidden=false; $('ipsCardPend').hidden=false; $('ipsCard3').hidden=false;
  IPS.alpha = parseFloat($('ipsSmorz').value) || 0.035;

  /* il mirino serve proprio adesso: si accende da solo */
  if($('camOn') && $('camOn').checked && typeof camAccendi==='function') camAccendi();
}

/* ---------- filtro e buffer ---------- */
function ipsPush(deg){
  IPS.raw = deg;
  IPS.ang = (IPS.ang===null) ? deg : IPS.ang + IPS.alpha*(deg - IPS.ang);
  const t=ora();
  /* si conserva il dato GREZZO: la stabilità e la registrazione devono
     misurare la mano che trema, non il ritardo del filtro. Il valore
     filtrato serve soltanto a far stare fermo il numero sullo schermo. */
  IPS.buf.push({t:t, v:deg});
  while(IPS.buf.length && t-IPS.buf[0].t > 3000) IPS.buf.shift();
  ipsRender();
}
function pendPush(deg){
  const t=ora();
  IPS.tbuf.push({t:t, v:deg});
  while(IPS.tbuf.length && t-IPS.tbuf[0].t > 3000) IPS.tbuf.shift();
}
function finestra(buf, ms){
  const t=ora();
  return buf.filter(function(r){ return t-r.t <= ms; }).map(function(r){ return r.v; });
}
function mediana(v){
  if(!v.length) return NaN;
  const s=v.slice().sort(function(a,b){return a-b;});
  const n=s.length, k=n>>1;
  return n%2 ? s[k] : (s[k-1]+s[k])/2;
}
function ipsSigma(){
  const v=finestra(IPS.buf,1000);
  if(v.length<6) return NaN;
  const m=v.reduce(function(a,b){return a+b;},0)/v.length;
  return Math.sqrt(v.reduce(function(a,b){return a+(b-m)*(b-m);},0)/(v.length-1));
}
function ipsAngolo(){ return (IPS.ang===null?0:IPS.ang) - IPS.off; }

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
    if(!isFinite(s)){ st.textContent='—'; st.style.color=''; }
    else if(s<0.35){ st.textContent='ferma'; st.style.color='var(--good)'; }
    else if(s<1.0){ st.textContent='mossa'; st.style.color='var(--warn)'; }
    else { st.textContent='instabile'; st.style.color='var(--bad)'; }
    $('ipsOff').textContent = fmt(IPS.off,1)+'°';
    const ca=$('camAng'); if(ca) ca.textContent = fmt(a,1)+'°';
  });
}

/* ---------- registrazione: mediana dell'ultimo secondo ---------- */
function ipsRegistra(quale){
  const s = ipsSigma();
  if(isFinite(s) && s>1.4){
    if(!confirm('Il telefono sta tremando parecchio (±'+fmt(s,1)+'°). Registrare lo stesso?')) return;
  }
  /* la mediana di un secondo di letture grezze: robusta agli scarti
     isolati e senza il ritardo che avrebbe il valore filtrato */
  const camp = finestra(IPS.buf,1000);
  const v = (camp.length>=5 ? mediana(camp) : (IPS.ang===null?0:IPS.ang)) - IPS.off;
  if(quale==='base'){ IPS.base=v; $('valB').textContent = fmt(v,1)+'°'; $('stepB').classList.add('done'); }
  else             { IPS.cima=v; $('valC').textContent = fmt(v,1)+'°'; $('stepC').classList.add('done'); }
  ipsCalcola();
}

/* ---------- calcolo dell'altezza ---------- */
function ipsMetodo(){ return $('ipsMetodo').value; }

function ipsCalcola(){
  const out=$('ipsOut');
  if(IPS.base===null || IPS.cima===null){ out.hidden=true; return; }
  const ab=IPS.base*RAD, ac=IPS.cima*RAD;
  const dA=DALFA*RAD;
  const met=ipsMetodo();
  let h, dh, D, Lb, Lc, derivata=false, righe=[];

  if(met==='sin'){
    Lb = num($('ipsLb').value);
    if(!(Lb>0)){ out.hidden=true; return; }
    const grezzo = $('ipsLc').value.trim();
    Lc = grezzo==='' ? NaN : num(grezzo);
    if(!(Lc>0)){
      /* nessuna misura alla cima: la ricavo supponendo la cima sulla
         verticale della base — cioè accettando l'ipotesi delle tangenti */
      derivata = true;
      const cb=Math.cos(ab), cc=Math.cos(ac);
      if(Math.abs(cc)<1e-6){ out.hidden=true; return; }
      Lc = Lb*cb/cc;
    }
    h = Lc*Math.sin(ac) - Lb*Math.sin(ab);
    D = Lb*Math.cos(ab);
    const e1=Lc*Math.cos(ac)*dA, e2=Lb*Math.cos(ab)*dA;
    const e3=Math.sin(ac)*DDIST, e4=Math.sin(ab)*DDIST;
    dh = Math.sqrt(e1*e1+e2*e2+e3*e3+e4*e4);
    righe = [
      ['Metodo', 'seni'],
      ['Distanza inclinata alla base  L<sub>b</sub>', fmt(Lb,2)+' m'],
      ['Distanza inclinata alla cima  L<sub>c</sub>', fmt(Lc,2)+' m'+(derivata?' (ricavata)':' (misurata)')],
      ['Angolo alla base  α<sub>b</sub>', fmt(IPS.base,1)+'°'],
      ['Angolo alla cima  α<sub>c</sub>', fmt(IPS.cima,1)+'°'],
      ['Quota della cima  L<sub>c</sub>·sin α<sub>c</sub>', fmt(Lc*Math.sin(ac),2)+' m'],
      ['Quota della base  L<sub>b</sub>·sin α<sub>b</sub>', fmt(Lb*Math.sin(ab),2)+' m'],
      ['Distanza orizzontale equivalente  D', fmt(D,2)+' m'],
      ['Errore da ±'+fmt(DALFA,1)+'° di mira', '± '+fmt(Math.sqrt(e1*e1+e2*e2),2)+' m'],
      ['Errore da ±'+fmt(DDIST,2)+' m di distanza', '± '+fmt(Math.sqrt(e3*e3+e4*e4),2)+' m']
    ];
  } else {
    D = num($('ipsD').value);
    if(!(D>0)){ out.hidden=true; return; }
    const tb=Math.tan(ab), tc=Math.tan(ac);
    h = D*(tc-tb);
    Lb = D/Math.cos(ab); Lc = D/Math.cos(ac);
    const sec2=function(x){ const c=Math.cos(x); return 1/(c*c); };
    const eA = D*(sec2(ac)+sec2(ab))*dA;
    const eD = Math.abs(tc-tb)*DDIST;
    dh = Math.sqrt(eA*eA + eD*eD);
    righe = [
      ['Metodo', 'tangenti'],
      ['Distanza orizzontale  D', fmt(D,2)+' m'],
      ['Angolo alla base  α<sub>b</sub>', fmt(IPS.base,1)+'°'],
      ['Angolo alla cima  α<sub>c</sub>', fmt(IPS.cima,1)+'°'],
      ['Parte sopra l\'occhio  D·tan α<sub>c</sub>', fmt(D*tc,2)+' m'],
      ['Parte sotto l\'occhio  −D·tan α<sub>b</sub>', fmt(-D*tb,2)+' m'],
      ['Errore da ±'+fmt(DALFA,1)+'° di mira', '± '+fmt(eA,2)+' m'],
      ['Errore da ±'+fmt(DDIST,2)+' m di distanza', '± '+fmt(eD,2)+' m']
    ];
  }

  IPS.last = {met:met, D:D, Lb:Lb, Lc:Lc, derivata:derivata,
              base:IPS.base, cima:IPS.cima, h:h, dh:dh, rif:$('ipsAlbero').value.trim()};

  out.hidden=false;
  $('ipsH').textContent = h>0 ? fmt(h,1) : '—';
  $('ipsDh').textContent = fmt(dh,1);
  $('ipsDett').innerHTML = '<tr><th style="text-align:left">Grandezza</th><th>Valore</th></tr>'+
    righe.map(function(r){ return '<tr><td style="text-align:left">'+r[0]+'</td><td>'+r[1]+'</td></tr>'; }).join('');

  const w=[];
  if(h<=0) w.push('Il risultato è negativo o nullo: probabilmente hai invertito base e cima, oppure la distanza è sbagliata.');
  if(met==='sin' && derivata)
    w.push('La distanza alla cima non è stata misurata: l\'ho ricavata supponendo la <b>cima sulla verticale della base</b>. '+
           'Su una pianta inclinata questo è proprio l\'errore che il metodo dei seni servirebbe a evitare. Se hai un telemetro, misurala.');
  if(met==='tan' && h>0 && D < 0.8*h)
    w.push('Sei troppo vicino: la distanza ('+fmt(D,1)+' m) è minore dell\'altezza stimata ('+fmt(h,1)+' m). '+
           'Con le tangenti l\'errore cresce in fretta; allontanati fino ad almeno '+fmt(h,0)+' m, oppure passa al metodo dei seni.');
  if(met==='tan' && Math.abs(IPS.cima)>55)
    w.push('Angolo alla cima molto ripido ('+fmt(IPS.cima,0)+'°): con le tangenti la sensibilità all\'errore di mira è già quadruplicata. Il metodo dei seni qui è molto più stabile.');
  if(h>0 && dh/h > 0.12) w.push('L\'incertezza supera il 12% dell\'altezza. Rifai la misura da più lontano o con la distanza misurata meglio.');
  if(IPS.cima < IPS.base) w.push('L\'angolo alla cima è più basso di quello alla base: controlla di non averli scambiati.');
  $('ipsWarn').innerHTML = w.length ? w.map(function(t){return '<div class="warnbox">'+t+'</div>';}).join('') : '';
}

/* ---------- pendenza del versante ---------- */
function pendRender(){
  const n=IPS.pend.length;
  $('pendCount').textContent = n ? (n===1?'1 lettura registrata.':n+' letture registrate.') : 'Nessuna lettura.';
  const out=$('pendOut');
  if(!n){ out.hidden=true; return; }
  out.hidden=false;
  const m = IPS.pend.reduce(function(a,b){return a+b;},0)/n;
  $('pendDeg').textContent = fmt(m,1);
  $('pendPct').textContent = fmt(Math.tan(m*RAD)*100,0);
  $('pendN').textContent = n;
  let t='<tr><th>#</th><th>Pendenza</th><th>%</th><th></th></tr>';
  IPS.pend.forEach(function(v,i){
    t+='<tr><td>'+(i+1)+'</td><td>'+fmt(v,1)+'°</td><td>'+fmt(Math.tan(v*RAD)*100,0)+'</td>'+
       '<td><button class="chip" data-pdel="'+i+'" style="color:var(--bad)">✕</button></td></tr>';
  });
  $('pendTab').innerHTML=t;
  $('pendTab').querySelectorAll('button[data-pdel]').forEach(function(b){
    b.addEventListener('click',function(){ IPS.pend.splice(+b.dataset.pdel,1); pendRender(); });
  });
  const w=[];
  if(n>=2){
    const mx=Math.max.apply(null,IPS.pend), mn=Math.min.apply(null,IPS.pend);
    if(mx-mn>6) w.push('Le letture differiscono di '+fmt(mx-mn,0)+'°: il telefono sta appoggiando su un terreno '+
      'irregolare. Mettilo su una tavoletta o su un bastone disteso lungo la linea di massima pendenza, e rifai.');
  }
  if(m>45) w.push('Pendenza oltre i 45°: controlla che il telefono fosse davvero appoggiato al suolo e non in mano.');
  $('pendWarn').innerHTML = w.length ? w.map(function(t){return '<div class="warnbox">'+t+'</div>';}).join('') : '';
}
function pendMisura(){
  const b=$('pendGo');
  const t0=ora();                      /* si raccoglie DA ADESSO, non a ritroso:
                                          il telefono lo hai appena appoggiato */
  b.disabled=true; b.textContent='Sto leggendo… tieni fermo';
  setTimeout(function(){
    const v = IPS.tbuf.filter(function(r){ return r.t>=t0; }).map(function(r){ return r.v; });
    b.disabled=false; b.textContent='Misura la pendenza';
    if(v.length<5){ alert('Non arrivano abbastanza letture dal sensore in questo secondo. Controlla che l\'inclinometro sia attivo e riprova.'); return; }
    if(IPS.giu) alert('Attenzione: il telefono sembra appoggiato a faccia in giù. La lettura è comunque valida, ma controlla.');
    IPS.pend.push(mediana(v));
    pendRender();
  },1300);
}

/* ---------- storico ---------- */
function ipsRenderHist(){
  const t=$('ipsTab');
  if(!IPS.hist.length){ t.innerHTML='<tr><td class="muted">Nessuna misura salvata.</td></tr>'; return; }
  let h='<tr><th>#</th><th style="text-align:left">Riferimento</th><th>metodo</th><th>dist. (m)</th><th>α base</th><th>α cima</th><th>h (m)</th><th>± (m)</th><th></th></tr>';
  IPS.hist.forEach(function(r,i){
    h+='<tr><td>'+(i+1)+'</td><td style="text-align:left">'+(r.rif||'—')+'</td><td>'+(r.met==='sin'?'seni':'tang.')+
       '</td><td>'+fmt(r.met==='sin'?r.Lb:r.D,1)+
       '</td><td>'+fmt(r.base,1)+'°</td><td>'+fmt(r.cima,1)+'°</td><td><b>'+fmt(r.h,1)+'</b></td><td>'+fmt(r.dh,1)+
       '</td><td><button class="chip" data-ipsdel="'+i+'" style="color:var(--bad)">✕</button></td></tr>';
  });
  t.innerHTML=h;
  t.querySelectorAll('button[data-ipsdel]').forEach(function(b){
    b.addEventListener('click',function(){ IPS.hist.splice(+b.dataset.ipsdel,1); ipsRenderHist(); });
  });
}

/* ---------- eventi ---------- */
$('ipsStart').addEventListener('click', ipsAttiva);
$('ipsRecB').addEventListener('click', function(){ ipsRegistra('base'); });
$('ipsRecC').addEventListener('click', function(){ ipsRegistra('cima'); });
['ipsD','ipsLb','ipsLc'].forEach(function(id){ $(id).addEventListener('input', ipsCalcola); });

$('ipsSmorz').addEventListener('change', function(){
  IPS.alpha = parseFloat(this.value)||0.035;
  IPS.buf.length=0;                     /* il filtro riparte pulito */
});

$('ipsMetodo').addEventListener('change', function(){
  const sin = this.value==='sin';
  $('ipsInSin').hidden = !sin;
  $('ipsInTan').hidden = sin;
  ipsCalcola();
});

$('ipsZero').addEventListener('click', function(){
  IPS.off = (IPS.ang===null?0:IPS.ang);
  alert('Zero impostato. L\'inclinometro considera orizzontale la posizione attuale del telefono.');
  ipsRender(); ipsCalcola();
});
$('ipsZeroRes').addEventListener('click', function(){ IPS.off=0; ipsRender(); ipsCalcola(); });

$('ipsHardReset').addEventListener('click', function(){
  IPS.off=0; IPS.ang=null; IPS.buf.length=0; IPS.tbuf.length=0;
  IPS.base=null; IPS.cima=null; IPS.last=null;
  $('valB').textContent='—'; $('valC').textContent='—';
  $('stepB').classList.remove('done'); $('stepC').classList.remove('done');
  $('ipsOut').hidden=true;
  $('ipsAng').textContent='0,0°'; $('ipsStab').textContent='—'; $('ipsStab').style.color='';
  ipsRender();
});

$('ipsConv').addEventListener('click', function(){
  const S=num($('ipsS').value), b=num($('ipsBeta').value);
  const o=$('ipsConvOut');
  if(!(S>0) || !isFinite(b)){ o.hidden=false; o.innerHTML='Servono sia la distanza misurata sul terreno sia la pendenza.'; return; }
  const D=S*Math.cos(b*RAD);
  o.hidden=false;
  o.innerHTML='<b>D = '+fmt(D,2)+' m</b> &nbsp;(da S = '+fmt(S,2)+' m con β = '+fmt(b,1)+'°). '+
    'Scarto rispetto alla misura sul terreno: '+fmt(S-D,2)+' m, cioè il '+fmt((S-D)/S*100,1)+'%.';
  if(ipsMetodo()==='tan') $('ipsD').value = D.toFixed(2);
  else                    $('ipsLb').value = S.toFixed(2);   /* i seni vogliono la distanza inclinata */
  ipsCalcola();
});

$('pendGo').addEventListener('click', pendMisura);
$('pendClr').addEventListener('click', function(){ IPS.pend.length=0; pendRender(); });
$('pendUse').addEventListener('click', function(){
  if(!IPS.pend.length) return;
  const m = IPS.pend.reduce(function(a,b){return a+b;},0)/IPS.pend.length;
  $('ipsBeta').value = m.toFixed(1);
  document.querySelector('nav button[data-tab="ips"]').click();
  $('ipsS').focus();
});
$('pendRaggio').addEventListener('click', function(){
  if(!IPS.pend.length) return;
  const m = IPS.pend.reduce(function(a,b){return a+b;},0)/IPS.pend.length;
  const R = num($('raggio').value);
  const Rs = R/Math.cos(m*RAD);
  alert('Area di saggio di raggio '+fmt(R,2)+' m su un versante a '+fmt(m,1)+'°.\n\n'+
        'Lungo la linea di massima pendenza la cordella va stesa a '+fmt(Rs,2)+' m '+
        '('+fmt(Rs-R,2)+' m in più).\n\nIn direzione perpendicolare al pendio, invece, il raggio resta '+
        fmt(R,2)+' m: il cerchio visto da terra è un\'ellisse.');
});

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
  let csv='n;riferimento;metodo;dist_base_m;dist_cima_m;dist_orizz_m;angolo_base_gradi;angolo_cima_gradi;altezza_m;incertezza_m\n';
  IPS.hist.forEach(function(r,i){
    csv+=[i+1, r.rif||'', r.met==='sin'?'seni':'tangenti',
          (r.Lb||0).toFixed(2), (r.Lc||0).toFixed(2), (r.D||0).toFixed(2),
          r.base.toFixed(2), r.cima.toFixed(2), r.h.toFixed(2), r.dh.toFixed(2)].join(';')+'\n';
  });
  if(IPS.pend.length){
    csv+='\npendenze_versante_gradi\n';
    IPS.pend.forEach(function(v){ csv+=v.toFixed(2)+'\n'; });
  }
  download('ipsometria_domegge_'+stamp()+'.csv', csv.replace(/\./g,','));
});
$('ipsClr').addEventListener('click', function(){
  if(confirm('Svuotare lo storico delle misure di altezza?')){ IPS.hist=[]; ipsRenderHist(); }
});
ipsRenderHist();
pendRender();
</script>

<script>
"use strict";
/* ============================================================
   PARTE F — AREA DI SAGGIO CON GPS
   Registrazione del centro per media pesata di più letture,
   verifica dentro/fuori, mappa schematica con sfondo
   cartografico opzionale.
   ============================================================ */

const GPS = {
  watch:null, acqId:null, fixes:[], centro:null, pos:null,
  trail:[], trailOn:false, paused:false, tileZ:19, tilesOn:false, testId:null
};

/* --- geometria locale: approssimazione piana, ottima sotto il chilometro --- */
function metriPerGrado(lat){
  const r = lat*Math.PI/180;
  return { lat: 111132.92 - 559.82*Math.cos(2*r) + 1.175*Math.cos(4*r),
           lon: 111412.84*Math.cos(r) - 93.5*Math.cos(3*r) };
}
function offsetMetri(c, p){
  const k = metriPerGrado(c.lat);
  return { x:(p.lon-c.lon)*k.lon, y:(p.lat-c.lat)*k.lat };
}
function distanzaMetri(c, p){ const o=offsetMetri(c,p); return Math.hypot(o.x,o.y); }

function gpsErrore(msg){ const e=$('gpsErr'); e.hidden=false; e.innerHTML=msg; }

function gpsDisponibile(){
  if(!('geolocation' in navigator)){
    gpsErrore('<b>Questo dispositivo non espone la posizione.</b> Su un computer fisso è normale.'); return false; }
  if(!secureOk()){
    gpsErrore('<b>Serve una connessione sicura (https).</b> I browser danno accesso alla posizione solo se '+
      'la pagina arriva da un indirizzo https, non se è aperta come file locale. Apri l\'app dall\'indirizzo web.');
    return false; }
  return true;
}

/* ---------------- acquisizione del centro ---------------- */
const ACQ_MS = 20000;
function gpsRegistraCentro(){
  $('gpsErr').hidden = true;
  if(!gpsDisponibile()) return;
  GPS.fixes = [];
  $('gpsGate').hidden=true; $('gpsAcq').hidden=false; $('gpsDone').hidden=true;
  const t0 = performance.now();
  const arc = $('acqArc'), C = 2*Math.PI*52;
  arc.style.strokeDasharray = C;

  GPS.acqId = navigator.geolocation.watchPosition(function(p){
    const c=p.coords;
    if(!isFinite(c.latitude)||!isFinite(c.longitude)) return;
    GPS.fixes.push({lat:c.latitude, lon:c.longitude, acc:c.accuracy||30, alt:c.altitude});
    $('acqCount').textContent = GPS.fixes.length;
    $('acqAcc').textContent = '± '+fmt(c.accuracy||NaN,1)+' m';
    const f = Math.min(1,(performance.now()-t0)/ACQ_MS);
    arc.style.strokeDashoffset = C*(1-f);
    if(f>=1) gpsChiudiAcq();
  }, function(err){
    gpsChiudiAcq(true);
    $('gpsGate').hidden=false;
    gpsErrore(err.code===1
      ? '<b>Permesso negato.</b> Autorizza l\'accesso alla posizione dalle impostazioni del browser e riprova. '+
        'Su iPhone: Impostazioni → Safari → Posizione.'
      : '<b>Posizione non disponibile:</b> '+(err.message||'errore sconosciuto')+'. '+
        'Sotto copertura fitta può volerci qualche minuto per il primo aggancio.');
  }, {enableHighAccuracy:true, maximumAge:0, timeout:30000});

  setTimeout(function(){ if(GPS.acqId!==null) gpsChiudiAcq(); }, ACQ_MS+1500);
}

function gpsChiudiAcq(annulla){
  if(GPS.acqId!==null){ navigator.geolocation.clearWatch(GPS.acqId); GPS.acqId=null; }
  $('gpsAcq').hidden=true;
  if(annulla) return;
  if(!GPS.fixes.length){ $('gpsGate').hidden=false;
    gpsErrore('<b>Nessuna lettura ottenuta.</b> Prova a spostarti in un punto più aperto e riavvia.'); return; }

  /* scarta le letture peggiori, poi media pesando per 1/precisione² */
  const accs = GPS.fixes.map(function(f){return f.acc;}).sort(function(a,b){return a-b;});
  const soglia = Math.max(accs[Math.floor(accs.length/2)]*2, accs[0]*1.5);
  const buoni = GPS.fixes.filter(function(f){ return f.acc<=soglia; });
  const uso = buoni.length>=3 ? buoni : GPS.fixes;
  let sw=0, slat=0, slon=0, salt=0, nalt=0;
  uso.forEach(function(f){
    const w = 1/Math.max(1,f.acc*f.acc);
    sw+=w; slat+=f.lat*w; slon+=f.lon*w;
    if(f.alt!==null && f.alt!==undefined && isFinite(f.alt)){ salt+=f.alt; nalt++; }
  });
  /* la precisione della media migliora con la radice del numero di letture indipendenti */
  const accMedia = Math.min.apply(null, uso.map(function(f){return f.acc;})) / Math.sqrt(Math.max(1,uso.length/3));
  GPS.centro = { lat:slat/sw, lon:slon/sw, acc:accMedia,
                 alt: nalt? salt/nalt : NaN, n:uso.length, t:new Date() };

  $('gpsDone').hidden=false; $('cardVer').hidden=false; $('cardMap').hidden=false;
  $('cLat').textContent = GPS.centro.lat.toFixed(6);
  $('cLon').textContent = GPS.centro.lon.toFixed(6);
  $('cAcc').textContent = fmt(GPS.centro.acc,1);
  $('cAlt').textContent = isFinite(GPS.centro.alt)? fmt(GPS.centro.alt,0) : '—';
  $('cN').textContent   = GPS.centro.n;
  $('cNlab').textContent = GPS.centro.n===1 ? 'lettura' : 'letture';
  $('cT').textContent   = GPS.centro.t.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  gpsAvviaWatch();
  disegnaMappa();
}

/* ---------------- posizione continua ---------------- */
function gpsAvviaWatch(){
  if(GPS.watch!==null || GPS.paused) return;
  GPS.watch = navigator.geolocation.watchPosition(function(p){
    const c=p.coords;
    GPS.pos = {lat:c.latitude, lon:c.longitude, acc:c.accuracy||30};
    if(GPS.trailOn){
      const last = GPS.trail[GPS.trail.length-1];
      if(!last || distanzaMetri(last, GPS.pos) > 1.0) GPS.trail.push({lat:GPS.pos.lat, lon:GPS.pos.lon});
      if(GPS.trail.length>600) GPS.trail.shift();
    }
    aggiornaVerdetto();
    disegnaMappa();
  }, function(){}, {enableHighAccuracy:true, maximumAge:1000, timeout:30000});
}
function gpsFermaWatch(){
  if(GPS.watch!==null){ navigator.geolocation.clearWatch(GPS.watch); GPS.watch=null; }
}

function aggiornaVerdetto(){
  if(!GPS.centro || !GPS.pos) return;
  const R = num($('raggio').value);
  const d = distanzaMetri(GPS.centro, GPS.pos);
  const acc = GPS.pos.acc;
  const dentro = d <= R;
  $('verDist').textContent = fmt(d,1);
  $('verR').textContent    = fmt(R,1);
  $('verAcc').textContent  = fmt(acc,1);
  const b=$('verBadge');
  b.textContent = dentro ? 'DENTRO' : 'FUORI';
  b.className = 'verdict-badge ' + (dentro ? 'in' : 'out');
  $('verBox').className = 'verdict ' + (dentro ? 'in' : 'out');

  /* la precisione del sensore è un dato di fatto: va mostrata, non nascosta */
  const margine = Math.abs(d - R);
  $('verHint').innerHTML = (margine < acc)
    ? '<div class="warnbox"><b>Sei nella fascia in cui il GPS non decide.</b> Il confine dista '+
      fmt(margine,1)+' m e l\'incertezza del sensore è ± '+fmt(acc,1)+' m: la posizione vera potrebbe '+
      'stare dall\'altra parte. Misura con la cordella.</div>'
    : (acc > R*0.5
      ? '<div class="warnbox">Precisione GPS scarsa (± '+fmt(acc,1)+' m su un raggio di '+fmt(R,1)+
        ' m). Sotto copertura fitta è normale: prendi il verdetto come indicativo.</div>'
      : '');
}

/* ---------------- mappa ---------------- */
const MAPSVG = 360;
function vistaMetri(){ const R=num($('raggio').value)||13; return R*2.6; }

function disegnaMappa(){
  const svg=$('mapOver'); if(!svg || !GPS.centro) return;
  const lato = vistaMetri(), s = MAPSVG/lato;      // pixel per metro
  const cx=MAPSVG/2, cy=MAPSVG/2;
  const R = num($('raggio').value)||13;
  const P=function(o){ return [cx+o.x*s, cy-o.y*s]; };
  let g='';

  /* cerchio dell'area */
  g+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(R*s)+'" fill="var(--brand)" fill-opacity="0.07" '+
     'stroke="var(--brand)" stroke-width="2.5"/>';
  /* raggio di riferimento e cartiglio */
  g+='<line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+R*s)+'" y2="'+cy+'" stroke="var(--brand)" '+
     'stroke-width="1.2" stroke-dasharray="5 4"/>';
  g+='<text x="'+(cx+R*s/2)+'" y="'+(cy-6)+'" text-anchor="middle" font-size="11" '+
     'fill="var(--brand)" font-weight="700">'+fmt(R,1)+' m</text>';
  /* centro */
  g+='<circle cx="'+cx+'" cy="'+cy+'" r="6" fill="var(--brand)" stroke="#fff" stroke-width="2"/>';

  /* percorso */
  if(GPS.trail.length>1){
    let d='';
    GPS.trail.forEach(function(t,i){ const p=P(offsetMetri(GPS.centro,t));
      d+=(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1); });
    g+='<path d="'+d+'" fill="none" stroke="var(--series-2)" stroke-width="2" '+
       'stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>';
  }

  /* posizione corrente */
  if(GPS.pos){
    const p=P(offsetMetri(GPS.centro,GPS.pos));
    g+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+(GPS.pos.acc*s).toFixed(1)+
       '" fill="var(--series-1)" fill-opacity="0.16" stroke="var(--series-1)" stroke-opacity="0.45" stroke-width="1"/>';
    g+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="7" fill="var(--series-1)" '+
       'stroke="#fff" stroke-width="2.5"/>';
  }

  /* rosa dei venti */
  g+='<g transform="translate('+(MAPSVG-26)+',26)">'+
     '<path d="M0,-14 L5,6 L0,2 L-5,6 Z" fill="var(--text-secondary)"/>'+
     '<text x="0" y="20" text-anchor="middle" font-size="10" fill="var(--text-secondary)" font-weight="700">N</text></g>';

  svg.innerHTML = g;

  /* barra di scala */
  const passi=[1,2,5,10,20,25,50,100];
  let sc=passi[0]; passi.forEach(function(v){ if(v*s < MAPSVG*0.42) sc=v; });
  $('mapScale').innerHTML = '<i style="width:'+(sc*s/MAPSVG*100)+'%"></i><span>'+sc+' m</span>';

  if(GPS.tilesOn) disegnaTiles();
}

/* --- sfondo cartografico: caricato solo su richiesta esplicita --- */
function lon2x(lon,z){ return (lon+180)/360*Math.pow(2,z); }
function lat2y(lat,z){ const r=lat*Math.PI/180;
  return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z); }

function disegnaTiles(){
  const box=$('mapTiles'); if(!box || !GPS.centro) return;
  const z=GPS.tileZ, lato=vistaMetri();
  const k=metriPerGrado(GPS.centro.lat);
  const dLat=(lato/2)/k.lat, dLon=(lato/2)/k.lon;
  const x0=lon2x(GPS.centro.lon-dLon,z), x1=lon2x(GPS.centro.lon+dLon,z);
  const y0=lat2y(GPS.centro.lat+dLat,z), y1=lat2y(GPS.centro.lat-dLat,z);
  const pxPerTile = MAPSVG/(x1-x0);
  const ix0=Math.floor(x0), ix1=Math.floor(x1), iy0=Math.floor(y0), iy1=Math.floor(y1);
  if((ix1-ix0+1)*(iy1-iy0+1) > 30){ return; }
  let html='';
  for(let ix=ix0; ix<=ix1; ix++){
    for(let iy=iy0; iy<=iy1; iy++){
      const left=(ix-x0)*pxPerTile, top=(iy-y0)*pxPerTile;
      html+='<img loading="lazy" alt="" src="https://tile.openstreetmap.org/'+z+'/'+ix+'/'+iy+'.png" '+
            'style="left:'+(left/MAPSVG*100)+'%;top:'+(top/MAPSVG*100)+'%;width:'+
            (pxPerTile/MAPSVG*100)+'%;height:'+(pxPerTile/MAPSVG*100)+'%">';
    }
  }
  box.innerHTML=html;
}

/* ---------------- test di precisione del telefono ---------------- */
const TEST_S = 30;
function gnssAvviaTest(){
  if(!('geolocation' in navigator) || !secureOk()){
    $('gnssRes').hidden=false;
    $('gnssRes').innerHTML='<div class="warnbox">Il test richiede l\'accesso alla posizione e una '+
      'connessione https. Su un computer fisso non è disponibile.</div>';
    return;
  }
  $('gnssTest').disabled=true; $('gnssRun').hidden=false; $('gnssRes').hidden=true;
  const arc=$('tstArc'), C=2*Math.PI*52; arc.style.strokeDasharray=C;
  const t0=performance.now(); const accs=[];
  GPS.testId = navigator.geolocation.watchPosition(function(p){
    if(isFinite(p.coords.accuracy)) accs.push(p.coords.accuracy);
    const best=accs.length?Math.min.apply(null,accs):NaN;
    $('tstBest').textContent = isFinite(best)? '± '+fmt(best,1)+' m' : '—';
  }, function(){}, {enableHighAccuracy:true, maximumAge:0, timeout:35000});

  const tick=setInterval(function(){
    const el=(performance.now()-t0)/1000, f=Math.min(1,el/TEST_S);
    arc.style.strokeDashoffset=C*(1-f);
    $('tstSec').textContent=Math.max(0,Math.ceil(TEST_S-el));
    if(f>=1){
      clearInterval(tick);
      navigator.geolocation.clearWatch(GPS.testId); GPS.testId=null;
      $('gnssRun').hidden=true; $('gnssTest').disabled=false;
      mostraEsitoTest(accs);
    }
  },250);
}

function mostraEsitoTest(accs){
  const box=$('gnssRes'); box.hidden=false;
  if(!accs.length){ box.innerHTML='<div class="warnbox">Nessuna lettura ottenuta. '+
    'Verifica di aver concesso il permesso di posizione e riprova all\'aperto.</div>'; return; }
  const best=Math.min.apply(null,accs);
  const ord=accs.slice().sort(function(a,b){return a-b;});
  const med=ord[Math.floor(ord.length/2)];
  let cls, tit, txt;
  if(best<=3.5){ cls='good'; tit='Molto probabilmente doppia frequenza';
    txt='Una precisione dichiarata di ± '+fmt(best,1)+' m a cielo aperto è tipica dei ricevitori L1+L5. '+
        'Sotto le chiome il tuo telefono resterà fra i più affidabili del gruppo: usalo tu per registrare i centri delle aree.'; }
  else if(best<=6.5){ cls='warn'; tit='Buono, ma probabilmente singola frequenza';
    txt='± '+fmt(best,1)+' m a cielo aperto è un risultato normale per un ricevitore a singola frequenza in buone condizioni. '+
        'In bosco chiuso aspettati un peggioramento marcato: va bene per il centro dell\'area, non per gli alberi al confine.'; }
  else { cls='bad'; tit='Precisione limitata';
    txt='± '+fmt(best,1)+' m già a cielo aperto. Può dipendere dal ricevitore, ma anche da un aggancio ancora incompleto: '+
        'riprova dopo un minuto all\'aperto. Se il risultato si conferma, in bosco questo telefono non è adatto a registrare i centri.'; }
  box.innerHTML =
    '<div class="testres '+cls+'">'+
      '<div class="testres-h">'+tit+'</div>'+
      '<div class="tiles" style="margin:10px 0">'+
        '<div class="tile"><div class="k">Migliore</div><div class="v">'+fmt(best,1)+'</div><div class="u">m</div></div>'+
        '<div class="tile"><div class="k">Mediana</div><div class="v">'+fmt(med,1)+'</div><div class="u">m</div></div>'+
        '<div class="tile"><div class="k">Letture</div><div class="v">'+accs.length+'</div></div>'+
      '</div>'+
      '<p>'+txt+'</p>'+
      '<p class="muted">Il valore è la precisione <i>dichiarata</i> dal sistema operativo, non l\'errore '+
      'realmente commesso: è una stima, e i costruttori sono a volte ottimisti. Vale come confronto fra telefoni, '+
      'non come misura assoluta.</p>'+
    '</div>';
}

/* ---------------- eventi ---------------- */
$('gpsStart').addEventListener('click', gpsRegistraCentro);
$('gpsAgain').addEventListener('click', function(){ gpsFermaWatch(); GPS.trail=[]; gpsRegistraCentro(); });
$('gpsStop').addEventListener('click', function(){ gpsChiudiAcq(); });
$('gpsCopy').addEventListener('click', function(){
  if(!GPS.centro) return;
  const t = GPS.centro.lat.toFixed(6)+', '+GPS.centro.lon.toFixed(6);
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){ alert('Coordinate copiate:\n'+t); });
  else alert(t);
});
$('gpsTrail').addEventListener('click', function(){
  GPS.trailOn=!GPS.trailOn; $('trailState').textContent=GPS.trailOn?'on':'off';
  if(!GPS.trailOn) GPS.trail=[];
  disegnaMappa();
});
$('gpsPause').addEventListener('click', function(){
  GPS.paused=!GPS.paused;
  if(GPS.paused){ gpsFermaWatch(); this.innerHTML='▶ Riattiva GPS'; }
  else { this.innerHTML='⏸ Sospendi GPS'; gpsAvviaWatch(); }
});
$('mapBase').addEventListener('change', function(){
  GPS.tilesOn=this.checked;
  $('mapAttr').hidden=!GPS.tilesOn;
  if(GPS.tilesOn){ $('mapBaseNote').textContent='attivo — scarica le mattonelle da OpenStreetMap'; disegnaTiles(); }
  else { $('mapTiles').innerHTML=''; $('mapBaseNote').textContent='richiede connessione'; }
});
$('gnssTest').addEventListener('click', gnssAvviaTest);
$('raggio').addEventListener('change', function(){ aggiornaVerdetto(); disegnaMappa(); });
</script>

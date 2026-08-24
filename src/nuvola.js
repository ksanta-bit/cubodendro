<script>
"use strict";
/* ============================================================
   PARTE I — INVIO AL FOGLIO GOOGLE DEL DOCENTE

   Il rilievo, su richiesta, viene spedito a un foglio di calcolo
   che sta nel Drive del docente. In mezzo non c'è nessun servizio
   di terzi: solo uno script di Google Apps Script che il docente
   pubblica dal proprio foglio, e che scrive le righe.

   Il punto delicato è che in bosco non c'è campo. Quindi l'invio
   non è mai immediato: il rilievo entra in una CODA che vive nella
   memoria del telefono e riparte da sola appena la rete torna.
   L'allievo tocca «invia» e può dimenticarsene.
   ============================================================ */

const K_NUV  = 'dendrocubo.nuvola.v1';    /* indirizzo e chiave    */
const K_CODA = 'dendrocubo.coda.v1';      /* invii in attesa       */

const NUV = { url:'', chiave:'', coda:[], ultimo:null, inCorso:false, errore:null };

function nuvCarica(){
  try{ const o=JSON.parse(memLeggi(K_NUV)||'null');
       if(o){ NUV.url=o.url||''; NUV.chiave=o.chiave||''; NUV.ultimo=o.ultimo||null; } }catch(e){}
  try{ NUV.coda = JSON.parse(memLeggi(K_CODA)||'[]') || []; }catch(e){ NUV.coda=[]; }
}
function nuvSalvaConf(){
  memScrivi(K_NUV, JSON.stringify({url:NUV.url, chiave:NUV.chiave, ultimo:NUV.ultimo}));
}
function nuvSalvaCoda(){ memScrivi(K_CODA, JSON.stringify(NUV.coda)); }

/* ---------- che cosa si spedisce ----------
   Le stesse misure che vedi nelle schede, appiattite in righe.
   Niente di più: nessun identificativo del telefono, nessuna
   posizione oltre al centro dell'area di saggio se l'hai preso. */
function nuvPacchetto(r){
  const d = r.dati || {};
  const ip = (typeof curvaIpso==='function' && r.id===REG.attivo) ? curvaIpso() : null;
  const alberi = (d.trees||[]).map(function(t,i){
    let h = (t.h!==null && t.h!==undefined) ? t.h : null;
    if(h===null && ip && typeof altezza==='function'){ const x=altezza(t,ip); if(isFinite(x)) h=x; }
    const v = (h && typeof volume==='function') ? volume(t.sp,t.d,h) : null;
    return { n:i+1, ads:t.ads||'', gruppo:t.gr||'', specie:t.sp||'',
             d1:t.d1, d2:(t.d2===null?'':t.d2), d:t.d,
             h_misurata:(t.h===null||t.h===undefined)?'':t.h,
             h_usata:(h===null?'':Number(h.toFixed(2))),
             g:(typeof basimetrica==='function')?Number(basimetrica(t.d).toFixed(5)):'',
             volume:(v===null?'':Number(v.toFixed(4))) };
  });
  const altezze = (d.altezze||[]).map(function(a,i){
    return { n:i+1, riferimento:a.rif||'', metodo:(a.met==='sin'?'seni':'tangenti'),
             dist_base:a.Lb||'', dist_cima:a.Lc||'', dist_orizz:a.D||'',
             angolo_base:a.base, angolo_cima:a.cima, altezza:a.h, incertezza:a.dh };
  });
  const anelli = [];
  (d.cores||[]).forEach(function(c){
    (c.w||[]).forEach(function(w,i){
      anelli.push({ carota:c.id, anno_iniziale:c.y0, n_anello:i+1,
                    anno:(c.y0? c.y0+i : ''), larghezza_mm:w });
    });
  });
  const pendenze = (d.pendenze||[]).map(function(p,i){
    return { n:i+1, gradi:Number(p.toFixed(2)),
             percento:Number((Math.tan(p*Math.PI/180)*100).toFixed(1)) };
  });
  return {
    app:'DendroCubo', v:4, chiave:NUV.chiave,
    inviato: (new Date()).toISOString(),
    rilievo: { id:r.id, nome:r.nome||'', gruppo:(d.gruppo||r.gruppo||''),
               area:(d.ads||''), raggio:(d.raggio||''), soglia:(d.soglia||''),
               creato:r.creato||'', aggiornato:r.aggiornato||'',
               centro_lat:(d.centro?d.centro.lat:''), centro_lon:(d.centro?d.centro.lon:''),
               centro_precisione:(d.centro?d.centro.acc:'') },
    alberi:alberi, altezze:altezze, anelli:anelli, pendenze:pendenze
  };
}

/* ---------- coda ---------- */
function nuvAccoda(r){
  const p = nuvPacchetto(r);
  /* se lo stesso rilievo è già in coda lo si sostituisce: conta l'ultima versione */
  NUV.coda = NUV.coda.filter(function(x){ return x.rilievo.id !== p.rilievo.id; });
  NUV.coda.push(p);
  nuvSalvaCoda(); nuvRender();
  nuvSvuota();
}

async function nuvInvia(p){
  /* text/plain: è una richiesta «semplice», quindi il browser non fa
     la verifica preventiva CORS che Apps Script non saprebbe gestire */
  const res = await fetch(NUV.url, {
    method:'POST', redirect:'follow',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(p)
  });
  if(!res.ok) throw new Error('il foglio ha risposto '+res.status);
  let out=null;
  try{ out = JSON.parse(await res.text()); }catch(e){ out=null; }
  if(out && out.ok===false) throw new Error(out.errore||'rifiutato dal foglio');
  return out;
}

async function nuvSvuota(){
  if(NUV.inCorso || !NUV.coda.length) return;
  if(!NUV.url){ NUV.errore='Manca l\'indirizzo del foglio.'; nuvRender(); return; }
  if(navigator.onLine === false){ NUV.errore=null; nuvRender(); return; }
  NUV.inCorso = true; NUV.errore = null; nuvRender();
  while(NUV.coda.length){
    const p = NUV.coda[0];
    try{
      await nuvInvia(p);
      NUV.coda.shift(); nuvSalvaCoda();
      NUV.ultimo = (new Date()).toISOString(); nuvSalvaConf();
    }catch(e){
      NUV.errore = e.message;
      break;                       /* si riprova più tardi, senza perdere niente */
    }
  }
  NUV.inCorso = false; nuvRender();
}

function nuvRender(){
  const s=$('nuvStato'); if(!s) return;
  const n=NUV.coda.length;
  let t='';
  if(!NUV.url) t='<b>Non configurato.</b> Senza l\'indirizzo del foglio, «Invia al foglio» resta spento.';
  else if(NUV.inCorso) t='Invio in corso…';
  else if(n) t='<b>'+n+(n===1?' rilievo in attesa':' rilievi in attesa')+'.</b> '+
       (navigator.onLine===false
         ? 'Il telefono non ha rete: partono da soli appena la ritrova.'
         : (NUV.errore ? 'Ultimo tentativo non riuscito: '+NUV.errore+'. Si riprova fra poco.'
                       : 'In partenza…'));
  else if(NUV.ultimo) t='✓ Tutto inviato. Ultimo invio riuscito il '+oraBreve(NUV.ultimo)+'.';
  else t='Configurato. Nessun rilievo ancora inviato.';
  s.innerHTML = t;
  s.className = 'note'+(n&&NUV.errore?' warnbox':'');
  if($('nuvUrl') && document.activeElement!==$('nuvUrl')) $('nuvUrl').value = NUV.url;
  if($('nuvChiave') && document.activeElement!==$('nuvChiave')) $('nuvChiave').value = NUV.chiave;
  if($('nuvInvia')) $('nuvInvia').disabled = !NUV.url;
  if($('nuvCoda')) $('nuvCoda').textContent = n;
}

/* ---------- eventi ---------- */
if($('nuvSalva')) $('nuvSalva').addEventListener('click', function(){
  const u = ($('nuvUrl').value||'').trim();
  if(u && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)){
    if(!confirm('L\'indirizzo non ha la forma tipica di uno script pubblicato\n'+
                '(https://script.google.com/macros/s/…/exec).\n\nSalvarlo lo stesso?')) return;
  }
  NUV.url = u; NUV.chiave = ($('nuvChiave').value||'').trim();
  nuvSalvaConf(); NUV.errore=null; nuvRender();
  alert(u ? 'Indirizzo salvato su questo telefono.' : 'Invio al foglio disattivato su questo telefono.');
});

if($('nuvProva')) $('nuvProva').addEventListener('click', async function(){
  if(!NUV.url){ alert('Prima incolla l\'indirizzo del foglio.'); return; }
  const b=this; b.disabled=true; b.textContent='Provo…';
  try{
    await nuvInvia({app:'DendroCubo', v:4, chiave:NUV.chiave, prova:true,
                    inviato:(new Date()).toISOString()});
    alert('Il foglio risponde e accetta la chiave. Nel foglio troverai una riga di prova nella scheda «Invii».');
    NUV.errore=null;
  }catch(e){
    alert('Non ha funzionato: '+e.message+'\n\nControlla che lo script sia pubblicato come applicazione web '+
          'con accesso «Chiunque», e che la chiave coincida.');
  }
  b.disabled=false; b.textContent='Prova il collegamento'; nuvRender();
});

if($('nuvInvia')) $('nuvInvia').addEventListener('click', function(){
  regSalva(true);
  const r = regCorrente(); if(!r) return;
  if(regVuoto(r.dati)){ alert('Il rilievo aperto è vuoto: non c\'è niente da inviare.'); return; }
  nuvAccoda(r);
  const msg = navigator.onLine===false
    ? 'Rilievo messo in coda. Non c\'è rete: partirà da solo appena il telefono la ritrova — puoi chiudere l\'app.'
    : 'Rilievo in partenza verso il foglio del docente.';
  alert(msg);
});

if($('nuvInviaTutti')) $('nuvInviaTutti').addEventListener('click', function(){
  regSalva(true);
  let n=0;
  REG.rilievi.forEach(function(r){ if(!regVuoto(r.dati)){ nuvAccoda(r); n++; } });
  alert(n ? (n+' rilievi messi in coda.') : 'Non c\'è nessun rilievo con dei dati.');
});

/* la coda riparte da sola: quando torna la rete, e comunque ogni minuto */
window.addEventListener('online', function(){ nuvRender(); nuvSvuota(); });
window.addEventListener('offline', nuvRender);
setInterval(function(){ if(NUV.coda.length) nuvSvuota(); }, 60000);

nuvCarica();
nuvRender();
if(NUV.coda.length) setTimeout(nuvSvuota, 3000);
</script>

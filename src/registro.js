<script>
"use strict";
/* ============================================================
   PARTE H — REGISTRO DEI RILIEVI E BLOCCO DOCENTE

   Fino alla 3.4 l'app non conservava nulla: bastava ricaricare la
   pagina per perdere la mattinata. Qui si introduce un registro
   persistente, tenuto nella memoria locale del browser:

     · autosalvataggio ogni 2 s, e comunque quando l'app va in
       secondo piano o viene chiusa;
     · più rilievi separati (una per area di saggio, di norma),
       con nome, gruppo e conteggi;
     · esportazione singola o totale, e riapertura da file;
     · cancellazioni protette da un codice del docente.

   Nessun dato esce dal telefono: non c'è nessun server.
   ============================================================ */

const K_REG = 'dendrocubo.registro.v1';
const K_PIN = 'dendrocubo.blocco.v1';
const SBLOCCO_MS = 10*60*1000;      /* il blocco si richiude da solo */

const REG = { rilievi:[], attivo:null, ultimo:'', salvatoIl:null, sbloccatoFino:0, pin:null };

/* ---------- accesso alla memoria, sempre difensivo ----------
   In navigazione privata, con i dati dei siti bloccati o con la
   memoria piena, localStorage lancia. Non deve mai far cadere l'app. */
function memLeggi(k){
  try{ return window.localStorage.getItem(k); }catch(e){ return null; }
}
function memScrivi(k,v){
  try{ window.localStorage.setItem(k,v); return true; }
  catch(e){
    REG.erroreMem = e && e.name === 'QuotaExceededError'
      ? 'La memoria del browser è piena: esporta e poi elimina qualche rilievo vecchio.'
      : 'Questo browser non permette di salvare in locale (navigazione privata?). Esporta spesso a mano.';
    return false;
  }
}

/* ---------- lo stato di lavoro, fotografato e ripristinato ---------- */
function regStato(){
  return {
    raggio: $('raggio') ? $('raggio').value : null,
    soglia: $('soglia') ? $('soglia').value : null,
    ads:    $('adsName') ? $('adsName').value : '',
    gruppo: $('gruppo') ? $('gruppo').value : '',
    trees:  (typeof S!=='undefined' && S.trees) ? S.trees : [],
    cores:  (typeof S!=='undefined' && S.cores) ? S.cores : [],
    carotaAttiva: (typeof S!=='undefined') ? S.active : null,
    altezze:  (typeof IPS!=='undefined') ? IPS.hist : [],
    pendenze: (typeof IPS!=='undefined') ? IPS.pend : [],
    centro:   (typeof GPS!=='undefined' && GPS.centro) ? GPS.centro : null
  };
}
function regApplica(d){
  if(!d) return;
  if(d.raggio && $('raggio')) $('raggio').value = d.raggio;
  if(d.soglia && $('soglia')) $('soglia').value = d.soglia;
  if($('adsName')) $('adsName').value = d.ads || '';
  if($('gruppo'))  $('gruppo').value  = d.gruppo || '';
  if(typeof S!=='undefined'){
    S.trees = d.trees || []; S.cores = d.cores || [];
    S.active = d.carotaAttiva || (S.cores.length ? S.cores[0].id : null);
  }
  if(typeof IPS!=='undefined'){
    IPS.hist = d.altezze || []; IPS.pend = d.pendenze || [];
  }
  if(typeof GPS!=='undefined' && d.centro) GPS.centro = d.centro;
  if(typeof redrawAll==='function') redrawAll();
  if(typeof ipsRenderHist==='function') ipsRenderHist();
  if(typeof pendRender==='function') pendRender();
  if(typeof disegnaMappa==='function'){ try{ disegnaMappa(); }catch(e){} }
}
function regConta(d){
  d = d || {};
  return { alb:(d.trees||[]).length, alt:(d.altezze||[]).length,
           car:(d.cores||[]).length, pen:(d.pendenze||[]).length };
}
function regVuoto(d){ const c=regConta(d); return !(c.alb||c.alt||c.car||c.pen); }

/* ---------- persistenza ---------- */
function regNuovoId(){
  return 'r' + (new Date()).getTime().toString(36) +
         Math.floor(Math.random()*1e4).toString(36);
}
function regCorrente(){
  return REG.rilievi.filter(function(r){ return r.id===REG.attivo; })[0] || null;
}
function regCarica(){
  let o=null;
  try{ o = JSON.parse(memLeggi(K_REG)||'null'); }catch(e){ o=null; }
  if(o && Array.isArray(o.rilievi) && o.rilievi.length){
    REG.rilievi = o.rilievi; REG.attivo = o.attivo || o.rilievi[0].id;
  } else {
    REG.rilievi = [{ id:regNuovoId(), nome:'Rilievo 1', creato:oraISO(),
                     aggiornato:oraISO(), dati:null }];
    REG.attivo = REG.rilievi[0].id;
  }
  const r = regCorrente();
  if(r && r.dati) regApplica(r.dati);
  REG.ultimo = JSON.stringify(regStato());
}
function oraISO(){ return (new Date()).toISOString(); }
function oraBreve(iso){
  if(!iso) return '—';
  const d=new Date(iso);
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '+
         String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function regSalva(forza){
  const s = regStato();
  const j = JSON.stringify(s);
  if(!forza && j===REG.ultimo) return false;      /* niente di cambiato */
  const r = regCorrente(); if(!r) return false;
  r.dati = s; r.aggiornato = oraISO();
  r.gruppo = s.gruppo || r.gruppo || '';
  const ok = memScrivi(K_REG, JSON.stringify({v:1, rilievi:REG.rilievi, attivo:REG.attivo}));
  REG.ultimo = j;
  if(ok){ REG.salvatoIl = new Date(); REG.erroreMem = null; }
  regRender();
  return ok;
}

/* ---------- blocco docente ----------
   Il codice è conservato come impronta SHA-256: non si legge in chiaro
   dalla memoria. Resta però un lucchetto, non una cassaforte — chi
   svuota i dati del sito dalle impostazioni del browser porta via
   tutto comunque, ed è scritto chiaramente nella scheda. */
async function impronta(testo){
  try{
    const b = new TextEncoder().encode('dendrocubo:'+testo);
    const h = await crypto.subtle.digest('SHA-256', b);
    return Array.from(new Uint8Array(h)).map(function(x){ return x.toString(16).padStart(2,'0'); }).join('');
  }catch(e){
    /* ripiego se crypto.subtle non c'è: impronta debole, ma il ruolo è lo stesso */
    let h=5381; for(let i=0;i<testo.length;i++) h=((h*33)^testo.charCodeAt(i))>>>0;
    return 'x'+h.toString(16);
  }
}
function bloccoCarica(){
  let o=null;
  try{ o = JSON.parse(memLeggi(K_PIN)||'null'); }catch(e){ o=null; }
  REG.pin = (o && o.pin) ? o.pin : null;
  REG.sbloccatoFino = 0;                      /* a ogni avvio si riparte chiusi */
}
function bloccoAttivo(){ return !!REG.pin; }
function bloccoAperto(){
  return !REG.pin || (new Date()).getTime() < REG.sbloccatoFino;
}
async function bloccoChiedi(motivo){
  if(bloccoAperto()) return true;
  const p = prompt((motivo||'Serve il codice del docente.')+'\n\nCodice:');
  if(p===null) return false;
  const h = await impronta(p.trim());
  if(h===REG.pin){
    REG.sbloccatoFino = (new Date()).getTime()+SBLOCCO_MS;
    bloccoRender();
    return true;
  }
  alert('Codice errato.');
  return false;
}
function bloccoRender(){
  const off=$('bloccoOff'), on=$('bloccoOn');
  if(!off||!on) return;
  off.hidden = bloccoAttivo(); on.hidden = !bloccoAttivo();
  if(!bloccoAttivo()) return;
  const ap = bloccoAperto();
  const box=$('bloccoStato'), b=$('bloccoBadge');
  box.className = 'verdict '+(ap?'in':'out');
  b.className = 'verdict-badge '+(ap?'in':'out');
  b.textContent = ap ? 'SBLOCCATO' : 'BLOCCATO';
  const min = ap ? Math.max(0,Math.round((REG.sbloccatoFino-(new Date()).getTime())/60000)) : 0;
  $('bloccoTesto').textContent = ap
    ? 'Le cancellazioni sono permesse ancora per circa '+min+' minuti, poi il blocco si richiude da solo.'
    : 'Nessuno può cancellare dati senza il codice. Le misure si prendono normalmente.';
}

/* ---------- il guardiano delle cancellazioni ----------
   Intercetta il clic in fase di cattura, cioè PRIMA che arrivi al
   gestore che cancella: così non serve modificare ogni pulsante. */
const PROTETTI = ['#clrCub','#ipsClr','#pendClr','#regDel','[data-del]',
                  '[data-ipsdel]','[data-pdel]','[data-regdel]'];
document.addEventListener('click', function(e){
  if(!bloccoAttivo() || bloccoAperto()) return;
  const t = e.target.closest ? e.target.closest(PROTETTI.join(',')) : null;
  if(!t) return;
  e.preventDefault(); e.stopImmediatePropagation();
  bloccoChiedi('Per cancellare dei dati serve il codice del docente.').then(function(ok){
    if(ok) alert('Sbloccato. Tocca di nuovo per confermare la cancellazione.');
  });
}, true);

/* ---------- interfaccia del registro ---------- */
function regRender(){
  const r = regCorrente();
  const c = regConta(r ? r.dati : null);
  if($('regNome')) $('regNome').textContent = r ? r.nome : '—';
  if($('regSub'))  $('regSub').textContent  = r
      ? ((r.gruppo?r.gruppo+' · ':'')+'aperto il '+oraBreve(r.creato))
      : 'nessun rilievo';
  if($('regNAlb')) $('regNAlb').textContent = c.alb;
  if($('regNAlt')) $('regNAlt').textContent = c.alt;
  if($('regNCar')) $('regNCar').textContent = c.car;
  if($('regNPen')) $('regNPen').textContent = c.pen;

  const sv=$('regSave');
  if(sv){
    if(REG.erroreMem){ sv.textContent='⚠ non salvato'; sv.title=REG.erroreMem; sv.className='regsave ko'; }
    else if(REG.salvatoIl){
      sv.textContent='✓ salvato '+String(REG.salvatoIl.getHours()).padStart(2,'0')+':'+
        String(REG.salvatoIl.getMinutes()).padStart(2,'0')+':'+
        String(REG.salvatoIl.getSeconds()).padStart(2,'0');
      sv.className='regsave ok'; sv.title='';
    } else { sv.textContent='in attesa di dati'; sv.className='regsave'; }
  }
  if(REG.erroreMem && $('regErr')) $('regErr').textContent = REG.erroreMem;

  const t=$('regTab'); if(!t) return;
  let h='<tr><th style="text-align:left">Rilievo</th><th>Alberi</th><th>Alt.</th><th>Car.</th>'+
        '<th>Aggiornato</th><th></th></tr>';
  REG.rilievi.forEach(function(x){
    const k=regConta(x.dati), att = x.id===REG.attivo;
    h+='<tr'+(att?' style="background:var(--brand-soft)"':'')+'>'+
       '<td style="text-align:left">'+(att?'<b>▸ ':'')+x.nome+(att?'</b>':'')+
         (x.gruppo?'<br><span class="muted">'+x.gruppo+'</span>':'')+'</td>'+
       '<td>'+k.alb+'</td><td>'+k.alt+'</td><td>'+k.car+'</td>'+
       '<td>'+oraBreve(x.aggiornato)+'</td>'+
       '<td>'+(att?'<span class="muted">aperto</span>'
                 :'<button class="chip" data-regopen="'+x.id+'">apri</button>')+
         ' <button class="chip" data-regdel="'+x.id+'" style="color:var(--bad)">✕</button></td></tr>';
  });
  t.innerHTML=h;
  t.querySelectorAll('button[data-regopen]').forEach(function(b){
    b.addEventListener('click', function(){ regApri(b.dataset.regopen); });
  });
  t.querySelectorAll('button[data-regdel]').forEach(function(b){
    b.addEventListener('click', function(){ regElimina(b.dataset.regdel); });
  });
}

function regApri(id){
  if(id===REG.attivo) return;
  regSalva(true);                                  /* prima si mette al sicuro quello aperto */
  REG.attivo = id;
  const r = regCorrente();
  regApplica(r ? r.dati : null);
  if(!r || !r.dati) regApplica({trees:[],cores:[],altezze:[],pendenze:[]});
  REG.ultimo = JSON.stringify(regStato());
  memScrivi(K_REG, JSON.stringify({v:1, rilievi:REG.rilievi, attivo:REG.attivo}));
  regRender();
  alert('Aperto: '+(r?r.nome:'—')+'.\nLe schede Cubatura, Altezza e Anelli ora mostrano i suoi dati.');
}

function regElimina(id){
  const x = REG.rilievi.filter(function(r){ return r.id===id; })[0];
  if(!x) return;
  const k=regConta(x.dati);
  if(!confirm('Eliminare «'+x.nome+'»?\n\n'+k.alb+' alberi, '+k.alt+' altezze, '+k.car+
              ' carote.\n\nL\'operazione non si può annullare.')) return;
  REG.rilievi = REG.rilievi.filter(function(r){ return r.id!==id; });
  if(!REG.rilievi.length){
    REG.rilievi=[{id:regNuovoId(), nome:'Rilievo 1', creato:oraISO(), aggiornato:oraISO(), dati:null}];
  }
  if(REG.attivo===id){
    REG.attivo = REG.rilievi[0].id;
    regApplica(REG.rilievi[0].dati || {trees:[],cores:[],altezze:[],pendenze:[]});
    REG.ultimo = JSON.stringify(regStato());
  }
  memScrivi(K_REG, JSON.stringify({v:1, rilievi:REG.rilievi, attivo:REG.attivo}));
  regRender();
}

/* ---------- eventi ---------- */
if($('regNuovo')) $('regNuovo').addEventListener('click', function(){
  regSalva(true);
  const prec = regCorrente();
  const n = prompt('Nome del nuovo rilievo:', 'Rilievo '+(REG.rilievi.length+1));
  if(n===null) return;
  const r = { id:regNuovoId(), nome:n.trim()||('Rilievo '+(REG.rilievi.length+1)),
              gruppo: prec ? (prec.gruppo||'') : '', creato:oraISO(), aggiornato:oraISO(), dati:null };
  REG.rilievi.push(r); REG.attivo = r.id;
  /* il raggio e il gruppo si ereditano: cambia l'area, non la squadra */
  const raggio = $('raggio') ? $('raggio').value : null;
  regApplica({trees:[],cores:[],altezze:[],pendenze:[],raggio:raggio,
              gruppo: r.gruppo, ads:r.nome});
  REG.ultimo=''; regSalva(true);
});

if($('regRinomina')) $('regRinomina').addEventListener('click', function(){
  const r = regCorrente(); if(!r) return;
  const n = prompt('Nome del rilievo:', r.nome);
  if(n===null) return;
  r.nome = n.trim() || r.nome;
  regSalva(true);
});

function regNomeFile(s){ return String(s||'rilievo').replace(/[^\wàèéìòùÀÈÉÌÒÙ -]/g,'').replace(/\s+/g,'_'); }

if($('regEsporta')) $('regEsporta').addEventListener('click', function(){
  regSalva(true);
  const r = regCorrente(); if(!r) return;
  download('rilievo_'+regNomeFile(r.nome)+'_'+stamp()+'.json',
    JSON.stringify({app:'DendroCubo', v:1, esportato:oraISO(), rilievi:[r]}, null, 1),
    'application/json');
});
if($('regEsportaTutto')) $('regEsportaTutto').addEventListener('click', function(){
  regSalva(true);
  download('registro_dendrocubo_'+stamp()+'.json',
    JSON.stringify({app:'DendroCubo', v:1, esportato:oraISO(), rilievi:REG.rilievi}, null, 1),
    'application/json');
});
if($('regImporta')) $('regImporta').addEventListener('change', function(e){
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=function(){
    try{
      const o=JSON.parse(rd.result);
      let entranti = [];
      if(o && Array.isArray(o.rilievi)) entranti = o.rilievi;
      else if(o && (o.trees||o.cores))                     /* vecchio file di sessione */
        entranti = [{ id:regNuovoId(), nome:'Sessione importata', creato:oraISO(), aggiornato:oraISO(),
                      dati:{trees:o.trees||[], cores:o.cores||[], raggio:o.raggio, soglia:o.soglia,
                            altezze:[], pendenze:[]} }];
      if(!entranti.length){ alert('Nel file non ci sono rilievi.'); return; }
      let nuovi=0;
      entranti.forEach(function(r){
        if(!r || !r.id) return;
        if(REG.rilievi.some(function(x){ return x.id===r.id; })){
          r = Object.assign({}, r, {id:regNuovoId(), nome:(r.nome||'Rilievo')+' (copia)'});
        }
        REG.rilievi.push(r); nuovi++;
      });
      memScrivi(K_REG, JSON.stringify({v:1, rilievi:REG.rilievi, attivo:REG.attivo}));
      regRender();
      alert('Importati '+nuovi+' rilievi. Aprili dall\'elenco qui sopra.');
    }catch(err){ alert('File non leggibile: '+err.message); }
  };
  rd.readAsText(f); e.target.value='';
});
if($('regDel')) $('regDel').addEventListener('click', function(){ regElimina(REG.attivo); });

/* blocco */
if($('bloccoImposta')) $('bloccoImposta').addEventListener('click', async function(){
  const p = ($('bloccoPin').value||'').trim();
  if(!/^\d{4,8}$/.test(p)){ alert('Il codice deve essere da 4 a 8 cifre.'); return; }
  REG.pin = await impronta(p);
  memScrivi(K_PIN, JSON.stringify({pin:REG.pin}));
  REG.sbloccatoFino = (new Date()).getTime()+SBLOCCO_MS;
  $('bloccoPin').value='';
  bloccoRender();
  alert('Blocco attivo. Segnati il codice: se lo dimentichi, l\'unico modo per riavere le cancellazioni '+
        'è togliere il blocco svuotando i dati del sito dalle impostazioni del browser — e con quelli se ne '+
        'vanno anche i rilievi. Esporta, per prudenza.');
});
if($('bloccoSblocca')) $('bloccoSblocca').addEventListener('click', function(){
  bloccoChiedi('Inserisci il codice del docente per sbloccare.');
});
if($('bloccoBlocca')) $('bloccoBlocca').addEventListener('click', function(){
  REG.sbloccatoFino=0; bloccoRender();
});
if($('bloccoRimuovi')) $('bloccoRimuovi').addEventListener('click', async function(){
  if(!await bloccoChiedi('Inserisci il codice per togliere il blocco.')) return;
  REG.pin=null; REG.sbloccatoFino=0;
  try{ window.localStorage.removeItem(K_PIN); }catch(e){}
  bloccoRender();
});

/* ---------- autosalvataggio ---------- */
regCarica();
bloccoCarica();
regRender();
bloccoRender();
setInterval(function(){ regSalva(false); }, 2000);
setInterval(bloccoRender, 30000);
document.addEventListener('visibilitychange', function(){ if(document.hidden) regSalva(true); });
window.addEventListener('pagehide', function(){ regSalva(true); });
</script>

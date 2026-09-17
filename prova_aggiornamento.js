/* Prova dell'aggiornamento: i dati registrati sul telefono con la
   versione precedente devono sopravvivere al passaggio alla nuova.
   Uso: node prova_aggiornamento.js <cartella_vecchia> <cartella_nuova>
   Serve le due versioni, una dopo l'altra, sullo STESSO indirizzo
   (come succede con GitHub Pages) e con lo stesso profilo di browser. */
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const VECCHIA = process.argv[2], NUOVA = process.argv[3];
const PORTA = 8897, URL = 'http://localhost:'+PORTA+'/index.html';
const out=[]; let ko=0;
function ok(k,c,e){ if(!c) ko++; out.push((c?'  ok  ':'  KO  ')+k+(e?'   ['+e+']':'')); }

let radice = VECCHIA;
const tipi = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.webmanifest':'application/manifest+json',
              '.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml'};
const srv = http.createServer((q,r)=>{
  let f = decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f += 'index.html';
  const p = path.join(radice, f);
  fs.readFile(p, (e,d)=>{
    if(e){ r.writeHead(404); r.end(); return; }
    /* come GitHub Pages: il browser può tenere i file 10 minuti */
    r.writeHead(200, {'Content-Type': tipi[path.extname(p)]||'application/octet-stream', 'Cache-Control':'max-age=600'});
    r.end(d);
  });
});

(async ()=>{
  await new Promise(r=>srv.listen(PORTA, r));
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:390,height:844}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('dialog', async d=>{ await d.accept(d.type()==='prompt'?'AdS 2':''); });

  /* ---- 1. versione vecchia: si installa e si registrano dati ---- */
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(2500);
  const vVecchia = await p.evaluate(()=>{ const m=document.body.textContent.match(/DendroCubo\s*—\s*versione\s+([\d.]+\d)/); return m&&m[1]; });
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.locator('nav button[data-tab="cub"]').click();
  for(const d of [42,37,51]){ await p.fill('#d1',String(d)); await p.fill('#hm','26'); await p.$eval('#addTree',e=>e.click()); await p.waitForTimeout(60); }
  await p.fill('#adsName','AdS 1 Domegge'); await p.fill('#gruppo','Gruppo Larici');
  /* un'altezza e una pendenza nello storico, come dopo una mattinata di lavoro */
  await p.evaluate(()=>{
    IPS.hist.push({met:'tan',D:25,Lb:25.1,Lc:31.7,derivata:false,base:-6,cima:38,h:22.16,dh:0.9,rif:'AdS 1 · n. 7'});
    IPS.pend.push(24.5); ipsRenderHist(); pendRender();
  });
  await p.waitForTimeout(2600);                     /* autosalvataggio */
  /* un secondo rilievo */
  await p.locator('nav button[data-tab="dat"]').click(); await p.waitForTimeout(200);
  await p.$eval('#regNuovo',e=>e.click()); await p.waitForTimeout(600);
  await p.locator('nav button[data-tab="cub"]').click();
  await p.fill('#d1','33'); await p.fill('#hm','19'); await p.$eval('#addTree',e=>e.click());
  await p.waitForTimeout(2600);
  const prima = await p.evaluate(()=>{ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); o[k]=localStorage.getItem(k);} return o; });
  const cachePrima = await p.evaluate(()=>caches.keys());
  ok('versione di partenza '+vVecchia+', cache '+cachePrima.join(','), !!vVecchia);
  const reg = JSON.parse(prima['dendrocubo.registro.v1']||'null');
  ok('dati registrati con la vecchia versione: 2 rilievi', reg && reg.rilievi.length===2);

  /* ---- 2. il docente pubblica la nuova versione ---- */
  radice = NUOVA;
  /* il telefono riapre l'app più volte, come farebbe un allievo */
  for(let i=0;i<3;i++){ await p.reload({waitUntil:'load'}); await p.waitForTimeout(2500); }
  const vNuova = await p.evaluate(()=>{ const m=document.body.textContent.match(/DendroCubo\s*—\s*versione\s+([\d.]+\d)/); return m&&m[1]; });
  const cacheDopo = await p.evaluate(()=>caches.keys());
  ok('il telefono è passato alla nuova versione', vNuova!==vVecchia, vVecchia+' → '+vNuova);
  ok('la cache vecchia è stata sostituita', cacheDopo.length===1 && cacheDopo[0]!==cachePrima[0], cacheDopo.join(','));

  const dopo = await p.evaluate(()=>{ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); o[k]=localStorage.getItem(k);} return o; });
  ok('stesse chiavi di memoria', JSON.stringify(Object.keys(prima).sort())===JSON.stringify(Object.keys(dopo).sort()),
     Object.keys(dopo).join(','));
  const r1 = JSON.parse(prima['dendrocubo.registro.v1']), r2 = JSON.parse(dopo['dendrocubo.registro.v1']);
  const soloDati = r => r.rilievi.map(x=>({id:x.id,nome:x.nome,dati:x.dati}));
  ok('il registro è identico, rilievo per rilievo', JSON.stringify(soloDati(r1))===JSON.stringify(soloDati(r2)));

  /* e l'app li mostra davvero */
  await p.locator('nav button[data-tab="dat"]').click(); await p.waitForTimeout(300);
  ok('in elenco ci sono ancora 2 rilievi', (await p.locator('#regTab button[data-regopen], #regTab button[data-regdel]').count())>=2);
  await p.locator('#regTab button[data-regopen]').first().click(); await p.waitForTimeout(700);
  await p.locator('nav button[data-tab="cub"]').click(); await p.waitForTimeout(300);
  ok('il primo rilievo ha ancora i suoi 3 alberi', (await p.locator('#tN').textContent()).trim()==='3');
  ok('e il nome dell\'area di saggio', (await p.inputValue('#adsName'))==='AdS 1 Domegge');
  const alt = await p.evaluate(()=>IPS.hist.length+'/'+IPS.pend.length);
  ok('lo storico delle altezze e delle pendenze è intatto', alt==='1/1', alt);
  ok('nessun errore JavaScript', errs.length===0, errs.join(' | '));

  /* offline: la nuova versione funziona senza rete */
  await ctx.setOffline(true);
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(1500);
  const vOff = await p.evaluate(()=>{ const m=document.body.textContent.match(/DendroCubo\s*—\s*versione\s+([\d.]+\d)/); return m&&m[1]; });
  ok('senza rete si apre la nuova versione', vOff===vNuova, vOff);

  await b.close(); srv.close();
  console.log(out.join('\n'));
  console.log(ko ? '>>> '+ko+' PROVE FALLITE' : '>>> TUTTO OK');
})();

const {chromium}=require('playwright');
const URL='http://localhost:8899/index.html';
const out=[]; function ok(k,c,e){ out.push((c?'  ok  ':'  KO  ')+k+(e?'   ['+e+']':'')); }
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:412,height:900},acceptDownloads:true});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  p.on('dialog', async d=>{ await d.accept(d.type()==='prompt'?'AdS 2':''); });

  // finto endpoint del foglio Google
  await ctx.route('https://script.google.com/**', async route=>{
    const body = route.request().postData()||'';
    const j = JSON.parse(body);
    if(j.chiave!=='domegge2026')
      return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({ok:false,errore:'chiave errata'})});
    global.__ricevuti = (global.__ricevuti||[]).concat([j]);
    route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({ok:true,messaggio:'ok'})});
  });

  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(2700);
  await p.locator('nav button[data-tab="cub"]').click();
  for(const d of [42,37,51]){ await p.fill('#d1',String(d)); await p.fill('#hm','26'); await p.locator('#addTree').click(); await p.waitForTimeout(60); }
  await p.waitForTimeout(2400);

  await p.locator('nav button[data-tab="dat"]').click(); await p.waitForTimeout(300);

  // --- configurazione dell'invio
  await p.locator('summary:has-text("Configurazione")').click();
  await p.fill('#nuvUrl','https://script.google.com/macros/s/AKfycbxTEST/exec');
  await p.fill('#nuvChiave','domegge2026');
  await p.locator('#nuvSalva').click(); await p.waitForTimeout(300);
  ok('la configurazione si salva', (await p.locator('#nuvStato').textContent()).indexOf('Configurato')>=0);

  // --- prova del collegamento
  await p.locator('#nuvProva').click(); await p.waitForTimeout(900);
  ok('la prova del collegamento passa', (global.__ricevuti||[]).some(x=>x.prova===true));

  // --- invio del rilievo
  await p.locator('#nuvInvia').click(); await p.waitForTimeout(1500);
  const pack=(global.__ricevuti||[]).filter(x=>!x.prova).pop();
  ok('il rilievo arriva al foglio', !!pack);
  ok('con i tre alberi', pack && pack.alberi.length===3, pack?String(pack.alberi.length):'-');
  ok('con volume e area basimetrica calcolati', pack && pack.alberi[0].volume>0 && pack.alberi[0].g>0,
     pack?('V='+pack.alberi[0].volume+' g='+pack.alberi[0].g):'-');
  ok('la coda si svuota', (await p.locator('#nuvStato').textContent()).indexOf('Tutto inviato')>=0);

  // --- OFFLINE: deve accodare, non perdere
  await ctx.setOffline(true);
  await p.evaluate(()=>window.dispatchEvent(new Event('offline')));
  await p.locator('nav button[data-tab="cub"]').click();
  await p.fill('#d1','33'); await p.fill('#hm','24'); await p.locator('#addTree').click();
  await p.waitForTimeout(2400);
  await p.locator('nav button[data-tab="dat"]').click(); await p.waitForTimeout(200);
  await p.locator('#nuvInvia').click(); await p.waitForTimeout(600);
  const st = await p.locator('#nuvStato').textContent();
  ok('senza rete resta in coda', /in attesa/.test(st), st.trim().slice(0,60));

  // --- torna la rete: deve ripartire da solo
  const prima=(global.__ricevuti||[]).length;
  await ctx.setOffline(false);
  await p.evaluate(()=>window.dispatchEvent(new Event('online')));
  await p.waitForTimeout(1600);
  ok('tornata la rete riparte da sola', (global.__ricevuti||[]).length>prima);
  ok('e il quarto albero c\'e', (global.__ricevuti||[]).pop().alberi.length===4);

  // --- chiave sbagliata: rifiuto pulito, niente perdita
  await p.fill('#nuvChiave','sbagliata'); await p.locator('#nuvSalva').click(); await p.waitForTimeout(200);
  await p.locator('#nuvInvia').click(); await p.waitForTimeout(1200);
  const st2 = await p.locator('#nuvStato').textContent();
  ok('chiave sbagliata: lo dice e tiene il dato', /chiave errata/i.test(st2), st2.trim().slice(0,70));

  // --- CSV di classe
  const dl = await Promise.all([p.waitForEvent('download'), p.locator('#csvAlberi').click()]);
  const path = await dl[0].path();
  const fs=require('fs'); const csv=fs.readFileSync(path,'utf8');
  ok('il CSV alberi ha intestazione e 4 righe', csv.split('\n').filter(l=>l.trim()).length===5,
     csv.split('\n')[0].slice(0,40));
  ok('il CSV porta rilievo e gruppo', /^\ufeff?rilievo;gruppo/.test(csv));

  console.log(out.join('\n'));
  console.log('ERRORI JS: '+(errs.length?errs.join(' | '):'nessuno'));
  console.log(out.some(x=>x.startsWith('  KO'))?'>>> QUALCOSA NON VA':'>>> TUTTO OK');
  await b.close();
})();

const {chromium}=require('playwright');
const URL='http://localhost:8899/index.html';
const out=[]; function ok(k,c,e){ out.push((c?'  ok  ':'  KO  ')+k+(e?'   ['+e+']':'')); }
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:412,height:900}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  const dialoghi=[]; p.on('dialog', async d=>{ dialoghi.push(d.message()); await d.accept(d.type()==='prompt'?'AdS 2':''); });
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(2700);

  ok('l\'app si chiama DendroCubo', (await p.title()).indexOf('DendroCubo')===0, await p.title());

  // inserisco due alberi
  await p.locator('nav button[data-tab="cub"]').click();
  for(const d of [42,37]){ await p.fill('#d1',String(d)); await p.fill('#hm','26'); await p.locator('#addTree').click(); await p.waitForTimeout(60); }
  await p.waitForTimeout(2600);            // lascio scattare l'autosalvataggio

  await p.locator('nav button[data-tab="dat"]').click(); await p.waitForTimeout(300);
  ok('il registro conta gli alberi', (await p.locator('#regNAlb').textContent()).trim()==='2');
  const salv = await p.locator('#regSave').textContent();
  ok('dice quando ha salvato', /salvato \d\d:/.test(salv), salv.trim());

  // RICARICO: e' la prova che conta
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(2700);
  await p.locator('nav button[data-tab="cub"]').click(); await p.waitForTimeout(300);
  const n = await p.locator('#tN').textContent();
  ok('dopo un ricaricamento gli alberi ci sono ancora', n.trim()==='2', n);

  // nuovo rilievo
  await p.locator('nav button[data-tab="dat"]').click(); await p.waitForTimeout(200);
  await p.locator('#regNuovo').click(); await p.waitForTimeout(600);
  ok('il nuovo rilievo parte vuoto', (await p.locator('#regNAlb').textContent()).trim()==='0');
  ok('in elenco ci sono due rilievi', (await p.locator('#regTab button[data-regdel]').count())===2);

  // torno al primo
  await p.locator('#regTab button[data-regopen]').first().click(); await p.waitForTimeout(600);
  ok('riaprendo il primo tornano i suoi alberi', (await p.locator('#regNAlb').textContent()).trim()==='2');

  // BLOCCO DOCENTE
  await p.fill('#bloccoPin','1830');
  await p.locator('#bloccoImposta').click(); await p.waitForTimeout(400);
  ok('il blocco si attiva', await p.locator('#bloccoOn').isVisible());
  await p.locator('#bloccoBlocca').click(); await p.waitForTimeout(200);
  ok('e si puo richiudere', (await p.locator('#bloccoBadge').textContent()).trim()==='BLOCCATO');

  // con il blocco chiuso, la cancellazione deve essere rifiutata
  const primaDelClic = await p.locator('#regTab button[data-regdel]').count();
  await p.locator('#regTab button[data-regdel]').last().click(); await p.waitForTimeout(500);
  ok('bloccato: la cancellazione non passa',
     (await p.locator('#regTab button[data-regdel]').count())===primaDelClic);
  ok('e chiede il codice', dialoghi.some(m=>/codice del docente/i.test(m)));

  // sblocco con il codice giusto -> ora cancella
  p.removeAllListeners('dialog');
  p.on('dialog', async d=>{ const m=d.message();
    if(d.type()==='prompt' && /odice/.test(m)) await d.accept('1830'); else await d.accept(); });
  await p.locator('#bloccoSblocca').click(); await p.waitForTimeout(500);
  ok('col codice giusto si sblocca', (await p.locator('#bloccoBadge').textContent()).trim()==='SBLOCCATO');
  await p.locator('#regTab button[data-regdel]').last().click(); await p.waitForTimeout(600);
  ok('sbloccato: la cancellazione passa',
     (await p.locator('#regTab button[data-regdel]').count())===primaDelClic-1);

  // il codice sbagliato non deve sbloccare
  await p.locator('#bloccoBlocca').click(); await p.waitForTimeout(200);
  p.removeAllListeners('dialog');
  let rifiutato=false;
  p.on('dialog', async d=>{ const m=d.message();
    if(/errato/i.test(m)) rifiutato=true;
    if(d.type()==='prompt') await d.accept('9999'); else await d.accept(); });
  await p.locator('#bloccoSblocca').click(); await p.waitForTimeout(500);
  ok('il codice sbagliato viene rifiutato', rifiutato && (await p.locator('#bloccoBadge').textContent()).trim()==='BLOCCATO');

  console.log(out.join('\n'));
  console.log('ERRORI JS: '+(errs.length?errs.join(' | '):'nessuno'));
  console.log(out.some(x=>x.startsWith('  KO'))?'>>> QUALCOSA NON VA':'>>> TUTTO OK');
  await b.close();
})();

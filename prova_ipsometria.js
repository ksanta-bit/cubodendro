const {chromium} = require('playwright');
const URL='http://localhost:8899/index.html';
const out=[];
function ok(k,cond,extra){ out.push((cond?'  ok  ':'  KO  ')+k+(extra?'   ['+extra+']':'')); }

(async ()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:412,height:900}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  p.on('dialog', async d=>{ out.push('  ··  finestra: '+d.message().split('\n')[0].slice(0,70)); await d.accept(); });
  await p.goto(URL,{waitUntil:'load'});
  await p.waitForTimeout(2600);

  // simulatore di accelerometro
  await p.exposeFunction('nulla',()=>{});
  await p.addScriptTag({content:`
    window.__mira = function(alphaDeg, n){
      const g=9.81, a=alphaDeg*Math.PI/180;
      for(let i=0;i<(n||300);i++){
        const e=new Event('devicemotion');
        e.accelerationIncludingGravity={x:0,y:g*Math.cos(a),z:-g*Math.sin(a)};
        window.dispatchEvent(e);
      }
    };
    window.__pendio = function(betaDeg, n){
      const g=9.81, b=betaDeg*Math.PI/180;
      for(let i=0;i<(n||300);i++){
        const e=new Event('devicemotion');
        e.accelerationIncludingGravity={x:0,y:g*Math.sin(b),z:g*Math.cos(b)};
        window.dispatchEvent(e);
      }
    };
    window.__streamMira = function(alphaDeg, ms){
      const t=setInterval(function(){ window.__mira(alphaDeg, 4); }, 25);
      setTimeout(function(){ clearInterval(t); }, ms);
    };
    /* il sensore vero manda dati in continuo: qui lo si imita */
    window.__stream = function(betaDeg, ms){
      const t=setInterval(function(){ window.__pendio(betaDeg, 4); }, 30);
      setTimeout(function(){ clearInterval(t); }, ms);
    };
  `});

  await p.locator('nav button[data-tab="ips"]').click(); await p.waitForTimeout(200);
  await p.locator('#ipsStart').click(); await p.waitForTimeout(400);

  ok('le tre schede compaiono dopo l\'attivazione',
     await p.locator('#ipsCard2').isVisible() && await p.locator('#ipsCardPend').isVisible() && await p.locator('#ipsCard3').isVisible());
  ok('il mirino è nella scheda di misura, non altrove',
     await p.locator('#ipsCard2 #camWrap').count()===1);
  ok('lo smorzamento parte su «Stabile»', (await p.locator('#ipsSmorz').inputValue())==='0.035');

  // --- lettura angolo
  await p.selectOption('#ipsSmorz','0.28');
  await p.evaluate(()=>window.__mira(30,400));
  await p.waitForTimeout(120);
  const ang = await p.locator('#ipsAng').textContent();
  ok('l\'inclinometro legge 30°', /30,0|29,9|30,1/.test(ang), ang);
  const camAng = await p.locator('#camAng').textContent();
  ok('il mirino mostra lo stesso angolo', camAng.trim()===ang.trim(), camAng);

  // --- METODO DEI SENI, Lc ricavata
  await p.selectOption('#ipsMetodo','sin');
  await p.fill('#ipsLb','20'); await p.fill('#ipsLc','');
  await p.evaluate(()=>window.__streamMira(-5,1600)); await p.waitForTimeout(1500);
  await p.locator('#ipsRecB').click(); await p.waitForTimeout(150);
  await p.evaluate(()=>window.__streamMira(30,1600)); await p.waitForTimeout(1500);
  await p.locator('#ipsRecC').click(); await p.waitForTimeout(250);
  let h = await p.locator('#ipsH').textContent();
  ok('seni con Lc ricavata: h = 13,2 m', h.trim()==='13,2', h);
  const dett = await p.locator('#ipsDett').textContent();
  ok('il dettaglio dichiara che Lc è ricavata', /ricavata/.test(dett));
  const warn = await p.locator('#ipsWarn').textContent();
  ok('avvisa dell\'ipotesi cima-sulla-verticale', /verticale della base/.test(warn));

  // --- METODO DEI SENI, Lc misurata (cima più lontana => albero inclinato via)
  await p.fill('#ipsLc','26');
  await p.waitForTimeout(200);
  h = await p.locator('#ipsH').textContent();
  // h = 26*sin30 - 20*sin(-5) = 13 + 1,743 = 14,743
  ok('seni con Lc misurata: h = 14,7 m', h.trim()==='14,7', h);

  // --- METODO DELLE TANGENTI, stessa geometria
  await p.selectOption('#ipsMetodo','tan');
  await p.fill('#ipsD','19.92');
  await p.waitForTimeout(200);
  h = await p.locator('#ipsH').textContent();
  ok('tangenti su D equivalente: h = 13,2 m', h.trim()==='13,2', h);
  ok('gli ingressi cambiano col metodo',
     !(await p.locator('#ipsInSin').isVisible()) && await p.locator('#ipsInTan').isVisible());

  // --- CONVERSIONE PENDIO
  await p.locator('#ipsInTan').scrollIntoViewIfNeeded();
  await p.locator('summary:has-text("Ho misurato lungo il pendio")').click();
  await p.fill('#ipsS','22'); await p.fill('#ipsBeta','25');
  await p.locator('#ipsConv').click(); await p.waitForTimeout(200);
  const conv = await p.locator('#ipsConvOut').textContent();
  ok('S=22 m a 25° dà D = 19,94 m', /19,94/.test(conv), conv.slice(0,60));
  ok('la distanza è finita nel campo D', (await p.locator('#ipsD').inputValue())==='19.94');

  // --- PENDENZA
  await p.evaluate(()=>window.__stream(25,2000));
  await p.locator('#pendGo').click();
  await p.waitForTimeout(1900);
  const pd = await p.locator('#pendDeg').textContent();
  const pp = await p.locator('#pendPct').textContent();
  ok('la pendenza misurata è 25°', /25,0|24,9|25,1/.test(pd), pd);
  ok('la converte in percentuale (47%)', pp.trim()==='47', pp);

  await p.evaluate(()=>window.__stream(25,2000));
  await p.locator('#pendGo').click(); await p.waitForTimeout(1900);
  ok('accumula più letture e ne fa la media', (await p.locator('#pendN').textContent()).trim()==='2');

  // raggio in pendenza
  await p.locator('#pendRaggio').click(); await p.waitForTimeout(400);

  // --- RESET COMPLETO
  await p.locator('nav button[data-tab="ips"]').click();
  await p.locator('#ipsHardReset').click(); await p.waitForTimeout(200);
  ok('il reset cancella base e cima', (await p.locator('#valB').textContent()).trim()==='—');
  ok('il reset nasconde il risultato', !(await p.locator('#ipsOut').isVisible()));
  ok('il reset azzera la correzione di zero', (await p.locator('#ipsOff').textContent()).trim()==='0,0°');

  // --- SMORZAMENTO: la lettura filtrata è più liscia
  const rumore = await p.evaluate(()=>{
    function prova(alpha){
      document.getElementById('ipsSmorz').value=String(alpha);
      document.getElementById('ipsSmorz').dispatchEvent(new Event('change'));
      const g=9.81; let letture=[];
      for(let i=0;i<400;i++){
        const a=(30+(i%2?1.5:-1.5))*Math.PI/180;   // tremolio di ±1,5°
        const e=new Event('devicemotion');
        e.accelerationIncludingGravity={x:0,y:g*Math.cos(a),z:-g*Math.sin(a)};
        window.dispatchEvent(e);
        if(i>200) letture.push(IPS.ang);
      }
      const m=letture.reduce((x,y)=>x+y,0)/letture.length;
      return Math.sqrt(letture.reduce((x,y)=>x+(y-m)*(y-m),0)/letture.length);
    }
    return {reattivo:prova(0.28), stabile:prova(0.035), bloccato:prova(0.012)};
  });
  ok('«Stabile» smorza il tremolio più di «Reattivo»', rumore.stabile < rumore.reattivo/3,
     'σ reattivo '+rumore.reattivo.toFixed(3)+'° → stabile '+rumore.stabile.toFixed(3)+'° → bloccato '+rumore.bloccato.toFixed(3)+'°');

  console.log(out.join('\n'));
  console.log('ERRORI JS: ' + (errs.length? errs.join(' | ') : 'nessuno'));
  console.log(out.some(x=>x.startsWith('  KO'))?'>>> QUALCOSA NON VA':'>>> TUTTO OK');
  await b.close();
})();

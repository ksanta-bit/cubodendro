const {chromium} = require('playwright');
const URL='http://localhost:8899/index.html';
const out=[];
function ok(k,v){ out.push((v?'  ok  ':'  KO  ')+k); return v; }

(async ()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:412,height:900}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  await p.goto(URL,{waitUntil:'load'});

  // --- splash
  ok('splash presente all\'avvio', await p.locator('#splash').count()===1);
  await p.waitForTimeout(2900);
  ok('splash rimosso dopo 2,1 s', await p.locator('#splash').count()===0);

  // --- home
  ok('home visibile all\'avvio', await p.locator('#tab-home').isVisible());
  ok('cubatura nascosta all\'avvio', !(await p.locator('#tab-cub').isVisible()));
  ok('12 riquadri caratteristica', await p.locator('.feat-c').count()===12);
  ok('scena con simbolo che dondola', await p.locator('#tab-home .dondolo').count()===1);
  ok('alberi animati nella scena', await p.locator('#tab-home .sway1, #tab-home .sway2').count()>4);

  // --- scorciatoia da riquadro
  await p.locator('.feat-c[data-go="tav"]').first().click();
  await p.waitForTimeout(250);
  ok('il riquadro Tavole apre la scheda Tavole', await p.locator('#tab-tav').isVisible());
  ok('nav segue la scheda aperta', await p.locator('nav button[data-tab="tav"]').getAttribute('aria-selected')==='true');

  // --- ritorno a Home dalla nav
  await p.locator('nav button[data-tab="home"]').click(); await p.waitForTimeout(200);
  ok('si torna a Home dalla nav', await p.locator('#tab-home').isVisible());

  // --- CUBATURA
  await p.locator('nav button[data-tab="cub"]').click(); await p.waitForTimeout(200);
  await p.selectOption('#raggio','13');
  const alberi=[[42,28],[36,26],[51,31],[28,22],[33,null],[45,null],[39,null],[30,null]];
  for(const [d,h] of alberi){
    await p.fill('#d1',String(d));
    await p.fill('#hm', h!==null?String(h):'');
    await p.locator('#addTree').click(); await p.waitForTimeout(60);
  }
  await p.waitForTimeout(300);
  const cub = await p.evaluate(()=>({n:document.getElementById('rN')?.textContent,
    g:document.getElementById('rG')?.textContent, v:document.getElementById('rV')?.textContent}));
  ok('cubatura: N/ha calcolato', !!cub.n && cub.n!=='—');
  ok('cubatura: G/ha calcolato', !!cub.g && cub.g!=='—');
  ok('cubatura: V/ha calcolato', !!cub.v && cub.v!=='—');

  // --- TAVOLE
  await p.locator('nav button[data-tab="tav"]').click(); await p.waitForTimeout(200);
  await p.fill('#tvD','35'); await p.fill('#tvH','26'); await p.waitForTimeout(250);
  const tv = await p.locator('#tvV').textContent();
  ok('tavola: volume singolo albero', /\d/.test(tv||''));

  // --- ANELLI
  await p.locator('nav button[data-tab="den"]').click(); await p.waitForTimeout(200);
  const nCarote = await p.locator('#coreList .chip, #coreTabs button').count();
  ok('scheda anelli si apre', await p.locator('#tab-den').isVisible());
  ok('figure del carotaggio presenti', await p.locator('#tab-den svg.fig').count()>=3);

  // --- schede restanti
  for(const t of ['ips','are','dat','pro']){
    await p.locator('nav button[data-tab="'+t+'"]').click(); await p.waitForTimeout(150);
    ok('si apre la scheda '+t, await p.locator('#tab-'+t).isVisible());
  }

  // --- audit sconfinamenti su tutte le schede e tutte le larghezze
  const tabs=['home','cub','ips','are','den','tav','dat','pro'];
  const larghezze=[320,360,412,768,1180];
  let sconfini=0;
  for(const w of larghezze){
    await p.setViewportSize({width:w,height:900});
    for(const t of tabs){
      await p.locator('nav button[data-tab="'+t+'"]').click();
      await p.waitForTimeout(120);
      const bad = await p.evaluate(function(tab){
        const root=document.getElementById('tab-'+tab); const fuori=[];
        const lim=document.documentElement.clientWidth;
        root.querySelectorAll('*').forEach(function(el){
          if(el.closest('.scroll,.eqn')) return;         // tabelle numeriche e formule scorrono apposta
          const r=el.getBoundingClientRect();
          if(r.width===0&&r.height===0) return;
          if(r.right>lim+1.5||r.left<-1.5) fuori.push(el.tagName+'.'+(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className)+' → '+Math.round(r.left)+'..'+Math.round(r.right));
        });
        return fuori.slice(0,4);
      }, t);
      if(bad.length){ sconfini++; console.log('  SBORDA', w+'px', t, JSON.stringify(bad)); }
    }
  }
  ok('nessuno sconfinamento (8 schede × 5 larghezze)', sconfini===0);

  // --- offline
  await p.setViewportSize({width:412,height:900});
  await p.waitForTimeout(600);
  const sw = await p.evaluate(async()=>{ const r=await navigator.serviceWorker.getRegistration(); return !!r; });
  ok('service worker registrato', sw);
  await ctx.setOffline(true);
  const p2 = await ctx.newPage();
  const r2 = await p2.goto(URL,{waitUntil:'load'}).catch(()=>null);
  await p2.waitForTimeout(2600);
  ok('l\'app si apre offline', await p2.locator('#tab-home').isVisible().catch(()=>false));
  ok('la scena c\'è anche offline', await p2.locator('#tab-home .dondolo').count()===1);
  await ctx.setOffline(false);

  console.log(out.join('\n'));
  console.log('ERRORI JS: ' + (errs.length? errs.join(' | ') : 'nessuno'));
  console.log(out.some(x=>x.startsWith('  KO'))?'>>> QUALCOSA NON VA':'>>> TUTTO OK');
  await b.close();
})();

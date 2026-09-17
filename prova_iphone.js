/* Prova dell'ipsometro con la convenzione dei sensori di iPhone.
   iOS (WebKit) riporta accelerationIncludingGravity col segno opposto
   alla specifica: telefono disteso a schermo in su → z = −9,8.
   Qui si simulano iPhone e Android, con e senza deviceorientation,
   e si controlla che base −6°, cima +38° a 25 m diano 22,16 m.   */
const {chromium} = require('playwright');
const URL='http://localhost:8899/index.html';
const out=[]; let ko=0;
function ok(k,c,e){ if(!c) ko++; out.push((c?'  ok  ':'  KO  ')+k+(e?'   ['+e+']':'')); }

const UA_IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const UA_ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36';

/* conv: +1 = specifica (Android), −1 = iOS.  ori: invia anche deviceorientation.
   perm: 'granted' | 'denied' | null (nessuna richiesta, come Android) */
async function scenario(b, nome, ua, conv, ori, perm){
  const ctx = await b.newContext({viewport:{width:390,height:844}, userAgent:ua, isMobile:true, hasTouch:true});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('dialog', d=>d.accept());
  await p.addInitScript(({perm})=>{
    if(perm){
      window.__chiamate = 0;
      DeviceMotionEvent.requestPermission = function(){ window.__chiamate++; return new Promise(r=>setTimeout(()=>r(perm),150)); };
      DeviceOrientationEvent.requestPermission = function(){ window.__chiamate++; return new Promise(r=>setTimeout(()=>r(perm),150)); };
    }
  }, {perm});
  await p.goto(URL,{waitUntil:'load'});
  await p.waitForTimeout(800);
  await p.addScriptTag({content:`
    window.__mira = function(alphaDeg, n, conv, ori){
      const g=9.81, a=alphaDeg*Math.PI/180;
      for(let i=0;i<n;i++){
        if(ori){
          const o=new Event('deviceorientation');
          o.alpha=0; o.beta=90+alphaDeg; o.gamma=0;
          window.dispatchEvent(o);
        }
        const e=new Event('devicemotion');
        /* specifica: fotocamera alzata di α → z = −g·sin α */
        e.accelerationIncludingGravity={x:0, y:g*Math.cos(a), z:conv*(-g*Math.sin(a))};
        window.dispatchEvent(e);
      }
    };
    window.__disteso = function(n, conv, ori){
      for(let i=0;i<n;i++){
        if(ori){ const o=new Event('deviceorientation'); o.alpha=0; o.beta=3; o.gamma=-2; window.dispatchEvent(o); }
        const e=new Event('devicemotion');
        e.accelerationIncludingGravity={x:0.3, y:0.5, z:conv*9.79};
        window.dispatchEvent(e);
      }
    };
  `});
  await p.locator('nav button[data-tab="ips"]').click(); await p.waitForTimeout(200);
  await p.$eval('#ipsStart', e=>e.click()); await p.waitForTimeout(500);

  if(perm==='denied'){
    const t = await p.locator('#ipsErr').textContent();
    ok(nome+': con permesso negato compare la spiegazione giusta', /Chiudi del tutto Safari/.test(t) && /Non cancellare i dati/.test(t));
    ok(nome+': con permesso negato il sensore resta spento', !(await p.locator('#ipsLive').isVisible()));
    await ctx.close(); return;
  }
  if(perm) ok(nome+': chieste entrambe le autorizzazioni nello stesso tocco', await p.evaluate(()=>window.__chiamate)===2);

  await p.selectOption('#ipsSmorz','0.28');
  await p.selectOption('#ipsMetodo','tan');
  await p.fill('#ipsD','25');
  /* un po' di telefono disteso in mano, come quando si cammina */
  await p.evaluate(({conv,ori})=>window.__disteso(60,conv,ori), {conv,ori});
  await p.evaluate(({conv,ori})=>window.__mira(-6,300,conv,ori), {conv,ori});
  await p.waitForTimeout(150);
  const angB = await p.locator('#ipsAng').textContent();
  ok(nome+': mirando in basso l\'angolo è negativo', /^−?-6,0°$/.test(angB.trim()), angB);
  await p.evaluate(({conv,ori})=>window.__mira(-6,80,conv,ori), {conv,ori});
  await p.$eval('#ipsRecB', e=>e.click());
  await p.waitForTimeout(1100);   /* la registrazione è la mediana dell'ultimo secondo */
  await p.evaluate(({conv,ori})=>window.__mira(38,300,conv,ori), {conv,ori});
  await p.waitForTimeout(150);
  const angC = await p.locator('#ipsAng').textContent();
  ok(nome+': mirando in alto l\'angolo è positivo', /^38,0°$/.test(angC.trim()), angC);
  const dir = await p.locator('#ipsDir').textContent();
  ok(nome+': la direzione dice «verso l\'alto»', /alto/.test(dir), dir);
  await p.evaluate(({conv,ori})=>window.__mira(38,80,conv,ori), {conv,ori});
  await p.$eval('#ipsRecC', e=>e.click());
  await p.waitForTimeout(150);
  const h = await p.locator('#ipsH').textContent();
  ok(nome+': altezza 22,2 m (attesi 22,16)', h.trim()==='22,2', h);
  const warn = await p.locator('#ipsWarn').textContent();
  ok(nome+': nessun avviso di base e cima scambiate', !/scambiat|invertito/.test(warn), warn.slice(0,60));

  /* pendenza: telefono disteso a faccia in su non deve dare l'allarme «faccia in giù» */
  const giu = await p.evaluate(({conv,ori})=>{ window.__disteso(30,conv,ori); return IPS.giu; }, {conv,ori});
  ok(nome+': telefono a schermo in su non risulta «a faccia in giù»', giu===false);
  const diag = (await p.locator('#ipsDiag').count()) ? await p.locator('#ipsDiag').textContent() : '(versione senza diagnostica)';
  out.push('  ··  '+nome+' → '+diag);
  ok(nome+': nessun errore JavaScript', errs.length===0, errs.join(' | '));
  await ctx.close();
  return diag;
}

(async ()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const d1 = await scenario(b,'iPhone, con orientamento', UA_IPHONE, -1, true,  'granted');
  ok('iPhone: convenzione riconosciuta e verificata', /iOS, verificato/.test(d1||''), d1);
  await scenario(b,'iPhone, solo accelerometro', UA_IPHONE, -1, false, 'granted');
  const d3 = await scenario(b,'iPhone con WebKit ipoteticamente corretto', UA_IPHONE, +1, true, 'granted');
  ok('se Apple allineasse WebKit, l\'app se ne accorge', /standard, verificato/.test(d3||''), d3);
  await scenario(b,'iPhone, permesso negato', UA_IPHONE, -1, true, 'denied');
  const d5 = await scenario(b,'Android, con orientamento', UA_ANDROID, +1, true, null);
  ok('Android: convenzione standard confermata', /standard, verificato/.test(d5||''), d5);
  await scenario(b,'Android, solo accelerometro', UA_ANDROID, +1, false, null);
  await b.close();
  console.log(out.join('\n'));
  console.log(ko ? '>>> '+ko+' PROVE FALLITE' : '>>> TUTTO OK');
})();

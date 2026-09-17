<script>
"use strict";
/* ============================================================
   PARTE E — INSTALLAZIONE E FUNZIONAMENTO OFFLINE
   ============================================================ */

/* service worker: registrato solo se la pagina è servita da un
   indirizzo web. Aperta come file locale l'app funziona lo stesso,
   semplicemente senza cache offline gestita (e senza ipsometro). */
if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').catch(function(err){
      console.warn('Service worker non registrato:', err.message);
    });
  });
}

/* chiede al browser di non sgomberare da solo la memoria locale, dove
   stanno i rilievi. Non cancella e non sposta nulla: se il browser dice
   di no, tutto resta com'era. */
try{
  if(navigator.storage && navigator.storage.persist && navigator.storage.persisted){
    navigator.storage.persisted().then(function(p){ if(!p) return navigator.storage.persist(); })
      .catch(function(){});
  }
}catch(e){}

/* pulsante di installazione su Android / desktop Chrome */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault(); deferredPrompt = e;
  const b = document.getElementById('btnInstall');
  if(b) b.hidden = false;
});
(function(){
  const b = document.getElementById('btnInstall'), msg = document.getElementById('installMsg');
  if(!b) return;
  b.addEventListener('click', async function(){
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    const r = await deferredPrompt.userChoice;
    deferredPrompt = null; b.hidden = true;
    if(msg){ msg.hidden=false;
      msg.textContent = r.outcome === 'accepted'
        ? 'Installata. La trovi nella schermata Home come una qualsiasi app.'
        : 'Installazione annullata. Puoi rifarla in qualsiasi momento dal menu del browser.'; }
  });
  window.addEventListener('appinstalled', function(){
    b.hidden = true;
    if(msg){ msg.hidden=false; msg.textContent = 'DendroCubo è installata su questo dispositivo.'; }
  });
  /* già in modalità app installata */
  if(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true){
    b.hidden = true;
    if(msg){ msg.hidden=false; msg.textContent = 'Stai già usando DendroCubo come app installata.'; }
  }
})();
</script>

<script>
"use strict";
/* ============================================================
   PARTE F — SCHERMATA DI AVVIO E PAGINA INIZIALE
   ============================================================ */

/* ---- schermata di avvio ----
   Resta 2,1 s (quanto dura la barra di caricamento), poi sfuma.
   Si può congedare prima con un tocco, un clic o un tasto: nessuno
   deve restare a guardare un'animazione quando ha fretta.
   Con prefers-reduced-motion il foglio di stile spegne le animazioni,
   quindi qui si esce subito. */
(function(){
  const sp = document.getElementById('splash');
  if(!sp) return;
  const ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let andata = false;
  function via(){
    if(andata) return; andata = true;
    sp.classList.add('via');
    /* rimosso dal DOM a sfumatura finita: non deve intercettare tocchi
       né comparire nella navigazione da tastiera */
    setTimeout(function(){ if(sp.parentNode) sp.parentNode.removeChild(sp); }, 650);
  }
  if(ridotto){ via(); return; }
  sp.addEventListener('click', via);
  sp.addEventListener('touchstart', via, {passive:true});
  window.addEventListener('keydown', via, {once:true});
  setTimeout(via, 2100);
})();

/* ---- scorciatoie della pagina iniziale ----
   Ogni riquadro «caratteristica» porta alla scheda corrispondente. */
document.querySelectorAll('[data-go]').forEach(function(b){
  b.addEventListener('click', function(){ apriScheda(b.dataset.go); });
});
</script>

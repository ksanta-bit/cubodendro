/* CuboDendro — service worker
   Strategia: cache-first sull'app shell, con aggiornamento in background.
   L'app è progettata per funzionare completamente offline: una volta
   installata non effettua alcuna richiesta di rete per funzionare.
   Le mattonelle cartografiche di OpenStreetMap, facoltative, sono di
   altra origine e vengono deliberatamente escluse dalla cache. */
const CACHE = 'cubodendro-v3.2.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './privacy.html',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  /* addAll() fallisce in blocco se anche un solo file manca: mettiamo in cache
     una risorsa alla volta, così un file assente non impedisce l'installazione
     e l'app resta comunque utilizzabile offline. */
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(SHELL.map(function(u){
        return c.add(u).catch(function(err){
          console.warn('[sw] non messo in cache:', u, err && err.message);
        });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                            .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(function(hit){
      if(hit){
        // aggiorna in sottofondo, ma restituisci subito la copia in cache
        e.waitUntil(fetch(e.request).then(function(res){
          if(res && res.ok) return caches.open(CACHE).then(function(c){ return c.put(e.request, res); });
        }).catch(function(){}));
        return hit;
      }
      return fetch(e.request).then(function(res){
        if(res && res.ok && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match('./index.html');
      });
    })
  );
});

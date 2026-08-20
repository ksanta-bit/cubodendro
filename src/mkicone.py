#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera le icone dell'app dal simbolo dell'Istituto.

Il problema da risolvere: il marchio «8M / KL» ha una cornice sottile
(5 unità su 100) e lettere da 6 unità. Ridotto a 48–60 px sulla schermata
Home quelle linee scendono sotto i due pixel e il simbolo diventa una
macchia. Qui si fanno due cose:

  1. ogni misura viene RENDERIZZATA ALLA SUA DIMENSIONE, non ottenuta
     rimpicciolendo un'immagine grande: il tratto cade su pixel interi;
  2. al tracciato si aggiunge uno STROKE proporzionale alla riduzione,
     che ingrossa la cornice e le aste delle lettere quel tanto che
     serve a farle sopravvivere.

Il rendering è fatto da Chromium, che è l'unico motore che abbiamo e
disegna gli SVG meglio di qualunque libreria di ripiego.
"""

import json, subprocess, os, sys

LOGO = open(os.path.join(os.path.dirname(__file__), 'logo.svg'), encoding='utf-8').read()
# tolgo l'involucro <svg>: mi servono solo i tracciati
inner = LOGO.split('>', 1)[1].rsplit('</svg>', 1)[0]

CREMA = '#f7f4ec'
VERDE = '#1f4e3d'

# nome, lato px, sfondo, colore marchio, quota del marchio, ingrossamento
ICONE = [
    ('icons/icon-512.png',           512, CREMA, VERDE, 0.78, 0.5),
    ('icons/icon-192.png',           192, CREMA, VERDE, 0.78, 1.1),
    ('icons/apple-touch-icon.png',   180, CREMA, VERDE, 0.74, 1.1),
    ('icons/icon-maskable-512.png',  512, VERDE, '#ffffff', 0.56, 0.7),
    ('icons/icon-maskable-192.png',  192, VERDE, '#ffffff', 0.56, 1.4),
    ('icons/favicon-32.png',          32, CREMA, VERDE, 0.86, 2.6),
    ('icons/favicon-48.png',          48, CREMA, VERDE, 0.86, 2.2),
    ('icons/favicon-16.png',          16, VERDE, '#ffffff', 0.90, 4.0),
]

def pagina(lato, sfondo, colore, quota, ingrosso):
    m = lato * quota                      # larghezza del marchio in px
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;padding:0}}
body{{width:{lato}px;height:{lato}px;background:{sfondo};
     display:flex;align-items:center;justify-content:center;overflow:hidden}}
svg{{width:{m}px;height:auto;display:block;shape-rendering:geometricPrecision}}
</style></head><body>
<svg viewBox="0 0 100 104" xmlns="http://www.w3.org/2000/svg" fill="{colore}"
     stroke="{colore}" stroke-width="{ingrosso}" stroke-linejoin="round" fill-rule="evenodd">
{inner}
</svg></body></html>"""

os.makedirs('icons', exist_ok=True)
lavoro = []
for nome, lato, sfondo, colore, quota, ingrosso in ICONE:
    f = f'/tmp/ic_{os.path.basename(nome)}.html'
    open(f, 'w', encoding='utf-8').write(pagina(lato, sfondo, colore, quota, ingrosso))
    lavoro.append({'html': f, 'out': nome, 'lato': lato})

script = """
const {chromium}=require('playwright');
const lavoro=%s;
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  for(const j of lavoro){
    const ctx=await b.newContext({viewport:{width:j.lato,height:j.lato},deviceScaleFactor:1});
    const p=await ctx.newPage();
    await p.goto('file://'+j.html,{waitUntil:'load'});
    await p.screenshot({path:j.out, omitBackground:false});
    await ctx.close();
    console.log(j.out+'  '+j.lato+'px');
  }
  await b.close();
})();
""" % json.dumps(lavoro)
open('/tmp/mkic.js', 'w').write(script)
subprocess.run(['node', '/tmp/mkic.js'], check=True)
print('icone rigenerate')

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera le due scene animate di CuboDendro:

  _hero.svg        scena della pagina iniziale (tema chiaro/scuro, usa le variabili CSS)
  _splashband.svg  fascia di alberi della schermata di avvio (fondo scuro fisso)

Regola di stile: dentro l'SVG stanno solo le forme. Nessun testo lungo:
le scritte stanno nell'HTML, dove vanno a capo da sole.

L'animazione è tutta in CSS (classi .sway1..4 e .dondolo definite nel foglio
di stile), così basta prefers-reduced-motion per fermare tutto.
"""

LOGO = (
 '<path d="M 0.00 104.00 L 100.00 104.00 L 100.00 0.00 L 0.00 16.00 Z M 5.20 19.90 L 94.80 7.02 '
 'L 94.80 98.80 L 5.20 98.80 Z"/>'
 '<path d="M 15.00 52.00 L 45.00 52.00 L 45.00 39.25 L 41.17 37.00 L 45.00 34.75 L 45.00 22.00 '
 'L 15.00 22.00 L 15.00 34.75 L 18.82 37.00 L 15.00 39.25 Z M 21.00 28.00 L 39.00 28.00 L 39.00 33.70 '
 'L 21.00 33.70 Z M 21.00 40.30 L 39.00 40.30 L 39.00 46.00 L 21.00 46.00 Z"/>'
 '<path d="M 55.00 52.00 L 61.00 52.00 L 61.00 22.00 L 55.00 22.00 Z"/>'
 '<path d="M 79.00 52.00 L 85.00 52.00 L 85.00 22.00 L 79.00 22.00 Z"/>'
 '<path d="M 55.00 28.00 L 85.00 28.00 L 85.00 22.00 L 55.00 22.00 Z"/>'
 '<path d="M 67.00 39.40 L 73.00 39.40 L 73.00 22.00 L 67.00 22.00 Z"/>'
 '<path d="M 15.00 92.00 L 21.00 92.00 L 21.00 62.00 L 15.00 62.00 Z"/>'
 '<path d="M 35.71 62.00 L 23.28 77.00 L 35.71 92.00 L 43.50 92.00 L 31.07 77.00 L 43.50 62.00 Z"/>'
 '<path d="M 55.00 86.00 L 61.00 86.00 L 61.00 62.00 L 55.00 62.00 Z"/>'
 '<path d="M 55.00 92.00 L 85.00 92.00 L 85.00 86.00 L 55.00 86.00 Z"/>'
)


def conifer(bx, by, H, W, fill, op, trunk, sway, layers=3):
    """Conifera stilizzata: fusto + falde triangolari sovrapposte."""
    th = H * 0.20                      # porzione di fusto a vista
    tw = max(2.0, W * 0.13)
    out = ['<g class="%s">' % sway]
    out.append('<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" rx="%.2f" fill="%s" opacity="%.2f"/>'
               % (bx - tw / 2, by - th, tw, th + 0.6, tw * 0.35, trunk, op))
    top = by - H
    span = (by - th * 0.55) - top      # tratto occupato dalla chioma
    for i in range(layers):
        f = i / (layers - 1) if layers > 1 else 0
        cy = top + span * (0.30 + 0.70 * f)          # base della falda
        apex = top + span * (0.70 * f) * 0.92        # vertice della falda
        w = W * (0.46 + 0.54 * f)
        out.append('<path d="M %.2f %.2f L %.2f %.2f L %.2f %.2f Z" fill="%s" opacity="%.2f"/>'
                   % (bx - w / 2, cy, bx, apex, bx + w / 2, cy, fill, op))
    out.append('</g>')
    return ''.join(out)


def ridge(pts, fill, op):
    d = 'M ' + ' L '.join('%.1f %.1f' % p for p in pts)
    return '<path d="%s Z" fill="%s" opacity="%.2f"/>' % (d, fill, op)


# ------------------------------------------------------------------ scena home
W, H = 400.0, 214.0
GY = 186.0            # linea di terra

s = ['<svg class="scene" viewBox="0 0 %g %g" preserveAspectRatio="xMidYMax slice" '
     'xmlns="http://www.w3.org/2000/svg" role="img" '
     'aria-label="Il simbolo dell\'Istituto in un bosco stilizzato">' % (W, H)]

s.append('<defs>'
         '<linearGradient id="hgGround" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0" stop-color="var(--brand)" stop-opacity=".16"/>'
         '<stop offset="1" stop-color="var(--brand)" stop-opacity=".03"/>'
         '</linearGradient>'
         '<radialGradient id="hgGlow" cx=".5" cy=".55" r=".5">'
         '<stop offset="0" stop-color="var(--amber)" stop-opacity=".26"/>'
         '<stop offset="1" stop-color="var(--amber)" stop-opacity="0"/>'
         '</radialGradient>'
         '</defs>')

# alone caldo dietro al simbolo
s.append('<ellipse cx="200" cy="112" rx="128" ry="96" fill="url(#hgGlow)"/>')

# creste lontane
s.append(ridge([(0, 150), (46, 122), (88, 141), (140, 106), (196, 138), (250, 110),
                (306, 140), (356, 118), (400, 146), (400, GY), (0, GY)],
               'var(--brand)', 0.10))
s.append(ridge([(0, 168), (54, 148), (110, 164), (168, 142), (232, 166), (292, 146),
                (348, 165), (400, 152), (400, GY), (0, GY)],
               'var(--brand)', 0.14))

# fascia di terreno
s.append('<rect x="0" y="%g" width="%g" height="%g" fill="url(#hgGround)"/>' % (GY, W, H - GY))
s.append('<line x1="0" y1="%g" x2="%g" y2="%g" stroke="var(--brand)" stroke-opacity=".30" '
         'stroke-width="1.6"/>' % (GY, W, GY))

# bosco di sfondo, piccolo e chiaro
bg = [(14, 40, 22), (36, 30, 17), (366, 36, 20), (388, 28, 16),
      (128, 26, 15), (272, 24, 14)]
for i, (x, h, w) in enumerate(bg):
    s.append(conifer(x, GY, h, w, 'var(--brand)', 0.20, 'var(--brand)',
                     'sway%d' % (i % 4 + 1), layers=3))

# alberi in primo piano, ai due lati del simbolo
fg = [(30, 84, 46), (66, 62, 34), (100, 96, 52), (132, 54, 30),
      (268, 56, 31), (300, 92, 50), (334, 66, 36), (370, 82, 44)]
for i, (x, h, w) in enumerate(fg):
    s.append(conifer(x, GY, h, w, 'var(--brand-2)', 0.55, 'var(--wood)',
                     'sway%d' % (i % 4 + 1), layers=4))

# ombra e simbolo che dondola sulla sua base
s.append('<ellipse class="ombra" cx="200" cy="%g" rx="50" ry="7" fill="var(--brand)" opacity=".22"/>' % (GY + 1))
s.append('<g transform="translate(150 %g) scale(1.00)">'
         '<g class="dondolo"><g fill="var(--brand)">%s</g></g></g>'
         % (GY - 1.00 * 104 + 1, LOGO))

s.append('</svg>')
open('_hero.svg', 'w', encoding='utf-8').write(''.join(s) + '\n')

# ------------------------------------------------------- fascia della schermata di avvio
BW, BH = 400.0, 96.0
b = ['<svg class="sp-band" viewBox="0 0 %g %g" preserveAspectRatio="none" '
     'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' % (BW, BH)]
b.append(ridge([(0, 58), (52, 40), (104, 56), (162, 34), (224, 55), (286, 36),
                (344, 56), (400, 42), (400, BH), (0, BH)], '#ffffff', 0.07))
band = [(18, 52, 28), (48, 38, 21), (80, 60, 32), (112, 34, 19), (146, 50, 27),
        (182, 40, 22), (218, 58, 31), (252, 36, 20), (286, 52, 28), (320, 40, 22),
        (356, 56, 30), (388, 38, 21)]
for i, (x, h, w) in enumerate(band):
    b.append(conifer(x, BH - 2, h, w, '#ffffff', 0.16, '#ffffff',
                     'sway%d' % (i % 4 + 1), layers=4))
b.append('</svg>')
open('_splashband.svg', 'w', encoding='utf-8').write(''.join(b) + '\n')

print('_hero.svg %d byte · _splashband.svg %d byte'
      % (len(open('_hero.svg', encoding='utf-8').read()),
         len(open('_splashband.svg', encoding='utf-8').read())))

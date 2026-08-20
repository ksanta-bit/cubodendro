#!/usr/bin/env python3
"""Genera le figure esplicative come SVG in linea.

Regola di impaginazione: dentro l'SVG stanno solo il disegno e etichette
brevissime, ancorate al disegno. Ogni spiegazione lunga sta FUORI, in una
didascalia HTML che va a capo da sola: il testo SVG non si adatta alla
larghezza e su un telefono sborda sempre.
Le figure usano le variabili CSS del tema, quindi seguono chiaro e scuro.
"""
import math, io, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

BRAND='var(--brand)'; AMB='var(--amber)'; WOOD='var(--wood)'
S1='var(--series-1)'; S2='var(--series-2)'; BAD='var(--bad)'; GOOD='var(--good)'
INK='var(--text-primary)'; FAINT='var(--text-muted)'
LINE='var(--line-strong)'; SURF='var(--surface-1)'; SURF2='var(--surface-2)'

FIG = {}

def svg(w, h, body, label):
    return ('<svg class="fig" viewBox="0 0 %d %d" role="img" aria-label="%s" '
            'xmlns="http://www.w3.org/2000/svg">%s</svg>') % (w, h, label, body)

def T(x, y, s, size=10.5, anchor='middle', fill=FAINT, weight='700'):
    return ('<text x="%.1f" y="%.1f" text-anchor="%s" font-size="%s" fill="%s" '
            'font-weight="%s">%s</text>') % (x, y, anchor, size, fill, weight, s)

DEFS = ''.join(
    '<marker id="a%s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" '
    'orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="%s"/></marker>' % (n, c)
    for n, c in [('k', INK), ('o', S2), ('b', S1), ('g', BRAND)])
DEFS = '<defs>%s</defs>' % DEFS

def AR(x1, y1, x2, y2, col=INK, m='k', w=1.6, both=False):
    s = ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%s" '
         'marker-end="url(#a%s)"') % (x1, y1, x2, y2, col, w, m)
    if both: s += ' marker-start="url(#a%s)"' % m
    return s + '/>'

# ══════════════════════════════════════════════════════════════
# 1 · Prelievo della carota — sezione trasversale del fusto
# ══════════════════════════════════════════════════════════════
W, H = 460, 300
b = io.StringIO(); b.write(DEFS)
cx, cy, R = 230, 150, 92
b.write('<circle cx="%d" cy="%d" r="%d" fill="%s" stroke="%s" stroke-width="2"/>' % (cx, cy, R, SURF2, LINE))
for r in range(16, R-8, 10):
    b.write('<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-opacity=".3" stroke-width="1.2"/>' % (cx, cy, r, WOOD))
b.write('<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-width="7" stroke-opacity=".5"/>' % (cx, cy, R-3, WOOD))
# settore del legno di reazione, in basso
b.write('<path d="M %d %d A %d %d 0 0 0 %d %d L %d %d A %d %d 0 0 1 %d %d Z" fill="%s" opacity=".18"/>'
        % (cx-66, cy+64, R, R, cx+66, cy+64, cx+46, cy+45, R-30, R-30, cx-46, cy+45, BAD))
b.write('<circle cx="%d" cy="%d" r="5" fill="%s"/>' % (cx, cy, INK))
b.write(T(cx, cy-12, 'midollo', 10, fill=INK))
# succhiello corretto — entra da sinistra, punta al centro
b.write('<rect x="34" y="%d" width="104" height="10" rx="3" fill="%s"/>' % (cy-5, BRAND))
b.write('<rect x="138" y="%d" width="%d" height="6" rx="2" fill="%s" opacity=".55"/>' % (cy-3, cx-138, BRAND))
b.write('<circle cx="34" cy="%d" r="13" fill="none" stroke="%s" stroke-width="3.5"/>' % (cy, BRAND))
b.write(T(86, cy-16, 'sì', 15, fill=BRAND, weight='800'))
# succhiello sbagliato — non punta al centro
b.write('<line x1="426" y1="66" x2="%d" y2="%d" stroke="%s" stroke-width="9" stroke-opacity=".7" stroke-linecap="round"/>' % (cx+52, cy-52, BAD))
b.write('<g stroke="%s" stroke-width="3" stroke-linecap="round">'
        '<line x1="392" y1="40" x2="408" y2="56"/><line x1="408" y1="40" x2="392" y2="56"/></g>' % BAD)
b.write(T(370, 52, 'no', 15, anchor='end', fill=BAD, weight='800'))
b.write(T(cx, cy+R+26, 'lato a valle', 10.5, fill=BAD))
b.write(AR(cx, cy+R+34, cx, cy+R+16, BAD, 'k', 1.4))
b.write(T(230, 292, 'vista dall\'alto della sezione del fusto', 10, fill=FAINT, weight='600'))
FIG['carota_prelievo'] = dict(
    svg=svg(W, H, b.getvalue(), 'Sezione del fusto con succhiello inserito correttamente e scorrettamente'),
    cap='<b>Come si punta il succhiello.</b> Perpendicolare al fusto e diretto al midollo: solo così '
        'la carota attraversa tutti gli anelli. Una carota che passa di lato salta gli anelli più interni '
        'e fa sottostimare l\'età. Il prelievo va fatto <b>lungo la curva di livello</b>: nel settore a '
        'valle di un fusto inclinato si forma legno di reazione, con anelli anomali che falsano la misura.')

# ══════════════════════════════════════════════════════════════
# 2 · La carota estratta
# ══════════════════════════════════════════════════════════════
W, H = 460, 250
b = io.StringIO(); b.write(DEFS)
x0, y0, CW, CH = 40, 96, 380, 48
b.write('<rect x="%d" y="%d" width="%d" height="%d" rx="4" fill="#e8d3ab" stroke="%s"/>' % (x0, y0, CW, CH, LINE))
b.write('<rect x="%d" y="%d" width="14" height="%d" rx="3" fill="%s"/>' % (x0, y0, CH, WOOD))
pos, w = [], x0+14
for L in [8, 10, 13, 16, 12, 18, 21, 15, 24, 28, 21, 32, 27, 36, 31, 40]:
    if w+L > x0+CW-10: break
    b.write('<rect x="%.1f" y="%d" width="3.6" height="%d" fill="%s" opacity=".8"/>' % (w+L-3.6, y0, CH, WOOD))
    pos.append(w); w += L
b.write('<circle cx="%d" cy="%d" r="5.5" fill="%s"/>' % (x0+CW-10, y0+CH/2, INK))
b.write(AR(x0+7, y0-14, x0+7, y0-2, INK, 'k', 1.4))
b.write(T(x0+7, y0-20, 'corteccia', 10, anchor='start', fill=INK))
b.write(AR(x0+CW-10, y0+CH+20, x0+CW-10, y0+CH+6, INK, 'k', 1.4))
b.write(T(x0+CW-10, y0+CH+34, 'midollo', 10, anchor='end', fill=INK))
b.write(AR(x0+40, 52, x0+CW-40, 52, S2, 'o', 2))
b.write(T(230, 42, 'si legge dalla corteccia (2026) verso il midollo', 11, fill=S2, weight='800'))
b.write(T(x0+CW-14, 78, 'anni più antichi', 10, anchor='end', fill=FAINT))
zx, zy = 230, 178
b.write('<line x1="%.1f" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-dasharray="3 3"/>' % (pos[8], y0+CH, zx-46, zy, LINE))
b.write('<line x1="%.1f" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-dasharray="3 3"/>' % (pos[9], y0+CH, zx+46, zy, LINE))
b.write('<rect x="%d" y="%d" width="92" height="38" rx="4" fill="#e8d3ab" stroke="%s"/>' % (zx-46, zy, LINE))
b.write('<rect x="%d" y="%d" width="28" height="38" fill="%s" opacity=".8"/>' % (zx+18, zy, WOOD))
b.write('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.6" '
        'marker-end="url(#ao)" marker-start="url(#ao)"/>' % (zx-46, zy-10, zx+46, zy-10, S2))
b.write(T(zx, zy-16, 'un anello = un anno', 10.5, fill=S2, weight='800'))
b.write(T(zx-18, zy+52, 'primaverile', 9.5, fill=FAINT))
b.write(T(zx+40, zy+52, 'tardivo', 9.5, fill=FAINT))
FIG['carota_lettura'] = dict(
    svg=svg(W, H, b.getvalue(), 'La carota estratta, dalla corteccia al midollo'),
    cap='<b>Che cosa si legge sulla carota.</b> L\'anello sotto la corteccia è quello dell\'anno in corso: '
        'da lì si procede a ritroso. Ogni anello è una coppia di bande — il <b>legno primaverile</b>, chiaro, '
        'a cellule ampie e pareti sottili, e il <b>legno tardivo</b>, scuro e denso. Il limite che l\'occhio '
        'riconosce è il salto brusco fra il tardivo di un anno e il primaverile dell\'anno dopo. '
        'Gli anelli si stringono verso la corteccia per pura geometria: la stessa quantità di legno si '
        'distribuisce su una circonferenza sempre più lunga.')

# ══════════════════════════════════════════════════════════════
# 3 · Misura sulla foto
# ══════════════════════════════════════════════════════════════
W, H = 460, 230
b = io.StringIO(); b.write(DEFS)
b.write('<rect x="30" y="34" width="400" height="32" rx="3" fill="%s" stroke="%s"/>' % (SURF2, LINE))
for i in range(15):
    x = 44+i*27
    b.write('<line x1="%d" y1="34" x2="%d" y2="%d" stroke="%s" stroke-width="%s"/>'
            % (x, x, 54 if i % 5 else 64, INK, 1 if i % 5 else 1.8))
b.write('<line x1="44" y1="50" x2="179" y2="50" stroke="%s" stroke-width="2.4"/>' % S2)
b.write('<circle cx="44" cy="50" r="6.5" fill="%s"/><circle cx="179" cy="50" r="6.5" fill="%s"/>' % (S2, S2))
b.write('<circle cx="30" cy="20" r="10" fill="%s"/>' % S2)
b.write(T(30, 24, '1', 12, fill='#fff', weight='800'))
b.write(T(48, 24, 'taratura sul righello', 11, anchor='start', fill=S2, weight='800'))
y0 = 108
b.write('<rect x="30" y="%d" width="400" height="54" rx="4" fill="#e8d3ab" stroke="%s"/>' % (y0, LINE))
xs = [52, 86, 132, 166, 220, 258, 320, 366, 412]
for i, x in enumerate(xs):
    b.write('<rect x="%d" y="%d" width="5" height="54" fill="%s" opacity=".8"/>' % (x-2, y0, WOOD))
    if i:
        b.write('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.6"/>' % (xs[i-1], y0+27, x, y0+27, S1))
for i, x in enumerate(xs):
    b.write('<circle cx="%d" cy="%d" r="7.5" fill="%s"/>' % (x, y0+27, S1))
    b.write(T(x, y0+31, str(i+1), 9, fill='#fff', weight='800'))
b.write('<circle cx="30" cy="%d" r="10" fill="%s"/>' % (y0-16, S1))
b.write(T(30, y0-12, '2', 12, fill='#fff', weight='800'))
b.write(T(48, y0-12, 'limiti degli anelli, in ordine', 11, anchor='start', fill=S1, weight='800'))
b.write(T(230, 200, 'la lente d\'ingrandimento segue il dito', 10, fill=FAINT, weight='600'))
FIG['carota_foto'] = dict(
    svg=svg(W, H, b.getvalue(), 'Misura degli anelli su fotografia: taratura e limiti'),
    cap='<b>Misurare gli anelli su una fotografia.</b> Prima si tocca <b>due tacche del righello</b> e si '
        'dichiara quanti millimetri le separano: da lì l\'app ricava quanti millimetri vale un pixel. '
        'Poi si tocca in ordine ogni limite di anello, dalla corteccia verso il midollo. Una lente '
        'd\'ingrandimento segue il dito per toccare con precisione. Il risultato si trasferisce con un '
        'pulsante nella carota attiva. Si arriva a 0,05–0,1 mm, contro i 0,5 mm scarsi del righello a occhio nudo.')

# ══════════════════════════════════════════════════════════════
# 4 · Area di saggio in pianta
# ══════════════════════════════════════════════════════════════
W, H = 380, 300
b = io.StringIO(); b.write(DEFS)
cx, cy, R = 190, 148, 118
b.write('<circle cx="%d" cy="%d" r="%d" fill="%s" fill-opacity=".07" stroke="%s" stroke-width="2.4"/>' % (cx, cy, R, BRAND, BRAND))
b.write('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.4" stroke-dasharray="5 4"/>' % (cx, cy, cx+R, cy, BRAND))
b.write(T(cx+R/2, cy-8, 'raggio', 10.5, fill=BRAND, weight='800'))
b.write('<circle cx="%d" cy="%d" r="6.5" fill="%s" stroke="%s" stroke-width="2"/>' % (cx, cy, BRAND, SURF))
b.write(T(cx, cy+22, 'centro', 10, fill=BRAND))
for dx, dy, k in [(-66,-52,'in'), (36,-70,'in'), (-32,58,'in'), (74,40,'in'), (-94,28,'in'), (14,96,'in'),
                  (-158,-88,'out'), (150,-96,'out'), (146,98,'out'), (-150,86,'out'),
                  (-114,-34,'edge'), (62,-100,'edge')]:
    x, y = cx+dx, cy+dy
    col = GOOD if k == 'in' else (BAD if k == 'out' else AMB)
    if k == 'edge':
        b.write('<circle cx="%d" cy="%d" r="27" fill="%s" fill-opacity=".14" stroke="%s" stroke-dasharray="3 3"/>' % (x, y, AMB, AMB))
    b.write('<circle cx="%d" cy="%d" r="8" fill="%s" fill-opacity=".2" stroke="%s" stroke-width="2"/>' % (x, y, col, col))
    b.write('<circle cx="%d" cy="%d" r="2.6" fill="%s"/>' % (x, y, col))
b.write(T(190, 292, 'area di saggio vista dall\'alto', 10, fill=FAINT, weight='600'))
FIG['area_pianta'] = dict(
    svg=svg(W, H, b.getvalue(), 'Area di saggio dall\'alto con alberi dentro, fuori e al confine'),
    cap='<b>Quali alberi entrano nel conteggio.</b> Si cavalletta ogni albero il cui <b>centro del fusto a '
        '1,30 m</b> cade dentro il cerchio — in <span class="cIn">verde</span>. Quelli in '
        '<span class="cOut">rosso</span> restano fuori e non si contano. Gli alberi in '
        '<span class="cEdge">ambra</span> sono a cavallo del confine: lì il GPS non basta e decide la '
        'cordella, misurando dal centro dell\'area all\'asse del fusto. Il cerchio ha il perimetro più corto '
        'a parità di superficie, quindi il minor numero di casi dubbi: è la ragione per cui in dendrometria '
        'le aree di saggio sono circolari.')

# ══════════════════════════════════════════════════════════════
# 5 · Correzione della pendenza
# ══════════════════════════════════════════════════════════════
W, H = 460, 260
b = io.StringIO(); b.write(DEFS)
ax, ay = 56, 196
al = 26*math.pi/180
L = 306
bx, by = ax+L*math.cos(al), ay-L*math.sin(al)
b.write('<path d="M %d %d L %.1f %.1f L %.1f %d Z" fill="%s" opacity=".55"/>' % (ax, ay, bx, by, bx, ay, SURF2))
b.write('<line x1="%d" y1="%d" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="3.5"/>' % (ax, ay, bx, by, WOOD))
b.write('<line x1="%d" y1="%d" x2="%.1f" y2="%d" stroke="%s" stroke-width="1.6" stroke-dasharray="6 4"/>' % (ax, ay, bx, ay, LINE))
b.write('<path d="M %d %d A 50 50 0 0 0 %.1f %.1f" fill="none" stroke="%s" stroke-width="1.8"/>'
        % (ax+50, ay, ax+50*math.cos(al), ay-50*math.sin(al), AMB))
b.write(T(ax+64, ay-14, 'α', 14, anchor='start', fill=AMB, weight='800'))
b.write(AR(ax, ay+26, bx, ay+26, INK, 'k', 1.8, both=True))
b.write(T((ax+bx)/2, ay+42, 'r  in proiezione orizzontale', 11, fill=INK, weight='800'))
b.write('<line x1="%d" y1="%d" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.8" '
        'marker-end="url(#ao)" marker-start="url(#ao)"/>' % (ax-18, ay-9, bx-18, by-9, S2))
b.write('<text font-size="11" fill="%s" font-weight="800" text-anchor="middle" '
        'transform="translate(%.0f %.0f) rotate(-26)">r′ = r / cos α</text>' % (S2, (ax+bx)/2-16, (ay+by)/2-18))
b.write('<circle cx="%d" cy="%d" r="5.5" fill="%s"/>' % (ax, ay, BRAND))
b.write(T(ax, ay-16, 'centro', 10, fill=BRAND))
b.write(T(230, 26, '26°  ·  r = 13 m  →  r′ = 14,5 m', 13, fill=INK, weight='800'))
FIG['pendenza'] = dict(
    svg=svg(W, H, b.getvalue(), 'Correzione della pendenza del raggio dell\'area di saggio'),
    cap='<b>Perché in pendenza la cordella va stesa più lunga.</b> La superficie di riferimento in '
        'dendrometria è sempre la <b>proiezione orizzontale</b>, la stessa che si usa in catasto. Su un '
        'versante inclinato, per delimitare un cerchio la cui proiezione ha raggio r bisogna stendere la '
        'cordella di r′ = r / cos α nelle direzioni di massima pendenza. Su un versante a 26° con raggio '
        '13 m servono 14,5 m: trascurare la correzione gonfia del 10% le piante per ettaro e, con esse, '
        'la provvigione. Lungo le curve di livello la correzione non serve.')

# ══════════════════════════════════════════════════════════════
# 6 · Ipsometro a due angoli
# ══════════════════════════════════════════════════════════════
W, H = 460, 280
b = io.StringIO(); b.write(DEFS)
ox, oy = 66, 182
tx = 350
b.write('<line x1="26" y1="222" x2="434" y2="222" stroke="%s" stroke-width="2"/>' % LINE)
b.write('<rect x="%d" y="66" width="16" height="156" fill="%s" opacity=".85"/>' % (tx-8, WOOD))
for yy, hw in [(66, 36), (112, 46), (160, 56)]:
    b.write('<path d="M %d %d L %d %d L %d %d Z" fill="%s" opacity=".45"/>'
            % (tx-hw, yy+46, tx, yy-8, tx+hw, yy+46, BRAND))
b.write('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.5" stroke-dasharray="6 4"/>' % (ox, oy, tx+52, oy, LINE))
b.write('<line x1="%d" y1="%d" x2="%d" y2="20" stroke="%s" stroke-width="2.2"/>' % (ox, oy, tx, S2))
b.write('<line x1="%d" y1="%d" x2="%d" y2="222" stroke="%s" stroke-width="2.2"/>' % (ox, oy, tx, S1))
b.write('<path d="M %d %d A 58 58 0 0 0 %.1f %.1f" fill="none" stroke="%s" stroke-width="1.8"/>'
        % (ox+58, oy, ox+54.5, oy-19.7, S2))
b.write(T(ox+74, oy-22, 'α cima', 11, anchor='start', fill=S2, weight='800'))
b.write('<path d="M %d %d A 42 42 0 0 1 %.1f %.1f" fill="none" stroke="%s" stroke-width="1.8"/>'
        % (ox+42, oy, ox+41.2, oy+8.2, S1))
b.write(T(ox+58, oy+24, 'α base', 11, anchor='start', fill=S1, weight='800'))
b.write('<circle cx="%d" cy="%d" r="5.5" fill="%s"/>' % (ox, oy, INK))
b.write(T(ox-10, oy-10, 'occhio', 10, anchor='end', fill=INK))
b.write(AR(ox, 250, tx, 250, INK, 'k', 1.8, both=True))
b.write(T((ox+tx)/2, 266, 'D — distanza orizzontale', 11, fill=INK, weight='800'))
b.write('<rect x="20" y="16" width="250" height="30" rx="7" fill="%s" fill-opacity=".12"/>' % BRAND)
b.write(T(32, 36, 'h = D · ( tan α cima − tan α base )', 13, anchor='start', fill=BRAND, weight='800'))
FIG['ipso_schema'] = dict(
    svg=svg(W, H, b.getvalue(), 'Schema dell\'ipsometro trigonometrico a due angoli'),
    cap='<b>Perché servono due angoli e non uno.</b> Gli angoli sono <b>con segno</b>: positivo sopra '
        'l\'orizzonte, negativo sotto. Se la base dell\'albero sta più in basso dei tuoi occhi, il suo '
        'contributo si somma invece di sottrarsi. Il vantaggio del doppio angolo è che <b>l\'altezza a cui '
        'tieni il telefono si semplifica da sola</b>: non devi misurarla né stimarla. È il principio degli '
        'ipsometri professionali Blume-Leiss e Vertex. La distanza D va misurata in orizzontale e conviene '
        'sia almeno pari all\'altezza presunta: più ti avvicini, più un errore di mezzo grado diventa metri.')

# ══════════════════════════════════════════════════════════════
# 7 · Il GPS al confine
# ══════════════════════════════════════════════════════════════
W, H = 380, 268
b = io.StringIO(); b.write(DEFS)
cx, cy, R = 128, 126, 96
b.write('<circle cx="%d" cy="%d" r="%d" fill="%s" fill-opacity=".06" stroke="%s" stroke-width="2.4"/>' % (cx, cy, R, BRAND, BRAND))
b.write(T(cx-14, cy+R+26, 'confine dell\'area di saggio', 10.5, fill=BRAND, weight='800'))
px, py = cx+74, cy-48
b.write('<circle cx="%d" cy="%d" r="56" fill="%s" fill-opacity=".17" stroke="%s" stroke-opacity=".55" stroke-dasharray="4 3"/>' % (px, py, S1, S1))
b.write('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.4" stroke-dasharray="3 3"/>' % (px, py, px-40, py+34, BAD))
b.write('<circle cx="%d" cy="%d" r="7.5" fill="%s" stroke="%s" stroke-width="2.4"/>' % (px, py, S1, SURF))
b.write('<circle cx="%d" cy="%d" r="5.5" fill="%s"/>' % (px-40, py+34, BAD))
b.write(T(370, 40, 'letto dal GPS', 10.5, anchor='end', fill=S1, weight='800'))
b.write(AR(348, 48, px+18, py-16, S1, 'b', 1.4))
b.write(T(368, 200, 'posizione vera', 10.5, anchor='end', fill=BAD, weight='800'))
b.write(AR(296, 192, px-30, py+44, BAD, 'k', 1.4))
FIG['gps_confine'] = dict(
    svg=svg(W, H, b.getvalue(), 'Il cerchio di incertezza del GPS a cavallo del confine'),
    cap='<b>Perché al confine il GPS non decide.</b> Il cerchio azzurro è l\'incertezza dichiarata dal '
        'ricevitore: la posizione vera cade lì dentro con probabilità di circa il 68%, e una volta su tre '
        'sta anche più lontano. Quando quel cerchio è a cavallo del confine, il sensore non può dire da che '
        'parte sei. Sotto le chiome un telefono comune sbaglia di 5–12 m, su un raggio di 13 m: '
        'ecco perché la cordella resta lo strumento che decide, e il GPS serve a registrare il centro '
        'dell\'area e a ritrovarlo, non ad aggiudicare gli alberi.')

out = io.StringIO()
out.write('<!-- figure generate da mkfig.py — non modificare a mano -->\n')
for k, v in FIG.items():
    out.write('<!--FIG:%s--><figure class="figbox">%s<figcaption>%s</figcaption></figure><!--/FIG-->\n'
              % (k, v['svg'], v['cap']))
open('_figure.html', 'w', encoding='utf-8').write(out.getvalue())
print('figure generate:', len(FIG), '·', len(out.getvalue()), 'byte')

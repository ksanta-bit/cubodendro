# CuboDendro

Applicazione di campo per la **cubatura del soprassuolo forestale**, l'**ipsometria con l'inclinometro
del telefono** e l'**analisi dendrocronologica** degli anelli di accrescimento.

Realizzata per l'Istituto di Istruzione Superiore **«8 Marzo – K. Lorenz»** di Mirano (VE),
indirizzo Istituto Tecnico Agrario.

**Ideazione e sviluppo: prof. Gianluca Simonetti**  
**Dirigente scolastico: dott.ssa Roberta Gasparini**

---

## Che cosa fa

| Scheda | Funzione |
|---|---|
| **Home** | Schermata di avvio animata e pagina iniziale con l'elenco completo delle funzioni: ogni riquadro porta alla scheda corrispondente |
| **Cubatura** | Aree di saggio circolari, cavallettamento, curva ipsometrica, volume per albero con le equazioni ufficiali INFC, N/ha, G/ha, provvigione, distribuzione diametrica |
| **Altezza** | Ipsometro trigonometrico a due angoli con l'accelerometro del telefono e mirino sulla fotocamera. Calcola e dichiara la propria incertezza |
| **Area** | Registrazione satellitare del centro dell'area mediando molte letture, verdetto dentro/fuori, mappa con sfondo cartografico facoltativo, test di precisione del telefono |
| **Anelli** | Larghezze inserite a mano o misurate su fotografia della carota con taratura sul righello; cinque metodi di detrending, cronologia di sito, r̄ ed EPS, correlazione con 76 anni di dati climatici incorporati |
| **Tavole** | Volume di un singolo albero, correzione del raggio in pendenza, tavola di cubatura a doppia entrata per sette specie |
| **Guida** | Il promemoria completo delle operazioni di campo |
| **Dati** | Installazione, esportazione e ripristino delle sessioni, crediti e licenze |

## Caratteristiche tecniche

- **Applicazione web installabile (PWA)**: si aggiunge alla schermata Home su Android e iPhone
- **Funziona completamente offline** dopo la prima apertura — indispensabile in bosco, dove non c'è campo
- **Nessun dato esce dal dispositivo**: nessun account, nessun cookie, nessuna analitica
- **Nessuna chiamata di rete**, con un'unica eccezione sotto il controllo dell'utente: lo sfondo
  cartografico della mappa, disattivato di partenza
- **Nessuna dipendenza esterna**: un unico file HTML autonomo, nessuna libreria di terzi
- **Tre sensori, tre permessi**, chiesti solo quando servono e mai all'avvio: accelerometro
  (ipsometro), posizione (scheda Area), fotocamera (mirino e foto delle carote). Tutti richiedono
  `https`: da `file://` il resto dell'app funziona, questi no
- Funziona anche aperta come file locale, con la sola eccezione dell'ipsometro, che richiede `https`
  perché i browser concedono l'accesso ai sensori solo in contesto sicuro

## Struttura del repository

```
index.html              l'applicazione (file unico e autonomo)
privacy.html            informativa privacy
manifest.webmanifest    descrittore PWA
sw.js                   service worker per il funzionamento offline
favicon.ico
icons/                  icone dell'applicazione
src/                    sorgenti separati e build.sh per riassemblare index.html
.nojekyll               disattiva l'elaborazione Jekyll su GitHub Pages
```

Per rigenerare `index.html` dopo una modifica ai sorgenti:

```sh
./build.sh
```

## Pubblicazione su GitHub Pages

1. Crea un repository pubblico (per esempio `cubodendro`) e carica il contenuto di questa cartella.
2. Vai in **Settings → Pages**.
3. In *Source* scegli **Deploy from a branch**, ramo `main`, cartella `/ (root)`. Salva.
4. Dopo un paio di minuti l'app è online a `https://<utente>.github.io/cubodendro/`.

Il file `.nojekyll` serve a impedire che GitHub ignori file e cartelle: non va rimosso.

**Dopo ogni aggiornamento** cambia il numero di versione della costante `CACHE` in `sw.js`
(per esempio da `cubodendro-v3.0.0` a `cubodendro-v3.0.1`): è quello che dice ai telefoni già
installati di scaricare la versione nuova.

## Fonti e attribuzioni

- **Equazioni di volume** — Tabacchi G., Di Cosmo L., Gasparini P., Morelli S. (2011), *Stima del volume
  e della fitomassa delle principali specie forestali italiane*, CRA-MPF, Trento. Equazioni ufficiali
  dell'Inventario Nazionale delle Foreste e dei Serbatoi Forestali di Carbonio (INFC).
- **Dati climatici** — rianalisi ERA5-Land del Copernicus Climate Change Service (C3S) / ECMWF,
  ottenuta tramite [Open-Meteo](https://open-meteo.com/), licenza CC BY 4.0.
  *Generated using Copernicus Climate Change Service information (2026). Weather data by Open-Meteo.com.*
  Né il C3S né l'ECMWF rispondono dell'uso qui fattone.
- **Metodo dendrocronologico** — Fritts (1976); Cook (1987); Wigley, Briffa & Jones (1984) per l'EPS.
- **Cartografia** — sfondo facoltativo © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, licenza ODbL 1.0.
- **Accuratezza del posizionamento in bosco** — Tomaštík J. et al. (2021), *Advances in smartphone
  positioning in forests*, Forestry 94(2): 292–310.

## Avvertenza

Strumento didattico. Le stime prodotte hanno finalità formativa e non sostituiscono un rilievo
dendrometrico professionale, una perizia estimativa o un piano di assestamento forestale.

## Copyright

© 2026 Gianluca Simonetti — I.I.S. «8 Marzo – K. Lorenz», Mirano (VE).
Dirigente scolastico: dott.ssa Roberta Gasparini.
Il marchio dell'Istituto è utilizzato con l'autorizzazione dell'Istituto stesso, che ne è titolare.

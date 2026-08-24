/**
 * DendroCubo — ricezione dei rilievi in un Foglio Google
 * ---------------------------------------------------------------
 * I.I.S. «8 Marzo – K. Lorenz», Mirano (VE) — Istituto Tecnico Agrario
 * Ideazione e sviluppo: prof. Gianluca Simonetti
 * Licenza CC BY-NC-SA 4.0
 *
 * A CHE SERVE
 * I telefoni degli allievi spediscono qui il rilievo; questo script
 * lo scrive nel foglio, diviso in schede: Rilievi, Alberi, Altezze,
 * Anelli, Pendenze, Invii.
 *
 * COME SI INSTALLA (una volta sola, dal foglio del docente)
 *   1. Crea un Foglio Google nella tua cartella Drive.
 *   2. Estensioni → Apps Script.
 *   3. Cancella tutto e incolla questo file.
 *   4. Cambia CHIAVE qui sotto con una parola tua.
 *   5. Distribuisci → Nuova distribuzione → Applicazione web
 *        · Esegui come:   Me stesso
 *        · Chi ha accesso: Chiunque
 *      Autorizza quando lo chiede (è il tuo script sul tuo foglio).
 *   6. Copia l'indirizzo che finisce per /exec e incollalo nell'app,
 *      insieme alla chiave.
 *
 * NOTA SULLA CHIAVE
 * «Chiunque» significa che l'indirizzo, se qualcuno lo conosce,
 * raggiunge lo script: la chiave serve a far scartare tutto quello
 * che non arriva dalla tua classe. Non è una password robusta ed è
 * bene saperlo — ma per un foglio di misure forestali è adeguata.
 * Se l'indirizzo dovesse girare troppo, basta cambiare la chiave e
 * ridarla agli allievi: le vecchie spedizioni smettono di passare.
 */

var CHIAVE = 'cambiami';   // <<< METTI QUI LA TUA PAROLA

/* --------------------------------------------------------------- */

var SCHEDE = {
  Rilievi:  ['ricevuto','id_rilievo','nome','gruppo','area','raggio_m','soglia_cm',
             'creato','aggiornato','centro_lat','centro_lon','precisione_m',
             'n_alberi','n_altezze','n_anelli','n_pendenze'],
  Alberi:   ['ricevuto','id_rilievo','rilievo','gruppo','n','area_saggio','specie',
             'd1_cm','d2_cm','d_medio_cm','h_misurata_m','h_usata_m','g_m2','volume_m3'],
  Altezze:  ['ricevuto','id_rilievo','rilievo','gruppo','n','riferimento','metodo',
             'dist_base_m','dist_cima_m','dist_orizz_m','angolo_base_gradi',
             'angolo_cima_gradi','altezza_m','incertezza_m'],
  Anelli:   ['ricevuto','id_rilievo','rilievo','gruppo','carota','anno_iniziale',
             'n_anello','anno','larghezza_mm'],
  Pendenze: ['ricevuto','id_rilievo','rilievo','gruppo','n','gradi','percento'],
  Invii:    ['ricevuto','esito','id_rilievo','nome','gruppo','righe','nota']
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) {
    return risposta(false, 'foglio occupato, riprovare');
  }
  try {
    var dati = JSON.parse(e.postData.contents);

    if (String(dati.chiave || '') !== String(CHIAVE)) {
      registraInvio('rifiutato', dati, 0, 'chiave errata');
      return risposta(false, 'chiave errata');
    }
    if (dati.prova) {
      registraInvio('prova', dati, 0, 'collegamento verificato');
      return risposta(true, 'collegamento attivo');
    }

    var r = dati.rilievo || {};
    var quando = new Date();

    // Un rilievo rispedito SOSTITUISCE il precedente: si cancellano
    // le righe con lo stesso id invece di accumulare doppioni.
    ['Alberi', 'Altezze', 'Anelli', 'Pendenze', 'Rilievi'].forEach(function (nome) {
      rimuoviPerId(nome, r.id);
    });

    scrivi('Rilievi', [[quando, r.id, r.nome, r.gruppo, r.area, r.raggio, r.soglia,
      r.creato, r.aggiornato, r.centro_lat, r.centro_lon, r.centro_precisione,
      (dati.alberi || []).length, (dati.altezze || []).length,
      (dati.anelli || []).length, (dati.pendenze || []).length]]);

    scrivi('Alberi', (dati.alberi || []).map(function (a) {
      return [quando, r.id, r.nome, r.gruppo, a.n, a.ads, a.specie, a.d1, a.d2, a.d,
        a.h_misurata, a.h_usata, a.g, a.volume];
    }));

    scrivi('Altezze', (dati.altezze || []).map(function (a) {
      return [quando, r.id, r.nome, r.gruppo, a.n, a.riferimento, a.metodo,
        a.dist_base, a.dist_cima, a.dist_orizz, a.angolo_base, a.angolo_cima,
        a.altezza, a.incertezza];
    }));

    scrivi('Anelli', (dati.anelli || []).map(function (a) {
      return [quando, r.id, r.nome, r.gruppo, a.carota, a.anno_iniziale,
        a.n_anello, a.anno, a.larghezza_mm];
    }));

    scrivi('Pendenze', (dati.pendenze || []).map(function (p) {
      return [quando, r.id, r.nome, r.gruppo, p.n, p.gradi, p.percento];
    }));

    var righe = (dati.alberi || []).length + (dati.altezze || []).length +
                (dati.anelli || []).length + (dati.pendenze || []).length;
    registraInvio('ricevuto', dati, righe, '');
    return risposta(true, 'ricevute ' + righe + ' righe');

  } catch (err) {
    return risposta(false, String(err));
  } finally {
    lock.releaseLock();
  }
}

/* Aperto nel browser mostra due righe di stato, così si capisce
   subito se la pubblicazione è andata a buon fine. */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<p style="font:15px system-ui">DendroCubo — ricezione rilievi attiva.</p>' +
    '<p style="font:13px system-ui;color:#666">Questo indirizzo va incollato nell\'app, ' +
    'non aperto nel browser.</p>');
}

/* --------------------------------------------------------------- */

function foglio(nome) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(SCHEDE[nome]);
    sh.getRange(1, 1, 1, SCHEDE[nome].length).setFontWeight('bold')
      .setBackground('#1f4e3d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function scrivi(nome, righe) {
  if (!righe || !righe.length) return;
  var sh = foglio(nome);
  sh.getRange(sh.getLastRow() + 1, 1, righe.length, righe[0].length).setValues(righe);
}

function rimuoviPerId(nome, id) {
  if (!id) return;
  var sh = foglio(nome);
  var n = sh.getLastRow();
  if (n < 2) return;
  var col = SCHEDE[nome].indexOf('id_rilievo') + 1;
  if (col < 1) return;
  var v = sh.getRange(2, col, n - 1, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    if (String(v[i][0]) === String(id)) sh.deleteRow(i + 2);
  }
}

function registraInvio(esito, dati, righe, nota) {
  var r = (dati && dati.rilievo) || {};
  scrivi('Invii', [[new Date(), esito, r.id || '', r.nome || '', r.gruppo || '', righe, nota]]);
}

function risposta(ok, messaggio) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok, messaggio: messaggio, errore: ok ? null : messaggio }))
    .setMimeType(ContentService.MimeType.JSON);
}

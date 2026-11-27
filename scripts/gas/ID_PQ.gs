/**
 * ============================================================================
 * LifeOS v3.0 — 🎭 PQ_Saboteur_Brick (ID_PQ)
 * Production Apps Script: Append-Only Historical Snapshot Archiver (Gate 2)
 * ============================================================================
 * Spreadsheet ID : 1NhqPJDFOp91qOp5Y9hPe0rIuqECKU_b08cZYXZAqxeE
 * Linked Form ID : 1OFsoVZQNhQCjGvxw7bBOLnpGt2T-ptUY5JJbX3IuuaI
 *
 * LAW 1 COMPLIANCE: Reads 'Form Responses 1' strictly READ-ONLY; never alters it.
 * ZERO-PII BOUNDARY: Archives numeric Saboteur 0–10 scales & state tags only.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const PQ_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '1NhqPJDFOp91qOp5Y9hPe0rIuqECKU_b08cZYXZAqxeE',
  RAW_TAB: 'Form Responses 1',
  KEY_TAB: 'PQ_Scoring_Key',
  HISTORY_TAB: 'Historical_Snapshots',
  META_TAB: 'MODULE_META',
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'archivePQSnapshotOnSubmit',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎭 LifeOS PQ Saboteurs')
    .addItem('Archive Missing Runs to Historical_Snapshots', 'backfillMissingPQSnapshots')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Installable onFormSubmit trigger: locks, evaluates the newly submitted PQ run
 * directly against PQ_Scoring_Key, and appends an immutable static snapshot row
 * to Historical_Snapshots (idempotent deduplication on Timestamp).
 */
function archivePQSnapshotOnSubmit(e) {
  backfillMissingPQSnapshots();
}

/**
 * Scans all rows in Form Responses 1 and appends any unarchived timestamp
 * into Historical_Snapshots as static values (matching the exact 16-column schema).
 */
function backfillMissingPQSnapshots() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('PQ snapshot archive skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(PQ_GAS_CFG.SPREADSHEET_ID);
    const rawSheet = ss.getSheetByName(PQ_GAS_CFG.RAW_TAB);
    const keySheet = ss.getSheetByName(PQ_GAS_CFG.KEY_TAB);
    const histSheet = ss.getSheetByName(PQ_GAS_CFG.HISTORY_TAB);
    if (!rawSheet || !keySheet || !histSheet) {
      throw new Error('Missing Form Responses 1, PQ_Scoring_Key, or Historical_Snapshots.');
    }

    SpreadsheetApp.flush();

    // Build column-to-saboteur lookup from PQ_Scoring_Key (Cols B=Detected Form Col, C=Saboteur, D=Sub-Target)
    const keyRows = keySheet.getDataRange().getDisplayValues().slice(1);
    const colMap = [];
    keyRows.forEach((r) => {
      const colLetter = String(r[1] || '').trim().toUpperCase();
      const saboteur = String(r[2] || '').trim();
      const subTarget = String(r[3] || '').trim();
      if (!colLetter || !saboteur) return;
      const colIdx = colLetterToZeroIndex_(colLetter);
      if (colIdx >= 0) {
        colMap.push({ colIdx: colIdx, saboteur: saboteur, subTarget: subTarget });
      }
    });

    // Collect already-archived timestamps for idempotent deduplication
    const existingRows = histSheet.getDataRange().getDisplayValues();
    const archivedKeys = new Set();
    for (let i = 1; i < existingRows.length; i++) {
      const ts = normalizeTsKey_(existingRows[i][0]);
      if (ts) archivedKeys.add(ts);
    }

    const rawValues = rawSheet.getDataRange().getValues();
    const rawHeaders = rawValues.length > 0 ? rawValues[0].map((h) => String(h || '').toLowerCase()) : [];
    const ctxCol = rawHeaders.findIndex((h) => h.indexOf('context') !== -1);
    const pqScoreCol = rawHeaders.findIndex((h) => h.indexOf('quotient') !== -1 || h.indexOf('pq score') !== -1);
    const repsCol = rawHeaders.findIndex((h) => h.indexOf('rep') !== -1);

    let appended = 0;
    for (let r = 1; r < rawValues.length; r++) {
      const row = rawValues[r];
      if (!row[0]) continue;
      const formattedTs = formatTimestamp_(row[0]);
      const tsKey = normalizeTsKey_(formattedTs);
      if (archivedKeys.has(tsKey)) continue;

      // Aggregate 1-5 scores per Saboteur and scale to 0-10: ((avg - 1) / 4) * 10
      const buckets = {};
      let judgeSelfVals = [];
      colMap.forEach((item) => {
        const val = parseLikertNumeric_(row[item.colIdx]);
        if (val === null) return;
        if (!buckets[item.saboteur]) buckets[item.saboteur] = [];
        buckets[item.saboteur].push(val);
        if (item.subTarget === 'Judge (Self)') judgeSelfVals.push(val);
      });

      const scale10 = (arr) => {
        if (!arr || arr.length === 0) return '';
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        return Number((((avg - 1) / 4) * 10).toFixed(1));
      };

      const context = ctxCol >= 0 && row[ctxCol] ? String(row[ctxCol]).trim() : 'Standard';
      const pqQuotient = pqScoreCol >= 0 && row[pqScoreCol] !== '' ? Number(row[pqScoreCol]) : '';
      const vortexState = pqQuotient === '' ? 'Unlogged' : (pqQuotient >= 75 ? 'Sage_Vortex' : 'Saboteur_Drag');
      const dailyReps = repsCol >= 0 && row[repsCol] !== '' ? row[repsCol] : '';

      // Exact 16-column layout of Historical_Snapshots!A:P
      histSheet.appendRow([
        formattedTs,
        context,
        pqQuotient,
        vortexState,
        dailyReps,
        scale10(buckets['Hyper-Rational']),
        scale10(buckets['Avoider']),
        scale10(buckets['Restless']),
        scale10(buckets['Pleaser']),
        scale10(buckets['Hyper-Achiever']),
        scale10(buckets['Victim']),
        scale10(buckets['Stickler']),
        scale10(buckets['Controller']),
        scale10(buckets['Hyper-Vigilant']),
        scale10(buckets['Judge']),
        scale10(judgeSelfVals),
      ]);

      archivedKeys.add(tsKey);
      appended++;
    }

    stampPQMeta_(ss, 'Last_Snapshot_Archive', new Date().toISOString() + ' (+' + appended + ' rows)');
    Logger.log('PQ snapshot archive complete: +' + appended + ' new row(s).');
  } finally {
    lock.releaseLock();
  }
}

function colLetterToZeroIndex_(letters) {
  let num = 0;
  for (let i = 0; i < letters.length; i++) {
    num = num * 26 + (letters.charCodeAt(i) - 64);
  }
  return num - 1;
}

function parseLikertNumeric_(val) {
  if (typeof val === 'number' && !isNaN(val)) return val;
  const m = String(val || '').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function formatTimestamp_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  }
  return String(val || '').trim();
}

function normalizeTsKey_(str) {
  return String(str || '').trim().slice(0, 16);
}

function stampPQMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(PQ_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_PQ.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit -> archivePQSnapshotOnSubmit
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(PQ_GAS_CFG.SPREADSHEET_ID);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === PQ_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(PQ_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  backfillMissingPQSnapshots();
  stampPQMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ PQ Saboteur Brick Triggers Armed!\n\n' +
      '• On form submit → archivePQSnapshotOnSubmit\n' +
      '• Historical_Snapshots verified and deduplicated.'
    );
  } catch (e) {
    Logger.log('PQ Saboteur triggers armed (headless run).');
  }
}

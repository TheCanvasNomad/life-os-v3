/**
 * ============================================================================
 * LifeOS v3.0 — 🧭 RIASEC_Brick (ID_RIASEC)
 * Production Apps Script: Append-Only Holland Code Snapshot Archiver (Gate 2)
 * ============================================================================
 * Spreadsheet ID : 1RmJ9bDzm6Vs59EC1BV99lqHnYxgp-bchV589rQc6ybM
 * Linked Form ID : 1oG9UIE5IFPSqnDhb5jzFcW-6_y7YTupB1DbvIRN7I8w
 *
 * LAW 1 COMPLIANCE: NEVER modifies 'RIASEC_Intake' (strictly read-only Layer 1).
 * ZERO-PII BOUNDARY: Archives Holland Code, differentiation & R-I-A-S-E-C scores.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const RIASEC_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '1RmJ9bDzm6Vs59EC1BV99lqHnYxgp-bchV589rQc6ybM',
  RAW_TAB: 'RIASEC_Intake',
  LOOKER_TAB: 'LOOKER_RIASEC',
  SIGNALS_TAB: 'SIGNALS_OUT',
  ARCHIVE_TAB: 'RIASEC_SNAPSHOT_ARCHIVE',
  META_TAB: 'MODULE_META',
  ARCHIVE_HEADERS: Object.freeze([
    'Archive_ID',
    'Run_Timestamp',
    'Archived_UTC',
    'Holland_Code',
    'Differentiation_Pct',
    'Consistency_State',
    'R_Score_40',
    'I_Score_40',
    'A_Score_40',
    'S_Score_40',
    'E_Score_40',
    'C_Score_40',
  ]),
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'archiveRiasecSnapshotOnSubmit',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧭 LifeOS RIASEC')
    .addItem('Archive Latest RIASEC Run Now', 'archiveRiasecSnapshotOnSubmit')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Installable onFormSubmit trigger:
 * Captures the evaluated 3-letter Holland Code and 6 R-I-A-S-E-C dimension scores
 * as an immutable historical row in RIASEC_SNAPSHOT_ARCHIVE (timestamp deduplicated).
 */
function archiveRiasecSnapshotOnSubmit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('RIASEC snapshot skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(RIASEC_GAS_CFG.SPREADSHEET_ID);
    SpreadsheetApp.flush();

    const rawSheet = ss.getSheetByName(RIASEC_GAS_CFG.RAW_TAB);
    const sigSheet = ss.getSheetByName(RIASEC_GAS_CFG.SIGNALS_TAB);
    const lookerSheet = ss.getSheetByName(RIASEC_GAS_CFG.LOOKER_TAB);
    if (!rawSheet || !sigSheet) {
      throw new Error('Missing RIASEC_Intake or SIGNALS_OUT tab.');
    }

    const lastRawRow = rawSheet.getLastRow();
    if (lastRawRow < 2) return;
    const latestRunTs = String(rawSheet.getRange(lastRawRow, 1).getDisplayValue() || '').trim();
    if (!latestRunTs) return;

    const archive = getOrCreateRiasecArchiveSheet_(ss);
    const existing = archive.getDataRange().getDisplayValues();
    for (let i = 1; i < existing.length; i++) {
      if (String(existing[i][1] || '').trim() === latestRunTs) {
        Logger.log('RIASEC run already archived: ' + latestRunTs);
        stampRiasecMeta_(ss, 'Last_Snapshot_Archive', new Date().toISOString() + ' — DEDUPLICATED');
        return;
      }
    }

    const sigMap = {};
    sigSheet.getDataRange().getDisplayValues().slice(1).forEach((r) => {
      if (r[0]) sigMap[String(r[0]).trim()] = { raw: r[4], norm: r[5], state: r[6] };
    });

    const dimScores = {};
    if (lookerSheet) {
      lookerSheet.getDataRange().getDisplayValues().slice(1).forEach((r) => {
        if (r[0] === 'RIASEC_DIMENSION' && r[1]) {
          dimScores[String(r[1]).trim().toUpperCase()] = r[3];
        }
      });
    }

    const archiveId = 'RIASEC-RUN-' + String(existing.length).padStart(3, '0');
    const codeSig = sigMap['RIASEC_HOLLAND_CODE'] || {};

    archive.appendRow([
      archiveId,
      latestRunTs,
      new Date().toISOString(),
      codeSig.raw || '',
      codeSig.norm || '',
      codeSig.state || '',
      dimScores['R'] || '',
      dimScores['I'] || '',
      dimScores['A'] || '',
      dimScores['S'] || '',
      dimScores['E'] || '',
      dimScores['C'] || '',
    ]);

    stampRiasecMeta_(ss, 'Last_Snapshot_Archive', new Date().toISOString() + ' — ARCHIVED ' + archiveId);
    Logger.log('Archived RIASEC snapshot: ' + archiveId);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateRiasecArchiveSheet_(ss) {
  let sheet = ss.getSheetByName(RIASEC_GAS_CFG.ARCHIVE_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(RIASEC_GAS_CFG.ARCHIVE_TAB);
    sheet.setTabColor('#8B5CF6');
    sheet.setHiddenGridlines(true);
    sheet.getRange(1, 1, 1, RIASEC_GAS_CFG.ARCHIVE_HEADERS.length)
      .setValues([RIASEC_GAS_CFG.ARCHIVE_HEADERS])
      .setFontWeight('bold')
      .setBackground('#1E293B')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function stampRiasecMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(RIASEC_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_RIASEC.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit -> archiveRiasecSnapshotOnSubmit
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(RIASEC_GAS_CFG.SPREADSHEET_ID);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === RIASEC_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(RIASEC_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  archiveRiasecSnapshotOnSubmit();
  stampRiasecMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ RIASEC Brick Triggers Armed!\n\n' +
      '• On form submit → archiveRiasecSnapshotOnSubmit\n' +
      '• RIASEC_SNAPSHOT_ARCHIVE verified.'
    );
  } catch (e) {
    Logger.log('RIASEC triggers armed (headless run).');
  }
}

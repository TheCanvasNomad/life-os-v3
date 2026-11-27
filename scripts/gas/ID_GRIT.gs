/**
 * ============================================================================
 * LifeOS v3.0 — 🔥 Grit Score Assessment (ID_GRIT)
 * Production Apps Script: Append-Only Historical Snapshot Archiver (Gate 2)
 * ============================================================================
 * Spreadsheet ID : 1kCwx6wtYksmt92M3Izwe6oEIVS5uDv3kCLIzCBOJG-s
 * Linked Form ID : 1MKMfXAtb-ooZnGHccTyqjjudk3PyMdwSGKTpXSFKFbY
 *
 * LAW 1 COMPLIANCE: NEVER modifies 'Grit_Intake' (strictly read-only Layer 1).
 * ZERO-PII BOUNDARY: Archives numeric Grit-S / Grit-O / PE / CI scores & tags.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const GRIT_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '1kCwx6wtYksmt92M3Izwe6oEIVS5uDv3kCLIzCBOJG-s',
  RAW_TAB: 'Grit_Intake',
  SIGNALS_TAB: 'SIGNALS_OUT',
  ARCHIVE_TAB: 'GRIT_SNAPSHOT_ARCHIVE',
  META_TAB: 'MODULE_META',
  ARCHIVE_HEADERS: Object.freeze([
    'Archive_ID',
    'Run_Timestamp',
    'Archived_UTC',
    'GRIT_OVERALL_SCORE',
    'GRIT_NORM_0_100',
    'GRIT_PE_SCORE',
    'GRIT_CI_SCORE',
    'GRIT_ARCHETYPE_STATE',
  ]),
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'archiveGritSnapshotOnSubmit',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔥 LifeOS Grit')
    .addItem('Archive Latest Grit Run Now', 'archiveGritSnapshotOnSubmit')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Installable onFormSubmit trigger:
 * Flushes dynamic Scoring_Engine / SIGNALS_OUT formulas after Grit_Intake submit
 * and appends a static immutable snapshot into GRIT_SNAPSHOT_ARCHIVE (idempotent).
 */
function archiveGritSnapshotOnSubmit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Grit snapshot archive skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(GRIT_GAS_CFG.SPREADSHEET_ID);
    SpreadsheetApp.flush();

    const rawSheet = ss.getSheetByName(GRIT_GAS_CFG.RAW_TAB);
    const sigSheet = ss.getSheetByName(GRIT_GAS_CFG.SIGNALS_TAB);
    if (!rawSheet || !sigSheet) {
      throw new Error('Missing Grit_Intake or SIGNALS_OUT tab.');
    }

    const lastRawRow = rawSheet.getLastRow();
    if (lastRawRow < 2) return;
    const latestRunTs = String(rawSheet.getRange(lastRawRow, 1).getDisplayValue() || '').trim();
    if (!latestRunTs) return;

    const archive = getOrCreateGritArchiveSheet_(ss);
    const existing = archive.getDataRange().getDisplayValues();
    for (let i = 1; i < existing.length; i++) {
      if (String(existing[i][1] || '').trim() === latestRunTs) {
        Logger.log('Grit run already archived: ' + latestRunTs);
        stampGritMeta_(ss, 'Last_Snapshot_Archive', new Date().toISOString() + ' — DEDUPLICATED');
        return;
      }
    }

    const sigMap = {};
    const sigRows = sigSheet.getDataRange().getDisplayValues();
    for (let i = 1; i < sigRows.length; i++) {
      const key = String(sigRows[i][0] || '').trim();
      if (!key) continue;
      sigMap[key] = { raw: sigRows[i][4], norm: sigRows[i][5], state: sigRows[i][6] };
    }

    const archiveId = 'GRIT-RUN-' + String(existing.length).padStart(3, '0');
    const overall = sigMap['GRIT_OVERALL_SCORE'] || {};
    const pe = sigMap['GRIT_PERSEVERANCE_EFFORT'] || sigMap['GRIT_PE_SCORE'] || {};
    const ci = sigMap['GRIT_CONSISTENCY_INTEREST'] || sigMap['GRIT_CI_SCORE'] || {};

    archive.appendRow([
      archiveId,
      latestRunTs,
      new Date().toISOString(),
      overall.raw || '',
      overall.norm || '',
      pe.raw || '',
      ci.raw || '',
      overall.state || '',
    ]);

    stampGritMeta_(ss, 'Last_Snapshot_Archive', new Date().toISOString() + ' — ARCHIVED ' + archiveId);
    Logger.log('Archived Grit snapshot: ' + archiveId);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateGritArchiveSheet_(ss) {
  let sheet = ss.getSheetByName(GRIT_GAS_CFG.ARCHIVE_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(GRIT_GAS_CFG.ARCHIVE_TAB);
    sheet.setTabColor('#8B5CF6');
    sheet.setHiddenGridlines(true);
    sheet.getRange(1, 1, 1, GRIT_GAS_CFG.ARCHIVE_HEADERS.length)
      .setValues([GRIT_GAS_CFG.ARCHIVE_HEADERS])
      .setFontWeight('bold')
      .setBackground('#1E293B')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function stampGritMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(GRIT_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_GRIT.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit -> archiveGritSnapshotOnSubmit
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(GRIT_GAS_CFG.SPREADSHEET_ID);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === GRIT_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(GRIT_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  archiveGritSnapshotOnSubmit();
  stampGritMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Grit Score Assessment Triggers Armed!\n\n' +
      '• On form submit → archiveGritSnapshotOnSubmit\n' +
      '• GRIT_SNAPSHOT_ARCHIVE verified.'
    );
  } catch (e) {
    Logger.log('Grit triggers armed (headless run).');
  }
}

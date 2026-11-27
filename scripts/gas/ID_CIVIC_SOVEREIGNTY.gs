/**
 * ============================================================================
 * LifeOS v3.0 — 🏛️ Civic_Sovereignty_Brick (ID_CIVIC_SOVEREIGNTY)
 * Production Apps Script: Append-Only Historical Snapshot Archiver (Gate 2)
 * ============================================================================
 * Spreadsheet ID : 13QRTtBXsCOyIcsRI2jeUhuJFCPjhmDbQtiBQTAni8Yo
 * Linked Form ID : 1_TzoBT8sMzuG2r0N6dmi5oZkU2U-jzHdIHerLMqMPYA
 *
 * LAW 1 COMPLIANCE: NEVER modifies 'Form Responses 1' (strictly read-only).
 * ZERO-PII BOUNDARY: Archives numeric Capture/Sovereignty scores & tier tags only.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const CIVIC_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '13QRTtBXsCOyIcsRI2jeUhuJFCPjhmDbQtiBQTAni8Yo',
  RAW_TAB: 'Form Responses 1',
  SIGNALS_TAB: 'SIGNALS_OUT',
  ARCHIVE_TAB: 'SNAPSHOT_ARCHIVE',
  META_TAB: 'MODULE_META',
  ARCHIVE_HEADERS: Object.freeze([
    'Archive_ID',
    'Run_Timestamp',
    'Archived_UTC',
    'CIVIC_CAPTURE_TOTAL',
    'CIVIC_SOVEREIGNTY_INDEX',
    'CIVIC_CAPTURE_TIER',
    'CIVIC_PRIMARY_VULNERABILITY',
    'CIVIC_STRONGEST_BULWARK',
  ]),
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'archiveCivicSnapshotOnSubmit',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏛️ LifeOS Civic Sovereignty')
    .addItem('Capture Current Snapshot Now', 'archiveCivicSnapshotOnSubmit')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Installable onFormSubmit trigger:
 * Evaluates latest SIGNALS_OUT metrics after form submit and appends an immutable
 * static snapshot row into SNAPSHOT_ARCHIVE (deduplicated by Run_Timestamp).
 */
function archiveCivicSnapshotOnSubmit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Civic Sovereignty snapshot skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(CIVIC_GAS_CFG.SPREADSHEET_ID);
    SpreadsheetApp.flush();

    const rawSheet = ss.getSheetByName(CIVIC_GAS_CFG.RAW_TAB);
    const sigSheet = ss.getSheetByName(CIVIC_GAS_CFG.SIGNALS_TAB);
    if (!rawSheet || !sigSheet) {
      throw new Error('Missing Form Responses 1 or SIGNALS_OUT tab.');
    }

    const lastRawRow = rawSheet.getLastRow();
    if (lastRawRow < 2) return;
    const latestRunTs = String(rawSheet.getRange(lastRawRow, 1).getDisplayValue() || '').trim();
    if (!latestRunTs) return;

    const archive = getOrCreateCivicArchiveSheet_(ss);
    const existing = archive.getDataRange().getDisplayValues();
    for (let i = 1; i < existing.length; i++) {
      if (String(existing[i][1] || '').trim() === latestRunTs) {
        Logger.log('Civic Sovereignty run already archived: ' + latestRunTs);
        stampCivicMeta_(ss, 'Last_Snapshot_Archive', new Date().toISOString() + ' — DEDUPLICATED (' + latestRunTs + ')');
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

    const archiveId = 'CIVIC-RUN-' + String(existing.length).padStart(3, '0');
    const cap = sigMap['CIVIC_CAPTURE_TOTAL'] || {};
    const sov = sigMap['CIVIC_SOVEREIGNTY_INDEX'] || cap;
    const tier = sigMap['CIVIC_CAVE_TIER'] || sigMap['CIVIC_CAPTURE_TIER'] || cap;
    const vuln = sigMap['CIVIC_VULNERABILITY_DIM'] || sigMap['CIVIC_HIGHEST_CAPTURE_DIM'] || {};
    const bulwark = sigMap['CIVIC_BULWARK_DIM'] || sigMap['CIVIC_LOWEST_CAPTURE_DIM'] || {};

    archive.appendRow([
      archiveId,
      latestRunTs,
      new Date().toISOString(),
      cap.raw || '',
      sov.norm || '',
      tier.state || tier.raw || '',
      vuln.raw || vuln.state || '',
      bulwark.raw || bulwark.state || '',
    ]);

    stampCivicMeta_(ss, 'Last_Snapshot_Archive', new Date().toISOString() + ' — ARCHIVED ' + archiveId);
    Logger.log('Archived Civic Sovereignty snapshot: ' + archiveId);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateCivicArchiveSheet_(ss) {
  let sheet = ss.getSheetByName(CIVIC_GAS_CFG.ARCHIVE_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(CIVIC_GAS_CFG.ARCHIVE_TAB);
    sheet.setTabColor('#8B5CF6');
    sheet.setHiddenGridlines(true);
    sheet.getRange(1, 1, 1, CIVIC_GAS_CFG.ARCHIVE_HEADERS.length)
      .setValues([CIVIC_GAS_CFG.ARCHIVE_HEADERS])
      .setFontWeight('bold')
      .setBackground('#1E293B')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function stampCivicMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(CIVIC_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_CIVIC_SOVEREIGNTY.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit -> archiveCivicSnapshotOnSubmit
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(CIVIC_GAS_CFG.SPREADSHEET_ID);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === CIVIC_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(CIVIC_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  archiveCivicSnapshotOnSubmit();
  stampCivicMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Civic Sovereignty Brick Triggers Armed!\n\n' +
      '• On form submit → archiveCivicSnapshotOnSubmit\n' +
      '• SNAPSHOT_ARCHIVE verified.'
    );
  } catch (e) {
    Logger.log('Civic Sovereignty triggers armed (headless run).');
  }
}

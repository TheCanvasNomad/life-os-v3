/**
 * ============================================================================
 * LifeOS v3.0 — ⚖️ Sovereignty_Desire_Brick (ID_SOVEREIGNTY_DESIRE)
 * Production Apps Script: Append-Only Historical Snapshot Archiver (Gate 2)
 * ============================================================================
 * Spreadsheet ID : 1eNHenM8QdiE_onsNYkkMJyvXOlo5D7y-n8e7LF5HpTc
 * Linked Form ID : 1-a-vSCiBrDuKnwTqZI5I-OxTOVsYoCXvtsRVqOzlOpo
 *
 * LAW 1 COMPLIANCE: NEVER modifies 'Form Responses 1' (strictly read-only).
 * ZERO-PII BOUNDARY: Archives only numeric composites, archetype code & signals.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const SOV_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '1eNHenM8QdiE_onsNYkkMJyvXOlo5D7y-n8e7LF5HpTc',
  RAW_TAB: 'Form Responses 1',
  SIGNALS_TAB: 'SIGNALS_OUT',
  ARCHIVE_TAB: 'SNAPSHOT_ARCHIVE',
  META_TAB: 'MODULE_META',
  ARCHIVE_HEADERS: Object.freeze([
    'Archive_ID',
    'Run_Timestamp',
    'Archived_UTC',
    'SOV_COMPOSITE_SCORE',
    'SOV_COMPOSITE_STATE',
    'SOV_ARCHETYPE',
    'SOV_PROFILE_PATTERN',
    'SOV_PRIMARY_BOTTLENECK',
    'SOV_PEAK_DIMENSION',
  ]),
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'archiveSovereigntySnapshotOnSubmit',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚖️ LifeOS Sovereignty')
    .addItem('Capture Current Snapshot Now', 'archiveSovereigntySnapshotOnSubmit')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Installable onFormSubmit trigger:
 * Flushes dynamic SCORING_ENGINE / SIGNALS_OUT formulas, then appends an immutable
 * static snapshot row into SNAPSHOT_ARCHIVE (deduplicated by Run_Timestamp).
 */
function archiveSovereigntySnapshotOnSubmit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Sovereignty snapshot skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(SOV_GAS_CFG.SPREADSHEET_ID);
    SpreadsheetApp.flush();

    const rawSheet = ss.getSheetByName(SOV_GAS_CFG.RAW_TAB);
    const sigSheet = ss.getSheetByName(SOV_GAS_CFG.SIGNALS_TAB);
    if (!rawSheet || !sigSheet) {
      throw new Error('Missing Form Responses 1 or SIGNALS_OUT tab.');
    }

    const lastRawRow = rawSheet.getLastRow();
    if (lastRawRow < 2) return;
    const latestRunTs = String(rawSheet.getRange(lastRawRow, 1).getDisplayValue() || '').trim();
    if (!latestRunTs) return;

    const archive = getOrCreateSovArchiveSheet_(ss);
    const existing = archive.getDataRange().getDisplayValues();
    for (let i = 1; i < existing.length; i++) {
      if (String(existing[i][1] || '').trim() === latestRunTs) {
        Logger.log('Sovereignty run already archived: ' + latestRunTs);
        stampSovereigntyHeartbeat_(ss, 'DEDUPLICATED (' + latestRunTs + ')');
        return;
      }
    }

    // Read evaluated SIGNALS_OUT values (Zero-PII numeric aggregates only)
    const sigMap = {};
    const sigRows = sigSheet.getDataRange().getDisplayValues();
    for (let i = 1; i < sigRows.length; i++) {
      const key = String(sigRows[i][0] || '').trim();
      if (!key) continue;
      sigMap[key] = {
        raw: sigRows[i][4],
        norm: sigRows[i][5],
        state: sigRows[i][6],
      };
    }

    const archiveId = 'SOV-RUN-' + String(existing.length).padStart(3, '0');
    const comp = sigMap['SOV_COMPOSITE_SCORE'] || {};
    const arch = sigMap['SOV_ARCHETYPE'] || sigMap['SOV_DOMINANT_ARCHETYPE'] || {};
    const btl = sigMap['SOV_BOTTLENECK_DIM'] || sigMap['SOV_LOWEST_DIMENSION'] || {};
    const peak = sigMap['SOV_PEAK_DIM'] || sigMap['SOV_HIGHEST_DIMENSION'] || {};

    archive.appendRow([
      archiveId,
      latestRunTs,
      new Date().toISOString(),
      comp.norm || comp.raw || '',
      comp.state || '',
      arch.raw || arch.state || '',
      comp.state || '',
      btl.raw || btl.state || '',
      peak.raw || peak.state || '',
    ]);

    stampSovereigntyHeartbeat_(ss, 'ARCHIVED ' + archiveId + ' (' + latestRunTs + ')');
    Logger.log('Archived Sovereignty snapshot: ' + archiveId);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSovArchiveSheet_(ss) {
  let sheet = ss.getSheetByName(SOV_GAS_CFG.ARCHIVE_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(SOV_GAS_CFG.ARCHIVE_TAB);
    sheet.setTabColor('#8B5CF6');
    sheet.setHiddenGridlines(true);
    sheet.getRange(1, 1, 1, SOV_GAS_CFG.ARCHIVE_HEADERS.length)
      .setValues([SOV_GAS_CFG.ARCHIVE_HEADERS])
      .setFontWeight('bold')
      .setBackground('#1E293B')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function stampSovereigntyHeartbeat_(ss, statusText) {
  const meta = ss.getSheetByName(SOV_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'Last_Snapshot_Archive') {
      meta.getRange(i + 1, 2).setValue(new Date().toISOString() + ' — ' + statusText);
      return;
    }
  }
  meta.appendRow(['Last_Snapshot_Archive', new Date().toISOString() + ' — ' + statusText, 'Managed by ID_SOVEREIGNTY_DESIRE.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit -> archiveSovereigntySnapshotOnSubmit
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(SOV_GAS_CFG.SPREADSHEET_ID);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === SOV_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(SOV_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  archiveSovereigntySnapshotOnSubmit();

  const meta = ss.getSheetByName(SOV_GAS_CFG.META_TAB);
  if (meta) {
    const rows = meta.getDataRange().getDisplayValues();
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === 'Apps_Script_Trigger_Status') {
        meta.getRange(i + 1, 2).setValue('ARMED (' + new Date().toISOString() + ')');
        found = true;
        break;
      }
    }
    if (!found) meta.appendRow(['Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')', 'ID_SOVEREIGNTY_DESIRE.gs']);
  }

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Sovereignty & Desire Brick Triggers Armed!\n\n' +
      '• On form submit → archiveSovereigntySnapshotOnSubmit\n' +
      '• SNAPSHOT_ARCHIVE verified.'
    );
  } catch (e) {
    Logger.log('Sovereignty triggers armed (headless run).');
  }
}

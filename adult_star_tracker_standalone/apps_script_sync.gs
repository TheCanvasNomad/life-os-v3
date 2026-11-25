/**
 * Adult_Star_Tracker_Brick — Standalone Apps Script Entry Point & Sync Orchestrator
 *
 * Target Spreadsheet: Adult_Star_Tracker_Brick (1R7hlTI8GfeO5CWPHLPP4jWoEpKDjFd96qJIWmhvu5OI)
 * Operating Mode:     STANDALONE_READY (completely self-contained Google Sheets / Forms automation)
 * Architecture:       Performer-First (female performer as primary entity)
 *
 * Companion modules (paste each into its own .gs file in the Apps Script editor):
 *   - apps_script_boobpedia.gs  (Boobpedia MediaWiki API lookup & roster enrichment)
 *   - apps_script_forms.gs      (Performer-First Google Forms creation & dropdown sync)
 */

const TRACKER_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1R7hlTI8GfeO5CWPHLPP4jWoEpKDjFd96qJIWmhvu5OI',
  BOOBPEDIA_API: 'https://www.boobpedia.com/wiki/api.php',
  TABS: Object.freeze({
    TAXONOMY: 'TAXONOMY_MATRIX',
    PARAMS: 'PARAM_CONFIG_HUB',
    ROSTER: 'MODEL_ROSTER_INDEX',
    PERFORMER_LOGS: 'Performer_Logs',
    RERANKS: 'ReRanks',
    TRAIT_BASELINES: 'Trait_Baseline_Logs',
    NICHE_BASELINES: 'Niche_Baseline_Logs',
    STUDIO_BASELINES: 'Studio_Baseline_Logs',
    TRAIT_INTEL: 'Trait_Intelligence',
    NICHE_INTEL: 'Niche_Intelligence',
    STUDIO_INTEL: 'Studio_Intelligence',
    MODULE_META: 'MODULE_META',
    SIGNALS_OUT: 'SIGNALS_OUT',
  }),
  PROP_KEYS: Object.freeze({
    PERFORMER_LOG_FORM_ID: 'AST_PERFORMER_LOG_FORM_ID',
    RERANK_FORM_ID: 'AST_RERANK_FORM_ID',
    BASELINE_FORM_ID: 'AST_BASELINE_FORM_ID',
  }),
});

/**
 * Adds the standalone Star Tracker menu when the workbook opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⭐ Star Tracker (Standalone)')
    .addItem('Lookup & Add Performer via Boobpedia…', 'promptBoobpediaAddPerformer')
    .addItem('Enrich Selected Roster Row via Boobpedia', 'enrichSelectedRosterRow')
    .addItem('Quick Add Performer Manually…', 'promptManualAddPerformer')
    .addSeparator()
    .addItem('Create Performer-First Google Forms', 'createAllPerformerFirstForms')
    .addItem('Sync Form Dropdowns (Roster / Taxonomy / Studios)', 'syncAllFormDropdowns')
    .addSeparator()
    .addItem('Stamp Local Last_Synced Metadata', 'stampLocalSyncTimestamp')
    .addToUi();
}

/**
 * Guard helper ensuring script only mutates Adult_Star_Tracker_Brick.
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getTrackerSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss && ss.getId() === TRACKER_CONFIG.SPREADSHEET_ID) {
    return ss;
  }
  return SpreadsheetApp.openById(TRACKER_CONFIG.SPREADSHEET_ID);
}

/**
 * Generates the next sequential prefixed ID (e.g., ROST-026, LOG-009, RR-006).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} idColIndex 1-based column index
 * @param {string} prefix e.g., 'ROST-'
 * @return {string}
 */
function getNextPrefixedId_(sheet, idColIndex, prefix) {
  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  if (lastRow >= 2) {
    const values = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues();
    values.forEach(function (row) {
      const text = String(row[0] || '').trim();
      if (text.indexOf(prefix) === 0) {
        const parsed = parseInt(text.slice(prefix.length), 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    });
  }
  const next = String(maxNum + 1).padStart(3, '0');
  return prefix + next;
}

/**
 * Interactive prompt to add a performer manually to MODEL_ROSTER_INDEX without Boobpedia.
 */
function promptManualAddPerformer() {
  const ui = SpreadsheetApp.getUi();
  const nameResp = ui.prompt(
    'Manual Performer Addition',
    'Enter Stage Name (e.g., "Autumn Falls"):',
    ui.ButtonSet.OK_CANCEL
  );
  if (nameResp.getSelectedButton() !== ui.Button.OK) return;
  const stageName = nameResp.getResponseText().trim();
  if (!stageName) return;

  const bwhResp = ui.prompt(
    'Measurements (Optional)',
    'Enter Measurements B-W-H (e.g., "34DD-26-36") or leave blank:',
    ui.ButtonSet.OK_CANCEL
  );
  if (bwhResp.getSelectedButton() !== ui.Button.OK) return;
  const bwh = bwhResp.getResponseText().trim();

  const studioResp = ui.prompt(
    'Primary Studios (Optional)',
    'Enter semicolon-separated studios (e.g., "Vixen; Brazzers") or leave blank:',
    ui.ButtonSet.OK_CANCEL
  );
  if (studioResp.getSelectedButton() !== ui.Button.OK) return;

  const addedRow = appendPerformerToRoster_({
    Stage_Name: stageName,
    Boobpedia_Slug: stageName.toLowerCase().replace(/\s+/g, '_'),
    Debut_Year: '',
    Birth_Year: '',
    Height: '',
    Measurements_BWH: bwh,
    Cup_Tag: extractCupTagFromBwh_(bwh),
    Natural_or_Enhanced: '',
    Heritage_Tag: '',
    Primary_Studios: studioResp.getResponseText().trim(),
    Auto_Categories: '',
    Source_Tag: 'Manual_Entry',
    Active_In_Form: true,
    Custom_Added: true,
  });

  if (addedRow) {
    ui.alert('Added "' + stageName + '" to MODEL_ROSTER_INDEX (row ' + addedRow + '). Run "Sync Form Dropdowns" to refresh Forms.');
  }
}

/**
 * Appends a performer object into MODEL_ROSTER_INDEX if not already present (case-insensitive).
 * Writes blank-safe WHR formula in Column H.
 * @param {Object} rec
 * @return {number|null} Row index written, or null if duplicate
 */
function appendPerformerToRoster_(rec) {
  const ss = getTrackerSpreadsheet_();
  const sheet = ss.getSheetByName(TRACKER_CONFIG.TABS.ROSTER);
  if (!sheet) throw new Error('Missing sheet: ' + TRACKER_CONFIG.TABS.ROSTER);

  const stageName = String(rec.Stage_Name || '').trim();
  if (!stageName) throw new Error('Stage_Name is required.');

  // Duplicate check
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < existing.length; i++) {
      if (String(existing[i][0] || '').trim().toLowerCase() === stageName.toLowerCase()) {
        SpreadsheetApp.getUi().alert('"' + stageName + '" is already in MODEL_ROSTER_INDEX (row ' + (i + 2) + ').');
        return null;
      }
    }
  }

  const nextRow = lastRow + 1;
  const rosterId = getNextPrefixedId_(sheet, 1, 'ROST-');
  const whrFormula =
    '=IF(ISBLANK(G' + nextRow + '), "", IFERROR(ROUND(VALUE(INDEX(SPLIT(G' + nextRow + ', "-"), 1, 2)) / VALUE(INDEX(SPLIT(G' + nextRow + ', "-"), 1, 3)), 3), ""))';

  sheet.getRange(nextRow, 1, 1, 16).setValues([[
    rosterId,
    stageName,
    rec.Boobpedia_Slug || stageName.toLowerCase().replace(/\s+/g, '_'),
    rec.Debut_Year || '',
    rec.Birth_Year || '',
    rec.Height || '',
    rec.Measurements_BWH || '',
    whrFormula,
    rec.Cup_Tag || '',
    rec.Natural_or_Enhanced || '',
    rec.Heritage_Tag || '',
    rec.Primary_Studios || '',
    rec.Auto_Categories || '',
    rec.Source_Tag || 'Manual_Entry',
    rec.Active_In_Form !== false,
    rec.Custom_Added !== false,
  ]]);

  return nextRow;
}

/**
 * Extracts normalized Cup_Tag from a B-W-H string (e.g., '34DD-26-36' -> '34DD/E').
 * @param {string} bwh
 * @return {string}
 */
function extractCupTagFromBwh_(bwh) {
  if (!bwh) return '';
  const match = String(bwh).trim().toUpperCase().match(/^(\d{2})([A-Z]+)/);
  if (!match) return '';
  const band = match[1];
  const letters = match[2];
  if (letters === 'DD' || letters === 'E') return band + 'DD/E';
  if (letters === 'DDD' || letters === 'F') return band + 'DDD/F';
  return band + letters;
}

/**
 * Updates MODULE_META Last_Synced cell locally (no external LifeOS calls).
 */
function stampLocalSyncTimestamp() {
  const ss = getTrackerSpreadsheet_();
  const meta = ss.getSheetByName(TRACKER_CONFIG.TABS.MODULE_META);
  if (!meta) return;
  const data = meta.getDataRange().getValues();
  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ' LOCAL';
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === 'Last_Synced') {
      meta.getRange(i + 1, 2).setValue(nowStr);
      break;
    }
  }
}

/**
 * Installs a safe onFormSubmit trigger for Performer_Logs / ReRanks auto-ID assignment.
 */
function installStandaloneTriggers() {
  const ss = getTrackerSpreadsheet_();
  const existing = ScriptApp.getProjectTriggers();
  const alreadyInstalled = existing.some(function (t) {
    return t.getHandlerFunction() === 'handleStandaloneFormSubmit';
  });
  if (!alreadyInstalled) {
    ScriptApp.newTrigger('handleStandaloneFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
  }
}

/**
 * Trigger handler: ensures new form responses in Performer_Logs, ReRanks, or Baseline tabs
 * receive sequential IDs and triggers optional dropdown refresh.
 * @param {Object} e
 */
function handleStandaloneFormSubmit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const name = sheet.getName();
  const row = e.range.getRow();

  if (name === TRACKER_CONFIG.TABS.PERFORMER_LOGS) {
    if (!sheet.getRange(row, 2).getValue()) {
      sheet.getRange(row, 2).setValue(getNextPrefixedId_(sheet, 2, 'LOG-'));
    }
  } else if (name === TRACKER_CONFIG.TABS.RERANKS) {
    if (!sheet.getRange(row, 2).getValue()) {
      sheet.getRange(row, 2).setValue(getNextPrefixedId_(sheet, 2, 'RR-'));
    }
  } else if (name === TRACKER_CONFIG.TABS.TRAIT_BASELINES) {
    if (!sheet.getRange(row, 2).getValue()) {
      sheet.getRange(row, 2).setValue(getNextPrefixedId_(sheet, 2, 'TBL-'));
    }
  } else if (name === TRACKER_CONFIG.TABS.NICHE_BASELINES) {
    if (!sheet.getRange(row, 2).getValue()) {
      sheet.getRange(row, 2).setValue(getNextPrefixedId_(sheet, 2, 'NBL-'));
    }
  } else if (name === TRACKER_CONFIG.TABS.STUDIO_BASELINES) {
    if (!sheet.getRange(row, 2).getValue()) {
      sheet.getRange(row, 2).setValue(getNextPrefixedId_(sheet, 2, 'SBL-'));
    }
  }
}

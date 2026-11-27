/**
 * ============================================================================
 * LifeOS v3.0 — 🎬 Cinema_Intelligence_Brick (ID_MOVIES)
 * Production Apps Script: Dynamic Form Dropdown Sync (Forms 2–5) + Heartbeat
 * ============================================================================
 * Spreadsheet ID : 1SIRiqfY1r62g8_XOkwe37d4KnZAr_-DBUx-r-wczkMY
 * Linked Forms   :
 *   - Form 1 (Movie Input)    : 140vqa2yZHBTCEyDRsKXg96ctAc4EwVEjzoeiRb6iWM0
 *   - Form 2 (Movie Re-Rank)  : 17hYrzrY6nPiGiNNADcyLjiUGEvIiaaUKjCF93o2IomY
 *   - Form 3 (Actor Input)    : 1boYElMlLHpeJzKIEaktInJjfRbsClzgoL6Ej4wDp_qE
 *   - Form 4 (Director Input) : 1Jkt13uUTkSJFaHGYaDLvfxmpfDyZWg1dAHfHqE48Pps
 *   - Form 5 (Genre Input)    : 1Lyzqdg-5nU-qUkpuYZK-Vkn02vAw_RzK-2PmMdsaunY
 *
 * LAW 1 COMPLIANCE: NEVER writes to or modifies Form Responses 1–5 (Read-Only).
 * ZERO-PII BOUNDARY: Syncs strictly Movie Titles, Actors, Directors & Genres.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const CINEMA_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '1SIRiqfY1r62g8_XOkwe37d4KnZAr_-DBUx-r-wczkMY',
  LEDGER_TAB: 'MOVIE_METADATA_&_LEDGER',
  ENGINE_TAB: 'CAST_CREW_&_GENRE_ENGINE',
  META_TAB: 'MODULE_META',
  FORMS: Object.freeze({
    MOVIE_RERANK: '17hYrzrY6nPiGiNNADcyLjiUGEvIiaaUKjCF93o2IomY',
    ACTOR_INPUT: '1boYElMlLHpeJzKIEaktInJjfRbsClzgoL6Ej4wDp_qE',
    DIRECTOR_INPUT: '1Jkt13uUTkSJFaHGYaDLvfxmpfDyZWg1dAHfHqE48Pps',
    GENRE_INPUT: '1Lyzqdg-5nU-qUkpuYZK-Vkn02vAw_RzK-2PmMdsaunY',
  }),
  MAX_FORM_CHOICES: 950, // Safe margin under Google Forms' 1,000-choice cap
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'onCinemaFormSubmit',
    SYNC_INTERVAL: 'syncAllCinemaForms',
  }),
});

/**
 * Adds the LifeOS Cinema menu on workbook open.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎬 LifeOS Cinema')
    .addItem('Sync All 4 Form Dropdowns Now', 'syncAllCinemaForms')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Installable onFormSubmit handler: syncs clean lists and linked Google Forms
 * whenever any of the 5 linked forms receives a new submission.
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit=} e
 */
function onCinemaFormSubmit(e) {
  syncAllCinemaForms();
}

/**
 * Master sync function:
 *  1) Reads unique Movie Titles, Actors, Directors, and Genres from
 *     MOVIE_METADATA_&_LEDGER (never touching Layer-1 Form Responses 1–5).
 *  2) Refreshes the clean reference dropdown columns on CAST_CREW_&_GENRE_ENGINE.
 *  3) Pushes live choice lists into Forms 2, 3, 4, and 5 via FormApp.openById.
 *  4) Stamps MODULE_META with the latest sync timestamp.
 */
function syncAllCinemaForms() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    Logger.log('Cinema sync skipped: another run holds the script lock.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(CINEMA_GAS_CFG.SPREADSHEET_ID);
    const ledger = ss.getSheetByName(CINEMA_GAS_CFG.LEDGER_TAB);
    const engine = ss.getSheetByName(CINEMA_GAS_CFG.ENGINE_TAB);
    if (!ledger || !engine) {
      throw new Error('Missing MOVIE_METADATA_&_LEDGER or CAST_CREW_&_GENRE_ENGINE tab.');
    }

    const lastRow = ledger.getLastRow();
    if (lastRow < 2) return;

    // Columns A (Movie Title), C (Director), D (Lead Actors Top 5), F (Genres)
    const rows = ledger.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
    const movies = extractUniqueTokens_(rows.map((r) => r[0]), false);
    const directors = extractUniqueTokens_(rows.map((r) => r[2]), true);
    const actors = extractUniqueTokens_(rows.map((r) => r[3]), true);
    const genres = extractUniqueTokens_(rows.map((r) => r[5]), true);

    // 1. Update clean reference columns on CAST_CREW_&_GENRE_ENGINE (Q/R/S/T)
    writeReferenceList_(engine, 17, 'Clean_Movie_List', movies);
    writeReferenceList_(engine, 18, 'Clean_Actor_List', actors);
    writeReferenceList_(engine, 19, 'Clean_Director_List', directors);
    writeReferenceList_(engine, 20, 'Clean_Genre_List', genres);

    // 2. Push choices into linked Google Forms (LIST / MULTIPLE_CHOICE items)
    const results = [
      updateFormDropdownByKeywords_(CINEMA_GAS_CFG.FORMS.MOVIE_RERANK, ['movie', 'title', 'film'], movies),
      updateFormDropdownByKeywords_(CINEMA_GAS_CFG.FORMS.ACTOR_INPUT, ['actor', 'actress', 'cast'], actors),
      updateFormDropdownByKeywords_(CINEMA_GAS_CFG.FORMS.DIRECTOR_INPUT, ['director', 'filmmaker'], directors),
      updateFormDropdownByKeywords_(CINEMA_GAS_CFG.FORMS.GENRE_INPUT, ['genre', 'category'], genres),
    ];

    // 3. Stamp MODULE_META heartbeat (never touching Layer-1 raw tabs)
    const summary =
      'Movies:' + movies.length +
      ' | Actors:' + actors.length +
      ' | Directors:' + directors.length +
      ' | Genres:' + genres.length +
      ' | FormsUpdated:' + results.filter(Boolean).length + '/4';
    stampModuleMeta_(ss, 'Last_Dropdown_Sync', new Date().toISOString() + ' (' + summary + ')');

    Logger.log('Cinema dropdown sync complete: ' + summary);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Extracts sorted, deduplicated tokens (optionally splitting on commas/semicolons).
 * @param {string[]} values
 * @param {boolean} splitMulti
 * @return {string[]}
 */
function extractUniqueTokens_(values, splitMulti) {
  const seen = new Map();
  values.forEach((raw) => {
    if (!raw) return;
    const parts = splitMulti ? String(raw).split(/[,;|]+/) : [String(raw)];
    parts.forEach((p) => {
      const cleaned = p.trim();
      if (!cleaned) return;
      const key = cleaned.toUpperCase();
      if (!seen.has(key)) seen.set(key, cleaned);
    });
  });
  return Array.from(seen.values())
    .sort((a, b) => a.localeCompare(b))
    .slice(0, CINEMA_GAS_CFG.MAX_FORM_CHOICES);
}

/**
 * Writes a clean list into a helper reference column starting at Row 4.
 */
function writeReferenceList_(sheet, colIndex, header, items) {
  sheet.getRange(3, colIndex).setValue(header);
  const maxRows = Math.max(sheet.getMaxRows() - 3, 1);
  if (maxRows > 0) {
    sheet.getRange(4, colIndex, Math.min(maxRows, 1000), 1).clearContent();
  }
  if (items.length > 0) {
    sheet.getRange(4, colIndex, items.length, 1).setValues(items.map((x) => [x]));
  }
}

/**
 * Opens a Google Form by ID and updates the first matching LIST or MULTIPLE_CHOICE
 * question whose title matches one of the keywords (falls back to first LIST item).
 * @return {boolean}
 */
function updateFormDropdownByKeywords_(formId, keywords, choices) {
  if (!formId || !choices || choices.length === 0) return false;
  try {
    const form = FormApp.openById(formId);
    const items = form.getItems();
    let targetItem = null;

    for (let i = 0; i < items.length; i++) {
      const type = items[i].getType();
      if (type !== FormApp.ItemType.LIST && type !== FormApp.ItemType.MULTIPLE_CHOICE) continue;
      const title = (items[i].getTitle() || '').toLowerCase();
      if (keywords.some((kw) => title.indexOf(kw) !== -1)) {
        targetItem = items[i];
        break;
      }
      if (!targetItem && type === FormApp.ItemType.LIST) {
        targetItem = items[i];
      }
    }

    if (!targetItem) {
      Logger.log('No LIST/MULTIPLE_CHOICE item found on form ' + formId);
      return false;
    }

    if (targetItem.getType() === FormApp.ItemType.LIST) {
      targetItem.asListItem().setChoiceValues(choices);
    } else {
      targetItem.asMultipleChoiceItem().setChoiceValues(choices);
    }
    return true;
  } catch (err) {
    Logger.log('Form sync warning for ' + formId + ': ' + err.message);
    return false;
  }
}

/**
 * Upserts a telemetry key/value row in MODULE_META.
 */
function stampModuleMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(CINEMA_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_MOVIES.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 * Removes duplicate triggers for this brick and installs:
 *   1) On form submit -> onCinemaFormSubmit
 *   2) Time-driven every 6 hours -> syncAllCinemaForms
 * Then runs an immediate sync to verify permissions & populate all 4 forms.
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(CINEMA_GAS_CFG.SPREADSHEET_ID);
  const managed = new Set([
    CINEMA_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT,
    CINEMA_GAS_CFG.TRIGGERS.SYNC_INTERVAL,
  ]);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (managed.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(CINEMA_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger(CINEMA_GAS_CFG.TRIGGERS.SYNC_INTERVAL)
    .timeBased()
    .everyHours(6)
    .create();

  syncAllCinemaForms();
  stampModuleMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Cinema Intelligence Triggers Armed!\n\n' +
      '• On form submit → onCinemaFormSubmit\n' +
      '• Every 6 hours → syncAllCinemaForms\n' +
      '• Initial 4-form dropdown sync completed.'
    );
  } catch (e) {
    Logger.log('Cinema Intelligence triggers armed successfully (headless run).');
  }
}

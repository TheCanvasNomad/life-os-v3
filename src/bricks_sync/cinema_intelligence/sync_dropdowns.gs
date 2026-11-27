/**
 * @fileoverview Modular Google Apps Script helper for 🎬 Cinema_Intelligence_Brick (ID_MOVIES).
 * Obeys LifeOS Laws 1–3: strictly read-only on Layer 1 Form Responses 1–5; never mutates raw logs.
 * Refreshes unique Movie Title / Genre / Director / Actor dropdown lists & updates Last_Updated stamp.
 */

const CINEMA_CONFIG = Object.freeze({
  ENGINE_TAB: 'CAST_CREW_&_GENRE_ENGINE',
  LEDGER_TAB: 'MOVIE_METADATA_&_LEDGER',
  META_TAB: 'MODULE_META',
  RAW_MOVIES_TAB: 'Form Responses 1',
  RAW_ACTORS_TAB: 'Form Responses 3',
  RAW_DIRECTORS_TAB: 'Form Responses 4',
  RAW_GENRES_TAB: 'Form Responses 5',
  // Unique_Lists block in CAST_CREW_&_GENRE_ENGINE (Cols AR..AW -> cols 44..49)
  LIST_START_ROW: 3,
  MAX_LIST_ROWS: 250,
  COL_MOVIES: 44,    // AR
  COL_GENRES: 45,    // AS
  COL_DIRECTORS: 46, // AT
  COL_ACTORS: 47,    // AU
  COL_STAMP: 48,     // AV
});

/**
 * Adds custom Cinema Intelligence menu when workbook opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎬 Cinema Intelligence')
    .addItem('🔄 Sync Unique Dropdowns & Stamp', 'syncMovieDropdownsAndStamp')
    .addToUi();
}

/**
 * Splits comma-delimited metadata cells into sorted, trimmed, uppercase unique values.
 * @param {Array<Array<string>>} rawCol2D
 * @returns {Array<Array<string>>}
 */
function extractUniqueTokens_(rawCol2D) {
  const seen = new Set();
  for (let i = 0; i < rawCol2D.length; i++) {
    const raw = String(rawCol2D[i][0] || '').trim();
    if (!raw) continue;
    const parts = raw.split(',');
    for (let j = 0; j < parts.length; j++) {
      const token = parts[j].trim();
      if (token) seen.add(token);
    }
  }
  return Array.from(seen)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((v) => [v]);
}

/**
 * Writes a column list into a bounded block cleanly without touching other columns.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} colIndex 1-based column index
 * @param {Array<Array<string>>} rows2D
 */
function writeCleanList_(sheet, colIndex, rows2D) {
  const maxRows = CINEMA_CONFIG.MAX_LIST_ROWS;
  sheet.getRange(CINEMA_CONFIG.LIST_START_ROW, colIndex, maxRows, 1).clearContent();
  if (rows2D.length > 0) {
    const clipped = rows2D.slice(0, maxRows);
    sheet.getRange(CINEMA_CONFIG.LIST_START_ROW, colIndex, clipped.length, 1).setValues(clipped);
  }
}

/**
 * Refreshes unique Movie Title, Genre, Director, and Actor lists from read-only Layer 1 / Metadata
 * and stamps Last_Updated UTC on CAST_CREW_&_GENRE_ENGINE and MODULE_META without altering raw rows.
 */
function syncMovieDropdownsAndStamp() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('syncMovieDropdownsAndStamp: another sync is currently running.');
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const engine = ss.getSheetByName(CINEMA_CONFIG.ENGINE_TAB);
    const ledger = ss.getSheetByName(CINEMA_CONFIG.LEDGER_TAB);
    const meta = ss.getSheetByName(CINEMA_CONFIG.META_TAB);
    const rawMovies = ss.getSheetByName(CINEMA_CONFIG.RAW_MOVIES_TAB);
    if (!engine || !ledger || !rawMovies) {
      throw new Error('Missing required Cinema Intelligence tabs.');
    }

    // Read-only reads from Layer 1 & Movie Metadata (never writes to Form Responses 1..5!)
    const lastRawRow = Math.max(2, rawMovies.getLastRow());
    const movieTitles = rawMovies.getRange(2, 2, lastRawRow - 1, 1).getValues();
    const uniqueMovies = extractUniqueTokens_(movieTitles);

    const lastMetaRow = Math.max(2, Math.min(ledger.getLastRow(), 250));
    const directorVals = ledger.getRange(2, 3, lastMetaRow - 1, 1).getValues();
    const actorVals = ledger.getRange(2, 4, lastMetaRow - 1, 1).getValues();
    const genreVals = ledger.getRange(2, 6, lastMetaRow - 1, 1).getValues();

    const uniqueDirectors = extractUniqueTokens_(directorVals);
    const uniqueActors = extractUniqueTokens_(actorVals);
    const uniqueGenres = extractUniqueTokens_(genreVals);

    writeCleanList_(engine, CINEMA_CONFIG.COL_MOVIES, uniqueMovies);
    writeCleanList_(engine, CINEMA_CONFIG.COL_GENRES, uniqueGenres);
    writeCleanList_(engine, CINEMA_CONFIG.COL_DIRECTORS, uniqueDirectors);
    writeCleanList_(engine, CINEMA_CONFIG.COL_ACTORS, uniqueActors);

    const stamp = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm') + ' UTC';
    engine.getRange(CINEMA_CONFIG.LIST_START_ROW, CINEMA_CONFIG.COL_STAMP).setValue(stamp);

    if (meta) {
      const metaKeys = meta.getRange(1, 1, meta.getLastRow(), 1).getValues();
      for (let i = 0; i < metaKeys.length; i++) {
        if (String(metaKeys[i][0]).trim() === 'Last_Dropdown_Sync') {
          meta.getRange(i + 1, 2).setValue(stamp);
          break;
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
}

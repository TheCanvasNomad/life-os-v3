/**
 * LifeOS v3.0 — 🧠 Psych_OS_Brick (ID_PSYCH_OS)
 * Non-PII Bound Apps Script Helper: buildPsychologyNotebookPrompt() & Daily Snapshot Archiver
 *
 * Target Brick Spreadsheet ID: 1dqYPg3WraSnLk2EWAwqJmwWcSmjpvhr0p9UxNKnkez8
 * Privacy Boundary: STRICT_ZERO_PII — reads ONLY Date_Key (A), Somatic_State (G),
 * Primary_Pillar (H), and Diagnostic_Flag (I) from PSYCH_OS_ENGINE.
 */

const PSYCH_OS_ID = '1dqYPg3WraSnLk2EWAwqJmwWcSmjpvhr0p9UxNKnkez8';
const ENGINE_TAB = 'PSYCH_OS_ENGINE';
const INGEST_TAB = 'PSYCH_OS_INGEST';

/**
 * Adds the 🧠 Psych OS custom menu when the workbook opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧠 Psych OS')
    .addItem('📋 Build NotebookLM Prompt (Zero-PII)', 'showPsychologyNotebookPrompt')
    .addItem('📅 Snapshot Today into PSYCH_OS_INGEST', 'appendDailyPsychSnapshot')
    .addSeparator()
    .addItem('⏰ Install Daily Snapshot Trigger (23:55)', 'setupTriggers')
    .addToUi();
}

/**
 * Builds a strictly zero-PII Markdown synthesis prompt for NotebookLM / Gemini
 * reading ONLY Date_Key (A), Somatic_State (G), Primary_Pillar (H), and Diagnostic_Flag (I)
 * across the latest 14 populated rows of PSYCH_OS_ENGINE.
 *
 * @return {string} Clean, deterministic zero-PII Markdown prompt.
 */
function buildPsychologyNotebookPrompt() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PSYCH_OS_ID);
  const sheet = ss.getSheetByName(ENGINE_TAB);
  if (!sheet) {
    throw new Error('Missing tab: ' + ENGINE_TAB);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return '# LifeOS Psych OS Telemetry (Zero-PII)\nNo populated diagnostic rows found in PSYCH_OS_ENGINE.';
  }

  // Read strictly A:I, extract ONLY A (0), G (6), H (7), I (8)
  const values = sheet.getRange(2, 1, lastRow - 1, 9).getDisplayValues();
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const dateKey = (values[i][0] || '').trim();
    const somatic = (values[i][6] || '').trim();
    const pillar = (values[i][7] || '').trim();
    const flag = (values[i][8] || '').trim();
    if (!dateKey || !somatic || somatic === 'Awaiting Hub Auth') continue;
    rows.push({ dateKey, somatic, pillar, flag });
  }

  const recent = rows.slice(-14);
  if (recent.length === 0) {
    return '# LifeOS Psych OS Telemetry (Zero-PII)\nAuthorize CONTEXT_IN!F2 to populate live Hub telemetry before running synthesis.';
  }

  const lines = [
    '# LifeOS v3.0 — Psych OS Polyvagal & Pillar Synthesis Prompt (STRICT ZERO-PII)',
    'Window: Last ' + recent.length + ' Active Diagnostic Days',
    '',
    '| Date_Key | Somatic_State | Primary_Pillar | Diagnostic_Flag |',
    '| :--- | :--- | :--- | :--- |',
  ];
  recent.forEach(function(r) {
    lines.push('| ' + r.dateKey + ' | ' + r.somatic + ' | ' + r.pillar + ' | ' + r.flag + ' |');
  });

  lines.push('');
  lines.push('## Synthesis Directive');
  lines.push('1. Identify any multi-day recurrence of `Fake Progress Loop`, `Sympathetic / Social Threat`, or `Physiological Recovery Deficit`.');
  lines.push('2. Map the dominant Psychology Pillar (1–5) shift across this window and prescribe one 15-minute somatic-first behavioral reset.');
  lines.push('3. Keep output concise, structured, and strictly grounded in the telemetry table above (no speculation or PII).');
  return lines.join('\n');
}

/**
 * Displays the zero-PII prompt in a modal dialog for 1-click copy into NotebookLM / Gemini.
 */
function showPsychologyNotebookPrompt() {
  const prompt = buildPsychologyNotebookPrompt();
  const html = HtmlService.createHtmlOutput(
    '<textarea style="width:100%;height:340px;font-family:monospace;font-size:12px;">' +
    prompt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
    '</textarea>'
  ).setWidth(640).setHeight(390);
  SpreadsheetApp.getUi().showModalDialog(html, '🧠 Psych OS — Zero-PII NotebookLM Prompt');
}

/**
 * Appends a deduplicated daily snapshot of live CONTEXT_IN telemetry into PSYCH_OS_INGEST
 * below Row 2 (preserving Row 2 as the live current-day formula row).
 */
function appendDailyPsychSnapshot() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PSYCH_OS_ID);
    const ingest = ss.getSheetByName(INGEST_TAB);
    if (!ingest) throw new Error('Missing tab: ' + INGEST_TAB);

    const liveRow = ingest.getRange('A2:F2').getValues()[0];
    const dateKey = String(liveRow[0] || '').trim();
    if (!dateKey || (liveRow[1] === '' && liveRow[3] === '' && liveRow[5] === '')) {
      Logger.log('Skipped snapshot: awaiting live Hub telemetry.');
      return;
    }

    const lastRow = Math.max(2, ingest.getLastRow());
    if (lastRow >= 3) {
      const existingDates = ingest.getRange(3, 1, lastRow - 2, 1).getDisplayValues().map(function(r) { return r[0].trim(); });
      if (existingDates.indexOf(dateKey) !== -1) {
        Logger.log('Snapshot already archived for ' + dateKey);
        return;
      }
    }

    ingest.getRange(lastRow + 1, 1, 1, 6).setValues([liveRow]);
    Logger.log('Archived Psych OS snapshot for ' + dateKey);
  } finally {
    lock.releaseLock();
  }
}

/**
 * One-click idempotent installer for the daily 23:55 snapshot trigger.
 */
function setupTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'appendDailyPsychSnapshot') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('appendDailyPsychSnapshot')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(55)
    .create();
  Logger.log('Installed daily 23:55 appendDailyPsychSnapshot trigger.');
}

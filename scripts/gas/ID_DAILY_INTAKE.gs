/**
 * ============================================================================
 * LifeOS v3.0 — 🧭 Daily_Intake_Brick (ID_DAILY_INTAKE)
 * Production Apps Script: Daily Pulse Heartbeat + Zero-PII Calendar Summary
 * ============================================================================
 * Spreadsheet ID : 16ohf5mBA9xrRsyv5sOYqY1s7gaOSpSOzK1rE1Gw6BNI
 * Linked Form ID : 1ruSKA_komkQJWNCpM8OzsyCKJWGf2gde7bm6QFxRot0
 *
 * LAW 1 COMPLIANCE: NEVER modifies 'Form Responses 1' (strictly read-only).
 * STRICT ZERO-PII BOUNDARY: Primary Dukkha prose & Selfie URLs NEVER leave this
 * workbook. Calendar summary writes ONLY numeric SIGNALS_OUT scores (Energy,
 * Mood, Stress, Flow, Discipline Delta).
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const DAILY_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '16ohf5mBA9xrRsyv5sOYqY1s7gaOSpSOzK1rE1Gw6BNI',
  SIGNALS_TAB: 'SIGNALS_OUT',
  META_TAB: 'MODULE_META',
  CALENDAR_NAME: 'LifeOS Mission Control',
  CALENDAR_TAG: '[LifeOS_DAILY_PULSE]',
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'onDailyIntakeSubmit',
    NIGHTLY_CAL: 'syncDailyPulseToCalendar',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧭 LifeOS Daily Intake')
    .addItem('Sync Today\'s Numeric Pulse → Calendar', 'syncDailyPulseToCalendar')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Installable onFormSubmit trigger:
 * Flushes dynamic formulas immediately after AM/Event/Shadow/PM submission
 * and stamps MODULE_META so Hub freshness checks reflect live telemetry.
 */
function onDailyIntakeSubmit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(DAILY_GAS_CFG.SPREADSHEET_ID);
    SpreadsheetApp.flush();
    stampDailyMeta_(ss, 'Last_Intake_Submit', new Date().toISOString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Nightly (10 PM) Zero-PII Calendar Logger:
 * Reads ONLY numeric aggregates from SIGNALS_OUT and posts/updates a single
 * all-day summary block on the 'LifeOS Mission Control' calendar.
 */
function syncDailyPulseToCalendar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Daily pulse calendar sync skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(DAILY_GAS_CFG.SPREADSHEET_ID);
    const sigSheet = ss.getSheetByName(DAILY_GAS_CFG.SIGNALS_TAB);
    if (!sigSheet) throw new Error('Missing SIGNALS_OUT tab.');

    const sigMap = {};
    sigSheet.getDataRange().getDisplayValues().slice(1).forEach((r) => {
      if (r[0]) sigMap[String(r[0]).trim()] = { raw: r[4], norm: r[5], state: r[6] };
    });

    const energy = (sigMap['DAILY_ENERGY'] || {}).norm || 'N/A';
    const mood = (sigMap['DAILY_MOOD'] || {}).norm || 'N/A';
    const stress = (sigMap['ACUTE_STRESS'] || {}).norm || 'N/A';
    const flow = (sigMap['FLOW_COHERENCE'] || {}).norm || 'N/A';
    const xp = (sigMap['DAILY_INTAKE_RAW_XP'] || {}).raw || '0';

    const today = new Date();
    const dateKey = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const title = '🧭 Daily Pulse | E:' + energy + ' M:' + mood + ' S:' + stress + ' F:' + flow;
    const desc = [
      DAILY_GAS_CFG.CALENDAR_TAG + ':' + dateKey,
      'Zero-PII Aggregate Telemetry (from SIGNALS_OUT only):',
      '• Daily Energy (0-100): ' + energy,
      '• Daily Mood (0-100): ' + mood,
      '• Acute Stress (0-100): ' + stress,
      '• Flow Coherence (0-100): ' + flow,
      '• Raw XP Earned: ' + xp,
    ].join('\n');

    const cals = CalendarApp.getCalendarsByName(DAILY_GAS_CFG.CALENDAR_NAME);
    const cal = cals.length > 0 ? cals[0] : CalendarApp.getDefaultCalendar();

    const dayEvents = cal.getEventsForDay(today);
    const existing = dayEvents.find((ev) =>
      (ev.getDescription() || '').indexOf(DAILY_GAS_CFG.CALENDAR_TAG + ':' + dateKey) !== -1
    );

    if (existing) {
      existing.setTitle(title);
      existing.setDescription(desc);
    } else {
      cal.createAllDayEvent(title, today, { description: desc });
    }

    stampDailyMeta_(ss, 'Last_Calendar_Pulse_Sync', new Date().toISOString() + ' (' + dateKey + ')');
    Logger.log('Daily Pulse synced to Calendar for ' + dateKey);
  } finally {
    lock.releaseLock();
  }
}

function stampDailyMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(DAILY_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_DAILY_INTAKE.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit    -> onDailyIntakeSubmit
 *   2) Daily at 10:00 PM -> syncDailyPulseToCalendar
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(DAILY_GAS_CFG.SPREADSHEET_ID);
  const managed = new Set([
    DAILY_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT,
    DAILY_GAS_CFG.TRIGGERS.NIGHTLY_CAL,
  ]);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (managed.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(DAILY_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger(DAILY_GAS_CFG.TRIGGERS.NIGHTLY_CAL)
    .timeBased()
    .everyDays(1)
    .atHour(22)
    .create();

  stampDailyMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Daily Intake Brick Triggers Armed!\n\n' +
      '• On form submit → onDailyIntakeSubmit\n' +
      '• Daily 10:00 PM → syncDailyPulseToCalendar (Zero-PII)'
    );
  } catch (e) {
    Logger.log('Daily Intake triggers armed (headless run).');
  }
}

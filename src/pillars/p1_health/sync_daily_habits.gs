/**
 * LifeOS v3.0 — Pillar 1 Daily Check-In Form Alignment, Habit Sync & Silo Router
 * ==============================================================================
 * Bound to: `💚 Pillar_1_Health` (ID: 1dzuXlVWO5VRtla0p0ZuziZAvpm2ZySslPLZOhWDQGSI)
 * Target Form: `Life OS - Daily Check-In Form` (ID: 1wJV0-OBFUHnCQVK9M3-nKh1EX_eLh842HAkMcU9b77U)
 * Target Silo: `RAW_DATA_DailyCheckIn` (ID: 1Bz2AH4oJMvzhETSvEhG5H58mlF-RNLMG6IaTTKaODSY) -> `Daily_CheckIn_Log`
 *
 * Capabilities:
 *   1. `setupAndAlignDailyCheckInForm()`: Links the Form to `RAW_DATA_DailyCheckIn`,
 *      builds/aligns all 14 canonical Pillar 1 questions, syncs all ACTIVE habits
 *      from `HABIT_MANAGER`, installs the `onFormSubmit` router trigger, and displays
 *      the live responder URL.
 *   2. `syncDailyHabitsToForm()`: Dynamically syncs ACTIVE habits from `HABIT_MANAGER`
 *      into the Form's `Active_Habits_Completed` checkbox item.
 *   3. `routeFormSubmissionToLog(e)`: Automatically routes every Form submission into
 *      `RAW_DATA_DailyCheckIn -> Daily_CheckIn_Log` in exact 16-column schema order
 *      (`A:P`) with Law 3 blank-cell preservation (never false 0s).
 */

const HABIT_TAB_NAME = 'HABIT_MANAGER';
const DEFAULT_FORM_ID = '1wJV0-OBFUHnCQVK9M3-nKh1EX_eLh842HAkMcU9b77U';
const DEFAULT_RAW_SILO_ID = '1Bz2AH4oJMvzhETSvEhG5H58mlF-RNLMG6IaTTKaODSY';
const RAW_LOG_TAB = 'Daily_CheckIn_Log';
const TRACKED_VICES = ['Alcohol', 'Nicotine/Vape', 'Marijuana', 'Pornography'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💚 LifeOS Pillar 1')
    .addItem('1. Align Daily Check-In Form + Sync 7 Habits + Install Router', 'setupAndAlignDailyCheckInForm')
    .addItem('2. Sync Active Habits to Form Checkboxes', 'syncDailyHabitsToForm')
    .addToUi();
}

function getFormId_() {
  return PropertiesService.getScriptProperties().getProperty('DAILY_CHECKIN_FORM_ID') || DEFAULT_FORM_ID;
}

function getRawSiloId_() {
  return PropertiesService.getScriptProperties().getProperty('RAW_DAILY_SILO_ID') || DEFAULT_RAW_SILO_ID;
}

function readActiveHabits_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HABIT_TAB_NAME);
  if (!sheet) throw new Error('Tab not found: ' + HABIT_TAB_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const active = [];
  for (let i = 0; i < rows.length; i++) {
    const name = String(rows[i][0] || '').trim();
    const status = String(rows[i][1] || '').trim().toUpperCase();
    if (name && status === 'ACTIVE') active.push(name);
  }
  return active;
}

/**
 * One-click full setup: aligns all 14 questions on `Life OS - Daily Check-In Form`,
 * binds destination to `RAW_DATA_DailyCheckIn`, syncs all ACTIVE habits from
 * `HABIT_MANAGER`, and installs the `onFormSubmit` router to `Daily_CheckIn_Log`.
 */
function setupAndAlignDailyCheckInForm() {
  const formId = getFormId_();
  const rawSiloId = getRawSiloId_();
  const activeHabits = readActiveHabits_();
  if (activeHabits.length === 0) {
    throw new Error('No ACTIVE habits found in HABIT_MANAGER.');
  }

  const form = FormApp.openById(formId);
  form.setTitle('💚 Life OS v3.0 — Daily Check-In Form');
  form.setDescription(
    'Pillar 1: Health & Vitality daily subjective telemetry. Feeds RAW_DATA_DailyCheckIn -> Pillar_1_Health -> LifeOS_feed_hub.'
  );
  form.setDestination(FormApp.DestinationType.SPREADSHEET, rawSiloId);

  // Clear existing legacy items and rebuild exact 14-question canonical schema
  const existing = form.getItems();
  for (let i = existing.length - 1; i >= 0; i--) {
    form.deleteItem(existing[i]);
  }

  form.addDateItem().setTitle('Date').setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle('Time_Window')
    .setChoiceValues(['Morning', 'Afternoon', 'Evening'])
    .setRequired(true);
  form.addScaleItem().setTitle('Sleep_Quality').setBounds(1, 10).setLabels('Restless / Depleted', 'Deep & Restorative');
  form.addScaleItem().setTitle('Nutrition_Quality').setBounds(1, 10).setLabels('Processed / Off-Plan', 'Clean Whole-Food Fuel');
  form.addScaleItem().setTitle('Hydration_Score').setBounds(1, 10).setLabels('Dehydrated', 'Fully Hydrated');
  form.addScaleItem().setTitle('Energy_Level').setBounds(1, 10).setLabels('Drained', 'Peak Vitality');
  form.addScaleItem().setTitle('Focus_Clarity').setBounds(1, 10).setLabels('Brain Fog', 'Razor Sharp');
  form.addScaleItem().setTitle('Stress_Level').setBounds(1, 10).setLabels('Calm Baseline', 'Acute Overload');
  form.addScaleItem().setTitle('Prana_Level').setBounds(1, 10).setLabels('Low Vital Force', 'High Prana / Flow');
  form.addCheckboxItem().setTitle('Active_Habits_Completed').setChoiceValues(activeHabits);
  form.addCheckboxItem().setTitle('Vice_Lapses').setChoiceValues(TRACKED_VICES);
  form.addScaleItem().setTitle('Appearance_Score').setBounds(1, 10).setLabels('Unkempt', 'Peak Embodiment / Glow Up');
  form.addMultipleChoiceItem().setTitle('Workout_Logged').setChoiceValues(['Yes', 'No']);
  form.addParagraphTextItem().setTitle('Journal_Notes');

  // Install idempotent onFormSubmit trigger targeting routeFormSubmissionToLog
  const triggers = ScriptApp.getProjectTriggers();
  const alreadyInstalled = triggers.some(
    (t) => t.getHandlerFunction() === 'routeFormSubmissionToLog'
  );
  if (!alreadyInstalled) {
    ScriptApp.newTrigger('routeFormSubmissionToLog').forForm(form).onFormSubmit().create();
  }

  const responderUrl = form.getPublishedUrl();
  Logger.log('Aligned Daily Check-In Form (' + formId + ') with ' + activeHabits.length + ' habits.');
  Logger.log('Live Responder URL: ' + responderUrl);
  try {
    SpreadsheetApp.getUi().alert(
      'Daily Check-In Form Aligned & Synced!\n\nActive Habits Synced: ' +
        activeHabits.length +
        '\nResponder URL:\n' +
        responderUrl
    );
  } catch (_) {}
  return responderUrl;
}

/**
 * Lightweight sync: updates ONLY the `Active_Habits_Completed` checkbox choices
 * from `HABIT_MANAGER` without modifying other Form questions.
 */
function syncDailyHabitsToForm() {
  const formId = getFormId_();
  const activeHabits = readActiveHabits_();
  if (activeHabits.length === 0) {
    throw new Error('Zero ACTIVE habits found in HABIT_MANAGER; aborting Form overwrite.');
  }

  const form = FormApp.openById(formId);
  const checkboxItems = form.getItems(FormApp.ItemType.CHECKBOX);
  let targetItem = null;
  for (let i = 0; i < checkboxItems.length; i++) {
    const title = checkboxItems[i].getTitle().toLowerCase();
    if (title.indexOf('habit') !== -1) {
      targetItem = checkboxItems[i].asCheckboxItem();
      break;
    }
  }
  if (!targetItem) {
    targetItem = form.addCheckboxItem().setTitle('Active_Habits_Completed');
  }
  targetItem.setChoiceValues(activeHabits);
  Logger.log('Synced ' + activeHabits.length + ' active habits to Form ' + formId + ': ' + activeHabits.join(', '));
}

/**
 * Trigger handler: maps each Form response into `RAW_DATA_DailyCheckIn -> Daily_CheckIn_Log`
 * in exact 16-column canonical order (`A:P`) with Law 3 blank-cell preservation.
 */
function routeFormSubmissionToLog(e) {
  if (!e || !e.response) return;
  const itemResponses = e.response.getItemResponses();
  const map = {};
  itemResponses.forEach((ir) => {
    const title = ir.getItem().getTitle().trim();
    const val = ir.getResponse();
    map[title] = Array.isArray(val) ? val.join(', ') : val;
  });

  const ts = Utilities.formatDate(e.response.getTimestamp(), 'UTC', 'yyyy-MM-dd HH:mm:ss');
  const dateVal = map['Date'] || Utilities.formatDate(e.response.getTimestamp(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const row = [
    ts,
    dateVal,
    map['Time_Window'] || '',
    numOrBlank_(map['Sleep_Quality']),
    numOrBlank_(map['Nutrition_Quality']),
    numOrBlank_(map['Hydration_Score']),
    numOrBlank_(map['Energy_Level']),
    numOrBlank_(map['Focus_Clarity']),
    numOrBlank_(map['Stress_Level']),
    numOrBlank_(map['Prana_Level']),
    map['Active_Habits_Completed'] || '',
    map['Vice_Lapses'] || '',
    numOrBlank_(map['Appearance_Score']),
    map['Workout_Logged'] || '',
    'Daily_CheckIn_Form',
    map['Journal_Notes'] || '',
  ];

  const siloSs = SpreadsheetApp.openById(getRawSiloId_());
  const logSheet = siloSs.getSheetByName(RAW_LOG_TAB);
  if (!logSheet) throw new Error('Missing tab ' + RAW_LOG_TAB + ' in RAW_DATA_DailyCheckIn');
  logSheet.appendRow(row);
}

function numOrBlank_(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}

/**
 * Optional installable onEdit handler: automatically syncs the Form whenever
 * HABIT_MANAGER Col A (Habit Name) or Col B (Active_Status) is edited.
 */
function handleHabitManagerEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== HABIT_TAB_NAME) return;
  if (e.range.getColumn() <= 2 && e.range.getRow() >= 2) {
    syncDailyHabitsToForm();
  }
}

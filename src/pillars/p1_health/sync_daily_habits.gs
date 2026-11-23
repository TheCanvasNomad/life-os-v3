/**
 * LifeOS v3.0 — Pillar 1 Dynamic Daily Habit Form Sync (`HABIT_MANAGER` -> Google Form)
 * ====================================================================================
 * Bound to: `💚 Pillar_1_Health` (ID: 1dzuXlVWO5VRtla0p0ZuziZAvpm2ZySslPLZOhWDQGSI)
 *
 * Reads all rows in `HABIT_MANAGER` where `Active_Status == "ACTIVE"` (Col A & B)
 * and dynamically overwrites the checkbox choices of the Daily Check-In Google Form
 * question matching `Active Habits Completed` (configurable via Script Property
 * `HABIT_QUESTION_TITLE`).
 *
 * Setup:
 *   1. Open Apps Script inside `💚 Pillar_1_Health`.
 *   2. Set Script Property `DAILY_CHECKIN_FORM_ID` to your Daily Check-In Form ID.
 *   3. Optional: set `HABIT_QUESTION_TITLE` (defaults to `Active_Habits_Completed`).
 *   4. Run `syncDailyHabitsToForm()` manually from the custom LifeOS menu or attach
 *      an installable `onEdit` trigger for real-time sync whenever `HABIT_MANAGER` changes.
 */

const HABIT_TAB_NAME = 'HABIT_MANAGER';
const DEFAULT_QUESTION_MATCH = 'Habit';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💚 LifeOS Pillar 1')
    .addItem('Sync Active Habits to Daily Check-In Form', 'syncDailyHabitsToForm')
    .addToUi();
}

function syncDailyHabitsToForm() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('DAILY_CHECKIN_FORM_ID');
  if (!formId) {
    throw new Error(
      'Missing Script Property DAILY_CHECKIN_FORM_ID. Set it in Apps Script -> Project Settings -> Script Properties.'
    );
  }
  const questionHint = (props.getProperty('HABIT_QUESTION_TITLE') || DEFAULT_QUESTION_MATCH).toLowerCase();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HABIT_TAB_NAME);
  if (!sheet) {
    throw new Error('Tab not found: ' + HABIT_TAB_NAME);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No habits defined in HABIT_MANAGER.');
    return;
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const activeHabits = [];
  for (let i = 0; i < rows.length; i++) {
    const name = String(rows[i][0] || '').trim();
    const status = String(rows[i][1] || '').trim().toUpperCase();
    if (name && status === 'ACTIVE') {
      activeHabits.push(name);
    }
  }

  if (activeHabits.length === 0) {
    throw new Error('Zero ACTIVE habits found in HABIT_MANAGER; aborting Form overwrite.');
  }

  const form = FormApp.openById(formId);
  const checkboxItems = form.getItems(FormApp.ItemType.CHECKBOX);
  let targetItem = null;

  for (let i = 0; i < checkboxItems.length; i++) {
    const title = checkboxItems[i].getTitle().toLowerCase();
    if (title.indexOf(questionHint) !== -1) {
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
 * Optional installable onEdit handler: automatically syncs the Form when
 * HABIT_MANAGER Col A (Habit Name) or Col B (Active_Status) is modified.
 */
function handleHabitManagerEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== HABIT_TAB_NAME) return;
  if (e.range.getColumn() <= 2 && e.range.getRow() >= 2) {
    syncDailyHabitsToForm();
  }
}

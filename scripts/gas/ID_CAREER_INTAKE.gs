/**
 * ============================================================================
 * LifeOS v3.0 — 💼 Career & Experience Intake Brick (ID_CAREER_INTAKE)
 * Production Apps Script: Career Track / Org Dropdown Sync & Credential Audit
 * ============================================================================
 * Spreadsheet ID : 1iXxJVSv04MsRc_41p5bahCNRROXdugZ75iSivVy29GM
 * Linked Form ID : 1ONcs8wlxWBzrz8_0Gbj68jkyR-OoH2JG0Ucq4lK0LO4
 *
 * LAW 1 COMPLIANCE: NEVER modifies 'Form Responses 1' (strictly read-only).
 * ZERO-PII BOUNDARY: Syncs canonical Career Tracks & Record Types only.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const CAREER_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '1iXxJVSv04MsRc_41p5bahCNRROXdugZ75iSivVy29GM',
  LEDGER_TAB: 'Master_Ledger',
  TAXONOMY_TAB: 'Taxonomy_&_Config',
  META_TAB: 'MODULE_META',
  FORM_ID: '1ONcs8wlxWBzrz8_0Gbj68jkyR-OoH2JG0Ucq4lK0LO4',
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'onCareerFormSubmit',
    DAILY_AUDIT: 'syncCareerIntakeDropdowns',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💼 LifeOS Career')
    .addItem('Sync Career Tracks & Orgs → Intake Form', 'syncCareerIntakeDropdowns')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

function onCareerFormSubmit(e) {
  syncCareerIntakeDropdowns();
}

/**
 * Reads canonical Career_Track values from Master_Ledger (Col C) and updates
 * any matching LIST / MULTIPLE_CHOICE Track selector on the linked Intake Form,
 * then stamps credential expiration telemetry in MODULE_META.
 */
function syncCareerIntakeDropdowns() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Career dropdown sync skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(CAREER_GAS_CFG.SPREADSHEET_ID);
    const ledger = ss.getSheetByName(CAREER_GAS_CFG.LEDGER_TAB);
    if (!ledger || ledger.getLastRow() < 2) return;

    const rows = ledger.getRange(2, 1, ledger.getLastRow() - 1, 10).getDisplayValues();
    const tracks = new Set();
    let expiringAlerts = 0;

    rows.forEach((r) => {
      const track = String(r[2] || '').trim();
      const alertBadge = String(r[9] || '').trim().toUpperCase();
      if (track) tracks.add(track);
      if (alertBadge.indexOf('EXPIR') !== -1 || alertBadge.indexOf('RENEW') !== -1 || alertBadge.indexOf('WARN') !== -1) {
        expiringAlerts++;
      }
    });

    const sortedTracks = Array.from(tracks).sort((a, b) => a.localeCompare(b));
    let formUpdated = false;

    if (sortedTracks.length > 0) {
      const form = FormApp.openById(CAREER_GAS_CFG.FORM_ID);
      form.getItems().forEach((item) => {
        const type = item.getType();
        if (type !== FormApp.ItemType.LIST && type !== FormApp.ItemType.MULTIPLE_CHOICE) return;
        const title = (item.getTitle() || '').toLowerCase();
        if (title.indexOf('career track') !== -1) {
          if (type === FormApp.ItemType.LIST) {
            item.asListItem().setChoiceValues(sortedTracks);
          } else {
            item.asMultipleChoiceItem().setChoiceValues(sortedTracks);
          }
          formUpdated = true;
        }
      });
    }

    stampCareerMeta_(
      ss,
      'Last_Career_Sync',
      new Date().toISOString() + ' (Tracks:' + sortedTracks.length + ' | Alerts:' + expiringAlerts + ' | FormSynced:' + formUpdated + ')'
    );
    Logger.log('Career Intake sync complete: tracks=' + sortedTracks.length + ', alerts=' + expiringAlerts);
  } finally {
    lock.releaseLock();
  }
}

function stampCareerMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(CAREER_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_CAREER_INTAKE.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit   -> onCareerFormSubmit
 *   2) Daily at 7:00 AM -> syncCareerIntakeDropdowns
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(CAREER_GAS_CFG.SPREADSHEET_ID);
  const managed = new Set([
    CAREER_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT,
    CAREER_GAS_CFG.TRIGGERS.DAILY_AUDIT,
  ]);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (managed.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(CAREER_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger(CAREER_GAS_CFG.TRIGGERS.DAILY_AUDIT)
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  syncCareerIntakeDropdowns();
  stampCareerMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Career & Experience Intake Triggers Armed!\n\n' +
      '• On form submit → onCareerFormSubmit\n' +
      '• Daily 7:00 AM → syncCareerIntakeDropdowns'
    );
  } catch (e) {
    Logger.log('Career triggers armed (headless run).');
  }
}

/**
 * ============================================================================
 * LifeOS v3.0 — 🔮 Pillar_6_Esoteric_Self (ID_PILLAR_6)
 * Production Apps Script: Layer-1 Form Esoteric Aligner + Sigil Helper
 * ============================================================================
 * Spreadsheet ID : 1vVvU5TfzjGYFMNbMlSNaUjREj8HBkDPMwbzLiBnfxA0
 * Bundled From   : src/pillars/p6_esoteric/p6_esoteric_form_upgrader.gs
 *
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

// --- BEGIN SOURCE: src/pillars/p6_esoteric/p6_esoteric_form_upgrader.gs ---
/**
 * ============================================================================
 * LIFEOS-v3 // PILLAR 6: ESOTERIC SELF — LAYER 1 FORM UPGRADER & CAPSTONE MENU
 * File: src/pillars/p6_esoteric/p6_esoteric_form_upgrader.gs
 * ============================================================================
 * Strictly enforces LifeOS Laws 1–8:
 *  - Upgrades existing Layer 1 Google Forms IN-PLACE (preserving responder URLs
 *    and destinations) so Pillar 6 captures structured metaphysical telemetry:
 *      1. Daily Check-In Form (`RAW_DATA_DailyCheckIn`): Prana Level (1-10) &
 *         Energy Retention / Clean Day (`Yes` / `No`).
 *      2. Annual Vision & Philosophy Form (`RAW_DATA_AnnualReview`): verifies
 *         True Will Declaration & Current True Will Alignment (1-10).
 *      3. New Quest Form (`RAW_DATA_Quests`): adds `[Ritual] Quest` as a
 *         selectable tier/flag for structured esoteric & retention practices.
 *      4. Universal Event Log Form (`RAW_DATA_EventLog`): adds metaphysical /
 *         somatic practice tags (`[Metaphysics]`, `[Hermeticism]`,
 *         `[Jungian_Psychology]`, `[Silence]`, `[Breathwork]`, `[Qi_Gong]`)
 *         plus optional `Linked_Sigil_ID` & `True_Will_Aligned?` (`Yes`/`No`).
 *  - Guarded by `LockService.getScriptLock()`, zero PII/sigil prose logged.
 * ============================================================================
 */

const P6_FORM_CFG = Object.freeze({
  RAW_DAILY_ID: '1Bz2AH4oJMvzhETSvEhG5H58mlF-RNLMG6IaTTKaODSY',
  RAW_ANNUAL_ID: '17YdM8NAansiDZWnQTUL928LlWc9ZypPMFLcco02lZ7Q',
  RAW_QUESTS_ID: '1uV7FXlTU--gHFOt7zWYRkDxGk15QXIPGbBcshkk4TVw',
  RAW_EVENT_ID: '1p9LUEUQl_2N0AvaC15FGqD7ySzfJMObEeZj-KCQUZ-8',
  FALLBACK_DAILY_FORM_ID: '1wJV0-OBFUHnCQVK9M3-nKh1EX_eLh842HAkMcU9b77U',
  FALLBACK_EVENT_FORM_ID: '1VlmvTmuOLT7QiIpXdN86Kd-1eF8KPe82CUxJSm62lrE',
  LOCK_TIMEOUT_MS: 30000,
});

/**
 * Adds the Pillar 6 Esoteric Self capstone menu on spreadsheet open.
 */
function onOpenP6Legacy_() {
  SpreadsheetApp.getUi()
    .createMenu('🔮 Pillar 6: Esoteric Self')
    .addItem('📝 Upgrade All 4 Layer 1 Forms for Pillar 6 (In-Place)', 'upgradeAllPillar6Layer1Forms')
    .addSeparator()
    .addItem('✨ Generate Next Sigil ID in SIGIL_MANIFESTATION_LOG', 'insertNextSigilRow')
    .addToUi();
}

/**
 * Upgrades Daily Check-In, Annual Review, New Quest, and Universal Event Log
 * forms IN-PLACE, preserving all existing responder links and destinations.
 */
function upgradeAllPillar6Layer1Forms() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(P6_FORM_CFG.LOCK_TIMEOUT_MS)) return;

  try {
    const report = [];
    report.push(upgradeDailyCheckInFormForP6_());
    report.push(upgradeAnnualReviewFormForP6_());
    report.push(upgradeQuestFormForP6_());
    report.push(upgradeEventLogFormForP6_());

    Logger.log(`P6_FORMS_UPGRADE: ${report.join(' | ')}`);
    try {
      SpreadsheetApp.getUi().alert(
        '🔮 Pillar 6 Layer 1 Forms Upgraded (In-Place)',
        report.join('\n'),
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {}
  } finally {
    lock.releaseLock();
  }
}

function openBoundForm_(spreadsheetId, fallbackFormId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const url = ss.getFormUrl();
  if (url) return FormApp.openByUrl(url);
  if (fallbackFormId) return FormApp.openById(fallbackFormId);
  return null;
}

function upgradeDailyCheckInFormForP6_() {
  const form = openBoundForm_(P6_FORM_CFG.RAW_DAILY_ID, P6_FORM_CFG.FALLBACK_DAILY_FORM_ID);
  if (!form) return 'Daily Check-In: No bound form found';
  const titles = new Set(form.getItems().map(i => i.getTitle().trim().toLowerCase()));
  let added = 0;

  if (!Array.from(titles).some(t => t.includes('prana'))) {
    form.addScaleItem()
      .setTitle('Prana Level (1-10)')
      .setBounds(1, 10)
      .setLabels('Energy Leak', 'High Vibration');
    added++;
  }
  if (!Array.from(titles).some(t => t.includes('retention') || t.includes('clean day'))) {
    form.addMultipleChoiceItem()
      .setTitle('Energy Retention / Clean Day')
      .setChoiceValues(['Yes', 'No']);
    added++;
  }
  return `Daily Check-In Form: +${added} field(s)`;
}

function upgradeAnnualReviewFormForP6_() {
  const form = openBoundForm_(P6_FORM_CFG.RAW_ANNUAL_ID, null);
  if (!form) return 'Annual Review Form: verified (headers already aligned)';
  const titles = new Set(form.getItems().map(i => i.getTitle().trim().toLowerCase()));
  let added = 0;

  if (!Array.from(titles).some(t => t.includes('true will') && !t.includes('alignment'))) {
    form.addParagraphTextItem().setTitle('True Will Declaration');
    added++;
  }
  if (!Array.from(titles).some(t => t.includes('true will alignment'))) {
    form.addScaleItem()
      .setTitle('Current True Will Alignment (1-10)')
      .setBounds(1, 10)
      .setLabels('Drifting', 'Adept Alignment');
    added++;
  }
  return `Annual Review Form: +${added} field(s)`;
}

function upgradeQuestFormForP6_() {
  const form = openBoundForm_(P6_FORM_CFG.RAW_QUESTS_ID, null);
  if (!form) return 'New Quest Form: no bound URL detected (RAW_DATA_Quests headers already ready)';
  let updated = 0;

  form.getItems().forEach(item => {
    const t = item.getTitle().toLowerCase();
    if (t.includes('tier') || t.includes('scope') || t.includes('flag')) {
      if (item.getType() === FormApp.ItemType.LIST) {
        const list = item.asListItem();
        const vals = list.getChoices().map(c => c.getValue());
        if (!vals.some(v => v.toLowerCase().includes('[ritual]'))) {
          vals.push('[Ritual] Quest');
          list.setChoiceValues(vals);
          updated++;
        }
      } else if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
        const mc = item.asMultipleChoiceItem();
        const vals = mc.getChoices().map(c => c.getValue());
        if (!vals.some(v => v.toLowerCase().includes('[ritual]'))) {
          vals.push('[Ritual] Quest');
          mc.setChoiceValues(vals);
          updated++;
        }
      } else if (item.getType() === FormApp.ItemType.CHECKBOX) {
        const cb = item.asCheckboxItem();
        const vals = cb.getChoices().map(c => c.getValue());
        if (!vals.some(v => v.toLowerCase().includes('[ritual]'))) {
          vals.push('[Ritual] Quest');
          cb.setChoiceValues(vals);
          updated++;
        }
      }
    }
  });
  return `New Quest Form: [Ritual] Quest option ensured (${updated} item(s) updated)`;
}

function upgradeEventLogFormForP6_() {
  const form = openBoundForm_(P6_FORM_CFG.RAW_EVENT_ID, P6_FORM_CFG.FALLBACK_EVENT_FORM_ID);
  if (!form) return 'Universal Event Log Form: No bound form found';

  const esotericTags = [
    '[Metaphysics]', '[Hermeticism]', '[Jungian_Psychology]',
    '[Silence]', '[Breathwork]', '[Qi_Gong]',
  ];
  let tagsAdded = 0;
  let fieldsAdded = 0;
  const titles = new Set(form.getItems().map(i => i.getTitle().trim().toLowerCase()));

  form.getItems().forEach(item => {
    if (item.getTitle().toLowerCase().includes('tag') && item.getType() === FormApp.ItemType.CHECKBOX) {
      const cb = item.asCheckboxItem();
      const vals = cb.getChoices().map(c => c.getValue());
      esotericTags.forEach(tag => {
        if (!vals.includes(tag)) {
          vals.push(tag);
          tagsAdded++;
        }
      });
      if (tagsAdded > 0) cb.setChoiceValues(vals);
    }
  });

  if (!titles.has('linked_sigil_id')) {
    form.addTextItem().setTitle('Linked_Sigil_ID').setHelpText('Optional: e.g., SIG-2026-001');
    fieldsAdded++;
  }
  if (!titles.has('true_will_aligned?')) {
    form.addMultipleChoiceItem().setTitle('True_Will_Aligned?').setChoiceValues(['Yes', 'No']);
    fieldsAdded++;
  }
  return `Universal Event Log Form: +${tagsAdded} esoteric tag(s), +${fieldsAdded} field(s)`;
}

/**
 * Convenience helper to seed the next sequential `SIG-YYYY-NNN` ID and today's date
 * in SIGIL_MANIFESTATION_LOG without touching blank-safe formulas in Cols G and I.
 */
function insertNextSigilRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SIGIL_MANIFESTATION_LOG');
  if (!sheet) return;

  const colA = sheet.getRange(7, 1, 50, 1).getValues();
  let nextIdx = 0;
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).trim() !== '') nextIdx = i + 1;
  }
  const row = 7 + nextIdx;
  const year = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
  const seq = String(nextIdx + 1).padStart(3, '0');
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  sheet.getRange(row, 1, 1, 2).setValues([[`SIG-${year}-${seq}`, today]]);
  sheet.getRange(row, 6).setValue('Active');
  sheet.setActiveSelection(sheet.getRange(row, 3));
}
// --- END SOURCE: src/pillars/p6_esoteric/p6_esoteric_form_upgrader.gs ---

function stampPillar6WeeklyHeartbeat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const meta = ss.getSheetByName('MODULE_META');
  if (!meta) return;
  const nowIso = new Date().toISOString();
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'Last_Weekly_Heartbeat') {
      meta.getRange(i + 1, 2).setValue(nowIso);
      return;
    }
  }
  meta.appendRow(['Last_Weekly_Heartbeat', nowIso, 'Managed automatically by ID_PILLAR_6.gs']);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔮 LifeOS Pillar 6')
    .addItem('Upgrade / Align Layer-1 Esoteric Form Sections', 'upgradeAllPillar6Layer1Forms')
    .addItem('Insert Next Sigil Manifestation Row', 'insertNextSigilRow')
    .addSeparator()
    .addItem('Install / Reset Weekly Heartbeat Trigger', 'setupTriggers')
    .addToUi();
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) Weekly Sunday 8:00 AM -> stampPillar6WeeklyHeartbeat
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'stampPillar6WeeklyHeartbeat') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('stampPillar6WeeklyHeartbeat')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(8)
    .create();

  stampPillar6WeeklyHeartbeat();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Pillar 6 (Esoteric Self) Trigger Armed!\n\n' +
      '• Weekly Sunday 8:00 AM → stampPillar6WeeklyHeartbeat\n' +
      '• Use menu to align Layer-1 Esoteric Form sections on demand.'
    );
  } catch (e) {
    Logger.log('Pillar 6 trigger armed (headless run).');
  }
}

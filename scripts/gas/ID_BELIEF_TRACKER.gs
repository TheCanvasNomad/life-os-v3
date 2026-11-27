/**
 * ============================================================================
 * LifeOS v3.0 — ⚖️ Belief & Stance Tracker (ID_BELIEF_TRACKER)
 * Production Apps Script: Dynamic Form B Prompt_Anchor Dropdown Sync + Heartbeat
 * ============================================================================
 * Spreadsheet ID : 1ZlhB5xNyI5I8MssGhsp5wydyDJQu29tHmry4iShc2z0
 * Linked Forms   :
 *   - Form A (Initial Prompt & Belief Intake) : 1vnjN31gigBJp5RFQVtn7ODcnpYOsVvn_b5ckbYkbt2c
 *   - Form B (Re-Ranking & Stance Evolution)  : 1lcFB-I_hc2uXv2ONbx5kHs25L16Zmd4luiUzssK7AqQ
 *
 * LAW 1 COMPLIANCE: NEVER modifies Form Responses 1 or Form Responses 2.
 * ZERO-PII BOUNDARY: Syncs strictly canonical Prompt_Anchor labels to Form B.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const BELIEF_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '1ZlhB5xNyI5I8MssGhsp5wydyDJQu29tHmry4iShc2z0',
  PROMPT_REGISTRY_TAB: 'Prompt_Registry',
  META_TAB: 'MODULE_META',
  FORM_B_RERANK_ID: '1lcFB-I_hc2uXv2ONbx5kHs25L16Zmd4luiUzssK7AqQ',
  MAX_CHOICES: 950,
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'onBeliefFormSubmit',
    SYNC_INTERVAL: 'syncBeliefPromptDropdown',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚖️ LifeOS Beliefs')
    .addItem('Sync Prompt_Registry → Form B Dropdown', 'syncBeliefPromptDropdown')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Fires on Form A or Form B submission. Immediately updates Form B's Prompt dropdown
 * so newly submitted Form A beliefs are selectable for re-ranking within seconds.
 */
function onBeliefFormSubmit(e) {
  syncBeliefPromptDropdown();
}

/**
 * Reads unique Prompt_Anchor values from Prompt_Registry!B2:B and updates
 * the Prompt selector item on Form B (Re-Ranking & Stance Evolution).
 */
function syncBeliefPromptDropdown() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Belief dropdown sync skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(BELIEF_GAS_CFG.SPREADSHEET_ID);
    const registry = ss.getSheetByName(BELIEF_GAS_CFG.PROMPT_REGISTRY_TAB);
    if (!registry) {
      throw new Error('Missing Prompt_Registry tab.');
    }

    const lastRow = registry.getLastRow();
    if (lastRow < 2) return;

    // Column B = Prompt_Anchor (exact match used by Form_B_Rerank & Ranked_Ideas)
    const rawValues = registry.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
    const seen = new Set();
    const prompts = [];
    rawValues.forEach((row) => {
      const val = String(row[0] || '').trim();
      if (val && !seen.has(val)) {
        seen.add(val);
        prompts.push(val);
      }
    });

    if (prompts.length === 0) {
      Logger.log('No Prompt_Anchor entries found in Prompt_Registry!B2:B.');
      return;
    }

    const bounded = prompts.slice(0, BELIEF_GAS_CFG.MAX_CHOICES);
    const formB = FormApp.openById(BELIEF_GAS_CFG.FORM_B_RERANK_ID);
    const items = formB.getItems();
    let updated = false;

    for (let i = 0; i < items.length; i++) {
      const type = items[i].getType();
      if (type !== FormApp.ItemType.LIST && type !== FormApp.ItemType.MULTIPLE_CHOICE) continue;
      const title = (items[i].getTitle() || '').toLowerCase();
      if (
        title.indexOf('prompt') !== -1 ||
        title.indexOf('belief') !== -1 ||
        title.indexOf('claim') !== -1 ||
        title.indexOf('idea') !== -1 ||
        title.indexOf('topic') !== -1
      ) {
        if (type === FormApp.ItemType.LIST) {
          items[i].asListItem().setChoiceValues(bounded);
        } else {
          items[i].asMultipleChoiceItem().setChoiceValues(bounded);
        }
        updated = true;
        break;
      }
    }

    // Fallback to the first LIST item if title phrasing changed
    if (!updated) {
      const firstList = items.find((it) => it.getType() === FormApp.ItemType.LIST);
      if (firstList) {
        firstList.asListItem().setChoiceValues(bounded);
        updated = true;
      }
    }

    stampBeliefMeta_(
      ss,
      'Last_FormB_Dropdown_Sync',
      new Date().toISOString() + ' (' + bounded.length + ' prompts, updated=' + updated + ')'
    );
    Logger.log('Belief Form B dropdown synced: ' + bounded.length + ' prompts.');
  } finally {
    lock.releaseLock();
  }
}

function stampBeliefMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(BELIEF_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_BELIEF_TRACKER.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit -> onBeliefFormSubmit
 *   2) Every 6 hours  -> syncBeliefPromptDropdown
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(BELIEF_GAS_CFG.SPREADSHEET_ID);
  const managed = new Set([
    BELIEF_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT,
    BELIEF_GAS_CFG.TRIGGERS.SYNC_INTERVAL,
  ]);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (managed.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(BELIEF_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger(BELIEF_GAS_CFG.TRIGGERS.SYNC_INTERVAL)
    .timeBased()
    .everyHours(6)
    .create();

  syncBeliefPromptDropdown();
  stampBeliefMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Belief & Stance Tracker Triggers Armed!\n\n' +
      '• On form submit → onBeliefFormSubmit\n' +
      '• Every 6 hours → syncBeliefPromptDropdown\n' +
      '• Form B Prompt_Anchor dropdown synced.'
    );
  } catch (e) {
    Logger.log('Belief Tracker triggers armed (headless run).');
  }
}

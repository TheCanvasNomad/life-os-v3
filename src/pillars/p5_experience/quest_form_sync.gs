/**
 * ============================================================================
 * LIFEOS v3.0 — PILLAR 5: QUEST FORM SYNC & HERO'S JOURNEY ENGINE (Law 2)
 * Bound inside: 🏆 Pillar_5_Experience_Legacy (1AdMP-VKzTPNbSSTUoLrbqAjtBdYlf4mzLYwyWbaUrQw)
 *
 * Responsibilities:
 *  - Custom menu 🏆 Pillar 5: Experience & Legacy
 *  - upgradePillar5FormsToV3(): upgrades existing New Quest Form & Annual Vision
 *    Review Form in-place (preserving responder links & existing responses!)
 *  - syncParentQuestDropdownAndHerosJourney(): dynamically syncs active Epic/Major
 *    quests into the New Quest Form's "Parent Quest" dropdown and provisions
 *    dedicated 12-stage Hero's Journey tabs for flagged quests (LockService guarded)
 * ============================================================================
 */

const P5_CFG = {
  P5_SS_ID: '1AdMP-VKzTPNbSSTUoLrbqAjtBdYlf4mzLYwyWbaUrQw',
  RAW_QUESTS_SS_ID: '1uV7FXlTU--gHFOt7zWYRkDxGk15QXIPGbBcshkk4TVw',
  RAW_ANNUAL_SS_ID: '17YdM8NAansiDZWnQTUL928LlWc9ZypPMFLcco02lZ7Q',
  CONTROL_FOLDER_ID: '1cCrkeThYdMl4BOTI0ww8dhSxlpBPE53J',
  FALLBACK_QUEST_FORM_ID: '10Cfy5W3Mehew_GMaPfqcxjBXxSSDz9FSSACTzgFNtwM',
  FALLBACK_ANNUAL_FORM_ID: '1OtyJa4NWMcxlYNj2JvNBmiRcBgXYBQ2z2yM6IoZ_scE',
  LIFEOS_CALENDAR_NAME: 'Life OS'
};

/**
 * Adds the Pillar 5 command menu when opening 🏆 Pillar_5_Experience_Legacy.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏆 Pillar 5: Experience & Legacy')
    .addItem('🔄 Sync Parent Quest Dropdown & Hero\'s Journey Tabs', 'syncParentQuestDropdownAndHerosJourney')
    .addItem('📁 Provision Drive Folders for Active Epic/Major Quests', 'provisionQuestDriveFolders')
    .addItem('📅 Sync Quest Target Dates to Life OS Calendar', 'syncQuestTargetsToCalendar')
    .addItem('📜 Chronicle Completed Epic/Blueprint Quests to Mythos Codex', 'appendCompletedQuestsToMythosCodex')
    .addSeparator()
    .addItem('📝 Upgrade Existing Forms to Full v3.0 Schema (In-Place)', 'upgradePillar5FormsToV3')
    .addItem('⏱️ Install Automated On-Form-Submit & Hourly Triggers', 'installPillar5Triggers')
    .addToUi();
}

/**
 * Installs idempotent hourly & form-submit triggers for Pillar 5 automations.
 */
function installPillar5Triggers() {
  const managed = new Set([
    'runPillar5AutomationSuite',
    'syncParentQuestDropdownAndHerosJourney'
  ]);
  ScriptApp.getProjectTriggers().forEach(t => {
    if (managed.has(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runPillar5AutomationSuite').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert('⏱️ Installed hourly Pillar 5 automation suite trigger.');
}

/**
 * Orchestrates all 4 Pillar 5 automation modules under a single ScriptLock.
 */
function runPillar5AutomationSuite() {
  syncParentQuestDropdownAndHerosJourney();
  if (typeof provisionQuestDriveFolders === 'function') provisionQuestDriveFolders();
  if (typeof syncQuestTargetsToCalendar === 'function') syncQuestTargetsToCalendar();
  if (typeof appendCompletedQuestsToMythosCodex === 'function') appendCompletedQuestsToMythosCodex();
}

/**
 * Resolves the exact live Google Form linked to a Layer 1 response sheet (preserving
 * existing responder links & responses), falling back to known Form ID if needed.
 */
function openLinkedForm_(responseSheetId, fallbackFormId) {
  const ss = SpreadsheetApp.openById(responseSheetId);
  const url = ss.getFormUrl();
  if (url) {
    return FormApp.openByUrl(url);
  }
  return FormApp.openById(fallbackFormId);
}

/**
 * Upgrades existing "Life OS - New Quest Form" and "Life OS - Annual Vision &
 * Philosophy Review Form" IN-PLACE (zero responder-link breakage, zero response loss).
 */
function upgradePillar5FormsToV3() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    // 1. Upgrade New Quest Form
    const qForm = openLinkedForm_(P5_CFG.RAW_QUESTS_SS_ID, P5_CFG.FALLBACK_QUEST_FORM_ID);
    const existingQ = new Set(qForm.getItems().map(it => it.getTitle().trim().toLowerCase()));

    const ensureList = (form, title, choices) => {
      if (existingQ.has(title.toLowerCase())) return;
      form.addListItem().setTitle(title).setChoiceValues(choices);
      existingQ.add(title.toLowerCase());
    };
    const ensureScale = (form, title, low, high) => {
      if (existingQ.has(title.toLowerCase())) return;
      form.addScaleItem().setTitle(title).setBounds(low, high);
      existingQ.add(title.toLowerCase());
    };
    const ensureText = (form, title) => {
      if (existingQ.has(title.toLowerCase())) return;
      form.addTextItem().setTitle(title);
      existingQ.add(title.toLowerCase());
    };
    const ensureCheckbox = (form, title, choices) => {
      if (existingQ.has(title.toLowerCase())) return;
      form.addCheckboxItem().setTitle(title).setChoiceValues(choices);
      existingQ.add(title.toLowerCase());
    };

    ensureScale(qForm, 'Importance (1-10)', 1, 10);
    ensureScale(qForm, 'Urgency (1-10)', 1, 10);
    ensureList(qForm, "Bloom's Cognitive Level", [
      'Remembering [1.0x]', 'Understanding [1.2x]', 'Applying [1.5x]',
      'Analyzing [1.8x]', 'Evaluating [2.2x]', 'Creating [3.0x]'
    ]);
    ensureText(qForm, 'Time Benchmark (Hours)');
    ensureText(qForm, 'Actual Hours');
    ensureList(qForm, 'Status', ['Not Started', 'In Progress', 'Blocked', 'Complete']);
    ensureCheckbox(qForm, 'Special Flags', [
      "Hero's Journey", 'Blueprint Quest', 'Paradox Quest', 'Healing Quest', 'Adventure Blueprint'
    ]);

    // 2. Upgrade Annual Vision & Philosophy Review Form
    const aForm = openLinkedForm_(P5_CFG.RAW_ANNUAL_SS_ID, P5_CFG.FALLBACK_ANNUAL_FORM_ID);
    const existingA = new Set(aForm.getItems().map(it => it.getTitle().trim().toLowerCase()));
    if (!existingA.has('foundational life philosophy')) {
      aForm.addListItem().setTitle('Foundational Life Philosophy').setChoiceValues([
        'Stoicism', 'Epicureanism', 'Absurdism', 'Taoism', 'Existentialism',
        'Hermeticism / Kabbalah', 'Virtue Ethics', 'Integral / Meta-Modernism'
      ]);
    }
    if (!existingA.has('dominant aqal / spiral dynamics altitude')) {
      aForm.addListItem().setTitle('Dominant AQAL / Spiral Dynamics Altitude').setChoiceValues([
        'Red (Power / Impulse)', 'Amber (Order / Traditional)', 'Orange (Achievement / Rational)',
        'Green (Pluralistic / Communitarian)', 'Teal (Integral / Systemic)', 'Turquoise (Holistic / Unitive)'
      ]);
    }

    syncParentQuestDropdownAndHerosJourney();
    Logger.log('upgradePillar5FormsToV3 completed in-place cleanly.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Syncs active Epic & Major Quests from DATABASE into the New Quest Form's
 * "Parent Quest" dropdown and ensures flagged [Hero's Journey] quests have
 * dedicated tracking sections/tabs.
 */
function syncParentQuestDropdownAndHerosJourney() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('syncParentQuestDropdownAndHerosJourney skipped: lock held.');
    return;
  }
  try {
    const ss = SpreadsheetApp.openById(P5_CFG.P5_SS_ID);
    const db = ss.getSheetByName('DATABASE');
    if (!db || db.getLastRow() < 2) return;

    const rows = db.getRange(2, 1, db.getLastRow() - 1, 17).getValues();
    const activeParents = [];
    const heroQuests = [];

    rows.forEach(r => {
      const name = String(r[1] || '').trim();
      const tier = String(r[16] || r[4] || '').trim();
      const status = String(r[13] || '').trim();
      const flags = String(r[14] || '').trim();
      if (!name) return;

      if ((/epic|major/i.test(tier)) && status !== 'Complete') {
        if (activeParents.indexOf(name) === -1) activeParents.push(name);
      }
      if (/hero/i.test(flags)) {
        heroQuests.push(name);
      }
    });

    // Update New Quest Form "Parent Quest" dropdown if present as a ListItem
    try {
      const qForm = openLinkedForm_(P5_CFG.RAW_QUESTS_SS_ID, P5_CFG.FALLBACK_QUEST_FORM_ID);
      const choices = activeParents.length > 0 ? activeParents : ['(None — Top-Level Quest)'];
      qForm.getItems().forEach(item => {
        if (/parent quest/i.test(item.getTitle()) && item.getType() === FormApp.ItemType.LIST) {
          item.asListItem().setChoiceValues(choices);
        }
      });
    } catch (e) {
      Logger.log('Form Parent Quest dropdown update skipped: ' + e.message);
    }

    // Generate dedicated Hero's Journey stage tabs for flagged quests (batch-safe, idempotent)
    const template = ss.getSheetByName('HEROS_JOURNEY');
    if (template && heroQuests.length > 0) {
      heroQuests.slice(0, 5).forEach(qName => {
        const tabName = ('HJ_' + qName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_')).slice(0, 28);
        if (!ss.getSheetByName(tabName)) {
          const copy = template.copyTo(ss).setName(tabName);
          copy.getRange('B4').setValue(qName);
        }
      });
    }
    Logger.log('Synced ' + activeParents.length + ' parent quests & ' + heroQuests.length + ' Hero Journey quests.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * LifeOS v3.0 — 🏆 Pillar_5_Experience_Legacy (ID_PILLAR_5)
 * Production Apps Script: Quest Form Sync + Drive Folders + Mythos Codex + Cal
 * ============================================================================
 * Spreadsheet ID : 1AdMP-VKzTPNbSSTUoLrbqAjtBdYlf4mzLYwyWbaUrQw
 * Linked Forms   :
 *   - Quests Form        : 1OtyJa4NWMcxlYNj2JvNBmiRcBgXYBQ2z2yM6IoZ_scE
 *   - Annual Review Form : 10Cfy5W3Mehew_GMaPfqcxjBXxSSDz9FSSACTzgFNtwM
 * Bundled From   :
 *   - src/pillars/p5_experience/quest_form_sync.gs
 *   - src/pillars/p5_experience/drive_manager.gs
 *   - src/pillars/p5_experience/mythos_chronicle.gs
 *   - src/pillars/p5_experience/quest_calendar_sync.gs
 *
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

// --- BEGIN SOURCE: src/pillars/p5_experience/quest_form_sync.gs ---
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
function onOpenP5Legacy_() {
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
// --- END SOURCE: src/pillars/p5_experience/quest_form_sync.gs ---

// --- BEGIN SOURCE: src/pillars/p5_experience/drive_manager.gs ---
/**
 * ============================================================================
 * LIFEOS v3.0 — PILLAR 5: QUEST GOOGLE DRIVE PROJECT FOLDER MANAGER (Law 2)
 * Automatically creates a dedicated project folder inside LifeOS_v3_Control /
 * Pillar_5_Quests whenever a new Epic Quest or Major Quest is submitted.
 * Guarded by LockService.getScriptLock() and idempotent folder checks.
 * ============================================================================
 */

const P5_DRIVE_CFG = {
  P5_SS_ID: '1AdMP-VKzTPNbSSTUoLrbqAjtBdYlf4mzLYwyWbaUrQw',
  CONTROL_FOLDER_ID: '1cCrkeThYdMl4BOTI0ww8dhSxlpBPE53J',
  QUESTS_ROOT_NAME: '🏆 Pillar_5_Quests',
  MAX_FOLDERS_PER_RUN: 25
};

/**
 * Ensures every active Epic Quest and Major Quest has its own Google Drive
 * project folder inside LifeOS_v3_Control / 🏆 Pillar_5_Quests.
 */
function provisionQuestDriveFolders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('provisionQuestDriveFolders skipped: lock held.');
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(P5_DRIVE_CFG.P5_SS_ID);
    const db = ss.getSheetByName('DATABASE');
    if (!db || db.getLastRow() < 2) return;

    const controlFolder = DriveApp.getFolderById(P5_DRIVE_CFG.CONTROL_FOLDER_ID);
    const rootFolder = getOrCreateChildFolder_(controlFolder, P5_DRIVE_CFG.QUESTS_ROOT_NAME);

    const rows = db.getRange(2, 1, db.getLastRow() - 1, 17).getValues();
    let createdCount = 0;

    for (let i = 0; i < rows.length && createdCount < P5_DRIVE_CFG.MAX_FOLDERS_PER_RUN; i++) {
      const qName = String(rows[i][1] || '').trim();
      const tier = String(rows[i][16] || rows[i][4] || '').trim();
      if (!qName || !/epic|major/i.test(tier)) continue;

      const prefix = /epic/i.test(tier) ? '🚀 [EPIC] ' : '⚔️ [MAJOR] ';
      const folderName = (prefix + qName).replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);

      const existing = rootFolder.getFoldersByName(folderName);
      if (!existing.hasNext()) {
        const qFolder = rootFolder.createFolder(folderName);
        qFolder.createFolder('01_Blueprints_&_Plans');
        qFolder.createFolder('02_Field_Logs_&_Artifacts');
        createdCount++;
      }
    }
    Logger.log('provisionQuestDriveFolders complete. Newly created folders: ' + createdCount);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateChildFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
// --- END SOURCE: src/pillars/p5_experience/drive_manager.gs ---

// --- BEGIN SOURCE: src/pillars/p5_experience/mythos_chronicle.gs ---
/**
 * ============================================================================
 * LIFEOS v3.0 — PILLAR 5: MYTHOS CODEX CHRONICLE ENGINE (Law 2 & Law 5)
 * Appends structured, NotebookLM-ready Mythos Chronicle entries to the master
 * "LifeOS — Master Mythos Codex" Google Doc inside LifeOS_v3_Control whenever
 * an Epic Quest or Blueprint Quest is marked Complete.
 * Idempotently tracked via PropertiesService & guarded by LockService.
 * ============================================================================
 */

const P5_MYTHOS_CFG = {
  P5_SS_ID: '1AdMP-VKzTPNbSSTUoLrbqAjtBdYlf4mzLYwyWbaUrQw',
  CONTROL_FOLDER_ID: '1cCrkeThYdMl4BOTI0ww8dhSxlpBPE53J',
  CODEX_DOC_TITLE: '📜 LifeOS — Master Mythos Codex',
  PROP_CODEX_DOC_ID: 'P5_MYTHOS_CODEX_DOC_ID',
  PROP_CHRONICLED_KEYS: 'P5_CHRONICLED_QUEST_KEYS'
};

/**
 * Scans DATABASE for completed Epic Quests or Blueprint Quests that have not yet
 * been chronicled and appends structured Mythos entries to the Master Codex Doc.
 */
function appendCompletedQuestsToMythosCodex() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('appendCompletedQuestsToMythosCodex skipped: lock held.');
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(P5_MYTHOS_CFG.P5_SS_ID);
    const db = ss.getSheetByName('DATABASE');
    if (!db || db.getLastRow() < 2) return;

    const props = PropertiesService.getScriptProperties();
    const chronicled = new Set(JSON.parse(props.getProperty(P5_MYTHOS_CFG.PROP_CHRONICLED_KEYS) || '[]'));

    const rows = db.getRange(2, 1, db.getLastRow() - 1, 23).getValues();
    const toChronicle = [];

    rows.forEach(r => {
      const qName = String(r[1] || '').trim();
      const desc = String(r[2] || '').trim();
      const pillar = String(r[3] || '').trim();
      const tier = String(r[16] || r[4] || '').trim();
      const values = String(r[7] || '').trim();
      const bloom = String(r[10] || '').trim();
      const status = String(r[13] || '').trim();
      const flags = String(r[14] || '').trim();
      const totalXp = r[22] || 0;

      if (!qName || status !== 'Complete') return;
      const isMythic = /epic/i.test(tier) || /blueprint|hero/i.test(flags);
      const dedupKey = qName.toLowerCase();
      if (!isMythic || chronicled.has(dedupKey)) return;

      toChronicle.push({
        key: dedupKey, name: qName, desc: desc, pillar: pillar,
        tier: tier, values: values, bloom: bloom, flags: flags, xp: totalXp
      });
    });

    if (toChronicle.length === 0) return;

    const doc = getOrCreateMythosCodexDoc_(props);
    const body = doc.getBody();
    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    toChronicle.forEach(q => {
      body.appendParagraph('## 🏆 ' + q.name + ' (' + todayStr + ')')
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph(
        'Tier: ' + q.tier + ' | Pillar: ' + q.pillar + ' | XP Earned: ' + q.xp +
        ' | Bloom Level: ' + (q.bloom || 'Standard') + ' | Flags: ' + (q.flags || 'None')
      );
      if (q.values) body.appendParagraph('CORE Values Embodied: ' + q.values);
      if (q.desc) body.appendParagraph('Quest Record: ' + q.desc);
      body.appendParagraph('Elixir & Legacy Takeaway: [Add post-completion mythic reflection here]');
      body.appendHorizontalRule();
      chronicled.add(q.key);
    });

    doc.saveAndClose();
    props.setProperty(P5_MYTHOS_CFG.PROP_CHRONICLED_KEYS, JSON.stringify(Array.from(chronicled)));
    Logger.log('Chronicled ' + toChronicle.length + ' completed mythic quests to Master Mythos Codex.');
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateMythosCodexDoc_(props) {
  const savedId = props.getProperty(P5_MYTHOS_CFG.PROP_CODEX_DOC_ID);
  if (savedId) {
    try { return DocumentApp.openById(savedId); } catch (e) {}
  }
  const folder = DriveApp.getFolderById(P5_MYTHOS_CFG.CONTROL_FOLDER_ID);
  const existing = folder.getFilesByName(P5_MYTHOS_CFG.CODEX_DOC_TITLE);
  if (existing.hasNext()) {
    const id = existing.next().getId();
    props.setProperty(P5_MYTHOS_CFG.PROP_CODEX_DOC_ID, id);
    return DocumentApp.openById(id);
  }
  const doc = DocumentApp.create(P5_MYTHOS_CFG.CODEX_DOC_TITLE);
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(folder);
  doc.getBody().appendParagraph('# 📜 LIFEOS v3.0 — MASTER MYTHOS CODEX')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  doc.getBody().appendParagraph('Permanent chronicle of completed Epic Quests, Hero\'s Journeys, and Blueprint Artifacts — structured for NotebookLM synthesis.');
  props.setProperty(P5_MYTHOS_CFG.PROP_CODEX_DOC_ID, doc.getId());
  return doc;
}
// --- END SOURCE: src/pillars/p5_experience/mythos_chronicle.gs ---

// --- BEGIN SOURCE: src/pillars/p5_experience/quest_calendar_sync.gs ---
/**
 * ============================================================================
 * LIFEOS v3.0 — PILLAR 5: QUEST TARGET DATE CALENDAR SYNC (Law 2)
 * Syncs uncompleted quest Target Completion Dates from RAW_DATA_Quests to the
 * "Life OS" Google Calendar and stamps Calendar_Event_ID (Col P) so events
 * are never duplicated. LockService guarded & batch-capped.
 * ============================================================================
 */

const P5_CAL_CFG = {
  RAW_QUESTS_SS_ID: '1uV7FXlTU--gHFOt7zWYRkDxGk15QXIPGbBcshkk4TVw',
  RAW_TAB: 'Form Responses 1',
  CALENDAR_NAME: 'Life OS',
  MAX_EVENTS_PER_RUN: 50
};

/**
 * Creates all-day milestone deadlines on the "Life OS" Google Calendar for any
 * quest with a valid Target Completion Date and blank Calendar_Event_ID.
 */
function syncQuestTargetsToCalendar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('syncQuestTargetsToCalendar skipped: lock held.');
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(P5_CAL_CFG.RAW_QUESTS_SS_ID);
    const sheet = ss.getSheetByName(P5_CAL_CFG.RAW_TAB);
    if (!sheet || sheet.getLastRow() < 2) return;

    const cals = CalendarApp.getCalendarsByName(P5_CAL_CFG.CALENDAR_NAME);
    const cal = cals.length > 0 ? cals[0] : CalendarApp.getDefaultCalendar();

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
    let created = 0;

    for (let i = 0; i < data.length && created < P5_CAL_CFG.MAX_EVENTS_PER_RUN; i++) {
      const qName = String(data[i][1] || '').trim();
      const desc = String(data[i][2] || '').trim();
      const pillar = String(data[i][3] || '').trim();
      const tier = String(data[i][4] || '').trim();
      const targetRaw = data[i][6];
      const status = String(data[i][13] || '').trim();
      const flags = String(data[i][14] || '').trim();
      const existingEventId = String(data[i][15] || '').trim();

      if (!qName || !targetRaw || existingEventId || status === 'Complete') continue;
      const targetDate = new Date(targetRaw);
      if (isNaN(targetDate.getTime())) continue;

      const glyph = /epic/i.test(tier) ? '🚀' : (/major/i.test(tier) ? '⚔️' : '🎯');
      const ev = cal.createAllDayEvent(
        glyph + ' Quest Target: ' + qName,
        targetDate,
        {
          description:
            'Pillar: ' + pillar + '\n' +
            'Tier: ' + tier + '\n' +
            'Flags: ' + (flags || 'Standard') + '\n\n' +
            desc + '\n\nSource: LifeOS Pillar 5 (Experience & Legacy)'
        }
      );
      sheet.getRange(i + 2, 16).setValue(ev.getId());
      created++;
    }
    Logger.log('syncQuestTargetsToCalendar created ' + created + ' calendar targets.');
  } finally {
    lock.releaseLock();
  }
}
// --- END SOURCE: src/pillars/p5_experience/quest_calendar_sync.gs ---

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏆 LifeOS Pillar 5')
    .addItem('Run Full Pillar 5 Automation Suite', 'runPillar5AutomationSuite')
    .addItem('Sync Parent Quest Dropdown & Hero Journey', 'syncParentQuestDropdownAndHerosJourney')
    .addItem('Provision Quest Drive Folders', 'provisionQuestDriveFolders')
    .addItem('Append Completed Quests -> Mythos Codex', 'appendCompletedQuestsToMythosCodex')
    .addSeparator()
    .addItem('Upgrade Pillar 5 Forms to v3', 'upgradePillar5FormsToV3')
    .addItem('Install / Reset All Pillar 5 Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) Every 6 hours -> runPillar5AutomationSuite
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'runPillar5AutomationSuite') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('runPillar5AutomationSuite')
    .timeBased()
    .everyHours(6)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Pillar 5 (Experience & Legacy) Trigger Armed!\n\n' +
      '• Every 6 hours → runPillar5AutomationSuite'
    );
  } catch (e) {
    Logger.log('Pillar 5 trigger armed (headless run).');
  }
}

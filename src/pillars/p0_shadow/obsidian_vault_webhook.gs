/**
 * ============================================================================
 * LIFEOS-v3 // PILLAR 0: SHADOW SELF — OBSIDIAN VAULT SEALER & FORM UPGRADER
 * File: src/pillars/p0_shadow/obsidian_vault_webhook.gs
 * ============================================================================
 * Strictly enforces LifeOS Laws 1–8:
 *  - Law 1/3: Never overwrites dynamic formulas in DATABASE (Cols A:O),
 *             CALCULATIONS, or DASHBOARD. Stamps seal receipts ONLY in Col P
 *             (`Vault_Seal_Receipt`), letting Col O auto-resolve SEALED_IN_VAULT.
 *  - Law 2:   Modular, lock-guarded (`LockService.getScriptLock()`), idempotent.
 *  - Law 4:   STRICT PRIVACY — zero raw journal prose logged to Logger or sent
 *             to LifeOS_feed_hub. Private Markdown stays strictly in your own
 *             Obsidian Vault export queue / configured private webhook.
 * ============================================================================
 */

const P0_CONSTANTS = Object.freeze({
  PILLAR_0_ID: '1dst5RTOgaIBr6EsXkuuqK5p18fSxnP3wUsn6gmhx-LU',
  RAW_SHADOW_ID: '1wzXYSOKo7oT_EpYcDtFcYBXypqw-BiwUGpoEjsOw5vU',
  FALLBACK_FORM_ID: '1ND9p5_lNx_6KAi2Tts9x96HB-k4epKi_7gaMtr-F_kA',
  CONTROL_FOLDER_ID: '1cCrkeThYdMl4BOTI0ww8dhSxlpBPE53J',
  VAULT_QUEUE_FOLDER_NAME: 'Obsidian_Vault_Shadow_Export_Queue',
  LOCK_TIMEOUT_MS: 30000,
  TABS: {
    DASHBOARD: 'DASHBOARD',
    DATABASE: 'DATABASE',
    CALCULATIONS: 'CALCULATIONS',
    CONFIG: 'P0_CONFIG',
    CONTEXT_IN: 'CONTEXT_IN',
  },
});

/**
 * Adds the custom Pillar 0 Shadow Work Bench menu on spreadsheet open.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌑 Pillar 0: Shadow Work Bench')
    .addItem('🔐 Seal Integrated Shadows → Obsidian Vault', 'sealIntegratedShadowsToObsidianVault')
    .addItem('🚨 Run Cross-Pillar Tripwire Router → Healing Quests', 'routeShadowTripwiresToQuests')
    .addSeparator()
    .addItem('📝 Upgrade Shadow Journal Form to v3.0 (In-Place)', 'upgradeShadowJournalFormToV3')
    .addItem('🔗 Configure Optional Obsidian Webhook URL', 'configureObsidianWebhookUrl')
    .addItem('⏰ Install Automated Pillar 0 Triggers', 'installP0Triggers')
    .addToUi();
}

/**
 * Scans DATABASE for Shadow Journal entries where:
 *   - Entry Status (Col J) === 'Integrated'
 *   - Seal in Obsidian Vault (Col K) === 'Yes'
 *   - Vault_Seal_Receipt (Col P) is blank
 * Formats each entry into YAML-frontmatter Markdown, stages it into the private
 * Obsidian Vault export queue folder in Drive (and optionally POSTs to a user-
 * configured webhook), and stamps `SEALED_IN_VAULT` receipt in Column P.
 */
function sealIntegratedShadowsToObsidianVault() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(P0_CONSTANTS.LOCK_TIMEOUT_MS)) {
    Logger.log('P0_VAULT_SKIP: Lock busy.');
    return { status: 'LOCKED_SKIP', sealed: 0 };
  }

  try {
    const ss = SpreadsheetApp.openById(P0_CONSTANTS.PILLAR_0_ID);
    const db = ss.getSheetByName(P0_CONSTANTS.TABS.DATABASE);
    if (!db || db.getLastRow() < 2) {
      return { status: 'NO_ROWS', sealed: 0 };
    }

    const lastRow = db.getLastRow();
    const values = db.getRange(2, 1, lastRow - 1, 16).getValues();
    const queueFolder = getOrCreateVaultQueueFolder_();
    const webhookUrl = PropertiesService.getScriptProperties().getProperty('OBSIDIAN_WEBHOOK_URL') || '';

    let sealedCount = 0;
    const nowUtc = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");

    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const triggerText = String(r[1] || '').trim();
      const entryStatus = String(r[9] || '').trim();
      const sealFlag = String(r[10] || '').trim().toUpperCase();
      const existingReceipt = String(r[15] || '').trim();

      if (!triggerText) continue;
      if (entryStatus !== 'Integrated' || sealFlag !== 'YES' || existingReceipt !== '') continue;

      const sheetRow = i + 2;
      const entryDate = r[0] instanceof Date
        ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      const saboteur = String(r[4] || 'Unassigned').trim();
      const rcmcLevel = String(r[6] || 'Level 1: Symptom ID [50 XP]').trim();
      const antifragilityXp = Number(r[11]) || 0;
      const wisdomPoints = Number(r[12]) || 0;
      const emotions = String(r[2] || '').trim();

      const markdown = buildObsidianShadowMarkdown_({
        date: entryDate,
        saboteur,
        rcmcLevel,
        wisdomPoints,
        antifragilityXp,
        emotions,
        trigger: triggerText,
        story: String(r[3] || '').trim(),
        fear: String(r[5] || '').trim(),
        reframe: String(r[7] || '').trim(),
        lesson: String(r[8] || '').trim(),
      });

      const safeSlug = saboteur.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shadow';
      const fileName = `${entryDate}_shadow_${safeSlug}_r${sheetRow}.md`;

      // Stage into private Drive queue folder for Obsidian sync
      queueFolder.createFile(fileName, markdown, MimeType.PLAIN_TEXT);

      // Optional private webhook dispatch (if user configured one)
      let dispatchMode = 'DRIVE_QUEUE';
      if (webhookUrl) {
        const resp = UrlFetchApp.fetch(webhookUrl, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            filename: fileName,
            date: entryDate,
            saboteur,
            rcmc_level: rcmcLevel,
            wisdom_points: wisdomPoints,
            markdown,
          }),
          muteHttpExceptions: true,
        });
        if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
          dispatchMode = 'DRIVE_QUEUE+WEBHOOK';
        }
      }

      // Stamp Col P (Vault_Seal_Receipt) ONLY -> Col O formula automatically turns SEALED_IN_VAULT!
      db.getRange(sheetRow, 16).setValue(`SEALED_IN_VAULT | ${nowUtc} | ${dispatchMode} | ${fileName}`);
      sealedCount++;
    }

    SpreadsheetApp.flush();
    // Privacy-safe log: counts only, NEVER private journal text
    Logger.log(`P0_VAULT_SEAL_COMPLETE: sealed=${sealedCount}`);

    try {
      SpreadsheetApp.getUi().alert(
        '🔐 Obsidian Vault Sealer Complete',
        `Sealed ${sealedCount} integrated shadow note(s) into "${P0_CONSTANTS.VAULT_QUEUE_FOLDER_NAME}".`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {}

    return { status: 'OK', sealed: sealedCount };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Generates clean Obsidian-ready Markdown with YAML frontmatter.
 * @param {Object} entry
 * @returns {string}
 */
function buildObsidianShadowMarkdown_(entry) {
  const esc = v => String(v || '').replace(/"/g, '\\"');
  return [
    '---',
    `date: ${entry.date}`,
    `saboteur: "${esc(entry.saboteur)}"`,
    `rcmc_level: "${esc(entry.rcmcLevel)}"`,
    `wisdom_points: ${entry.wisdomPoints}`,
    `antifragility_xp: ${entry.antifragilityXp}`,
    `emotions: "${esc(entry.emotions)}"`,
    'pillar: Pillar_0_Shadow_Self',
    'status: Integrated',
    'tags:',
    '  - lifeos/pillar-0',
    '  - shadow-work',
    '  - rcmc',
    '---',
    '',
    `# Shadow Integration — ${entry.date} (${entry.saboteur})`,
    '',
    '## 1. Triggering Event / Feeling',
    entry.trigger || '_Not recorded_',
    '',
    '## 2. Initial Emotion(s) & Story Told',
    `- **Emotions:** ${entry.emotions || '_Not recorded_'}`,
    `- **The Story I Told Myself:** ${entry.story || '_Not recorded_'}`,
    '',
    '## 3. Root Cause Excavation (RCMC)',
    `- **Primary Saboteur Hijack:** ${entry.saboteur}`,
    `- **RCMC Depth Level:** ${entry.rcmcLevel}`,
    `- **Underlying Fear / Unmet Need:** ${entry.fear || '_Not recorded_'}`,
    '',
    '## 4. Reframed Narrative / Deeper Truth',
    entry.reframe || '_Not recorded_',
    '',
    '## 5. Integrated Wisdom & Gravity Action Step',
    entry.lesson || '_Not recorded_',
    '',
  ].join('\n');
}

/**
 * Returns or creates the private Obsidian Vault export queue folder inside LifeOS_v3_Control.
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateVaultQueueFolder_() {
  const parent = DriveApp.getFolderById(P0_CONSTANTS.CONTROL_FOLDER_ID);
  const iter = parent.getFoldersByName(P0_CONSTANTS.VAULT_QUEUE_FOLDER_NAME);
  return iter.hasNext() ? iter.next() : parent.createFolder(P0_CONSTANTS.VAULT_QUEUE_FOLDER_NAME);
}

/**
 * Prompts the user to save an optional private Obsidian webhook URL in ScriptProperties.
 */
function configureObsidianWebhookUrl() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const current = props.getProperty('OBSIDIAN_WEBHOOK_URL') || '(none configured — Drive queue only)';
  const resp = ui.prompt(
    '🔗 Configure Obsidian Vault Webhook URL',
    `Current: ${current}\n\nEnter your private webhook endpoint (or leave blank to clear and use Drive queue only):`,
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const val = String(resp.getResponseText() || '').trim();
  if (val) {
    props.setProperty('OBSIDIAN_WEBHOOK_URL', val);
    ui.alert('Saved', 'Obsidian webhook URL saved securely in ScriptProperties.', ui.ButtonSet.OK);
  } else {
    props.deleteProperty('OBSIDIAN_WEBHOOK_URL');
    ui.alert('Cleared', 'Webhook cleared. Sealed notes will stage in your private Drive queue folder.', ui.ButtonSet.OK);
  }
}

/**
 * Upgrades the live `Life OS - Shadow Journal Form` IN-PLACE, preserving its
 * existing responder link and destination (`RAW_DATA_ShadowJournal`), appending
 * all missing v3.0 Shadow Excavation & RCMC fields.
 */
function upgradeShadowJournalFormToV3() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(P0_CONSTANTS.LOCK_TIMEOUT_MS)) return;

  try {
    const rawSs = SpreadsheetApp.openById(P0_CONSTANTS.RAW_SHADOW_ID);
    const linkedUrl = rawSs.getFormUrl();
    const form = linkedUrl ? FormApp.openByUrl(linkedUrl) : FormApp.openById(P0_CONSTANTS.FALLBACK_FORM_ID);
    const existing = new Set(form.getItems().map(item => item.getTitle().trim().toLowerCase()));

    const questionsToEnsure = [
      {
        type: 'LIST',
        title: 'Primary Saboteur Hijack',
        choices: [
          'Judge of Self', 'The Avoider', 'The Hyper-Rational', 'The Hyper-Achiever',
          'The Restless', 'The Pleaser', 'The Victim', 'The Controller', 'The Stickler', 'Hyper-Vigilant',
        ],
      },
      { type: 'PARAGRAPH', title: 'Underlying Fear / Unmet Need' },
      {
        type: 'LIST',
        title: 'RCMC Depth Level',
        choices: [
          'Level 1: Symptom ID [50 XP]',
          'Level 2: Immediate Cause [100 XP]',
          'Level 3: 5 Whys [250 XP]',
          'Level 4: Core Loop / Saboteur [500 XP]',
          'Level 5: Root Belief Refuted [1,000 XP + 1 Wisdom Pt]',
        ],
      },
      { type: 'PARAGRAPH', title: 'Reframed Narrative / Deeper Truth' },
      { type: 'PARAGRAPH', title: 'Lesson / Integrated Wisdom & Gravity Action Step' },
      {
        type: 'CHOICE',
        title: 'Entry Status',
        choices: ['Identified', 'In_Progress', 'Integrated'],
      },
      {
        type: 'CHOICE',
        title: 'Seal in Obsidian Vault',
        choices: ['Yes', 'No'],
      },
    ];

    let added = 0;
    questionsToEnsure.forEach(q => {
      if (existing.has(q.title.toLowerCase())) return;
      if (q.type === 'LIST') {
        form.addListItem().setTitle(q.title).setChoiceValues(q.choices);
      } else if (q.type === 'CHOICE') {
        form.addMultipleChoiceItem().setTitle(q.title).setChoiceValues(q.choices);
      } else {
        form.addParagraphTextItem().setTitle(q.title);
      }
      added++;
    });

    form.setDestination(FormApp.DestinationType.SPREADSHEET, P0_CONSTANTS.RAW_SHADOW_ID);
    Logger.log(`P0_FORM_UPGRADE_COMPLETE: added=${added}`);

    try {
      SpreadsheetApp.getUi().alert(
        '📝 Shadow Journal Form Upgraded (v3.0)',
        `In-place upgrade complete!\nQuestions added: ${added}\nDestination verified: RAW_DATA_ShadowJournal\nResponder URL preserved.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {}
  } finally {
    lock.releaseLock();
  }
}

/**
 * Installs hourly lock-guarded triggers for both Obsidian Vault Sealing and
 * Cross-Pillar Shadow Tripwire routing.
 */
function installP0Triggers() {
  const managed = new Set(['sealIntegratedShadowsToObsidianVault', 'routeShadowTripwiresToQuests']);
  ScriptApp.getProjectTriggers().forEach(t => {
    if (managed.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('sealIntegratedShadowsToObsidianVault').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('routeShadowTripwiresToQuests').timeBased().everyHours(6).create();

  try {
    SpreadsheetApp.getUi().alert(
      '⏰ Pillar 0 Triggers Installed',
      'Installed lock-guarded triggers:\n• Hourly Obsidian Vault Sealer\n• 6-Hour Cross-Pillar Tripwire Router',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (_) {}
}

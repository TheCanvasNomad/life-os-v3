/**
 * ============================================================================
 * LIFEOS v3.0 — PILLAR 4: GAP-ANALYSIS QUEST GENERATOR & KNOWLEDGE GATE (Law 2)
 * Bound inside: 🛠️ Pillar_4_Skills_Mission (1PHTTv1Qpdy5JAyLarOaXYAIsNIuAk8YFBw9GqvIslT0)
 *
 * Responsibilities:
 *  - Custom menu 🛠️ Pillar 4: Skills & Mission
 *  - upgradeQuarterlyCareerFormToV3(): upgrades existing "Life OS - Quarterly
 *    Career Review Form" IN-PLACE across all 5 Ikigai/Gap/ROI sections
 *  - generateGapAnalysisQuests(): creates [Learning_Quest] stubs from Quarterly
 *    Career Review Required Skills & Portfolio Milestones
 *  - enforceKnowledgeIntegrationGate(): auto-prompts an Applying [1.5x] Sub-Quest
 *    whenever a Remembering/Understanding Learning Quest is marked Complete
 * ============================================================================
 */

const P4_CFG = {
  P4_SS_ID: '1PHTTv1Qpdy5JAyLarOaXYAIsNIuAk8YFBw9GqvIslT0',
  RAW_CAREER_SS_ID: '12mCzB0g358-d-m7Fw7Zn1MK1VO1kKKl6z4IsFuTXDOI',
  RAW_QUESTS_SS_ID: '1uV7FXlTU--gHFOt7zWYRkDxGk15QXIPGbBcshkk4TVw',
  CAREER_FORM_ID: '1V9D2L4pWx4D-gzKpUAA9CdVfXLQbh0r9Rza6npn5Lf4'
};

/**
 * Adds the Pillar 4 menu when opening 🛠️ Pillar_4_Skills_Mission.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛠️ Pillar 4: Skills & Mission')
    .addItem('🎯 Generate Learning Quests from Career Gap Analysis', 'generateGapAnalysisQuests')
    .addItem('⚡ Enforce Knowledge Integration Gate (Prompt Applying Sub-Quests)', 'enforceKnowledgeIntegrationGate')
    .addItem('📺 Import "LifeOS Learning Queue" YouTube Playlist', 'importYouTubeLearningQueue')
    .addSeparator()
    .addItem('📝 Upgrade Quarterly Career Review Form to v3.0 (In-Place)', 'upgradeQuarterlyCareerFormToV3')
    .addItem('⏱️ Install Automated Hourly Pillar 4 Trigger', 'installPillar4Trigger')
    .addToUi();
}

function installPillar4Trigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runPillar4AutomationSuite') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runPillar4AutomationSuite').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert('⏱️ Installed hourly Pillar 4 automation trigger.');
}

function runPillar4AutomationSuite() {
  generateGapAnalysisQuests();
  enforceKnowledgeIntegrationGate();
  if (typeof importYouTubeLearningQueue === 'function') {
    try { importYouTubeLearningQueue(); } catch (e) { Logger.log('YT import skipped: ' + e.message); }
  }
}

/**
 * Upgrades the existing "Life OS - Quarterly Career Review Form" IN-PLACE
 * (preserving responder link & RAW_DATA_CareerReview destination) with all 5
 * v3.0 Ikigai, Trajectory, Gap Analysis & Education ROI sections.
 */
function upgradeQuarterlyCareerFormToV3() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const rawSs = SpreadsheetApp.openById(P4_CFG.RAW_CAREER_SS_ID);
    const formUrl = rawSs.getFormUrl();
    const form = formUrl ? FormApp.openByUrl(formUrl) : FormApp.openById(P4_CFG.CAREER_FORM_ID);

    const existingTitles = new Set(form.getItems().map(it => it.getTitle().trim().toLowerCase()));
    const has = t => existingTitles.has(t.toLowerCase());

    // Upgrade existing 1-5 Ikigai scales to 1-10 scales in-place
    form.getItems(FormApp.ItemType.SCALE).forEach(it => {
      const sc = it.asScaleItem();
      if (/passion|mastery|impact|paid|compensation/i.test(sc.getTitle())) {
        sc.setBounds(1, 10);
      }
    });

    // Pull live Skill Tree categories for Section 4 Gap Analysis checkboxes
    const p4Ss = SpreadsheetApp.openById(P4_CFG.P4_SS_ID);
    const st = p4Ss.getSheetByName('SKILL_TREE');
    const skillChoices = st && st.getLastRow() >= 2
      ? Array.from(new Set(st.getRange(2, 2, st.getLastRow() - 1, 1).getValues().map(r => String(r[0] || '').trim()).filter(Boolean)))
      : ['Maritime & Seamanship', 'Video Editing & Media', 'AI & Systems Architecture', 'Communication', 'Leadership'];

    if (!has('Organization / Vessel / Venture')) {
      form.addSectionHeaderItem().setTitle('Section 1B: Operational Context');
      form.addTextItem().setTitle('Organization / Vessel / Venture');
      form.addParagraphTextItem().setTitle('Core Responsibilities');
    }
    if (!has('Next Desired Role / Endorsement')) {
      form.addSectionHeaderItem().setTitle('Section 3: 90-Day Strategic Trajectory');
      form.addTextItem().setTitle('Next Desired Role / Endorsement');
      form.addTextItem().setTitle('Target Income Threshold ($)');
      form.addParagraphTextItem().setTitle('Primary Quarterly Milestone');
    }
    if (!has('Required Skills (Gap Analysis)')) {
      form.addSectionHeaderItem().setTitle('Section 4: Skill & Experience Gap Analysis');
      form.addCheckboxItem().setTitle('Required Skills (Gap Analysis)').setChoiceValues(skillChoices);
      form.addParagraphTextItem().setTitle('Required Experience / Portfolio Milestones');
    }
    if (!has('Active Degree / Certification / Maritime Endorsement')) {
      form.addSectionHeaderItem().setTitle('Section 5: Education & Credentials ROI');
      form.addTextItem().setTitle('Active Degree / Certification / Maritime Endorsement');
      form.addTextItem().setTitle('Capital Invested ($)');
      form.addTextItem().setTitle('Expected Income Delta ($)');
    }

    Logger.log('upgradeQuarterlyCareerFormToV3 completed in-place cleanly.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Generates [Learning_Quest] stubs in RAW_DATA_Quests from the latest
 * Quarterly Career Review's Required Skills & Portfolio Milestones (idempotent).
 */
function generateGapAnalysisQuests() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const crSs = SpreadsheetApp.openById(P4_CFG.RAW_CAREER_SS_ID);
    const crSheet = crSs.getSheetByName('Form Responses 1');
    const qSs = SpreadsheetApp.openById(P4_CFG.RAW_QUESTS_SS_ID);
    const qSheet = qSs.getSheetByName('Form Responses 1');
    if (!crSheet || !qSheet || crSheet.getLastRow() < 2) return;

    const latestRow = crSheet.getRange(crSheet.getLastRow(), 1, 1, 18).getValues()[0];
    const reqSkillsRaw = String(latestRow[13] || '').trim();
    const reqExpRaw = String(latestRow[14] || '').trim();
    const nextRole = String(latestRow[10] || 'Quarterly Career Target').trim();
    if (!reqSkillsRaw && !reqExpRaw) return;

    const existingNames = new Set(
      (qSheet.getLastRow() >= 2 ? qSheet.getRange(2, 2, qSheet.getLastRow() - 1, 1).getValues() : [])
        .map(r => String(r[0] || '').trim().toLowerCase())
    );

    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy HH:mm:ss');
    const toAppend = [];

    reqSkillsRaw.split(',').map(s => s.trim()).filter(Boolean).forEach(skill => {
      const qName = '[Gap Skill] Master ' + skill;
      if (existingNames.has(qName.toLowerCase())) return;
      toAppend.push([
        nowStr, qName,
        'Auto-generated from Quarterly Career Review Gap Analysis targeting: ' + nextRole,
        'Pillar 4: Skills & Mission', 'Sub-Quest', nextRole, '', 'Mastery, Sovereignty',
        8, 6, 'Understanding [1.2x]', 10, '', 'Not Started', 'Learning_Quest', ''
      ]);
      existingNames.add(qName.toLowerCase());
    });

    if (reqExpRaw) {
      const expName = '[Portfolio Milestone] ' + reqExpRaw.slice(0, 75);
      if (!existingNames.has(expName.toLowerCase())) {
        toAppend.push([
          nowStr, expName, reqExpRaw,
          'Pillar 4: Skills & Mission', 'Major Quest', nextRole, '', 'Mastery, Legacy',
          9, 7, 'Creating [3.0x]', 25, '', 'Not Started', 'Learning_Quest, Blueprint Quest', ''
        ]);
      }
    }

    if (toAppend.length > 0) {
      qSheet.getRange(qSheet.getLastRow() + 1, 1, toAppend.length, 16).setValues(toAppend);
    }
    Logger.log('generateGapAnalysisQuests created ' + toAppend.length + ' quests.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Enforces the Knowledge Integration Gate:
 * Whenever a Remembering [1.0x] or Understanding [1.2x] Learning Quest is marked
 * Complete, automatically spawns an Applying [1.5x] Sub-Quest to prevent
 * Productive Procrastination (idempotent).
 */
function enforceKnowledgeIntegrationGate() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const qSs = SpreadsheetApp.openById(P4_CFG.RAW_QUESTS_SS_ID);
    const qSheet = qSs.getSheetByName('Form Responses 1');
    if (!qSheet || qSheet.getLastRow() < 2) return;

    const rows = qSheet.getRange(2, 1, qSheet.getLastRow() - 1, 16).getValues();
    const existingNames = new Set(rows.map(r => String(r[1] || '').trim().toLowerCase()));
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy HH:mm:ss');
    const toAppend = [];

    rows.forEach(r => {
      const qName = String(r[1] || '').trim();
      const bloom = String(r[10] || '').trim();
      const status = String(r[13] || '').trim();
      const flags = String(r[14] || '').trim();
      if (!qName || status !== 'Complete') return;
      if (!/learning_quest/i.test(flags)) return;
      if (!/remembering|understanding/i.test(bloom)) return;

      const applyName = '[Apply] ' + qName.replace(/^\[(Study|Gap Skill)\]\s*/i, '');
      if (existingNames.has(applyName.toLowerCase())) return;

      toAppend.push([
        nowStr, applyName,
        'Knowledge Integration Gate triggered upon completing "' + qName + '". Build, teach, or deploy this concept in a real-world arena.',
        'Pillar 4: Skills & Mission', 'Sub-Quest', qName, '', 'Mastery, Discipline',
        8, 7, 'Applying [1.5x]', 3, '', 'Not Started', 'Learning_Quest, Blueprint Quest', ''
      ]);
      existingNames.add(applyName.toLowerCase());
    });

    if (toAppend.length > 0) {
      qSheet.getRange(qSheet.getLastRow() + 1, 1, toAppend.length, 16).setValues(toAppend);
    }
    Logger.log('enforceKnowledgeIntegrationGate spawned ' + toAppend.length + ' Applying Sub-Quests.');
  } finally {
    lock.releaseLock();
  }
}

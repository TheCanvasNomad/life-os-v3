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

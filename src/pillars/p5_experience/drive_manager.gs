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

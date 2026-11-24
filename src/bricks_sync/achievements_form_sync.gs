/**
 * ============================================================================
 * LIFEOS-v3 // 🏅 ACHIEVEMENTS ENGINE BRICK — FORM DROPDOWN SYNC
 * File: src/bricks_sync/achievements_form_sync.gs
 * Bound to: 🏅 Achievements_Engine_Brick (1oPwOgvsk49CJ7x9pmYIf0Ex2EBHlrKVpb7SO9Ja4-JQ)
 * ============================================================================
 * Keeps the linked Google Form (`Achievements`) category & per-category
 * "Select Achievement" dropdowns synchronized directly from `Categories` and
 * the 21 canonical category tabs (`B5:B14`). Never reads legacy deleted tabs
 * (`Master List` or `Answers`) and never mutates Layer 1 (`Form Responses 1`).
 * ============================================================================
 */

const ACH_FORM_CFG = Object.freeze({
  SPREADSHEET_ID: '1oPwOgvsk49CJ7x9pmYIf0Ex2EBHlrKVpb7SO9Ja4-JQ',
  FORM_ID: '1GQxmuG2avfYZXPKOXxgdQwHVoqXp-Pc3hwz4oVeTOa0',
  CATEGORIES_TAB: 'Categories',
  CATEGORY_START_ROW: 5,
  TITLE_COL_INDEX: 2, // Column B (Achievement_Title)
  LOCK_TIMEOUT_MS: 30000,
});

/**
 * Adds the custom `🏅 Achievements Engine` menu on spreadsheet open.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏅 Achievements Engine')
    .addItem('🔄 Sync Google Form Dropdowns from 21 Category Tabs', 'syncAchievementFormDropdowns')
    .addToUi();
}

/**
 * Reads all 21 category names from `Categories!A2:A22` and each category tab's
 * live `Achievement_Title` column (`B5:B`), updating matching Google Form
 * dropdowns cleanly under `LockService`.
 */
function syncAchievementFormDropdowns() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(ACH_FORM_CFG.LOCK_TIMEOUT_MS)) {
    Logger.log('ACH_FORM_SYNC_SKIP: Lock busy.');
    return { status: 'LOCKED_SKIP', updatedItems: 0 };
  }

  try {
    const ss = SpreadsheetApp.openById(ACH_FORM_CFG.SPREADSHEET_ID);
    const catSheet = ss.getSheetByName(ACH_FORM_CFG.CATEGORIES_TAB);
    if (!catSheet) throw new Error('Missing Categories tab.');

    const categories = catSheet
      .getRange(2, 1, Math.max(1, catSheet.getLastRow() - 1), 1)
      .getValues()
      .map(r => String(r[0] || '').trim())
      .filter(Boolean);

    const catItemsMap = {};
    categories.forEach(catName => {
      const sh = ss.getSheetByName(catName);
      if (!sh) return;
      const lastRow = sh.getLastRow();
      if (lastRow < ACH_FORM_CFG.CATEGORY_START_ROW) return;
      const titles = sh
        .getRange(
          ACH_FORM_CFG.CATEGORY_START_ROW,
          ACH_FORM_CFG.TITLE_COL_INDEX,
          lastRow - ACH_FORM_CFG.CATEGORY_START_ROW + 1,
          1
        )
        .getValues()
        .map(r => String(r[0] || '').trim())
        .filter(Boolean);
      if (titles.length > 0) catItemsMap[catName] = titles;
    });

    const form = FormApp.openById(ACH_FORM_CFG.FORM_ID);
    const items = form.getItems();
    let updatedCount = 0;
    let currentSectionTitle = '';

    items.forEach(item => {
      const type = item.getType();
      const title = String(item.getTitle() || '').trim();

      if (type === FormApp.ItemType.PAGE_BREAK) {
        currentSectionTitle = title;
        return;
      }

      if (type === FormApp.ItemType.LIST) {
        const listItem = item.asListItem();
        if (title === 'Select Category' || title === 'Select Category for New Item') {
          listItem.setChoiceValues(categories);
          updatedCount++;
        } else if (title === 'Select Achievement') {
          const matchedCat = categories.find(
            c => c.toLowerCase() === currentSectionTitle.toLowerCase() ||
                 currentSectionTitle.toLowerCase().includes(c.toLowerCase())
          );
          if (matchedCat && catItemsMap[matchedCat]) {
            listItem.setChoiceValues(catItemsMap[matchedCat]);
            updatedCount++;
          }
        }
      }
    });

    Logger.log(`ACH_FORM_SYNC_OK: categories=${categories.length}, updatedDropdowns=${updatedCount}`);
    try {
      SpreadsheetApp.getUi().alert(
        '🏅 Form Dropdowns Synced',
        `Synchronized ${updatedCount} dropdown(s) across ${categories.length} canonical categories from B5:B14.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {}

    return { status: 'OK', categories: categories.length, updatedItems: updatedCount };
  } finally {
    lock.releaseLock();
  }
}

/**
 * LifeOS v3.0 — Pillar 3 Auto-Dossier Provisioner (`createDossierSheets.gs`)
 * ===========================================================================
 * Bound to: `💞 Pillar_3_Relationships` (ID: 1hi-hShSgH9X8i5NpCmh_a5HfuxevrxWkFDuJmbB1D0k)
 *
 * Scans `DATABASE!A2:A` (`MASTER_IDENTIFIER_LIST`) and automatically duplicates
 * `DOSSIER_TEMPLATE` for any newly added person identifier that does not yet
 * have a dedicated Dossier tab, binding cell `B1` of the new tab to that
 * person's identifier so all XLOOKUP formulas inside the Dossier hydrate live!
 *
 * Safety Guardrails:
 *   - Enforces a configurable batch cap (`MAX_DOSSIERS_PER_RUN`, default 15) so
 *     initial mass-import runs never time out Apps Script (6-min limit).
 *   - Sanitizes tab names to comply with Google Sheets naming limits.
 *   - Never overwrites an existing Dossier tab.
 */

const P3_DB_TAB = 'DATABASE';
const P3_TEMPLATE_TAB = 'DOSSIER_TEMPLATE';
const MAX_DOSSIERS_PER_RUN = 15;
const PROTECTED_TABS = new Set([
  'DASHBOARD', 'DATABASE', 'CALCULATIONS', 'DOSSIER_TEMPLATE',
  'P3_CONFIG', 'IMPORTS', 'MODULE_META', 'CONTEXT_IN', 'SIGNALS_OUT',
]);

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💞 LifeOS Pillar 3')
    .addItem('Generate Missing Dossier Tabs', 'createMissingDossierSheets')
    .addItem('Sync CRM Dropdowns to Forms', 'syncCrmDropdownsToForms')
    .addToUi();
}

function createMissingDossierSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName(P3_DB_TAB);
  const template = ss.getSheetByName(P3_TEMPLATE_TAB);
  if (!dbSheet || !template) {
    throw new Error('Missing DATABASE or DOSSIER_TEMPLATE tab.');
  }

  const lastRow = dbSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No identifiers present in DATABASE!A2:A yet.');
    return { created: 0 };
  }

  const existingTabNames = new Set(ss.getSheets().map((s) => s.getName()));
  const rawNames = dbSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let created = 0;

  for (let i = 0; i < rawNames.length; i++) {
    if (created >= MAX_DOSSIERS_PER_RUN) {
      Logger.log('Reached MAX_DOSSIERS_PER_RUN (' + MAX_DOSSIERS_PER_RUN + '). Re-run to continue.');
      break;
    }
    const identifier = String(rawNames[i][0] || '').trim();
    if (!identifier) continue;

    const tabName = sanitizeTabName_('Dossier_' + identifier);
    if (PROTECTED_TABS.has(tabName) || existingTabNames.has(tabName)) continue;

    const copy = template.copyTo(ss);
    copy.setName(tabName);
    copy.getRange('B1').setValue(identifier);
    copy.setHiddenGridlines(true);
    existingTabNames.add(tabName);
    created++;
  }

  Logger.log('Auto-provisioned ' + created + ' new Dossier tab(s).');
  return { created };
}

function sanitizeTabName_(raw) {
  return raw
    .replace(/[\[\]\*\?\/\\:]/g, '')
    .trim()
    .slice(0, 95);
}

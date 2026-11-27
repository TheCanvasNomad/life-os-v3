/**
 * ============================================================================
 * LifeOS v3.0 — 💞 Pillar_3_Relationships (ID_PILLAR_3)
 * Production Apps Script: CRM Form Dropdown Sync + Dossier Sheet Provisioner
 * ============================================================================
 * Spreadsheet ID : 1hi-hShSgH9X8i5NpCmh_a5HfuxevrxWkFDuJmbB1D0k
 * Linked Sync    : Master_Contacts_Sync -> Universal Event Log Form Dropdown
 * Bundled From   :
 *   - src/pillars/p3_relationships/createDossierSheets.gs
 *   - src/pillars/p3_relationships/sync_crm_dropdowns.gs
 *
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

// --- BEGIN SOURCE: src/pillars/p3_relationships/createDossierSheets.gs ---
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

function onOpenP3Legacy_() {
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
// --- END SOURCE: src/pillars/p3_relationships/createDossierSheets.gs ---

// --- BEGIN SOURCE: src/pillars/p3_relationships/sync_crm_dropdowns.gs ---
/**
 * LifeOS v3.0 — Pillar 3 CRM Contact Dropdown Sync (`sync_crm_dropdowns.gs`)
 * ===========================================================================
 * Bound to: `💞 Pillar_3_Relationships` (ID: 1hi-hShSgH9X8i5NpCmh_a5HfuxevrxWkFDuJmbB1D0k)
 * Source CRM: `📇 CRM_CORE` (ID: 1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g)
 *
 * Keeps the contact dropdown question in your Universal Event Log Form and
 * Universal Intake Form dynamically synced with active/tagged contacts in
 * `📇 CRM_CORE` (and `DATABASE!A2:A`) so every relationship log maps cleanly
 * without spelling typos.
 *
 * Script Properties to configure:
 *   - `UNIVERSAL_EVENT_LOG_FORM_ID`: Google Form ID for Universal Event Log
 *   - `UNIVERSAL_INTAKE_FORM_ID`:    Google Form ID for Universal Intake Report
 *   - `CRM_CORE_SPREADSHEET_ID`:     Defaults to 1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g
 */

const DEFAULT_CRM_CORE_ID = '1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g';
const CRM_TAB = 'Google Contacts Sync Master';
const MAX_DROPDOWN_CHOICES = 950; // Google Forms dropdown ceiling is 1,000 choices

function syncCrmDropdownsToForms() {
  const props = PropertiesService.getScriptProperties();
  const crmId = props.getProperty('CRM_CORE_SPREADSHEET_ID') || DEFAULT_CRM_CORE_ID;
  const eventFormId = props.getProperty('UNIVERSAL_EVENT_LOG_FORM_ID');
  const intakeFormId = props.getProperty('UNIVERSAL_INTAKE_FORM_ID');

  const contactList = collectActiveCrmIdentifiers_(crmId);
  if (contactList.length === 0) {
    Logger.log('No tagged contacts found in CRM_CORE; skipping Form dropdown overwrite.');
    return;
  }

  const results = {};
  if (eventFormId) {
    results.eventLogForm = updateFormPersonDropdown_(eventFormId, contactList, ['person', 'who']);
  }
  if (intakeFormId) {
    results.intakeForm = updateFormPersonDropdown_(intakeFormId, contactList, ['person', 'full name', 'contact']);
  }

  Logger.log('CRM dropdown sync finished (' + contactList.length + ' contacts): ' + JSON.stringify(results));
  return results;
}

function collectActiveCrmIdentifiers_(crmId) {
  const crmSs = SpreadsheetApp.openById(crmId);
  const sheet = crmSs.getSheetByName(CRM_TAB);
  if (!sheet) throw new Error('Missing CRM tab: ' + CRM_TAB);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const names = sheet.getRange(2, 4, lastRow - 1, 3).getValues();      // D:F First/Mid/Last
  const meta = sheet.getRange(2, 69, lastRow - 1, 3).getValues();      // BQ:BS Sphere/Tags/Status
  const set = new Set();

  for (let i = 0; i < names.length; i++) {
    const sphere = String(meta[i][0] || '').trim();
    const status = String(meta[i][2] || '').trim();
    if (!sphere || status === 'Do_Not_Engage') continue;
    const full = [names[i][0], names[i][1], names[i][2]].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
    if (full) set.add(full);
  }

  return Array.from(set).sort().slice(0, MAX_DROPDOWN_CHOICES);
}

function updateFormPersonDropdown_(formId, choices, titleHints) {
  const form = FormApp.openById(formId);
  const lists = form.getItems(FormApp.ItemType.LIST);
  for (let i = 0; i < lists.length; i++) {
    const title = lists[i].getTitle().toLowerCase();
    if (titleHints.some((h) => title.indexOf(h) !== -1)) {
      lists[i].asListItem().setChoiceValues(choices);
      return { updated: true, question: lists[i].getTitle(), count: choices.length };
    }
  }
  return { updated: false, reason: 'No matching dropdown (LIST) question found' };
}
// --- END SOURCE: src/pillars/p3_relationships/sync_crm_dropdowns.gs ---

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💞 LifeOS Pillar 3')
    .addItem('Sync Active CRM Contacts -> Event Log Form', 'syncCrmDropdownsToForms')
    .addItem('Create Missing Contact Dossier Tabs', 'createMissingDossierSheets')
    .addSeparator()
    .addItem('Install / Reset All Pillar 3 Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) Daily 6:00 AM -> syncCrmDropdownsToForms
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'syncCrmDropdownsToForms') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('syncCrmDropdownsToForms')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Pillar 3 (Relationships) Trigger Armed!\n\n' +
      '• Daily 6:00 AM → syncCrmDropdownsToForms\n' +
      '• Use menu to generate Contact Dossiers on demand.'
    );
  } catch (e) {
    Logger.log('Pillar 3 trigger armed (headless run).');
  }
}

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

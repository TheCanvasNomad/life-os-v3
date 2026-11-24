/**
 * ============================================================================
 * LIFEOS v3.2 — MASTER CONTACTS SYNC & VAULT ENGINE (Pure People API v1)
 * Workbook 1: 📱 Master_Contacts_Sync (1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g)
 * Workbook 2: 🗄️ Purged_Contacts_Vault (1eoLRVMOxdpHx3YkkWnfkOfowhTH8fbam8R2jDzUJB84)
 * Workbook 3: 📇 Core_CRM              (1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M)
 *
 * Modular Apps Script (Law 2):
 *  - Pure two-way Google People API v1 sync across all 89 unified columns
 *  - Master_Birthday <-> Birthday_Sync toggle (ON_PHONE_&_CALENDAR | SHEET_ONLY_HIDDEN)
 *  - TAXONOMY_MATRIX <-> Google Contact Labels auto-creation & attachment
 *  - Safe Two-Way Vault: PURGE_TO_VAULT | UNSYNC_PHONE_ONLY | RESTORE_TO_PHONEBOOK
 *  - autoHideEmptyColumns() triggered onOpen and post-sync
 *
 * SETUP: Extensions -> Apps Script -> Services (+) -> Enable "Google People API" (v1).
 * ============================================================================
 */

const MASTER_SYNC_CFG = {
  MASTER_SS_ID: '1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g',
  VAULT_SS_ID: '1eoLRVMOxdpHx3YkkWnfkOfowhTH8fbam8R2jDzUJB84',
  CORE_CRM_SS_ID: '1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M',
  MASTER_TAB: 'Google Contacts Sync Master',
  VAULT_LEDGER_TAB: 'PURGED_LEDGER',
  TAXONOMY_TAB: 'TAXONOMY_MATRIX',
  DIRECTORY_TAB: 'CONTACT_DIRECTORY',
  MAX_VAULT_ACTIONS_PER_RUN: 200,
  API_PACE_MS: 160,
  PERSON_FIELDS: [
    'names', 'nicknames', 'fileAses', 'genders', 'birthdays',
    'phoneNumbers', 'emailAddresses', 'imClients', 'urls',
    'organizations', 'addresses', 'events', 'relations',
    'biographies', 'userDefined', 'memberships', 'metadata'
  ].join(','),
  UPDATE_PERSON_FIELDS: [
    'names', 'nicknames', 'fileAses', 'genders', 'birthdays',
    'phoneNumbers', 'emailAddresses', 'imClients', 'urls',
    'organizations', 'addresses', 'events', 'relations',
    'biographies', 'userDefined', 'memberships'
  ].join(','),
  ALWAYS_VISIBLE_HEADERS: [
    'Contact ID', 'First Name', 'Last Name', 'Gender', 'Birthday',
    'Organization Name', 'Phone 1 - Label', 'Phone 1 - Value',
    'E-mail 1 - Label', 'E-mail 1 - Value', 'Address 1 - Country',
    'Notes', 'Labels', 'Master_Birthday', 'Birthday_Sync', 'Sync_Action'
  ]
};

/**
 * Custom LifeOS Phonebook Menu + automatic empty-column hygiene onOpen.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📱 LifeOS Phonebook')
    .addItem('🔄 Run Full Two-Way People API Sync', 'runFullTwoWaySync')
    .addItem('⬇️ Pull Changes from Google Contacts', 'pullFromGoogleContacts')
    .addItem('⬆️ Push Sheet Edits + Birthdays + Labels to Phone', 'pushSheetEditsToGoogleContacts')
    .addSeparator()
    .addItem('🗄️ Execute Vault Actions (PURGE_TO_VAULT / UNSYNC_PHONE_ONLY)', 'executeVaultActions')
    .addItem('♻️ Restore Marked Contacts from Purged_Contacts_Vault', 'restoreMarkedFromVault')
    .addSeparator()
    .addItem('🔗 Sync Master <-> Core_CRM <-> NotebookLM (Symbiosis)', 'runFullSymbiosisOrchestrator')
    .addItem('👁️ Auto-Hide Empty Columns', 'autoHideEmptyColumns')
    .addToUi();

  try {
    autoHideEmptyColumns();
  } catch (e) {
    Logger.log('onOpen autoHideEmptyColumns skipped: ' + e.message);
  }
}

/**
 * Automatically hides any optional column with zero populated data cells across rows 2..N
 * and automatically unhides any column that becomes populated.
 */
function autoHideEmptyColumns() {
  const ss = SpreadsheetApp.openById(MASTER_SYNC_CFG.MASTER_SS_ID);
  const sheet = ss.getSheetByName(MASTER_SYNC_CFG.MASTER_TAB);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;

  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0].map(h => String(h || '').trim());
  const alwaysKeep = new Set(MASTER_SYNC_CFG.ALWAYS_VISIBLE_HEADERS);

  for (let c = 0; c < lastCol; c++) {
    const hdr = headers[c];
    if (alwaysKeep.has(hdr)) {
      sheet.showColumns(c + 1);
      continue;
    }
    let hasValue = false;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][c] || '').trim() !== '') {
        hasValue = true;
        break;
      }
    }
    if (hasValue) {
      sheet.showColumns(c + 1);
    } else {
      sheet.hideColumns(c + 1);
    }
  }
}

/**
 * Full loop-safe two-way sync orchestrator.
 */
function runFullTwoWaySync() {
  pushSheetEditsToGoogleContacts();
  pullFromGoogleContacts();
  autoHideEmptyColumns();
  if (typeof runFullSymbiosisOrchestrator === 'function') {
    runFullSymbiosisOrchestrator();
  }
}

/**
 * Builds Contact Group label name <-> resourceName maps and auto-creates any missing
 * labels marked Sync_To_Phone_Label? = YES in Core_CRM -> TAXONOMY_MATRIX.
 */
function syncTaxonomyLabelsAndGetMaps_() {
  const nameToRes = {};
  const resToName = {};

  let pageToken = null;
  do {
    const resp = People.ContactGroups.list({ pageSize: 1000, pageToken: pageToken });
    (resp.contactGroups || []).forEach(g => {
      if (g.resourceName && g.name) {
        nameToRes[g.name.toLowerCase()] = g.resourceName;
        resToName[g.resourceName] = g.name;
      }
    });
    pageToken = resp.nextPageToken || null;
  } while (pageToken);

  // Auto-provision labels from Core_CRM -> TAXONOMY_MATRIX governance table (Cols I:L)
  try {
    const crmSs = SpreadsheetApp.openById(MASTER_SYNC_CFG.CORE_CRM_SS_ID);
    const taxSheet = crmSs.getSheetByName(MASTER_SYNC_CFG.TAXONOMY_TAB);
    if (taxSheet && taxSheet.getLastRow() >= 2) {
      const gov = taxSheet.getRange(2, 9, taxSheet.getLastRow() - 1, 4).getValues();
      gov.forEach(row => {
        const term = String(row[1] || '').trim();
        const shouldSync = String(row[2] || '').trim().toUpperCase() === 'YES';
        if (term && shouldSync && !nameToRes[term.toLowerCase()]) {
          try {
            const created = People.ContactGroups.create({ contactGroup: { name: term } });
            if (created && created.resourceName) {
              nameToRes[term.toLowerCase()] = created.resourceName;
              resToName[created.resourceName] = created.name || term;
            }
            Utilities.sleep(MASTER_SYNC_CFG.API_PACE_MS);
          } catch (err) {
            Logger.log('Label provision skipped for ' + term + ': ' + err.message);
          }
        }
      });
    }
  } catch (e) {
    Logger.log('TAXONOMY_MATRIX label check skipped: ' + e.message);
  }

  return { nameToRes: nameToRes, resToName: resToName };
}

/**
 * Pulls all Google Contacts into 📱 Master_Contacts_Sync (89 columns) using immutable Contact ID.
 * Preserves Master_Birthday when Birthday_Sync = SHEET_ONLY_HIDDEN.
 */
function pullFromGoogleContacts() {
  const ss = SpreadsheetApp.openById(MASTER_SYNC_CFG.MASTER_SS_ID);
  const sheet = ss.getSheetByName(MASTER_SYNC_CFG.MASTER_TAB);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const raw = sheet.getRange(1, 1, Math.max(1, lastRow), lastCol).getValues();
  const headers = raw[0].map(h => String(h || '').trim());
  const col = buildHeaderMap_(headers);

  const rowByCid = {};
  for (let r = 1; r < raw.length; r++) {
    const cid = String(raw[r][col['Contact ID']] || '').trim();
    if (cid) rowByCid[cid] = r;
  }

  const labelMaps = syncTaxonomyLabelsAndGetMaps_();
  let pageToken = null;
  const nowIso = new Date().toISOString();
  const appended = [];

  do {
    const resp = People.People.Connections.list('people/me', {
      personFields: MASTER_SYNC_CFG.PERSON_FIELDS,
      pageSize: 1000,
      pageToken: pageToken
    });
    const conns = resp.connections || [];
    conns.forEach(person => {
      const cid = person.resourceName || '';
      if (!cid) return;

      const existingIdx = rowByCid[cid];
      const rowArr = existingIdx !== undefined
        ? raw[existingIdx].slice()
        : new Array(headers.length).fill('');

      // Skip rows locked to sheet-only or pending vault purge
      const action = String(rowArr[col['Sync_Action']] || '').trim();
      if (action === 'PURGE_TO_VAULT' || action === 'UNSYNC_PHONE_ONLY') return;

      const parsed = personToMasterMap_(person, labelMaps.resToName);
      const bdaySync = String(rowArr[col['Birthday_Sync']] || '').trim();

      Object.keys(parsed).forEach(k => {
        if (col[k] === undefined) return;
        // Preserve hidden Master_Birthday when Birthday_Sync = SHEET_ONLY_HIDDEN
        if (k === 'Birthday' && bdaySync === 'SHEET_ONLY_HIDDEN') {
          rowArr[col['Birthday']] = '';
          return;
        }
        rowArr[col[k]] = parsed[k];
      });

      // Keep Master_Birthday hydrated from phone if Master_Birthday is blank
      if (parsed['Birthday'] && !String(rowArr[col['Master_Birthday']] || '').trim()) {
        rowArr[col['Master_Birthday']] = parsed['Birthday'];
        if (!bdaySync) rowArr[col['Birthday_Sync']] = 'ON_PHONE_&_CALENDAR';
      }
      if (!String(rowArr[col['Sync_Action']] || '').trim()) {
        rowArr[col['Sync_Action']] = 'KEEP';
      }
      rowArr[col['Last Updated Google Contacts']] = nowIso;
      rowArr[col['Sync_Direction_Lock']] = 'IDLE';
      rowArr[col['Sync_Hash']] = computeRowHash_(rowArr, headers);

      if (existingIdx !== undefined) {
        raw[existingIdx] = rowArr;
      } else {
        appended.push(rowArr);
      }
    });
    pageToken = resp.nextPageToken || null;
  } while (pageToken);

  // Always enforce Plain Text '@' format on Phone 1-4 Value cols (T, V, X, Z) before writing
  // so leading '+' E.164 international phone numbers never evaluate as '#ERROR!' formulas!
  ['Phone 1 - Value', 'Phone 2 - Value', 'Phone 3 - Value', 'Phone 4 - Value'].forEach(hdrName => {
    if (col[hdrName] !== undefined) {
      sheet.getRange(2, col[hdrName] + 1, Math.max(raw.length + appended.length, 6500), 1).setNumberFormat('@');
    }
  });

  if (raw.length > 1) {
    sheet.getRange(2, 1, raw.length - 1, headers.length).setValues(raw.slice(1));
  }
  if (appended.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appended.length, headers.length).setValues(appended);
  }
  Logger.log('pullFromGoogleContacts complete. Appended: ' + appended.length);
}

/**
 * Pushes changed sheet rows to Google Contacts via People API v1.
 * Enforces Master_Birthday <-> Birthday_Sync calendar toggle and TAXONOMY_MATRIX label attachment.
 */
function pushSheetEditsToGoogleContacts() {
  const ss = SpreadsheetApp.openById(MASTER_SYNC_CFG.MASTER_SS_ID);
  const sheet = ss.getSheetByName(MASTER_SYNC_CFG.MASTER_TAB);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;

  const raw = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = raw[0].map(h => String(h || '').trim());
  const col = buildHeaderMap_(headers);
  const labelMaps = syncTaxonomyLabelsAndGetMaps_();

  // Pull Sphere + Tags from Core_CRM to attach TAXONOMY_MATRIX phone labels
  const crmTagsByCid = fetchCoreCrmLabelsByCid_();
  const nowIso = new Date().toISOString();
  let pushed = 0;

  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    const cid = String(row[col['Contact ID']] || '').trim();
    const action = String(row[col['Sync_Action']] || '').trim();
    if (!cid || !cid.startsWith('people/')) continue;
    if (action === 'PURGE_TO_VAULT' || action === 'UNSYNC_PHONE_ONLY') continue;

    // Enforce Master_Birthday <-> Birthday_Sync rule before computing hash
    const masterBday = String(row[col['Master_Birthday']] || '').trim();
    const bdaySync = String(row[col['Birthday_Sync']] || '').trim();
    if (bdaySync === 'SHEET_ONLY_HIDDEN') {
      row[col['Birthday']] = '';
    } else if (bdaySync === 'ON_PHONE_&_CALENDAR' && masterBday) {
      row[col['Birthday']] = masterBday;
    }

    // Merge Core_CRM synced labels into Labels column
    const extraLabels = crmTagsByCid[cid] || [];
    if (extraLabels.length > 0) {
      const curLabels = String(row[col['Labels']] || '').split(',').map(s => s.trim()).filter(Boolean);
      extraLabels.forEach(lb => {
        if (curLabels.map(x => x.toLowerCase()).indexOf(lb.toLowerCase()) === -1) {
          curLabels.push(lb);
        }
      });
      row[col['Labels']] = curLabels.join(', ');
    }

    const newHash = computeRowHash_(row, headers);
    const oldHash = String(row[col['Sync_Hash']] || '').trim();
    if (oldHash && oldHash === newHash) continue;

    const payload = masterRowToPersonPayload_(row, col, labelMaps.nameToRes);
    try {
      let updated;
      try {
        updated = People.People.updateContact(payload, cid, {
          updatePersonFields: MASTER_SYNC_CFG.UPDATE_PERSON_FIELDS
        });
      } catch (etagErr) {
        // Optimistic concurrency retry with fresh ETag
        const fresh = People.People.get(cid, { personFields: 'metadata' });
        payload.etag = fresh.etag;
        updated = People.People.updateContact(payload, cid, {
          updatePersonFields: MASTER_SYNC_CFG.UPDATE_PERSON_FIELDS
        });
      }
      if (updated && updated.etag) {
        row[col['Contact_ETag']] = updated.etag;
      }
      row[col['Last Updated Sheet']] = nowIso;
      row[col['Sync_Direction_Lock']] = 'IDLE';
      row[col['Sync_Hash']] = computeRowHash_(row, headers);
      raw[r] = row;
      pushed++;
      Utilities.sleep(MASTER_SYNC_CFG.API_PACE_MS);
    } catch (e) {
      Logger.log('Push failed for ' + cid + ': ' + e.message);
    }
  }

  if (pushed > 0) {
    sheet.getRange(2, 1, raw.length - 1, headers.length).setValues(raw.slice(1));
  }
  Logger.log('pushSheetEditsToGoogleContacts pushed: ' + pushed);
}

/**
 * Executes PURGE_TO_VAULT (archive to Purged_Contacts_Vault -> delete from Phone -> remove from Master)
 * and UNSYNC_PHONE_ONLY (delete from Phone -> keep in Master & Core_CRM for analytics).
 */
function executeVaultActions() {
  const ui = SpreadsheetApp.getUi();
  const masterSs = SpreadsheetApp.openById(MASTER_SYNC_CFG.MASTER_SS_ID);
  const masterSheet = masterSs.getSheetByName(MASTER_SYNC_CFG.MASTER_TAB);
  const vaultSs = SpreadsheetApp.openById(MASTER_SYNC_CFG.VAULT_SS_ID);
  const vaultSheet = vaultSs.getSheetByName(MASTER_SYNC_CFG.VAULT_LEDGER_TAB);

  const lastRow = masterSheet.getLastRow();
  const lastCol = masterSheet.getLastColumn();
  if (lastRow < 2) return;

  const data = masterSheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0].map(h => String(h || '').trim());
  const col = buildHeaderMap_(headers);

  const purgeTargets = [];
  const unsyncTargets = [];
  for (let r = 1; r < data.length; r++) {
    const act = String(data[r][col['Sync_Action']] || '').trim();
    if (act === 'PURGE_TO_VAULT') purgeTargets.push(r);
    else if (act === 'UNSYNC_PHONE_ONLY') unsyncTargets.push(r);
  }

  const totalFound = purgeTargets.length + unsyncTargets.length;
  if (totalFound === 0) {
    ui.alert('No contacts marked PURGE_TO_VAULT or UNSYNC_PHONE_ONLY.');
    return;
  }

  const confirm = ui.alert(
    'Confirm Safe Vault & Unsync Execution',
    'Found ' + purgeTargets.length + ' contacts marked PURGE_TO_VAULT (will archive to Purged_Contacts_Vault first, delete from Google Contacts, then remove from Master_Contacts_Sync) and ' +
    unsyncTargets.length + ' contacts marked UNSYNC_PHONE_ONLY (will remove from Phone only, preserving analytics in Sheet & Core_CRM).\n\n' +
    'Batch cap: ' + MASTER_SYNC_CFG.MAX_VAULT_ACTIONS_PER_RUN + ' contacts per run. Proceed?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const nowIso = new Date().toISOString();
  let processed = 0;
  const rowsToDelete = [];

  // 1. Process PURGE_TO_VAULT (archive-first safety guarantee!)
  for (let i = 0; i < purgeTargets.length && processed < MASTER_SYNC_CFG.MAX_VAULT_ACTIONS_PER_RUN; i++) {
    const r = purgeTargets[i];
    const row = data[r];
    const cid = String(row[col['Contact ID']] || '').trim();
    const hasPhone = [col['Phone 1 - Value'], col['Phone 2 - Value'], col['Phone 3 - Value'], col['Phone 4 - Value']]
      .some(ci => ci !== undefined && String(row[ci] || '').trim() !== '');
    const reason = hasPhone ? 'Manual Phonebook Purge' : 'Email-Only Hygiene Purge';

    // Step A: Archive full row to Purged_Contacts_Vault FIRST
    const archiveRow = row.concat([nowIso, reason, 'ARCHIVED']);
    vaultSheet.appendRow(archiveRow);

    // Step B: Delete from Google Contacts via People API
    let deletedOk = false;
    if (cid.startsWith('people/')) {
      try {
        People.People.deleteContact(cid);
        deletedOk = true;
      } catch (e) {
        if (String(e.message).indexOf('404') !== -1 || String(e.message).indexOf('NOT_FOUND') !== -1) {
          deletedOk = true;
        } else {
          Logger.log('Delete failed for ' + cid + ' (kept in Master safely): ' + e.message);
        }
      }
      Utilities.sleep(MASTER_SYNC_CFG.API_PACE_MS);
    } else {
      deletedOk = true;
    }

    // Step C: Queue Master row removal ONLY after confirmed archive + delete
    if (deletedOk) {
      rowsToDelete.push(r + 1); // 1-indexed sheet row
      processed++;
    }
  }

  // Delete Master rows bottom-up so indices never shift
  rowsToDelete.sort((a, b) => b - a).forEach(r1 => masterSheet.deleteRow(r1));

  // 2. Process UNSYNC_PHONE_ONLY (delete from phone, keep row in Master & Core_CRM!)
  let unsynced = 0;
  for (let i = 0; i < unsyncTargets.length && processed < MASTER_SYNC_CFG.MAX_VAULT_ACTIONS_PER_RUN; i++) {
    const r = unsyncTargets[i];
    const row = data[r];
    const cid = String(row[col['Contact ID']] || '').trim();
    if (cid.startsWith('people/')) {
      try {
        People.People.deleteContact(cid);
        masterSheet.getRange(r + 1, col['Contact ID'] + 1).setValue('UNSYNCED_' + cid.replace('people/', ''));
        masterSheet.getRange(r + 1, col['Contact_ETag'] + 1).setValue('');
        masterSheet.getRange(r + 1, col['Last Updated Sheet'] + 1).setValue(nowIso);
        unsynced++;
        processed++;
        Utilities.sleep(MASTER_SYNC_CFG.API_PACE_MS);
      } catch (e) {
        Logger.log('UNSYNC_PHONE_ONLY failed for ' + cid + ': ' + e.message);
      }
    }
  }

  ui.alert('Vault execution complete.\nPurged to Vault: ' + rowsToDelete.length + '\nUnsynced Phone Only: ' + unsynced);
}

/**
 * Restores rows marked Restore_Action = RESTORE_TO_PHONEBOOK from Purged_Contacts_Vault
 * back into Google Contacts (People API createContact) and Master_Contacts_Sync.
 */
function restoreMarkedFromVault() {
  const ui = SpreadsheetApp.getUi();
  const masterSs = SpreadsheetApp.openById(MASTER_SYNC_CFG.MASTER_SS_ID);
  const masterSheet = masterSs.getSheetByName(MASTER_SYNC_CFG.MASTER_TAB);
  const vaultSs = SpreadsheetApp.openById(MASTER_SYNC_CFG.VAULT_SS_ID);
  const vaultSheet = vaultSs.getSheetByName(MASTER_SYNC_CFG.VAULT_LEDGER_TAB);

  const lastRow = vaultSheet.getLastRow();
  const lastCol = vaultSheet.getLastColumn();
  if (lastRow < 2) {
    ui.alert('Purged_Contacts_Vault is empty.');
    return;
  }

  const vData = vaultSheet.getRange(1, 1, lastRow, lastCol).getValues();
  const vHdr = vData[0].map(h => String(h || '').trim());
  const vCol = buildHeaderMap_(vHdr);
  const labelMaps = syncTaxonomyLabelsAndGetMaps_();
  const nowIso = new Date().toISOString();

  const restoredRows = [];
  for (let r = 1; r < vData.length; r++) {
    if (String(vData[r][vCol['Restore_Action']] || '').trim() !== 'RESTORE_TO_PHONEBOOK') continue;
    const row89 = vData[r].slice(0, 89);
    const payload = masterRowToPersonPayload_(row89, vCol, labelMaps.nameToRes);
    delete payload.etag;
    try {
      const created = People.People.createContact(payload);
      row89[vCol['Contact ID']] = created.resourceName || row89[vCol['Contact ID']];
      row89[vCol['Contact_ETag']] = created.etag || '';
      row89[vCol['Sync_Action']] = 'KEEP';
      row89[vCol['Last Updated Sheet']] = nowIso;
      row89[vCol['Last Updated Google Contacts']] = nowIso;
      masterSheet.appendRow(row89);
      restoredRows.push(r + 1);
      Utilities.sleep(MASTER_SYNC_CFG.API_PACE_MS);
    } catch (e) {
      Logger.log('Restore failed for row ' + (r + 1) + ': ' + e.message);
    }
  }

  restoredRows.sort((a, b) => b - a).forEach(r1 => vaultSheet.deleteRow(r1));
  ui.alert('Restored ' + restoredRows.length + ' contacts to Google Contacts & Master_Contacts_Sync.');
}

// ============================================================================
// INTERNAL HELPERS — FULL 89-COLUMN PEOPLE API v1 MAPPERS
// ============================================================================

function buildHeaderMap_(headers) {
  const m = {};
  headers.forEach((h, i) => { m[h] = i; });
  return m;
}

function fetchCoreCrmLabelsByCid_() {
  const out = {};
  try {
    const crmSs = SpreadsheetApp.openById(MASTER_SYNC_CFG.CORE_CRM_SS_ID);
    const taxSheet = crmSs.getSheetByName(MASTER_SYNC_CFG.TAXONOMY_TAB);
    const dirSheet = crmSs.getSheetByName(MASTER_SYNC_CFG.DIRECTORY_TAB);
    if (!taxSheet || !dirSheet || dirSheet.getLastRow() < 2) return out;

    const allowed = new Set();
    if (taxSheet.getLastRow() >= 2) {
      taxSheet.getRange(2, 9, taxSheet.getLastRow() - 1, 3).getValues().forEach(r => {
        if (String(r[2] || '').trim().toUpperCase() === 'YES' && String(r[1] || '').trim()) {
          allowed.add(String(r[1]).trim());
        }
      });
    }
    const dir = dirSheet.getRange(2, 1, dirSheet.getLastRow() - 1, 12).getValues();
    dir.forEach(r => {
      const cid = String(r[0] || '').trim();
      if (!cid) return;
      const cand = [r[8], r[9], r[10], r[11]].map(x => String(x || '').trim()).filter(x => x && allowed.has(x));
      if (cand.length > 0) out[cid] = cand;
    });
  } catch (e) {
    Logger.log('fetchCoreCrmLabelsByCid_ skipped: ' + e.message);
  }
  return out;
}

function personToMasterMap_(p, resToName) {
  const m = {};
  m['Contact ID'] = p.resourceName || '';
  m['Contact_ETag'] = p.etag || '';

  const n = (p.names && p.names[0]) || {};
  m['First Name'] = n.givenName || '';
  m['Middle Name'] = n.middleName || '';
  m['Last Name'] = n.familyName || '';
  m['Phonetic First Name'] = n.phoneticGivenName || '';
  m['Phonetic Middle Name'] = n.phoneticMiddleName || '';
  m['Phonetic Last Name'] = n.phoneticFamilyName || '';
  m['Name Prefix'] = n.honorificPrefix || '';
  m['Name Suffix'] = n.honorificSuffix || '';

  m['Nickname'] = (p.nicknames && p.nicknames[0] && p.nicknames[0].value) || '';
  m['File As'] = (p.fileAses && p.fileAses[0] && p.fileAses[0].value) || '';
  m['Gender'] = (p.genders && p.genders[0] && (p.genders[0].formattedValue || p.genders[0].value)) || '';

  const b = (p.birthdays && p.birthdays[0] && p.birthdays[0].date) || null;
  m['Birthday'] = b ? formatPeopleDate_(b) : '';

  const org = (p.organizations && p.organizations[0]) || {};
  m['Organization Name'] = org.name || '';
  m['Organization Title'] = org.title || '';
  m['Organization Department'] = org.department || '';

  for (let i = 0; i < 4; i++) {
    const ph = (p.phoneNumbers && p.phoneNumbers[i]) || {};
    m['Phone ' + (i + 1) + ' - Label'] = ph.formattedType || ph.type || '';
    m['Phone ' + (i + 1) + ' - Value'] = ph.value || '';
  }
  for (let i = 0; i < 4; i++) {
    const em = (p.emailAddresses && p.emailAddresses[i]) || {};
    m['E-mail ' + (i + 1) + ' - Label'] = em.formattedType || em.type || '';
    m['E-mail ' + (i + 1) + ' - Value'] = em.value || '';
  }
  for (let i = 0; i < 2; i++) {
    const im = (p.imClients && p.imClients[i]) || {};
    m['IM ' + (i + 1) + ' - Protocol'] = im.formattedProtocol || im.protocol || '';
    m['IM ' + (i + 1) + ' - Handle'] = im.username || '';
  }
  for (let i = 0; i < 2; i++) {
    const ad = (p.addresses && p.addresses[i]) || {};
    const pfx = 'Address ' + (i + 1) + ' - ';
    m[pfx + 'Label'] = ad.formattedType || ad.type || '';
    m[pfx + 'Formatted'] = ad.formattedValue || '';
    m[pfx + 'Street'] = ad.streetAddress || '';
    m[pfx + 'City'] = ad.city || '';
    m[pfx + 'PO Box'] = ad.poBox || '';
    m[pfx + 'Region'] = ad.region || '';
    m[pfx + 'Postal Code'] = ad.postalCode || '';
    m[pfx + 'Country'] = ad.country || '';
    m[pfx + 'Extended Address'] = ad.extendedAddress || '';
  }
  for (let i = 0; i < 3; i++) {
    const rl = (p.relations && p.relations[i]) || {};
    m['Relation ' + (i + 1) + ' - Label'] = rl.formattedType || rl.type || '';
    m['Relation ' + (i + 1) + ' - Value'] = rl.person || '';
  }
  for (let i = 0; i < 5; i++) {
    const u = (p.urls && p.urls[i]) || {};
    m['Website ' + (i + 1) + ' - Label'] = u.formattedType || u.type || '';
    m['Website ' + (i + 1) + ' - Value'] = u.value || '';
  }
  for (let i = 0; i < 2; i++) {
    const ev = (p.events && p.events[i]) || {};
    m['Event ' + (i + 1) + ' - Label'] = ev.formattedType || ev.type || '';
    m['Event ' + (i + 1) + ' - Value'] = ev.date ? formatPeopleDate_(ev.date) : '';
  }
  for (let i = 0; i < 2; i++) {
    const ud = (p.userDefined && p.userDefined[i]) || {};
    m['Custom Field ' + (i + 1) + ' - Key'] = ud.key || '';
    m['Custom Field ' + (i + 1) + ' - Value'] = ud.value || '';
  }

  m['Notes'] = (p.biographies && p.biographies[0] && p.biographies[0].value) || '';
  const labels = [];
  (p.memberships || []).forEach(mb => {
    const rn = mb.contactGroupMembership && mb.contactGroupMembership.contactGroupResourceName;
    if (rn && resToName[rn] && rn !== 'contactGroups/myContacts') {
      labels.push(resToName[rn]);
    }
  });
  m['Labels'] = labels.join(', ');
  return m;
}

function masterRowToPersonPayload_(row, col, nameToRes) {
  const g = k => (col[k] !== undefined ? String(row[col[k]] || '').trim() : '');
  const payload = { etag: g('Contact_ETag') };

  payload.names = [{
    givenName: g('First Name'),
    middleName: g('Middle Name'),
    familyName: g('Last Name'),
    phoneticGivenName: g('Phonetic First Name'),
    phoneticMiddleName: g('Phonetic Middle Name'),
    phoneticFamilyName: g('Phonetic Last Name'),
    honorificPrefix: g('Name Prefix'),
    honorificSuffix: g('Name Suffix')
  }];

  payload.nicknames = g('Nickname') ? [{ value: g('Nickname') }] : [];
  payload.fileAses = g('File As') ? [{ value: g('File As') }] : [];
  payload.genders = g('Gender') ? [{ value: g('Gender') }] : [];

  // Master_Birthday <-> Birthday_Sync governance!
  const bdaySync = g('Birthday_Sync');
  const activeBday = bdaySync === 'SHEET_ONLY_HIDDEN' ? '' : (g('Birthday') || g('Master_Birthday'));
  const parsedBday = parseDateToPeopleObj_(activeBday);
  payload.birthdays = parsedBday ? [{ date: parsedBday }] : [];

  payload.organizations = (g('Organization Name') || g('Organization Title') || g('Organization Department'))
    ? [{ name: g('Organization Name'), title: g('Organization Title'), department: g('Organization Department') }]
    : [];

  payload.phoneNumbers = [];
  for (let i = 1; i <= 4; i++) {
    if (g('Phone ' + i + ' - Value')) {
      payload.phoneNumbers.push({ type: g('Phone ' + i + ' - Label') || 'mobile', value: g('Phone ' + i + ' - Value') });
    }
  }
  payload.emailAddresses = [];
  for (let i = 1; i <= 4; i++) {
    if (g('E-mail ' + i + ' - Value')) {
      payload.emailAddresses.push({ type: g('E-mail ' + i + ' - Label') || 'home', value: g('E-mail ' + i + ' - Value') });
    }
  }
  payload.imClients = [];
  for (let i = 1; i <= 2; i++) {
    if (g('IM ' + i + ' - Handle')) {
      payload.imClients.push({ protocol: g('IM ' + i + ' - Protocol') || 'other', username: g('IM ' + i + ' - Handle') });
    }
  }
  payload.addresses = [];
  for (let i = 1; i <= 2; i++) {
    const pfx = 'Address ' + i + ' - ';
    if (g(pfx + 'Street') || g(pfx + 'City') || g(pfx + 'Country') || g(pfx + 'Formatted')) {
      payload.addresses.push({
        type: g(pfx + 'Label') || 'home',
        streetAddress: g(pfx + 'Street'),
        city: g(pfx + 'City'),
        poBox: g(pfx + 'PO Box'),
        region: g(pfx + 'Region'),
        postalCode: g(pfx + 'Postal Code'),
        country: g(pfx + 'Country'),
        extendedAddress: g(pfx + 'Extended Address')
      });
    }
  }
  payload.relations = [];
  for (let i = 1; i <= 3; i++) {
    if (g('Relation ' + i + ' - Value')) {
      payload.relations.push({ type: g('Relation ' + i + ' - Label') || 'friend', person: g('Relation ' + i + ' - Value') });
    }
  }
  payload.urls = [];
  for (let i = 1; i <= 5; i++) {
    if (g('Website ' + i + ' - Value')) {
      payload.urls.push({ type: g('Website ' + i + ' - Label') || 'other', value: g('Website ' + i + ' - Value') });
    }
  }
  payload.events = [];
  for (let i = 1; i <= 2; i++) {
    const dObj = parseDateToPeopleObj_(g('Event ' + i + ' - Value'));
    if (dObj) {
      payload.events.push({ type: g('Event ' + i + ' - Label') || 'other', date: dObj });
    }
  }
  payload.userDefined = [];
  for (let i = 1; i <= 2; i++) {
    if (g('Custom Field ' + i + ' - Key') || g('Custom Field ' + i + ' - Value')) {
      payload.userDefined.push({ key: g('Custom Field ' + i + ' - Key'), value: g('Custom Field ' + i + ' - Value') });
    }
  }
  payload.biographies = g('Notes') ? [{ value: g('Notes'), contentType: 'TEXT_PLAIN' }] : [];

  const memberships = [{ contactGroupMembership: { contactGroupResourceName: 'contactGroups/myContacts' } }];
  g('Labels').split(',').map(s => s.trim()).filter(Boolean).forEach(lbl => {
    const rn = nameToRes[lbl.toLowerCase()];
    if (rn && rn !== 'contactGroups/myContacts') {
      memberships.push({ contactGroupMembership: { contactGroupResourceName: rn } });
    }
  });
  payload.memberships = memberships;
  return payload;
}

function formatPeopleDate_(d) {
  if (!d) return '';
  const mm = String(d.month || 1).padStart(2, '0');
  const dd = String(d.day || 1).padStart(2, '0');
  return d.year ? (d.year + '-' + mm + '-' + dd) : ('--' + mm + '-' + dd);
}

function parseDateToPeopleObj_(val) {
  if (!val) return null;
  const s = String(val).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  m = s.match(/^--(\d{1,2})-(\d{1,2})$/);
  if (m) return { month: Number(m[1]), day: Number(m[2]) };
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
  }
  return null;
}

function computeRowHash_(row, headers) {
  const skip = new Set(['Last Updated Sheet', 'Last Updated Google Contacts', 'Contact_ETag', 'Sync_Direction_Lock', 'Sync_Hash']);
  const parts = [];
  for (let i = 0; i < headers.length; i++) {
    if (!skip.has(headers[i])) parts.push(String(row[i] || '').trim());
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, parts.join('|'));
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').slice(0, 12);
}

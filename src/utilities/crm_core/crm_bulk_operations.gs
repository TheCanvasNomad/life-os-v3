/**
 * ============================================================================
 * LIFEOS v3.2 — ⚡ BULK_OPERATIONS BATCH COMMAND CONSOLE (Law 2 Modular Module)
 * Bound inside: 📇 Core_CRM (1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M)
 *
 * Menu: ⚡ LifeOS CRM
 *  - ⚡ Execute Batch Action on Filtered Cohort
 *  - 🗑️ Quick Purge All Email-Only Contacts to Vault
 *  - 🔗 Run Bidirectional Body Count 2.0 <-> Core_CRM <-> Master Sync
 *  - 📓 Refresh NotebookLM_Social_Workbook
 *
 * Supports all 10 Batch_Action_Type operations with exact-count confirmation:
 *  ADD_SOCIAL_TAG | REMOVE_SOCIAL_TAG | SET_SPHERE | SET_STATUS | SET_HOW_MET |
 *  SET_COUNTRY | SET_ORGANIZATION | SET_BIRTHDAY_SYNC | PURGE_TO_VAULT | UNSYNC_PHONE_ONLY
 *
 * SETUP: Extensions -> Apps Script -> Services (+) -> Enable "Google People API" (v1).
 * ============================================================================
 */

const BULK_CFG = {
  CORE_CRM_SS_ID: '1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M',
  MASTER_SS_ID: '1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g',
  VAULT_SS_ID: '1eoLRVMOxdpHx3YkkWnfkOfowhTH8fbam8R2jDzUJB84',
  BULK_TAB: '⚡ BULK_OPERATIONS',
  DIR_TAB: 'CONTACT_DIRECTORY',
  MASTER_TAB: 'Google Contacts Sync Master',
  VAULT_TAB: 'PURGED_LEDGER',
  MAX_PHONE_DELETES_PER_RUN: 200,
  API_PACE_MS: 160
};

/**
 * Adds the ⚡ LifeOS CRM command menu when opening 📇 Core_CRM.
 */
function onOpenCoreCRM() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ LifeOS CRM')
    .addItem('⚡ Execute Batch Action on Filtered Cohort', 'executeBulkCohortAction')
    .addItem('🗑️ Quick Purge All Email-Only Contacts to Vault', 'quickPurgeEmailOnlyToVault')
    .addSeparator()
    .addItem('🔗 Run Full Cross-Brick Symbiosis Sync', 'runFullSymbiosisOrchestrator')
    .addItem('📓 Refresh NotebookLM_Social_Workbook', 'syncCoreCRMToNotebookLM')
    .addToUi();
}

/**
 * Alias onOpen when bound standalone inside 📇 Core_CRM.
 */
function onOpen() {
  onOpenCoreCRM();
}

/**
 * One-click shortcut: configures ⚡ BULK_OPERATIONS to Channel = EMAIL_ONLY
 * and executes confirmed archive-first PURGE_TO_VAULT.
 */
function quickPurgeEmailOnlyToVault() {
  const ss = SpreadsheetApp.openById(BULK_CFG.CORE_CRM_SS_ID);
  const bulk = ss.getSheetByName(BULK_CFG.BULK_TAB);
  if (!bulk) return;

  // Set all 14 filters to EMAIL_ONLY across all cohorts
  bulk.getRange('A4').setValue('EMAIL_ONLY');
  bulk.getRange('B4:M4').setValues([['ALL', 'ALL', 'ALL', 'ALL', 'ALL', 'ALL', 'ALL', 'ALL', 'ALL', 'ALL', 'ALL', 'ALL']]);
  bulk.getRange('N4').setValue('');
  bulk.getRange('A9').setValue('PURGE_TO_VAULT');
  bulk.getRange('E9').setValue('');
  SpreadsheetApp.flush();

  executeBulkCohortAction();
}

/**
 * Executes the selected Batch_Action_Type (A9) + Batch_Target_Value (E9)
 * across every Contact ID currently matched in ⚡ BULK_OPERATIONS!A12:A.
 */
function executeBulkCohortAction() {
  const ui = SpreadsheetApp.getUi();
  const crmSs = SpreadsheetApp.openById(BULK_CFG.CORE_CRM_SS_ID);
  const bulk = crmSs.getSheetByName(BULK_CFG.BULK_TAB);
  const dir = crmSs.getSheetByName(BULK_CFG.DIR_TAB);
  if (!bulk || !dir) return;

  const action = String(bulk.getRange('A9').getValue() || '').trim();
  const targetVal = String(bulk.getRange('E9').getValue() || '').trim();
  if (!action) {
    ui.alert('Please select a Batch_Action_Type in cell A9 first.');
    return;
  }

  const requiresTarget = [
    'ADD_SOCIAL_TAG', 'REMOVE_SOCIAL_TAG', 'SET_SPHERE', 'SET_STATUS',
    'SET_HOW_MET', 'SET_COUNTRY', 'SET_ORGANIZATION', 'SET_BIRTHDAY_SYNC',
    'SET_COHORT_CHAPTER', 'SET_ORIGIN_ARENA', 'SET_PROXIMITY_RING',
    'SET_KINSHIP_ROLE', 'ADD_SHARED_INTEREST', 'SET_CITY_BASE'
  ];
  if (requiresTarget.indexOf(action) !== -1 && !targetVal) {
    ui.alert('Action [' + action + '] requires a Batch_Target_Value in cell E9.');
    return;
  }

  // Read live filtered Contact IDs from A12:A
  const lastRow = bulk.getLastRow();
  if (lastRow < 12) {
    ui.alert('No contacts match the current filters.');
    return;
  }
  const rawIds = bulk.getRange(12, 1, lastRow - 11, 1).getValues()
    .map(r => String(r[0] || '').trim())
    .filter(v => v && v !== 'No contacts match current filters');

  if (rawIds.length === 0) {
    ui.alert('No contacts match the current filters.');
    return;
  }

  const isDestructive = (action === 'PURGE_TO_VAULT' || action === 'UNSYNC_PHONE_ONLY');
  const capNote = isDestructive
    ? '\n\nSafety Cap: Max ' + BULK_CFG.MAX_PHONE_DELETES_PER_RUN + ' People API deletes per run. Every PURGE_TO_VAULT row is archived to Purged_Contacts_Vault FIRST.'
    : '\n\nUpdates will write to CONTACT_DIRECTORY and sync back to Master_Contacts_Sync.';

  const resp = ui.alert(
    'Confirm ⚡ Batch Action (' + rawIds.length + ' Matched Contacts)',
    'Action: ' + action + (targetVal ? '\nTarget Value: ' + targetVal : '') +
    '\nMatched Cohort Size: ' + rawIds.length + ' contacts' + capNote + '\n\nProceed?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  const targetSet = new Set(rawIds);

  // Route Vault / Unsync actions directly through archive-first handler
  if (isDestructive) {
    const countDone = executeBulkVaultAction_(targetSet, action, crmSs, dir);
    ui.alert('Batch ' + action + ' complete.\nProcessed: ' + countDone + ' contacts (remaining contacts, if >200, stay queued for next run).');
    return;
  }

  // Apply CRM & Human-Lifecycle attribute updates in CONTACT_DIRECTORY:
  // Block 1: Cols C..P (1-idx 3..16) | Block 2: Cols V..AD (1-idx 22..30) — never touching formula cols B, Q, S, T, U!
  const dirLastRow = dir.getLastRow();
  const dirIds = dir.getRange(2, 1, dirLastRow - 1, 1).getValues().map(r => String(r[0] || '').trim());
  const dirValsCP = dir.getRange(2, 3, dirLastRow - 1, 14).getValues();
  const dirValsVAD = dir.getRange(2, 22, dirLastRow - 1, 9).getValues(); // V(0)=Cohort, W(1)=Arena, X(2)=Ring, Y(3)=Kinship, Z(4)=Int1, AA(5)=Int2, AB(6)=IntroBy, AC(7)=City, AD(8)=Notes

  let updatedCount = 0;
  const masterWritebacks = {}; // cid -> {country?, org?, bdaySync?, city?}

  for (let i = 0; i < dirIds.length; i++) {
    const cid = dirIds[i];
    if (!targetSet.has(cid)) continue;
    const row = dirValsCP[i];
    const life = dirValsVAD[i];

    switch (action) {
      case 'ADD_SOCIAL_TAG': {
        const cur = [row[7], row[8], row[9]].map(s => String(s || '').trim());
        if (cur.indexOf(targetVal) === -1) {
          const emptyIdx = cur.indexOf('');
          if (emptyIdx !== -1) cur[emptyIdx] = targetVal;
          else cur[2] = targetVal;
          row[7] = cur[0]; row[8] = cur[1]; row[9] = cur[2];
        }
        break;
      }
      case 'REMOVE_SOCIAL_TAG': {
        const kept = [row[7], row[8], row[9]]
          .map(s => String(s || '').trim())
          .filter(s => s && s.toLowerCase() !== targetVal.toLowerCase());
        row[7] = kept[0] || ''; row[8] = kept[1] || ''; row[9] = kept[2] || '';
        break;
      }
      case 'SET_SPHERE': row[6] = targetVal; break;
      case 'SET_STATUS': row[10] = targetVal; break;
      case 'SET_HOW_MET': row[11] = targetVal; break;
      case 'SET_COUNTRY':
        row[3] = targetVal;
        masterWritebacks[cid] = Object.assign(masterWritebacks[cid] || {}, { country: targetVal });
        break;
      case 'SET_ORGANIZATION':
        row[4] = targetVal;
        masterWritebacks[cid] = Object.assign(masterWritebacks[cid] || {}, { org: targetVal });
        break;
      case 'SET_BIRTHDAY_SYNC':
        row[13] = targetVal;
        masterWritebacks[cid] = Object.assign(masterWritebacks[cid] || {}, { bdaySync: targetVal });
        break;
      case 'SET_COHORT_CHAPTER': life[0] = targetVal; break;
      case 'SET_ORIGIN_ARENA': life[1] = targetVal; break;
      case 'SET_PROXIMITY_RING': life[2] = targetVal; break;
      case 'SET_KINSHIP_ROLE': life[3] = targetVal; break;
      case 'ADD_SHARED_INTEREST': {
        const curI = [life[4], life[5]].map(s => String(s || '').trim());
        if (curI.indexOf(targetVal) === -1) {
          if (!curI[0]) life[4] = targetVal;
          else life[5] = targetVal;
        }
        break;
      }
      case 'SET_CITY_BASE':
        life[7] = targetVal;
        masterWritebacks[cid] = Object.assign(masterWritebacks[cid] || {}, { city: targetVal });
        break;
    }
    dirValsCP[i] = row;
    dirValsVAD[i] = life;
    updatedCount++;
  }

  if (updatedCount > 0) {
    dir.getRange(2, 4, dirValsCP.length, 1).setNumberFormat('@');
    dir.getRange(2, 3, dirValsCP.length, 14).setValues(dirValsCP);
    dir.getRange(2, 22, dirValsVAD.length, 9).setValues(dirValsVAD);
  }

  // Propagate Country / City / Organization / Birthday_Sync back to 📱 Master_Contacts_Sync
  const wbCids = Object.keys(masterWritebacks);
  if (wbCids.length > 0) {
    const mSs = SpreadsheetApp.openById(BULK_CFG.MASTER_SS_ID);
    const mSheet = mSs.getSheetByName(BULK_CFG.MASTER_TAB);
    const mData = mSheet.getDataRange().getValues();
    const mCol = {};
    mData[0].forEach((h, idx) => { mCol[String(h || '').trim()] = idx; });

    for (let r = 1; r < mData.length; r++) {
      const cid = String(mData[r][mCol['Contact ID']] || '').trim();
      const wb = masterWritebacks[cid];
      if (!wb) continue;
      if (wb.country !== undefined) mSheet.getRange(r + 1, mCol['Address 1 - Country'] + 1).setValue(wb.country);
      if (wb.city !== undefined) mSheet.getRange(r + 1, mCol['Address 1 - City'] + 1).setValue(wb.city);
      if (wb.org !== undefined) mSheet.getRange(r + 1, mCol['Organization Name'] + 1).setValue(wb.org);
      if (wb.bdaySync !== undefined) {
        mSheet.getRange(r + 1, mCol['Birthday_Sync'] + 1).setValue(wb.bdaySync);
        if (wb.bdaySync === 'SHEET_ONLY_HIDDEN') {
          mSheet.getRange(r + 1, mCol['Birthday'] + 1).setValue('');
        } else if (wb.bdaySync === 'ON_PHONE_&_CALENDAR') {
          const mb = mData[r][mCol['Master_Birthday']];
          if (mb) mSheet.getRange(r + 1, mCol['Birthday'] + 1).setValue(mb);
        }
      }
    }
  }

  ui.alert('⚡ Batch Action [' + action + '] applied cleanly to ' + updatedCount + ' contacts.\nRun "Push Sheet Edits to Phone" in Master_Contacts_Sync to sync changes & Labels to your Pixel.');
}

/**
 * Archive-first handler for PURGE_TO_VAULT and UNSYNC_PHONE_ONLY from ⚡ BULK_OPERATIONS.
 */
function executeBulkVaultAction_(targetSet, action, crmSs, dirSheet) {
  const mSs = SpreadsheetApp.openById(BULK_CFG.MASTER_SS_ID);
  const mSheet = mSs.getSheetByName(BULK_CFG.MASTER_TAB);
  const vSs = SpreadsheetApp.openById(BULK_CFG.VAULT_SS_ID);
  const vSheet = vSs.getSheetByName(BULK_CFG.VAULT_TAB);

  const mData = mSheet.getDataRange().getValues();
  const mCol = {};
  mData[0].forEach((h, idx) => { mCol[String(h || '').trim()] = idx; });

  const nowIso = new Date().toISOString();
  const masterRowsToDelete = [];
  const purgedCids = new Set();
  let processed = 0;

  for (let r = 1; r < mData.length && processed < BULK_CFG.MAX_PHONE_DELETES_PER_RUN; r++) {
    const row = mData[r];
    const cid = String(row[mCol['Contact ID']] || '').trim();
    if (!targetSet.has(cid)) continue;

    if (action === 'PURGE_TO_VAULT') {
      const hasPhone = [mCol['Phone 1 - Value'], mCol['Phone 2 - Value'], mCol['Phone 3 - Value'], mCol['Phone 4 - Value']]
        .some(ci => ci !== undefined && String(row[ci] || '').trim() !== '');
      const reason = hasPhone ? 'Bulk Console Purge' : 'Bulk Email-Only Purge';

      // Step 1: Archive full row to Purged_Contacts_Vault FIRST
      vSheet.appendRow(row.concat([nowIso, reason, 'ARCHIVED']));

      // Step 2: Delete from Google Contacts via People API v1
      let deletedOk = false;
      if (cid.startsWith('people/')) {
        try {
          People.People.deleteContact(cid);
          deletedOk = true;
        } catch (e) {
          if (String(e.message).indexOf('404') !== -1 || String(e.message).indexOf('NOT_FOUND') !== -1) {
            deletedOk = true;
          } else {
            Logger.log('People delete failed for ' + cid + ': ' + e.message);
          }
        }
        Utilities.sleep(BULK_CFG.API_PACE_MS);
      } else {
        deletedOk = true;
      }

      if (deletedOk) {
        masterRowsToDelete.push(r + 1);
        purgedCids.add(cid);
        processed++;
      }
    } else if (action === 'UNSYNC_PHONE_ONLY') {
      if (cid.startsWith('people/')) {
        try {
          People.People.deleteContact(cid);
          mSheet.getRange(r + 1, mCol['Sync_Action'] + 1).setValue('UNSYNC_PHONE_ONLY');
          mSheet.getRange(r + 1, mCol['Contact_ETag'] + 1).setValue('');
          processed++;
          Utilities.sleep(BULK_CFG.API_PACE_MS);
        } catch (e) {
          Logger.log('UNSYNC_PHONE_ONLY failed for ' + cid + ': ' + e.message);
        }
      }
    }
  }

  // Remove purged rows from Master_Contacts_Sync & CONTACT_DIRECTORY bottom-up
  masterRowsToDelete.sort((a, b) => b - a).forEach(r1 => mSheet.deleteRow(r1));
  if (purgedCids.size > 0) {
    const dirIds = dirSheet.getRange(2, 1, Math.max(1, dirSheet.getLastRow() - 1), 1).getValues().map(r => String(r[0] || '').trim());
    const dirDel = [];
    dirIds.forEach((cid, i) => { if (purgedCids.has(cid)) dirDel.push(i + 2); });
    dirDel.sort((a, b) => b - a).forEach(r1 => dirSheet.deleteRow(r1));
  }
  return processed;
}

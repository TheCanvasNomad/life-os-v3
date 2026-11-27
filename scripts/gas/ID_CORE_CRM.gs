/**
 * ============================================================================
 * LifeOS v3.0 — 📇 Core_CRM (ID_CORE_CRM)
 * Production Apps Script: Calendar Follow-Up Scheduler + Bulk Ops + Symbiosis
 * ============================================================================
 * Spreadsheet ID : 1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M
 * Bundled From   :
 *   - src/utilities/crm_core/crm_scheduler.gs
 *   - src/utilities/crm_core/crm_bulk_operations.gs
 *   - src/utilities/crm_core/crm_symbiosis_engine.gs
 *
 * REQUIRED ADVANCED SERVICE: Enable Google People API in Apps Script -> Services.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

// --- BEGIN SOURCE: src/utilities/crm_core/crm_scheduler.gs ---
/**
 * ============================================================================
 * LIFEOS-v3 // PHASE 5 TEMPORAL BRIDGE — CORE CRM FOLLOW-UP & INTERACTION SYNC
 * File: src/utilities/crm_core/crm_scheduler.gs (Bound to: 📇 Core_CRM)
 * ============================================================================
 * Two-way temporal bridge between `📇 Core_CRM` and the dedicated `Life OS`
 * secondary calendar:
 *
 *  1. `scheduleFollowUp()`:
 *     - Scans `CONTACT_DIRECTORY` (Cols Q=17 Last_Contacted_Date,
 *       R=18 Next_Follow_Up_Date, S=19 Follow_Up_Status) AND `INTERACTION_LOG`
 *       (Cols C=3 Contact_Key, G=7 Next_Follow_Up_Date, H=8 Calendar_Event_ID).
 *     - Creates an idempotent all-day event titled `Follow up with <Display Name>`
 *       on the `Life OS` calendar, stamps `Follow_Up_Status` -> `Scheduled`,
 *       and writes `event.getId()` back into `INTERACTION_LOG!H`.
 *
 *  2. `logInteraction()`:
 *     - Scans `Life OS` calendar for concluded `Follow up with <Display Name>`
 *       events within the last 48h AND newly logged rows in `INTERACTION_LOG`.
 *     - Records `Interaction Logged: <Display Name>` in `INTERACTION_LOG`
 *       (deduplicated by `Calendar_Event_ID`), updates `Last_Contacted_Date`
 *       in `CONTACT_DIRECTORY`, and updates `Follow_Up_Status` -> `Completed`.
 *     - Feeds `💞 Pillar_3_Relationships` cleanly so contacts exceeding 90 days
 *       without contact trigger the quantifiable `Connection Decay` modifier.
 *
 * Strictly zero contact PII logged to Logger; guarded by `LockService`.
 * ============================================================================
 */

const CRM_SCHED_CFG = Object.freeze({
  CORE_CRM_ID: '1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M',
  HUB_ID: '1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U',
  CALENDAR_NAME: 'Life OS',
  TIMEZONE: 'America/New_York',
  LOCK_TIMEOUT_MS: 30000,
  OUTBOUND_MARKER: '[LifeOS_OUTBOUND_PUSH]',
  CRM_TAG: '[LifeOS_CRM_FOLLOWUP]',
  DECAY_DAYS: 90,
  TABS: {
    DIRECTORY: 'CONTACT_DIRECTORY',
    INTERACTIONS: 'INTERACTION_LOG',
  },
});

/**
 * Adds Core_CRM Temporal Bridge menu controls on open.
 */
function onOpenCrmSchedLegacy_() {
  SpreadsheetApp.getUi()
    .createMenu('📅 CRM Temporal Bridge')
    .addItem('⬆️ Schedule Pending Follow-Ups → Life OS Calendar', 'scheduleFollowUp')
    .addItem('⬇️ Log Concluded Follow-Ups & Refresh Last Contacted', 'logInteraction')
    .addSeparator()
    .addItem('🔄 Run Full CRM Calendar Sync', 'syncCrmCalendarTwoWay')
    .addItem('⏰ Install Hourly CRM Temporal Trigger', 'installCrmSchedulerTrigger')
    .addToUi();
}

/**
 * Runs both `scheduleFollowUp()` and `logInteraction()` cleanly in one pass.
 */
function syncCrmCalendarTwoWay() {
  const scheduled = scheduleFollowUp();
  const logged = logInteraction();
  try {
    SpreadsheetApp.getUi().alert(
      '📅 Core_CRM Temporal Bridge Complete',
      `Follow-Ups Scheduled: ${scheduled}\nInteractions Logged / Synced: ${logged}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (_) {}
  return { scheduled, logged };
}

/**
 * Scans `CONTACT_DIRECTORY` and `INTERACTION_LOG` for pending/blank follow-ups,
 * creates `Follow up with <Display Name>` on the `Life OS` calendar, updates
 * `Follow_Up_Status` -> `Scheduled`, and writes `Calendar_Event_ID`.
 * @returns {number}
 */
function scheduleFollowUp() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CRM_SCHED_CFG.LOCK_TIMEOUT_MS)) {
    Logger.log('CRM_SCHED_SKIP: Lock busy.');
    return 0;
  }

  try {
    const ss = SpreadsheetApp.openById(CRM_SCHED_CFG.CORE_CRM_ID);
    const dirSheet = ss.getSheetByName(CRM_SCHED_CFG.TABS.DIRECTORY);
    const intSheet = ss.getSheetByName(CRM_SCHED_CFG.TABS.INTERACTIONS);
    const cal = resolveLifeOSCalendarForCrm_();
    let scheduledCount = 0;

    // 1. Scan CONTACT_DIRECTORY (Col A=Contact_ID, B=Contact_Key, C=Full_Name, I=Sphere, R=Next_Follow_Up_Date, S=Follow_Up_Status)
    if (dirSheet && dirSheet.getLastRow() >= 2) {
      const rows = dirSheet.getRange(2, 1, dirSheet.getLastRow() - 1, 19).getValues();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const nextRaw = r[17]; // Col R (18)
        const status = String(r[18] || '').trim().toLowerCase(); // Col S (19)
        if (!nextRaw) continue;
        if (status !== '' && status !== 'pending' && status !== 'due') continue;

        const followDate = nextRaw instanceof Date ? nextRaw : new Date(nextRaw);
        if (isNaN(followDate.getTime())) continue;

        const contactId = String(r[0] || '').trim();
        const contactKey = String(r[1] || '').trim();
        const displayName = String(r[2] || '').trim() || contactKey.split('•')[0].trim() || 'Contact';
        const sphere = String(r[8] || 'Network').trim();

        const title = `Follow up with ${displayName}`;
        const desc = [
          CRM_SCHED_CFG.OUTBOUND_MARKER,
          CRM_SCHED_CFG.CRM_TAG,
          `Contact_ID: ${contactId}`,
          `Contact_Key: ${contactKey}`,
          `Sphere: ${sphere}`,
        ].join('\n');

        const existing = findExistingFollowUpEvent_(cal, followDate, contactId, title);
        if (!existing) {
          cal.createAllDayEvent(title, followDate, { description: desc });
        }
        dirSheet.getRange(i + 2, 19).setValue('Scheduled');
        scheduledCount++;
      }
    }

    // 2. Scan INTERACTION_LOG (Col C=Contact_Key, F=Summary, G=Next_Follow_Up_Date, H=Calendar_Event_ID)
    if (intSheet && intSheet.getLastRow() >= 2) {
      const iRows = intSheet.getRange(2, 1, intSheet.getLastRow() - 1, 8).getValues();
      for (let i = 0; i < iRows.length; i++) {
        const r = iRows[i];
        const contactKey = String(r[2] || '').trim();
        const nextRaw = r[6]; // Col G (7)
        const existingCalId = String(r[7] || '').trim(); // Col H (8)
        if (!contactKey || !nextRaw || existingCalId) continue;

        const followDate = nextRaw instanceof Date ? nextRaw : new Date(nextRaw);
        if (isNaN(followDate.getTime())) continue;

        const displayName = contactKey.split('•')[0].trim() || contactKey;
        const title = `Follow up with ${displayName}`;
        const desc = [
          CRM_SCHED_CFG.OUTBOUND_MARKER,
          CRM_SCHED_CFG.CRM_TAG,
          `Contact_Key: ${contactKey}`,
          r[5] ? `Context: ${r[5]}` : '',
        ].filter(Boolean).join('\n');

        let ev = findExistingFollowUpEvent_(cal, followDate, contactKey, title);
        if (!ev) {
          ev = cal.createAllDayEvent(title, followDate, { description: desc });
        }
        intSheet.getRange(i + 2, 8).setValue(ev.getId());
        scheduledCount++;
      }
    }

    if (scheduledCount > 0) SpreadsheetApp.flush();
    Logger.log(`CRM_SCHED_OK: scheduled=${scheduledCount}`);
    return scheduledCount;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Syncs newly logged interactions in `INTERACTION_LOG` AND concluded
 * `Follow up with <Display Name>` events from the `Life OS` calendar back to
 * `CONTACT_DIRECTORY.Last_Contacted_Date` (Col Q) so Pillar 3's 90-day
 * `Connection Decay` calculation stays strictly accurate.
 * @returns {number}
 */
function logInteraction() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CRM_SCHED_CFG.LOCK_TIMEOUT_MS)) {
    Logger.log('CRM_LOG_SKIP: Lock busy.');
    return 0;
  }

  try {
    const ss = SpreadsheetApp.openById(CRM_SCHED_CFG.CORE_CRM_ID);
    const dirSheet = ss.getSheetByName(CRM_SCHED_CFG.TABS.DIRECTORY);
    const intSheet = ss.getSheetByName(CRM_SCHED_CFG.TABS.INTERACTIONS);
    if (!dirSheet || !intSheet) return 0;

    // Build lookup maps on CONTACT_DIRECTORY (zero PII logged)
    const dirLastRow = dirSheet.getLastRow();
    const dirValues = dirLastRow >= 2 ? dirSheet.getRange(2, 1, dirLastRow - 1, 19).getValues() : [];
    const keyToRow = new Map();
    const nameToRow = new Map();
    const idToRow = new Map();

    dirValues.forEach((r, idx) => {
      const rowNum = idx + 2;
      const cid = String(r[0] || '').trim();
      const ckey = String(r[1] || '').trim().toLowerCase();
      const cname = String(r[2] || '').trim().toLowerCase();
      if (cid) idToRow.set(cid, rowNum);
      if (ckey) keyToRow.set(ckey, rowNum);
      if (cname && !nameToRow.has(cname)) nameToRow.set(cname, rowNum);
    });

    // Collect already logged Calendar_Event_IDs in INTERACTION_LOG
    const intLastRow = intSheet.getLastRow();
    const intValues = intLastRow >= 2 ? intSheet.getRange(2, 1, intLastRow - 1, 8).getValues() : [];
    const loggedCalIds = new Set();
    const latestContactDateByRow = new Map();

    intValues.forEach(r => {
      const calId = String(r[7] || '').trim();
      if (calId) loggedCalIds.add(calId);

      const ckey = String(r[2] || '').trim().toLowerCase();
      const dRaw = r[1] || r[0];
      const d = dRaw instanceof Date ? dRaw : new Date(dRaw);
      if (!ckey || isNaN(d.getTime())) return;

      const targetRow = keyToRow.get(ckey) || nameToRow.get(ckey.split('•')[0].trim());
      if (targetRow) {
        const prev = latestContactDateByRow.get(targetRow);
        if (!prev || d.getTime() > prev.getTime()) {
          latestContactDateByRow.set(targetRow, d);
        }
      }
    });

    // Check Life OS Calendar for concluded `Follow up with <Display Name>` events in last 48h
    const cal = resolveLifeOSCalendarForCrm_();
    const now = new Date();
    const lookback = new Date(now.getTime() - 48 * 3600 * 1000);
    const events = cal.getEvents(lookback, now);
    let newlyLoggedFromCal = 0;

    events.forEach(ev => {
      if (ev.getEndTime().getTime() > now.getTime()) return;
      const title = String(ev.getTitle() || '').trim();
      if (title.toLowerCase().indexOf('follow up with ') !== 0) return;

      const evId = ev.getId();
      if (loggedCalIds.has(evId)) return;

      const displayName = title.substring('Follow up with '.length).trim();
      const desc = String(ev.getDescription() || '');
      const idMatch = desc.match(/Contact_ID:\s*([^\n\r]+)/);
      const keyMatch = desc.match(/Contact_Key:\s*([^\n\r]+)/);

      const contactId = idMatch ? idMatch[1].trim() : '';
      const contactKey = keyMatch ? keyMatch[1].trim() : displayName;
      const targetRow = (contactId && idToRow.get(contactId)) ||
                        keyToRow.get(contactKey.toLowerCase()) ||
                        nameToRow.get(displayName.toLowerCase());

      const interactionDateStr = Utilities.formatDate(ev.getStartTime(), CRM_SCHED_CFG.TIMEZONE, 'yyyy-MM-dd');
      intSheet.appendRow([
        now,
        interactionDateStr,
        contactKey,
        'Calendar Follow-Up',
        'Outbound',
        `Interaction Logged: ${displayName}`,
        '',
        evId,
      ]);
      loggedCalIds.add(evId);
      newlyLoggedFromCal++;

      if (targetRow) {
        const d = ev.getStartTime();
        const prev = latestContactDateByRow.get(targetRow);
        if (!prev || d.getTime() > prev.getTime()) {
          latestContactDateByRow.set(targetRow, d);
        }
        dirSheet.getRange(targetRow, 19).setValue('Completed');
      }
    });

    // Update Last_Contacted_Date (Col Q = 17) in CONTACT_DIRECTORY wherever newer interaction exists
    let updatedDirectoryRows = 0;
    latestContactDateByRow.forEach((dateObj, rowNum) => {
      const existingRaw = dirValues[rowNum - 2] ? dirValues[rowNum - 2][16] : '';
      const existingDate = existingRaw instanceof Date ? existingRaw : (existingRaw ? new Date(existingRaw) : null);
      if (!existingDate || isNaN(existingDate.getTime()) || dateObj.getTime() > existingDate.getTime()) {
        dirSheet.getRange(rowNum, 17).setValue(
          Utilities.formatDate(dateObj, CRM_SCHED_CFG.TIMEZONE, 'yyyy-MM-dd')
        );
        updatedDirectoryRows++;
      }
    });

    if (newlyLoggedFromCal > 0 || updatedDirectoryRows > 0) SpreadsheetApp.flush();
    Logger.log(`CRM_LOG_OK: fromCalendar=${newlyLoggedFromCal}, directoryDatesUpdated=${updatedDirectoryRows}`);
    return newlyLoggedFromCal + updatedDirectoryRows;
  } finally {
    lock.releaseLock();
  }
}

function findExistingFollowUpEvent_(cal, dayDate, marker, title) {
  const events = cal.getEventsForDay(dayDate);
  return events.find(ev => {
    const desc = String(ev.getDescription() || '');
    return ev.getTitle() === title || (marker && desc.indexOf(marker) !== -1 && desc.indexOf(CRM_SCHED_CFG.CRM_TAG) !== -1);
  }) || null;
}

function resolveLifeOSCalendarForCrm_() {
  try {
    const hub = SpreadsheetApp.openById(CRM_SCHED_CFG.HUB_ID);
    const rules = hub.getSheetByName('RULES_ENGINE');
    const storedId = rules ? String(rules.getRange('B121').getValue() || '').trim() : '';
    if (storedId && storedId.indexOf('@') !== -1) {
      const byId = CalendarApp.getCalendarById(storedId);
      if (byId) return byId;
    }
  } catch (_) {}

  const matches = CalendarApp.getCalendarsByName(CRM_SCHED_CFG.CALENDAR_NAME);
  if (matches && matches.length > 0) return matches[0];
  return CalendarApp.createCalendar(CRM_SCHED_CFG.CALENDAR_NAME, {
    timeZone: CRM_SCHED_CFG.TIMEZONE,
    summary: 'LifeOS-v3 Temporal Bridge — Quests, Biometrics, CRM Follow-Ups & Event Capture',
  });
}

/**
 * Installs an hourly lock-guarded trigger for `syncCrmCalendarTwoWay()`.
 */
function installCrmSchedulerTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncCrmCalendarTwoWay') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('syncCrmCalendarTwoWay')
    .timeBased()
    .everyHours(1)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '⏰ Hourly CRM Temporal Trigger Installed',
      'syncCrmCalendarTwoWay() will now run every hour.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (_) {}
}
// --- END SOURCE: src/utilities/crm_core/crm_scheduler.gs ---

// --- BEGIN SOURCE: src/utilities/crm_core/crm_bulk_operations.gs ---
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
function onOpenCrmBulkLegacy_() {
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
// --- END SOURCE: src/utilities/crm_core/crm_bulk_operations.gs ---

// --- BEGIN SOURCE: src/utilities/crm_core/crm_symbiosis_engine.gs ---
/**
 * ============================================================================
 * LIFEOS v3.2 — SYMBIOTIC CROSS-BRICK CRM ORCHESTRATOR (Law 2 Modular Module)
 * Connects:
 *  - 📱 Master_Contacts_Sync       (1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g)
 *  - 📇 Core_CRM                   (1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M)
 *  - 📓 NotebookLM_Social_Workbook (1gwnGKdfZrtJi6QwEWniPMli6i-Se8Fi2pwjX1ebaaPs)
 *  - Body Count 2.0                (1aqYHU_bc-AqgREdvutE3VgG952_gd70yDKt4dMH6L1E)
 *  - Career & Experience Intake    (1iXxJVSv04MsRc_41p5bahCNRROXdugZ75iSivVy29GM)
 *  - 🌍 Travel_Tracker_Brick       (11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc)
 *  - 💞 Pillar_3_Relationships     (1hi-hShSgH9X8i5NpCmh_a5HfuxevrxWkFDuJmbB1D0k)
 * ============================================================================
 */

const SYMBIOSIS_CFG = {
  MASTER_SS_ID: '1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g',
  CORE_CRM_SS_ID: '1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M',
  NOTEBOOKLM_SS_ID: '1gwnGKdfZrtJi6QwEWniPMli6i-Se8Fi2pwjX1ebaaPs',
  BODY_COUNT_SS_ID: '1aqYHU_bc-AqgREdvutE3VgG952_gd70yDKt4dMH6L1E',
  CAREER_SS_ID: '1iXxJVSv04MsRc_41p5bahCNRROXdugZ75iSivVy29GM',
  TRAVEL_SS_ID: '11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc',
  PILLAR_3_SS_ID: '1hi-hShSgH9X8i5NpCmh_a5HfuxevrxWkFDuJmbB1D0k',
  LIFEOS_CALENDAR_NAME: 'Life OS'
};

/**
 * Full cross-brick symbiosis orchestrator:
 * 1. Sync Master_Contacts_Sync <-> Core_CRM (CONTACT_DIRECTORY) by immutable Contact ID
 * 2. Execute ENTITY_LINKS write-backs (Body Count 2.0 -> Status/Country/First Met; Career -> Org)
 * 3. Refresh NotebookLM_Social_Workbook (preserving Manual_Bio_&_Story_Notes!)
 * 4. Sync INTERACTION_LOG follow-up reminders to Life OS Google Calendar
 */
function runFullSymbiosisOrchestrator() {
  syncMasterAndCoreCRM();
  runEntityLinksWriteback();
  syncCoreCRMToNotebookLM();
  syncInteractionsToCalendar();
}

/**
 * Syncs immutable Contact ID rows between Master_Contacts_Sync and Core_CRM!CONTACT_DIRECTORY.
 * Propagates Birthday_Sync overrides from Core_CRM back to Master_Contacts_Sync.
 */
function syncMasterAndCoreCRM() {
  const mSs = SpreadsheetApp.openById(SYMBIOSIS_CFG.MASTER_SS_ID);
  const mSheet = mSs.getSheetByName('Google Contacts Sync Master');
  const cSs = SpreadsheetApp.openById(SYMBIOSIS_CFG.CORE_CRM_SS_ID);
  const cSheet = cSs.getSheetByName('CONTACT_DIRECTORY');
  if (!mSheet || !cSheet) return;

  const mData = mSheet.getDataRange().getValues();
  const mCol = {};
  mData[0].forEach((h, i) => { mCol[String(h || '').trim()] = i; });

  const cLastRow = cSheet.getLastRow();
  const cData = cLastRow >= 2 ? cSheet.getRange(2, 1, cLastRow - 1, 21).getValues() : [];
  const dirByCid = {};
  cData.forEach((row, idx) => {
    const cid = String(row[0] || '').trim();
    if (cid) dirByCid[cid] = { idx: idx, row: row };
  });

  const masterBdayOverrides = [];
  const newDirRows = [];

  for (let r = 1; r < mData.length; r++) {
    const mr = mData[r];
    const cid = String(mr[mCol['Contact ID']] || '').trim();
    if (!cid) continue;

    const fullName = [mr[mCol['First Name']], mr[mCol['Middle Name']], mr[mCol['Last Name']]]
      .map(s => String(s || '').trim()).filter(Boolean).join(' ') || String(mr[mCol['Nickname']] || mr[mCol['Organization Name']] || cid);
    const phone = String(mr[mCol['Phone 1 - Value']] || '').trim();
    const email = String(mr[mCol['E-mail 1 - Value']] || '').trim();
    const country = String(mr[mCol['Address 1 - Country']] || '').trim();
    const org = String(mr[mCol['Organization Name']] || '').trim();
    const masterBday = String(mr[mCol['Master_Birthday']] || mr[mCol['Birthday']] || '').trim();
    const gender = String(mr[mCol['Gender']] || '').trim();

    if (dirByCid[cid]) {
      const dr = dirByCid[cid].row;
      // Keep read-only identity mirrors fresh in CONTACT_DIRECTORY (Cols C..H)
      dr[2] = fullName;
      dr[3] = phone;
      dr[4] = email;
      dr[5] = country;
      dr[6] = org;
      dr[7] = masterBday;
      if (!dr[14] && gender) dr[14] = gender;

      // Propagate Birthday_Sync override from Core_CRM -> Master_Contacts_Sync
      const crmBdaySync = String(dr[15] || '').trim();
      const masterBdaySync = String(mr[mCol['Birthday_Sync']] || '').trim();
      if (crmBdaySync && crmBdaySync !== masterBdaySync) {
        masterBdayOverrides.push({ row1: r + 1, col1: mCol['Birthday_Sync'] + 1, val: crmBdaySync });
      }
    } else {
      newDirRows.push([
        cid, '', fullName, phone, email, country, org, masterBday,
        '', '', '', '', '', '', gender, String(mr[mCol['Birthday_Sync']] || ''),
        '', '', '', '', ''
      ]);
    }
  }

  // Write refreshed read-only identity columns C..H back to CONTACT_DIRECTORY without touching formula cols B, Q, S, T, U!
  // Always enforce Plain Text '@' on Primary_Phone (Col D) so international '+' phone numbers never become '#ERROR!'
  if (cData.length > 0) {
    const mirrorCH = cData.map(r => [r[2], r[3], r[4], r[5], r[6], r[7]]);
    cSheet.getRange(2, 4, mirrorCH.length, 1).setNumberFormat('@');
    cSheet.getRange(2, 3, mirrorCH.length, 6).setValues(mirrorCH);
  }
  if (newDirRows.length > 0) {
    // Only write non-formula columns for newly added rows so Row 2 ARRAYFORMULAs spill cleanly
    const startR = cSheet.getLastRow() + 1;
    cSheet.getRange(startR, 4, newDirRows.length, 1).setNumberFormat('@');
    cSheet.getRange(startR, 1, newDirRows.length, 1).setValues(newDirRows.map(r => [r[0]]));
    cSheet.getRange(startR, 3, newDirRows.length, 14).setValues(newDirRows.map(r => r.slice(2, 16)));
  }

  masterBdayOverrides.forEach(ov => {
    mSheet.getRange(ov.row1, ov.col1).setValue(ov.val);
  });
  Logger.log('syncMasterAndCoreCRM done. New dir rows: ' + newDirRows.length + ', Bday overrides: ' + masterBdayOverrides.length);
}

/**
 * Symbiotic Write-Back from Core_CRM -> ENTITY_LINKS:
 *  - Body Count 2.0 link -> updates Relationship_Status (Intimate / FWB or Legacy),
 *    hydrates Address 1 - Country and Event 1 (First Met) in Master_Contacts_Sync.
 *  - Career / Education link -> hydrates Organization Name in Master_Contacts_Sync when blank.
 */
function runEntityLinksWriteback() {
  const cSs = SpreadsheetApp.openById(SYMBIOSIS_CFG.CORE_CRM_SS_ID);
  const lnkSheet = cSs.getSheetByName('ENTITY_LINKS');
  const dirSheet = cSs.getSheetByName('CONTACT_DIRECTORY');
  const mSs = SpreadsheetApp.openById(SYMBIOSIS_CFG.MASTER_SS_ID);
  const mSheet = mSs.getSheetByName('Google Contacts Sync Master');
  if (!lnkSheet || !dirSheet || !mSheet || lnkSheet.getLastRow() < 2) return;

  // Build Body Count lookup by normalized name
  const bcMap = {};
  try {
    const bcSs = SpreadsheetApp.openById(SYMBIOSIS_CFG.BODY_COUNT_SS_ID);
    const bcFr = bcSs.getSheetByName('Form Responses 1');
    if (bcFr && bcFr.getLastRow() >= 2) {
      const bData = bcFr.getDataRange().getValues();
      const bh = {};
      bData[0].forEach((h, i) => { bh[String(h || '').trim()] = i; });
      for (let i = 1; i < bData.length; i++) {
        const fn = String(bData[i][bh['First Name']] || '').trim();
        const ln = String(bData[i][bh['Last Name']] || '').trim();
        const nm = (fn + ' ' + ln).trim().toLowerCase();
        if (!nm) continue;
        bcMap[nm] = {
          country: String(bData[i][bh['Her Country of Residence']] || bData[i][bh['Encounter Country']] || '').trim(),
          date: String(bData[i][bh['Encounter Date']] || '').trim(),
          status: String(bData[i][bh['Status?']] || '').trim()
        };
      }
    }
  } catch (e) {
    Logger.log('Body Count read skipped: ' + e.message);
  }

  const mData = mSheet.getDataRange().getValues();
  const mCol = {};
  mData[0].forEach((h, i) => { mCol[String(h || '').trim()] = i; });
  const mRowByCid = {};
  for (let r = 1; r < mData.length; r++) {
    const cid = String(mData[r][mCol['Contact ID']] || '').trim();
    if (cid) mRowByCid[cid] = r + 1;
  }

  const dirCids = dirSheet.getRange(2, 1, Math.max(1, dirSheet.getLastRow() - 1), 1).getValues().map(r => String(r[0] || '').trim());
  const dRowByCid = {};
  dirCids.forEach((cid, i) => { if (cid) dRowByCid[cid] = i + 2; });

  const links = lnkSheet.getRange(2, 1, lnkSheet.getLastRow() - 1, 10).getValues();
  for (let i = 0; i < links.length; i++) {
    const cid = String(links[i][2] || '').trim();
    const brick = String(links[i][3] || '').trim();
    const rec = String(links[i][4] || '').trim();
    const wbStatus = String(links[i][9] || '').trim();
    if (!cid || !brick || !rec || wbStatus === 'HYDRATED') continue;

    const mRow1 = mRowByCid[cid];
    const dRow1 = dRowByCid[cid];

    if (brick === 'Body Count 2.0') {
      const bc = bcMap[rec.toLowerCase()] || {};
      if (dRow1) {
        const curStatus = String(dirSheet.getRange(dRow1, 13).getValue() || '').trim();
        if (!curStatus || curStatus === 'Number_Only / Lead' || curStatus === 'Texting / Talking' || curStatus === 'Dating') {
          const isLegacy = /ended|past|ex|over|legacy/i.test(bc.status || '');
          dirSheet.getRange(dRow1, 13).setValue(isLegacy ? 'Legacy' : 'Intimate / FWB');
        }
        if (!dirSheet.getRange(dRow1, 9).getValue()) {
          dirSheet.getRange(dRow1, 9).setValue('Love Life');
        }
      }
      if (mRow1) {
        if (bc.country && !mSheet.getRange(mRow1, mCol['Address 1 - Country'] + 1).getValue()) {
          mSheet.getRange(mRow1, mCol['Address 1 - Country'] + 1).setValue(bc.country);
        }
        if (bc.date && !mSheet.getRange(mRow1, mCol['Event 1 - Value'] + 1).getValue()) {
          mSheet.getRange(mRow1, mCol['Event 1 - Label'] + 1).setValue('First Met');
          mSheet.getRange(mRow1, mCol['Event 1 - Value'] + 1).setValue(bc.date);
        }
      }
      lnkSheet.getRange(i + 2, 10).setValue('HYDRATED');
    } else if (brick === 'Career & Work' || brick === 'Education & Credentials') {
      if (mRow1 && !mSheet.getRange(mRow1, mCol['Organization Name'] + 1).getValue()) {
        mSheet.getRange(mRow1, mCol['Organization Name'] + 1).setValue(rec);
      }
      if (dRow1 && !dirSheet.getRange(dRow1, 7).getValue()) {
        dirSheet.getRange(dRow1, 7).setValue(rec);
      }
      lnkSheet.getRange(i + 2, 10).setValue('HYDRATED');
    }
  }
}

/**
 * Refreshes lean 📓 NotebookLM_Social_Workbook!ACTIVE_SOCIAL_PROFILES from Core_CRM
 * while 100% preserving user-edited Manual_Bio_&_Story_Notes & Personal_Context_&_Interests.
 */
function syncCoreCRMToNotebookLM() {
  const cSs = SpreadsheetApp.openById(SYMBIOSIS_CFG.CORE_CRM_SS_ID);
  const dirSheet = cSs.getSheetByName('CONTACT_DIRECTORY');
  const lnkSheet = cSs.getSheetByName('ENTITY_LINKS');
  const nSs = SpreadsheetApp.openById(SYMBIOSIS_CFG.NOTEBOOKLM_SS_ID);
  const nSheet = nSs.getSheetByName('ACTIVE_SOCIAL_PROFILES');
  if (!dirSheet || !nSheet || dirSheet.getLastRow() < 2) return;

  // Preserve existing manual bio & story notes (Cols P & Q -> 0-idx 15 & 16) keyed by Contact_Key
  const manualNotesByKey = {};
  if (nSheet.getLastRow() >= 2) {
    nSheet.getRange(2, 1, nSheet.getLastRow() - 1, 17).getValues().forEach(r => {
      const k = String(r[0] || '').trim();
      if (k && (String(r[15] || '').trim() || String(r[16] || '').trim())) {
        manualNotesByKey[k] = [r[15], r[16]];
      }
    });
  }

  // Group ENTITY_LINKS by Contact_ID
  const linksByCid = {};
  if (lnkSheet && lnkSheet.getLastRow() >= 2) {
    lnkSheet.getRange(2, 1, lnkSheet.getLastRow() - 1, 6).getValues().forEach(r => {
      const cid = String(r[2] || '').trim();
      if (!cid) return;
      if (!linksByCid[cid]) linksByCid[cid] = [];
      linksByCid[cid].push(r[3] + ': ' + r[4] + (r[5] ? ' (' + r[5] + ')' : ''));
    });
  }

  const dir = dirSheet.getRange(2, 1, dirSheet.getLastRow() - 1, 30).getValues();
  const out = [];
  dir.forEach(r => {
    const cid = String(r[0] || '').trim();
    const key = String(r[1] || '').trim();
    const fullName = String(r[2] || '').trim();
    const country = String(r[5] || '').trim();
    const org = String(r[6] || '').trim();
    const bday = String(r[7] || '').trim();
    const sphere = String(r[8] || '').trim();
    const tags = [r[9], r[10], r[11]].map(s => String(s || '').trim()).filter(Boolean).join(', ');
    const status = String(r[12] || '').trim();
    const cohort = String(r[21] || '').trim();
    const arena = String(r[22] || '').trim();
    const ring = String(r[23] || '').trim();
    const kinship = String(r[24] || '').trim();
    const interests = [r[25], r[26]].map(s => String(s || '').trim()).filter(Boolean).join(', ');
    const introBy = String(r[27] || '').trim();
    const city = String(r[28] || '').trim();
    const humanCtx = String(r[29] || '').trim();
    const linked = linksByCid[cid] || [];

    if (!sphere && !tags && !linked.length && !org && !bday && !cohort && !arena && !manualNotesByKey[key]) return;

    const rollup = [];
    if (cohort) rollup.push('Chapter: ' + cohort);
    if (arena) rollup.push('Met: ' + arena);
    if (org) rollup.push('Org: ' + org);
    if (country) rollup.push('Country: ' + country);
    if (linked.length) rollup.push(linked.join(' | '));
    const saved = manualNotesByKey[key] || [humanCtx, ''];

    out.push([
      key, fullName, sphere, cohort, arena, ring, kinship, interests, introBy,
      tags, status, country, city, org, rollup.join(' • '), saved[0], saved[1]
    ]);
  });

  if (nSheet.getLastRow() >= 2) {
    nSheet.getRange(2, 1, nSheet.getLastRow() - 1, 17).clearContent();
  }
  if (out.length > 0) {
    nSheet.getRange(2, 1, out.length, 17).setValues(out);
  }
  Logger.log('syncCoreCRMToNotebookLM refreshed ' + out.length + ' rich 17-col lifecycle AI profiles.');
}

/**
 * Syncs INTERACTION_LOG follow-up dates to the "Life OS" Google Calendar idempotently.
 */
function syncInteractionsToCalendar() {
  const cSs = SpreadsheetApp.openById(SYMBIOSIS_CFG.CORE_CRM_SS_ID);
  const logSheet = cSs.getSheetByName('INTERACTION_LOG');
  if (!logSheet || logSheet.getLastRow() < 2) return;

  const cals = CalendarApp.getCalendarsByName(SYMBIOSIS_CFG.LIFEOS_CALENDAR_NAME);
  const cal = cals.length > 0 ? cals[0] : CalendarApp.getDefaultCalendar();

  const rows = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues();
  for (let i = 0; i < rows.length; i++) {
    const contactKey = String(rows[i][2] || '').trim();
    const channel = String(rows[i][3] || '').trim();
    const summary = String(rows[i][5] || '').trim();
    const nextDate = rows[i][6];
    const existingEventId = String(rows[i][7] || '').trim();

    if (!contactKey || !nextDate || existingEventId) continue;
    const dt = new Date(nextDate);
    if (isNaN(dt.getTime())) continue;

    const ev = cal.createAllDayEvent(
      '📇 Follow-Up: ' + contactKey.split('•')[0].trim(),
      dt,
      { description: 'Channel: ' + channel + '\nLast Summary: ' + summary + '\nSource: LifeOS Core_CRM' }
    );
    logSheet.getRange(i + 2, 8).setValue(ev.getId());
  }
}
// --- END SOURCE: src/utilities/crm_core/crm_symbiosis_engine.gs ---

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📇 LifeOS Core CRM')
    .addItem('Sync Follow-Ups <-> Google Calendar', 'syncCrmCalendarTwoWay')
    .addItem('Run Full CRM Symbiosis Orchestrator', 'runFullSymbiosisOrchestrator')
    .addSeparator()
    .addItem('Execute Marked Bulk Cohort Action', 'executeBulkCohortAction')
    .addItem('Quick Purge Email-Only Contacts -> Vault', 'quickPurgeEmailOnlyToVault')
    .addSeparator()
    .addItem('Install / Reset All CRM Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) Every 6 hours -> syncCrmCalendarTwoWay
 *   2) Daily 6:00 AM -> runFullSymbiosisOrchestrator
 */
function setupTriggers() {
  const managed = new Set(['syncCrmCalendarTwoWay', 'runFullSymbiosisOrchestrator']);
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (managed.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('syncCrmCalendarTwoWay')
    .timeBased()
    .everyHours(6)
    .create();

  ScriptApp.newTrigger('runFullSymbiosisOrchestrator')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Core CRM Triggers Armed!\n\n' +
      '• Every 6 hours → syncCrmCalendarTwoWay\n' +
      '• Daily 6:00 AM → runFullSymbiosisOrchestrator'
    );
  } catch (e) {
    Logger.log('Core CRM triggers armed (headless run).');
  }
}

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
function onOpen() {
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

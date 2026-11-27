/**
 * ============================================================================
 * LifeOS v3.0 — 🧠 LifeOS_feed_hub (ID_FEED_HUB)
 * Production Apps Script: Two-Way Calendar Sync + 6-Hour Hub Heartbeat Nudge
 * ============================================================================
 * Spreadsheet ID : 1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U
 * Bundled From   : src/hub/calendar_sync.gs + Hub Heartbeat Engine
 *
 * LAW 1 COMPLIANCE: NEVER overwrites or deletes rows in RAW_DATA_EventLog / Quests.
 * ZERO-PII BOUNDARY: Heartbeat writes strictly a UTC telemetry timestamp cell.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

// --- BEGIN SOURCE: src/hub/calendar_sync.gs ---
/**
 * ============================================================================
 * LIFEOS-v3 // PHASE 5 TEMPORAL BRIDGE — CORE HUB TWO-WAY CALENDAR ENGINE
 * File: src/hub/calendar_sync.gs (Bound to: LifeOS_feed_hub)
 * ============================================================================
 * Architectural Laws Enforced (Laws 1–8):
 *  - Google Calendar is strictly a downstream display & capture layer;
 *    Life OS Sheets remain the Single Source of Truth.
 *  - Dedicated secondary calendar `Life OS` overlays cleanly without touching
 *    your primary personal calendar.
 *  - Anti-Loop Guarantee:
 *      1. Every outbound pushed event carries `[LifeOS_OUTBOUND_PUSH]` in its
 *         description so `pullEventsToLog()` never re-ingests system pushes.
 *      2. Every pulled event ID is indexed in hidden tab `LOGGED_EVENT_IDS`
 *         inside `LifeOS_feed_hub` so no event is ever logged twice.
 *      3. Every pushed quest stamps `Calendar_Event_ID` in `RAW_DATA_Quests`
 *         (Layer 1 source of truth -> flows dynamically into P5 `DATABASE`).
 *  - Guarded by `LockService.getScriptLock()` so 15-minute runs never collide.
 *  - Zero PII logged to console or exported to public snapshots.
 * ============================================================================
 */

const HUB_CAL_CFG = Object.freeze({
  HUB_ID: '1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U',
  RAW_EVENTLOG_ID: '1p9LUEUQl_2N0AvaC15FGqD7ySzfJMObEeZj-KCQUZ-8',
  RAW_QUESTS_ID: '1uV7FXlTU--gHFOt7zWYRkDxGk15QXIPGbBcshkk4TVw',
  PILLAR_5_ID: '1AdMP-VKzTPNbSSTUoLrbqAjtBdYlf4mzLYwyWbaUrQw',
  CALENDAR_NAME: 'Life OS',
  TIMEZONE: 'America/New_York',
  LOOKBACK_HOURS: 24,
  LOCK_TIMEOUT_MS: 30000,
  OUTBOUND_MARKER: '[LifeOS_OUTBOUND_PUSH]',
  TABS: {
    LOGGED_IDS: 'LOGGED_EVENT_IDS',
    RULES_ENGINE: 'RULES_ENGINE',
  },
  CAL_ID_CELL_A1: 'B121', // RULES_ENGINE Section 13: LIFEOS_CALENDAR_ID
});

/**
 * Adds the Temporal Bridge submenu to LifeOS_feed_hub on open.
 */
function onOpenCalendarLegacy_() {
  SpreadsheetApp.getUi()
    .createMenu('🧠 LifeOS Hub')
    .addItem('📅 Sync Life OS Calendar Now (Two-Way)', 'syncLifeOSCalendarAll')
    .addSeparator()
    .addItem('⬇️ Pull Concluded Events → RAW_DATA_EventLog', 'pullEventsToLog')
    .addItem('⬆️ Push Open Quests → Life OS Calendar', 'pushQuestsToCalendar')
    .addItem('🛠️ Provision / Verify "Life OS" Calendar', 'provisionLifeOSCalendarInteractive')
    .addSeparator()
    .addItem('⏱️ Install 15-Minute Calendar Sync Trigger', 'install15MinCalendarTrigger')
    .addToUi();
}

/**
 * Master lock-guarded two-way temporal sync pipeline (run every 15 minutes).
 */
function syncLifeOSCalendarAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(HUB_CAL_CFG.LOCK_TIMEOUT_MS)) {
    Logger.log('HUB_CAL_SYNC_SKIP: Lock busy.');
    return { status: 'LOCKED_SKIP' };
  }

  try {
    const cal = getOrCreateLifeOSCalendar_();
    const pulled = pullEventsToLogInternal_(cal);
    const pushed = pushQuestsToCalendarInternal_(cal);

    Logger.log(`HUB_CAL_SYNC_OK: pulled=${pulled}, pushed=${pushed}`);
    try {
      SpreadsheetApp.getUi().alert(
        '📅 Life OS Temporal Bridge Synced',
        `Calendar: ${cal.getName()}\nEvents Pulled → RAW_DATA_EventLog: ${pulled}\nOpen Quests Pushed → Calendar: ${pushed}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {}

    return { status: 'OK', calendarId: cal.getId(), pulled, pushed };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Standalone entry point: Calendar -> RAW_DATA_EventLog (lock-guarded).
 */
function pullEventsToLog() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(HUB_CAL_CFG.LOCK_TIMEOUT_MS)) return 0;
  try {
    const cal = getOrCreateLifeOSCalendar_();
    return pullEventsToLogInternal_(cal);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Standalone entry point: Pillar 5 / RAW_DATA_Quests -> Calendar (lock-guarded).
 */
function pushQuestsToCalendar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(HUB_CAL_CFG.LOCK_TIMEOUT_MS)) return 0;
  try {
    const cal = getOrCreateLifeOSCalendar_();
    return pushQuestsToCalendarInternal_(cal);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Interactive helper to provision or verify the dedicated `Life OS` secondary calendar
 * and store its ID in `LifeOS_feed_hub!RULES_ENGINE!B121`.
 */
function provisionLifeOSCalendarInteractive() {
  const cal = getOrCreateLifeOSCalendar_();
  SpreadsheetApp.getUi().alert(
    '✅ Dedicated "Life OS" Secondary Calendar Ready',
    `Name: ${cal.getName()}\nCalendar ID: ${cal.getId()}\nTimezone: ${cal.getTimeZone()}\n\nStored in LifeOS_feed_hub!RULES_ENGINE!${HUB_CAL_CFG.CAL_ID_CELL_A1}.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Locates existing secondary calendar named `Life OS`, or creates it automatically
 * with timezone `America/New_York`, and persists its ID in ScriptProperties +
 * `LifeOS_feed_hub!RULES_ENGINE!B121`.
 * @returns {GoogleAppsScript.Calendar.Calendar}
 */
function getOrCreateLifeOSCalendar_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('LIFEOS_CALENDAR_ID');
  let cal = savedId ? CalendarApp.getCalendarById(savedId) : null;

  if (!cal) {
    const matches = CalendarApp.getCalendarsByName(HUB_CAL_CFG.CALENDAR_NAME);
    if (matches && matches.length > 0) {
      cal = matches[0];
    } else {
      cal = CalendarApp.createCalendar(HUB_CAL_CFG.CALENDAR_NAME, {
        timeZone: HUB_CAL_CFG.TIMEZONE,
        summary: 'LifeOS-v3 Temporal Bridge — Quests, Biometrics, CRM Follow-Ups & Event Capture',
        color: CalendarApp.Color.INDIGO,
      });
    }
  }

  const calId = cal.getId();
  props.setProperty('LIFEOS_CALENDAR_ID', calId);

  // Sync Calendar ID into LifeOS_feed_hub!RULES_ENGINE!B121
  try {
    const hub = SpreadsheetApp.openById(HUB_CAL_CFG.HUB_ID);
    const rules = hub.getSheetByName(HUB_CAL_CFG.TABS.RULES_ENGINE);
    if (rules) {
      const current = String(rules.getRange(HUB_CAL_CFG.CAL_ID_CELL_A1).getValue() || '').trim();
      if (current !== calId) {
        rules.getRange(HUB_CAL_CFG.CAL_ID_CELL_A1).setValue(calId);
      }
    }
  } catch (e) {
    Logger.log('HUB_CAL_ID_STORE_WARN: ' + e.message);
  }

  return cal;
}

/**
 * Pulls concluded events from the rolling 24-hour window on the `Life OS` calendar
 * into `RAW_DATA_EventLog`, deduplicated against hidden `LOGGED_EVENT_IDS`.
 * @param {GoogleAppsScript.Calendar.Calendar} cal
 * @returns {number}
 */
function pullEventsToLogInternal_(cal) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - HUB_CAL_CFG.LOOKBACK_HOURS * 3600 * 1000);
  const events = cal.getEvents(yesterday, now);
  if (!events || events.length === 0) return 0;

  const hub = SpreadsheetApp.openById(HUB_CAL_CFG.HUB_ID);
  const idxSheet = getOrCreateLoggedIndexSheet_(hub);
  const existingIds = new Set();
  if (idxSheet.getLastRow() >= 2) {
    const rawIds = idxSheet.getRange(2, 1, idxSheet.getLastRow() - 1, 1).getValues();
    rawIds.forEach(r => {
      const id = String(r[0] || '').trim();
      if (id) existingIds.add(id);
    });
  }

  const rawEventSs = SpreadsheetApp.openById(HUB_CAL_CFG.RAW_EVENTLOG_ID);
  const eventSheet = rawEventSs.getSheetByName('Form Responses 1') || rawEventSs.getSheets()[0];

  let loggedCount = 0;
  const nowIso = Utilities.formatDate(now, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");

  events.forEach(ev => {
    // Only pull events that have already concluded
    if (ev.getEndTime().getTime() > now.getTime()) return;

    const evId = ev.getId();
    if (!evId || existingIds.has(evId)) return;

    const desc = String(ev.getDescription() || '');
    const title = String(ev.getTitle() || '').trim();
    if (!title) return;

    // Anti-loop guard: skip LifeOS outbound pushes (Quests, Health Log, CRM Follow-ups)
    if (desc.indexOf(HUB_CAL_CFG.OUTBOUND_MARKER) !== -1) return;
    if (title.indexOf('[QUEST DUE]:') === 0 || title.indexOf('Health Log:') === 0) return;

    const eventStartStr = Utilities.formatDate(ev.getStartTime(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    const eventEndIso = Utilities.formatDate(ev.getEndTime(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const eventStartIso = Utilities.formatDate(ev.getStartTime(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");

    // Append to RAW_DATA_EventLog (14-col schema: A:Timestamp, B:Event Date, C:Description, D:Tags; leave reflection/impact blank)
    eventSheet.appendRow([
      now,               // A: Timestamp
      eventStartStr,     // B: When did this event/interaction occur?
      title,             // C: Describe the event or interaction.
      '[Calendar_Event]',// D: Apply relevant tags
      '', '', '', '', '', '', '', '', '', '', // E..N left blank for intentional reflection
    ]);

    idxSheet.appendRow([
      evId,
      title,
      eventStartIso,
      eventEndIso,
      nowIso,
      'RAW_DATA_EventLog',
      cal.getName(),
    ]);
    existingIds.add(evId);
    loggedCount++;
  });

  if (loggedCount > 0) SpreadsheetApp.flush();
  return loggedCount;
}

/**
 * Scans `RAW_DATA_Quests` (canonical source for `🏆 Pillar_5_Experience_Legacy`
 * `DATABASE` / `CLEAN_QUEST_LOG`) for open quests with a `Target Completion Date`
 * and blank `Calendar_Event_ID`, creates all-day `[QUEST DUE]: <Quest Name>`
 * events on `Life OS`, and writes `event.getId()` back into Column P (`Calendar_Event_ID`).
 * @param {GoogleAppsScript.Calendar.Calendar} cal
 * @returns {number}
 */
function pushQuestsToCalendarInternal_(cal) {
  const questsSs = SpreadsheetApp.openById(HUB_CAL_CFG.RAW_QUESTS_ID);
  const sheet = questsSs.getSheetByName('Form Responses 1') || questsSs.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  // 16-column v3.0 RAW_DATA_Quests schema:
  // B(1)=Quest Name, C(2)=Description, D(3)=Primary Pillar, E(4)=Quest Tier,
  // G(6)=Target Completion Date, H(7)=CORE Values, K(10)=Bloom's Level,
  // N(13)=Status, O(14)=Special Flags, P(15)=Calendar_Event_ID
  const rows = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  let pushedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const questName = String(r[1] || '').trim();
    const targetRaw = r[6];
    const status = String(r[13] || '').trim().toLowerCase();
    const existingCalId = String(r[15] || '').trim();

    if (!questName || !targetRaw || existingCalId) continue;
    if (status === 'complete' || status === 'completed' || status === 'cancelled' || status === 'archived') continue;

    const dueDate = targetRaw instanceof Date ? targetRaw : new Date(targetRaw);
    if (isNaN(dueDate.getTime())) continue;

    const title = `[QUEST DUE]: ${questName}`;
    const descLines = [
      HUB_CAL_CFG.OUTBOUND_MARKER,
      `Quest Tier: ${r[4] || 'Unassigned'}`,
      `Primary Pillar: ${r[3] || 'Life OS'}`,
      `Bloom's Cognitive Level: ${r[10] || 'Unassigned'}`,
      `CORE Values: ${r[7] || 'Unassigned'}`,
      r[14] ? `Special Flags: ${r[14]}` : '',
      r[2] ? `\nObjective:\n${r[2]}` : '',
    ].filter(Boolean).join('\n');

    const ev = cal.createAllDayEvent(title, dueDate, { description: descLines });
    sheet.getRange(i + 2, 16).setValue(ev.getId());
    pushedCount++;
  }

  if (pushedCount > 0) SpreadsheetApp.flush();
  return pushedCount;
}

/**
 * Ensures hidden deduplication tab `LOGGED_EVENT_IDS` exists inside `LifeOS_feed_hub`.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} hub
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateLoggedIndexSheet_(hub) {
  let sh = hub.getSheetByName(HUB_CAL_CFG.TABS.LOGGED_IDS);
  if (!sh) {
    sh = hub.insertSheet(HUB_CAL_CFG.TABS.LOGGED_IDS);
    sh.getRange(1, 1, 1, 7).setValues([[
      'Event_ID', 'Event_Title', 'Event_Start_UTC', 'Event_End_UTC',
      'Logged_At_UTC', 'Target_Sheet', 'Source_Calendar',
    ]]);
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}

/**
 * Installs a lock-guarded 15-minute trigger for `syncLifeOSCalendarAll()`
 * (cleans up any duplicate triggers first).
 */
function install15MinCalendarTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncLifeOSCalendarAll') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('syncLifeOSCalendarAll')
    .timeBased()
    .everyMinutes(15)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '⏱️ 15-Minute Calendar Sync Installed',
      'Installed lock-guarded trigger running syncLifeOSCalendarAll() every 15 minutes.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (_) {}
}
// --- END SOURCE: src/hub/calendar_sync.gs ---

// ============================================================================
// GATE 4 — HUB HEARTBEAT & IMPORTRANGE STALE-CACHE NUDGE (EVERY 6 HOURS)
// ============================================================================

/**
 * Forces a clean recalculation flush on LifeOS_feed_hub (preventing idle
 * IMPORTRANGE / SIGNAL_BUS / LOOKER_* cache staleness) and stamps the
 * Hub Heartbeat cell on LOOKER_SYSTEM_TELEMETRY / PUBLIC_DATA.
 */
function runHubHeartbeatNudge() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Hub heartbeat skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(HUB_CAL_CFG.FEED_HUB_ID);
    const nowIso = new Date().toISOString();

    // Stamp a non-intrusive telemetry cell on LOGGED_EVENT_IDS (Z1) to trigger
    // Google Sheets' dependency recalculation without altering any signal rows.
    const idxSheet = ss.getSheetByName(HUB_CAL_CFG.LOGGED_INDEX_TAB);
    if (idxSheet) {
      idxSheet.getRange('D1').setValue('Hub_Last_Heartbeat_UTC');
      idxSheet.getRange('E1').setValue(nowIso);
    }

    // Flush spreadsheet recalculation across SIGNAL_BUS & LOOKER_* tabs
    SpreadsheetApp.flush();
    Logger.log('LifeOS_feed_hub heartbeat nudge completed at ' + nowIso);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Unified LifeOS Hub Menu.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧠 LifeOS Hub')
    .addItem('Sync Calendar (Pull Events + Push Quests)', 'syncLifeOSCalendarAll')
    .addItem('Pull Calendar Events -> EventLog', 'pullEventsToLog')
    .addItem('Push Active Quests -> Calendar', 'pushQuestsToCalendar')
    .addItem('Run Hub Heartbeat & Cache Nudge Now', 'runHubHeartbeatNudge')
    .addSeparator()
    .addItem('Provision Dedicated LifeOS Calendar', 'provisionLifeOSCalendarInteractive')
    .addItem('Install / Reset All Hub Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) Every 15 minutes -> syncLifeOSCalendarAll (Gate 3)
 *   2) Every 6 hours    -> runHubHeartbeatNudge  (Gate 4)
 */
function setupTriggers() {
  const managed = new Set(['syncLifeOSCalendarAll', 'runHubHeartbeatNudge']);
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (managed.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('syncLifeOSCalendarAll')
    .timeBased()
    .everyMinutes(15)
    .create();

  ScriptApp.newTrigger('runHubHeartbeatNudge')
    .timeBased()
    .everyHours(6)
    .create();

  runHubHeartbeatNudge();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ LifeOS_feed_hub Triggers Armed!\n\n' +
      '• Every 15 minutes → syncLifeOSCalendarAll\n' +
      '• Every 6 hours → runHubHeartbeatNudge\n' +
      '• Initial Heartbeat Nudge executed.'
    );
  } catch (e) {
    Logger.log('LifeOS_feed_hub triggers armed (headless run).');
  }
}

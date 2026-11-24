/**
 * ============================================================================
 * LIFEOS-v3 // PHASE 5 TEMPORAL BRIDGE — BIO_CORE DAILY HEALTH CALENDAR LOG
 * File: src/utilities/bio_core/CalendarIntegration.gs (Bound to: 🩺 BIO_CORE)
 * ============================================================================
 * Reads the latest daily biometric row in `🩺 BIO_CORE` (`RAW_DATA_Biometrics`
 * + `BIO_CALCULATIONS!B15` Sleep Index fallback) and posts or updates an
 * all-day summary event on the dedicated `Life OS` secondary calendar:
 *
 *   Title: `Health Log: <Sleep_Index/Score> | <Steps> steps | <Resting_HR>bpm`
 *   Body:  Deep+REM mins, HRV RMSSD, Active Calories, Workout Mins
 *
 * Idempotent by date via `[LifeOS_BIO_SUMMARY:YYYY-MM-DD]` marker so re-runs
 * update cleanly in-place without creating duplicate calendar entries.
 * Carries `[LifeOS_OUTBOUND_PUSH]` anti-loop tag so Hub `pullEventsToLog()`
 * never re-ingests biometric summary posts.
 * ============================================================================
 */

const BIO_CAL_CFG = Object.freeze({
  BIO_CORE_ID: '1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA',
  HUB_ID: '1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U',
  CALENDAR_NAME: 'Life OS',
  TIMEZONE: 'America/New_York',
  LOCK_TIMEOUT_MS: 30000,
  OUTBOUND_MARKER: '[LifeOS_OUTBOUND_PUSH]',
  RAW_TAB: 'RAW_DATA_Biometrics',
  CALC_TAB: 'BIO_CALCULATIONS',
});

/**
 * Adds BIO_CORE Temporal Bridge menu items on open.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🩺 BIO_CORE Temporal')
    .addItem('📅 Post / Update Latest Health Log on Life OS Calendar', 'logSummaryToCalendar')
    .addItem('⏰ Install Daily Biometric Calendar Trigger (08:30)', 'installBioCalendarTrigger')
    .addToUi();
}

/**
 * Reads the latest daily biometric record in `🩺 BIO_CORE` and posts/updates
 * a de-duplicated all-day Health Log summary on the dedicated `Life OS` calendar.
 */
function logSummaryToCalendar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(BIO_CAL_CFG.LOCK_TIMEOUT_MS)) {
    Logger.log('BIO_CAL_SKIP: Lock busy.');
    return { status: 'LOCKED_SKIP' };
  }

  try {
    const ss = SpreadsheetApp.openById(BIO_CAL_CFG.BIO_CORE_ID);
    const rawSheet = ss.getSheetByName(BIO_CAL_CFG.RAW_TAB);
    const calcSheet = ss.getSheetByName(BIO_CAL_CFG.CALC_TAB);
    if (!rawSheet || rawSheet.getLastRow() < 2) {
      Logger.log('BIO_CAL_EMPTY: No biometric rows found.');
      return { status: 'NO_ROWS' };
    }

    // Find newest non-blank Date row (RAW_DATA_Biometrics columns A..L):
    // A(0)=Timestamp, B(1)=Date, C(2)=Source, D(3)=Sleep_Hours, E(4)=Sleep_Score,
    // F(5)=Deep_REM_Mins, G(6)=Steps, H(7)=Resting_HR, I(8)=HRV_ms,
    // J(9)=Active_Calories, K(10)=Weight_lbs, L(11)=Workout_Mins
    const rows = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 12).getValues();
    let latestRow = null;
    let latestTime = -Infinity;

    rows.forEach(r => {
      if (!r[1]) return;
      const d = r[1] instanceof Date ? r[1] : new Date(r[1]);
      if (isNaN(d.getTime())) return;
      if (d.getTime() >= latestTime) {
        latestTime = d.getTime();
        latestRow = r;
      }
    });

    if (!latestRow) return { status: 'NO_VALID_DATE' };

    const logDate = latestRow[1] instanceof Date ? latestRow[1] : new Date(latestRow[1]);
    const dateKey = Utilities.formatDate(logDate, BIO_CAL_CFG.TIMEZONE, 'yyyy-MM-dd');

    // Prefer raw Sleep_Score; fall back cleanly to BIO_CALCULATIONS!B15 (SLEEP_INDEX_0_100)
    const rawSleepScore = latestRow[4];
    const calcSleepIndex = calcSheet ? calcSheet.getRange('B15').getValue() : '';
    const sleepVal = (rawSleepScore !== '' && isFinite(Number(rawSleepScore)))
      ? `${Math.round(Number(rawSleepScore))}/100`
      : (calcSleepIndex !== '' && isFinite(Number(calcSleepIndex)) ? `${Number(calcSleepIndex).toFixed(1)} idx` : 'N/A');

    const stepsVal = isFinite(Number(latestRow[6])) && latestRow[6] !== ''
      ? Math.round(Number(latestRow[6])).toLocaleString('en-US')
      : '0';
    const rhrVal = isFinite(Number(latestRow[7])) && latestRow[7] !== ''
      ? Math.round(Number(latestRow[7]))
      : '--';

    const deepRem = latestRow[5] !== '' ? `${Math.round(Number(latestRow[5]))} mins` : '—';
    const hrvMs = latestRow[8] !== '' ? `${Number(latestRow[8]).toFixed(1)} ms` : '—';
    const activeCal = latestRow[9] !== '' ? `${Math.round(Number(latestRow[9]))} kcal` : '—';
    const workoutMins = latestRow[11] !== '' ? `${Math.round(Number(latestRow[11]))} mins` : '—';
    const sleepHrs = latestRow[3] !== '' ? `${Number(latestRow[3]).toFixed(2)} hrs` : '—';
    const readiness = calcSheet ? calcSheet.getRange('B18').getValue() : '';

    const title = `Health Log: ${sleepVal} | ${stepsVal} steps | ${rhrVal}bpm`;
    const dateMarker = `[LifeOS_BIO_SUMMARY:${dateKey}]`;
    const description = [
      BIO_CAL_CFG.OUTBOUND_MARKER,
      dateMarker,
      `Date: ${dateKey}`,
      `Sleep Duration: ${sleepHrs} | Sleep Index/Score: ${sleepVal}`,
      `Deep + REM Sleep: ${deepRem}`,
      `HRV (RMSSD): ${hrvMs}`,
      `Resting Heart Rate: ${rhrVal} bpm`,
      `Steps: ${stepsVal}`,
      `Active Calories: ${activeCal}`,
      `Workout Minutes: ${workoutMins}`,
      isFinite(Number(readiness)) && readiness !== '' ? `BIO_READINESS_SCORE: ${Number(readiness).toFixed(1)}/100` : '',
    ].filter(Boolean).join('\n');

    const cal = resolveLifeOSCalendarForBio_();
    const dayEvents = cal.getEventsForDay(logDate);
    const existing = dayEvents.find(ev => String(ev.getDescription() || '').indexOf(dateMarker) !== -1);

    let action = 'CREATED';
    if (existing) {
      existing.setTitle(title);
      existing.setDescription(description);
      action = 'UPDATED';
    } else {
      cal.createAllDayEvent(title, logDate, { description });
    }

    Logger.log(`BIO_CAL_${action}: date=${dateKey}`);
    try {
      SpreadsheetApp.getUi().alert(
        `🩺 Health Log ${action}`,
        `${title}\n\nCalendar: ${cal.getName()} (${dateKey})`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {}

    return { status: action, date: dateKey, title };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Resolves the dedicated `Life OS` secondary calendar (checking Hub RULES_ENGINE!B121 first).
 * @returns {GoogleAppsScript.Calendar.Calendar}
 */
function resolveLifeOSCalendarForBio_() {
  try {
    const hub = SpreadsheetApp.openById(BIO_CAL_CFG.HUB_ID);
    const rules = hub.getSheetByName('RULES_ENGINE');
    const storedId = rules ? String(rules.getRange('B121').getValue() || '').trim() : '';
    if (storedId && storedId.indexOf('@') !== -1) {
      const byId = CalendarApp.getCalendarById(storedId);
      if (byId) return byId;
    }
  } catch (_) {}

  const matches = CalendarApp.getCalendarsByName(BIO_CAL_CFG.CALENDAR_NAME);
  if (matches && matches.length > 0) return matches[0];
  return CalendarApp.createCalendar(BIO_CAL_CFG.CALENDAR_NAME, {
    timeZone: BIO_CAL_CFG.TIMEZONE,
    summary: 'LifeOS-v3 Temporal Bridge — Quests, Biometrics, CRM Follow-Ups & Event Capture',
  });
}

/**
 * Installs a daily morning trigger (8:30 AM) to post the previous day's biometric summary.
 */
function installBioCalendarTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'logSummaryToCalendar') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('logSummaryToCalendar')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(30)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '⏰ Daily Biometric Calendar Trigger Installed',
      'logSummaryToCalendar() will now run daily around 8:30 AM.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (_) {}
}

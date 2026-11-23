/**
 * LifeOS v3.0 — BIO_CORE Daily Google Calendar Health Summary Sync
 * ================================================================
 * Bound to: `🩺 BIO_CORE` (ID: 1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA)
 *
 * Posts or updates an idempotent daily all-day summary event on the dedicated
 * `Life OS` Google Calendar:
 *   `Health Log: <Score> | <Steps> steps | <RHR>bpm`
 *
 * Trigger Setup:
 *   Install a daily time-driven trigger calling `syncDailyHealthToCalendar()`
 *   (e.g., 21:30 local time). Optionally set Script Property
 *   `LIFEOS_CALENDAR_NAME` (defaults to `Life OS`).
 */

const BIO_TAG_PREFIX = '[LifeOS_BIO_CORE]';

function syncDailyHealthToCalendar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calcSheet = ss.getSheetByName('BIO_CALCULATIONS');
  const rawSheet = ss.getSheetByName('RAW_DATA_Biometrics');
  if (!calcSheet || !rawSheet) {
    throw new Error('Missing BIO_CALCULATIONS or RAW_DATA_Biometrics tab.');
  }

  const calName =
    PropertiesService.getScriptProperties().getProperty('LIFEOS_CALENDAR_NAME') || 'Life OS';
  const calendars = CalendarApp.getCalendarsByName(calName);
  const cal = calendars.length > 0 ? calendars[0] : CalendarApp.createCalendar(calName);

  const readinessScore = calcSheet.getRange('B18').getDisplayValue().trim();
  const latestDateVal = calcSheet.getRange('B3').getValue();
  if (!latestDateVal) {
    Logger.log('No biometric logs present in RAW_DATA_Biometrics yet; skipping calendar sync.');
    return;
  }

  const eventDate = latestDateVal instanceof Date ? latestDateVal : new Date(latestDateVal);
  const dateIso = Utilities.formatDate(eventDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Pull latest row metrics matching latestDateVal
  const lastRow = rawSheet.getLastRow();
  let steps = '—';
  let rhr = '—';
  let sleepHrs = '—';
  let hrv = '—';

  if (lastRow >= 2) {
    const rows = rawSheet.getRange(2, 2, lastRow - 1, 11).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      const rowDate =
        rows[i][0] instanceof Date
          ? Utilities.formatDate(rows[i][0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(rows[i][0]).slice(0, 10);
      if (rowDate === dateIso) {
        if (rows[i][2] !== '') sleepHrs = Number(rows[i][2]).toFixed(1);
        if (rows[i][5] !== '') steps = Number(rows[i][5]).toLocaleString();
        if (rows[i][6] !== '') rhr = Math.round(Number(rows[i][6]));
        if (rows[i][7] !== '') hrv = Number(rows[i][7]).toFixed(1);
        break;
      }
    }
  }

  const scoreLabel = readinessScore !== '' ? readinessScore : 'UNSCORED';
  const title = `Health Log: ${scoreLabel} | ${steps} steps | ${rhr}bpm`;
  const description = [
    `${BIO_TAG_PREFIX} Date: ${dateIso}`,
    `BIO Readiness Score: ${scoreLabel} / 100`,
    `Sleep Duration: ${sleepHrs} hrs`,
    `Steps: ${steps}`,
    `Resting HR: ${rhr} bpm`,
    `HRV (RMSSD): ${hrv} ms`,
    `Workbook: ${ss.getUrl()}`,
  ].join('\n');

  // Idempotent update if an event tagged [LifeOS_BIO_CORE] already exists for this date
  const existingEvents = cal.getEventsForDay(eventDate);
  for (let i = 0; i < existingEvents.length; i++) {
    const ev = existingEvents[i];
    if (ev.getDescription().indexOf(BIO_TAG_PREFIX) !== -1) {
      ev.setTitle(title);
      ev.setDescription(description);
      Logger.log('Updated existing Life OS Calendar health log: ' + title);
      return;
    }
  }

  cal.createAllDayEvent(title, eventDate, { description });
  Logger.log('Created Life OS Calendar health log: ' + title);
}

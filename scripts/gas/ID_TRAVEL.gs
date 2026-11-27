/**
 * ============================================================================
 * LifeOS v3.0 — 🌍 Travel_Tracker_Brick (ID_TRAVEL)
 * Production Apps Script: Form B Trip Dropdown Sync + Calendar Trip Blocks
 * ============================================================================
 * Spreadsheet ID : 11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc
 * Linked Forms   :
 *   - Form A (Trips Intake)   : 18g_CLV1ry5gXdzx3iZWO3G95vK1LlA2hVSotqoNPwkU
 *   - Form B (Trip Reviews)   : 1D9IWDydIGrmxNUiY-mJkeQT8LMryaOJpWEjS2dkWb1M
 *
 * LAW 1 COMPLIANCE: NEVER modifies Form Responses 1 or Form Responses 2.
 * ZERO-PII BOUNDARY: Syncs Trip Names, Country/City labels & travel dates only.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

const TRAVEL_GAS_CFG = Object.freeze({
  SPREADSHEET_ID: '11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc',
  TRIPS_TAB: 'TRIPS_RAW',
  META_TAB: 'MODULE_META',
  FORM_B_REVIEWS_ID: '1D9IWDydIGrmxNUiY-mJkeQT8LMryaOJpWEjS2dkWb1M',
  CALENDAR_NAME: 'LifeOS Mission Control',
  CALENDAR_TAG: '[LifeOS_TRAVEL]',
  MAX_CHOICES: 950,
  TRIGGERS: Object.freeze({
    ON_FORM_SUBMIT: 'onTravelFormSubmit',
    DAILY_SYNC: 'runTravelDailySync',
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌍 LifeOS Travel')
    .addItem('Sync Trip Names → Form B Review Dropdown', 'syncTravelReviewDropdown')
    .addItem('Sync Upcoming Trips → Google Calendar', 'syncUpcomingTripsToCalendar')
    .addSeparator()
    .addItem('Install / Reset Automatic Triggers', 'setupTriggers')
    .addToUi();
}

/**
 * Fires on Form A or Form B submit: keeps Form B's Trip selector synchronized.
 */
function onTravelFormSubmit(e) {
  syncTravelReviewDropdown();
}

/**
 * Daily 6 AM combined sync: refreshes Form B dropdown + pushes upcoming trips to Calendar.
 */
function runTravelDailySync() {
  syncTravelReviewDropdown();
  syncUpcomingTripsToCalendar();
}

/**
 * Reads unique Trip_Name entries from TRIPS_RAW!B2:B and pushes them into
 * Form B (Reviews) dropdown so trip reviews join cleanly to master trips.
 */
function syncTravelReviewDropdown() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Travel dropdown sync skipped: lock busy.');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(TRAVEL_GAS_CFG.SPREADSHEET_ID);
    const tripsSheet = ss.getSheetByName(TRAVEL_GAS_CFG.TRIPS_TAB);
    if (!tripsSheet) {
      throw new Error('Missing TRIPS_RAW tab.');
    }

    const lastRow = tripsSheet.getLastRow();
    if (lastRow < 2) return;

    const rawNames = tripsSheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
    const seen = new Set();
    const trips = [];
    rawNames.forEach((r) => {
      const name = String(r[0] || '').trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        trips.push(name);
      }
    });

    if (trips.length === 0) return;

    const bounded = trips.slice(0, TRAVEL_GAS_CFG.MAX_CHOICES);
    const formB = FormApp.openById(TRAVEL_GAS_CFG.FORM_B_REVIEWS_ID);
    const items = formB.getItems();
    let updated = false;

    for (let i = 0; i < items.length; i++) {
      const type = items[i].getType();
      if (type !== FormApp.ItemType.LIST && type !== FormApp.ItemType.MULTIPLE_CHOICE) continue;
      const title = (items[i].getTitle() || '').toLowerCase();
      if (title.indexOf('trip') !== -1 || title.indexOf('destination') !== -1) {
        if (type === FormApp.ItemType.LIST) {
          items[i].asListItem().setChoiceValues(bounded);
        } else {
          items[i].asMultipleChoiceItem().setChoiceValues(bounded);
        }
        updated = true;
        break;
      }
    }

    if (!updated) {
      const firstList = items.find((it) => it.getType() === FormApp.ItemType.LIST);
      if (firstList) {
        firstList.asListItem().setChoiceValues(bounded);
        updated = true;
      }
    }

    stampTravelMeta_(ss, 'Last_FormB_Dropdown_Sync', new Date().toISOString() + ' (' + bounded.length + ' trips, updated=' + updated + ')');
    Logger.log('Travel Form B synced: ' + bounded.length + ' trips.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Idempotently creates all-day Calendar events for current/future trips in TRIPS_RAW
 * (tagged with [LifeOS_TRAVEL] so duplicate events are never created).
 */
function syncUpcomingTripsToCalendar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet() ||
      SpreadsheetApp.openById(TRAVEL_GAS_CFG.SPREADSHEET_ID);
    const tripsSheet = ss.getSheetByName(TRAVEL_GAS_CFG.TRIPS_TAB);
    if (!tripsSheet || tripsSheet.getLastRow() < 2) return;

    const cals = CalendarApp.getCalendarsByName(TRAVEL_GAS_CFG.CALENDAR_NAME);
    const cal = cals.length > 0 ? cals[0] : CalendarApp.getDefaultCalendar();

    const rows = tripsSheet.getRange(2, 1, tripsSheet.getLastRow() - 1, 10).getValues();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let created = 0;

    rows.forEach((r) => {
      const tripName = String(r[1] || '').trim();
      const country = String(r[3] || '').trim();
      const city = String(r[5] || '').trim();
      const startVal = r[6];
      const endVal = r[7];
      if (!tripName || !startVal) return;

      const startDate = startVal instanceof Date ? new Date(startVal) : new Date(String(startVal));
      if (isNaN(startDate.getTime())) return;
      const endDate = endVal ? (endVal instanceof Date ? new Date(endVal) : new Date(String(endVal))) : new Date(startDate);
      if (isNaN(endDate.getTime()) || endDate < today) return;

      // All-day events in Google Calendar use exclusive end date
      const endExclusive = new Date(endDate.getTime() + 86400000);
      const title = '🌍 ' + tripName + (country ? ' (' + country + ')' : '');
      const existing = cal.getEvents(startDate, endExclusive);
      const alreadyExists = existing.some((ev) =>
        ev.getTitle() === title || (ev.getDescription() || '').indexOf(TRAVEL_GAS_CFG.CALENDAR_TAG + ':' + tripName) !== -1
      );

      if (!alreadyExists) {
        cal.createAllDayEvent(title, startDate, endExclusive, {
          location: [city, country].filter(Boolean).join(', '),
          description: TRAVEL_GAS_CFG.CALENDAR_TAG + ':' + tripName,
        });
        created++;
      }
    });

    stampTravelMeta_(ss, 'Last_Calendar_Sync', new Date().toISOString() + ' (+' + created + ' events)');
    Logger.log('Travel Calendar sync complete: +' + created + ' event(s).');
  } finally {
    lock.releaseLock();
  }
}

function stampTravelMeta_(ss, fieldName, value) {
  const meta = ss.getSheetByName(TRAVEL_GAS_CFG.META_TAB);
  if (!meta) return;
  const rows = meta.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === fieldName) {
      meta.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  meta.appendRow([fieldName, value, 'Managed automatically by ID_TRAVEL.gs']);
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) On form submit   -> onTravelFormSubmit
 *   2) Daily at 6:00 AM -> runTravelDailySync
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(TRAVEL_GAS_CFG.SPREADSHEET_ID);
  const managed = new Set([
    TRAVEL_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT,
    TRAVEL_GAS_CFG.TRIGGERS.DAILY_SYNC,
  ]);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (managed.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(TRAVEL_GAS_CFG.TRIGGERS.ON_FORM_SUBMIT)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger(TRAVEL_GAS_CFG.TRIGGERS.DAILY_SYNC)
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  syncTravelReviewDropdown();
  stampTravelMeta_(ss, 'Apps_Script_Trigger_Status', 'ARMED (' + new Date().toISOString() + ')');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Travel Tracker Brick Triggers Armed!\n\n' +
      '• On form submit → onTravelFormSubmit\n' +
      '• Daily 6:00 AM → runTravelDailySync\n' +
      '• Form B Trip dropdown synced.'
    );
  } catch (e) {
    Logger.log('Travel triggers armed (headless run).');
  }
}

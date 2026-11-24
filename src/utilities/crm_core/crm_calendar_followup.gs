/**
 * LifeOS v3.0 — CRM_CORE Google Calendar Follow-Up Reminder Engine
 * =================================================================
 * Bound to: `📇 CRM_CORE` (ID: 1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g)
 *
 * Scans `Google Contacts Sync Master` for any row with a `Next_Follow_Up_Date`
 * (Col BW / 75) where `Follow_Up_Status` (Col BX / 76) is blank or pending
 * (not `[Scheduled]` and not `[Completed]`), creates an idempotent all-day
 * reminder event on your dedicated `Life OS` Google Calendar, and updates
 * `Follow_Up_Status` -> `[Scheduled]`.
 *
 * Trigger Setup:
 *   Attach a daily time-driven trigger calling `scheduleCrmFollowUpsToCalendar()`.
 */

const CRM_FOLLOWUP_TAB = 'Google Contacts Sync Master';
const CRM_CAL_TAG = '[LifeOS_CRM_FOLLOWUP]';

function scheduleCrmFollowUpsToCalendar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_FOLLOWUP_TAB);
  if (!sheet) throw new Error('Missing tab: ' + CRM_FOLLOWUP_TAB);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const calName =
    PropertiesService.getScriptProperties().getProperty('LIFEOS_CALENDAR_NAME') || 'Life OS';
  const cals = CalendarApp.getCalendarsByName(calName);
  const cal = cals.length > 0 ? cals[0] : CalendarApp.createCalendar(calName);

  // Read Contact ID (A), First/Last Name (D:F), Sphere (BQ=69), Social_Tags (BR=70),
  // Next_Follow_Up_Date (BW=75), Follow_Up_Status (BX=76)
  const idNames = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const crmCols = sheet.getRange(2, 69, lastRow - 1, 8).getValues();
  let scheduledCount = 0;

  for (let i = 0; i < crmCols.length; i++) {
    const nextDateRaw = crmCols[i][6]; // Col BW (75 - 69 = 6)
    const status = String(crmCols[i][7] || '').trim(); // Col BX (76 - 69 = 7)
    if (!nextDateRaw) continue;
    if (status === '[Scheduled]' || status === '[Completed]') continue;

    const eventDate = nextDateRaw instanceof Date ? nextDateRaw : new Date(nextDateRaw);
    if (isNaN(eventDate.getTime())) continue;

    const contactId = String(idNames[i][0] || '').trim();
    const displayName = [idNames[i][3], idNames[i][5]].filter(Boolean).join(' ') || 'Contact';
    const sphere = String(crmCols[i][0] || 'Network').trim();
    const tags = String(crmCols[i][1] || '').trim();

    const title = `Follow-Up: ${displayName} [${sphere}]`;
    const desc = [
      `${CRM_CAL_TAG} ContactID: ${contactId}`,
      `Sphere: ${sphere}`,
      tags ? `Tags: ${tags}` : '',
      `CRM Sheet: ${ss.getUrl()}`,
    ].filter(Boolean).join('\n');

    // Idempotency check: avoid duplicating if already created for this contact on this date
    const existing = cal.getEventsForDay(eventDate);
    const alreadyExists = existing.some(
      (ev) => ev.getDescription().indexOf(contactId) !== -1 && ev.getDescription().indexOf(CRM_CAL_TAG) !== -1
    );
    if (!alreadyExists) {
      cal.createAllDayEvent(title, eventDate, { description: desc });
    }

    sheet.getRange(i + 2, 76).setValue('[Scheduled]');
    scheduledCount++;
  }

  Logger.log('Scheduled ' + scheduledCount + ' CRM follow-up reminder(s) on calendar: ' + calName);
}

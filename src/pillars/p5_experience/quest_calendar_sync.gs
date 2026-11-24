/**
 * ============================================================================
 * LIFEOS v3.0 — PILLAR 5: QUEST TARGET DATE CALENDAR SYNC (Law 2)
 * Syncs uncompleted quest Target Completion Dates from RAW_DATA_Quests to the
 * "Life OS" Google Calendar and stamps Calendar_Event_ID (Col P) so events
 * are never duplicated. LockService guarded & batch-capped.
 * ============================================================================
 */

const P5_CAL_CFG = {
  RAW_QUESTS_SS_ID: '1uV7FXlTU--gHFOt7zWYRkDxGk15QXIPGbBcshkk4TVw',
  RAW_TAB: 'Form Responses 1',
  CALENDAR_NAME: 'Life OS',
  MAX_EVENTS_PER_RUN: 50
};

/**
 * Creates all-day milestone deadlines on the "Life OS" Google Calendar for any
 * quest with a valid Target Completion Date and blank Calendar_Event_ID.
 */
function syncQuestTargetsToCalendar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('syncQuestTargetsToCalendar skipped: lock held.');
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(P5_CAL_CFG.RAW_QUESTS_SS_ID);
    const sheet = ss.getSheetByName(P5_CAL_CFG.RAW_TAB);
    if (!sheet || sheet.getLastRow() < 2) return;

    const cals = CalendarApp.getCalendarsByName(P5_CAL_CFG.CALENDAR_NAME);
    const cal = cals.length > 0 ? cals[0] : CalendarApp.getDefaultCalendar();

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
    let created = 0;

    for (let i = 0; i < data.length && created < P5_CAL_CFG.MAX_EVENTS_PER_RUN; i++) {
      const qName = String(data[i][1] || '').trim();
      const desc = String(data[i][2] || '').trim();
      const pillar = String(data[i][3] || '').trim();
      const tier = String(data[i][4] || '').trim();
      const targetRaw = data[i][6];
      const status = String(data[i][13] || '').trim();
      const flags = String(data[i][14] || '').trim();
      const existingEventId = String(data[i][15] || '').trim();

      if (!qName || !targetRaw || existingEventId || status === 'Complete') continue;
      const targetDate = new Date(targetRaw);
      if (isNaN(targetDate.getTime())) continue;

      const glyph = /epic/i.test(tier) ? '🚀' : (/major/i.test(tier) ? '⚔️' : '🎯');
      const ev = cal.createAllDayEvent(
        glyph + ' Quest Target: ' + qName,
        targetDate,
        {
          description:
            'Pillar: ' + pillar + '\n' +
            'Tier: ' + tier + '\n' +
            'Flags: ' + (flags || 'Standard') + '\n\n' +
            desc + '\n\nSource: LifeOS Pillar 5 (Experience & Legacy)'
        }
      );
      sheet.getRange(i + 2, 16).setValue(ev.getId());
      created++;
    }
    Logger.log('syncQuestTargetsToCalendar created ' + created + ' calendar targets.');
  } finally {
    lock.releaseLock();
  }
}

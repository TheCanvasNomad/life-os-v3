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
  if (cData.length > 0) {
    const mirrorCH = cData.map(r => [r[2], r[3], r[4], r[5], r[6], r[7]]);
    cSheet.getRange(2, 3, mirrorCH.length, 6).setValues(mirrorCH);
  }
  if (newDirRows.length > 0) {
    // Only write non-formula columns for newly added rows so Row 2 ARRAYFORMULAs spill cleanly
    const startR = cSheet.getLastRow() + 1;
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

  // Preserve existing manual bio & story notes keyed by Contact_Key
  const manualNotesByKey = {};
  if (nSheet.getLastRow() >= 2) {
    nSheet.getRange(2, 1, nSheet.getLastRow() - 1, 11).getValues().forEach(r => {
      const k = String(r[0] || '').trim();
      if (k && (String(r[9] || '').trim() || String(r[10] || '').trim())) {
        manualNotesByKey[k] = [r[9], r[10]];
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

  const dir = dirSheet.getRange(2, 1, dirSheet.getLastRow() - 1, 16).getValues();
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
    const howMet = String(r[13] || '').trim();
    const linked = linksByCid[cid] || [];

    if (!sphere && !tags && !linked.length && !org && !bday && !manualNotesByKey[key]) return;

    const rollup = [];
    if (org) rollup.push('Org: ' + org);
    if (country) rollup.push('Country: ' + country);
    if (linked.length) rollup.push(linked.join(' | '));
    const saved = manualNotesByKey[key] || ['', ''];

    out.push([key, fullName, sphere, tags, status, country, org, howMet, rollup.join(' • '), saved[0], saved[1]]);
  });

  if (nSheet.getLastRow() >= 2) {
    nSheet.getRange(2, 1, nSheet.getLastRow() - 1, 11).clearContent();
  }
  if (out.length > 0) {
    nSheet.getRange(2, 1, out.length, 11).setValues(out);
  }
  Logger.log('syncCoreCRMToNotebookLM refreshed ' + out.length + ' lean AI profiles.');
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

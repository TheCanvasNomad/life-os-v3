/**
 * LifeOS v3.0 — CRM_CORE Two-Way Google Contacts Sync Engine (People API v1)
 * ===========================================================================
 * Bound to: `📇 CRM_CORE` (ID: 1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g)
 * Master Tab: `Google Contacts Sync Master`
 *
 * Prerequisites (Apps Script):
 *   1. Open Extensions -> Apps Script inside `📇 CRM_CORE`.
 *   2. Click Services (+) -> Add `People API` (Identifier: `People`, Version: `v1`).
 *   3. Run `runTwoWayContactsSync()` manually from the custom menu or attach an
 *      hourly/daily time-driven trigger.
 *
 * Features:
 *   - Loop-free two-way sync guarded by `Sync_Direction_Lock` (Col BY) and
 *     deterministic SHA-256 `Sync_Hash` (Col BZ).
 *   - Pull (Google Contacts -> Sheet): Uses `syncToken` incremental pagination,
 *     automatically parses `[Flag] [Name] (Age) [Emojis]` naming patterns into
 *     `Country_Origin`, `LifeOS_Sphere`, and `Social_Tags`, maps Google Contact
 *     Group Labels <-> `Social_Tags` / `LifeOS_Sphere`, and updates rows strictly
 *     when `Google_Modified > Last_Synced_Sheet`.
 *   - Push (Sheet -> Google Contacts): Detects rows where `Sheet_Modified >
 *     Last_Synced_Google` (and `Sync_Hash` changed), pushes updated names, phone
 *     numbers, notes, birthdays via `People.People.updateContact`, and reconciles
 *     Google Contact Group Labels via `People.ContactGroups.Members.modify`.
 */

const CRM_MASTER_TAB = 'Google Contacts Sync Master';
const SYNC_TOKEN_PROP = 'PEOPLE_API_SYNC_TOKEN';
const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,birthdays,biographies,memberships,metadata,organizations';

// Exact 1-based column indices in `Google Contacts Sync Master`
const COL = {
  CONTACT_ID: 1,         // A
  LAST_UPD_SHEET: 2,     // B
  LAST_UPD_GOOGLE: 3,    // C
  FIRST_NAME: 4,         // D
  MIDDLE_NAME: 5,        // E
  LAST_NAME: 6,          // F
  BIRTHDAY: 17,          // Q
  NOTES: 18,             // R
  LABELS: 20,            // T
  EMAIL_1: 22,           // V
  PHONE_1_LABEL: 27,     // AA (adjust automatically via header lookup below)
  SPHERE: 69,            // BQ: LifeOS_Sphere
  SOCIAL_TAGS: 70,       // BR: Social_Tags
  REL_STATUS: 71,        // BS: Relationship_Status
  HOW_MET: 72,           // BT: How_Met
  COUNTRY_ORIGIN: 73,    // BU: Country_Origin
  LAST_CONTACTED: 74,    // BV: Last_Contacted_Date
  NEXT_FOLLOWUP: 75,     // BW: Next_Follow_Up_Date
  FOLLOWUP_STATUS: 76,   // BX: Follow_Up_Status
  SYNC_LOCK: 77,         // BY: Sync_Direction_Lock
  SYNC_HASH: 78,         // BZ: Sync_Hash
};

// Emoji & label heuristics for `[Flag] [Name] (Age) [Emojis]` parsing
const SPHERE_EMOJI_MAP = [
  { pattern: /❤️|💘|😍|🔥|💋|🌹|🍑|🍆/, sphere: 'Love Life', tag: 'Dating' },
  { pattern: /⚓|🚢|⛵|🛳️|🧭/, sphere: 'Maritime & Crew', tag: 'Worked_With' },
  { pattern: /✈️|🌍|🗺️|🏖️|🧳/, sphere: 'Travel Acquaintance', tag: 'Traveled_With' },
  { pattern: /💼|🏢|🤝|💻/, sphere: 'Professional', tag: 'Worked_With' },
  { pattern: /🏠|👨‍👩‍👧|👪|🧬/, sphere: 'Family', tag: 'Inner_Circle' },
  { pattern: /⭐|👑|🛡️|💯/, sphere: 'Friendship', tag: 'Inner_Circle' },
];

const LABEL_TO_SPHERE = {
  'love life': 'Love Life',
  'dating': 'Love Life',
  'intimate': 'Love Life',
  'family': 'Family',
  'inner_circle': 'Friendship',
  'inner circle': 'Friendship',
  'friends': 'Friendship',
  'friendship': 'Friendship',
  'maritime': 'Maritime & Crew',
  'maritime & crew': 'Maritime & Crew',
  'crew': 'Maritime & Crew',
  'work': 'Professional',
  'professional': 'Professional',
  'mentor': 'Professional',
  'travel': 'Travel Acquaintance',
  'traveled_with': 'Travel Acquaintance',
};

const LIFEOS_SOCIAL_TAGS = [
  'Traveled_With', 'Worked_With', 'Dating', 'Intimate', 'Inner_Circle', 'Mentor', 'Legacy',
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📇 LifeOS CRM_CORE')
    .addItem('Run Two-Way Google Contacts Sync', 'runTwoWayContactsSync')
    .addItem('Pull Only (Google Contacts -> Sheet)', 'pullGoogleContactsToSheet')
    .addItem('Push Only (Sheet -> Google Contacts)', 'pushSheetEditsToGoogleContacts')
    .addItem('Classify Existing Contacts from Emoji/Labels', 'classifyExistingContactsLocally')
    .addItem('Reset Sync Token (Full Rescan)', 'resetPeopleSyncToken')
    .addToUi();
}

function resetPeopleSyncToken() {
  PropertiesService.getScriptProperties().deleteProperty(SYNC_TOKEN_PROP);
  Logger.log('Cleared PEOPLE_API_SYNC_TOKEN. Next Pull will perform a full incremental seed.');
}

function runTwoWayContactsSync() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const pulled = pullGoogleContactsToSheet();
    const pushed = pushSheetEditsToGoogleContacts();
    Logger.log('Two-way sync complete: ' + JSON.stringify({ pulled, pushed }));
  } finally {
    lock.releaseLock();
  }
}

/**
 * PULL: Google Contacts -> CRM_CORE Master Sheet (`people.connections.list` with syncToken).
 */
function pullGoogleContactsToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_MASTER_TAB);
  if (!sheet) throw new Error('Missing tab: ' + CRM_MASTER_TAB);

  const hdrMap = getHeaderMap_(sheet);
  const groupMap = fetchContactGroupMap_();
  const props = PropertiesService.getScriptProperties();
  let syncToken = props.getProperty(SYNC_TOKEN_PROP);

  const rowIndexById = buildContactRowIndex_(sheet);
  let pageToken = null;
  let newSyncToken = null;
  let inserted = 0;
  let updated = 0;
  const nowIso = new Date().toISOString();

  do {
    const params = {
      personFields: PERSON_FIELDS,
      pageSize: 500,
      requestSyncToken: true,
    };
    if (syncToken) params.syncToken = syncToken;
    if (pageToken) params.pageToken = pageToken;

    let resp;
    try {
      resp = People.People.Connections.list('people/me', params);
    } catch (e) {
      if (String(e).indexOf('EXPIRED_SYNC_TOKEN') !== -1 || String(e).indexOf('410') !== -1) {
        props.deleteProperty(SYNC_TOKEN_PROP);
        syncToken = null;
        delete params.syncToken;
        resp = People.People.Connections.list('people/me', params);
      } else {
        throw e;
      }
    }

    const connections = resp.connections || [];
    connections.forEach((person) => {
      const resourceName = person.resourceName;
      if (!resourceName) return;
      if (person.metadata && person.metadata.deleted) return;

      const googleUpdated = extractGoogleUpdateTime_(person) || nowIso;
      const existingRowNum = rowIndexById[resourceName];

      const nameObj = (person.names && person.names[0]) || {};
      const firstName = nameObj.givenName || '';
      const middleName = nameObj.middleName || '';
      const lastName = nameObj.familyName || '';
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      const notes = (person.biographies && person.biographies[0] && person.biographies[0].value) || '';
      const birthday = formatBirthday_(person.birthdays && person.birthdays[0]);
      const phone1 = (person.phoneNumbers && person.phoneNumbers[0] && person.phoneNumbers[0].value) || '';
      const email1 = (person.emailAddresses && person.emailAddresses[0] && person.emailAddresses[0].value) || '';
      const labelsList = extractGroupNames_(person, groupMap);
      const parsed = parseEmojiPatternAndLabels_(fullName, labelsList);

      if (existingRowNum) {
        const rowRange = sheet.getRange(existingRowNum, 1, 1, 78);
        const rowVals = rowRange.getValues()[0];
        const syncLock = String(rowVals[COL.SYNC_LOCK - 1] || '').trim().toUpperCase();
        if (syncLock === 'PUSH_ONLY' || syncLock === 'LOCKED') return;

        const sheetUpd = rowVals[COL.LAST_UPD_SHEET - 1];
        if (sheetUpd && new Date(googleUpdated) <= new Date(sheetUpd)) {
          return; // Sheet is newer -> leave for Push phase
        }

        rowVals[COL.LAST_UPD_GOOGLE - 1] = googleUpdated;
        rowVals[COL.FIRST_NAME - 1] = firstName;
        rowVals[COL.MIDDLE_NAME - 1] = middleName;
        rowVals[COL.LAST_NAME - 1] = lastName;
        if (birthday) rowVals[COL.BIRTHDAY - 1] = birthday;
        if (notes) rowVals[COL.NOTES - 1] = notes;
        rowVals[COL.LABELS - 1] = labelsList.join(' ::: ');
        if (hdrMap['E-mail 1 - Value'] && email1) rowVals[hdrMap['E-mail 1 - Value'] - 1] = email1;
        if (hdrMap['Phone 1 - Value'] && phone1) rowVals[hdrMap['Phone 1 - Value'] - 1] = phone1;

        // Non-destructively enrich v3.0 CRM columns if blank
        if (!rowVals[COL.SPHERE - 1] && parsed.sphere) rowVals[COL.SPHERE - 1] = parsed.sphere;
        if (parsed.tags.length > 0) {
          rowVals[COL.SOCIAL_TAGS - 1] = mergeCsv_(rowVals[COL.SOCIAL_TAGS - 1], parsed.tags);
        }
        if (!rowVals[COL.COUNTRY_ORIGIN - 1] && parsed.country) rowVals[COL.COUNTRY_ORIGIN - 1] = parsed.country;

        rowVals[COL.SYNC_HASH - 1] = computeRowHash_(rowVals, hdrMap);
        rowVals[COL.LAST_UPD_SHEET - 1] = googleUpdated;
        rowRange.setValues([rowVals]);
        updated++;
      } else {
        const newRow = new Array(78).fill('');
        newRow[COL.CONTACT_ID - 1] = resourceName;
        newRow[COL.LAST_UPD_SHEET - 1] = googleUpdated;
        newRow[COL.LAST_UPD_GOOGLE - 1] = googleUpdated;
        newRow[COL.FIRST_NAME - 1] = firstName;
        newRow[COL.MIDDLE_NAME - 1] = middleName;
        newRow[COL.LAST_NAME - 1] = lastName;
        newRow[COL.BIRTHDAY - 1] = birthday;
        newRow[COL.NOTES - 1] = notes;
        newRow[COL.LABELS - 1] = labelsList.join(' ::: ');
        if (hdrMap['E-mail 1 - Value']) newRow[hdrMap['E-mail 1 - Value'] - 1] = email1;
        if (hdrMap['Phone 1 - Value']) newRow[hdrMap['Phone 1 - Value'] - 1] = phone1;
        newRow[COL.SPHERE - 1] = parsed.sphere;
        newRow[COL.SOCIAL_TAGS - 1] = parsed.tags.join(', ');
        newRow[COL.REL_STATUS - 1] = parsed.sphere ? 'Active' : '';
        newRow[COL.COUNTRY_ORIGIN - 1] = parsed.country;
        newRow[COL.SYNC_HASH - 1] = computeRowHash_(newRow, hdrMap);
        sheet.appendRow(newRow);
        rowIndexById[resourceName] = sheet.getLastRow();
        inserted++;
      }
    });

    pageToken = resp.nextPageToken || null;
    if (resp.nextSyncToken) newSyncToken = resp.nextSyncToken;
  } while (pageToken);

  if (newSyncToken) props.setProperty(SYNC_TOKEN_PROP, newSyncToken);
  return { inserted, updated };
}

/**
 * PUSH: Sheet -> Google Contacts (`People.People.updateContact` & `ContactGroups.Members.modify`).
 */
function pushSheetEditsToGoogleContacts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_MASTER_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { pushed: 0 };

  const hdrMap = getHeaderMap_(sheet);
  const groupNameToResource = fetchContactGroupMap_(true);
  const values = sheet.getRange(2, 1, lastRow - 1, 78).getValues();
  let pushed = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const resourceName = String(row[COL.CONTACT_ID - 1] || '').trim();
    if (!resourceName.startsWith('people/')) continue;

    const syncLock = String(row[COL.SYNC_LOCK - 1] || '').trim().toUpperCase();
    if (syncLock === 'PULL_ONLY' || syncLock === 'LOCKED') continue;

    const sheetUpd = row[COL.LAST_UPD_SHEET - 1];
    const googleUpd = row[COL.LAST_UPD_GOOGLE - 1];
    const currentHash = computeRowHash_(row, hdrMap);
    const storedHash = String(row[COL.SYNC_HASH - 1] || '').trim();

    const sheetIsNewer = sheetUpd && (!googleUpd || new Date(sheetUpd) > new Date(googleUpd));
    const hashChanged = storedHash && currentHash !== storedHash;
    if (!sheetIsNewer && !hashChanged) continue;

    try {
      const livePerson = People.People.get(resourceName, { personFields: PERSON_FIELDS });
      const patch = {
        etag: livePerson.etag,
        names: [{
          givenName: String(row[COL.FIRST_NAME - 1] || ''),
          middleName: String(row[COL.MIDDLE_NAME - 1] || ''),
          familyName: String(row[COL.LAST_NAME - 1] || ''),
        }],
      };
      const updateFields = ['names'];

      const notesVal = String(row[COL.NOTES - 1] || '');
      if (notesVal) {
        patch.biographies = [{ value: notesVal, contentType: 'TEXT_PLAIN' }];
        updateFields.push('biographies');
      }

      const phoneCol = hdrMap['Phone 1 - Value'];
      if (phoneCol && row[phoneCol - 1]) {
        patch.phoneNumbers = [{ value: String(row[phoneCol - 1]) }];
        updateFields.push('phoneNumbers');
      }

      const bdayObj = parseBirthdayObj_(row[COL.BIRTHDAY - 1]);
      if (bdayObj) {
        patch.birthdays = [{ date: bdayObj }];
        updateFields.push('birthdays');
      }

      const updatedPerson = People.People.updateContact(patch, resourceName, {
        updatePersonFields: updateFields.join(','),
      });

      // Sync LifeOS_Sphere & Social_Tags back to Google Contact Group Labels
      const desiredGroups = [];
      if (row[COL.SPHERE - 1]) desiredGroups.push(String(row[COL.SPHERE - 1]).trim());
      String(row[COL.SOCIAL_TAGS - 1] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((tag) => desiredGroups.push(tag));

      desiredGroups.forEach((gName) => {
        const gRes = ensureContactGroup_(gName, groupNameToResource);
        if (gRes) {
          People.ContactGroups.Members.modify(
            { resourceNamesToAdd: [resourceName] },
            gRes
          );
        }
      });

      const syncedIso = extractGoogleUpdateTime_(updatedPerson) || new Date().toISOString();
      sheet.getRange(i + 2, COL.LAST_UPD_SHEET, 1, 2).setValues([[syncedIso, syncedIso]]);
      sheet.getRange(i + 2, COL.SYNC_HASH).setValue(currentHash);
      pushed++;
    } catch (err) {
      Logger.log('Push failed for ' + resourceName + ': ' + err);
    }
  }
  return { pushed };
}

/**
 * Local classifier: parses `[Flag] [Name] (Age) [Emojis]` and existing `Labels`
 * across all existing contacts in `Google Contacts Sync Master` without API writes.
 */
function classifyExistingContactsLocally() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_MASTER_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const hdrMap = getHeaderMap_(sheet);
  const range = sheet.getRange(2, 1, lastRow - 1, 78);
  const vals = range.getValues();
  let classified = 0;

  for (let i = 0; i < vals.length; i++) {
    const r = vals[i];
    const fullName = [r[COL.FIRST_NAME - 1], r[COL.MIDDLE_NAME - 1], r[COL.LAST_NAME - 1]].filter(Boolean).join(' ');
    const labels = String(r[COL.LABELS - 1] || '').split(/:::|,/).map((s) => s.trim()).filter(Boolean);
    const parsed = parseEmojiPatternAndLabels_(fullName, labels);
    let touched = false;

    if (!r[COL.SPHERE - 1] && parsed.sphere) { r[COL.SPHERE - 1] = parsed.sphere; touched = true; }
    if (parsed.tags.length > 0) {
      const merged = mergeCsv_(r[COL.SOCIAL_TAGS - 1], parsed.tags);
      if (merged !== r[COL.SOCIAL_TAGS - 1]) { r[COL.SOCIAL_TAGS - 1] = merged; touched = true; }
    }
    if (!r[COL.COUNTRY_ORIGIN - 1] && parsed.country) { r[COL.COUNTRY_ORIGIN - 1] = parsed.country; touched = true; }
    if (!r[COL.SYNC_HASH - 1]) { r[COL.SYNC_HASH - 1] = computeRowHash_(r, hdrMap); }
    if (touched) classified++;
  }
  range.setValues(vals);
  Logger.log('Classified ' + classified + ' existing contacts from flag/emoji/label metadata.');
}

/**
 * Automatic onEdit timestamp stamp so Push detects manual edits in CRM_CORE.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CRM_MASTER_TAB) return;
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row >= 2 && col >= 4 && col <= 76) {
    sheet.getRange(row, COL.LAST_UPD_SHEET).setValue(new Date().toISOString());
  }
}

// --- Helpers ---
function parseEmojiPatternAndLabels_(fullName, labelsList) {
  let sphere = '';
  const tags = [];
  let country = extractCountryFromFlagEmoji_(fullName);

  labelsList.forEach((lbl) => {
    const low = lbl.toLowerCase().trim();
    if (!sphere && LABEL_TO_SPHERE[low]) sphere = LABEL_TO_SPHERE[low];
    LIFEOS_SOCIAL_TAGS.forEach((st) => {
      if (low === st.toLowerCase() || low === st.replace('_', ' ').toLowerCase()) tags.push(st);
    });
  });

  SPHERE_EMOJI_MAP.forEach((rule) => {
    if (rule.pattern.test(fullName)) {
      if (!sphere) sphere = rule.sphere;
      if (rule.tag) tags.push(rule.tag);
    }
  });

  return { sphere, tags: Array.from(new Set(tags)), country };
}

function extractCountryFromFlagEmoji_(text) {
  const m = String(text || '').match(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/);
  if (!m) return '';
  const flag = m[0];
  const cp1 = flag.codePointAt(0) - 0x1F1E6 + 65;
  const cp2 = flag.codePointAt(2) - 0x1F1E6 + 65;
  return String.fromCharCode(cp1, cp2); // ISO-2 country code (e.g., US, CO, DO, JP)
}

function computeRowHash_(rowVals, hdrMap) {
  const phoneIdx = (hdrMap['Phone 1 - Value'] || 28) - 1;
  const canonical = [
    rowVals[COL.FIRST_NAME - 1],
    rowVals[COL.LAST_NAME - 1],
    rowVals[COL.BIRTHDAY - 1],
    rowVals[COL.NOTES - 1],
    rowVals[phoneIdx],
    rowVals[COL.SPHERE - 1],
    rowVals[COL.SOCIAL_TAGS - 1],
    rowVals[COL.REL_STATUS - 1],
  ].map((v) => String(v || '').trim()).join('|');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical);
  return bytes.map((b) => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('').slice(0, 16);
}

function getHeaderMap_(sheet) {
  const hdrs = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  hdrs.forEach((h, i) => { if (h) map[String(h).trim()] = i + 1; });
  return map;
}

function buildContactRowIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const idx = {};
  if (lastRow < 2) return idx;
  const ids = sheet.getRange(2, COL.CONTACT_ID, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i][0] || '').trim();
    if (id) idx[id] = i + 2;
  }
  return idx;
}

function fetchContactGroupMap_(byName) {
  const map = {};
  const resp = People.ContactGroups.list({ pageSize: 200 });
  (resp.contactGroups || []).forEach((g) => {
    if (byName) map[g.name.toLowerCase()] = g.resourceName;
    else map[g.resourceName] = g.name;
  });
  return map;
}

function ensureContactGroup_(groupName, nameToResourceMap) {
  const key = groupName.toLowerCase();
  if (nameToResourceMap[key]) return nameToResourceMap[key];
  try {
    const created = People.ContactGroups.create({ contactGroup: { name: groupName } });
    nameToResourceMap[key] = created.resourceName;
    return created.resourceName;
  } catch (e) {
    return null;
  }
}

function extractGroupNames_(person, groupMap) {
  const names = [];
  (person.memberships || []).forEach((m) => {
    const res = m.contactGroupMembership && m.contactGroupMembership.contactGroupResourceName;
    if (res && groupMap[res] && groupMap[res] !== 'myContacts') names.push(groupMap[res]);
  });
  return names;
}

function extractGoogleUpdateTime_(person) {
  const sources = (person.metadata && person.metadata.sources) || [];
  for (let i = 0; i < sources.length; i++) {
    if (sources[i].updateTime) return sources[i].updateTime;
  }
  return '';
}

function formatBirthday_(bday) {
  if (!bday || !bday.date) return '';
  const d = bday.date;
  const y = d.year ? String(d.year) : '0000';
  const m = ('0' + (d.month || 1)).slice(-2);
  const day = ('0' + (d.day || 1)).slice(-2);
  return `${y}-${m}-${day}`;
}

function parseBirthdayObj_(raw) {
  if (!raw) return null;
  if (raw instanceof Date) {
    return { year: raw.getFullYear(), month: raw.getMonth() + 1, day: raw.getDate() };
  }
  const m = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function mergeCsv_(existing, newItems) {
  const set = new Set(String(existing || '').split(',').map((s) => s.trim()).filter(Boolean));
  newItems.forEach((item) => set.add(item));
  return Array.from(set).join(', ');
}

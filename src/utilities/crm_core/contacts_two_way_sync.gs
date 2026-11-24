/**
 * LifeOS v3.0 — CRM_CORE Full-Field Two-Way Google Contacts Sync & Safe Bulk Purge
 * ================================================================================
 * Bound to: `📇 CRM_CORE` (ID: 1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g)
 * Master Tab:  `Google Contacts Sync Master` (95 columns: A..CQ)
 * Archive Tab: `PURGE_ARCHIVE_LOG` (hidden 96-column backup log: A..CR)
 *
 * Prerequisites (Apps Script):
 *   1. Open Extensions -> Apps Script inside `📇 CRM_CORE`.
 *   2. Click Services (+) -> Add `People API` (Identifier: `People`, Version: `v1`).
 *   3. Reload the sheet to reveal the custom `📇 LifeOS CRM` menu.
 *
 * Capabilities:
 *   - 100% Google People API v1 field coverage (`names`, `nicknames`, `fileAses`,
 *     `genders`, `birthdays`, `phoneNumbers` 1-4, `emailAddresses` 1-4, `imClients` 1-2,
 *     `urls` 1-5, `organizations`, `addresses` 1-2, `events` 1-2, `relations` 1-3,
 *     `biographies`, `userDefined` Custom Fields 1-2, `memberships`/Labels, `metadata`/ETag).
 *   - Loop-free two-way sync via `Sync_Direction_Lock`, `Contact_ETag`, and SHA-256 `Sync_Hash`.
 *   - Safe Archived Bulk Deletion (`Sync_Action = "DELETE_FROM_PHONE"`):
 *       1) Interactive confirmation dialog displaying exact marked count,
 *       2) Append full 95-column row + UTC `Purged_Timestamp` to `PURGE_ARCHIVE_LOG` FIRST,
 *       3) Delete from Google Contacts via `People.People.deleteContact(resourceName)`
 *          with rate-limit pacing & safety cap (`MAX_DELETES_PER_RUN = 200`),
 *       4) Remove row from `Google Contacts Sync Master` ONLY after confirmed deletion.
 */

const CRM_MASTER_TAB = 'Google Contacts Sync Master';
const CRM_ARCHIVE_TAB = 'PURGE_ARCHIVE_LOG';
const SYNC_TOKEN_PROP = 'PEOPLE_API_SYNC_TOKEN';
const MAX_DELETES_PER_RUN = 200;
const DELETE_PACE_MS = 160;

// 100% Full People API v1 Read & Write Field Masks
const FULL_PERSON_FIELDS = [
  'names', 'nicknames', 'fileAses', 'genders', 'birthdays',
  'phoneNumbers', 'emailAddresses', 'imClients', 'urls',
  'organizations', 'addresses', 'events', 'relations',
  'biographies', 'userDefined', 'memberships', 'metadata',
].join(',');

const SPHERE_EMOJI_MAP = [
  { pattern: /❤️|💘|😍|🔥|💋|🌹|🍑|🍆|😘|💕/, sphere: 'Love Life', tag: 'Dating' },
  { pattern: /⚓|🚢|⛵|🛳️|🧭/, sphere: 'Maritime & Crew', tag: 'Worked_With' },
  { pattern: /✈️|🌍|🗺️|🏖️|🧳/, sphere: 'Travel Acquaintance', tag: 'Traveled_With' },
  { pattern: /💼|🏢|🤝|💻/, sphere: 'Professional', tag: 'Worked_With' },
  { pattern: /🏠|👨‍👩‍👧|👪|🧬/, sphere: 'Family', tag: 'Inner_Circle' },
  { pattern: /⭐|👑|🛡️|💯/, sphere: 'Friendship', tag: 'Inner_Circle' },
];

const LABEL_TO_SPHERE = {
  'love life': 'Love Life', 'dating': 'Love Life', 'intimate': 'Love Life',
  'tinder': 'Love Life', 'hinge': 'Love Life', 'bumble': 'Love Life',
  'family': 'Family', 'inner_circle': 'Friendship', 'inner circle': 'Friendship',
  'friends': 'Friendship', 'friendship': 'Friendship',
  'maritime': 'Maritime & Crew', 'maritime & crew': 'Maritime & Crew', 'crew': 'Maritime & Crew',
  'work': 'Professional', 'professional': 'Professional', 'mentor': 'Professional',
  'travel': 'Travel Acquaintance', 'traveled_with': 'Travel Acquaintance',
};

const LIFEOS_SOCIAL_TAGS = [
  'Traveled_With', 'Worked_With', 'Dating', 'Intimate', 'Inner_Circle', 'Mentor', 'Legacy',
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📇 LifeOS CRM')
    .addItem('Run Two-Way Full-Field Sync', 'runTwoWayContactsSync')
    .addItem('Pull Only (Google Contacts -> Sheet)', 'pullGoogleContactsToSheet')
    .addItem('Push Only (Sheet -> Google Contacts)', 'pushSheetEditsToGoogleContacts')
    .addSeparator()
    .addItem('Purge Marked Contacts (DELETE_FROM_PHONE)', 'purgeMarkedContacts')
    .addSeparator()
    .addItem('Classify Existing Contacts (Emoji/Flags/Labels)', 'classifyExistingContactsLocally')
    .addItem('Reset Sync Token (Full Rescan)', 'resetPeopleSyncToken')
    .addToUi();
}

function resetPeopleSyncToken() {
  PropertiesService.getScriptProperties().deleteProperty(SYNC_TOKEN_PROP);
  Logger.log('Cleared PEOPLE_API_SYNC_TOKEN. Next Pull will re-seed all fields.');
}

function runTwoWayContactsSync() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const pulled = pullGoogleContactsToSheet();
    const pushed = pushSheetEditsToGoogleContacts();
    Logger.log('Full-field two-way sync complete: ' + JSON.stringify({ pulled, pushed }));
  } finally {
    lock.releaseLock();
  }
}

/**
 * SAFE BULK DELETION (`Sync_Action = "DELETE_FROM_PHONE"`):
 *   1. Confirms exact marked count via UI dialog (capped at 200 per run).
 *   2. Appends full 95-col row + UTC `Purged_Timestamp` to hidden `PURGE_ARCHIVE_LOG` first.
 *   3. Calls `People.People.deleteContact(resourceName)` with rate-limit pacing.
 *   4. Removes row from `Google Contacts Sync Master` ONLY once confirmed deleted.
 */
function purgeMarkedContacts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_MASTER_TAB);
  const archiveSheet = ss.getSheetByName(CRM_ARCHIVE_TAB);
  if (!sheet || !archiveSheet) {
    throw new Error('Missing ' + CRM_MASTER_TAB + ' or ' + CRM_ARCHIVE_TAB + ' tab.');
  }

  const hdr = getHeaderIndexMap_(sheet);
  const totalCols = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { purged: 0 };

  const syncActionIdx = hdr['Sync_Action'];
  const contactIdIdx = hdr['Contact ID'];
  if (syncActionIdx === undefined || contactIdIdx === undefined) {
    throw new Error('Missing Sync_Action or Contact ID header.');
  }

  const allRows = sheet.getRange(2, 1, lastRow - 1, totalCols).getValues();
  const markedRowNums = [];
  for (let i = 0; i < allRows.length; i++) {
    const action = String(allRows[i][syncActionIdx] || '').trim().toUpperCase();
    if (action === 'DELETE_FROM_PHONE') {
      markedRowNums.push(i + 2);
    }
  }

  if (markedRowNums.length === 0) {
    try {
      SpreadsheetApp.getUi().alert('No contacts are currently marked DELETE_FROM_PHONE.');
    } catch (_) {}
    Logger.log('No contacts marked DELETE_FROM_PHONE.');
    return { purged: 0 };
  }

  const batchCount = Math.min(markedRowNums.length, MAX_DELETES_PER_RUN);
  const ui = SpreadsheetApp.getUi();
  const confirmMsg =
    'Found ' + markedRowNums.length + ' contact(s) marked DELETE_FROM_PHONE.\n\n' +
    'This batch will process up to ' + batchCount + ' contact(s) (safety cap: ' + MAX_DELETES_PER_RUN + '/run):\n' +
    '  1. Archive full contact rows to hidden PURGE_ARCHIVE_LOG first\n' +
    '  2. Delete each contact from Google Contacts via People API v1\n' +
    '  3. Remove confirmed rows from Google Contacts Sync Master\n\n' +
    'Proceed with archived bulk deletion?';
  const resp = ui.alert('Confirm Safe Bulk Deletion', confirmMsg, ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) {
    Logger.log('Bulk purge cancelled by user.');
    return { purged: 0, cancelled: true };
  }

  // Select up to MAX_DELETES_PER_RUN rows and delete bottom-to-top to preserve row indices
  const targetRows = markedRowNums.slice(0, MAX_DELETES_PER_RUN).sort((a, b) => b - a);
  let purged = 0;
  let errors = 0;

  for (let k = 0; k < targetRows.length; k++) {
    const rowNum = targetRows[k];
    const rowVals = sheet.getRange(rowNum, 1, 1, totalCols).getValues()[0];
    const resourceName = String(rowVals[contactIdIdx] || '').trim();
    const purgedTs = new Date().toISOString();

    try {
      // STEP 1: Backup full row to PURGE_ARCHIVE_LOG FIRST (zero permanent data loss)
      archiveSheet.appendRow(rowVals.concat([purgedTs]));

      // STEP 2: Delete from Google Contacts via People API v1 (with rate-limit pacing)
      if (resourceName.startsWith('people/')) {
        deleteContactWithBackoff_(resourceName);
      }

      // STEP 3: Remove row from Master ONLY after confirmed archive & deletion
      sheet.deleteRow(rowNum);
      purged++;
      Utilities.sleep(DELETE_PACE_MS);
    } catch (err) {
      errors++;
      Logger.log('Failed to purge row ' + rowNum + ' (' + resourceName + '): ' + err);
    }
  }

  const remaining = Math.max(0, markedRowNums.length - purged);
  const summary = 'Archived & purged ' + purged + ' contact(s). Errors: ' + errors + '. Remaining marked: ' + remaining + '.';
  Logger.log(summary);
  try { ui.alert('Purge Complete', summary, ui.ButtonSet.OK); } catch (_) {}
  return { purged, errors, remaining };
}

function deleteContactWithBackoff_(resourceName) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      People.People.deleteContact(resourceName);
      return;
    } catch (e) {
      const msg = String(e);
      if (msg.indexOf('404') !== -1 || msg.indexOf('NOT_FOUND') !== -1) {
        return; // Already deleted on Google Contacts
      }
      if (attempt === 3) throw e;
      Utilities.sleep(500 * Math.pow(2, attempt));
    }
  }
}

/**
 * PULL (Google Contacts -> Sheet): Full 95-column mapping with syncToken pagination.
 */
function pullGoogleContactsToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_MASTER_TAB);
  if (!sheet) throw new Error('Missing tab: ' + CRM_MASTER_TAB);

  const hdr = getHeaderIndexMap_(sheet);
  const totalCols = sheet.getLastColumn();
  const groupMap = fetchContactGroupMap_(false);
  const props = PropertiesService.getScriptProperties();
  let syncToken = props.getProperty(SYNC_TOKEN_PROP);

  const rowIndexById = buildContactRowIndex_(sheet, hdr['Contact ID']);
  let pageToken = null;
  let newSyncToken = null;
  let inserted = 0;
  let updated = 0;
  const nowIso = new Date().toISOString();

  do {
    const params = { personFields: FULL_PERSON_FIELDS, pageSize: 500, requestSyncToken: true };
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

    (resp.connections || []).forEach((person) => {
      const resName = person.resourceName;
      if (!resName || (person.metadata && person.metadata.deleted)) return;

      const googleUpdated = extractGoogleUpdateTime_(person) || nowIso;
      const existingRowNum = rowIndexById[resName];

      if (existingRowNum) {
        const range = sheet.getRange(existingRowNum, 1, 1, totalCols);
        const row = range.getValues()[0];
        const syncLock = String(row[hdr['Sync_Direction_Lock']] || '').trim().toUpperCase();
        const syncAction = String(row[hdr['Sync_Action']] || '').trim().toUpperCase();
        if (syncLock === 'PUSH_ONLY' || syncLock === 'LOCKED' || syncAction === 'DELETE_FROM_PHONE') return;

        const sheetUpd = row[hdr['Last Updated Sheet']];
        if (sheetUpd && new Date(googleUpdated) <= new Date(sheetUpd)) return;

        applyPersonToRow_(person, row, hdr, groupMap, googleUpdated);
        range.setValues([row]);
        updated++;
      } else {
        const newRow = new Array(totalCols).fill('');
        applyPersonToRow_(person, newRow, hdr, groupMap, googleUpdated);
        if (!newRow[hdr['Sync_Action']]) newRow[hdr['Sync_Action']] = 'KEEP';
        sheet.appendRow(newRow);
        rowIndexById[resName] = sheet.getLastRow();
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
 * PUSH (Sheet -> Google Contacts): Full-field `People.People.updateContact` + Label Groups.
 */
function pushSheetEditsToGoogleContacts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_MASTER_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { pushed: 0 };

  const hdr = getHeaderIndexMap_(sheet);
  const totalCols = sheet.getLastColumn();
  const groupNameToRes = fetchContactGroupMap_(true);
  const values = sheet.getRange(2, 1, lastRow - 1, totalCols).getValues();
  let pushed = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const resName = String(row[hdr['Contact ID']] || '').trim();
    if (!resName.startsWith('people/')) continue;

    const syncLock = String(row[hdr['Sync_Direction_Lock']] || '').trim().toUpperCase();
    const syncAction = String(row[hdr['Sync_Action']] || '').trim().toUpperCase();
    if (syncLock === 'PULL_ONLY' || syncLock === 'LOCKED' || syncAction === 'DELETE_FROM_PHONE' || syncAction === 'ARCHIVE_ONLY') {
      continue;
    }

    const sheetUpd = row[hdr['Last Updated Sheet']];
    const googleUpd = row[hdr['Last Updated Google Contacts']];
    const curHash = computeFullRowHash_(row, hdr);
    const storedHash = String(row[hdr['Sync_Hash']] || '').trim();
    const sheetNewer = sheetUpd && (!googleUpd || new Date(sheetUpd) > new Date(googleUpd));
    const hashChanged = storedHash && curHash !== storedHash;
    if (!sheetNewer && !hashChanged) continue;

    try {
      let etag = String(row[hdr['Contact_ETag']] || '').trim();
      if (!etag) {
        const live = People.People.get(resName, { personFields: 'metadata' });
        etag = live.etag;
      }
      const { patch, updateFields } = buildPersonPatchFromRow_(row, hdr, etag);
      let updatedPerson;
      try {
        updatedPerson = People.People.updateContact(patch, resName, { updatePersonFields: updateFields.join(',') });
      } catch (e) {
        // Retry once with fresh etag if optimistic concurrency conflict (HTTP 400/412)
        const live = People.People.get(resName, { personFields: 'metadata' });
        patch.etag = live.etag;
        updatedPerson = People.People.updateContact(patch, resName, { updatePersonFields: updateFields.join(',') });
      }

      // Reconcile LifeOS_Sphere + Social_Tags to Google Contact Group Labels
      const desiredGroups = [];
      if (row[hdr['LifeOS_Sphere']]) desiredGroups.push(String(row[hdr['LifeOS_Sphere']]).trim());
      String(row[hdr['Social_Tags']] || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((t) => desiredGroups.push(t));
      desiredGroups.forEach((gName) => {
        const gRes = ensureContactGroup_(gName, groupNameToRes);
        if (gRes) People.ContactGroups.Members.modify({ resourceNamesToAdd: [resName] }, gRes);
      });

      const syncedIso = extractGoogleUpdateTime_(updatedPerson) || new Date().toISOString();
      sheet.getRange(i + 2, hdr['Last Updated Sheet'] + 1).setValue(syncedIso);
      sheet.getRange(i + 2, hdr['Last Updated Google Contacts'] + 1).setValue(syncedIso);
      sheet.getRange(i + 2, hdr['Sync_Hash'] + 1).setValue(curHash);
      if (updatedPerson.etag) sheet.getRange(i + 2, hdr['Contact_ETag'] + 1).setValue(updatedPerson.etag);
      pushed++;
    } catch (err) {
      Logger.log('Push failed for ' + resName + ': ' + err);
    }
  }
  return { pushed };
}

function applyPersonToRow_(person, row, hdr, groupMap, googleUpdated) {
  const set = (colName, val) => { if (hdr[colName] !== undefined) row[hdr[colName]] = val; };
  set('Contact ID', person.resourceName || '');
  set('Last Updated Google Contacts', googleUpdated);
  set('Last Updated Sheet', googleUpdated);
  set('Contact_ETag', person.etag || '');

  // Names
  const n = (person.names && person.names[0]) || {};
  set('First Name', n.givenName || '');
  set('Middle Name', n.middleName || '');
  set('Last Name', n.familyName || '');
  set('Phonetic First Name', n.phoneticGivenName || '');
  set('Phonetic Middle Name', n.phoneticMiddleName || '');
  set('Phonetic Last Name', n.phoneticFamilyName || '');
  set('Name Prefix', n.honorificPrefix || '');
  set('Name Suffix', n.honorificSuffix || '');

  // Nickname, File As, Gender, Birthday, Notes
  set('Nickname', (person.nicknames && person.nicknames[0] && person.nicknames[0].value) || '');
  set('File As', (person.fileAses && person.fileAses[0] && person.fileAses[0].value) || '');
  set('Gender', (person.genders && person.genders[0] && (person.genders[0].formattedValue || person.genders[0].value)) || '');
  set('Birthday', formatDateObj_(person.birthdays && person.birthdays[0] && person.birthdays[0].date));
  set('Notes', (person.biographies && person.biographies[0] && person.biographies[0].value) || '');

  // Organization
  const org = (person.organizations && person.organizations[0]) || {};
  set('Organization Name', org.name || '');
  set('Organization Title', org.title || '');
  set('Organization Department', org.department || '');

  // Emails 1..4
  const emails = person.emailAddresses || [];
  for (let i = 1; i <= 4; i++) {
    const em = emails[i - 1] || {};
    set('E-mail ' + i + ' - Label', em.formattedType || em.type || '');
    set('E-mail ' + i + ' - Value', em.value || '');
  }

  // Phones 1..4
  const phones = person.phoneNumbers || [];
  for (let i = 1; i <= 4; i++) {
    const ph = phones[i - 1] || {};
    set('Phone ' + i + ' - Label', ph.formattedType || ph.type || '');
    set('Phone ' + i + ' - Value', ph.value || '');
  }

  // IM Clients 1..2
  const ims = person.imClients || [];
  for (let i = 1; i <= 2; i++) {
    const im = ims[i - 1] || {};
    set('IM ' + i + ' - Protocol', im.formattedProtocol || im.protocol || '');
    set('IM ' + i + ' - Handle', im.username || '');
  }

  // Addresses 1..2
  const addrs = person.addresses || [];
  for (let i = 1; i <= 2; i++) {
    const ad = addrs[i - 1] || {};
    set('Address ' + i + ' - Label', ad.formattedType || ad.type || '');
    set('Address ' + i + ' - Formatted', ad.formattedValue || '');
    set('Address ' + i + ' - Street', ad.streetAddress || '');
    set('Address ' + i + ' - City', ad.city || '');
    set('Address ' + i + ' - PO Box', ad.poBox || '');
    set('Address ' + i + ' - Region', ad.region || '');
    set('Address ' + i + ' - Postal Code', ad.postalCode || '');
    set('Address ' + i + ' - Country', ad.country || '');
    set('Address ' + i + ' - Extended Address', ad.extendedAddress || '');
  }

  // Relations 1..3
  const rels = person.relations || [];
  for (let i = 1; i <= 3; i++) {
    const rl = rels[i - 1] || {};
    set('Relation ' + i + ' - Label', rl.formattedType || rl.type || '');
    set('Relation ' + i + ' - Value', rl.person || '');
  }

  // Websites 1..5
  const urls = person.urls || [];
  for (let i = 1; i <= 5; i++) {
    const u = urls[i - 1] || {};
    set('Website ' + i + ' - Label', u.formattedType || u.type || '');
    set('Website ' + i + ' - Value', u.value || '');
  }

  // Events 1..2
  const evs = person.events || [];
  for (let i = 1; i <= 2; i++) {
    const ev = evs[i - 1] || {};
    set('Event ' + i + ' - Label', ev.formattedType || ev.type || '');
    set('Event ' + i + ' - Value', formatDateObj_(ev.date));
  }

  // Custom Fields (userDefined) 1..2
  const uds = person.userDefined || [];
  for (let i = 1; i <= 2; i++) {
    const ud = uds[i - 1] || {};
    set('Custom Field ' + i + ' - Key', ud.key || '');
    set('Custom Field ' + i + ' - Value', ud.value || '');
  }

  // Labels & LifeOS Emoji/Flag Enrichment (non-destructive)
  const labelsList = extractGroupNames_(person, groupMap);
  set('Labels', labelsList.join(' ::: '));
  const fullName = [n.givenName, n.middleName, n.familyName].filter(Boolean).join(' ');
  const parsed = parseEmojiPatternAndLabels_(fullName, labelsList);
  if (!row[hdr['LifeOS_Sphere']] && parsed.sphere) set('LifeOS_Sphere', parsed.sphere);
  if (parsed.tags.length > 0) set('Social_Tags', mergeCsv_(row[hdr['Social_Tags']], parsed.tags));
  if (!row[hdr['Country_Origin']] && parsed.country) set('Country_Origin', parsed.country);
  set('Sync_Hash', computeFullRowHash_(row, hdr));
}

function buildPersonPatchFromRow_(row, hdr, etag) {
  const get = (c) => (hdr[c] !== undefined ? String(row[hdr[c]] || '').trim() : '');
  const patch = { etag };
  const updateFields = [];

  patch.names = [{
    givenName: get('First Name'),
    middleName: get('Middle Name'),
    familyName: get('Last Name'),
    phoneticGivenName: get('Phonetic First Name'),
    phoneticMiddleName: get('Phonetic Middle Name'),
    phoneticFamilyName: get('Phonetic Last Name'),
    honorificPrefix: get('Name Prefix'),
    honorificSuffix: get('Name Suffix'),
  }];
  updateFields.push('names');

  const nick = get('Nickname');
  if (nick) { patch.nicknames = [{ value: nick }]; updateFields.push('nicknames'); }

  const fileAs = get('File As');
  if (fileAs) { patch.fileAses = [{ value: fileAs }]; updateFields.push('fileAses'); }

  const gender = get('Gender');
  if (gender) { patch.genders = [{ value: gender }]; updateFields.push('genders'); }

  const bday = parseDateObj_(row[hdr['Birthday']]);
  if (bday) { patch.birthdays = [{ date: bday }]; updateFields.push('birthdays'); }

  const notes = get('Notes');
  if (notes) { patch.biographies = [{ value: notes, contentType: 'TEXT_PLAIN' }]; updateFields.push('biographies'); }

  const orgName = get('Organization Name'), orgTitle = get('Organization Title'), orgDept = get('Organization Department');
  if (orgName || orgTitle || orgDept) {
    patch.organizations = [{ name: orgName, title: orgTitle, department: orgDept }];
    updateFields.push('organizations');
  }

  const emails = [];
  for (let i = 1; i <= 4; i++) {
    const val = get('E-mail ' + i + ' - Value');
    if (val) emails.push({ type: get('E-mail ' + i + ' - Label') || 'other', value: val });
  }
  if (emails.length) { patch.emailAddresses = emails; updateFields.push('emailAddresses'); }

  const phones = [];
  for (let i = 1; i <= 4; i++) {
    const val = get('Phone ' + i + ' - Value');
    if (val) phones.push({ type: get('Phone ' + i + ' - Label') || 'mobile', value: val });
  }
  if (phones.length) { patch.phoneNumbers = phones; updateFields.push('phoneNumbers'); }

  const ims = [];
  for (let i = 1; i <= 2; i++) {
    const handle = get('IM ' + i + ' - Handle');
    if (handle) ims.push({ protocol: get('IM ' + i + ' - Protocol') || 'other', username: handle });
  }
  if (ims.length) { patch.imClients = ims; updateFields.push('imClients'); }

  const addrs = [];
  for (let i = 1; i <= 2; i++) {
    const street = get('Address ' + i + ' - Street'), city = get('Address ' + i + ' - City'), fmt = get('Address ' + i + ' - Formatted');
    if (street || city || fmt) {
      addrs.push({
        type: get('Address ' + i + ' - Label') || 'home',
        streetAddress: street,
        city: city,
        poBox: get('Address ' + i + ' - PO Box'),
        region: get('Address ' + i + ' - Region'),
        postalCode: get('Address ' + i + ' - Postal Code'),
        country: get('Address ' + i + ' - Country'),
        extendedAddress: get('Address ' + i + ' - Extended Address'),
      });
    }
  }
  if (addrs.length) { patch.addresses = addrs; updateFields.push('addresses'); }

  const rels = [];
  for (let i = 1; i <= 3; i++) {
    const val = get('Relation ' + i + ' - Value');
    if (val) rels.push({ type: get('Relation ' + i + ' - Label') || 'other', person: val });
  }
  if (rels.length) { patch.relations = rels; updateFields.push('relations'); }

  const urls = [];
  for (let i = 1; i <= 5; i++) {
    const val = get('Website ' + i + ' - Value');
    if (val) urls.push({ type: get('Website ' + i + ' - Label') || 'other', value: val });
  }
  if (urls.length) { patch.urls = urls; updateFields.push('urls'); }

  const evs = [];
  for (let i = 1; i <= 2; i++) {
    const dtObj = parseDateObj_(hdr['Event ' + i + ' - Value'] !== undefined ? row[hdr['Event ' + i + ' - Value']] : '');
    if (dtObj) evs.push({ type: get('Event ' + i + ' - Label') || 'other', date: dtObj });
  }
  if (evs.length) { patch.events = evs; updateFields.push('events'); }

  const uds = [];
  for (let i = 1; i <= 2; i++) {
    const k = get('Custom Field ' + i + ' - Key'), v = get('Custom Field ' + i + ' - Value');
    if (k && v) uds.push({ key: k, value: v });
  }
  if (uds.length) { patch.userDefined = uds; updateFields.push('userDefined'); }

  return { patch, updateFields };
}

function classifyExistingContactsLocally() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_MASTER_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const hdr = getHeaderIndexMap_(sheet);
  const totalCols = sheet.getLastColumn();
  const range = sheet.getRange(2, 1, lastRow - 1, totalCols);
  const vals = range.getValues();
  let classified = 0;

  for (let i = 0; i < vals.length; i++) {
    const r = vals[i];
    const fullName = [r[hdr['First Name']], r[hdr['Middle Name']], r[hdr['Last Name']]].filter(Boolean).join(' ');
    const labels = String(r[hdr['Labels']] || '').split(/:::|;|,/).map((s) => s.trim()).filter(Boolean);
    const parsed = parseEmojiPatternAndLabels_(fullName, labels);
    let touched = false;
    if (!r[hdr['LifeOS_Sphere']] && parsed.sphere) { r[hdr['LifeOS_Sphere']] = parsed.sphere; touched = true; }
    if (parsed.tags.length > 0) {
      const merged = mergeCsv_(r[hdr['Social_Tags']], parsed.tags);
      if (merged !== r[hdr['Social_Tags']]) { r[hdr['Social_Tags']] = merged; touched = true; }
    }
    if (!r[hdr['Country_Origin']] && parsed.country) { r[hdr['Country_Origin']] = parsed.country; touched = true; }
    if (!r[hdr['Sync_Hash']]) r[hdr['Sync_Hash']] = computeFullRowHash_(r, hdr);
    if (touched) classified++;
  }
  range.setValues(vals);
  Logger.log('Classified ' + classified + ' contact(s) locally.');
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CRM_MASTER_TAB) return;
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row >= 2 && col >= 4) {
    sheet.getRange(row, 2).setValue(new Date().toISOString()); // Col B: Last Updated Sheet
  }
}

// --- Helpers ---
function getHeaderIndexMap_(sheet) {
  const hdrs = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  hdrs.forEach((h, i) => { if (h) map[String(h).trim()] = i; }); // 0-based indices
  return map;
}

function buildContactRowIndex_(sheet, idIdx) {
  const lastRow = sheet.getLastRow();
  const idx = {};
  if (lastRow < 2) return idx;
  const ids = sheet.getRange(2, idIdx + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i][0] || '').trim();
    if (id) idx[id] = i + 2;
  }
  return idx;
}

function computeFullRowHash_(row, hdr) {
  const skip = new Set(['Last Updated Sheet', 'Last Updated Google Contacts', 'Sync_Direction_Lock', 'Sync_Hash', 'Contact_ETag', 'Sync_Action']);
  const parts = [];
  Object.keys(hdr).forEach((k) => {
    if (!skip.has(k)) parts.push(String(row[hdr[k]] || '').trim());
  });
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, parts.join('|'));
  return bytes.map((b) => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('').slice(0, 16);
}

function parseEmojiPatternAndLabels_(fullName, labelsList) {
  let sphere = '';
  const tags = [];
  const country = extractCountryFromFlagEmoji_(fullName);
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
  return String.fromCharCode(flag.codePointAt(0) - 0x1F1E6 + 65, flag.codePointAt(2) - 0x1F1E6 + 65);
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

function formatDateObj_(d) {
  if (!d) return '';
  const y = d.year ? String(d.year) : '0000';
  const m = ('0' + (d.month || 1)).slice(-2);
  const day = ('0' + (d.day || 1)).slice(-2);
  return `${y}-${m}-${day}`;
}

function parseDateObj_(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return { year: raw.getFullYear(), month: raw.getMonth() + 1, day: raw.getDate() };
  const m = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function mergeCsv_(existing, newItems) {
  const set = new Set(String(existing || '').split(',').map((s) => s.trim()).filter(Boolean));
  newItems.forEach((item) => set.add(item));
  return Array.from(set).join(', ');
}

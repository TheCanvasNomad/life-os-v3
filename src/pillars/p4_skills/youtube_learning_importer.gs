/**
 * ============================================================================
 * LIFEOS v3.0 — PILLAR 4: YOUTUBE LEARNING QUEUE IMPORTER (Law 2)
 * Bound inside: 🛠️ Pillar_4_Skills_Mission (1PHTTv1Qpdy5JAyLarOaXYAIsNIuAk8YFBw9GqvIslT0)
 *
 * Scans the user's "LifeOS Learning Queue" YouTube playlist via YouTube Data
 * API v3 and appends new video stubs into RAW_DATA_Quests as [Learning_Quest]
 * entries at the Remembering [1.0x] Bloom tier.
 *
 * SETUP: Extensions -> Apps Script -> Services (+) -> Enable "YouTube Data API v3".
 * ============================================================================
 */

const YT_LEARNING_CFG = {
  RAW_QUESTS_SS_ID: '1uV7FXlTU--gHFOt7zWYRkDxGk15QXIPGbBcshkk4TVw',
  RAW_QUESTS_TAB: 'Form Responses 1',
  PLAYLIST_TITLE: 'LifeOS Learning Queue',
  MAX_IMPORT_PER_RUN: 25
};

/**
 * Finds the "LifeOS Learning Queue" playlist and appends unimported videos
 * as Remembering [1.0x] [Learning_Quest] tasks into RAW_DATA_Quests.
 */
function importYouTubeLearningQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('importYouTubeLearningQueue skipped: script lock held.');
    return;
  }

  try {
    const playlistId = findPlaylistIdByTitle_(YT_LEARNING_CFG.PLAYLIST_TITLE);
    if (!playlistId) {
      Logger.log('Playlist not found: ' + YT_LEARNING_CFG.PLAYLIST_TITLE);
      return;
    }

    const ss = SpreadsheetApp.openById(YT_LEARNING_CFG.RAW_QUESTS_SS_ID);
    const sheet = ss.getSheetByName(YT_LEARNING_CFG.RAW_QUESTS_TAB);
    if (!sheet) return;

    const existing = sheet.getLastRow() >= 2
      ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getValues()
      : [];
    const seenKeys = new Set();
    existing.forEach(r => {
      const nm = String(r[0] || '').trim().toLowerCase();
      const desc = String(r[1] || '').trim();
      if (nm) seenKeys.add(nm);
      const vidMatch = desc.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/);
      if (vidMatch) seenKeys.add(vidMatch[1]);
    });

    const newRows = [];
    let pageToken = null;
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy HH:mm:ss');

    do {
      const resp = YouTube.PlaylistItems.list('snippet,contentDetails', {
        playlistId: playlistId,
        maxResults: 50,
        pageToken: pageToken
      });
      const items = resp.items || [];
      for (let i = 0; i < items.length && newRows.length < YT_LEARNING_CFG.MAX_IMPORT_PER_RUN; i++) {
        const sn = items[i].snippet || {};
        const vidId = (items[i].contentDetails && items[i].contentDetails.videoId) || (sn.resourceId && sn.resourceId.videoId) || '';
        const title = String(sn.title || '').trim();
        if (!title || title === 'Deleted video' || title === 'Private video') continue;

        const questName = '[Study] ' + title;
        if (seenKeys.has(vidId) || seenKeys.has(questName.toLowerCase())) continue;

        const channel = sn.videoOwnerChannelTitle || sn.channelTitle || 'YouTube';
        const url = 'https://www.youtube.com/watch?v=' + vidId;
        const desc = 'Source: ' + channel + ' | URL: ' + url + '\nAuto-imported from "' + YT_LEARNING_CFG.PLAYLIST_TITLE + '" playlist.';

        // Exact 16-column RAW_DATA_Quests schema (A:P)
        newRows.push([
          nowStr,                          // A: Timestamp
          questName,                       // B: Quest Name
          desc,                            // C: Description
          'Pillar 4: Skills & Mission',    // D: Primary Pillar
          'Task',                          // E: Quest Tier
          'Autonomous Learning Pipeline',  // F: Parent Quest
          '',                              // G: Target Completion Date
          'Mastery, Knowledge',            // H: CORE Values
          6,                               // I: Importance (1-10)
          4,                               // J: Urgency (1-10)
          'Remembering [1.0x]',            // K: Bloom's Cognitive Level
          1,                               // L: Time Benchmark (Hours)
          '',                              // M: Actual Hours
          'Not Started',                   // N: Status
          'Learning_Quest',                // O: Special Flags
          ''                               // P: Calendar_Event_ID
        ]);
        seenKeys.add(vidId);
        seenKeys.add(questName.toLowerCase());
      }
      pageToken = resp.nextPageToken || null;
    } while (pageToken && newRows.length < YT_LEARNING_CFG.MAX_IMPORT_PER_RUN);

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 16).setValues(newRows);
    }
    Logger.log('importYouTubeLearningQueue imported ' + newRows.length + ' new [Learning_Quest] stubs.');
  } finally {
    lock.releaseLock();
  }
}

function findPlaylistIdByTitle_(targetTitle) {
  let pageToken = null;
  do {
    const resp = YouTube.Playlists.list('snippet', {
      mine: true,
      maxResults: 50,
      pageToken: pageToken
    });
    const list = resp.items || [];
    for (let i = 0; i < list.length; i++) {
      if (String(list[i].snippet && list[i].snippet.title || '').trim().toLowerCase() === targetTitle.toLowerCase()) {
        return list[i].id;
      }
    }
    pageToken = resp.nextPageToken || null;
  } while (pageToken);
  return null;
}

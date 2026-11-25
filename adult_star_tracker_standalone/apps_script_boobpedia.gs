/**
 * Adult_Star_Tracker_Brick — Boobpedia MediaWiki API Lookup & Enrichment Module
 *
 * Uses https://www.boobpedia.com/wiki/api.php to look up female performers,
 * parse infobox attributes (Debut_Year, Birth_Year, Height, Measurements_BWH,
 * Cup_Tag, Natural_or_Enhanced, Heritage_Tag, Primary_Studios), and map Boobpedia
 * categories onto canonical TAXONOMY_MATRIX tags.
 */

/**
 * Menu handler: prompts for a performer name, fetches Boobpedia profile, and appends to MODEL_ROSTER_INDEX.
 */
function promptBoobpediaAddPerformer() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    'Boobpedia Performer Lookup',
    'Enter female performer stage name (e.g., "Autumn Falls"):',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const query = resp.getResponseText().trim();
  if (!query) return;

  try {
    const record = fetchBoobpediaPerformer_(query);
    if (!record) {
      ui.alert('No Boobpedia page found for "' + query + '". You can add her via "Quick Add Performer Manually…".');
      return;
    }
    const rowNum = appendPerformerToRoster_(record);
    if (rowNum) {
      ui.alert(
        'Added "' + record.Stage_Name + '" from Boobpedia to MODEL_ROSTER_INDEX (row ' + rowNum + ').\n' +
        'Measurements: ' + (record.Measurements_BWH || 'N/A') + ' | Cup: ' + (record.Cup_Tag || 'N/A') + '\n' +
        'Auto Categories: ' + (record.Auto_Categories || 'None mapped')
      );
    }
  } catch (err) {
    ui.alert('Boobpedia lookup error: ' + err.message);
  }
}

/**
 * Menu handler: enriches the currently selected row on MODEL_ROSTER_INDEX with missing Boobpedia fields.
 * Never overwrites non-blank user-curated cells.
 */
function enrichSelectedRosterRow() {
  const ui = SpreadsheetApp.getUi();
  const ss = getTrackerSpreadsheet_();
  const sheet = ss.getActiveSheet();
  if (!sheet || sheet.getName() !== TRACKER_CONFIG.TABS.ROSTER) {
    ui.alert('Select a performer row in MODEL_ROSTER_INDEX first.');
    return;
  }
  const row = sheet.getActiveCell().getRow();
  if (row < 2) {
    ui.alert('Select a data row (row 2 or below).');
    return;
  }
  const stageName = String(sheet.getRange(row, 2).getValue() || '').trim();
  if (!stageName) {
    ui.alert('Column B (Stage_Name) is blank on row ' + row + '.');
    return;
  }

  const record = fetchBoobpediaPerformer_(stageName);
  if (!record) {
    ui.alert('No Boobpedia page found for "' + stageName + '".');
    return;
  }

  const current = sheet.getRange(row, 1, 1, 16).getValues()[0];
  const updates = [
    [3, record.Boobpedia_Slug],
    [4, record.Debut_Year],
    [5, record.Birth_Year],
    [6, record.Height],
    [7, record.Measurements_BWH],
    [9, record.Cup_Tag],
    [10, record.Natural_or_Enhanced],
    [11, record.Heritage_Tag],
    [12, record.Primary_Studios],
    [13, record.Auto_Categories],
  ];

  let filledCount = 0;
  updates.forEach(function (pair) {
    const colIdx = pair[0];
    const newVal = pair[1];
    if (!current[colIdx - 1] && newVal) {
      sheet.getRange(row, colIdx).setValue(newVal);
      filledCount++;
    }
  });

  ui.alert('Enriched "' + stageName + '" from Boobpedia (' + filledCount + ' blank fields filled).');
}

/**
 * Queries Boobpedia MediaWiki API (with opensearch fallback) and parses a roster object.
 * @param {string} stageName
 * @return {Object|null}
 */
function fetchBoobpediaPerformer_(stageName) {
  let title = stageName.trim().replace(/\s+/g, '_');
  let page = fetchBoobpediaPageByTitle_(title);

  // Fallback to opensearch if exact title lookup misses
  if (!page) {
    const searchUrl =
      TRACKER_CONFIG.BOOBPEDIA_API +
      '?action=opensearch&format=json&limit=5&search=' +
      encodeURIComponent(stageName.trim());
    const searchResp = UrlFetchApp.fetch(searchUrl, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'AdultStarTrackerStandalone/2.0' },
    });
    if (searchResp.getResponseCode() === 200) {
      const parsed = JSON.parse(searchResp.getContentText());
      const candidates = Array.isArray(parsed[1]) ? parsed[1] : [];
      if (candidates.length > 0) {
        title = String(candidates[0]).replace(/\s+/g, '_');
        page = fetchBoobpediaPageByTitle_(title);
      }
    }
  }
  if (!page) return null;

  const taxonomyTags = loadCanonicalTaxonomyTags_();
  return parseBoobpediaWikitext_(page.title, page.wikitext, page.categories, taxonomyTags);
}

/**
 * Fetches raw wikitext & categories for an exact Boobpedia page title.
 * @param {string} title
 * @return {{title: string, wikitext: string, categories: string[]}|null}
 */
function fetchBoobpediaPageByTitle_(title) {
  const url =
    TRACKER_CONFIG.BOOBPEDIA_API +
    '?action=query&format=json&redirects=1&prop=revisions|categories&rvprop=content&rvslots=main&cllimit=100&titles=' +
    encodeURIComponent(title);
  const resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'AdultStarTrackerStandalone/2.0' },
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Boobpedia API HTTP ' + resp.getResponseCode());
  }
  const data = JSON.parse(resp.getContentText());
  const pages = (data.query && data.query.pages) || {};
  const keys = Object.keys(pages);
  if (keys.length === 0 || keys[0] === '-1') return null;

  const page = pages[keys[0]];
  const revs = page.revisions || [];
  let wikitext = '';
  if (revs.length > 0) {
    wikitext = (revs[0].slots && revs[0].slots.main && revs[0].slots.main['*']) || revs[0]['*'] || '';
  }
  const categories = (page.categories || []).map(function (c) {
    return String(c.title || '').replace(/^Category:/i, '').trim();
  });
  return { title: page.title || title.replace(/_/g, ' '), wikitext: wikitext, categories: categories };
}

/**
 * Loads canonical Tag_Label values from TAXONOMY_MATRIX!C2:C.
 * @return {string[]}
 */
function loadCanonicalTaxonomyTags_() {
  const ss = getTrackerSpreadsheet_();
  const sheet = ss.getSheetByName(TRACKER_CONFIG.TABS.TAXONOMY);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 3, sheet.getLastRow() - 1, 1)
    .getValues()
    .map(function (r) { return String(r[0] || '').trim(); })
    .filter(function (v) { return v !== ''; });
}

/**
 * Pure wikitext infobox parser mirroring tracker_helpers.py parse_boobpedia_page().
 * @param {string} stageName
 * @param {string} wikitext
 * @param {string[]} categories
 * @param {string[]} taxonomyTags
 * @return {Object}
 */
function parseBoobpediaWikitext_(stageName, wikitext, categories, taxonomyTags) {
  function cleanWiki(val) {
    return String(val || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\{\{[^{}]*\}\}/g, '')
      .replace(/''+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractField(names) {
    for (let i = 0; i < names.length; i++) {
      const re = new RegExp('^\\s*\\|\\s*' + names[i] + '\\s*=\\s*(.+)$', 'im');
      const m = wikitext.match(re);
      if (m && m[1]) {
        const cleaned = cleanWiki(m[1]);
        if (cleaned) return cleaned;
      }
    }
    return '';
  }

  function firstYear(str) {
    const m = String(str || '').match(/\b(19[5-9]\d|20[0-3]\d)\b/);
    return m ? parseInt(m[1], 10) : '';
  }

  const birthRaw = extractField(['birth_date', 'born', 'birthdate']);
  const debutRaw = extractField(['years_active', 'active', 'debut', 'career_start']);
  const heightRaw = extractField(['height']);
  const measRaw = extractField(['measurements', 'bwh']);
  const cupRaw = extractField(['bra_size', 'cup_size', 'cupsize']);
  const boobsRaw = extractField(['boobs', 'breasts', 'natural_or_enhanced']);
  const ethRaw = extractField(['ethnicity', 'heritage', 'nationality']);
  const studiosRaw = extractField(['studios', 'studio', 'companies']);

  const bwhMatch = measRaw.match(/(\d{2}[A-Za-z+]{0,5}\s*-\s*\d{2}\s*-\s*\d{2})/);
  const bwhClean = bwhMatch ? bwhMatch[1].replace(/\s+/g, '').toUpperCase() : '';
  const cupTag = extractCupTagFromBwh_(cupRaw) || extractCupTagFromBwh_(bwhClean);

  const boobsHint = (boobsRaw + ' ' + categories.join(' ')).toLowerCase();
  let naturalOrEnhanced = '';
  if (/implant|enhanced|augmented|fake|silicone/.test(boobsHint)) {
    naturalOrEnhanced = 'Enhanced/Implants';
  } else if (/natural/.test(boobsHint)) {
    naturalOrEnhanced = 'Natural Boobs';
  }

  const ethLow = ethRaw.toLowerCase();
  let heritageTag = ethRaw;
  if (/\b(latina|hispanic|colombian|mexican|cuban|puerto)\b/.test(ethLow)) heritageTag = 'Latina/Hispanic';
  else if (/\b(asian|japanese|chinese|korean|filipina|vietnamese)\b/.test(ethLow)) heritageTag = 'Asian';
  else if (/\b(black|african|ebony)\b/.test(ethLow)) heritageTag = 'Black/African';
  else if (/\b(white|caucasian|european|american|australian|british|czech|russian)\b/.test(ethLow)) heritageTag = 'White/European';

  const hMatch = heightRaw.match(/(\d'\s*\d{1,2}"?)/);
  let heightClean = hMatch ? hMatch[1].replace(/\s+/g, '') : heightRaw;
  if (heightClean && heightClean.indexOf("'") !== -1 && !heightClean.endsWith('"')) {
    heightClean += '"';
  }

  const catBlob = categories.join(' | ').toLowerCase();
  const mapped = [];
  const seen = {};
  (taxonomyTags || []).forEach(function (tag) {
    const low = tag.toLowerCase();
    if (low && low !== 'natural boobs' && low !== 'enhanced/implants' && catBlob.indexOf(low) !== -1 && !seen[low]) {
      seen[low] = true;
      mapped.push(tag);
    }
  });

  const studiosClean = studiosRaw
    .split(/[,;]/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s !== ''; })
    .join('; ');

  return {
    Stage_Name: stageName,
    Boobpedia_Slug: stageName.toLowerCase().replace(/\s+/g, '_'),
    Debut_Year: firstYear(debutRaw),
    Birth_Year: firstYear(birthRaw),
    Height: heightClean,
    Measurements_BWH: bwhClean,
    Cup_Tag: cupTag,
    Natural_or_Enhanced: naturalOrEnhanced,
    Heritage_Tag: heritageTag,
    Primary_Studios: studiosClean,
    Auto_Categories: mapped.join('; '),
    Source_Tag: 'Boobpedia_API',
    Active_In_Form: true,
    Custom_Added: true,
  };
}

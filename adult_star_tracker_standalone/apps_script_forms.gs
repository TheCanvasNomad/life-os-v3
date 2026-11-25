/**
 * Adult_Star_Tracker_Brick — Performer-First Google Forms Builder & Dropdown Sync
 *
 * Strictly Performer-First (NO Scene Log form):
 *   1. Performer Log Form      -> structured ratings, traits, niches, studio (appends to Performer_Logs)
 *   2. ReRank Duel Form        -> head-to-head Performer_A vs Performer_B winner & margin (appends to ReRanks)
 *   3. Baseline Override Form  -> optional stated preference ratings for Traits, Niches, or Studios
 *
 * Uses structured closed-loop controls (dropdowns, linear scales, checkboxes) synced dynamically
 * from MODEL_ROSTER_INDEX, TAXONOMY_MATRIX, and Studio_Intelligence.
 */

/**
 * Creates all three Performer-First standalone Google Forms and saves their IDs in ScriptProperties.
 * Safe to re-run: skips any form already stored in ScriptProperties.
 */
function createAllPerformerFirstForms() {
  const props = PropertiesService.getScriptProperties();
  const ui = SpreadsheetApp.getUi();
  const ss = getTrackerSpreadsheet_();
  const createdUrls = [];

  // 1. Performer Log Form
  if (!props.getProperty(TRACKER_CONFIG.PROP_KEYS.PERFORMER_LOG_FORM_ID)) {
    const f1 = FormApp.create('Star Tracker — Performer Log (Standalone)');
    f1.setDescription('Performer-First rating intake for Adult_Star_Tracker_Brick (no scene logging).');
    f1.addListItem().setTitle('Performer_Name').setRequired(true);
    f1.addScaleItem().setTitle('Appearance_Rating_1_10').setBounds(1, 10).setRequired(true);
    f1.addScaleItem().setTitle('Performance_Rating_1_10').setBounds(1, 10).setRequired(true);
    f1.addScaleItem().setTitle('Energy_Vibe_Rating_1_10').setBounds(1, 10).setRequired(true);
    f1.addCheckboxItem().setTitle('Scene_Niches_Observed');
    f1.addListItem().setTitle('Studio_Label');
    f1.addCheckboxItem().setTitle('Key_Traits_Noticed');
    f1.addParagraphTextItem().setTitle('Personal_Notes');
    f1.addTextItem().setTitle('Session_Duration_Min');
    f1.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    props.setProperty(TRACKER_CONFIG.PROP_KEYS.PERFORMER_LOG_FORM_ID, f1.getId());
    createdUrls.push('Performer Log: ' + f1.getPublishedUrl());
  }

  // 2. ReRank Duel Form
  if (!props.getProperty(TRACKER_CONFIG.PROP_KEYS.RERANK_FORM_ID)) {
    const f2 = FormApp.create('Star Tracker — Head-to-Head ReRank Duel');
    f2.setDescription('Calibrate performer rankings via pairwise head-to-head comparisons.');
    f2.addListItem().setTitle('Performer_A').setRequired(true);
    f2.addListItem().setTitle('Performer_B').setRequired(true);
    f2.addListItem().setTitle('Winner_Performer').setRequired(true);
    f2.addListItem()
      .setTitle('Margin_Of_Victory')
      .setChoiceValues(['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.8', '1.0'])
      .setRequired(true);
    f2.addListItem()
      .setTitle('Domain_Context')
      .setChoiceValues([
        'Overall Power',
        'Aesthetic Consistency',
        'Performance Intensity',
        'Energy/Presence',
        'Longevity & Impact',
        'Trait Synergy',
      ])
      .setRequired(true);
    f2.addParagraphTextItem().setTitle('Context_Notes');
    f2.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    props.setProperty(TRACKER_CONFIG.PROP_KEYS.RERANK_FORM_ID, f2.getId());
    createdUrls.push('ReRank Duel: ' + f2.getPublishedUrl());
  }

  // 3. Optional Baseline Override Form
  if (!props.getProperty(TRACKER_CONFIG.PROP_KEYS.BASELINE_FORM_ID)) {
    const f3 = FormApp.create('Star Tracker — Baseline Override (Trait / Niche / Studio)');
    f3.setDescription('Optional stated baseline ratings and explicit studio boosts.');
    f3.addListItem()
      .setTitle('Entity_Type')
      .setChoiceValues(['Trait', 'Niche', 'Studio'])
      .setRequired(true);
    f3.addListItem().setTitle('Entity_Tag_Or_Studio').setRequired(true);
    f3.addScaleItem().setTitle('Stated_Rating_1_10').setBounds(1, 10).setRequired(true);
    f3.addScaleItem().setTitle('Secondary_Score_1_10 (Arousal Impact or Roster Strength)').setBounds(1, 10);
    f3.addParagraphTextItem().setTitle('Notes');
    f3.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    props.setProperty(TRACKER_CONFIG.PROP_KEYS.BASELINE_FORM_ID, f3.getId());
    createdUrls.push('Baseline Override: ' + f3.getPublishedUrl());
  }

  syncAllFormDropdowns();
  installStandaloneTriggers();

  if (createdUrls.length > 0) {
    ui.alert('Created Forms & synced dropdowns:\n\n' + createdUrls.join('\n'));
  } else {
    ui.alert('All 3 Forms already exist in ScriptProperties. Dropdowns have been refreshed.');
  }
}

/**
 * Syncs dropdown/checkbox choices across all linked Forms from live sheet lists:
 *   - Active performers from MODEL_ROSTER_INDEX (Active_In_Form = TRUE)
 *   - Active Trait & Niche tags from TAXONOMY_MATRIX (Active_In_Form = TRUE)
 *   - Auto-discovered studios from Studio_Intelligence
 */
function syncAllFormDropdowns() {
  const ss = getTrackerSpreadsheet_();
  const props = PropertiesService.getScriptProperties();

  const performers = getActiveRosterNames_(ss);
  const tax = getActiveTaxonomyLists_(ss);
  const studios = getDiscoveredStudios_(ss);

  // Sync Performer Log Form
  const logFormId = props.getProperty(TRACKER_CONFIG.PROP_KEYS.PERFORMER_LOG_FORM_ID);
  if (logFormId) {
    const form = FormApp.openById(logFormId);
    setListChoicesByTitle_(form, 'Performer_Name', performers);
    setCheckboxChoicesByTitle_(form, 'Scene_Niches_Observed', tax.niches);
    setListChoicesByTitle_(form, 'Studio_Label', studios);
    setCheckboxChoicesByTitle_(form, 'Key_Traits_Noticed', tax.traits);
  }

  // Sync ReRank Duel Form
  const rrFormId = props.getProperty(TRACKER_CONFIG.PROP_KEYS.RERANK_FORM_ID);
  if (rrFormId) {
    const form = FormApp.openById(rrFormId);
    setListChoicesByTitle_(form, 'Performer_A', performers);
    setListChoicesByTitle_(form, 'Performer_B', performers);
    setListChoicesByTitle_(form, 'Winner_Performer', performers);
  }

  // Sync Baseline Override Form
  const baseFormId = props.getProperty(TRACKER_CONFIG.PROP_KEYS.BASELINE_FORM_ID);
  if (baseFormId) {
    const form = FormApp.openById(baseFormId);
    const allEntities = [].concat(tax.traits, tax.niches, studios).sort();
    setListChoicesByTitle_(form, 'Entity_Tag_Or_Studio', allEntities);
  }
}

function getActiveRosterNames_(ss) {
  const sheet = ss.getSheetByName(TRACKER_CONFIG.TABS.ROSTER);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getRange(2, 2, sheet.getLastRow() - 1, 14).getValues();
  return data
    .filter(function (r) { return r[0] && r[13] !== false; })
    .map(function (r) { return String(r[0]).trim(); })
    .sort();
}

function getActiveTaxonomyLists_(ss) {
  const sheet = ss.getSheetByName(TRACKER_CONFIG.TABS.TAXONOMY);
  const traits = [];
  const niches = [];
  if (!sheet || sheet.getLastRow() < 2) return { traits: traits, niches: niches };
  const data = sheet.getRange(2, 2, sheet.getLastRow() - 1, 6).getValues();
  data.forEach(function (r) {
    const domain = String(r[0] || '').trim();
    const label = String(r[1] || '').trim();
    const active = r[5];
    if (!label || active === false) return;
    if (domain === 'Scene_Niches' || domain === 'Filming_Positions') {
      niches.push(label);
    } else {
      traits.push(label);
    }
  });
  return { traits: traits, niches: niches };
}

function getDiscoveredStudios_(ss) {
  const sheet = ss.getSheetByName(TRACKER_CONFIG.TABS.STUDIO_INTEL);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .map(function (r) { return String(r[0] || '').trim(); })
    .filter(function (v) { return v !== ''; });
}

function setListChoicesByTitle_(form, title, values) {
  if (!values || values.length === 0) return;
  form.getItems(FormApp.ItemType.LIST).forEach(function (item) {
    if (item.getTitle() === title) {
      item.asListItem().setChoiceValues(values);
    }
  });
}

function setCheckboxChoicesByTitle_(form, title, values) {
  if (!values || values.length === 0) return;
  form.getItems(FormApp.ItemType.CHECKBOX).forEach(function (item) {
    if (item.getTitle() === title) {
      item.asCheckboxItem().setChoiceValues(values);
    }
  });
}

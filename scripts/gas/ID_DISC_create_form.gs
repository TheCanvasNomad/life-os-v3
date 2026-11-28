/**
 * LifeOS v3.0 — 🎯 DISC_Behavioral_Brick (ID_DISC)
 * Modular Form Generator: 24-Block Workplace-Contextualized Forced-Choice (Most / Least) DISC Form
 *
 * Target Brick Spreadsheet ID: 1VPQ7_KTxo7_PWNILqYcq5YG3jpei5UYWWfROkbz-dT4
 * Cadence: 4-Week Retest Window (TTL: 672 Hours)
 *
 * ONE-TIME SETUP:
 * 1. Open 🎯 DISC_Behavioral_Brick -> Extensions -> Apps Script.
 * 2. Paste this file as `disc_form_generator.gs` and Save.
 * 3. Run `createWorkplaceDiscForm()` once and authorize Google Forms + Sheets.
 * 4. The script creates the 24-block forced-choice Google Form, links it to this workbook,
 *    writes the live Form URL into `MODULE_META!B4` (lighting up 🎯 DISC_HUD automatically),
 *    and logs the Form URL in Execution Logs.
 */

const DISC_BRICK_ID = '1VPQ7_KTxo7_PWNILqYcq5YG3jpei5UYWWfROkbz-dT4';

const DISC_24_BLOCKS = [
  { block: 1,  D: 'Take charge quickly when direction is unclear',         I: 'Energize the room with enthusiasm and optimism',      S: 'Keep the team steady and calm under pressure',        C: 'Verify facts and standards before committing' },
  { block: 2,  D: 'Push directly for measurable bottom-line results',      I: 'Persuade stakeholders through stories and rapport',   S: 'Support colleagues consistently behind the scenes',   C: 'Audit edge cases to eliminate avoidable errors' },
  { block: 3,  D: 'Confront obstacles head-on with decisive urgency',      I: 'Spark new ideas through lively group brainstorming',  S: 'Listen patiently so every voice feels heard',         C: 'Organize workflows into repeatable checklists' },
  { block: 4,  D: 'Set ambitious targets and drive fast execution',        I: 'Build broad alliances across departments quickly',    S: 'Maintain reliable routines that prevent burnout',     C: 'Evaluate trade-offs using objective criteria' },
  { block: 5,  D: 'Make tough calls rapidly with incomplete data',         I: 'Rally morale when a project hits a slump',            S: 'De-escalate workplace friction with diplomacy',       C: 'Document decisions and assumptions systematically' },
  { block: 6,  D: 'Challenge inefficient rules to accelerate delivery',    I: 'Pitch bold visions that inspire buy-in',              S: 'Follow through loyally on every commitment',          C: 'Cross-check numbers and logic for precision' },
  { block: 7,  D: 'Compete to win high-stakes deliverables',               I: 'Network effortlessly with unfamiliar partners',       S: 'Create psychological safety during tense meetings',   C: 'Design structured contingency plans in advance' },
  { block: 8,  D: 'Cut through debate to lock in an action owner',         I: 'Use humor and warmth to disarm resistance',           S: 'Pace work evenly to sustain long-term quality',       C: 'Require clear evidence before changing course' },
  { block: 9,  D: 'Step into leadership gaps without waiting to be asked', I: 'Spotlight team wins publicly to build momentum',      S: 'Mediate competing priorities with fairness',          C: 'Define exact specs before launching execution' },
  { block: 10, D: 'Prioritize speed and leverage over consensus',          I: 'Connect people whose strengths complement each other', S: 'Preserve proven processes that already work well',    C: 'Analyze root causes before proposing fixes' },
  { block: 11, D: 'Hold firm boundaries in tough negotiations',            I: 'Keep conversations upbeat and forward-looking',       S: 'Check in empathetically on teammate workload',        C: 'Spot subtle flaws in contracts or proposals' },
  { block: 12, D: 'Own accountability when stakes are highest',            I: 'Present ideas charismatically to leadership',         S: 'Adapt patiently to shifting team needs',              C: 'Maintain clean, structured records and metrics' },
  { block: 13, D: 'Demand clarity on ROI and concrete milestones',         I: 'Generate creative angles when teams get stuck',       S: 'Offer dependable help without seeking spotlight',     C: 'Test assumptions rigorously before scaling' },
  { block: 14, D: 'Pivot aggressively when current tactics stall',         I: 'Turn routine updates into engaging discussions',      S: 'Build deep trust through consistent follow-through',  C: 'Follow compliance and quality protocols strictly' },
  { block: 15, D: 'Focus sharply on winning the critical path',            I: 'Champion collaborative initiatives across silos',     S: 'Protect team harmony during tight deadlines',         C: 'Compare options methodically in structured tables' },
  { block: 16, D: 'Speak candidly even when feedback is blunt',            I: 'Motivate others by painting an exciting future',      S: 'Deliver steady output even on repetitive work',       C: 'Insist on high craftsmanship and accuracy' },
  { block: 17, D: 'Take calculated risks to seize an advantage',           I: 'Win over skeptics through warmth and energy',         S: 'Give colleagues space and time to adjust cleanly',    C: 'Map risks and dependencies prior to kickoff' },
  { block: 18, D: 'Streamline meetings down to key decisions',             I: 'Encourage open dialogue and social connection',       S: 'Act as a calming anchor when schedules change',       C: 'Investigate discrepancies until data reconciles' },
  { block: 19, D: 'Drive closure when discussions loop endlessly',         I: 'Share compelling narratives that simplify complexity', S: 'Collaborate harmoniously without ego friction',      C: 'Standardize templates so output stays consistent' },
  { block: 20, D: 'Seek autonomy to execute high-impact goals',            I: 'Thrive in dynamic, people-facing environments',       S: 'Prefer predictable cadence and clear handoffs',       C: 'Prefer deep focus with well-defined parameters' },
  { block: 21, D: 'Tackle intimidating problems first thing',              I: 'Celebrate milestones to sustain team spirit',         S: 'Resolve disagreements quietly one-on-one',            C: 'Review work twice to prevent downstream rework' },
  { block: 22, D: 'Negotiate assertively for needed resources',            I: 'Build instant rapport in new professional rooms',     S: 'Stay loyal and composed under heavy workload',        C: 'Rely on logic and proof rather than gut instinct' },
  { block: 23, D: 'Push past hesitation to ship version one fast',         I: 'Keep energy high across cross-functional sprints',    S: 'Ensure every stakeholder feels genuinely supported',  C: 'Verify technical accuracy before sign-off' },
  { block: 24, D: 'Lead with decisive conviction under ambiguity',         I: 'Inspire trust through expressive communication',      S: 'Stabilize operations through patient persistence',    C: 'Deliver error-free systems grounded in discipline' },
];

/**
 * Generates the 24-Block Forced-Choice Workplace DISC Google Form, links it to 🎯 DISC_Behavioral_Brick,
 * and stores the live Form URL in MODULE_META!B4.
 */
function createWorkplaceDiscForm() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const form = FormApp.create('Life OS // Workplace DISC Behavioral Assessment (24-Block Forced-Choice)');
    form.setDescription(
      'FRAME OF REFERENCE — WORKPLACE & MISSION EXECUTION CONTEXT:\n' +
      'Answer every block strictly thinking of how you behave in professional, operational, or mission-execution environments (not casual leisure).\n\n' +
      'INSTRUCTIONS (FORCED-CHOICE MOST / LEAST):\n' +
      'For each of the 24 blocks, select ONE statement that is MOST like you at work and ONE DIFFERENT statement that is LEAST like you at work.\n' +
      'Retest Cadence: Every 4 Weeks (TTL: 672 Hours) to track Natural vs. Adapted style shifts.'
    );
    form.setCollectEmail(false);
    form.setAllowResponseEdits(false);
    form.setShowLinkToRespondAgain(true);

    const gridValidation = FormApp.createGridValidation()
      .setHelpText('Select exactly ONE "Most Like Me" and ONE DIFFERENT "Least Like Me" per block.')
      .requireLimitOneResponsePerColumn()
      .build();

    DISC_24_BLOCKS.forEach(function(item) {
      const grid = form.addGridItem();
      grid.setTitle('Block ' + String(item.block).padStart(2, '0') + ' (Workplace Context — Pick 1 Most & 1 Least)');
      grid.setRows([item.D, item.I, item.S, item.C]);
      grid.setColumns(['Most Like Me', 'Least Like Me']);
      grid.setRequired(false); // Grid validation enforces 1 per column cleanly
      grid.setValidation(gridValidation);
    });

    // Link Form destination to 🎯 DISC_Behavioral_Brick
    form.setDestination(FormApp.DestinationType.SPREADSHEET, DISC_BRICK_ID);

    // Record live Form URL & ID in MODULE_META!B4 & B5
    const ss = SpreadsheetApp.openById(DISC_BRICK_ID);
    const meta = ss.getSheetByName('MODULE_META');
    if (meta) {
      meta.getRange('B4').setValue(form.getPublishedUrl());
      meta.getRange('B5').setValue(form.getId());
    }

    Logger.log('Created Workplace DISC Form ID: ' + form.getId());
    Logger.log('Live Form URL: ' + form.getPublishedUrl());
    return form.getPublishedUrl();
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * LIFEOS-v3 // PILLAR 2: WEALTH & SOVEREIGN TREASURY ALLOCATION ENGINE
 * File: src/pillars/p2_wealth/p2_allocation_engine.gs
 * ============================================================================
 * Strictly enforces LifeOS Laws 1–8:
 *  - Law 1/3: Never overwrites dynamic formulas in DASHBOARD, CALCULATIONS,
 *             DATABASE, or ASSETS_LEDGER columns G:I.
 *  - Law 2:   Modular, lock-guarded (`LockService.getScriptLock()`), idempotent.
 *  - Law 4:   Zero PII / account numbers logged or transmitted outside Pillar 2.
 *  - 40/20/20/20 Sovereign Allocation Protocol:
 *      40% War Chest (Fortress — Equities, Crypto, Emergency Cash, 3-Day Delay Lock)
 *      20% Business (The Canvas Nomad LLC)
 *      20% Global Travel (7 by 40 Reserve)
 *      20% Real Estate & Land Acquisition Reserve
 * ============================================================================
 */

const P2_CONSTANTS = Object.freeze({
  PILLAR_2_ID: '1NcqV_nHIXuyGz6SuwyXNZbh3AtazGOkuZcIZlTBxw5c',
  RAW_FINANCIAL_ID: '1xOFmsFQofqD0twsNOlLWIMe6buyn-du87n4M-fRyLZg',
  FINANCIAL_FORM_ID: '1v9vmAsluHo9jr49-BN-4XxLgUU3R6zV5j8sqpPVoTuY',
  LOCK_TIMEOUT_MS: 30000,
  TABS: {
    DASHBOARD: 'DASHBOARD',
    ASSETS_LEDGER: 'ASSETS_LEDGER',
    DATABASE: 'DATABASE',
    CALCULATIONS: 'CALCULATIONS',
    CONFIG: 'P2_CONFIG',
    SIGNALS_OUT: 'SIGNALS_OUT',
  },
  BUCKETS: [
    { name: 'War Chest (40%)', pct: 0.40, assetClass: 'Cash/Treasury', assetLabel: 'War Chest — 40% Allocation Tranche', custody: 'Fortress (3-Day Delay / Zero-Card)', liquidity: 'Tier 2 - 3-Day Delay' },
    { name: 'Business (20%)', pct: 0.20, assetClass: 'Business Capital', assetLabel: 'The Canvas Nomad LLC — 20% Tranche', custody: 'LLC Treasury Account', liquidity: 'Tier 1 - Instant Liquid' },
    { name: 'Global Travel (20%)', pct: 0.20, assetClass: 'Travel Reserve', assetLabel: 'Global Travel (7 by 40) — 20% Tranche', custody: 'Dedicated Travel Vault', liquidity: 'Tier 1 - Instant Liquid' },
    { name: 'Real Estate & Land (20%)', pct: 0.20, assetClass: 'Real Estate/Land', assetLabel: 'Real Estate & Land Reserve — 20% Tranche', custody: 'Sovereign Land Escrow', liquidity: 'Tier 4 - Illiquid / Land' },
  ],
});

/**
 * Adds the custom Pillar 2 Wealth & Treasury menu on spreadsheet open.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💰 Pillar 2: Wealth & Treasury')
    .addItem('⚡ Allocate Paycheck / Surplus (40/20/20/20)', 'promptAndAllocateSurplus')
    .addItem('🔄 Sync Latest Review Splits → ASSETS_LEDGER', 'syncLatestReviewAllocations')
    .addSeparator()
    .addItem('🛡️ Audit Scarcity vs [Freedom] Status', 'auditFinancialStatusAndGovernance')
    .addItem('📝 Upgrade Financial Review Form to v3.0 (In-Place)', 'upgradeFinancialReviewFormToV3')
    .addSeparator()
    .addItem('⚙️ Install Automated Pillar 2 Triggers', 'installP2Triggers')
    .addToUi();
}

/**
 * Interactive prompt to split any new paycheck or surplus across 40/20/20/20
 * and append clean capital allocation entries to ASSETS_LEDGER while preserving
 * blank-safe formulas in columns G:I.
 */
function promptAndAllocateSurplus() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    '⚡ 40/20/20/20 Sovereign Allocation Calculator',
    'Enter net surplus / paycheck amount (USD) to split across War Chest (40%), Business (20%), Global Travel (20%), and Real Estate & Land (20%):',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  const amount = parseFloat(String(resp.getResponseText()).replace(/[$,\s]/g, ''));
  if (!isFinite(amount) || amount <= 0) {
    ui.alert('Invalid Amount', 'Please enter a positive numeric dollar amount.', ui.ButtonSet.OK);
    return;
  }

  const result = allocateAmountToLedger_(amount, 'Manual Paycheck Split');
  const summary = result.splits.map(s => `• ${s.bucket}: $${s.amount.toFixed(2)}`).join('\n');
  ui.alert(
    '✅ 40/20/20/20 Capital Allocation Logged',
    `Total Allocated: $${amount.toFixed(2)}\n\n${summary}\n\nStatus Check: ${result.statusBadge}`,
    ui.ButtonSet.OK
  );
}

/**
 * Reads the latest un-allocated Financial Review from DATABASE (Row 2) and
 * appends 40/20/20/20 capital allocation entries to ASSETS_LEDGER.
 * Uses ScriptProperties to guarantee idempotency (never double-allocates the same review timestamp).
 */
function syncLatestReviewAllocations() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(P2_CONSTANTS.LOCK_TIMEOUT_MS)) {
    Logger.log('P2_ALLOC_SKIP: Lock busy.');
    return { status: 'LOCKED_SKIP' };
  }

  try {
    const ss = SpreadsheetApp.openById(P2_CONSTANTS.PILLAR_2_ID);
    const dbSheet = ss.getSheetByName(P2_CONSTANTS.TABS.DATABASE);
    if (!dbSheet || dbSheet.getLastRow() < 2) {
      return { status: 'NO_REVIEWS' };
    }

    const row = dbSheet.getRange(2, 1, 1, 29).getValues()[0];
    const timestamp = row[0] ? String(row[0]) : '';
    if (!timestamp) return { status: 'EMPTY_ROW' };

    const props = PropertiesService.getScriptProperties();
    const lastProcessed = props.getProperty('P2_LAST_ALLOCATED_TS') || '';
    if (lastProcessed === timestamp) {
      Logger.log('P2_ALLOC_IDEMPOTENT: Latest review already allocated.');
      return { status: 'ALREADY_PROCESSED' };
    }

    // Explicit bucket splits (Columns P..S -> indices 15..18) or fallback to Computed Net Surplus (Col AC -> index 28)
    const explicitSplits = [Number(row[15]) || 0, Number(row[16]) || 0, Number(row[17]) || 0, Number(row[18]) || 0];
    const explicitSum = explicitSplits.reduce((acc, v) => acc + v, 0);
    const computedSurplus = Number(row[28]) || 0;

    let splits;
    if (explicitSum > 0) {
      splits = P2_CONSTANTS.BUCKETS.map((b, i) => ({ meta: b, amount: round2_(explicitSplits[i]) }));
    } else if (computedSurplus > 0) {
      const targetWeights = readConfigBucketWeights_(ss);
      splits = P2_CONSTANTS.BUCKETS.map((b, i) => ({
        meta: b,
        amount: round2_(computedSurplus * (targetWeights[i] || b.pct)),
      }));
    } else {
      Logger.log('P2_ALLOC_NO_SURPLUS: No positive surplus or split values in latest review.');
      return { status: 'NO_POSITIVE_SURPLUS' };
    }

    appendSplitsToAssetsLedger_(ss, splits, 'Review Auto-Split');
    props.setProperty('P2_LAST_ALLOCATED_TS', timestamp);

    const statusObj = evaluateFinancialStatus_(ss);
    Logger.log(`P2_ALLOC_DONE: Logged 40/20/20/20 tranches. Financial status=${statusObj.status}`);
    return { status: 'ALLOCATED', financialStatus: statusObj };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lock-guarded allocator for an explicit dollar amount.
 * @param {number} totalAmount
 * @param {string} sourceTag
 * @returns {{splits: Array<{bucket: string, amount: number}>, statusBadge: string}}
 */
function allocateAmountToLedger_(totalAmount, sourceTag) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(P2_CONSTANTS.LOCK_TIMEOUT_MS)) {
    throw new Error('Pillar 2 Allocation Engine is currently busy. Please retry in a moment.');
  }

  try {
    const ss = SpreadsheetApp.openById(P2_CONSTANTS.PILLAR_2_ID);
    const targetWeights = readConfigBucketWeights_(ss);
    const splits = P2_CONSTANTS.BUCKETS.map((b, i) => ({
      meta: b,
      amount: round2_(totalAmount * (targetWeights[i] || b.pct)),
    }));

    appendSplitsToAssetsLedger_(ss, splits, sourceTag);
    const statusObj = evaluateFinancialStatus_(ss);
    return {
      splits: splits.map(s => ({ bucket: s.meta.name, amount: s.amount })),
      statusBadge: `${statusObj.status} (${statusObj.buffLabel})`,
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Appends non-zero allocation tranches into ASSETS_LEDGER without clobbering
 * blank-safe formulas in columns G (Unrealized_Gain_Loss), H (ROI_Pct), I (Portfolio_Share_Pct).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Array<{meta: Object, amount: number}>} splits
 * @param {string} sourceTag
 */
function appendSplitsToAssetsLedger_(ss, splits, sourceTag) {
  const sheet = ss.getSheetByName(P2_CONSTANTS.TABS.ASSETS_LEDGER);
  if (!sheet) throw new Error('ASSETS_LEDGER tab not found.');

  // Find first truly empty row in Column C (Asset_Name / Ticker)
  const colC = sheet.getRange(2, 3, Math.max(sheet.getMaxRows() - 1, 1), 1).getValues();
  let nextRow = 2;
  for (let i = 0; i < colC.length; i++) {
    if (String(colC[i][0]).trim() !== '') {
      nextRow = i + 3;
    }
  }

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  splits.forEach(item => {
    if (!item.amount || item.amount <= 0) return;

    if (nextRow > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), 20);
    }

    const r = nextRow;
    // Write static input columns A..F and J..K; inject blank-safe formulas into G..I
    sheet.getRange(r, 1, 1, 6).setValues([[
      item.meta.name,
      item.meta.assetClass,
      `${item.meta.assetLabel} (${sourceTag})`,
      item.meta.custody,
      item.amount,
      item.amount,
    ]]);
    sheet.getRange(r, 7, 1, 3).setFormulas([[
      `=IF(AND(ISBLANK(E${r}),ISBLANK(F${r})),"",IF(ISNUMBER(F${r}),F${r}-N(E${r}),""))`,
      `=IF(OR(ISBLANK(E${r}),E${r}=0,NOT(ISNUMBER(F${r}))),"",(F${r}-E${r})/E${r})`,
      `=IF(OR(ISBLANK(F${r}),NOT(ISNUMBER(F${r})),SUM($F$2:$F$200)=0),"",F${r}/SUM($F$2:$F$200))`,
    ]]);
    sheet.getRange(r, 10, 1, 2).setValues([[item.meta.liquidity, today]]);
    nextRow++;
  });
  SpreadsheetApp.flush();
}

/**
 * Evaluates COND_SCARCITY vs [Freedom] buff thresholds & 3-Day Withdrawal Delay Lock
 * from CALCULATIONS and displays an executive governance readout (no PII logged).
 */
function auditFinancialStatusAndGovernance() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(P2_CONSTANTS.LOCK_TIMEOUT_MS)) return;
  try {
    const ss = SpreadsheetApp.openById(P2_CONSTANTS.PILLAR_2_ID);
    const res = evaluateFinancialStatus_(ss);
    SpreadsheetApp.getUi().alert(
      '🛡️ Pillar 2 Governance & Status Audit',
      `Financial Level: ${res.levelDisplay}\n` +
      `Active Condition: ${res.status} — ${res.buffLabel}\n` +
      `Liquid Runway: ${res.runwayDisplay}\n` +
      `FIRE Progress: ${res.fireDisplay}\n` +
      `3-Day Withdrawal Delay / Zero-Card Lock: ${res.lockStatus}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reads live computed aggregate status flags from CALCULATIONS (strictly zero PII).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 */
function evaluateFinancialStatus_(ss) {
  const calc = ss.getSheetByName(P2_CONSTANTS.TABS.CALCULATIONS);
  const fire = calc.getRange('B15').getValue();
  const runway = calc.getRange('B16').getValue();
  const level = calc.getRange('B19').getValue();
  const status = String(calc.getRange('B20').getValue() || 'AWAITING_DATA');
  const lockStatus = String(calc.getRange('B24').getValue() || 'AWAITING_REVIEW');

  let buffLabel = 'Neutral / Building Fortress';
  if (status === 'COND_SCARCITY') {
    buffLabel = '[Scarcity] DEBUFF Active (-15% XP, Fortress Defense Mode)';
  } else if (status === 'SOVEREIGN_SURPLUS') {
    buffLabel = '[Freedom] BUFF Active (+15% Creativity & Autonomous Exploration XP)';
  }

  return {
    status,
    buffLabel,
    lockStatus,
    levelDisplay: level ? `Level ${level} / 5` : 'Awaiting Data',
    runwayDisplay: typeof runway === 'number' ? `${runway.toFixed(1)} months` : 'Awaiting Data',
    fireDisplay: typeof fire === 'number' ? `${fire.toFixed(1)}%` : 'Awaiting Data',
  };
}

/**
 * Reads tunable 40/20/20/20 weights from P2_CONFIG!F4:F7.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {number[]}
 */
function readConfigBucketWeights_(ss) {
  const cfg = ss.getSheetByName(P2_CONSTANTS.TABS.CONFIG);
  if (!cfg) return [0.40, 0.20, 0.20, 0.20];
  const vals = cfg.getRange('F4:F7').getValues().map(r => Number(r[0]));
  const sum = vals.reduce((a, b) => a + (isFinite(b) ? b : 0), 0);
  return sum > 0.99 && sum < 1.01 ? vals : [0.40, 0.20, 0.20, 0.20];
}

/**
 * Upgrades the existing `Life OS - Financial Review Form` IN-PLACE so it keeps its
 * exact responder URL and destination (`RAW_DATA_FinancialReview`), appending any
 * missing v3.0 Treasury & 40/20/20/20 Allocation Protocol questions.
 */
function upgradeFinancialReviewFormToV3() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(P2_CONSTANTS.LOCK_TIMEOUT_MS)) return;

  try {
    const form = FormApp.openById(P2_CONSTANTS.FINANCIAL_FORM_ID);
    const existingTitles = new Set(form.getItems().map(item => item.getTitle().trim().toLowerCase()));

    const sectionsToEnsure = [
      {
        header: 'Section 1: Cash Flow & Debt Baseline (v3.0)',
        desc: 'Tracks monthly gross income, fixed overhead, high-interest consumer debt, and net surplus.',
        items: [
          { type: 'TEXT', title: 'Primary Income Source / Vessel' },
          { type: 'TEXT', title: 'High-Interest Consumer Debt Balance ($)' },
          { type: 'TEXT', title: 'Net Monthly Surplus ($)' },
        ],
      },
      {
        header: 'Section 2: 40/20/20/20 Sovereign Allocation Audit',
        desc: 'War Chest (40%), The Canvas Nomad LLC (20%), Global Travel / 7-by-40 (20%), Real Estate & Land (20%).',
        items: [
          { type: 'TEXT', title: 'War Chest Allocation ($ — Target 40%)' },
          { type: 'TEXT', title: 'The Canvas Nomad LLC Business Allocation ($ — Target 20%)' },
          { type: 'TEXT', title: 'Global Travel / 7-by-40 Fund ($ — Target 20%)' },
          { type: 'TEXT', title: 'Real Estate & Land Acquisition Fund ($ — Target 20%)' },
        ],
      },
      {
        header: 'Section 3: Fortress & Portfolio Balances',
        desc: 'Measures Liquid Runway vs. $40,000 / 20-month LatAm/SEA anchor and FIRE productive capital.',
        items: [
          { type: 'TEXT', title: 'Liquid Emergency Runway Balance ($)' },
          { type: 'TEXT', title: 'Baseline Monthly Living Cost Abroad ($)' },
          { type: 'TEXT', title: 'Equities & Index Funds Value ($)' },
          { type: 'TEXT', title: 'Crypto & DeFi Treasury Value ($)' },
          { type: 'TEXT', title: 'Real Estate / Physical Land Equity ($)' },
        ],
      },
      {
        header: 'Section 4: Philanthropy, Stress & Governance Lock',
        desc: 'Audits Level 5 Legacy deployment, Financial Stress (1-10), and 3-Day Withdrawal Delay / Zero-Card Lock.',
        items: [
          { type: 'TEXT', title: 'Direct Philanthropic / Legacy Deployment ($)' },
          { type: 'SCALE', title: 'Financial Stress Level (1-10)', low: 1, high: 10, lowLabel: 'Sovereign Calm', highLabel: 'Acute Scarcity' },
          { type: 'CHOICE', title: '3-Day Withdrawal Delay / Zero-Card Lock Honored?', choices: ['YES — Honored', 'NO — Audit Required'] },
        ],
      },
    ];

    let addedCount = 0;
    sectionsToEnsure.forEach(sec => {
      const missing = sec.items.filter(q => !existingTitles.has(q.title.toLowerCase()));
      if (missing.length === 0) return;

      form.addPageBreakItem().setTitle(sec.header).setHelpText(sec.desc);
      missing.forEach(q => {
        if (q.type === 'SCALE') {
          form.addScaleItem()
            .setTitle(q.title)
            .setBounds(q.low, q.high)
            .setLabels(q.lowLabel, q.highLabel);
        } else if (q.type === 'CHOICE') {
          form.addMultipleChoiceItem()
            .setTitle(q.title)
            .setChoiceValues(q.choices);
        } else {
          form.addTextItem().setTitle(q.title);
        }
        addedCount++;
      });
    });

    // Ensure destination remains RAW_DATA_FinancialReview
    form.setDestination(FormApp.DestinationType.SPREADSHEET, P2_CONSTANTS.RAW_FINANCIAL_ID);
    Logger.log(`P2_FORM_UPGRADE: Added ${addedCount} missing v3.0 questions in-place.`);

    try {
      SpreadsheetApp.getUi().alert(
        '📝 Financial Review Form Upgraded (v3.0)',
        `In-place upgrade complete!\nQuestions added: ${addedCount}\nDestination verified: RAW_DATA_FinancialReview\nResponder link preserved.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {
      // Headless execution
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Installs a daily scheduled sync trigger (and cleans duplicate triggers) so
 * newly submitted reviews auto-allocate cleanly via LockService.
 */
function installP2Triggers() {
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach(t => {
    if (t.getHandlerFunction() === 'syncLatestReviewAllocations') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('syncLatestReviewAllocations')
    .timeBased()
    .everyHours(1)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '⚙️ Trigger Installed',
      'Hourly lock-guarded trigger installed for syncLatestReviewAllocations().',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (_) {}
}

/**
 * Rounds currency values cleanly to 2 decimal places.
 * @param {number} n
 * @returns {number}
 */
function round2_(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * ============================================================================
 * LifeOS v3.0 — 🎮 XP Leveler (ID_XP_HUB)
 * Production Apps Script: Daily Pillar XP Absorption Ledger Engine (Gate 2)
 * ============================================================================
 * Spreadsheet ID : 1_rVUsl98dIt_FO7qqVv1nC3r7jF1_Xg6Xo8QBNm2D4k
 * Bundled From   : src/utilities/xp_hub/xp_pillar_absorption.gs
 *
 * LAW 1 COMPLIANCE: Append-only daily XP absorption; never overwrites raw logs.
 * INSTALL: Extensions -> Apps Script -> Paste -> Run setupTriggers() once.
 * ============================================================================
 */

// --- BEGIN SOURCE: src/utilities/xp_hub/xp_pillar_absorption.gs ---
/**
 * ============================================================================
 * LIFEOS-v3 // XP LEVELER — UNIFIED PILLAR XP DELTA ABSORPTION ENGINE
 * File: src/utilities/xp_hub/xp_pillar_absorption.gs (Bound to: XP Leveler)
 * ============================================================================
 * Snapshots newly earned Pillar & Brick XP deltas (`P0`–`P6`, `Travel_Tracker`,
 * and `Achievements_Engine_Brick`) from `PILLAR_XP_ABSORPTION` into `XP_Ledger`
 * with timestamp, locked multiplier, and deterministic verification tag
 * (`ABSORB:<PILLAR_KEY>|<DATE>`).
 *
 * Zero Double-Counting Guarantee:
 *  - `PILLAR_XP_ABSORPTION!Col F` (`Previously_Absorbed_Quanta`) dynamically
 *    sums `XP_Ledger!Col E` matching `"ABSORB:<PILLAR_KEY>*"`.
 *  - As soon as a delta row is appended to `XP_Ledger`, its `Unabsorbed_Delta`
 *    in `PILLAR_XP_ABSORPTION!Col G` drops cleanly to `0`, keeping
 *    `Total Effective XP` (`Ledger + Unabsorbed`) strictly continuous!
 *  - Guarded by `LockService.getScriptLock()`, zero PII logged.
 * ============================================================================
 */

const XP_ABSORB_CFG = Object.freeze({
  XP_HUB_ID: '1_rVUsl98dIt_FO7qqVv1nC3r7jF1_Xg6Xo8QBNm2D4k',
  LOCK_TIMEOUT_MS: 30000,
  TABS: {
    ABSORPTION: 'PILLAR_XP_ABSORPTION',
    LEDGER: 'XP_Ledger',
    CONFIG: 'XP_Config_Hub',
  },
});

/**
 * Adds the custom `⚡ Life OS XP` menu to `XP Leveler` on open.
 */
function onOpenXpLegacy_() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ Life OS XP')
    .addItem('⚡ Absorb Pillar XP Deltas', 'syncPillarXpToLedger')
    .addSeparator()
    .addItem('⏰ Install Daily Pillar XP Absorption Trigger (23:50)', 'installDailyXpAbsorptionTrigger')
    .addToUi();
}

/**
 * Reads `PILLAR_XP_ABSORPTION!A2:I10` for any Pillar/Brick with `Unabsorbed_Delta_Quanta > 0`,
 * appends a permanent snapshot row into `XP_Ledger` (`A:H`) with the locked daily
 * multiplier and `ABSORB:<PILLAR_KEY>|<DATE>` verification tag.
 */
function syncPillarXpToLedger() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(XP_ABSORB_CFG.LOCK_TIMEOUT_MS)) {
    Logger.log('XP_ABSORB_SKIP: Lock busy.');
    return { status: 'LOCKED_SKIP', absorbedCount: 0, absorbedXp: 0 };
  }

  try {
    const ss = SpreadsheetApp.openById(XP_ABSORB_CFG.XP_HUB_ID);
    const absSheet = ss.getSheetByName(XP_ABSORB_CFG.TABS.ABSORPTION);
    const ledSheet = ss.getSheetByName(XP_ABSORB_CFG.TABS.LEDGER);
    const cfgSheet = ss.getSheetByName(XP_ABSORB_CFG.TABS.CONFIG);
    if (!absSheet || !ledSheet) {
      throw new Error('Missing PILLAR_XP_ABSORPTION or XP_Ledger tab.');
    }

    const quantumXp = Number(cfgSheet ? cfgSheet.getRange('B2').getValue() : 137) || 137;
    const rows = absSheet.getRange(2, 1, 9, 9).getValues();
    const now = new Date();
    const dateTag = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    let absorbedCount = 0;
    let totalAbsorbedXp = 0;

    rows.forEach(r => {
      const pillarKey = String(r[0] || '').trim();
      const signalKey = String(r[1] || '').trim();
      const sephirahMap = String(r[2] || '').trim();
      const deltaQuanta = Number(r[6]) || 0;
      const lockedMult = Number(r[7]) || 1;

      if (!pillarKey || deltaQuanta <= 0.01) return;

      const roundedQuanta = Math.round(deltaQuanta * 100) / 100;
      const effectiveXp = Math.round(roundedQuanta * quantumXp * lockedMult);
      if (effectiveXp <= 0) return;

      // Exact 8-column XP_Ledger schema:
      // A:Timestamp, B:Sephirah/Pillar, C:Element/Domain, D:Completed Action,
      // E:Base Quanta (137s), F:Locked Multiplier, G:Awarded XP, H:Verification/Artifact
      ledSheet.appendRow([
        now,
        sephirahMap,
        pillarKey,
        `Auto-Absorbed Pillar XP Delta (${signalKey})`,
        roundedQuanta,
        Math.round(lockedMult * 1000) / 1000,
        effectiveXp,
        `ABSORB:${pillarKey}|${dateTag}`,
      ]);

      absorbedCount++;
      totalAbsorbedXp += effectiveXp;
    });

    if (absorbedCount > 0) SpreadsheetApp.flush();
    Logger.log(`XP_ABSORB_OK: streams=${absorbedCount}, effectiveXp=${totalAbsorbedXp}`);

    try {
      SpreadsheetApp.getUi().alert(
        '⚡ Pillar XP Deltas Absorbed',
        absorbedCount > 0
          ? `Absorbed ${absorbedCount} Pillar XP stream(s) into XP_Ledger.\nTotal Effective XP Snapshotted: +${totalAbsorbedXp.toLocaleString('en-US')} XP`
          : 'All Pillar XP streams are already 100% absorbed into XP_Ledger (0 pending delta).',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {}

    return { status: 'OK', absorbedCount, absorbedXp: totalAbsorbedXp };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Installs a daily 11:50 PM trigger to lock in each day's Pillar XP deltas
 * at that day's live multiplier.
 */
function installDailyXpAbsorptionTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncPillarXpToLedger') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('syncPillarXpToLedger')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(50)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '⏰ Daily Pillar XP Trigger Installed',
      'syncPillarXpToLedger() will now automatically absorb Pillar XP deltas nightly around 11:50 PM.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (_) {}
}
// --- END SOURCE: src/utilities/xp_hub/xp_pillar_absorption.gs ---

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎮 LifeOS XP Leveler')
    .addItem('Absorb Daily Pillar XP -> XP_Ledger Now', 'syncPillarXpToLedger')
    .addSeparator()
    .addItem('Install / Reset Daily XP Trigger', 'setupTriggers')
    .addToUi();
}

/**
 * ONE-CLICK MASTER INSTALLER:
 *   1) Daily at 11:55 PM -> syncPillarXpToLedger
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'syncPillarXpToLedger') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('syncPillarXpToLedger')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(55)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ XP Leveler Trigger Armed!\n\n' +
      '• Daily 11:55 PM → syncPillarXpToLedger'
    );
  } catch (e) {
    Logger.log('XP Leveler trigger armed (headless run).');
  }
}

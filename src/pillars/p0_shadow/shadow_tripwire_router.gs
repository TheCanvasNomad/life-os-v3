/**
 * ============================================================================
 * LIFEOS-v3 // PILLAR 0: CROSS-PILLAR SHADOW TRIPWIRE ROUTER
 * File: src/pillars/p0_shadow/shadow_tripwire_router.gs
 * ============================================================================
 * Monitors cross-pillar shadow drift signals in `CONTEXT_IN`:
 *   - `P3_SHADOW_FLAGS_30D > 0`       (Pillar 3 Sleeper / Relational Misalignment)
 *   - `P4_PROCRASTINATION_FLAG`       (Pillar 4 Productive Procrastination)
 *   - `VALUES_ALIGNMENT_SCORE < 60`   (Values Alignment Drift)
 *   - `DOPPELGANGER_DOMINATION_INDEX > 50` (Shadow Arena Domination)
 *
 * When any tripwire fires, injects a targeted `[Healing_Quest]` directly into
 * Layer 1 `RAW_DATA_Quests` (16-column v3.0 schema), guarded by `LockService`
 * and daily deduplication via `ScriptProperties`.
 * Strictly zero private journal prose or PII is transmitted.
 * ============================================================================
 */

const P0_TRIPWIRE_CFG = Object.freeze({
  PILLAR_0_ID: '1dst5RTOgaIBr6EsXkuuqK5p18fSxnP3wUsn6gmhx-LU',
  RAW_QUESTS_ID: '1uV7FXlTU--gHFOt7zWYRkDxGk15QXIPGbBcshkk4TVw',
  LOCK_TIMEOUT_MS: 30000,
  THRESHOLDS: {
    VALUES_ALIGNMENT_FLOOR: 60,
    DOPPELGANGER_DOMINATION_CEILING: 50,
  },
});

/**
 * Checks all live cross-pillar tripwires in `CONTEXT_IN` and appends targeted
 * `[Healing_Quest]` prompts into `RAW_DATA_Quests` (deduplicated per day).
 */
function routeShadowTripwiresToQuests() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(P0_TRIPWIRE_CFG.LOCK_TIMEOUT_MS)) {
    Logger.log('P0_TRIPWIRE_SKIP: Lock busy.');
    return { status: 'LOCKED_SKIP', injected: 0 };
  }

  try {
    const p0Ss = SpreadsheetApp.openById(P0_TRIPWIRE_CFG.PILLAR_0_ID);
    const ctxSheet = p0Ss.getSheetByName('CONTEXT_IN');
    if (!ctxSheet || ctxSheet.getLastRow() < 2) {
      return { status: 'NO_CONTEXT', injected: 0 };
    }

    const rows = ctxSheet.getRange(2, 1, ctxSheet.getLastRow() - 1, 5).getValues();
    const signals = {};
    rows.forEach(r => {
      const key = String(r[0] || '').trim();
      if (!key) return;
      signals[key] = { raw: r[2], norm: r[3], status: String(r[4] || '') };
    });

    const todayKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const props = PropertiesService.getScriptProperties();
    const triggeredQuests = [];

    // Tripwire 1: Pillar 3 Sleeper Misalignment (P3_SHADOW_FLAGS_30D > 0)
    const p3Raw = Number(signals['P3_SHADOW_FLAGS_30D'] && signals['P3_SHADOW_FLAGS_30D'].raw);
    if (isFinite(p3Raw) && p3Raw > 0) {
      triggeredQuests.push({
        dedupKey: `TRIPWIRE_P3_${todayKey}`,
        name: '[Healing_Quest] P3 Relational Shadow & Boundary Audit',
        desc: `P3_SHADOW_FLAGS_30D=${p3Raw} detected. Complete one Level 4-5 RCMC Shadow Journal entry examining relational boundary drift, sleeper misalignment, or Pleaser/Avoider hijack.`,
        coreValues: 'Sovereignty, Integrity, Authenticity',
        importance: 9,
        urgency: 8,
        blooms: 'Evaluate',
        hours: 0.75,
      });
    }

    // Tripwire 2: Pillar 4 Productive Procrastination (P4_PROCRASTINATION_FLAG)
    const p4Val = signals['P4_PROCRASTINATION_FLAG'] ? signals['P4_PROCRASTINATION_FLAG'].raw : '';
    const p4Str = String(p4Val || '').trim().toUpperCase();
    const p4Active = p4Str === 'ACTIVE' || p4Str === 'TRUE' || p4Str === 'YES' || (isFinite(Number(p4Val)) && Number(p4Val) > 0);
    if (p4Active) {
      triggeredQuests.push({
        dedupKey: `TRIPWIRE_P4_${todayKey}`,
        name: '[Healing_Quest] Intercept Avoider Saboteur (Sage Activate Drill)',
        desc: 'P4 Productive Procrastination tripwire active. Run 3 tactile PQ Reps (30s), log the avoided friction in Shadow Journal (RCMC Level 3+), and execute the first 15-minute Gravity Action Step immediately.',
        coreValues: 'Mastery, Discipline, Courage',
        importance: 9,
        urgency: 9,
        blooms: 'Analyze',
        hours: 0.5,
      });
    }

    // Tripwire 3: Values Alignment Drift (VALUES_ALIGNMENT_SCORE < 60)
    const vaNorm = Number(signals['VALUES_ALIGNMENT_SCORE'] && signals['VALUES_ALIGNMENT_SCORE'].norm);
    if (isFinite(vaNorm) && vaNorm > 0 && vaNorm < P0_TRIPWIRE_CFG.THRESHOLDS.VALUES_ALIGNMENT_FLOOR) {
      triggeredQuests.push({
        dedupKey: `TRIPWIRE_VA_${todayKey}`,
        name: '[Healing_Quest] Values Alignment Re-Centering Excavation',
        desc: `VALUES_ALIGNMENT_SCORE dropped to ${vaNorm.toFixed(1)} (<60 floor). Conduct a Level 5 RCMC Root Belief Refutation in Shadow Journal and align next 48h actions with True Will.`,
        coreValues: 'True Will, Clarity, Alignment',
        importance: 10,
        urgency: 8,
        blooms: 'Evaluate',
        hours: 1.0,
      });
    }

    // Tripwire 4: Shadow Arena Domination (DOPPELGANGER_DOMINATION_INDEX > 50)
    const dopNorm = Number(signals['DOPPELGANGER_DOMINATION_INDEX'] && signals['DOPPELGANGER_DOMINATION_INDEX'].norm);
    if (isFinite(dopNorm) && dopNorm > P0_TRIPWIRE_CFG.THRESHOLDS.DOPPELGANGER_DOMINATION_CEILING) {
      triggeredQuests.push({
        dedupKey: `TRIPWIRE_DOP_${todayKey}`,
        name: '[Healing_Quest] Shadow Arena Counter-Offensive (Grip Recovery)',
        desc: `DOPPELGANGER_DOMINATION_INDEX at ${dopNorm.toFixed(1)} (>50 threshold). Identify the dominant Saboteur trigger in Shadow Journal and reclaim a clean 24-hour discipline block.`,
        coreValues: 'Discipline, Antifragility, Sovereignty',
        importance: 10,
        urgency: 9,
        blooms: 'Apply',
        hours: 0.75,
      });
    }

    const questsToInsert = triggeredQuests.filter(q => !props.getProperty(q.dedupKey));
    if (questsToInsert.length === 0) {
      Logger.log('P0_TRIPWIRE_CLEAR: No new Healing Quests needed.');
      return { status: 'CLEAR', injected: 0 };
    }

    const questsSs = SpreadsheetApp.openById(P0_TRIPWIRE_CFG.RAW_QUESTS_ID);
    const questsSheet = questsSs.getSheetByName('Form Responses 1') || questsSs.getSheets()[0];
    const now = new Date();
    const targetDate = Utilities.formatDate(
      new Date(now.getTime() + 48 * 3600 * 1000),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    questsToInsert.forEach(q => {
      // Exact 16-column v3.0 RAW_DATA_Quests schema
      questsSheet.appendRow([
        now,                              // A: Timestamp
        q.name,                           // B: Quest Name
        q.desc,                           // C: Description
        'Pillar 0: Shadow Self',          // D: Primary Pillar
        'Side Quest (Healing)',           // E: Quest Tier
        'Pillar 0 Shadow Integration',    // F: Parent Quest
        targetDate,                       // G: Target Completion Date
        q.coreValues,                     // H: CORE Values
        q.importance,                     // I: Importance (1-10)
        q.urgency,                        // J: Urgency (1-10)
        q.blooms,                         // K: Bloom's Cognitive Level
        q.hours,                          // L: Time Benchmark (Hours)
        '',                               // M: Actual Hours
        'Not Started',                    // N: Status
        '[Healing_Quest]',                // O: Special Flags
        '',                               // P: Calendar_Event_ID
      ]);
      props.setProperty(q.dedupKey, now.toISOString());
    });

    SpreadsheetApp.flush();
    Logger.log(`P0_TRIPWIRE_INJECTED: count=${questsToInsert.length}`);

    try {
      SpreadsheetApp.getUi().alert(
        '🚨 Shadow Tripwire Router Complete',
        `Injected ${questsToInsert.length} targeted [Healing_Quest] prompt(s) into RAW_DATA_Quests.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (_) {}

    return { status: 'INJECTED', injected: questsToInsert.length };
  } finally {
    lock.releaseLock();
  }
}

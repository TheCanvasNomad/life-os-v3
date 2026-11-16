# 🧠 LifeOS v3.0 — Modular RPG Operating System

> **Last Synced:** `2026-11-16 11:43 UTC` | **Architecture:** Hub-and-Spoke Lego-Brick Engine

A bidirectional, dynamic personal operating system built on Google Sheets, Google Colab, and GitHub—translating daily lived reality into quantifiable telemetry, Kabbalah skill-tree progression, and state-reactive guidance.

---

## 🧩 Active Lego Brick Registry

| Brick_Name | Glyph | Domain_Pillar | Cadence_Tier | Status | Signals_Published | Context_Subscribed | Last_Synced |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LifeOS_feed_hub | 🧠 | Central Command & Telemetry Router | Real-Time | ACTIVE | ALL_SIGNAL_BUS_KEYS | ALL_BRICKS | 2026-11-16 11:06:42 UTC |
| Daily_Intake_Brick | 🧭 | Multi-Branch Daily State, Gunas, Flow & Kabbalah Pillars | Daily | ACTIVE | DAILY_ENERGY, DAILY_MOOD, ACUTE_STRESS, FLOW_COHERENCE, KABBALAH_BALANCE | MASLOW_SURVIVAL, MASLOW_SAFETY, ZODIAC_ALIGNMENT, HD_STRATEGY_COHERENCE | 2026-11-16 11:06:42 UTC |
| Weekly_Maslow_Pulse | 🏛️ | Maslow 5-Tier Foundational Stability | Weekly | ACTIVE | MASLOW_SURVIVAL, MASLOW_SAFETY, MASLOW_BELONGING, MASLOW_ESTEEM, MASLOW_ACTUALIZATION | DAILY_ENERGY, ACUTE_STRESS | 2026-11-16 11:06:42 UTC |
| Zodiac_Brick | ♈ | Natal Archetype, Planetary Transits & Cosmic Timing | Immutable Natal + Daily Transit | ACTIVE | ZODIAC_ALIGNMENT, SOLAR_MOMENTUM, LUNAR_REGULATION | DAILY_ENERGY, DAILY_MOOD, ACUTE_STRESS, MASLOW_SURVIVAL | 2026-11-16 11:09:37 UTC |
| Human_Design_Brick | 🧬 | Energetic Strategy, Inner Authority & Deconditioning | Immutable Natal + Real-Time Strategy | ACTIVE | HD_STRATEGY_COHERENCE, AUTHORITY_CLARITY, CENTER_CONDITIONING_LOAD | DAILY_ENERGY, DAILY_MOOD, ACUTE_STRESS, MASLOW_SURVIVAL, ZODIAC_ALIGNMENT | 2026-11-16 11:13:05 UTC |
| Four_Temperaments_Brick | 🎭 | Classical Behavioral Architecture & Tier 2 Psychometric Buffs | Monthly / Ad-Hoc (TTL: 720h) | ACTIVE | TEMPERAMENT_EQUILIBRIUM, CHOLERIC_DRIVE_INDEX, MELANCHOLIC_PRECISION_INDEX | DAILY_ENERGY, DAILY_MOOD, ACUTE_STRESS, MASLOW_SURVIVAL, ZODIAC_ALIGNMENT, HD_STRATEGY_COHERENCE | 2026-11-16 11:15:16 UTC |
| Dynamic_Stress_Brick | 🌡️ | Allostatic Load, Nervous System Regulation & Tier 3 Live Modifiers | Monthly / Ad-Hoc + Real-Time Pass-2 | ACTIVE | STRESS_ALLOSTATIC_LOAD, SOMATIC_RECOVERY_CAPACITY, CONTEXT_ADJUSTED_STRAIN | DAILY_ENERGY, DAILY_MOOD, ACUTE_STRESS, MASLOW_SURVIVAL, MASLOW_SAFETY, HD_STRATEGY_COHERENCE, TEMPERAMENT_EQUILIBRIUM | 2026-11-16 11:18:20 UTC |
| Doppelganger_Brick | 👤 | Pillar 0 Shadow Integration, Loss Aversion & Shadow Tax Engine | Real-Time Tug-of-War + Daily Streak | ACTIVE | SHADOW_TAX_RATE, DOPPELGANGER_DOMINATION_INDEX, REDEMPTION_STREAK_DAYS | INTAKE_DISCIPLINE_DELTA, INTAKE_VICE_DELTA, DAILY_ENERGY, ACUTE_STRESS, STRESS_ALLOSTATIC_LOAD, HD_STRATEGY_COHERENCE | 2026-11-16 11:35:32 UTC |

---

## 📡 Active `SIGNAL_BUS` Telemetry Keys

| Signal_Key | Source_Brick | Glyph | Freshness_Status |
| --- | --- | --- | --- |
| DAILY_ENERGY | Daily_Intake_Brick | ⚡ | STALE |
| DAILY_MOOD | Daily_Intake_Brick | 🧭 | STALE |
| ACUTE_STRESS | Daily_Intake_Brick | 🔥 | STALE |
| FLOW_COHERENCE | Daily_Intake_Brick | 🌊 | STALE |
| KABBALAH_BALANCE | Daily_Intake_Brick | ⚖️ | STALE |
| MASLOW_SURVIVAL | Weekly_Maslow_Pulse | ⚓ | STALE |
| MASLOW_SAFETY | Weekly_Maslow_Pulse | 🛡️ | STALE |
| MASLOW_BELONGING | Weekly_Maslow_Pulse | 🤝 | STALE |
| MASLOW_ESTEEM | Weekly_Maslow_Pulse | ⚔️ | STALE |
| MASLOW_ACTUALIZATION | Weekly_Maslow_Pulse | 🌌 | STALE |
| ZODIAC_ALIGNMENT | Zodiac_Brick | ♈ | STALE |
| HD_STRATEGY_COHERENCE | Human_Design_Brick | 🧬 | STALE |
| SOLAR_MOMENTUM | Zodiac_Brick | ☀️ | STALE |
| LUNAR_REGULATION | Zodiac_Brick | 🌙 | STALE |
| AUTHORITY_CLARITY | Human_Design_Brick | 🔮 | STALE |
| CENTER_CONDITIONING_LOAD | Human_Design_Brick | 🛡️ | STALE |
| TEMPERAMENT_EQUILIBRIUM | Four_Temperaments_Brick | 🎭 | STALE |
| CHOLERIC_DRIVE_INDEX | Four_Temperaments_Brick | 🔥 | STALE |
| MELANCHOLIC_PRECISION_INDEX | Four_Temperaments_Brick | 📐 | STALE |
| STRESS_ALLOSTATIC_LOAD | Dynamic_Stress_Brick | 🌡️ | STALE |
| SOMATIC_RECOVERY_CAPACITY | Dynamic_Stress_Brick | 🔋 | STALE |
| CONTEXT_ADJUSTED_STRAIN | Dynamic_Stress_Brick | ⚖️ | STALE |
| INTAKE_DISCIPLINE_DELTA | Daily_Intake_Brick | ⚔️ | FRESH |
| INTAKE_VICE_DELTA | Daily_Intake_Brick | 🩸 | FRESH |
| SHADOW_TAX_RATE | Doppelganger_Brick | 👤 | STALE |
| DOPPELGANGER_DOMINATION_INDEX | Doppelganger_Brick | 🌑 | STALE |
| REDEMPTION_STREAK_DAYS | Doppelganger_Brick | 🔥 | STALE |

---

## 📂 Repository Blueprints & Schemas

- `blueprints/phase_1_1_feed_hub_blueprint.md`
- `blueprints/phase_1_2_cadence_pulses_blueprint.md`
- `blueprints/phase_2_1_zodiac_brick_blueprint.md`
- `blueprints/phase_2_2_human_design_brick_blueprint.md`
- `blueprints/phase_3_1_four_temperaments_blueprint.md`
- `blueprints/phase_3_2_dynamic_stress_blueprint.md`
- `blueprints/phase_4_1_doppelganger_brick_blueprint.md`
- `schemas/daily_intake_brick_schema.json`
- `schemas/doppelganger_brick_schema.json`
- `schemas/dynamic_stress_brick_schema.json`
- `schemas/four_temperaments_brick_schema.json`
- `schemas/human_design_brick_schema.json`
- `schemas/lifeos_feed_hub_schema.json`
- `schemas/weekly_maslow_pulse_schema.json`
- `schemas/zodiac_brick_schema.json`

---

## ⚙️ Core Architectural Laws
1. **Lego-Brick Modularity:** Every framework runs in its own standalone workbook with its own glyph and standardized 3-Tab Connector (`MODULE_META`, `CONTEXT_IN`, `SIGNALS_OUT`).
2. **100% Dynamic Advisory (`Archetype × Live State`):** Zero canned personality paragraphs—all guidance reacts live to telemetry and transits.
3. **Zero-Hardcode Security:** All real Spreadsheet IDs, Document IDs, and API tokens remain strictly inside private Colab Secrets and Google Sheets (`{{PLACEHOLDER}}` tokens only on public GitHub).

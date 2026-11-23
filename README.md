# 🧠 LifeOS v3.0 — Universal Stat-Driven Personal Telemetry & RPG Engine

> 100% general, stat-driven Hub-and-Spoke Personal Operating System built on Google Sheets, Google Forms, Apps Script, and Google Colab. Zero user-specific hardcoding—every KPI card, visual gauge, and advisory directive resolves dynamically from live assessment scores and telemetry state.

## 🧩 Active Lego Brick Registry

| Lego Brick | Glyph | Pillar / Domain | Cadence Tier | Status |
| :--- | :---: | :--- | :--- | :---: |
| `LifeOS_feed_hub` | 🧠 | Central Command & `SIGNAL_BUS` | Real-Time | 🟢 ONLINE |
| `Doppelgänger_Score` | 🪞 | Shadow & Alignment Telemetry | Weekly | 🟢 ONLINE |
| `MBTI_Cognitive_Stack` | 🧩 | I - Subjective (Universal Cognitive Stack & Shadow) | 6-Month + Live State | 🟢 ONLINE |
| `Enneagram_Tritype_Engine` | 🔯 | I - Subjective (Universal Core Motivation & 5 Pillars) | 6-Month + Live State | 🟢 ONLINE |
| `Kabbalah_Tree_of_Life` | 🌳 | Holistic 10-Sephirot + Da'at & 22 Paths | Monthly + Live Bus | 🟢 ONLINE |
| `Big_Five_OCEAN` | 🧬 | I / IT - Universal Biological Hardware Engine | 6-Month IPIP-50 | 🟢 ONLINE |
| `Human_Design_OS` | 💠 | Tier 1 Natal - Universal BodyGraph & Strategy Engine | Immutable Natal + Transits | 🟢 ONLINE |

## 📡 Active `SIGNAL_BUS` Telemetry Keys

- `SYS_HEARTBEAT` — Master system pulse (`TTL: 24h`)
- `VITAL_HP` / `VITAL_MANA` / `VITAL_STAMINA` / `VITAL_COHERENCE` / `STREAK_DAYS`
- `MBTI_TYPE_CODE` / `MBTI_COHERENCE_INDEX` / `MBTI_SHADOW_RISK`
- `ENN_INTEGRATION_INDEX` / `ENN_DISINTEGRATION_RISK`
- `KAB_EFFECTIVE_QUALITY` / `KAB_PILLAR_EQUILIBRIUM` / `KAB_GROUNDING_INDEX` / `KAB_HOD_SPREAD` / `KAB_NET_XP_MULT`
- `OCEAN_OPENNESS` / `OCEAN_CONSCIENTIOUSNESS` / `OCEAN_EXTRAVERSION` / `OCEAN_AGREEABLENESS` / `OCEAN_NEUROTICISM` / `OCEAN_PLASTICITY_BETA` / `OCEAN_STABILITY_ALPHA`
- `HD_STRATEGY_COHERENCE` / `HD_AUTHORITY_CLARITY` / `HD_CONDITIONING_LOAD` / `HD_BIO_READINESS`

*Last Automated Sync: 2026-11-20 17:15:59 UTC*

---

## 🏛️ LifeOS-v3 Immutable Architectural Laws

All code, schemas, formulas, and documentation in this repository are governed by the permanent workspace skill at [`.agents/skills/lifeos-architect/SKILL.md`](./.agents/skills/lifeos-architect/SKILL.md):

1. **Three-Layer Hub-and-Spoke Data Flow**: `Input Forms -> Raw Data Silos (write-only, never edited) -> Pillar Engines (Pillar 0 Shadow Self – Pillar 6 Esoteric Self + BIO_CORE & CRM_CORE) -> Core OS Hub` (`CHARACTER_SHEET`, `RULES_ENGINE`, `AQAL_VIEW`, `SWORD_VIEW`, `IMPORTS`, `AI_Synthesis_Report`).
2. **Modular Code Architecture**: Monolithic `.gs` files are forbidden; every Apps Script project must be compartmentalized into single-purpose modules (`main.gs`, `rules_engine_automations.gs`, `ecosystem_integrators.gs`, `report_generator.gs`, `utilities.gs`).
3. **Closed-Loop Input & Blank-Cell Preservation**: Forms prioritize structured inputs (dropdowns, linear scales, checkboxes) over free-text, and spreadsheet formulas preserve blank cells (`IF(ISBLANK(...), "", ...)`) without emitting false `0`s or `"N/A"`.
4. **Brick Exchange Contract**: All standalone Bricks expose standardized `CONTEXT_IN` and `SIGNALS_OUT` / `PRIMARY SPOKE MIRROR` blocks for `IMPORTRANGE` or Apps Script ingestion into `LifeOS_Master_Bus`.
5. **Governor & Telemetry Alignment**: Enforce the `OPS_GOVERNOR` WIP ceiling (max 2 active initiatives) and emit clean Markdown/Doc synthesis outputs for NotebookLM and Gemini.
6. **Automated Git & Colab Sync**: Always `git pull --rebase origin main` before starting any task, audit `.gitignore` for secrets/credentials, then `git add -A`, commit with a Conventional Commit message, and `git push origin main` upon completion.

## 📂 Workspace Directory Structure

```text
.
├── .agents/
│   └── skills/
│       └── lifeos-architect/
│           ├── SKILL.md
│           └── scripts/
│               └── git_autosync.sh
├── blueprints/
├── colab_notebooks/
│   └── README.md
├── schemas/
├── docs/
└── src/
    ├── core_os_hub/
    ├── pillars/
    ├── utilities/
    │   ├── biometric_core/
    │   └── crm_core/
    ├── bricks_sync/
    └── android_hud/
```

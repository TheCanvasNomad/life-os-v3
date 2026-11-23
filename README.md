# LifeOS-v3

Modular personal operating system built on a unidirectional Three-Layer Hub-and-Spoke architecture.

## Architectural Laws

All code, schemas, formulas, and documentation in this repository are governed by the workspace skill at [`.agents/skills/lifeos-architect/SKILL.md`](./.agents/skills/lifeos-architect/SKILL.md):

1. **Three-Layer Hub-and-Spoke Data Flow**: `Input Forms -> Raw Data Silos (write-only) -> Pillar Engines (Pillar 0–6 + BIO_CORE & CRM_CORE) -> Core OS Hub` (`CHARACTER_SHEET`, `RULES_ENGINE`, `AQAL_VIEW`, `SWORD_VIEW`, `IMPORTS`, `AI_Synthesis_Report`).
2. **Modular Code Architecture**: No monolithic `.gs` files; single-purpose Apps Script modules only.
3. **Closed-Loop Input & Blank-Cell Preservation**: Structured form inputs and `IF(ISBLANK(...), "", ...)` blank-safe formulas (no false `0`s or `"N/A"`).
4. **Brick Exchange Contract**: Standardized `CONTEXT_IN` and `SIGNALS_OUT` / `PRIMARY SPOKE MIRROR` blocks for all standalone Bricks into `LifeOS_Master_Bus`.
5. **Governor & Telemetry Alignment**: `OPS_GOVERNOR` WIP ceiling (max 2 active initiatives) and clean Markdown/Doc synthesis outputs for NotebookLM and Gemini.

## Directory Structure

```text
.
├── .agents/
│   └── skills/
│       └── lifeos-architect/
│           └── SKILL.md
├── src/
│   ├── core_os_hub/
│   ├── pillars/
│   ├── utilities/
│   │   ├── biometric_core/
│   │   └── crm_core/
│   ├── bricks_sync/
│   └── android_hud/
├── schemas/
└── docs/
```

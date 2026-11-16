# LifeOS v3.0 — Phase 3.1: Four Temperaments Brick (`🎭`) Blueprint

## Architecture Summary
- **Workbook:** `Four_Temperaments_Brick` (`{{FOUR_TEMPERAMENTS_BRICK_ID}}`)
- **Topology:** Two-Pass Hub-and-Spoke via `LifeOS_feed_hub` (`{{LIFEOS_FEED_HUB_ID}}`).
- **Pass 1 (`TEMPERAMENT_ASSESSMENT` → `SIGNALS_OUT`):** Closed-loop 16-item diagnostic (`1–5` strict dropdowns, blank-safe) calculating Choleric, Sanguine, Melancholic, and Phlegmatic composites, overall `TEMPERAMENT_EQUILIBRIUM`, and Tier 2 Psychometric Stat Modifiers (`RULES_ENGINE` `Base × Traits × Live State`).
- **Pass 2 (`CONTEXT_IN` → `ADVISORY_MATRIX`):** Dynamically cross-references live `DAILY_ENERGY`, `DAILY_MOOD`, and `ACUTE_STRESS` triggers against the four classical temperaments via `INDEX/MATCH`—zero static archetype paragraphs.

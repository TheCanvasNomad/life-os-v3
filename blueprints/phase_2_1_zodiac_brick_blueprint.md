# LifeOS v3.0 — Phase 2.1: Zodiac Brick (`♈`) Blueprint

## Architecture Summary
- **Workbook:** `Zodiac_Brick` (`{{ZODIAC_BRICK_ID}}`)
- **Topology:** Two-Pass Hub-and-Spoke via `LifeOS_feed_hub` (`{{LIFEOS_FEED_HUB_ID}}`).
- **Pass 1 (`NATAL_BLUEPRINT` + `TRANSIT_RADAR` → `SIGNALS_OUT`):** Computes immutable elemental stat modifiers (`HP_Vitality`, `Mana_Focus`, `Stamina_Recovery`, `Coherence_Alignment`) and live daily Tropical Sun ingress, Chaldean Day Ruler, and Synodic Lunar Phase (`ZODIAC_ALIGNMENT`, `SOLAR_MOMENTUM`, `LUNAR_REGULATION`) using native `TODAY()` formulas.
- **Pass 2 (`CONTEXT_IN` → `ADVISORY_MATRIX`):** Dynamically cross-references live `DAILY_ENERGY`, `DAILY_MOOD`, and `ACUTE_STRESS` triggers against Natal Archetypes via `INDEX/MATCH`—zero static horoscope text.

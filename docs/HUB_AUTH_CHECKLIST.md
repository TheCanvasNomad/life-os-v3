# LifeOS-v3 Hub `IMPORTRANGE` Browser Authorization Checklist

> **Why this checklist exists**: Google Sheets requires a one-time interactive browser click (**"Allow access"** on a `#REF!` cell) for each new cross-spreadsheet `IMPORTRANGE` connection. APIs and scripts cannot grant this permission on your behalf.  
> **Last Audited**: `2026-11-23`

---

## 1. `LifeOS_feed_hub` — Fast One-Tab Authorization (All 23 Bricks in One Column)

To make approval effortless (since `SIGNAL_BUS` wraps `IMPORTRANGE` inside `IFERROR` for clean UI rendering), a dedicated **`One_Click_Auth_Anchor`** column (`J3:J25`) has been added to **`MODULE_REGISTRY`**.

**Open this tab directly in your browser:**  
https://docs.google.com/spreadsheets/d/1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U/edit#gid=259593998

Click each `#REF!` cell down Column `J` and press the blue **"Allow access"** button. Approving each row unlocks all downstream `SIGNAL_BUS`, `AQAL_VIEW`, `SWORD_VIEW`, `MASLOW_ENGINE`, `DOPPELGANGER`, `CHARACTER_SHEET`, and `AI_Synthesis_Report` metrics for that Brick automatically:

| Done | Cell | Target Brick / Workbook | Spreadsheet ID | Unlocks in `SIGNAL_BUS` & Hub Dashboards |
| :---: | :---: | :--- | :--- | :--- |
| [ ] | `MODULE_REGISTRY!J3` | **LifeOS_Master_Bus** | `1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ` | Hub-to-Bus cross-verification |
| [ ] | `MODULE_REGISTRY!J4` | **Daily_Intake_Brick** | `16ohf5mBA9xrRsyv5sOYqY1s7gaOSpSOzK1rE1Gw6BNI` | `DAILY_ENERGY`, `DAILY_MOOD`, `ACUTE_STRESS`, `FLOW_COHERENCE`, `KABBALAH_BALANCE`, `INTAKE_DISCIPLINE_DELTA`, `INTAKE_VICE_DELTA` |
| [ ] | `MODULE_REGISTRY!J5` | **Weekly_Maslow_Pulse** | `1-GnXtI9ren5Bfw6KumDeNq7FUE5HYO0nSAevSzd5f40` | `MASLOW_SURVIVAL`, `MASLOW_SAFETY`, `MASLOW_BELONGING`, `MASLOW_ESTEEM`, `MASLOW_ACTUALIZATION` |
| [ ] | `MODULE_REGISTRY!J6` | **Zodiac_OS** | `1wQcAdR6ZxETOA1_nUmq1XYvPb9WvgSzmwcA4M0StH9M` | `ZODIAC_ALIGNMENT`, `SOLAR_MOMENTUM`, `LUNAR_REGULATION`, `ZODIAC_WIP_COUNT` |
| [ ] | `MODULE_REGISTRY!J7` | **Human_Design_OS** | `1yTiVyqmpz5FeZJSuN6_fmMfQZWq4HMcNCIKELBz8wp0` | `HD_STRATEGY_COHERENCE`, `HD_AUTHORITY_CLARITY`, `HD_CONDITIONING_LOAD`, `HD_BIO_READINESS`, `AUTHORITY_CLARITY`, `CENTER_CONDITIONING_LOAD` |
| [ ] | `MODULE_REGISTRY!J8` | **Four_Temperaments_Brick** | `1VT2lwlz0wp7YDX2RR10HPrZWiCBCZhj1rInFFSXtF_M` | `TEMPERAMENT_EQUILIBRIUM`, `CHOLERIC_DRIVE_INDEX`, `MELANCHOLIC_PRECISION_INDEX` + `RULES_ENGINE` Tier 2 mods |
| [ ] | `MODULE_REGISTRY!J9` | **Dynamic_Stress_Brick** | `1RjW-hvUyTs85ThLgZeSfEDsWmKO_OHTF_PmuKl4faFo` | `STRESS_ALLOSTATIC_LOAD`, `SOMATIC_RECOVERY_CAPACITY`, `CONTEXT_ADJUSTED_STRAIN` + `RULES_ENGINE` Tier 3 mods |
| [ ] | `MODULE_REGISTRY!J10` | **Doppelganger_Brick** | `1rF8zWY_-HAUhxilX1SaPE0L_iSPEr_gQO6_ZtoWhyPg` | `SHADOW_TAX_RATE`, `DOPPELGANGER_DOMINATION_INDEX`, `REDEMPTION_STREAK_DAYS` (`DOPPELGANGER` HUD) |
| [ ] | `MODULE_REGISTRY!J11` | **Kabbalah_Tree_of_Life** | `19yYbAFijH5LH_PnQOQhpBNiYbmBbzqhSxZJEd4-tPw0` | `KAB_EFFECTIVE_QUALITY`, `KAB_PILLAR_EQUILIBRIUM`, `KAB_GROUNDING_INDEX`, `KAB_HOD_SPREAD`, `KAB_NET_XP_MULT` |
| [ ] | `MODULE_REGISTRY!J12` | **Big_Five_OCEAN** | `12FwlHUeNWISYyiIVrASTDK6TlihFkfhVovIa4J2cObA` | `OCEAN_OPENNESS`, `OCEAN_CONSCIENTIOUSNESS`, `OCEAN_EXTRAVERSION`, `OCEAN_AGREEABLENESS`, `OCEAN_NEUROTICISM`, `OCEAN_PLASTICITY_BETA`, `OCEAN_STABILITY_ALPHA` |
| [ ] | `MODULE_REGISTRY!J13` | **MBTI_Cognitive_Stack** | `1uiQX7oyPcMAqovTBUkJBtbq7NSjWv45Lf0GQZza3TEw` | `MBTI_TYPE_CODE`, `MBTI_COHERENCE_INDEX`, `MBTI_SHADOW_RISK` |
| [ ] | `MODULE_REGISTRY!J14` | **Enneagram_Tritype_Engine** | `1nnu0Hw67g2OoAZiu0xmOALu3eFCgkKNL2M7gkv6-K3w` | `ENN_CORE_SIGNATURE`, `ENN_INTEGRATION_INDEX`, `ENN_DISINTEGRATION_RISK` |
| [ ] | `MODULE_REGISTRY!J15` | **Travel_Tracker_Brick** | `11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc` | All 7 `TRAVEL_*` signals (`ACTIVE_STATUS`, `CONTINENTS`, `COUNTRIES`, `CITIES`, `DAYS_YTD`, `REVIEWS_COUNT`, `AVG_RATING`) |
| [ ] | `MODULE_REGISTRY!J16` | **Maslow_Hierarchy_Spoke** | `1M-F-p5IqYc0JMtJ-20bOGUvQgP1-63Ta3hryES_jHqg` | `MASLOW_EFFECTIVE_QUALITY` (`MASLOW_ENGINE` parity check) |
| [ ] | `MODULE_REGISTRY!J17` | **Saboteur_PQ** | `1NhqPJDFOp91qOp5Y9hPe0rIuqECKU_b08cZYXZAqxeE` | Pre-authorized for Wave 2 `SIGNALS_OUT` upgrade |
| [ ] | `MODULE_REGISTRY!J18` | **Grit_Assessment** | `1kCwx6wtYksmt92M3Izwe6oEIVS5uDv3kCLIzCBOJG-s` | Pre-authorized for Wave 2 `SIGNALS_OUT` upgrade |
| [ ] | `MODULE_REGISTRY!J19` | **RIASEC_Intake** | `1RmJ9bDzm6Vs59EC1BV99lqHnYxgp-bchV589rQc6ybM` | Pre-authorized for Wave 2 `SIGNALS_OUT` upgrade |
| [ ] | `MODULE_REGISTRY!J20` | **Cattell_16PF** | `1zOZVYFUZsQdRtPQzyK6izLLlxczi8vcDQTOSmh8yFho` | Pre-authorized for Wave 2 `SIGNALS_OUT` upgrade |
| [ ] | `MODULE_REGISTRY!J21` | **Career_Experience_Intake** | `1iXxJVSv04MsRc_41p5bahCNRROXdugZ75iSivVy29GM` | Pre-authorized for Wave 2 `SIGNALS_OUT` upgrade |
| [ ] | `MODULE_REGISTRY!J22` | **Belief_Stance_Tracker** | `1ZlhB5xNyI5I8MssGhsp5wydyDJQu29tHmry4iShc2z0` | Pre-authorized for Wave 2 `SIGNALS_OUT` upgrade |
| [ ] | `MODULE_REGISTRY!J23` | **Body_Count_2_0** | `1aqYHU_bc-AqgREdvutE3VgG952_gd70yDKt4dMH6L1E` | Pre-authorized for Wave 2 anonymized `SIGNALS_OUT` upgrade |
| [ ] | `MODULE_REGISTRY!J24` | **Movie_Tracker** | `1SIRiqfY1r62g8_XOkwe37d4KnZAr_-DBUx-r-wczkMY` | Pre-authorized for Wave 2 `SIGNALS_OUT` upgrade |
| [ ] | `MODULE_REGISTRY!J25` | **XP_Leveler** | `1_rVUsl98dIt_FO7qqVv1nC3r7jF1_Xg6Xo8QBNm2D4k` | Pre-authorized for Wave 2 `SIGNALS_OUT` upgrade |

---

## 2. `LifeOS_Master_Bus` — 4 Remaining `IMPORTRANGE` Approvals

The `#REF!` `A2` spill collisions on `SRC_XP_HUB`, `SRC_KABBALAH`, and `SRC_16PF` have been fixed (`KAB_XP_NET_MULT` is already live at `114.10%`!). Only these 4 cells need a one-time browser **"Allow access"** click:

| Done | Tab & Cell | Direct Tab Link | Target Workbook | Unlocks |
| :---: | :--- | :--- | :--- | :--- |
| [ ] | `SRC_XP_HUB!A3` | https://docs.google.com/spreadsheets/d/1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ/edit#gid=778024592 | **XP Leveler** (`1_rVUsl98dIt_FO7qqVv1nC3r7jF1_Xg6Xo8QBNm2D4k`) | `SIG_XP_LEVEL` live Player HUD feed |
| [ ] | `SRC_KABBALAH!A3` | https://docs.google.com/spreadsheets/d/1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ/edit#gid=482453950 | **Kaballah Tree of Life OS Engine** (`19yYbAFijH5LH_PnQOQhpBNiYbmBbzqhSxZJEd4-tPw0`) | All 5 remaining `Engine_Outputs` `KABBALAH_*` metrics |
| [ ] | `SRC_16PF!A3` | https://docs.google.com/spreadsheets/d/1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ/edit#gid=653666860 | **Life OS // Cattell 16PF** (`1zOZVYFUZsQdRtPQzyK6izLLlxczi8vcDQTOSmh8yFho`) | `SIG_16PF_BURNOUT` live Projector Burnout Guard |
| [ ] | `SYMBIOSIS_HUD!B13` *(or add unwrapped `=IMPORTRANGE("1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U","AQAL_VIEW!A5")` once)* | https://docs.google.com/spreadsheets/d/1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ/edit#gid=212814514 | **LifeOS_feed_hub** (`1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U`) | Live `AQAL Quadrant Balance Score` inside `SYMBIOSIS_HUD` |

---

## 3. Post-Approval Verification

Once you finish clicking **"Allow access"** above:
1. Open **`LifeOS_feed_hub` → `AQAL_VIEW`** (`#gid=168404271`): confirm all 4 Quadrants (`UL`, `UR`, `LL`, `LR`) show live composite scores, `SPARKLINE` gauges, `Quadrant Balance Score`, and a live `Corrective Quest Directive`.
2. Open **`LifeOS_feed_hub` → `AI_Synthesis_Report`** (`#gid=1091110123`): confirm Cell `A4` renders your full populated Markdown executive briefing ready for NotebookLM & Gemini.
3. Open **`LifeOS_Master_Bus` → `Engine_Outputs`** (`#gid=1509572656`): confirm all 6 Kabbalah rows show `LIVE FORMULA`.

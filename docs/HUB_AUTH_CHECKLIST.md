# LifeOS-v3 Hub & Brick `IMPORTRANGE` Browser Authorization Checklist

> **Why this checklist exists**: Google Sheets requires a one-time interactive browser click (**"Allow access"** on a `#REF!` cell) for each new cross-spreadsheet `IMPORTRANGE` connection. APIs and scripts cannot grant this permission on your behalf.  
> **Last Audited**: `2026-11-23` (All 11 active Wave-2 Bricks standardized to the 3-Tab Universal Connector & wired live into `LifeOS_feed_hub` -> `SIGNAL_BUS`!)

---

## 1. `LifeOS_feed_hub` — Outbound Pull Status (`MODULE_REGISTRY!J3:J25`)

All 11 newly standardized Bricks (`ID_ZODIAC`, `ID_MASLOW`, `ID_GRIT`, `ID_RIASEC`, `ID_16PF`, `ID_XP_HUB`, `ID_CAREER_INTAKE`, `ID_TRAVEL`, `ID_BELIEF_TRACKER`, `ID_BODY_COUNT`, `ID_MOVIES`) are **already authorized and streaming live (`FRESH`)** into `LifeOS_feed_hub` -> `SIGNAL_BUS` (101 total signal rows, 83 live populated scores, 0 formula errors).

**Open `MODULE_REGISTRY` to approve any remaining `#REF!` rows in Column `J`:**  
https://docs.google.com/spreadsheets/d/1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U/edit#gid=259593998

| Done | Cell | Target Brick / Workbook | Spreadsheet ID | Status / Unlocks in `SIGNAL_BUS` |
| :---: | :---: | :--- | :--- | :--- |
| [ ] | `MODULE_REGISTRY!J3` | **LifeOS_Master_Bus** | `1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ` | Hub-to-Bus cross-verification |
| [ ] | `MODULE_REGISTRY!J4` | **Daily_Intake_Brick** | `16ohf5mBA9xrRsyv5sOYqY1s7gaOSpSOzK1rE1Gw6BNI` | `DAILY_ENERGY`, `DAILY_MOOD`, `ACUTE_STRESS`, `FLOW_COHERENCE`, `KABBALAH_BALANCE`, `INTAKE_DISCIPLINE_DELTA`, `INTAKE_VICE_DELTA` |
| [ ] | `MODULE_REGISTRY!J5` | **Weekly_Maslow_Pulse** | `1-GnXtI9ren5Bfw6KumDeNq7FUE5HYO0nSAevSzd5f40` | `MASLOW_SURVIVAL`, `MASLOW_SAFETY`, `MASLOW_BELONGING`, `MASLOW_ESTEEM`, `MASLOW_ACTUALIZATION` |
| [x] | `MODULE_REGISTRY!J6` | **Zodiac_OS** | `1wQcAdR6ZxETOA1_nUmq1XYvPb9WvgSzmwcA4M0StH9M` | **LIVE (`FRESH`)**: `ZODIAC_ALIGNMENT`, `SOLAR_MOMENTUM`, `LUNAR_REGULATION`, `ZODIAC_WIP_COUNT` |
| [ ] | `MODULE_REGISTRY!J7` | **Human_Design_OS** | `1yTiVyqmpz5FeZJSuN6_fmMfQZWq4HMcNCIKELBz8wp0` | `HD_STRATEGY_COHERENCE`, `HD_AUTHORITY_CLARITY`, `HD_CONDITIONING_LOAD`, `HD_BIO_READINESS` |
| [ ] | `MODULE_REGISTRY!J8` | **Four_Temperaments_Brick** | `1VT2lwlz0wp7YDX2RR10HPrZWiCBCZhj1rInFFSXtF_M` | `TEMPERAMENT_EQUILIBRIUM`, `CHOLERIC_DRIVE_INDEX`, `MELANCHOLIC_PRECISION_INDEX` |
| [ ] | `MODULE_REGISTRY!J9` | **Dynamic_Stress_Brick** | `1RjW-hvUyTs85ThLgZeSfEDsWmKO_OHTF_PmuKl4faFo` | `STRESS_ALLOSTATIC_LOAD`, `SOMATIC_RECOVERY_CAPACITY`, `CONTEXT_ADJUSTED_STRAIN` |
| [x] | `MODULE_REGISTRY!J10` | **Doppelganger_Brick** | `1rF8zWY_-HAUhxilX1SaPE0L_iSPEr_gQO6_ZtoWhyPg` | **LIVE**: `SHADOW_TAX_RATE`, `DOPPELGANGER_DOMINATION_INDEX`, `REDEMPTION_STREAK_DAYS` |
| [x] | `MODULE_REGISTRY!J11` | **Kabbalah_Tree_of_Life** | `19yYbAFijH5LH_PnQOQhpBNiYbmBbzqhSxZJEd4-tPw0` | **LIVE**: `KAB_EFFECTIVE_QUALITY`, `KAB_PILLAR_EQUILIBRIUM`, `KAB_GROUNDING_INDEX`, `KAB_HOD_SPREAD`, `KAB_NET_XP_MULT` |
| [x] | `MODULE_REGISTRY!J12` | **Big_Five_OCEAN** | `12FwlHUeNWISYyiIVrASTDK6TlihFkfhVovIa4J2cObA` | **LIVE**: All 7 `OCEAN_*` signals |
| [x] | `MODULE_REGISTRY!J13` | **MBTI_Cognitive_Stack** | `1uiQX7oyPcMAqovTBUkJBtbq7NSjWv45Lf0GQZza3TEw` | **LIVE**: `MBTI_TYPE_CODE`, `MBTI_COHERENCE_INDEX`, `MBTI_SHADOW_RISK` |
| [ ] | `MODULE_REGISTRY!J14` | **Enneagram_Tritype_Engine** | `1nnu0Hw67g2OoAZiu0xmOALu3eFCgkKNL2M7gkv6-K3w` | `ENN_CORE_SIGNATURE`, `ENN_INTEGRATION_INDEX`, `ENN_DISINTEGRATION_RISK` |
| [x] | `MODULE_REGISTRY!J15` | **Travel_Tracker_Brick** | `11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc` | **LIVE (`FRESH`)**: All 7 `TRAVEL_*` signals |
| [x] | `MODULE_REGISTRY!J16` | **Maslow_Hierarchy_Spoke** | `1M-F-p5IqYc0JMtJ-20bOGUvQgP1-63Ta3hryES_jHqg` | **LIVE (`FRESH`)**: All 5 `MASLOW_*` signals |
| [x] | `MODULE_REGISTRY!J17` | **Saboteur_PQ** | `1NhqPJDFOp91qOp5Y9hPe0rIuqECKU_b08cZYXZAqxeE` | Pre-authorized (awaiting `SIGNALS_OUT` rollout) |
| [x] | `MODULE_REGISTRY!J18` | **Grit_Assessment** | `1kCwx6wtYksmt92M3Izwe6oEIVS5uDv3kCLIzCBOJG-s` | **LIVE (`FRESH`)**: All 4 `GRIT_*` signals |
| [x] | `MODULE_REGISTRY!J19` | **RIASEC_Intake** | `1RmJ9bDzm6Vs59EC1BV99lqHnYxgp-bchV589rQc6ybM` | **LIVE (`FRESH`)**: All 4 `RIASEC_*` signals |
| [x] | `MODULE_REGISTRY!J20` | **Cattell_16PF** | `1zOZVYFUZsQdRtPQzyK6izLLlxczi8vcDQTOSmh8yFho` | **LIVE (`FRESH`)**: All 5 `PF16_*` signals |
| [x] | `MODULE_REGISTRY!J21` | **Career_Experience_Intake** | `1iXxJVSv04MsRc_41p5bahCNRROXdugZ75iSivVy29GM` | **LIVE (`FRESH`)**: All 4 `CAREER_*` signals |
| [x] | `MODULE_REGISTRY!J22` | **Belief_Stance_Tracker** | `1ZlhB5xNyI5I8MssGhsp5wydyDJQu29tHmry4iShc2z0` | **LIVE (`FRESH`)**: All 4 `BELIEF_*` signals |
| [x] | `MODULE_REGISTRY!J23` | **Body_Count_2_0** | `1aqYHU_bc-AqgREdvutE3VgG952_gd70yDKt4dMH6L1E` | **LIVE (`FRESH`, Anonymized Aggregates Only)**: All 4 `REL_*` signals |
| [x] | `MODULE_REGISTRY!J24` | **Movie_Tracker** | `1SIRiqfY1r62g8_XOkwe37d4KnZAr_-DBUx-r-wczkMY` | **LIVE (`FRESH`)**: All 5 `MOVIES_*` signals |
| [x] | `MODULE_REGISTRY!J25` | **XP_Leveler** | `1_rVUsl98dIt_FO7qqVv1nC3r7jF1_Xg6Xo8QBNm2D4k` | **LIVE (`FRESH`)**: All 4 `XP_*` signals |
| [ ] | `MODULE_REGISTRY!J26` | **🩺 BIO_CORE** | `1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA` | All 7 `BIO_*` wearable signals (`BIO_READINESS_SCORE`, `HRV_RECOVERY`, `SLEEP_INDEX`, `SLEEP_CONSISTENCY`, `ACTIVITY_INDEX`, `STEPS_7D`, `RHR_7D`) -> AQAL UR, Maslow L1, Sword Knuckle-Bow |
| [ ] | `MODULE_REGISTRY!J27` | **💚 Pillar_1_Health** | `1dzuXlVWO5VRtla0p0ZuziZAvpm2ZySslPLZOhWDQGSI` | All 8 `P1_*` signals (`P1_HEALTH_BASE_SCORE`, `SLEEP_7D`, `ENERGY_7D`, `STRESS_7D`, `PRANA`, `HABIT_COMPLIANCE`, `APPEARANCE`, `PEAK_FOCUS_WINDOW`) -> AQAL UR, Maslow L1, Sword Knuckle-Bow & Grip |

---

## 2. Pillar 1 Biological Stack (`BIO_CORE` & `Pillar_1_Health`) Inbound Authorizations

Approve these 4 one-time `#REF!` cells to complete the closed loop between `RAW_DATA_DailyCheckIn`, `🩺 BIO_CORE`, `💚 Pillar_1_Health`, and `LifeOS_feed_hub`:

| Done | Workbook & Cell | Direct Tab Link (Click cell -> Allow access) | Target Workbook | Unlocks |
| :---: | :--- | :--- | :--- | :--- |
| [ ] | **`🩺 BIO_CORE` → `CONTEXT_IN!F2`** | https://docs.google.com/spreadsheets/d/1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA/edit#gid=1475661450 | **LifeOS_feed_hub** | Live Hub context inside `BIO_CORE` (`P1_HEALTH_BASE_SCORE`, `STRESS_ALLOSTATIC_LOAD`, `HD_BIO_READINESS`, `ZODIAC_WIP_COUNT`) |
| [ ] | **`💚 Pillar_1_Health` → `IMPORTS!R2`** | https://docs.google.com/spreadsheets/d/1dzuXlVWO5VRtla0p0ZuziZAvpm2ZySslPLZOhWDQGSI/edit#gid=0 | **RAW_DATA_DailyCheckIn** (`1Bz2AH4oJMvzhETSvEhG5H58mlF-RNLMG6IaTTKaODSY`) | Live Layer 1 Daily Check-In rows streaming into `DATABASE`, `CALCULATIONS`, and `DASHBOARD` |
| [ ] | **`💚 Pillar_1_Health` → `IMPORTS!S2`** | https://docs.google.com/spreadsheets/d/1dzuXlVWO5VRtla0p0ZuziZAvpm2ZySslPLZOhWDQGSI/edit#gid=0 | **🩺 BIO_CORE** (`1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA`) | Live wearable `BIO_SLEEP_INDEX`, `BIO_ACTIVITY_INDEX`, `BIO_HRV_RECOVERY`, and `BIO_READINESS_SCORE` blended into the 5-Level Health Pyramid |
| [ ] | **`💚 Pillar_1_Health` → `CONTEXT_IN!F2`** | https://docs.google.com/spreadsheets/d/1dzuXlVWO5VRtla0p0ZuziZAvpm2ZySslPLZOhWDQGSI/edit#gid=744371407 | **LifeOS_feed_hub** | Live Hub context inside `Pillar_1_Health` |

---

## 3. Brick Inbound `CONTEXT_IN!F2` Authorizations (11 Standardized Bricks)

Each of the 11 newly standardized Bricks has a dedicated unwrapped **`Hub_Auth_Trigger`** in cell **`CONTEXT_IN!F2`** subscribing to `LifeOS_feed_hub` (`1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U`). Open each direct `#gid=` link below, click **`F2`**, and press **"Allow access"** once to activate closed-loop Pass-2 context subscriptions inside that Brick:

| Done | Registry Key | Brick Workbook | Direct `CONTEXT_IN` Tab Link (Click `F2` -> Allow access) | Subscribed Hub Signals |
| :---: | :--- | :--- | :--- | :--- |
| [ ] | `ID_ZODIAC` | **Zodiac OS** | https://docs.google.com/spreadsheets/d/1wQcAdR6ZxETOA1_nUmq1XYvPb9WvgSzmwcA4M0StH9M/edit#gid=1732793065 | `DAILY_ENERGY`, `DAILY_MOOD`, `ACUTE_STRESS`, `MASLOW_EFFECTIVE_QUALITY` |
| [ ] | `ID_MASLOW` | **Maslow's Hierarchy of Needs** | https://docs.google.com/spreadsheets/d/1M-F-p5IqYc0JMtJ-20bOGUvQgP1-63Ta3hryES_jHqg/edit#gid=620844466 | `DAILY_ENERGY`, `ACUTE_STRESS`, `HD_BIO_READINESS`, `DOPPELGANGER_DOMINATION_INDEX` |
| [ ] | `ID_GRIT` | **Grit Score Assessment** | https://docs.google.com/spreadsheets/d/1kCwx6wtYksmt92M3Izwe6oEIVS5uDv3kCLIzCBOJG-s/edit#gid=1453866952 | `OCEAN_CONSCIENTIOUSNESS`, `ZODIAC_WIP_COUNT`, `DOPPELGANGER_DOMINATION_INDEX`, `MASLOW_EFFECTIVE_QUALITY` |
| [ ] | `ID_RIASEC` | **RAISEC Intake** | https://docs.google.com/spreadsheets/d/1RmJ9bDzm6Vs59EC1BV99lqHnYxgp-bchV589rQc6ybM/edit#gid=1993371372 | `OCEAN_OPENNESS`, `GRIT_OVERALL_SCORE`, `ZODIAC_WIP_COUNT`, `CAREER_USCG_SEA_DAYS` |
| [ ] | `ID_16PF` | **Life OS // Cattell 16PF** | https://docs.google.com/spreadsheets/d/1zOZVYFUZsQdRtPQzyK6izLLlxczi8vcDQTOSmh8yFho/edit#gid=1186341685 | `OCEAN_CONSCIENTIOUSNESS`, `OCEAN_NEUROTICISM`, `HD_BIO_READINESS`, `MBTI_COHERENCE_INDEX` |
| [ ] | `ID_XP_HUB` | **XP Leveler** | https://docs.google.com/spreadsheets/d/1_rVUsl98dIt_FO7qqVv1nC3r7jF1_Xg6Xo8QBNm2D4k/edit#gid=294848872 | `MASLOW_EFFECTIVE_QUALITY`, `ZODIAC_WIP_COUNT`, `HD_BIO_READINESS`, `AQAL_BALANCE_SCORE` |
| [ ] | `ID_CAREER_INTAKE` | **LifeOS Career & Experience Intake** | https://docs.google.com/spreadsheets/d/1iXxJVSv04MsRc_41p5bahCNRROXdugZ75iSivVy29GM/edit#gid=466643700 | `RIASEC_HOLLAND_CODE`, `GRIT_OVERALL_SCORE`, `ZODIAC_WIP_COUNT`, `XP_CURRENT_LEVEL` |
| [ ] | `ID_TRAVEL` | **🌍 Travel_Tracker_Brick** | https://docs.google.com/spreadsheets/d/11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc/edit#gid=10 | `DAILY_ENERGY`, `ACUTE_STRESS`, `MASLOW_EFFECTIVE_QUALITY`, `ZODIAC_WIP_COUNT` |
| [ ] | `ID_BELIEF_TRACKER` | **Belief & Stance Tracker (Life OS)** | https://docs.google.com/spreadsheets/d/1ZlhB5xNyI5I8MssGhsp5wydyDJQu29tHmry4iShc2z0/edit#gid=1021359317 | `OCEAN_OPENNESS`, `MBTI_COHERENCE_INDEX`, `AQAL_UL_SCORE`, `ZODIAC_ALIGNMENT` |
| [ ] | `ID_BODY_COUNT` | **Body Count 2.0** | https://docs.google.com/spreadsheets/d/1aqYHU_bc-AqgREdvutE3VgG952_gd70yDKt4dMH6L1E/edit#gid=92227420 | `OCEAN_EXTRAVERSION`, `OCEAN_AGREEABLENESS`, `MASLOW_RECIPROCITY_INDEX`, `AQAL_LL_SCORE` |
| [ ] | `ID_MOVIES` | **Movie Input Form (Movie Tracker)** | https://docs.google.com/spreadsheets/d/1SIRiqfY1r62g8_XOkwe37d4KnZAr_-DBUx-r-wczkMY/edit#gid=1733945459 | `OCEAN_OPENNESS`, `DAILY_MOOD`, `TRAVEL_REVIEWS_COUNT`, `AQAL_UL_SCORE` |

---

## 3. `LifeOS_Master_Bus` — 4 Remaining `IMPORTRANGE` Approvals

The `#REF!` `A2` spill collisions on `SRC_XP_HUB`, `SRC_KABBALAH`, and `SRC_16PF` have been fixed (`KAB_XP_NET_MULT` is already live at `114.10%`!). Only these 4 cells need a one-time browser **"Allow access"** click:

| Done | Tab & Cell | Direct Tab Link | Target Workbook | Unlocks |
| :---: | :--- | :--- | :--- | :--- |
| [ ] | `SRC_XP_HUB!A3` | https://docs.google.com/spreadsheets/d/1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ/edit#gid=778024592 | **XP Leveler** (`1_rVUsl98dIt_FO7qqVv1nC3r7jF1_Xg6Xo8QBNm2D4k`) | `SIG_XP_LEVEL` live Player HUD feed |
| [ ] | `SRC_KABBALAH!A3` | https://docs.google.com/spreadsheets/d/1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ/edit#gid=482453950 | **Kaballah Tree of Life OS Engine** (`19yYbAFijH5LH_PnQOQhpBNiYbmBbzqhSxZJEd4-tPw0`) | All 5 remaining `Engine_Outputs` `KABBALAH_*` metrics |
| [ ] | `SRC_16PF!A3` | https://docs.google.com/spreadsheets/d/1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ/edit#gid=653666860 | **Life OS // Cattell 16PF** (`1zOZVYFUZsQdRtPQzyK6izLLlxczi8vcDQTOSmh8yFho`) | `SIG_16PF_BURNOUT` live Projector Burnout Guard |
| [ ] | `SYMBIOSIS_HUD!B13` | https://docs.google.com/spreadsheets/d/1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ/edit#gid=212814514 | **LifeOS_feed_hub** (`1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U`) | Live `AQAL Quadrant Balance Score` inside `SYMBIOSIS_HUD` |

---

## 4. Post-Approval Verification

Once you finish clicking **"Allow access"** above:
1. Open **`LifeOS_feed_hub` -> `SIGNAL_BUS`** (`#gid=387897381`): confirm all 101 signal rows evaluate cleanly with `FRESH` status badges.
2. Open **`LifeOS_feed_hub` -> `AQAL_VIEW`** (`#gid=168404271`): confirm all 4 Quadrants (`UL`, `UR`, `LL`, `LR`) show live composite scores, `SPARKLINE` gauges, `Quadrant Balance Score`, and a live `Corrective Quest Directive`.
3. Open any Brick's **`CONTEXT_IN`** tab from Section 2: confirm `F3:F5` switches from `"Click F2 -> Allow access"` to `"AUTHORIZED"` and Columns `B:E` stream live Hub context.

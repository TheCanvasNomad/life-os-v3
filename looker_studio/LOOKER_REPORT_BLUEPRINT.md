# LifeOS-v3 — Google Looker Studio Report Blueprint & Setup Guide

> **Architecture Principle (Laws 1–8):** Google Looker Studio is a read-only visualization layer bound exclusively to flat, unmerged, 100% dynamic `LOOKER_*` and `PUBLIC_DATA` tabs across `LifeOS_v3_Control`.  
> **Zero-PII Firewall:** Zero individual contact names, phone numbers, email addresses, private Shadow Journal prose, Sigil intention statements, or raw account numbers exist in any `LOOKER_*` or `PUBLIC_DATA` tab.

---

## 1. Data Source Inventory & Field Type Schema

Connect each Google Sheet data source below in **Looker Studio** (`https://lookerstudio.google.com`) using **Google Sheets Connector → Use first row as headers (`✓`) → Include hidden and filtered cells (`☐`)**.

### A. Central Command Hub (`LifeOS_feed_hub` — `1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U`)

| Tab Name | Role | Dimensions (`Text` / `Date`) | Metrics (`Number` / `Percent`) |
| :--- | :--- | :--- | :--- |
| **`LOOKER_PILLARS_&_MASLOW`** | Page 1 Character Sheet & Maslow Pyramid | `Domain_Key`, `Domain_Label`, `Layer_Type` (`Pillar` / `Maslow`), `Gate_Status`, `Narrative_Season`, `Last_Updated` (Date & Time) | `Score_0_100` (Number, Avg), `Mastery_Gate_Pct` (Number, 90), `Points_To_Gate` (Number) |
| **`LOOKER_SYSTEM_TELEMETRY`** | AQAL 2x2, Archetypal Sword & 177-Signal Bus Health | `Record_Type` (`AQAL` / `SWORD` / `SIGNAL`), `Entity_Key`, `Entity_Label`, `Domain_Group`, `State_Tag`, `Freshness_Status` (`FRESH` / `STALE` / `UNLOGGED`), `Narrative_Season`, `Last_Updated` | `Normalized_Score_0_100` (Number), `Raw_Value` (Text/Number) |
| **`PUBLIC_DATA`** | Firewalled **Guild & Accountability Report** *(Safe to share)* | `Metric_Key`, `Display_Label`, `Category`, `Unit`, `Narrative_Season`, `Last_Updated` | `Public_Value` (Number), `Target_Or_Gate` (Number), `Progress_Pct` (Number) |

### B. Pillar & CRM Spokes (Flat Zero-PII Deep-Dive Feeds)

| Workbook (`Spreadsheet ID`) | Flat Looker Tab | Dimensions | Metrics |
| :--- | :--- | :--- | :--- |
| **`🌑 Pillar_0_Shadow_Self`** (`1dst5RTOgaIBr6EsXkuuqK5p18fSxnP3wUsn6gmhx-LU`) | `LOOKER_SHADOW_METRICS` | `Metric_Key`, `Metric_Label`, `Category`, `Gate_Status`, `Last_Updated` | `Live_Value`, `Normalized_0_100` |
| **`💚 Pillar_1_Health`** (`1dzuXlVWO5VRtla0p0ZuziZAvpm2ZySslPLZOhWDQGSI`) | `LOOKER_HEALTH_SERIES` | `Log_Date` (Date), `Time_Window`, `Workout_Logged` | `Sleep_Quality`, `Nutrition_Quality`, `Hydration_Score`, `Energy_Level`, `Focus_Clarity`, `Stress_Level`, `Prana_Level`, `Habits_Completed`, `Vice_Lapses`, `Appearance_Score` |
| **`💰 Pillar_2_Wealth`** (`1NcqV_nHIXuyGz6SuwyXNZbh3AtazGOkuZcIZlTBxw5c`) | `LOOKER_WEALTH_ALLOCATION` | `Record_Type`, `Metric_Or_Bucket`, `Mastery_Status`, `Last_Updated` | `Target_Or_Gate`, `Live_Score_Or_Pct`, `Variance_Or_State` |
| **`💞 Pillar_3_Relationships`** (`1hi-hShSgH9X8i5NpCmh_a5HfuxevrxWkFDuJmbB1D0k`) | `LOOKER_RELATIONSHIP_AGGREGATES` | `Metric_Key`, `Metric_Label`, `State_Tag`, `Last_Updated` | `Live_Value`, `Normalized_0_100` |
| **`🛠️ Pillar_4_Skills_Mission`** (`1PHTTv1Qpdy5JAyLarOaXYAIsNIuAk8YFBw9GqvIslT0`) | `LOOKER_SKILLS_&_FLOW` | `Skill_Category`, `Skill_Name`, `Mastery_Status` | `Current_Level`, `Current_XP`, `XP_For_Next_Level`, `Level_Progress_Pct`, `P4_Skills_Base_Score`, `P4_Ikigai_Score`, `Flow_Session_Score` |
| **`🏆 Pillar_5_Experience_Legacy`** (`1AdMP-VKzTPNbSSTUoLrbqAjtBdYlf4mzLYwyWbaUrQw`) | `LOOKER_QUESTS_&_EPICS` | `Quest_Date` (Date), `Quest_Name`, `Primary_Pillar`, `Quest_Tier`, `Target_Date` (Date), `Blooms_Level`, `Status`, `P5_Bucket_List_Waiting_Flag` | `Importance`, `Urgency`, `Benchmark_Hours`, `Actual_Hours`, `P5_Bucket_List_Clarity`, `P5_Bucket_List_Longshot_Pct` |
| **`🔮 Pillar_6_Esoteric_Self`** (`1vVvU5TfzjGYFMNbMlSNaUjREj8HBkDPMwbzLiBnfxA0`) | `LOOKER_ESOTERIC_METRICS` | `Metric_Key`, `Metric_Label`, `Category`, `State_Or_Gate`, `Last_Updated` | `Live_Value`, `Normalized_0_100` |
| **`🌍 Travel_Tracker_Brick`** (`11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc`) | `LOOKER_TRAVEL` | `Record_Type` (`TRAVEL_KPI` / `BUCKET_MILESTONE`), `Item_Key`, `Item_Label`, `Category_Or_Domain`, `Tier`, `Status`, `First_Completed_Date` (Date) | `Numeric_Value`, `Earned_XP`, `Times_Completed` |
| **`📇 Core_CRM`** (`1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M`) | `LOOKER_CRM_FUNNELS` | `Dimension_Type`, `Segment_Label`, `Metric_Unit`, `Last_Updated` | `Aggregate_Count_Or_Value`, `Share_Of_Network_Pct` |

---

## 2. Recommended Looker Studio Calculated Fields

Add these lightweight calculated fields directly inside Looker Studio data sources for richer executive visuals:

```sql
-- 1. Universal 90% Mastery Gate Indicator (LOOKER_PILLARS_&_MASLOW)
CASE
  WHEN Score_0_100 >= 90 THEN "UNLOCKED (90%+)"
  WHEN Score_0_100 >= 60 THEN "CALIBRATING"
  WHEN Score_0_100 > 0 THEN "FORGE FOCUS"
  ELSE "AWAITING DATA"
END

-- 2. Signal Bus Freshness Health % (LOOKER_SYSTEM_TELEMETRY)
SUM(CASE WHEN Freshness_Status = "FRESH" THEN 1 ELSE 0 END) / COUNT(Entity_Key)

-- 3. Eisenhower Quadrant Classifier (LOOKER_QUESTS_&_EPICS)
CASE
  WHEN Importance >= 7 AND Urgency >= 7 THEN "Q1: Do Now"
  WHEN Importance >= 7 AND Urgency < 7 THEN "Q2: Schedule (High Leverage)"
  WHEN Importance < 7 AND Urgency >= 7 THEN "Q3: Delegate"
  ELSE "Q4: Eliminate"
END

-- 4. Skill XP Remaining (LOOKER_SKILLS_&_FLOW)
MAX(0, XP_For_Next_Level - Current_XP)
```

---

## 3. Page-by-Page Report Architecture

### **Page 1: Sovereign Character Sheet (Executive Cockpit)**
* **Data Sources:** `LOOKER_PILLARS_&_MASLOW`, `LOOKER_SYSTEM_TELEMETRY`
* **Global Report Controls (Top Strip — Report-Level):**
  * `Date Range Control` (Default: Last 30 Days)
  * `Dropdown Filter: Layer_Type` (`Pillar` / `Maslow`)
  * `Dropdown Filter: Domain_Group` / `Freshness_Status`
  * **Dynamic `Narrative_Season` Banner Scorecard** (drives ambient page accent palette below!)
* **Visual Grid:**
  1. **Top KPI Row (4 Scorecards):** `Maslow Sovereignty Index`, `AQAL Quadrant Balance`, `Archetypal Sword Integrity`, `Signal Bus Freshness %`.
  2. **Left Half — 7-Pillar Radar / Horizontal Bullet Bar Chart:** `Domain_Label` (`Layer_Type = "Pillar"`) × `Score_0_100` with a vertical **90% Universal Mastery Gate reference line**.
  3. **Right Half — Maslow 5-Tier Pyramid Stacked Bar + AQAL 2x2 Quadrant Matrix:** Filter `LOOKER_SYSTEM_TELEMETRY` where `Record_Type = "AQAL"` (`UL_I`, `UR_IT`, `LL_WE`, `LR_ITS`).
  4. **Bottom Strip — Archetypal Sword Integrity Table (`Record_Type = "SWORD"`):** Displays `POINT`, `EDGE`, `SPINE`, `QUILLONS`, `KNUCKLE-BOW`, `GRIP`, `POMMEL` with conditional traffic-light data bars.

### **Page 2: Pillar 0 (Shadow Work Bench) & Pillar 1 (Health & Biometrics)**
* **Top Section (`LOOKER_SHADOW_METRICS`):** `P0_WISDOM_SCORE` gauge, `L1`–`L5` Shadow Integration bar chart, `Arena_Dominance_Score`, `P0_GRIP_INTEGRITY`, `Total_Wisdom_Points`, and `Active Unintegrated Shadows` alert scorecard.
* **Bottom Section (`LOOKER_HEALTH_SERIES`):** Dual-axis time-series line chart (`Log_Date` × `Sleep_Quality`, `Energy_Level`, `Stress_Level`, `Prana_Level`), plus stacked bar of `Habits_Completed` vs. `Vice_Lapses`.

### **Page 3: Pillar 2 (Wealth & 40/20/20/20 Sovereign Treasury)**
* **Data Source:** `LOOKER_WEALTH_ALLOCATION`
* **Visuals:** `Wealth Base Score` & `FIRE Progress %` gauges, 5-Level Financial Hierarchy progress bars (`L1`–`L5`), grouped bar chart comparing **Target % vs. Actual Share %** across **War Chest (40%)**, **The Canvas Nomad LLC (20%)**, **Global Travel 7-by-40 (20%)**, and **Real Estate & Land (20%)**, plus `Liquid Runway (Months)` vs. 20-month Fortress target line.

### **Page 4: Pillar 3 (Relationships) & Core_CRM Aggregate Funnels**
* **Data Sources:** `LOOKER_RELATIONSHIP_AGGREGATES`, `LOOKER_CRM_FUNNELS`
* **Visuals (100% Anonymized):** `Relationship Base Score`, `Average Love Tank`, `Frame & Conflict Win Rate`, `Good Guy` vs. `Bad Boy` Meter balance; donut & bar charts of `LifeOS_Sphere`, `Relationship_Status` funnel, `Proximity_Ring`, and `Cohort_Chapter` distributions plus `CRM_CROSS_BRICK_LINKS` & `Due Follow-Ups`.

### **Page 5: Pillar 4 (Skills, Bloom's Gauntlet & Ikigai)**
* **Data Source:** `LOOKER_SKILLS_&_FLOW`
* **Visuals:** `P4_Skills_Base_Score`, `P4_Ikigai_Score`, `Flow_Session_Score` scorecards; interactive **Skill Category Drill-Down** (`Skill_Category` → `Skill_Name`) treemap & progress bar table showing `Current_Level`, `Level_Progress_Pct`, and `Mastery_Status`.

### **Page 6: Pillar 5 (Experience, Quests & Hero's Journey)**
* **Data Source:** `LOOKER_QUESTS_&_EPICS`
* **Visuals:** Interactive `Primary_Pillar` & `Status` filter controls; **Eisenhower Scatter Plot** (`Urgency` × `Importance`, bubble size = `Benchmark_Hours`, color = `Primary_Pillar`); Quest Tier breakdown (`Epic` / `Major` / `Side` / `[Ritual]`); Bloom's Cognitive Level bar chart.

### **Page 7: Pillar 6 (Esoteric Self — Path of the Initiate Capstone)**
* **Data Source:** `LOOKER_ESOTERIC_METRICS`
* **Visuals:** `Esoteric Base Score` gauge, `L1: The Mundane` → `L5: The Adept` mastery bars, `Prana 7D Avg` & `90D Stability %`, **Alchemical Furnace Charge %** bullet gauge (`Retention_Streak_Days` vs. 45d Overclock), `True Will Alignment (90D %)` vs. 90% `[Destiny]` buff threshold, and `Sigil Manifestation Rate %`.

### **Separate Firewalled Report: Guild & Accountability Report (`PUBLIC_DATA`)**
* **Data Source:** **ONLY** `LifeOS_feed_hub` → `PUBLIC_DATA` *(never attach any other tab to this report!)*.
* **Visuals:** Public accountability scorecards (`Narrative_Season`, `Active Epics`, `Epic Completion %`, `Avg Skill Level`, `Habit Compliance %`, `Retention Streak Days`, `Continents & Countries Explored`, `AQAL Balance`, `Sword Integrity`, `Maslow Sovereignty`). Safe to share via view-only link with mentors or accountability partners.

---

## 4. `Narrative_Season` Ambient Styling Rules

Configure conditional formatting on the top `Narrative_Season` banner across Pages 1–7 to match your live system state:

| `Narrative_Season` Value | Trigger Physics | Background Accent | Text Color | Ambient Meaning |
| :--- | :--- | :---: | :---: | :--- |
| **`Sovereign Ascension`** | Maslow `>= 90` & AQAL `>= 85` | `#064E3B` (Deep Emerald) | `#34D399` | Peak integral flow — expand Epics & Legacy |
| **`Forge & Calibration`** | Maslow `60–89` | `#1E293B` (Slate Indigo) | `#38BDF8` | Active tempering — close weakest gate |
| **`Foundation Winter`** | Maslow `< 60` | `#7F1D1D` (Obsidian Crimson) | `#FCA5A5` | Stabilize Physiological, Fortress & Shadow bases |
| **`Awakening`** | Initial / Unlogged | `#3B0764` (Royal Amethyst) | `#D8B4FE` | Authorize feeds & log initial baseline telemetry |

---

## 5. One-Time Looker Studio Setup Steps

1. Go to [Looker Studio](https://lookerstudio.google.com) and click **Create → Report**.
2. Select the **Google Sheets** connector, authorize your Google account once, and add:
   * `LifeOS_feed_hub` → `LOOKER_PILLARS_&_MASLOW`
   * `LifeOS_feed_hub` → `LOOKER_SYSTEM_TELEMETRY`
   * Each Pillar / CRM spoke's `LOOKER_*` tab from Section 1B above.
3. For each connector, verify **Use first row as headers** is checked and set **Data freshness** to **15 minutes** (matching your `LifeOS` Calendar & CRM cadence).
4. Create a **separate** Looker Studio report titled **`LifeOS — Guild & Accountability HUD`** connected **exclusively** to `LifeOS_feed_hub` → `PUBLIC_DATA` so no private data can ever cross into shared views.

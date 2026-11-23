# LifeOS v3.0 — `BIO_CORE` Wearable Ingestion Pipelines

Encapsulated biometric telemetry ingestion for **`🩺 BIO_CORE`** (`ID_BIO_CORE`: `1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA`) -> Layer 1 write-only silo **`RAW_DATA_Biometrics`**.

---

## 1. Canonical `RAW_DATA_Biometrics` Column Schema (`A:L`)

Both [`fitbit_historical_etl.py`](./fitbit_historical_etl.py) and [`health_connect_webhook.gs`](./health_connect_webhook.gs) enforce this exact 12-column order and **Law 3 blank-cell preservation** (unlogged metrics are written as `""`, never false `0`):

| Col | Column Name | Type / Units | Notes |
| :---: | :--- | :--- | :--- |
| `A` | `Timestamp` | `YYYY-MM-DD HH:MM:SS` (UTC) | Ingestion timestamp |
| `B` | `Date` | `YYYY-MM-DD` | Primary calendar date key |
| `C` | `Source` | `Fitbit_Legacy` \| `Health_Connect` | Deduplication key paired with `Date` |
| `D` | `Sleep_Hours` | Decimal hours (e.g. `7.80`) | Total asleep duration |
| `E` | `Sleep_Score` | `0–100` | Wearable overall sleep score |
| `F` | `Deep_REM_Mins` | Integer minutes | Combined Deep + REM restorative sleep |
| `G` | `Steps` | Integer count | Daily step count |
| `H` | `Resting_HR` | BPM (e.g. `54.0`) | Lower = stronger cardiovascular recovery |
| `I` | `HRV_ms` | RMSSD milliseconds (e.g. `74.5`) | Higher = stronger autonomic recovery |
| `J` | `Active_Calories` | kcal | Daily active calorie burn |
| `K` | `Weight_lbs` | Decimal lbs | Body weight reading |
| `L` | `Workout_Mins` | Integer minutes | Active structured workout duration |

---

## 2. Historical Fitbit Backfill (`fitbit_historical_etl.py`)

### Option A: Unzipped Google Takeout Archive (No OAuth Required)
1. Download your Fitbit archive from Google Takeout and unzip it inside your workspace or VM (e.g. `~/takeout_fitbit/`).
2. Preview parsed days without writing:
   ```bash
   python3 src/utilities/biometric_core/fitbit_historical_etl.py \
     --mode takeout \
     --takeout-dir ~/takeout_fitbit \
     --dry-run
   ```
3. Run the deduplicated backfill into `RAW_DATA_Biometrics`:
   ```bash
   python3 src/utilities/biometric_core/fitbit_historical_etl.py \
     --mode takeout \
     --takeout-dir ~/takeout_fitbit
   ```

### Option B: Fitbit Web API OAuth2 Backfill
> **Google Health API v4 Migration Notice**: Google is migrating legacy Fitbit Web API integrations to the Google Health API (`health.googleapis.com/v4`). See https://developers.google.com/health/migration and the interactive parity tool at https://developers.google.com/health/migration/parity-tool. Never dual-link a legacy Fitbit token alongside an active Google Health API token (`fitbit_historical_etl.py` includes an automatic anti-dual-linking guard).

```bash
export FITBIT_ACCESS_TOKEN="<your_fitbit_oauth2_bearer_token>"
python3 src/utilities/biometric_core/fitbit_historical_etl.py \
  --mode api \
  --start 2026-01-01 \
  --end 2026-11-23
```

---

## 3. Live Android Health Connect Webhook (`health_connect_webhook.gs`)

1. Open **`🩺 BIO_CORE`**: https://docs.google.com/spreadsheets/d/1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA/edit
2. Open **Extensions -> Apps Script**, paste [`health_connect_webhook.gs`](./health_connect_webhook.gs) (and [`calendar_health_sync.gs`](./calendar_health_sync.gs) for daily `Life OS` calendar summaries).
3. Go to **Project Settings -> Script Properties** and add:
   - `BIO_WEBHOOK_TOKEN`: a strong random secret string (e.g. generated with `openssl rand -hex 24`).
   - `LIFEOS_CALENDAR_NAME` *(optional)*: `Life OS`.
4. Click **Deploy -> New deployment -> Web app**:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` (protected by constant-time `BIO_WEBHOOK_TOKEN` verification in `doPost(e)`).
5. Copy the deployed Web App URL (`https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`) into your Pixel Health Connect sync bridge (Tasker / Health Connect companion) and test with:
   ```bash
   curl -X POST "https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec" \
     -H "Content-Type: application/json" \
     -d '{
       "token": "<YOUR_BIO_WEBHOOK_TOKEN>",
       "date": "2026-11-23",
       "source": "Health_Connect",
       "sleep_hours": 7.8,
       "sleep_score": 88,
       "deep_rem_mins": 195,
       "steps": 10850,
       "resting_hr": 54,
       "hrv_ms": 74.5,
       "active_calories": 650,
       "weight_lbs": 181.5,
       "workout_mins": 50
     }'
   ```
6. For daily calendar logs, add a time-driven trigger in Apps Script calling `syncDailyHealthToCalendar` once per evening (e.g. `21:30`).

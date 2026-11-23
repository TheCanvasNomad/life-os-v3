/**
 * LifeOS v3.0 — BIO_CORE Android Health Connect Live Ingestion Webhook
 * =====================================================================
 * Bound to: `🩺 BIO_CORE` (ID: 1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA)
 * Target Silo: `RAW_DATA_Biometrics` (Layer 1 Write-Only Silo)
 *
 * Deployment:
 *   1. Open Apps Script inside `🩺 BIO_CORE`.
 *   2. Set Script Property `BIO_WEBHOOK_TOKEN` (strong random bearer secret).
 *   3. Deploy -> New deployment -> Web app (Execute as: Me, Access: Anyone).
 *   4. Point your Pixel Health Connect sync bridge (Tasker / Health Connect
 *      companion app) to POST JSON payloads to the Web App URL with header/body
 *      token matching `BIO_WEBHOOK_TOKEN`.
 *
 * Expected JSON Payload (single object or `{ "records": [...] }`):
 * {
 *   "token": "<BIO_WEBHOOK_TOKEN>",
 *   "date": "2026-11-23",
 *   "source": "Health_Connect",
 *   "sleep_hours": 7.65,
 *   "sleep_score": 86,
 *   "deep_rem_mins": 192,
 *   "steps": 11420,
 *   "resting_hr": 54,
 *   "hrv_ms": 72.4,
 *   "active_calories": 640,
 *   "weight_lbs": 182.4,
 *   "workout_mins": 50
 * }
 */

const BIO_RAW_TAB = 'RAW_DATA_Biometrics';

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'OK',
      service: 'LifeOS BIO_CORE Health Connect Webhook',
      timestamp_utc: new Date().toISOString(),
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_(400, { ok: false, error: 'Missing JSON request body' });
    }

    const payload = JSON.parse(e.postData.contents);
    const expectedToken = PropertiesService.getScriptProperties().getProperty('BIO_WEBHOOK_TOKEN');
    if (!expectedToken) {
      return jsonResponse_(500, { ok: false, error: 'BIO_WEBHOOK_TOKEN Script Property not configured' });
    }

    const providedToken =
      payload.token ||
      (e.parameter && e.parameter.token) ||
      '';
    if (!constantTimeEquals_(String(providedToken), String(expectedToken))) {
      return jsonResponse_(401, { ok: false, error: 'Unauthorized: invalid token' });
    }

    const records = Array.isArray(payload.records) ? payload.records : [payload];
    const result = upsertBiometricRecords_(records);
    return jsonResponse_(200, { ok: true, ...result });
  } catch (err) {
    return jsonResponse_(500, { ok: false, error: err && err.message ? err.message : String(err) });
  }
}

/**
 * Idempotently appends or upserts daily rows keyed by (Date, Source) into RAW_DATA_Biometrics.
 * Strictly obeys Law 3: missing numeric fields are written as "" (never false 0).
 */
function upsertBiometricRecords_(records) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BIO_RAW_TAB);
  if (!sheet) {
    throw new Error('Target silo tab missing: ' + BIO_RAW_TAB);
  }

  const lastRow = sheet.getLastRow();
  const indexMap = {};
  if (lastRow >= 2) {
    const existingKeys = sheet.getRange(2, 2, lastRow - 1, 2).getDisplayValues();
    for (let i = 0; i < existingKeys.length; i++) {
      const k = existingKeys[i][0].trim() + '|' + existingKeys[i][1].trim();
      indexMap[k] = i + 2;
    }
  }

  let inserted = 0;
  let updated = 0;
  const nowStr = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm:ss');

  records.forEach((rec) => {
    const dateStr = normalizeIsoDate_(rec.date);
    if (!dateStr) return;
    const source = rec.source ? String(rec.source).trim() : 'Health_Connect';

    const rowValues = [
      nowStr,
      dateStr,
      source,
      numOrBlank_(rec.sleep_hours),
      numOrBlank_(rec.sleep_score),
      numOrBlank_(rec.deep_rem_mins),
      numOrBlank_(rec.steps),
      numOrBlank_(rec.resting_hr),
      numOrBlank_(rec.hrv_ms),
      numOrBlank_(rec.active_calories),
      numOrBlank_(rec.weight_lbs),
      numOrBlank_(rec.workout_mins),
    ];

    const key = dateStr + '|' + source;
    if (indexMap[key]) {
      const rIdx = indexMap[key];
      const existingRow = sheet.getRange(rIdx, 1, 1, 12).getValues()[0];
      // Preserve previously synced non-blank fields if incoming partial packet omits them
      const merged = rowValues.map((val, colIdx) =>
        colIdx <= 2 ? val : val !== '' ? val : existingRow[colIdx]
      );
      sheet.getRange(rIdx, 1, 1, 12).setValues([merged]);
      updated++;
    } else {
      sheet.appendRow(rowValues);
      indexMap[key] = sheet.getLastRow();
      inserted++;
    }
  });

  return { inserted, updated, total_processed: inserted + updated };
}

function numOrBlank_(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}

function normalizeIsoDate_(raw) {
  if (!raw) return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse_(statusCode, obj) {
  return ContentService.createTextOutput(
    JSON.stringify({ status_code: statusCode, ...obj })
  ).setMimeType(ContentService.MimeType.JSON);
}

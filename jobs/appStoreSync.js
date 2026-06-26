import fs from "fs";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import axios from "axios";
import DownloadStat from "../models/downloadStatSchema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gunzip = promisify(zlib.gunzip);

const APP_STORE_CONNECT_BASE = "https://api.appstoreconnect.apple.com";

// ─── Helpers ────────────────────────────────────────────────────────────────

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

/**
 * Generate a short-lived ES256 JWT for App Store Connect API.
 * Tokens expire in 20 minutes max — we use 18m to be safe.
 */
const generateAppStoreJWT = ({ keyId, issuerId, privateKey }) => {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 18 * 60, // 18 minutes
    aud: "appstoreconnect-v1",
  };

  return jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header: {
      alg: "ES256",
      kid: keyId,
      typ: "JWT",
    },
  });
};

const parseTSV = (content) => {
  // Strip BOM if present (Apple reports can have a UTF-8 BOM)
  const clean = content.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/);

  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase());

  // Try multiple possible column names Apple uses across report versions
  const dateIdx = headers.findIndex(
    (h) => h === "begin date" || h === "date" || h.includes("begin date")
  );
  const unitsIdx = headers.findIndex((h) => h === "units" || h === "quantity");
  const productTypeIdx = headers.findIndex(
    (h) => h === "product type identifier" || h === "product type"
  );

  if (dateIdx === -1 || unitsIdx === -1) {
    console.error("📋 App Store TSV headers found:", headers);
    throw new Error(
      "Could not find 'Begin Date' or 'Units' column in App Store report."
    );
  }

  // Daily totals accumulator
  const dailyMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split("\t").map((c) => c.trim());

    const rawDate = columns[dateIdx];
    const rawUnits = columns[unitsIdx];
    const productType = productTypeIdx !== -1 ? columns[productTypeIdx] : "";

    // Apple Product Type Identifiers for free downloads:
    //   "1"   = Paid App
    //   "1F"  = Universal Purchase (free)
    //   "7"   = Update
    //   "F1"  = Free App
    // We want new installs only (type "1" and "1F" and "F1"), skip updates ("7")
    // If we cannot determine type, include all rows (conservative default)
    if (
      productType &&
      productType.toUpperCase() === "7" // skip updates
    ) {
      continue;
    }

    if (!rawDate || rawUnits === undefined) continue;

    // Apple dates come as MM/DD/YYYY
    let dateStr = rawDate;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [mm, dd, yyyy] = rawDate.split("/");
      dateStr = `${yyyy}-${mm}-${dd}`;
    }

    const date = startOfDay(new Date(dateStr));
    const units = parseInt(rawUnits, 10);

    if (!isNaN(date.getTime()) && !isNaN(units) && units > 0) {
      const key = date.toISOString();
      dailyMap.set(key, (dailyMap.get(key) || 0) + units);
    }
  }

  return Array.from(dailyMap.entries()).map(([key, downloads]) => ({
    date: new Date(key),
    downloads,
  }));
};

/**
 * Fetch a single daily report for a given date string (YYYY-MM-DD).
 * Returns null if the report is not yet available (404 / 404-like Apple error).
 */
const fetchDailyReport = async ({ token, vendorNumber, dateStr }) => {
  const url = `${APP_STORE_CONNECT_BASE}/v1/salesReports`;

  const params = {
    "filter[frequency]": "DAILY",
    "filter[reportType]": "INSTALLS",
    "filter[reportSubType]": "SUMMARY",
    "filter[reportDate]": dateStr,
    "filter[vendorNumber]": vendorNumber,
    "filter[version]": "1_0",
  };

  console.log(`📥 Fetching App Store report for date: ${dateStr}`);

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/a-gzip",
    },
    params,
    responseType: "arraybuffer",
    timeout: 30000,
    validateStatus: (status) =>
      (status >= 200 && status < 300) || status === 404,
  });

  if (response.status === 404) {
    // Apple returns 404 when the report isn't generated yet
    console.log(
      `ℹ️ App Store report for ${dateStr} not available yet (404).`
    );
    return null;
  }

  // Content-Type: application/a-gzip → decompress
  const decompressed = await gunzip(Buffer.from(response.data));
  const tsvContent = decompressed.toString("utf8");

  return tsvContent;
};

// ─── Main Export ─────────────────────────────────────────────────────────────

export const syncAppStoreDownloads = async () => {
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!keyId || !issuerId || !vendorNumber) {
    const errMsg =
      "Missing App Store Connect env vars (APP_STORE_KEY_ID, APP_STORE_ISSUER_ID, APP_STORE_VENDOR_NUMBER)";
    console.error(`⚠️ App Store Sync aborted: ${errMsg}`);
    throw new Error(errMsg);
  }

  let privateKey;

  const keyPath = path.join(__dirname, '../appstore-analytics.p8');
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `App Store private key file not found at: ${keyPath}`
    );
  }
  privateKey = fs.readFileSync(keyPath, "utf8");

  const now = new Date();
  const datesToCheck = [];

  for (let i = 1; i <= 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    datesToCheck.push(`${yyyy}-${mm}-${dd}`);
  }

  console.log("🔄 Starting App Store Installs Daily Sync...");

  // ── Generate JWT token ────────────────────────────────────────────────────
  const token = generateAppStoreJWT({ keyId, issuerId, privateKey });

  let allRecords = [];

  for (const dateStr of datesToCheck) {
    try {
      const tsvContent = await fetchDailyReport({
        token,
        vendorNumber,
        dateStr,
      });

      if (!tsvContent) continue;

      const records = parseTSV(tsvContent);
      console.log(
        `📊 Parsed ${records.length} install record(s) from ${dateStr}.`
      );
      allRecords = allRecords.concat(records);
    } catch (err) {
      // Apple API sometimes returns a JSON error body for 404s
      if (
        err.response?.status === 404 ||
        err.message?.includes("404") ||
        err.response?.status === 400
      ) {
        console.log(
          `ℹ️ No App Store report for ${dateStr}: ${err.response?.status ?? err.message}`
        );
      } else {
        console.error(
          `❌ Failed fetching App Store report for ${dateStr}:`,
          err.message
        );
        // Don't throw — log and continue so other dates still sync
      }
    }
  }

  if (allRecords.length === 0) {
    const msg =
      "No App Store install records retrieved.";
    console.log(`ℹ️ ${msg}`);
    return {
      success: true,
      message: msg,
      checkedDates: datesToCheck,
    };
  }

  // ── Deduplicate: if the same date appears from multiple fetches, sum them ──
  const deduped = new Map();
  for (const { date, downloads } of allRecords) {
    const key = startOfDay(date).toISOString();
    // Overwrite with the latest value rather than summing, to avoid double-counting
    // from overlapping date checks across runs
    if (!deduped.has(key) || downloads > deduped.get(key).downloads) {
      deduped.set(key, { date: startOfDay(date), downloads });
    }
  }

  const uniqueRecords = Array.from(deduped.values());
  console.log(`💾 Upserting ${uniqueRecords.length} records into MongoDB...`);

  const bulkOps = uniqueRecords.map((record) => ({
    updateOne: {
      filter: { date: record.date, platform: "ios" },
      update: { $set: { downloads: record.downloads } },
      upsert: true,
    },
  }));

  const result = await DownloadStat.bulkWrite(bulkOps);
  const successMsg = `App Store Sync completed. Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`;
  console.log(`✅ ${successMsg}`);

  return {
    success: true,
    message: successMsg,
    upsertedCount: result.upsertedCount,
    modifiedCount: result.modifiedCount,
    recordsCount: uniqueRecords.length,
    checkedDates: datesToCheck,
  };
};

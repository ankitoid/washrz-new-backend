import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";
import DownloadStat from "../models/downloadStatSchema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const parseCSV = (content) => {
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detect delimiter: tab or comma
  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine.split(delimiter).map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());

  const dateIdx = headers.findIndex(h => h.includes("date"));
  const installsIdx = headers.findIndex(h => h.includes("daily device installs") || h.includes("daily installs") || h === "installs");

  if (dateIdx === -1 || installsIdx === -1) {
    console.error("CSV Headers found:", headers);
    throw new Error("Could not find Date or Daily Installs column in CSV report.");
  }

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(delimiter).map(c => c.replace(/^"|"$/g, "").trim());
    const rawDate = columns[dateIdx];
    const rawInstalls = columns[installsIdx];

    if (!rawDate || rawInstalls === undefined) continue;

    // Parse date (Google format can be YYYYMMDD or YYYY-MM-DD)
    let dateStr = rawDate;
    if (/^\d{8}$/.test(rawDate)) {
      dateStr = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    }
    const date = startOfDay(new Date(dateStr));
    const downloads = parseInt(rawInstalls, 10);

    if (!isNaN(date.getTime()) && !isNaN(downloads)) {
      results.push({ date, downloads });
    }
  }

  return results;
};

export const syncPlayStoreDownloads = async () => {
  const package_name = process.env.PLAY_STORE_PACKAGE_NAME;
  const developerId = process.env.PLAY_STORE_DEVELOPER_ID;
  const envKeyPath = process.env.GOOGLE_PLAY_KEY_PATH;
  const defaultKeyPath = path.resolve(__dirname, "..", "customerapp-analytics.json");
  const keyPath = envKeyPath ? path.resolve(envKeyPath) : defaultKeyPath;

  if (!package_name || !developerId) {
    const errMsg = "Missing env configuration (PLAY_STORE_PACKAGE_NAME or PLAY_STORE_DEVELOPER_ID)";
    console.error(`⚠️ Play Store Sync aborted: ${errMsg}`);
    throw new Error(errMsg);
  }

  console.log(`🔑 Using Play Store key file: ${keyPath}`);

  try {
    console.log("🔄 Starting Play Store Downloads Daily Sync...");

    const storage = new Storage({ keyFilename: keyPath });
    const bucketName = `pubsite_prod_rev_${developerId}`;

    const now = new Date();
    const monthsToCheck = [];

    // Current month (YYYYMM)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    monthsToCheck.push(`${year}${month}`);

    // If early in the month (first 5 days), check the previous month's report too to catch final numbers
    if (now.getDate() <= 5) {
      const prevDate = new Date();
      prevDate.setMonth(now.getMonth() - 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = String(prevDate.getMonth() + 1).padStart(2, "0");
      monthsToCheck.push(`${prevYear}${prevMonth}`);
    }

    let allRecords = [];

    for (const monthStr of monthsToCheck) {
      const filePath = `stats/installs/installs_${package_name}_${monthStr}_overview.csv`;
      console.log(`📥 Checking GCS bucket: ${bucketName}, path: ${filePath}`);

      try {
        console.log(`📁 Attempting download from local key at: ${keyPath}`);
        const [fileContentBuffer] = await storage.bucket(bucketName).file(filePath).download();

        // Google Play Console exports reports in UTF-16LE encoding by default
        let csvContent = fileContentBuffer.toString("utf16le");
        if (!csvContent.includes("Date") && !csvContent.includes("date")) {
          // Fallback to UTF-8
          csvContent = fileContentBuffer.toString("utf8");
        }

        const records = parseCSV(csvContent);
        console.log(`📊 Parsed ${records.length} stats records from ${monthStr}.`);
        allRecords = allRecords.concat(records);
      } catch (err) {
        if (err.code === 404) {
          console.log(`ℹ️ Report file not found for ${monthStr} (may not be generated yet).`);
        } else {
          console.error(`❌ Failed downloading/parsing ${monthStr}:`, err.message);
          throw err;
        }
      }
    }

    if (allRecords.length === 0) {
      console.log("ℹ️ No records retrieved to update.");
      return {
        success: true,
        message: "No records found in GCS bucket files. (Reports may not be generated yet by Google Console)."
      };
    }

    console.log(`💾 Upserting ${allRecords.length} records into MongoDB...`);

    const bulkOps = allRecords.map((record) => ({
      updateOne: {
        filter: { date: record.date, platform: "android" },
        update: { $set: { downloads: record.downloads } },
        upsert: true,
      },
    }));

    const result = await DownloadStat.bulkWrite(bulkOps);
    const successMsg = `Play Store Sync completed. Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`;
    console.log(`✅ ${successMsg}`);
    
    return {
      success: true,
      message: successMsg,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
      recordsCount: allRecords.length
    };
  } catch (error) {
    console.error("❌ Play Store Sync failed:", error.message);
    throw error;
  }
};

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
 
  try {
 
    const storage = new Storage({ keyFilename: keyPath });
    const bucketName = `pubsite_prod_${developerId}`;
 
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthsToCheck = [];
 
    // ── Check which months already have up-to-date data in MongoDB ─────────
    // For current month: only skip if today’s record already exists.
    // For previous month: only include it (early-month correction) if the
    // last day of that month is missing.
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
 
    const existingThisMonth = await DownloadStat.findOne({
      platform: "android",
      date: { $gte: todayStart },
    }).lean();
 
    if (!existingThisMonth) {
      monthsToCheck.push(`${year}${month}`);
    }
 
    // If early in the month (≤5 days), also check previous month
    if (now.getDate() <= 5) {
      const prevDate = new Date();
      prevDate.setMonth(now.getMonth() - 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = String(prevDate.getMonth() + 1).padStart(2, "0");
 
      // Last day of previous month
      const lastDayOfPrevMonth = new Date(year, now.getMonth(), 0);
      lastDayOfPrevMonth.setHours(0, 0, 0, 0);
 
      const existingLastDayPrev = await DownloadStat.findOne({
        platform: "android",
        date: lastDayOfPrevMonth,
      }).lean();
 
      if (!existingLastDayPrev) {
        monthsToCheck.push(`${prevYear}${prevMonth}`);
      }
    }
 
    console.log(
      `ℹ️ Play Store sync: DB check done` +
      (monthsToCheck.length === 0
        ? " — data already up-to-date, nothing to fetch."
        : ` — fetching ${monthsToCheck.length} month(s): ${monthsToCheck.join(", ")}`)
    );
 
    if (monthsToCheck.length === 0) {
      return {
        success: true,
        message: "Play Store data is already up-to-date. No new months to fetch.",
        recordsCount: 0,
      };
    }
 
    let allRecords = [];
 
    for (const monthStr of monthsToCheck) {
      const filePath = `stats/installs/installs_${package_name}_${monthStr}_overview.csv`;
 
      try {
        const [fileContentBuffer] = await storage.bucket(bucketName).file(filePath).download();
 
        // Google Play Console exports reports in UTF-16LE encoding by default
        let csvContent = fileContentBuffer.toString("utf16le");
        if (!csvContent.includes("Date") && !csvContent.includes("date")) {
          // Fallback to UTF-8
          csvContent = fileContentBuffer.toString("utf8");
        }
 
        const records = parseCSV(csvContent);
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
     
      let bucketFiles = [];
      try {
        const [files] = await storage.bucket(bucketName).getFiles({ maxResults: 30 });
        bucketFiles = files.map(f => f.name);
      } catch (listErr) {
        console.error("Failed to list bucket files:", listErr.message);
        bucketFiles = ["Error listing bucket contents: " + listErr.message];
      }
 
      return {
        success: true,
        message: "No records found in GCS bucket files. (Reports may not be generated yet by Google Console).",
        searchedFiles: monthsToCheck.map(m => `stats/installs/installs_${package_name}_${m}_overview.csv`),
        availableFilesSample: bucketFiles
      };
    }
 
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
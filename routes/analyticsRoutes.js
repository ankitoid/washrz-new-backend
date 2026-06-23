import express from "express";
import {
  getAnalyticsOverview,
  ingestAnalyticsBatch,
  ingestAnalyticsEvent,
  upsertDailyDownloads,
  upsertDailyDownloadsBatch,
} from "../controller/analyticsController.js";
import { syncPlayStoreDownloads } from "../jobs/playStoreSync.js";

const router = express.Router();

router.post("/ingest", ingestAnalyticsEvent);
router.post("/ingest/batch", ingestAnalyticsBatch);
router.post("/downloads", upsertDailyDownloads);
router.post("/downloads/batch", upsertDailyDownloadsBatch);
router.get("/overview", getAnalyticsOverview);

router.get("/test-sync", async (req, res) => {
  try {
    const result = await syncPlayStoreDownloads();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack,
    });
  }
});

export default router;
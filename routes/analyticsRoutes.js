import express from "express";
import {
  getAnalyticsOverview,
  ingestAnalyticsBatch,
  ingestAnalyticsEvent,
  upsertDailyDownloads,
  upsertDailyDownloadsBatch,
} from "../controller/analyticsController.js";

const router = express.Router();

router.post("/ingest", ingestAnalyticsEvent);
router.post("/ingest/batch", ingestAnalyticsBatch);
router.post("/downloads", upsertDailyDownloads);
router.post("/downloads/batch", upsertDailyDownloadsBatch);
router.get("/overview", getAnalyticsOverview);

export default router;
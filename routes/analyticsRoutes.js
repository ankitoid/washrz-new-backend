import express from "express";
import {
  getAnalyticsOverview,
  ingestAnalyticsBatch,
  ingestAnalyticsEvent,
} from "../controller/analyticsController.js";

const router = express.Router();

router.post("/ingest", ingestAnalyticsEvent);
router.post("/ingest/batch", ingestAnalyticsBatch);
router.get("/overview", getAnalyticsOverview);

export default router;
import express from "express";
import {
  getAnalyticsEvents,
  getAnalyticsContract,
  getAnalyticsOverview,
  ingestAnalyticsBatch,
  ingestAnalyticsEvent,
} from "../controller/analyticsController.js";

const router = express.Router();

router.get("/contract", getAnalyticsContract);
router.post("/ingest", ingestAnalyticsEvent);
router.post("/ingest/batch", ingestAnalyticsBatch);
router.get("/overview", getAnalyticsOverview);
router.get("/events", getAnalyticsEvents);

export default router;
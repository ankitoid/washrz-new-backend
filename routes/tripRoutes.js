import express from "express";
import {
  startTrip,
  endTrip,
  getDailySummary,
  getCustomSummary,
  getTrips,
  resetTotalKm,
  getMonthlySummary,
  getActiveTrip
} from "../controller/tripController.js";

const router = express.Router();

router.post("/start", startTrip);
router.put("/:tripId/end", endTrip);

router.get("/daily/:riderId", getDailySummary);
router.get("/custom-summary/:riderId", getCustomSummary);
router.get("/monthly/:riderId", getMonthlySummary);
router.get("/:riderId", getTrips);

router.get("/active/:riderId", getActiveTrip);

router.post("/reset/:riderId", resetTotalKm);

export default router;
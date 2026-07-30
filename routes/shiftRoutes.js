import express from "express";
import {
  startShift,
  endShift,
  getDailyShiftSummary,
  getCustomShiftSummary,
  getShifts,
  resetShiftTotalKm,
  getMonthlyShiftSummary,
  getActiveShift,
  getRidersShiftSummary
} from "../controller/shiftController.js";

const router = express.Router();

// Start shift
router.post("/start", startShift);

// End shift (supports both :shiftId and fallback :tripId parameter)
router.put("/:shiftId/end", endShift);
router.put("/:tripId/end", endShift); // Compatibility fallback route

// Daily summaries
router.get("/daily/:riderId", getDailyShiftSummary);

// Custom range summary
router.get("/custom-summary/:riderId", getCustomShiftSummary);

// Monthly summary
router.get("/monthly/:riderId", getMonthlyShiftSummary);

// Riders summary overview (admin dashboard)
router.get("/riders-summary", getRidersShiftSummary);

// Active shift status check
router.get("/active/:riderId", getActiveShift);

// Reset rider total mileage
router.post("/reset/:riderId", resetShiftTotalKm);

// List/filter rider shifts
router.get("/:riderId", getShifts);

export default router;

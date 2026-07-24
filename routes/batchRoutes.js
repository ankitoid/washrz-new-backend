import express from "express";
import {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  updateConstraints,
  runOptimization,
  getBatchRosters,
  selectRoster,
  addLocationsToBatch,
  removeLocationsFromBatch,
  deleteBatch,
  getEligiblePickups,
  getEligibleOrders,
  geocodeAddress,
} from "../controllers/batchController.js";

const router = express.Router();

// Eligible stops listing (must be declared BEFORE parameterized routes)
router.get("/eligible-pickups", getEligiblePickups);
router.get("/eligible-orders", getEligibleOrders);
router.get("/geocode", geocodeAddress);

// Batch CRUD and Optimization endpoints
router.post("/", createBatch);
router.get("/", getBatches);
router.get("/:id", getBatchById);
router.put("/:id", updateBatch);
router.put("/:id/constraints", updateConstraints);
router.post("/:id/optimize", runOptimization);
router.get("/:id/rosters", getBatchRosters);
router.post("/:id/select-roster", selectRoster);
router.delete("/:id", deleteBatch);

// Dynamic Location Management (invalidates optimization rosters/trips)
router.put("/:id/add-locations", addLocationsToBatch);
router.put("/:id/remove-locations", removeLocationsFromBatch);

export default router;

import express from "express";
import {
  createTripsFromRoster,
  getTrips,
  getRiderTrips,
  getTripById,
  assignRider,
  updateTripStatus,
  updateTripStops,
  deleteTrip,
} from "../controllers/tripController.js";

const router = express.Router();

// Create trips from a selected Roster (optionally assign riderIds)
router.post("/rosters/:rosterId/trips", createTripsFromRoster);

// List VRP trips (supports query filters: batchId, rosterId, riderId, status)
router.get("/", getTrips);

// Get VRP trips assigned to a specific rider
router.get("/rider/:riderId", getRiderTrips);

// Get a single VRP trip by ID
router.get("/:id", getTripById);

// Assign rider (User ObjectId) to a trip
router.put("/:tripId/assign", assignRider);

// Update trip status (planned, assigned, in_progress, completed, cancelled)
router.put("/:tripId/status", updateTripStatus);

// Update/reorder stops on a trip
router.put("/:tripId/stops", updateTripStops);

// Delete VRP trip
router.delete("/:id", deleteTrip);

export default router;

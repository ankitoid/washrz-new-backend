import Trip from "../models/Trip.js";
import Roster from "../models/Roster.js";
import User from "../models/userModel.js";
import pickup from "../models/pickupSchema.js";
import Order from "../models/orderSchema.js";

/**
 * @desc   Create trip documents from a selected optimization Roster
 * @route  POST /api/v1/vrp-trips/rosters/:rosterId/trips
 */
export const createTripsFromRoster = async (req, res) => {
  try {
    const { rosterId } = req.params;

    const roster = await Roster.findById(rosterId);
    if (!roster) {
      return res.status(404).json({
        status: "error",
        message: `Roster with ID ${rosterId} not found`,
      });
    }

    if (!roster.feasible || !roster.routes || roster.routes.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Cannot create trips from an infeasible or empty roster",
      });
    }

    // Clean up any existing trips for this batch
    await Trip.deleteMany({ batchId: roster.batchId });

    const tripDocs = [];
    for (let i = 0; i < roster.routes.length; i++) {
      const route = roster.routes[i];

      tripDocs.push({
        batchId: roster.batchId,
        rosterId: roster._id,
        riderId: null,
        routeIndex: route.riderId,
        stopCount: route.stopCount,
        distanceKm: route.distanceKm,
        durationHours: route.durationHours,
        stops: route.stops,
        status: "planned",
        assignedAt: null,
      });
    }

    const createdTrips = await Trip.insertMany(tripDocs);

    return res.status(201).json({
      status: "success",
      count: createdTrips.length,
      data: createdTrips,
    });
  } catch (error) {
    console.error("[tripController.createTripsFromRoster] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create trips from roster",
    });
  }
};

/**
 * @desc   Get list of VRP trips with filters
 * @route  GET /api/v1/vrp-trips
 */
export const getTrips = async (req, res) => {
  try {
    const { batchId, rosterId, riderId, status } = req.query;
    const filter = {};

    if (batchId) filter.batchId = batchId;
    if (rosterId) filter.rosterId = rosterId;
    if (riderId) filter.riderId = riderId;
    if (status) filter.status = status;

    const trips = await Trip.find(filter)
      .populate("riderId", "name phone email role plant plantName")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      count: trips.length,
      data: trips,
    });
  } catch (error) {
    console.error("[tripController.getTrips] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch trips",
    });
  }
};

/**
 * @desc   Get VRP trips assigned to a specific Rider (User ObjectId)
 * @route  GET /api/v1/vrp-trips/rider/:riderId
 */
export const getRiderTrips = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status } = req.query;

    const filter = { riderId };
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ["planned", "assigned", "in_progress"] };
    }

    const trips = await Trip.find(filter)
      .populate("riderId", "name phone email role plant plantName")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      count: trips.length,
      data: trips,
    });
  } catch (error) {
    console.error("[tripController.getRiderTrips] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch rider trips",
    });
  }
};

/**
 * @desc   Get single VRP trip by ID
 * @route  GET /api/v1/vrp-trips/:id
 */
export const getTripById = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id).populate(
      "riderId",
      "name phone email role plant plantName"
    );

    if (!trip) {
      return res.status(404).json({
        status: "error",
        message: `Trip with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      status: "success",
      data: trip,
    });
  } catch (error) {
    console.error("[tripController.getTripById] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch trip",
    });
  }
};

/**
 * @desc   Assign a rider (User ID) to a VRP trip, propagating updates to Pickups and Orders
 * @route  PUT /api/v1/vrp-trips/:tripId/assign
 */
export const assignRider = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({
        status: "error",
        message: "riderId (User ID) is required",
      });
    }

    const riderUser = await User.findById(riderId);
    if (!riderUser) {
      return res.status(404).json({
        status: "error",
        message: `User (Rider) with ID ${riderId} not found`,
      });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        status: "error",
        message: `Trip with ID ${tripId} not found`,
      });
    }

    trip.riderId = riderId;
    trip.status = "assigned";
    trip.assignedAt = new Date();
    await trip.save();

    // Propagate assignments to pickups and delivery orders in the stops list
    if (trip.stops && Array.isArray(trip.stops)) {
      for (const stop of trip.stops) {
        if (stop.type === "pickup") {
          await pickup.findByIdAndUpdate(stop.id, {
            PickupStatus: "assigned",
            assignedRider: {
              pickup: {
                riderId: riderUser._id,
                riderName: riderUser.name,
                assignedAt: new Date(),
              },
            },
            riderName: riderUser.name
          });
        } else if (stop.type === "delivery") {
          await Order.findByIdAndUpdate(stop.id, {
            status: "delivery rider assigned",
            riderId: riderUser._id.toString(),
            riderName: riderUser.name,
            riderContact: riderUser.phone || "",
            riderAssignedAt: new Date(),
            assignedRider: {
              delivery: {
                riderId: riderUser._id,
                riderName: riderUser.name,
                assignedAt: new Date(),
              },
            },
          });
        }
      }
    }

    const updatedTrip = await Trip.findById(tripId).populate(
      "riderId",
      "name phone email role plant plantName"
    );

    return res.status(200).json({
      status: "success",
      message: `Assigned rider ${riderUser.name} to VRP trip. Stop assignments propagated successfully.`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("[tripController.assignRider] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to assign rider to trip",
    });
  }
};

/**
 * @desc   Update status of a VRP trip, propagating status to Pickups and Orders
 * @route  PUT /api/v1/vrp-trips/:tripId/status
 */
export const updateTripStatus = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { status } = req.body;

    const validStatuses = ["planned", "assigned", "in_progress", "completed", "cancelled"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        status: "error",
        message: `Trip with ID ${tripId} not found`,
      });
    }

    trip.status = status;
    if (status === "completed") {
      trip.completedAt = new Date();
    }
    await trip.save();

    // Propagate VRP status updates to individual pickup and order documents
    if (trip.stops && Array.isArray(trip.stops)) {
      for (const stop of trip.stops) {
        if (stop.type === "pickup") {
          let pickupStatus = "assigned";
          if (status === "completed") pickupStatus = "complete";
          if (status === "cancelled") pickupStatus = "pending"; // Reset to pending if trip cancelled

          await pickup.findByIdAndUpdate(stop.id, {
            PickupStatus: pickupStatus,
          });
        } else if (stop.type === "delivery") {
          let orderStatus = "delivery rider assigned";
          if (status === "completed") orderStatus = "delivered";
          if (status === "cancelled") orderStatus = "ready for delivery"; // Reset to ready if VRP trip cancelled

          await Order.findByIdAndUpdate(stop.id, {
            status: orderStatus,
          });
        }
      }
    }

    const updatedTrip = await Trip.findById(tripId).populate(
      "riderId",
      "name phone email role plant plantName"
    );

    return res.status(200).json({
      status: "success",
      message: `Trip status updated to ${status}. Stop statuses propagated successfully.`,
      data: updatedTrip,
    });
  } catch (error) {
    console.error("[tripController.updateTripStatus] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update trip status",
    });
  }
};

/**
 * @desc   Update / reorder stops for an individual trip
 * @route  PUT /api/v1/vrp-trips/:tripId/stops
 */
export const updateTripStops = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { stops } = req.body;

    if (!Array.isArray(stops)) {
      return res.status(400).json({
        status: "error",
        message: "stops must be an array",
      });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        status: "error",
        message: `Trip with ID ${tripId} not found`,
      });
    }

    trip.stops = stops;
    trip.stopCount = stops.filter((s) => s.type !== "depot").length;
    await trip.save();

    const updatedTrip = await Trip.findById(tripId).populate(
      "riderId",
      "name phone email role plant plantName"
    );

    return res.status(200).json({
      status: "success",
      message: "Trip stops updated successfully",
      data: updatedTrip,
    });
  } catch (error) {
    console.error("[tripController.updateTripStops] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update trip stops",
    });
  }
};

/**
 * @desc   Delete a VRP trip
 * @route  DELETE /api/v1/vrp-trips/:id
 */
export const deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        status: "error",
        message: `Trip with ID ${id} not found`,
      });
    }

    // Revert stops in this VRP trip to unassigned states (maintains batchId association)
    if (trip.stops && Array.isArray(trip.stops)) {
      for (const stop of trip.stops) {
        if (stop.type === "pickup") {
          await pickup.findByIdAndUpdate(stop.id, {
            $set: {
              PickupStatus: "pending",
              assignedRider: null,
            },
          });
        } else if (stop.type === "delivery") {
          await Order.findByIdAndUpdate(stop.id, {
            $set: {
              status: "ready for delivery",
              riderId: null,
              riderName: null,
              riderContact: null,
              riderAssignedAt: null,
              assignedRider: null,
            },
          });
        }
      }
    }

    await Trip.findByIdAndDelete(id);

    return res.status(200).json({
      status: "success",
      message: "Trip deleted successfully and associated stops reverted.",
      data: { id },
    });
  } catch (error) {
    console.error("[tripController.deleteTrip] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to delete trip",
    });
  }
};

import mongoose from "mongoose";
import Trip from "../models/Trip.js";
import Roster from "../models/Roster.js";
import User from "../models/userModel.js";
import pickup from "../models/pickupSchema.js";
import Order from "../models/orderSchema.js";

const populateTripStops = async (trips) => {
  const isArray = Array.isArray(trips);
  const tripsList = isArray ? trips : [trips];

  const pickupIds = [];
  const orderIds = [];
  tripsList.forEach(t => {
    t.stops?.forEach(stop => {
      if (stop.type === "pickup" && stop.id && mongoose.Types.ObjectId.isValid(stop.id)) {
        pickupIds.push(stop.id);
      }
      if (stop.type === "delivery" && stop.id && mongoose.Types.ObjectId.isValid(stop.id)) {
        orderIds.push(stop.id);
      }
    });
  });

  const [pickups, orders] = await Promise.all([
    pickup.find({ _id: { $in: pickupIds } }),
    Order.find({ _id: { $in: orderIds } })
  ]);

  const pickupsMap = new Map(pickups.map(p => [p._id.toString(), p]));
  const ordersMap = new Map(orders.map(o => [o._id.toString(), o]));

  const populated = tripsList.map(t => {
    const tripObj = t.toObject ? t.toObject() : t;
    tripObj.stops = (tripObj.stops || []).map(stop => {
      if (stop.type === "pickup") {
        const p = pickupsMap.get(stop.id);
        if (p) {
          return {
            ...stop,
            address: p.Address || p.address || "",
            isDeleted: p.isDeleted || false,
            isRescheduled: p.isRescheduled || false,
            status: p.PickupStatus === "complete" ? "completed" : "pending"
          };
        }
      } else if (stop.type === "delivery") {
        const o = ordersMap.get(stop.id);
        if (o) {
          return {
            ...stop,
            address: o.address || "",
            isDeleted: o.isDeleted || false,
            isRescheduled: o.isRescheduled || false,
            status: o.status === "delivered" ? "completed" : "pending"
          };
        }
      }
      return stop;
    });
    return tripObj;
  });

  return isArray ? populated : populated[0];
};

export const syncTripStatus = async (stopId) => {
  try {
    const associatedTrip = await Trip.findOne({ "stops.id": stopId });
    if (associatedTrip) {
      const pickupIds = [];
      const orderIds = [];
      associatedTrip.stops.forEach(stop => {
        if (stop.type === "pickup" && stop.id && mongoose.Types.ObjectId.isValid(stop.id)) {
          pickupIds.push(stop.id);
        }
        if (stop.type === "delivery" && stop.id && mongoose.Types.ObjectId.isValid(stop.id)) {
          orderIds.push(stop.id);
        }
      });

      const [pickups, orders] = await Promise.all([
        pickup.find({ _id: { $in: pickupIds } }),
        Order.find({ _id: { $in: orderIds } })
      ]);

      const pickupsMap = new Map(pickups.map(p => [
        p._id.toString(),
        { isDone: p.PickupStatus === "complete" || p.isDeleted || p.isRescheduled }
      ]));
      const ordersMap = new Map(orders.map(o => [
        o._id.toString(),
        { isDone: o.status === "delivered" || o.isDeleted || o.isRescheduled }
      ]));

      let resolvedCount = 0;
      let totalNonDepot = 0;

      associatedTrip.stops.forEach(stop => {
        if (stop.type === "pickup") {
          totalNonDepot++;
          const pData = pickupsMap.get(stop.id);
          if (pData?.isDone) {
            resolvedCount++;
          }
        } else if (stop.type === "delivery") {
          totalNonDepot++;
          const oData = ordersMap.get(stop.id);
          if (oData?.isDone) {
            resolvedCount++;
          }
        }
      });

      if (resolvedCount === totalNonDepot && totalNonDepot > 0) {
        associatedTrip.status = "completed";
        associatedTrip.completedAt = new Date();
      } else if (resolvedCount > 0) {
        associatedTrip.status = "in_progress";
      } else {
        associatedTrip.status = "assigned";
      }
      await associatedTrip.save();
    }
  } catch (err) {
    console.error("[syncTripStatus] Error syncing VRP Trip status:", err);
  }
};

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

    const populatedTrips = await populateTripStops(trips);

    return res.status(200).json({
      status: "success",
      count: populatedTrips.length,
      data: populatedTrips,
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
      if (status === "all") {
        // Do not apply any status filter (returns all trips: planned, assigned, in_progress, completed, cancelled)
      } else if (status.includes(",")) {
        filter.status = { $in: status.split(",") };
      } else if (status === "assigned" || status === "active" || status === "non_completed") {
        filter.status = { $in: ["assigned", "in_progress"] };
      } else if (status === "assigned_only") {
        filter.status = "assigned";
      } else {
        filter.status = status;
      }
    } else {
      filter.status = { $in: ["planned", "assigned", "in_progress"] };
    }

    let trips = await Trip.find(filter)
      .populate("riderId", "name phone email role plant plantName")
      .sort({ createdAt: -1 });

    let populatedTrips = await populateTripStops(trips);

    if (req.query.pendingStopsOnly === "true") {
      populatedTrips = populatedTrips.map(t => {
        t.stops = t.stops.filter(stop => stop.status !== "completed");
        return t;
      });
    }

    return res.status(200).json({
      status: "success",
      count: populatedTrips.length,
      data: populatedTrips,
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

    const populatedTrip = await populateTripStops(trip);
    if (req.query.pendingStopsOnly === "true") {
      populatedTrip.stops = populatedTrip.stops.filter(stop => stop.status !== "completed");
    }

    return res.status(200).json({
      status: "success",
      data: populatedTrip,
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

    // Validation: Ensure the rider does not have any other active VRP trip (assigned or in_progress)
    const activeTrip = await Trip.findOne({
      riderId,
      status: { $in: ["assigned", "in_progress"] },
      _id: { $ne: tripId }
    });

    if (activeTrip) {
      return res.status(400).json({
        status: "error",
        message: `Rider ${riderUser.name} already has an active trip (Trip ID: ${activeTrip._id}) assigned. Please complete or unassign the active trip first.`,
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
      if (trip.stops && Array.isArray(trip.stops)) {
        trip.stops.forEach(stop => {
          stop.status = "completed";
        });
      }
    } else if (status === "cancelled" || status === "planned" || status === "assigned") {
      if (trip.stops && Array.isArray(trip.stops)) {
        trip.stops.forEach(stop => {
          stop.status = "pending";
        });
      }
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
          const pDoc = await pickup.findById(stop.id);
          if (pDoc) {
            pDoc.PickupStatus = "pending";
            pDoc.assignedRider = { pickup: null };
            await pDoc.save();
          }
        } else if (stop.type === "delivery") {
          const oDoc = await Order.findById(stop.id);
          if (oDoc) {
            oDoc.status = "ready for delivery";
            oDoc.riderId = undefined;
            oDoc.riderName = undefined;
            oDoc.riderContact = undefined;
            oDoc.riderAssignedAt = undefined;
            oDoc.assignedRider = {
              pickup: oDoc.assignedRider?.pickup || null,
              delivery: null
            };
            await oDoc.save();
          }
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

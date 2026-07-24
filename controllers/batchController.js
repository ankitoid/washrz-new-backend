import Batch from "../models/Batch.js";
import Roster from "../models/Roster.js";
import Trip from "../models/Trip.js";
import pickup from "../models/pickupSchema.js";
import Order from "../models/orderSchema.js";
import User from "../models/userModel.js";
import { runOptimization as optimizeBatchService } from "../services/optimizerService.js";
import { DEFAULT_CONSTRAINTS } from "../config/constants.js";
import { geocodeWithOla } from "../services/olaMapsService.js";

/**
 * @desc   Create a new VRP batch
 * @route  POST /api/v1/batches
 */
export const createBatch = async (req, res) => {
  try {
    const { name, pickupIds = [], orderIds = [], constraints = {} } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Batch name is required",
      });
    }

    const mergedConstraints = {
      ...DEFAULT_CONSTRAINTS,
      ...constraints,
    };

    const batch = await Batch.create({
      name,
      pickupIds,
      orderIds,
      constraints: mergedConstraints,
      selectedRosterId: null,
      status: "created",
    });

    // Update pickups and orders to associate them with the batch
    if (pickupIds && pickupIds.length > 0) {
      await pickup.updateMany({ _id: { $in: pickupIds } }, { $set: { batchId: batch._id } });
    }
    if (orderIds && orderIds.length > 0) {
      await Order.updateMany({ _id: { $in: orderIds } }, { $set: { batchId: batch._id } });
    }

    return res.status(201).json({
      status: "success",
      data: batch,
    });
  } catch (error) {
    console.error("[batchController.createBatch] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create batch",
    });
  }
};

/**
 * @desc   Get all VRP batches with filters (status, name, date range)
 * @route  GET /api/v1/batches
 */
export const getBatches = async (req, res) => {
  try {
    const { status, name, startDate, endDate, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const batches = await Batch.find(filter)
      .populate("selectedRosterId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Batch.countDocuments(filter);

    return res.status(200).json({
      status: "success",
      count: batches.length,
      total,
      page: parseInt(page, 10),
      data: batches,
    });
  } catch (error) {
    console.error("[batchController.getBatches] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch batches",
    });
  }
};

/**
 * @desc   Get single VRP batch by ID with populated pickups, orders, rosters, and active trips
 * @route  GET /api/v1/batches/:id
 */
export const getBatchById = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findById(id)
      .populate("pickupIds")
      .populate({
        path: "orderIds",
        populate: { path: "items.itemId" },
      })
      .populate("selectedRosterId");

    if (!batch) {
      return res.status(404).json({
        status: "error",
        message: `Batch with ID ${id} not found`,
      });
    }

    const rosters = await Roster.find({ batchId: id }).sort({ riderCount: 1 });

    let trips = [];
    if (batch.selectedRosterId) {
      trips = await Trip.find({ batchId: id, rosterId: batch.selectedRosterId._id || batch.selectedRosterId })
        .populate("riderId", "name phone email role plant plantName")
        .sort({ routeIndex: 1 });
    }

    return res.status(200).json({
      status: "success",
      data: {
        batch,
        rosters,
        selectedRoster: batch.selectedRosterId,
        trips,
      },
    });
  } catch (error) {
    console.error("[batchController.getBatchById] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch batch",
    });
  }
};

/**
 * @desc   Update constraints for a batch
 * @route  PUT /api/v1/batches/:id/constraints
 */
export const updateConstraints = async (req, res) => {
  try {
    const { id } = req.params;
    const { constraints = {} } = req.body;

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({
        status: "error",
        message: `Batch with ID ${id} not found`,
      });
    }

    const currentConstraints = batch.constraints?.toObject ? batch.constraints.toObject() : batch.constraints;
    batch.constraints = {
      ...DEFAULT_CONSTRAINTS,
      ...currentConstraints,
      ...constraints,
    };

    await batch.save();

    return res.status(200).json({
      status: "success",
      data: batch,
    });
  } catch (error) {
    console.error("[batchController.updateConstraints] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update constraints",
    });
  }
};

/**
 * @desc   Run optimization for a batch (clears old rosters/trips and saves new options)
 * @route  POST /api/v1/batches/:id/optimize
 */
export const runOptimization = async (req, res) => {
  try {
    const { id } = req.params;
    const { constraints = {} } = req.body;

    const batch = await Batch.findById(id);
    // console.log("all batch list: ", batch)
    if (!batch) {
      return res.status(404).json({
        status: "error",
        message: `Batch with ID ${id} not found`,
      });
    }

    const rosters = await optimizeBatchService(batch, constraints);

    return res.status(200).json({
      status: "success",
      message: "Batch optimization completed successfully",
      data: {
        batch,
        rosters,
      },
    });
  } catch (error) {
    console.error("[batchController.runOptimization] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Optimization failed",
    });
  }
};

/**
 * @desc   Fetch all rosters generated for a batch
 * @route  GET /api/v1/batches/:id/rosters
 */
export const getBatchRosters = async (req, res) => {
  try {
    const { id } = req.params;

    const rosters = await Roster.find({ batchId: id }).sort({ riderCount: 1 });

    return res.status(200).json({
      status: "success",
      count: rosters.length,
      data: rosters,
    });
  } catch (error) {
    console.error("[batchController.getBatchRosters] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch rosters",
    });
  }
};

/**
 * @desc   Select a roster for a batch, wiping old trips and creating fresh trips (rider assignment done in next step)
 * @route  POST /api/v1/batches/:id/select-roster
 */
export const selectRoster = async (req, res) => {
  try {
    const { id } = req.params;
    const { rosterId } = req.body;

    if (!rosterId) {
      return res.status(400).json({
        status: "error",
        message: "rosterId is required to select a roster",
      });
    }

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({
        status: "error",
        message: `Batch with ID ${id} not found`,
      });
    }

    const roster = await Roster.findById(rosterId);
    if (!roster) {
      return res.status(404).json({
        status: "error",
        message: `Roster with ID ${rosterId} not found`,
      });
    }

    if (roster.batchId.toString() !== id) {
      return res.status(400).json({
        status: "error",
        message: `Roster ${rosterId} does not belong to Batch ${id}`,
      });
    }

    if (!roster.feasible || !roster.routes || roster.routes.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Cannot select an infeasible or empty roster",
      });
    }

    // Step 1: Wipe all previously created VRP trips for this batch
    await Trip.deleteMany({ batchId: id });

    // Step 2: Mark roster as selected in Batch document
    batch.selectedRosterId = rosterId;
    await batch.save();

    // Step 3: Create Trip documents ONLY for the routes in the selected roster (unassigned / planned status)
    const tripDocs = [];
    for (let i = 0; i < roster.routes.length; i++) {
      const route = roster.routes[i];

      tripDocs.push({
        batchId: batch._id,
        rosterId: roster._id,
        riderId: null, // Left unassigned initially
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

    return res.status(200).json({
      status: "success",
      message: `Selected Roster ${rosterId} for Batch ${id}. Created ${createdTrips.length} planned trips.`,
      data: {
        batch,
        selectedRoster: roster,
        trips: createdTrips,
      },
    });
  } catch (error) {
    console.error("[batchController.selectRoster] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to select roster",
    });
  }
};

/**
 * @desc   Dynamically add pickups/deliveries to a batch and invalidate old rosters/trips
 * @route  PUT /api/v1/batches/:id/add-locations
 */
export const addLocationsToBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { pickupIds = [], orderIds = [] } = req.body;

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({
        status: "error",
        message: `Batch with ID ${id} not found`,
      });
    }

    // Add unique entries
    const existingPickupIds = batch.pickupIds.map((pid) => pid.toString());
    pickupIds.forEach((pid) => {
      if (!existingPickupIds.includes(pid.toString())) {
        batch.pickupIds.push(pid);
      }
    });

    const existingOrderIds = batch.orderIds.map((oid) => oid.toString());
    orderIds.forEach((oid) => {
      if (!existingOrderIds.includes(oid.toString())) {
        batch.orderIds.push(oid);
      }
    });

    // Reset status and clear previous optimization results since inputs changed
    batch.status = "created";
    batch.selectedRosterId = null;
    await batch.save();

    // Associate the new locations with the batch
    if (pickupIds && pickupIds.length > 0) {
      await pickup.updateMany({ _id: { $in: pickupIds } }, { $set: { batchId: batch._id } });
    }
    if (orderIds && orderIds.length > 0) {
      await Order.updateMany({ _id: { $in: orderIds } }, { $set: { batchId: batch._id } });
    }

    await Roster.deleteMany({ batchId: id });
    await Trip.deleteMany({ batchId: id });

    return res.status(200).json({
      status: "success",
      message: "Locations added successfully. Optimization results have been reset.",
      data: batch,
    });
  } catch (error) {
    console.error("[batchController.addLocationsToBatch] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to add locations to batch",
    });
  }
};

/**
 * @desc   Dynamically remove pickups/deliveries from a batch and invalidate old rosters/trips
 * @route  PUT /api/v1/batches/:id/remove-locations
 */
export const removeLocationsFromBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { pickupIds = [], orderIds = [] } = req.body;

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({
        status: "error",
        message: `Batch with ID ${id} not found`,
      });
    }

    // Remove matching entries
    batch.pickupIds = batch.pickupIds.filter((pid) => !pickupIds.includes(pid.toString()));
    batch.orderIds = batch.orderIds.filter((oid) => !orderIds.includes(oid.toString()));

    // Reset status and clear previous optimization results since inputs changed
    batch.status = "created";
    batch.selectedRosterId = null;
    await batch.save();

    // Revert batch association and reset task statuses for the removed locations
    if (pickupIds && pickupIds.length > 0) {
      await pickup.updateMany(
        { _id: { $in: pickupIds } },
        { $set: { batchId: null, PickupStatus: "pending", assignedRider: null } }
      );
    }
    if (orderIds && orderIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: orderIds } },
        {
          $set: {
            batchId: null,
            status: "ready for delivery",
            riderId: null,
            riderName: null,
            riderContact: null,
            riderAssignedAt: null,
            assignedRider: null,
          },
        }
      );
    }

    await Roster.deleteMany({ batchId: id });
    await Trip.deleteMany({ batchId: id });

    return res.status(200).json({
      status: "success",
      message: "Locations removed successfully. Optimization results have been reset.",
      data: batch,
    });
  } catch (error) {
    console.error("[batchController.removeLocationsFromBatch] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to remove locations from batch",
    });
  }
};

/**
 * @desc   Delete a batch, reverting status and batchId on all associated pickups and orders
 * @route  DELETE /api/v1/batches/:id
 */
export const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({
        status: "error",
        message: `Batch with ID ${id} not found`,
      });
    }

    // Revert batch association and status on all associated pickups
    if (batch.pickupIds && batch.pickupIds.length > 0) {
      await pickup.updateMany(
        { _id: { $in: batch.pickupIds } },
        { $set: { batchId: null, PickupStatus: "pending", assignedRider: null } }
      );
    }

    // Revert batch association and status on all associated orders
    if (batch.orderIds && batch.orderIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: batch.orderIds } },
        {
          $set: {
            batchId: null,
            status: "ready for delivery",
            riderId: null,
            riderName: null,
            riderContact: null,
            riderAssignedAt: null,
            assignedRider: null,
          },
        }
      );
    }

    // Delete associated rosters and trips
    await Roster.deleteMany({ batchId: id });
    await Trip.deleteMany({ batchId: id });

    // Delete the batch document itself
    await Batch.findByIdAndDelete(id);

    return res.status(200).json({
      status: "success",
      message: "Batch deleted successfully and all associated pickup/delivery tasks reverted.",
      data: { id },
    });
  } catch (error) {
    console.error("[batchController.deleteBatch] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to delete batch",
    });
  }
};

/**
 * @desc   Get pending pickups that are eligible to be optimized (excluding already batched ones by default)
 * @route  GET /api/v1/batches/eligible-pickups
 */
export const getEligiblePickups = async (req, res) => {
  try {
    const { email, plantName, date, startDate, endDate, excludeBatched = "true", status = "pending", page = 1, limit = 1000 } = req.query;
    
    const filter = {
      PickupStatus: status,
      isDeleted: false,
    };

    // Exclude batched pickups by default
    if (excludeBatched === "true") {
      filter.$or = [
        { batchId: null },
        { batchId: { $exists: false } },
      ];
    }

    // Filter by plant name (via user email lookup or direct param)
    let plant = plantName;
    if (email) {
      const user = await User.findOne({ email });
      if (user) {
        plant = user.plantName || user.plant;
      }
    }
    if (plant) {
      filter.plantName = plant;
    }

    // Filter by pickup date
    if (startDate || endDate) {
      filter.pickup_date = {};
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        filter.pickup_date.$gte = sDate;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.pickup_date.$lte = eDate;
      }
    } else if (date) {
      const singleStart = new Date(date);
      singleStart.setHours(0, 0, 0, 0);
      const singleEnd = new Date(date);
      singleEnd.setHours(23, 59, 59, 999);
      filter.pickup_date = { $gte: singleStart, $lte: singleEnd };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const pickups = await pickup.find(filter)
      .sort({ pickup_date: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await pickup.countDocuments(filter);

    return res.status(200).json({
      status: "success",
      count: pickups.length,
      total,
      page: parseInt(page, 10),
      data: pickups,
    });
  } catch (error) {
    console.error("[batchController.getEligiblePickups] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch eligible pickups",
    });
  }
};

/**
 * @desc   Get ready-for-delivery orders that are eligible to be optimized (excluding already batched ones by default)
 * @route  GET /api/v1/batches/eligible-orders
 */
export const getEligibleOrders = async (req, res) => {
  try {
    const { email, plantName, excludeBatched = "true", status = "ready for delivery", page = 1, limit = 1000 } = req.query;

    const filter = {
      status,
      isRescheduled: false,
    };

    // Exclude batched orders by default
    if (excludeBatched === "true") {
      filter.$or = [
        { batchId: null },
        { batchId: { $exists: false } },
      ];
    }

    // Filter by plant name (via user email lookup or direct param)
    let plant = plantName;
    if (email) {
      const user = await User.findOne({ email });
      if (user) {
        plant = user.plantName || user.plant;
      }
    }
    if (plant) {
      filter.plantName = plant;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const orders = await Order.find(filter)
      .populate({
        path: "items.itemId",
        select: "weight type label",
      })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Order.countDocuments(filter);

    return res.status(200).json({
      status: "success",
      count: orders.length,
      total,
      page: parseInt(page, 10),
      data: orders,
    });
  } catch (error) {
    console.error("[batchController.getEligibleOrders] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch eligible orders",
    });
  }
};

/**
 * @desc   Update VRP batch details (name, locations, constraints)
 * @route  PUT /api/v1/batches/:id
 */
export const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, pickupIds, orderIds, constraints } = req.body;

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({
        status: "error",
        message: `Batch with ID ${id} not found`,
      });
    }

    if (name) batch.name = name;
    if (constraints) {
      batch.constraints = {
        ...DEFAULT_CONSTRAINTS,
        ...(batch.constraints?.toObject ? batch.constraints.toObject() : batch.constraints),
        ...constraints,
      };
    }

    if (pickupIds || orderIds) {
      // Revert old locations batchId associations
      if (batch.pickupIds && batch.pickupIds.length > 0) {
        await pickup.updateMany({ _id: { $in: batch.pickupIds } }, { $set: { batchId: null } });
      }
      if (batch.orderIds && batch.orderIds.length > 0) {
        await Order.updateMany({ _id: { $in: batch.orderIds } }, { $set: { batchId: null } });
      }

      if (pickupIds) batch.pickupIds = pickupIds;
      if (orderIds) batch.orderIds = orderIds;

      // Associate new locations with the batch
      if (pickupIds && pickupIds.length > 0) {
        await pickup.updateMany({ _id: { $in: pickupIds } }, { $set: { batchId: batch._id } });
      }
      if (orderIds && orderIds.length > 0) {
        await Order.updateMany({ _id: { $in: orderIds } }, { $set: { batchId: batch._id } });
      }

      // Reset optimization status and wipe previous rosters/trips
      batch.status = "created";
      batch.selectedRosterId = null;
      await Roster.deleteMany({ batchId: id });
      await Trip.deleteMany({ batchId: id });
    }

    await batch.save();

    return res.status(200).json({
      status: "success",
      data: batch,
    });
  } catch (error) {
    console.error("[batchController.updateBatch] Error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update batch details",
    });
  }
};

/**
 * @desc   Geocode an address string using Ola Maps API
 * @route  GET /api/v1/batches/geocode
 */
export const geocodeAddress = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({
        status: "error",
        message: "Address query parameter is required",
      });
    }

    const coordinates = await geocodeWithOla(address);
    return res.status(200).json({
      status: "success",
      data: coordinates,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to geocode address",
    });
  }
};

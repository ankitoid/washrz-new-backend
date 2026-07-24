import axios from "axios";
import pickup from "../models/pickupSchema.js";
import Order from "../models/orderSchema.js";
import Roster from "../models/Roster.js";
import Trip from "../models/Trip.js";
import { DEFAULT_CONSTRAINTS, DEPOT, OPTIMIZER_API_URL } from "../config/constants.js";
import { geocodeWithOla } from "./olaMapsService.js";

const ITEM_TYPE_WEIGHT_KG = {
  shoespa: 0.5,
  dryclean: 0.2,
};

/**
 * Builds the locations array required by the VRP optimizer.
 * Includes the depot first, followed by pickups and deliveries.
 * 
 * @param {Array<string|ObjectId>} pickupIds 
 * @param {Array<string|ObjectId>} orderIds 
 * @returns {Promise<Array<Object>>}
 */
export const buildLocations = async (pickupIds = [], orderIds = []) => {
  const locations = [
    {
      id: "DEPOT",
      name: DEPOT.name,
      lat: DEPOT.lat,
      lng: DEPOT.lng,
      type: "depot",
      price: 0,
      item_types: [],
      delivery_weight: 0,
    },
  ];

  // Fetch and map Pickups
  if (pickupIds && pickupIds.length > 0) {
    const pickups = await pickup.find({ _id: { $in: pickupIds } });
    for (const p of pickups) {
      let lat = p.pickupLocation?.latitude ?? p.lat;
      let lng = p.pickupLocation?.longitude ?? p.lng;

      if (lat === undefined || lat === null || lng === undefined || lng === null) {
        const address = p.Address || p.address;
        if (address) {
          console.log(`[optimizerService] Geocoding missing coordinates for pickup ID ${p._id}: "${address}"`);
          try {
            const coords = await geocodeWithOla(address);
            lat = coords.lat;
            lng = coords.lng;

            // Update database document
            p.pickupLocation = {
              latitude: lat,
              longitude: lng
            };
            await p.save();
            console.log(`[optimizerService] Geocoded successfully and updated in database: ${lat}, ${lng}`);
          } catch (err) {
            console.error(`[optimizerService] Geocoding failed for pickup ID ${p._id}:`, err.message);
          }
        }
      }

      if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        locations.push({
          id: p._id.toString(),
          name: p.Name || p.contactName || p.Address || "Pickup Stop",
          lat: Number(lat),
          lng: Number(lng),
          type: "pickup",
          price: p.totalAmount || 0,
          item_types: [],
          delivery_weight: 0,
        });
      }
    }
  }

  // Fetch and map Orders (Deliveries), populating CatalogItem for weight and type
  if (orderIds && orderIds.length > 0) {
    const orders = await Order.find({ _id: { $in: orderIds } }).populate({
      path: "items.itemId",
      select: "weight type label",
    });

    for (const o of orders) {
      const lat = o.orderLocation?.latitude ?? o.lat;
      const lng = o.orderLocation?.longitude ?? o.lng;
      if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        let totalWeight = 0;
        const itemTypesSet = new Set();

        if (o.items && Array.isArray(o.items)) {
          for (const item of o.items) {
            const catalogItem = item.itemId;
            const quantity = item.quantity || 1;
            
            const itemType = String(catalogItem?.type || item?.type || "").trim().toLowerCase();
            if (itemType) {
              itemTypesSet.add(itemType);
              const unitWeight = ITEM_TYPE_WEIGHT_KG[itemType] || 0.0;
              totalWeight += unitWeight * quantity;
            }
          }
        }

        locations.push({
          id: o._id.toString(),
          name: o.customerName || "Delivery Stop",
          lat: Number(lat),
          lng: Number(lng),
          type: "delivery",
          price: o.totalAmount || 0,
          item_types: Array.from(itemTypesSet).sort(),
          delivery_weight: Number(totalWeight.toFixed(2)),
        });
      }
    }
  }

  return locations;
};

/**
 * Calls the external Python VRP Optimizer API and saves returned rosters.
 * Clears any previous rosters and trips for this batch to ensure fresh data.
 * 
 * @param {Object} batch - Batch document from MongoDB
 * @param {Object} [customConstraints={}] - Optional constraint overrides
 * @returns {Promise<Array<Object>>} Array of created Roster documents
 */
export const runOptimization = async (batch, customConstraints = {}) => {
  try {
    const existingConstraints = batch.constraints?.toObject ? batch.constraints.toObject() : batch.constraints;
    const mergedConstraints = {
      ...DEFAULT_CONSTRAINTS,
      ...existingConstraints,
      ...customConstraints,
    };

    // Update batch status to processing and reset selected roster
    batch.status = "processing";
    batch.constraints = mergedConstraints;
    batch.selectedRosterId = null;
    await batch.save();

    // Wipe previous rosters and trips for this batch upon new optimization run
    await Roster.deleteMany({ batchId: batch._id });
    await Trip.deleteMany({ batchId: batch._id });

    // Build locations array from pickups and orders
    console.log("batch.pickupIds, batch.orderIds", {pickupIds: batch.pickupIds, orderIds: batch.orderIds})
    const locations = await buildLocations(batch.pickupIds, batch.orderIds);

    if (locations.length < 2) {
      throw new Error("At least one valid pickup or delivery location with valid coordinates is required alongside the depot.");
    }

    const payload = {
      ...mergedConstraints,
      locations,
      generateRoster: true,
      analyzeRemoval: true,
    };

    // console.log("this is the final payload:: ", payload)

    console.log(`[optimizerService] Sending request to ${OPTIMIZER_API_URL} with ${locations.length} locations...`);

    const response = await axios.post(OPTIMIZER_API_URL, payload, {
      timeout: 60000,
      headers: { "Content-Type": "application/json" },
    });

    const responseData = response.data;

    if (!responseData || responseData.status !== "success" || !Array.isArray(responseData.rosters)) {
      const errMsg = responseData?.error || "Optimizer returned unsuccessful status or invalid roster payload";
      throw new Error(errMsg);
    }

    const savedRosters = [];
    for (const rosterData of responseData.rosters) {
      const rosterDoc = await Roster.create({
        batchId: batch._id,
        riderCount: rosterData.riderCount,
        feasible: Boolean(rosterData.feasible),
        totalDistanceKm: rosterData.totalDistanceKm || 0,
        usedRiders: rosterData.usedRiders || 0,
        status: rosterData.status || (rosterData.feasible ? "success" : "infeasible"),
        error: rosterData.error || null,
        diagnosis: rosterData.diagnosis || null,
        removalAnalysis: rosterData.removalAnalysis || [],
        routes: rosterData.routes || [],
      });
      savedRosters.push(rosterDoc);
    }

    batch.status = "optimized";
    await batch.save();

    return savedRosters;
  } catch (error) {
    console.error("[optimizerService] Optimization failed:", error.message);
    batch.status = "failed";
    await batch.save();
    throw error;
  }
};

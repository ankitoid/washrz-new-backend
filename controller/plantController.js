import Order from "../models/orderSchema.js";
import mongoose from "mongoose";
import Pickup from "../models/pickupSchema.js";
import Plant from "../models/plantSchema.js";
import User from "../models/userModel.js";
import cron from "node-cron";
import fcmService from "../services/fcmService.js";
import RiderLocation from "../models/riderLocationSchema.js";
import { createNotification } from "../controller/notificationController.js";
import { createCustomerNotification } from "./customerNotificationController.js";
import customerFcmService from "../services/customerFcmService.js";

// Create a new plant
export const addPlant = async (req, res) => {
  try {
    const { name, location, latitude, longitude, lat, lng } = req.body;

    // Check if the plant already exists
    const existingPlant = await Plant.findOne({ name });
    if (existingPlant) {
      return res.status(400).json({ error: "Plant already exists." });
    }

    const plantData = { name, location };
    const plantLat = latitude ?? lat;
    const plantLng = longitude ?? lng;

    if (plantLat != null && plantLng != null) {
      plantData.geoLocation = {
        type: "Point",
        coordinates: [Number(plantLng), Number(plantLat)],
      };
    }

    // Create a new plant with the name and location
    const plant = new Plant(plantData);
    await plant.save();

    res.status(201).json({ message: "Plant added successfully", plant });
  } catch (error) {
    res.status(500).json({ error: "Server error, please try again." });
  }
};

export const getRiderPlantDestination = async (req, res) => {
  try {
    const { riderId } = req.params;
    const rider = await User.findById(riderId).select("plant name").lean();

    if (!rider) {
      return res.status(404).json({ error: "Rider not found." });
    }

    let plant = null;
    if (mongoose.Types.ObjectId.isValid(rider.plant)) {
      plant = await Plant.findById(rider.plant).lean();
    }
    if (!plant) {
      plant = await Plant.findOne({ name: rider.plant }).lean();
    }

    if (!plant) {
      return res.status(404).json({ error: "Plant not found for rider." });
    }

    const coordinates = plant.geoLocation?.coordinates;
    if (!coordinates || coordinates.length < 2) {
      return res.status(422).json({
        error: "Plant coordinates are not configured.",
        plant: {
          id: plant._id,
          name: plant.name,
          location: plant.location,
        },
      });
    }

    res.status(200).json({
      success: true,
      plant: {
        id: plant._id,
        name: plant.name,
        location: plant.location,
        latitude: coordinates[1],
        longitude: coordinates[0],
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rider plant location." });
  }
};

// Fetch all plants
export const getAllPlants = async (req, res) => {
  try {
    const plants = await Plant.find(); // Retrieve all plant documents from the database
    res.status(200).json(plants);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch plants, please try again." });
  }
};

// Delete a plant by ID
export const deletePlant = async (req, res) => {
  try {
    const plantId = req.params.id;

    // Find the plant by ID and remove it
    const deletedPlant = await Plant.findByIdAndDelete(plantId);

    if (!deletedPlant) {
      return res.status(404).json({ error: "Plant not found." });
    }

    res.status(200).json({ message: "Plant deleted successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete plant. Please try again." });
  }
};

export const assignPlant = async (req, res) => {
  const { pickupId } = req.params;
  const { plantName } = req.body; // Change from plantId to plantName

  try {
    // Update the Pickup document with the selected plant name
    const updatedPickup = await Pickup.findByIdAndUpdate(
      pickupId,
      { plantName: plantName, PickupStatus: "assigned" }, // Update with plantName instead of ID
      { new: true },
    );

    if (!updatedPickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    res
      .status(200)
      .json({ message: "Plant assigned successfully", updatedPickup });
  } catch (error) {
    console.error("Error updating plant:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getRiders = async (req, res) => {
  try {
    const riders = await User.find({ role: "rider" }).lean();
    const riderIds = riders.map((r) => r._id);
    const riderNames = riders.map((r) => r.name);

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const latestLocations = await RiderLocation.aggregate([
      { $match: { riderId: { $in: riderIds } } },
      { $sort: { lastUpdate: -1 } },
      {
        $group: {
          _id: "$riderId",
          latestLocation: { $first: "$$ROOT" },
        },
      },
    ]);

    const locationMap = {};
    latestLocations.forEach((loc) => {
      locationMap[loc._id.toString()] = loc.latestLocation;
    });

    const pickupMatch = {
      riderName: { $in: riderNames },
      isDeleted: false,
      riderDate: today,
    };

    const orderMatch = {
      riderName: { $in: riderNames },
      riderDate: today,
    };

    const pickupSummary = await Pickup.aggregate([
      { $match: pickupMatch },
      {
        $group: {
          _id: "$riderName",
          totalPickups: { $sum: 1 },
          totalCompletedPickups: {
            $sum: {
              $cond: [{ $eq: ["$PickupStatus", "complete"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const pickupMap = {};
    pickupSummary.forEach((p) => {
      pickupMap[p._id] = p;
    });

    const deliverySummary = await Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: "$riderName",
          totalDeliveries: { $sum: 1 },
          totalCompletedDeliveries: {
            $sum: {
              $cond: [{ $eq: ["$status", "delivered"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const deliveryMap = {};
    deliverySummary.forEach((d) => {
      deliveryMap[d._id] = d;
    });

    const ridersWithLocation = riders.map((rider) => {
      const location = locationMap[rider._id.toString()];
      const pickupData = pickupMap[rider.name] || {};
      const deliveryData = deliveryMap[rider.name] || {};

      return {
        ...rider,

        currentLocation: location?.location
          ? {
              lat: location.location.coordinates[1],
              lng: location.location.coordinates[0],
            }
          : null,

        lastUpdate: location?.lastUpdate || null,

        summary: {
          totalPickups: pickupData.totalPickups || 0,
          totalDeliveries: deliveryData.totalDeliveries || 0,
          totalCompletedPickups: pickupData.totalCompletedPickups || 0,
          totalCompletedDeliveries: deliveryData.totalCompletedDeliveries || 0,
        },
      };
    });

    res.status(200).json(ridersWithLocation);
  } catch (error) {
    console.error("Error in getRiders:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Assign rider to an order
export const assignRider = async (req, res) => {
  try {
    const { orderId, riderName, riderId } = req.body;
    if (!orderId || !riderId) {
      return res.status(400).json({ message: "orderId and riderId required" });
    }

    const riderDate = new Date().toISOString().split("T")[0];

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        riderName,
        riderDate,
        "assignedRider.delivery": {
          riderId,
          riderName,
          assignedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    console.log(
      `🔄 Assigning rider ${riderName} (${riderId}) to order ${orderId}`,
    );

    // req.socket.emit("assignOrder", { order });
    // req.socket.to(`rider:${riderId}`).emit("assignOrder", { order });
    req.socket.emitToAdmin("assignOrder", { order });
    req.socket.emitToRider(riderId, "assignOrder", { order });
    console.log(`📡 Socket notification sent to rider:${riderId}`);

    console.log(`📱 Attempting FCM notification for rider ${riderId}`);
    const fcmResult = await fcmService.sendToRider(
      riderId,
      {
        title: "🎯 New Delivery Assigned",
        body: `Tap to view Order`,
      },
      {
        orderId: String(order._id),
        orderNumber: order.order_id || String(order._id),
        type: "delivery_assigned",
        customerName: order.customerName || "Customer",
        address: order.address || "Location not specified",
        amount: order.totalAmount ? `₹${order.totalAmount}` : "N/A",
        action: "VIEW_ORDER",
        screen: "OrderDetails",
        timestamp: new Date().toISOString(),
      },
    );

    await createNotification({
      riderId,
      title: "🎯 New Delivery Assigned",
      message: "Tap to view order",
      type: "delivery_assigned",
      data: {
        orderId: String(order._id),
        screen: "OrderDetails",
      },
    });

    console.log(`📊 FCM Result:`, {
      success: fcmResult.success,
      sentTo: fcmResult.successCount,
      failed: fcmResult.failureCount,
      totalTokens: fcmResult.totalTokens,
    });

    const notificationStatus = fcmResult.success
      ? "Push notification sent to rider's device"
      : "Socket notification sent, but push notification failed";

    return res.status(200).json({
      status: "success",
      message: `Rider ${riderName} assigned successfully`,
      data: {
        order,
        notification: {
          status: notificationStatus,
          fcm: fcmResult,
          socket: true,
        },
      },
    });
  } catch (error) {
    console.error("assignRider error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
      code: error.code,
    });
  }
};

export const assignPickupRider = async (req, res) => {
  try {
    const { orderId, riderName, riderId } = req.body;

    const riderDate = new Date().toISOString().split("T")[0];

    const pickup = await Pickup.findByIdAndUpdate(
      orderId,
      {
        riderName,
        riderDate,
        PickupStatus: "assigned",
        "assignedRider.pickup": {
          riderId,
          riderName,
          assignedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    // req.socket.emit("assignedPickup", { pickup, riderName });
    req.socket.emitToAdmin("assignedPickup", { pickup, riderName });

    // if (riderId) {
    //   req.socket.to(`rider:${riderId}`).emit("riderAssignedPickup", { pickup });

    if (riderId) {
      req.socket.emitToRider(riderId, "riderAssignedPickup", { pickup });

      await fcmService.sendToRider(
        riderId,
        {
          title: "📦 New Pickup Assigned",
          body: "Pickup - Ready for collection",
        },
        {
          pickupId: String(pickup._id),
          type: "pickup_assigned",
          customerName: pickup.customerName || "Customer",
          action: "view_pickup",
          screen: "pickup_details",
        },
      );
    }

    await createNotification({
      riderId,
      title: "📦 New Pickup Assigned",
      message: "Pickup ready for collection",
      type: "pickup_assigned",
      data: {
        pickupId: String(pickup._id),
        screen: "pickup_details",
      },
    });

    if (pickup.appCustomerId) {
      const done = await createCustomerNotification({
        customerId: pickup.appCustomerId,
        title: "Rider Assigned",
        message: "Keep your items bagged & ready.",
        type: "pickup_Assigned",
        data: {
          pickupId: String(pickup._id),
          screen: "PickupDetails",
        },
      });

      await customerFcmService.sendToCustomer(
        String(pickup.appCustomerId),
        {
          title: "Rider Assigned",
          body: "Keep items bagged & ready. Your laundry's escape plan is in motion!",
        },
        {
          type: "pickup_Assigned",
          pickupId: String(pickup._id),
          screen: "PickupDetails",
        },
      );
    }

    res.status(200).json({
      status: "success",
      data: {
        pickup,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// logic for assigning the pickup or delivery to the rider for the VRP engine
export const assignRiderUnified = async (req, res) => {
  try {
    const { orderId, riderName, riderId } = req.body;

    // Basic validation
    if (!orderId || !riderId) {
      return res.status(400).json({ message: "orderId and riderId are required" });
    }

    // Determine type based on orderId prefix
    const isDelivery = orderId.startsWith("WZ");
    const type = isDelivery ? "delivery" : "pickup";

    const riderDate = new Date().toISOString().split("T")[0];
    let result;

    if (type === "delivery") {
      // --- Delivery assignment ---
      const order = await Order.findOneAndUpdate(
        { order_id: orderId },
        {
          riderName,
          status : "delivery rider assigned",
          riderDate,
          "assignedRider.delivery": {
            riderId,
            riderName,
            assignedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      console.log(`🔄 Assigning rider ${riderName} (${riderId}) to order ${orderId}`);

      // Socket notifications
      req.socket.emitToAdmin("assignOrder", { order });
      req.socket.emitToRider(riderId, "assignOrder", { order });

      // FCM to rider
      const fcmResult = await fcmService.sendToRider(
        riderId,
        {
          title: "🎯 New Delivery Assigned",
          body: `Tap to view Order`,
        },
        {
          orderId: String(order._id),
          orderNumber: order.order_id || String(order._id),
          type: "delivery_assigned",
          customerName: order.customerName || "Customer",
          address: order.address || "Location not specified",
          amount: order.totalAmount ? `₹${order.totalAmount}` : "N/A",
          action: "VIEW_ORDER",
          screen: "OrderDetails",
          timestamp: new Date().toISOString(),
        }
      );

      // In-app notification for rider
      await createNotification({
        riderId,
        title: "🎯 New Delivery Assigned",
        message: "Tap to view order",
        type: "delivery_assigned",
        data: {
          orderId: String(order._id),
          screen: "OrderDetails",
        },
      });

      const notificationStatus = fcmResult.success
        ? "Push notification sent to rider's device"
        : "Socket notification sent, but push notification failed";

      result = {
        status: "success",
        message: `Rider ${riderName} assigned successfully for delivery`,
        data: {
          order,
          notification: {
            status: notificationStatus,
            fcm: fcmResult,
            socket: true,
          },
        },
      };
    } else {
      // --- Pickup assignment ---
      const pickup = await Pickup.findByIdAndUpdate(
        orderId,
        {
          riderName,
          riderDate,
          PickupStatus: "assigned",
          "assignedRider.pickup": {
            riderId,
            riderName,
            assignedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!pickup) {
        return res.status(404).json({ message: "Pickup not found" });
      }

      // Socket notifications
      req.socket.emitToAdmin("assignedPickup", { pickup, riderName });
      req.socket.emitToRider(riderId, "riderAssignedPickup", { pickup });

      // FCM to rider (pickup specific)
      await fcmService.sendToRider(
        riderId,
        {
          title: "📦 New Pickup Assigned",
          body: "Pickup - Ready for collection",
        },
        {
          pickupId: String(pickup._id),
          type: "pickup_assigned",
          customerName: pickup.customerName || "Customer",
          action: "view_pickup",
          screen: "pickup_details",
        }
      );

      // In-app notification for rider
      await createNotification({
        riderId,
        title: "📦 New Pickup Assigned",
        message: "Pickup ready for collection",
        type: "pickup_assigned",
        data: {
          pickupId: String(pickup._id),
          screen: "pickup_details",
        },
      });

      // Notify customer (if applicable)
      if (pickup.appCustomerId) {
        await createCustomerNotification({
          customerId: pickup.appCustomerId,
          title: "Rider Assigned",
          message: "Keep your items bagged & ready.",
          type: "pickup_Assigned",
          data: {
            pickupId: String(pickup._id),
            screen: "PickupDetails",
          },
        });

        await customerFcmService.sendToCustomer(
          String(pickup.appCustomerId),
          {
            title: "Rider Assigned",
            body: "Keep items bagged & ready. Your laundry's escape plan is in motion!",
          },
          {
            type: "pickup_Assigned",
            pickupId: String(pickup._id),
            screen: "PickupDetails",
          }
        );
      }

      result = {
        status: "success",
        data: {
          pickup,
        },
      };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("assignRiderUnified error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
      code: error.code,
    });
  }
};

cron.schedule("30 0 * * *", async () => {
  // Runs every day at 12:30 AM
  try {
    // Update pickups:
    // 1. If status is "assigned" → change to "pending"
    // 2. Clear riderName & riderDate (except completed & deleted)
    await Pickup.updateMany(
      {
        PickupStatus: { $nin: ["complete", "deleted"] },
      },
      {
        $set: {
          PickupStatus: "pending",
        },
        $unset: {
          riderName: "",
          riderDate: "",
        },
      },
    );

    console.log("Pickup statuses updated and rider data cleared");

    // Clear rider info from Orders
    await Order.updateMany(
      {
        status: { $nin: ["delivered"] },
      },
      {
        $unset: {
          riderName: "",
          riderDate: "",
        },
      },
    );

    console.log("Cleared riderName and riderDate from all orders");
  } catch (error) {
    console.error("Error clearing rider data:", error);
  }
});

// Function to delete pickups with specific contact numbers
const deleteSpecificPickups = async () => {
  try {
    const result = await Pickup.deleteMany({
      Contact: { $in: ["9919940927", "8299302013"] },
    });
    console.log(`${result.deletedCount} pickups deleted.`);
  } catch (error) {
    console.error("Error deleting pickups:", error);
  }
};
// Function to delete orders with specific contact numbers
const deleteSpecificOrders = async () => {
  try {
    const result = await Order.deleteMany({
      contactNo: { $in: ["9919940927", "8299302013"] },
    });
    console.log(`${result.deletedCount} orders deleted.`);
  } catch (error) {
    console.error("Error deleting orders:", error);
  }
};

// Schedule the cron job to run at 17:03 daily
// cron.schedule("27 17 * * *", () => {
//   console.log("Running the delete pickups cron job at 17:03");
//   deleteSpecificPickups();
//   deleteSpecificOrders();
// });

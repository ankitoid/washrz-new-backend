import Order from "../models/orderSchema.js";
import Pickup from "../models/pickupSchema.js";
import Plant from "../models/plantSchema.js";
import User from "../models/userModel.js";
import cron from "node-cron";

// Create a new plant
export const addPlant = async (req, res) => {
  try {
    const { name, location } = req.body;

    // Check if the plant already exists
    const existingPlant = await Plant.findOne({ name });
    if (existingPlant) {
      return res.status(400).json({ error: "Plant already exists." });
    }

    // Create a new plant with the name and location
    const plant = new Plant({ name, location });
    await plant.save();

    res.status(201).json({ message: "Plant added successfully", plant });
  } catch (error) {
    res.status(500).json({ error: "Server error, please try again." });
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
      { new: true }
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
    // Fetch all users with role 'rider'
    const riders = await User.find({ role: "rider" });
    res.status(200).json(riders);
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Assign rider to an order
export const assignRider = async (req, res) => {
  try {
    const { orderId, riderName } = req.body;

    // Get current date in YYYY-MM-DD format
    const riderDate = new Date().toISOString().split("T")[0];

    // Find the order by ID and update the rider name
    const order = await Order.findByIdAndUpdate(
      orderId,
      { riderName, riderDate },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    req.socket.emit("assignOrder", { order });

    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Assign rider to an order
export const assignPickupRider = async (req, res) => {
  try {
    const { orderId, riderName } = req.body;

    // Get current date in YYYY-MM-DD format
    const riderDate = new Date().toISOString().split("T")[0];

    // const PickupStatus =  "assigned";

    // Find the order by ID and update the rider name and riderDate
    const pickup = await Pickup.findByIdAndUpdate(
      orderId, // Use orderId instead of pickupId as per frontend
      {
        riderName,
        riderDate,
        PickupStatus : "assigned"
      },
      { new: true }
    );

    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    req.socket.emit("assignedPickup", { pickup, riderName });

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

cron.schedule("30 0 * * *", async () => {
  // Runs every day at 12:30 AM
  try {
    // Update pickups:
    // 1. If status is "assigned" → change to "pending"
    // 2. Clear riderName & riderDate (except completed & deleted)
    await Pickup.updateMany(
      {
        PickupStatus: { $nin: ["complete", "deleted"] }
      },
      {
        $set: {
          PickupStatus: "pending"
        },
        $unset: {
          riderName: "",
          riderDate: ""
        }
      }
    );

    console.log("Pickup statuses updated and rider data cleared");

    // Clear rider info from Orders
    await Order.updateMany(
      {},
      {
        $unset: {
          riderName: "",
          riderDate: ""
        }
      }
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

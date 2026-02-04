import express from "express";
import RiderLocation from "../models/riderLocationSchema.js";
import User from "../models/userModel.js";

const router = express.Router();

router.get("/active-riders", async (req, res) => {
  try {
    const seventySecondsAgo = new Date(Date.now() - 70000);

    const activeRiders = await RiderLocation.aggregate([
      { $match: { lastUpdate: { $gte: seventySecondsAgo }, status: { $in: ["active", "on-delivery", "on-pickup"] } } },
            { $sort: { lastUpdate: -1 } },
      { $group: { _id: "$riderId", latestLocation: { $first: "$$ROOT" } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "riderDetails" } },
      { $unwind: "$riderDetails" },
      {
        $project: {
          riderId: "$_id",
          name: "$riderDetails.name",
          phone: "$riderDetails.phone",
          lat: { $arrayElemAt: ["$latestLocation.location.coordinates", 1] },
          lng: { $arrayElemAt: ["$latestLocation.location.coordinates", 0] },
          speed: "$latestLocation.speed",
          bearing: "$latestLocation.bearing",
          status: "$latestLocation.status",
          lastUpdate: "$latestLocation.lastUpdate",
        }
      }
    ]);

    res.status(200).json({ success: true, count: activeRiders.length, riders: activeRiders });
  } catch (error) {
    console.error("Error fetching active riders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Rider history
router.get("/rider/:riderId/history", async (req, res) => {
  try {
    const { riderId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    let query = { riderId };

    if (startDate || endDate) {
      query.lastUpdate = {};
      if (startDate) query.lastUpdate.$gte = new Date(startDate);
      if (endDate) query.lastUpdate.$lte = new Date(endDate);
    }

    const history = await RiderLocation.find(query)
      .sort({ lastUpdate: -1 })
      .limit(parseInt(limit))
      .select("location speed bearing status lastUpdate");

    const formattedHistory = history.map(loc => ({
      lat: loc.location.coordinates[1],
      lng: loc.location.coordinates[0],
      speed: loc.speed,
      bearing: loc.bearing,
      status: loc.status,
      timestamp: loc.lastUpdate,
    }));

    res.status(200).json({ success: true, count: formattedHistory.length, history: formattedHistory });
  } catch (error) {
    console.error("Error fetching rider history:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Rider current
router.get("/rider/:riderId/current", async (req, res) => {
  try {
    const { riderId } = req.params;

    const latestLocation = await RiderLocation.findOne({ riderId })
      .sort({ lastUpdate: -1 })
      .limit(1)
      .populate("riderId", "name phone");

    if (!latestLocation) return res.status(404).json({ success: false, message: "Rider location not found" });

    res.status(200).json({
      success: true,
      rider: {
        riderId,
        name: latestLocation.riderId?.name,
        phone: latestLocation.riderId?.phone,
        lat: latestLocation.location.coordinates[1],
        lng: latestLocation.location.coordinates[0],
        speed: latestLocation.speed,
        bearing: latestLocation.bearing,
        status: latestLocation.status,
        lastUpdate: latestLocation.lastUpdate,
      }
    });
  } catch (error) {
    console.error("Error fetching current location:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Manual status update (admin)
router.post("/rider/:riderId/status", async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status } = req.body;

    if (!status || !["active", "idle", "offline", "on-delivery", "on-pickup"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const rider = await User.findById(riderId);
    if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });

    await RiderLocation.create({
      riderId,
      name: rider.name,
      phone: rider.phone,
      location: { type: "Point", coordinates: [0, 0] },
      status,
      lastUpdate: new Date(),
    });

    res.status(200).json({ success: true, message: `Rider status updated to ${status}` });
  } catch (error) {
    console.error("Error updating rider status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Dashboard stats
router.get("/dashboard-stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await RiderLocation.aggregate([
      { $match: { lastUpdate: { $gte: today } } },
      { $group: { _id: { riderId: "$riderId", status: "$status" }, lastUpdate: { $max: "$lastUpdate" } } },
      { $group: { _id: "$_id.status", count: { $sum: 1 } } }
    ]);

    const totalRidersToday = await RiderLocation.distinct("riderId", { lastUpdate: { $gte: today } });

    res.status(200).json({
      success: true,
      stats: {
        totalRiders: totalRidersToday.length,
        byStatus: stats.reduce((acc, stat) => { acc[stat._id] = stat.count; return acc; }, {}),
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/update", async (req, res) => {
  try {
    const { riderId, lat, lng, speed = 0, bearing = 0, batteryLevel = 100, status = "active" } = req.body;

    if (!riderId || !lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: riderId, lat, lng"
      });
    }

    const user = await User.findById(riderId).select("name phone");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Rider not found"
      });
    }

    const location = {
      type: "Point",
      coordinates: [parseFloat(lng), parseFloat(lat)]
    };

    // Update the rider's current location (upsert)
    const updatedLocation = await RiderLocation.findOneAndUpdate(
      { riderId },
      {
        riderId,
        name: user.name,
        phone: user.phone,
        location,
        speed: parseFloat(speed),
        bearing: parseFloat(bearing),
        batteryLevel: parseInt(batteryLevel),
        status,
        lastUpdate: new Date()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    // Also keep history in a separate collection if needed
    await LocationHistory.create({
      riderId,
      location,
      speed: parseFloat(speed),
      bearing: parseFloat(bearing),
      batteryLevel: parseInt(batteryLevel),
      status,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      location: updatedLocation
    });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// API to get all riders with their latest locations
router.get("/riders/live", async (req, res) => {
  try {
    const allRiders = await User.find({ role: "rider" })
      .select("_id name phone email role avatar")
      .lean();

    const riderIds = allRiders.map(rider => rider._id);
    
    const latestLocations = await RiderLocation.aggregate([
      {
        $match: {
          riderId: { $in: riderIds }
        }
      },
      {
        $sort: { lastUpdate: -1 }
      },
      {
        $group: {
          _id: "$riderId",
          latestLocation: { $first: "$$ROOT" }
        }
      }
    ]);

    const activeRiderLocations = req.app.locals.activeRiderLocations || new Map();
    
    const ridersWithLocation = allRiders.map(rider => {
      const locationData = latestLocations.find(loc => 
        loc._id.toString() === rider._id.toString()
      );
      
      const location = locationData?.latestLocation;
      const riderIdStr = rider._id.toString();
      let status = "offline";
      let lastUpdateTime = location?.lastUpdate;
    
      if (activeRiderLocations.has(riderIdStr)) {
        const activeData = activeRiderLocations.get(riderIdStr);
        status = activeData.status || "offline";
        lastUpdateTime = activeData.lastUpdate || location?.lastUpdate;
      } else if (location) {
        // Not in real-time map, check database with threshold
        const seventySecondsAgo = new Date(Date.now() - 70000);
        if (new Date(location.lastUpdate) >= seventySecondsAgo) {
          status = location.status || "active";
        } else {
          status = "offline";
        }
      }
      
      if (lastUpdateTime) {
        const seventySecondsAgo = new Date(Date.now() - 70000);
        if (new Date(lastUpdateTime) < seventySecondsAgo) {
          status = "offline";
        }
      }
      
      return {
        id: rider._id,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        avatar: rider.avatar,
        status: status,
        currentLocation: location?.location ? {
          lat: location.location.coordinates[1],
          lng: location.location.coordinates[0]
        } : null,
        speed: location?.speed || 0,
        bearing: location?.bearing || 0,
        batteryLevel: location?.batteryLevel || 100,
        lastUpdate: lastUpdateTime,
        assignedOrders: 0,
        completedToday: 0,
        vehicle: "Bike",
        rating: 4.5
      };
    });

    res.status(200).json({
      success: true,
      count: ridersWithLocation.length,
      riders: ridersWithLocation
    });
  } catch (error) {
    console.error("Error fetching live riders:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// Get single rider details with location
router.get("/riders/:riderId", async (req, res) => {
  try {
    const { riderId } = req.params;

    // Get rider info
    const rider = await User.findById(riderId)
      .select("_id name phone email role avatar")
      .lean();

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found"
      });
    }

    // Get latest location
    const latestLocation = await RiderLocation.findOne({ riderId })
      .sort({ lastUpdate: -1 })
      .lean();

    const riderData = {
      id: rider._id,
      name: rider.name,
      phone: rider.phone,
      email: rider.email,
      avatar: rider.avatar,
      status: latestLocation?.status || "offline",
      currentLocation: latestLocation?.location ? {
        lat: latestLocation.location.coordinates[1],
        lng: latestLocation.location.coordinates[0]
      } : null,
      speed: latestLocation?.speed || 0,
      bearing: latestLocation?.bearing || 0,
      batteryLevel: latestLocation?.batteryLevel || 100,
      lastUpdate: latestLocation?.lastUpdate,
      assignedOrders: 0,
      completedToday: 0,
      vehicle: "Bike",
      rating: 4.5
    };

    res.status(200).json({
      success: true,
      rider: riderData
    });
  } catch (error) {
    console.error("Error fetching rider:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

export default router;
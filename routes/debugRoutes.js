// routes/debugRoutes.js
import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// Debug endpoint - list all tokens
router.get("/push-tokens/all", async (req, res) => {
  try {
    // Import models dynamically to avoid circular dependencies
    const { default: RiderPushToken } = await import("../models/riderPushTokenModel.js");
    const { default: User } = await import("../models/userModel.js");
    
    const tokens = await RiderPushToken.find({})
      .populate('riderId', 'name phone')
      .sort({ lastSeenAt: -1 })
      .lean();
    
    res.json({
      total: tokens.length,
      active: tokens.filter(t => t.isActive).length,
      tokens: tokens.map(t => ({
        id: t._id,
        riderId: t.riderId,
        riderName: t.riderId?.name || 'Unknown',
        riderPhone: t.riderId?.phone || 'N/A',
        tokenPreview: t.token?.substring(0, 30) + '...',
        platform: t.platform,
        isActive: t.isActive,
        lastSeen: t.lastSeenAt,
        deviceId: t.deviceId,
        createdAt: t.createdAt
      }))
    });
  } catch (error) {
    console.error("Debug route error:", error);
    res.status(500).json({ error: error.message });
  }
});

// List all riders with their tokens
router.get("/riders-with-tokens", async (req, res) => {
  try {
    const { default: RiderPushToken } = await import("../models/riderPushTokenModel.js");
    const { default: User } = await import("../models/userModel.js");
    
    const riders = await User.find({ role: "rider" })
      .select("_id name phone email createdAt")
      .lean();
    
    const ridersWithTokens = [];
    
    for (const rider of riders) {
      const tokens = await RiderPushToken.find({ 
        riderId: rider._id,
        isActive: true 
      }).lean();
      
      ridersWithTokens.push({
        ...rider,
        activeTokens: tokens.length,
        tokens: tokens.map(t => ({
          tokenPreview: t.token?.substring(0, 20) + '...',
          platform: t.platform,
          lastSeen: t.lastSeenAt
        }))
      });
    }
    
    res.json({
      totalRiders: riders.length,
      riders: ridersWithTokens
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
// controller/pushTokenController.js
import RiderPushToken from "../models/riderPushTokenModel.js";

export const registerPushToken = async (req, res) => {
  try {
    const authRiderId = req.user?.id || req.user?._id;
    console.log("Registering push token for rider:", authRiderId);
    console.log("Request body:", req.body);
    
    if (!authRiderId) return res.status(401).json({ message: "Unauthorized" });

    const { token, platform = "android", deviceId, appVersion } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    // Check if token already exists for another rider
    const existingToken = await RiderPushToken.findOne({ token });
    if (existingToken && existingToken.riderId.toString() !== authRiderId.toString()) {
      console.log(`Token reassigned from rider ${existingToken.riderId} to ${authRiderId}`);
    }

    // Upsert token
    const doc = await RiderPushToken.findOneAndUpdate(
      { token },
      {
        $set: {
          riderId: authRiderId,
          platform,
          deviceId,
          appVersion,
          lastSeenAt: new Date(),
          isActive: true,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    );

    console.log(`Token registered for rider ${authRiderId}: ${token.substring(0, 20)}...`);

    return res.status(200).json({ 
      message: "Token registered successfully", 
      data: { 
        id: doc._id,
        tokenPreview: token.substring(0, 20) + '...',
        platform
      } 
    });
  } catch (err) {
    console.error("registerPushToken error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

export const removePushToken = async (req, res) => {
  try {
    const authRiderId = req.user?.id || req.user?._id;
    if (!authRiderId) return res.status(401).json({ message: "Unauthorized" });

    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    // Soft-delete (mark inactive) to keep history; you can remove instead
    const doc = await RiderPushToken.findOneAndUpdate(
      { token, riderId: authRiderId },
      { $set: { isActive: false, lastSeenAt: new Date() } },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Token not found for this rider" });

    return res.status(200).json({ message: "Token removed" });
  } catch (err) {
    console.error("removePushToken error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// optional: debug endpoint for listing tokens for current rider
export const listMyTokens = async (req, res) => {
  try {
    const authRiderId = req.user?.id || req.user?._id;
    if (!authRiderId) return res.status(401).json({ message: "Unauthorized" });

    const tokens = await RiderPushToken.find({ riderId: authRiderId }).sort({ lastSeenAt: -1 }).lean();
    return res.status(200).json({ tokens });
  } catch (err) {
    console.error("listMyTokens error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
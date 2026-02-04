// controller/pushTokenController.js
import RiderPushToken from "../models/riderPushTokenModel.js";

const logReqContext = (req, label = "") => {
  console.log(`\n===== ${label} REQUEST CONTEXT =====`);
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Headers.authorization:", req.headers?.authorization);
  console.log("req.user:", req.user);
  console.log("req.user?.id:", req.user?.id);
  console.log("req.user?._id:", req.user?._id);
  console.log("Body:", req.body);
  console.log("==================================\n");
};

export const registerPushToken = async (req, res) => {
  try {
    logReqContext(req, "REGISTER PUSH TOKEN");
    const authRiderId = req.user?.id || req.user?._id;
    console.log("Resolved authRiderId:", authRiderId);
    if (!authRiderId) {
      console.warn("❌ Unauthorized: req.user missing");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { token, platform = "android", deviceId, appVersion } = req.body;

    if (!token) {
      console.warn("❌ Missing push token in request body");
      return res.status(400).json({ message: "token is required" });
    }
    console.log("Incoming push token (preview):", token.substring(0, 25) + "...");

    // Check if token already exists
    const existingToken = await RiderPushToken.findOne({ token });
    if (existingToken) {
      console.log("Existing token found:", {
        existingRiderId: existingToken.riderId?.toString(),
        currentRiderId: authRiderId.toString(),
        isSameRider:
          existingToken.riderId?.toString() === authRiderId.toString(),
      });
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

    console.log("✅ Push token saved:", {
      dbId: doc._id.toString(),
      riderId: authRiderId.toString(),
      platform,
      isActive: doc.isActive,
    });

    return res.status(200).json({
      message: "Token registered successfully",
      data: {
        id: doc._id,
        tokenPreview: token.substring(0, 20) + "...",
        platform,
      },
    });
  } catch (err) {
    console.error("🔥 registerPushToken error:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

export const removePushToken = async (req, res) => {
  try {
    logReqContext(req, "REMOVE PUSH TOKEN");
    const authRiderId = req.user?.id || req.user?._id;
    console.log("Resolved authRiderId:", authRiderId);
    if (!authRiderId) {
      console.warn("❌ Unauthorized: req.user missing");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { token } = req.body;
    if (!token) {
      console.warn("❌ Missing token in remove request");
      return res.status(400).json({ message: "token is required" });
    }

    const doc = await RiderPushToken.findOneAndUpdate(
      { token, riderId: authRiderId },
      { $set: { isActive: false, lastSeenAt: new Date() } },
      { new: true }
    );

    if (!doc) {
      console.warn("⚠️ Token not found for rider");
      return res.status(404).json({ message: "Token not found for this rider" });
    }
    console.log("✅ Token deactivated:", token.substring(0, 20) + "...");

    return res.status(200).json({ message: "Token removed" });
  } catch (err) {
    console.error("🔥 removePushToken error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const listMyTokens = async (req, res) => {
  try {
    logReqContext(req, "LIST MY TOKENS");
    const authRiderId = req.user?.id || req.user?._id;

    if (!authRiderId) {
      console.warn("❌ Unauthorized: req.user missing");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tokens = await RiderPushToken.find({
      riderId: authRiderId,
    })
      .sort({ lastSeenAt: -1 })
      .lean();
    console.log(`Found ${tokens.length} tokens for rider ${authRiderId}`);
    return res.status(200).json({ tokens });
  } catch (err) {
    console.error("🔥 listMyTokens error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
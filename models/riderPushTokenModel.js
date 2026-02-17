// models/riderPushTokenModel.js
import mongoose from "mongoose";

const riderPushTokenSchema = new mongoose.Schema({
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, default: "android" },
  deviceId: { type: String, default: null },
  appVersion: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

riderPushTokenSchema.index({ riderId: 1 });
riderPushTokenSchema.index({ token: 1 }, { unique: true });

const RiderPushToken = mongoose.models.RiderPushToken || mongoose.model("RiderPushToken", riderPushTokenSchema);
export default RiderPushToken;
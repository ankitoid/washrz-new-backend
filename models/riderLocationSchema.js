import mongoose from "mongoose";

const riderLocationSchema = new mongoose.Schema({
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    speed: { type: Number, default: 0 },
    bearing: { type: Number, default: 0 },
    batteryLevel: { type: Number, default: 100 },
    status: {
      type: String,
      enum: ["active", "idle", "offline", "on-delivery", "on-pickup"],
      default: "active",
    },
    lastUpdate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deviceInfo: {
      platform: String,
      model: String,
      appVersion: String,
    },
    shiftStart: { type: Date },
    shiftEnd: { type: Date },
  },{ timestamps: true });

// Geospatial index
riderLocationSchema.index({ location: "2dsphere" });

// TTL index: expire after 7 days
riderLocationSchema.index({ lastUpdate: 1 },{ expireAfterSeconds: 604800 });

const RiderLocation = mongoose.model("RiderLocation", riderLocationSchema);

export default RiderLocation;
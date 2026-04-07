import mongoose from "mongoose";

const customerPushTokenSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios", "web"],
      default: "android",
    },
    deviceId: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    deactivationReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

customerPushTokenSchema.index({ customerId: 1, isActive: 1 });
customerPushTokenSchema.index({ token: 1 }, { unique: true });

export default mongoose.model("CustomerPushToken", customerPushTokenSchema);
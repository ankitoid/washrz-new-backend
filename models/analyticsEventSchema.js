import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    identityKey: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios", "web", "unknown"],
      default: "unknown",
      index: true,
    },
    city: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    zone: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

analyticsEventSchema.index({ platform: 1, occurredAt: -1 });
analyticsEventSchema.index({ eventName: 1, platform: 1, occurredAt: -1 });
analyticsEventSchema.index({ city: 1, occurredAt: -1 });
analyticsEventSchema.index({ zone: 1, occurredAt: -1 });
analyticsEventSchema.index({ identityKey: 1, occurredAt: -1 });

export default mongoose.model("AnalyticsEvent", analyticsEventSchema);

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
    userId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    installationId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    sessionId: {
      type: String,
      default: null,
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
    region: {
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
    sector: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    country: {
      type: String,
      default: null,
      trim: true,
    },
    osVersion: {
      type: String,
      default: null,
      trim: true,
    },
    appVersion: {
      type: String,
      default: null,
      trim: true,
    },
    deviceModel: {
      type: String,
      default: null,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
analyticsEventSchema.index({ region: 1, occurredAt: -1 });
analyticsEventSchema.index({ zone: 1, occurredAt: -1 });
analyticsEventSchema.index({ sector: 1, occurredAt: -1 });
analyticsEventSchema.index({ identityKey: 1, occurredAt: -1 });

export default mongoose.model("AnalyticsEvent", analyticsEventSchema);

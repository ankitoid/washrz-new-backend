import mongoose from "mongoose";

const pointSchema = new mongoose.Schema(
  {
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
  { _id: false },
);

const trackingPointSchema = new mongoose.Schema(
  {
    location: pointSchema,
    distanceFromPreviousKm: { type: Number, default: 0 },
    totalDistanceKm: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    bearing: { type: Number, default: 0 },
    batteryLevel: { type: Number, default: 100 },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const taskTrackingLegSchema = new mongoose.Schema(
  {
    trackingLegId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    taskType: {
      type: String,
      enum: ["pickup", "delivery", "return_to_plant"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      index: true,
    },
    destination: pointSchema,
    startLocation: pointSchema,
    lastLocation: pointSchema,
    endLocation: pointSchema,
    totalDistanceKm: { type: Number, default: 0 },
    pointsCount: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date },
    points: [trackingPointSchema],
  },
  { timestamps: true },
);

taskTrackingLegSchema.index({ riderId: 1, status: 1, startedAt: -1 });
taskTrackingLegSchema.index({ riderId: 1, endedAt: -1 });
taskTrackingLegSchema.index({ lastLocation: "2dsphere" });

const TaskTrackingLeg = mongoose.model(
  "TaskTrackingLeg",
  taskTrackingLegSchema,
);

export default TaskTrackingLeg;

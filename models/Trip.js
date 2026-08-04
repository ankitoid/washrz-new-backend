import mongoose from "mongoose";

const stopSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, default: "Unnamed" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    type: { type: String, enum: ["depot", "pickup", "delivery"], required: true },
    price: { type: Number, default: 0 },
    item_types: [{ type: String }],
    delivery_weight: { type: Number, default: 0 },
    index: { type: Number },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
    address: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
    isRescheduled: { type: Boolean, default: false },
    distanceFromPrevMeters: { type: Number, default: 0 },
    distanceFromPrevKm: { type: Number, default: 0 },
    cumulativeDistanceKm: { type: Number, default: 0 },
  },
  { _id: false }
);

const vrpTripSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    rosterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Roster",
      required: true,
      index: true,
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
      index: true,
    },
    routeIndex: {
      type: Number,
      required: true,
    },
    stopCount: {
      type: Number,
      default: 0,
    },
    distanceKm: {
      type: Number,
      default: 0,
    },
    durationHours: {
      type: Number,
      default: 0,
    },
    stops: [stopSchema],
    status: {
      type: String,
      enum: ["planned", "assigned", "in_progress", "completed", "cancelled"],
      default: "planned",
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: "vrp_trips" }
);

const Trip = mongoose.models.VrpTrip || mongoose.model("VrpTrip", vrpTripSchema);

export default Trip;

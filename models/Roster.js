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
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    riderId: { type: Number, required: true },
    stopCount: { type: Number, default: 0 },
    distanceKm: { type: Number, default: 0 },
    durationHours: { type: Number, default: 0 },
    stops: [stopSchema],
  },
  { _id: false }
);

const removalAnalysisSchema = new mongoose.Schema(
  {
    stopIndex: { type: Number },
    stopName: { type: String },
    savingMeters: { type: Number },
    savingKm: { type: Number },
    newTotalDistanceKm: { type: Number },
  },
  { _id: false }
);

const rosterSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    riderCount: { type: Number, required: true },
    feasible: { type: Boolean, default: false },
    totalDistanceKm: { type: Number, default: 0 },
    usedRiders: { type: Number, default: 0 },
    status: { type: String, default: "success" },
    error: { type: String, default: null },
    diagnosis: { type: mongoose.Schema.Types.Mixed, default: null },
    removalAnalysis: {
      type: [removalAnalysisSchema],
      default: [],
    },
    routes: [routeSchema],
  },
  { timestamps: true }
);

const Roster = mongoose.models.Roster || mongoose.model("Roster", rosterSchema);

export default Roster;

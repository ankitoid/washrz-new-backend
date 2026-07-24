import mongoose from "mongoose";

const constraintSchema = new mongoose.Schema(
  {
    minRiders: { type: Number, default: 1 },
    maxRiders: { type: Number, default: 3 },
    minStops: { type: Number, default: 1 },
    maxStops: { type: Number, default: 20 },
    weightPerStopKg: { type: Number, default: 0.5 },
    capacityKg: { type: Number, default: 20.0 },
    penalty: { type: Number, default: 5000 },
    maxTripHours: { type: Number, default: 10.0 },
    avgSpeedKmph: { type: Number, default: 30.0 },
    serviceTimeMinutes: { type: Number, default: 5.0 },
  },
  { _id: false }
);

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Batch name is required"],
      trim: true,
    },
    pickupIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "pickup",
      },
    ],
    orderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    constraints: {
      type: constraintSchema,
      default: () => ({}),
    },
    selectedRosterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Roster",
      default: null,
    },
    status: {
      type: String,
      enum: ["created", "processing", "optimized", "failed"],
      default: "created",
    },
  },
  { timestamps: true }
);

const Batch = mongoose.models.Batch || mongoose.model("Batch", batchSchema);

export default Batch;

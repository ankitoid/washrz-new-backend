import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    rider: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    date: { 
      type: Date, 
      required: true,
      index: true 
    },
    startKm: { 
      type: Number, 
      required: true 
    },
    startImage: { 
      type: String, 
      default: null 
    },
    endKm: { 
      type: Number, 
      default: null 
    },
    endImage: { 
      type: String, 
      default: null 
    },
    distance: { 
      type: Number, 
      default: 0 
    },
    status: {
      type: String,
      enum: ["started", "ended"],
      default: "started",
    },
    vrpTripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip", // Links to VRP Route/Trip (collection: vrp_trips)
      default: null
    },
    actualDistance: { 
      type: Number, 
      default: 0 
    },
    optimizedDistance: { 
      type: Number, 
      default: 0 
    },
    distanceDiff: { 
      type: Number, 
      default: 0 
    },
  },
  { timestamps: true, collection: "shifts" }
);

export default mongoose.model("Shift", shiftSchema);

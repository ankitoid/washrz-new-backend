import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

export default mongoose.model("Trip", tripSchema);
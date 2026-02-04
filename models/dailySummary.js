import mongoose from "mongoose";

const dailySummarySchema = new mongoose.Schema(
  {
    rider: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    date: { 
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true
    },
    totalDistance: { 
      type: Number, 
      default: 0 
    },
    startImages: [{ 
      imageUrl: String,
      timestamp: Date,
      tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" }
    }],
    endImages: [{ 
      imageUrl: String,
      timestamp: Date,
      tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" }
    }],
    trips: [{
      tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
      startTime: Date,
      endTime: Date,
      startKm: Number,
      endKm: Number,
      distance: Number
    }]
  },
  { timestamps: true }
);

// Compound index for unique daily summary per rider
dailySummarySchema.index({ rider: 1, date: 1 }, { unique: true });

export default mongoose.model("DailySummary", dailySummarySchema);
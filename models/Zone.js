
import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema({
  name: { type: String, required: true },        // South Delhi
  city: { type: String, required: true },        // Delhi
  zoneId: { type: String, required: true, unique: true },

  geometry: {
    type: {
      type: String,
      enum: ["Polygon"],
      required: true,
    },
    coordinates: {
      type: [[[Number]]], // [ [ [lng, lat], ... ] ]
      required: true,
    },
  },
}, { timestamps: true });

zoneSchema.index({ geometry: "2dsphere" });

export default mongoose.model("Zone", zoneSchema);
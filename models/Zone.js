
// import mongoose from "mongoose";

// const zoneSchema = new mongoose.Schema({
//   name: { type: String, required: true },        // South Delhi
//   city: { type: String, required: true },        // Delhi
//   zoneId: { type: String, required: true, unique: true },

//   geometry: {
//     type: {
//       type: String,
//       enum: ["Polygon"],
//       required: true,
//     },
//     coordinates: {
//       type: [[[Number]]], // [ [ [lng, lat], ... ] ]
//       required: true,
//     },
//   },
// }, { timestamps: true });

// zoneSchema.index({ geometry: "2dsphere" });

// export default mongoose.model("Zone", zoneSchema);

import mongoose from "mongoose";

// Slot template structure (permanent zone configuration)
const slotTemplateSchema = new mongoose.Schema({
  // Slot definitions
  slots: [{
    time: { type: String, required: true },        // "10AM-12PM"
    defaultEnabled: { type: Boolean, default: true },
    defaultCapacity: { type: Number, default: 7, min: 0 }
  }],
  
  // Zone-level settings
  morningDelivery: { type: Boolean, default: false },
  totalCapacity: { type: Number, default: 100, min: 1 },
  slotMinCapacity: { type: Number, default: 6, min: 1 },
  
  // Generation metadata (for reference)
  startTime: { type: String },
  endTime: { type: String },
  slotDuration: { type: Number },
  generatedAt: { type: Date, default: Date.now }
}, { _id: false });

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
  
  // NEW: Slot template for this zone
  slotTemplate: {
    type: slotTemplateSchema,
    default: null
  }
}, { timestamps: true });

zoneSchema.index({ geometry: "2dsphere" });

export default mongoose.model("Zone_test", zoneSchema);
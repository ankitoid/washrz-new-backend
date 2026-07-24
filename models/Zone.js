
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
// const slotTemplateSchema = new mongoose.Schema({
//   // Slot definitions
//   slots: [{
//     time: { type: String, required: true },        // "10AM-12PM"
//     defaultEnabled: { type: Boolean, default: true },
//     defaultCapacity: { type: Number, default: 7, min: 0 }
//   }],
  
//   // Zone-level settings
//   morningDelivery: { type: Boolean, default: false },
//   totalCapacity: { type: Number, default: 100, min: 1 },
//   slotMinCapacity: { type: Number, default: 6, min: 1 },
  
//   // Generation metadata (for reference)
//   startTime: { type: String },
//   endTime: { type: String },
//   slotDuration: { type: Number },
//   generatedAt: { type: Date, default: Date.now }
// }, { _id: false });

// Slot template structure (permanent zone configuration)

const slotTemplateSchema = new mongoose.Schema({
  slots: [{ time: String, defaultEnabled: Boolean, defaultCapacity: Number }],
  morningDelivery: Boolean,
  totalCapacity: Number,
  slotMinCapacity: Number,
  startTime: String,
  endTime: String,
  slotDuration: Number,
  generatedAt: Date,
  // NEW FIELDS
  cutoffTimes: {
    morningCutoff: { type: String, default: "11:00 AM" },
    eveningCutoff: { type: String, default: "11:00 PM" }
  },
  deliveryDeadlines: {
    sameDay: { type: String, default: "10:00 PM" },
    nextDay: { type: String, default: "10:00 AM" }
  }
}, { _id: false });



const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // South Delhi
    city: { type: String, required: true }, // Delhi
    zoneId: { type: String, required: true, unique: true },
    delayInfo: {
      isDelay: {
        type: Boolean,
        default: false,
      },
      category: {
        type: String,
        enum: [
          "WEATHER",
          "TRAFFIC",
          "VEHICLE",
          "STAFF",
          "HIGH_VOLUME",
          "MACHINE",
          "POWER",
          "HOLIDAY",
          "TECHNICAL",
          "OTHER",
          null,
        ],
        default: null,
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },

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
    },
   
  // area of the zone
  area: {
  type: Number,
  default: 0,
  index: true   // for faster sorting in aggregation
         },
  }, { timestamps: true });

zoneSchema.index({ geometry: "2dsphere" });

export default mongoose.model("Zone_test", zoneSchema);
// models/SlotConfig.js

// import mongoose from "mongoose";

// const slotSchema = new mongoose.Schema({
//   time: String,        // "08AM - 11AM"
//   enabled: Boolean,
// });

// const zoneSlotSchema = new mongoose.Schema({
//   zoneId: String,
//   enabled: Boolean,
//   slots: [slotSchema],
// });

// const slotConfigSchema = new mongoose.Schema({
//   date: { type: String, required: true }, // YYYY-MM-DD
//   serviceEnabled: { type: Boolean, default: true },
//   zones: [zoneSlotSchema],
// }, { timestamps: true });

// export default mongoose.model("SlotConfig", slotConfigSchema);

// models/SlotConfig.js

// commented on 28/04/2026 by ayush

// import mongoose from "mongoose";

// const slotSchema = new mongoose.Schema({
//   time: { 
//     type: String, 
//     required: true,
//     enum: [
//       "08AM - 11AM", "09AM - 12PM", "10AM - 01PM", "11AM - 02PM",
//       "12PM - 03PM", "01PM - 04PM", "02PM - 05PM", "03PM - 06PM",
//       "04PM - 07PM", "05PM - 08PM", "06PM - 09PM"
//     ]
//   },
//   enabled: { 
//     type: Boolean, 
//     default: true 
//   },
// }, { _id: false });

// const zoneSlotSchema = new mongoose.Schema({
//   zoneId: { 
//     type: String, 
//     required: true,
//     uppercase: true,
//     trim: true
//   },
//   enabled: { 
//     type: Boolean, 
//     default: true 
//   },
//   slots: [slotSchema],
// }, { _id: false });

// const slotConfigSchema = new mongoose.Schema({
//   date: { 
//     type: String, 
//     required: true,
//     unique: true,
//     match: /^\d{4}-\d{2}-\d{2}$/
//   },
//   serviceEnabled: { 
//     type: Boolean, 
//     default: true 
//   },
//   zones: [zoneSlotSchema],
// }, { 
//   timestamps: true 
// });

// slotConfigSchema.index({ date: 1 });

// export default mongoose.model("SlotConfig", slotConfigSchema);

// import mongoose from "mongoose";

// // Individual slot within a zone
// const slotDetailSchema = new mongoose.Schema({
//   time: {
//     type: String,
//     required: true,
//   },
//   enabled: {
//     type: Boolean,
//     default: true
//   },
//   capacity: {
//     type: Number,
//     required: true,
//     min: 0,
//     default: 7
//   }
// }, { _id: false });

// // Zone configuration for a specific date
// const zoneConfigSchema = new mongoose.Schema({
//   zoneId: {
//     type: String,
//     required: true,
//     uppercase: true,
//     trim: true
//   },
//   enabled: {
//     type: Boolean,
//     default: true
//   },
//   totalCapacity: {
//     type: Number,
//     required: true,
//     min: 1,
//     default: 100
//   },
//   slotMinCapacity: {
//     type: Number,
//     required: true,
//     min: 1,
//     default: 6
//   },
//   morningDelivery: {
//     type: Boolean,
//     default: false
//   },
//   slots: [slotDetailSchema]
// }, { _id: false });

// // Main slot configuration for a date
// const slotConfigSchema = new mongoose.Schema({
//   date: {
//     type: String,
//     required: true,
//     unique: true,
//     match: /^\d{4}-\d{2}-\d{2}$/
//   },
//   serviceEnabled: {
//     type: Boolean,
//     default: true
//   },
//   defaultPattern: {
//     type: Boolean,
//     default: true
//   },
//   zones: [zoneConfigSchema]
// }, {
//   timestamps: true
// });

// slotConfigSchema.index({ date: 1 });

// export default mongoose.model("SlotConfig", slotConfigSchema);

import mongoose from "mongoose";

// Individual slot override (only stores what's different from template)
const slotOverrideSchema = new mongoose.Schema({
  time: { type: String, required: true },
  enabled: { type: Boolean },        // undefined = use template default
  capacity: { type: Number, min: 0 }  // undefined = use template default
}, { _id: false });

// Zone configuration for a specific date
const zoneConfigSchema = new mongoose.Schema({
  zoneId: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  totalCapacity: { type: Number },     // Optional override
  slotMinCapacity: { type: Number },   // Optional override
  morningDelivery: { type: Boolean },  // Optional override (but shouldn't change per spec)
  
  // Only stores overrides (not all slots)
  overrides: [slotOverrideSchema]
}, { _id: false });

// Main slot configuration for a date
const slotConfigSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  serviceEnabled: {
    type: Boolean,
    default: true
  },
  zones: [zoneConfigSchema]
}, {
  timestamps: true
});

slotConfigSchema.index({ date: 1 });

export default mongoose.model("SlotConfig_test", slotConfigSchema);
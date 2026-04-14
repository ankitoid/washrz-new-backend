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

import mongoose from "mongoose";

const slotSchema = new mongoose.Schema({
  time: { 
    type: String, 
    required: true,
    enum: [
      "08AM - 11AM", "09AM - 12PM", "10AM - 01PM", "11AM - 02PM",
      "12PM - 03PM", "01PM - 04PM", "02PM - 05PM", "03PM - 06PM",
      "04PM - 07PM", "05PM - 08PM", "06PM - 09PM"
    ]
  },
  enabled: { 
    type: Boolean, 
    default: true 
  },
}, { _id: false });

const zoneSlotSchema = new mongoose.Schema({
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
  slots: [slotSchema],
}, { _id: false });

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
  zones: [zoneSlotSchema],
}, { 
  timestamps: true 
});

slotConfigSchema.index({ date: 1 });

export default mongoose.model("SlotConfig", slotConfigSchema);
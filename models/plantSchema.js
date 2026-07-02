import mongoose from "mongoose";
const plantSchema = mongoose.Schema;

const schema = new plantSchema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  location: {
    type: String, // Assuming the location is stored as a string
    required: true,
    trim: true,
  },
  geoLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: undefined,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

schema.index({ geoLocation: "2dsphere" });

const Plant = mongoose.model("Plant", schema);
export default Plant;

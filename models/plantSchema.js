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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Plant = mongoose.model("Plant", schema);
export default Plant;

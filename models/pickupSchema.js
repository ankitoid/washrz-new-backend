import mongoose from "mongoose";
const pickupSchema = mongoose.Schema;

const schema = new pickupSchema(
  {
    Name: String,
    Contact: String,
    Address: String,
    slot: { type: String, default: "NA" },
    PickupStatus: {
      type: String,
      enum: ["pending", "complete", "deleted","assigned"],
      default: "pending",
    },
    type: {
      type: String,
      enum: ["live", "schedule", "reschdule"],
      default: "",
    },
    isDeleted: { type: Boolean, default: false },
    rescheduledDate: { type: Date, default: null },
    isRescheduled: { type: Boolean, default: false },
    pickup_date: { type: Date, default: null },
    cancelNote: { type: String },
    cancelVoice: { type: String },
    plantName: { type: String },
    riderName: String,
    riderDate: String,
  },
  { timestamps: true }
);

const pickup = mongoose.model("pickup", schema);
export default pickup;

import mongoose from "mongoose";
const pickupSchema = mongoose.Schema;

const schema = new pickupSchema(
  {
    appCustomerId : String,
    platform_type: {
      type: String,
      enum: ["wati","app"],
      default: "wati",
    },
    tempPickupAdresssId: String,
    tempDeliveryAddressId: String,
    Name: String,
    Contact: String,
    Address: String,
    deliveryAddress : String,
    slot: { type: String, default: "NA" },
    PickupStatus: {
      type: String,
      enum: ["pending", "complete", "deleted", "assigned"],
      default: "pending",
    },
    type: {
      type: String,
      enum: ["live", "schedule", "reschdule"],
      default: "",
    },
    isDeleted: { type: Boolean, default: false },

    cancelNote: { type: String, default: null },
    cancelVoice: { type: String, default: null },

    cancelledBy: {
      name: { type: String, default: null },
      role: { type: String, default: null },
    },
    cancelledAt: { type: Date, default: null },

    rescheduledDate: { type: Date, default: null },
    isRescheduled: { type: Boolean, default: false },
    pickup_date: { type: Date, default: null },
    plantName: { type: String },
     pickupLocation: {
      latitude: Number,
      longitude: Number,
    },
    deliveryLocation: {
      latitude: Number,
      longitude: Number,
    },
    contactName: String,
    contactPhone: String,
    note : String,
    riderName: String,
    riderDate: String,
  },
  { timestamps: true }
);

const pickup = mongoose.model("pickup", schema);
export default pickup;
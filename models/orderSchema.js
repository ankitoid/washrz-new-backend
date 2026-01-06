import mongoose from "mongoose";
 
const { Schema } = mongoose;
 
const itemSchema = new Schema({
  heading: String,
  subHeading: String,
  viewPrice: String,
  quantity: Number,
  price: Number,
  newQtyPrice: Number,
});
 
const orderSchema = new Schema(
  {
    contactNo: String,
    customerName: String,
    address: String,
    items: [itemSchema],
    price: Number,
    order_id: String,
    status: {
      type: String,
      enum: ["intransit", "processing", "ready for delivery","delivery rider assigned", "delivered","cancelled"],
      default: "processing",
    },
    intransitImage: [String],
    intransitVoice: String,
    image: [String], // Store S3 image URL
    voice: String, // Store S3 voice URL
    deliverImage: String,
    statusHistory: {
      intransit: { type: Date, default: null },
      processing: { type: Date, default: null },
      readyForDelivery: { type: Date, default: null },
      deliveryriderassigned : { type: Date, default: null },
      delivered: { type: Date, default: null },
      cancelled: { type: Date, default: null }
    },
    rescheduledDate: { type: Date, default: null }, // Add rescheduled date
    isRescheduled: { type: Boolean, default: false }, // Flag to check if rescheduled
    plantName: String,
    riderName: String,
    riderDate: String,
    orderLocation: {
      latitude: Number,
      longitude: Number,
    },
  },
  { timestamps: true }
);
 
const Order = mongoose.model("Order", orderSchema);
export default Order;
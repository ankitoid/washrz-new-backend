import mongoose from "mongoose";
const pickupSchema = mongoose.Schema;

const pickupItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CatalogItem",
      required: true,
    },
    label: String, // snapshot
    price: Number, // snapshot
    unit: String,  // snapshot
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const schema = new pickupSchema(
  {
    appCustomerId: String,
    platform_type: {
      type: String,
      enum: ["wati", "app"],
      default: "wati",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderSchema",
    },

    bookingId : {type:String , ref: 'Booking', required : false},  // through booking id get all the booking details 

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tempPickupAdresssId: String,
    tempDeliveryAddressId: String,
    Name: String,
    Contact: String,
    Address: String,
    deliveryAddress: String,
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
    note: String,
    riderName: String,
    riderDate: String,
    isHeavy :{ type: Boolean, default: false },

    morning_delivery : {type: Boolean, default:true},   // for checking morning delivery or not

    items: {
      type: [pickupItemSchema],
      default: [],
    },
  },
  { timestamps: true },
);


schema.pre(/^find/, function (next) {
  this.populate({
    path: "items.itemId",
    select: "images videos",
  });
  next();
});


const pickup = mongoose.model("pickup", schema);


export default pickup;
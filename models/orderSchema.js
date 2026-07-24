import mongoose, { mongo } from "mongoose";

const { Schema } = mongoose;

// ========== SUB-SCHEMAS ==========

// const itemSchema = new Schema({
//   heading: String,
//   subHeading: String,
//   viewPrice: String,
//   quantity: { type: Number, default: 1 },
//   price: { type: Number, required: true },
//   newQtyPrice: { type: Number, default: 0 },
//   type: {type: String, default: ''}
// }, { _id: false });

const itemStatusHistorySchema = new mongoose.Schema(
  {
    intransit:             { type: Date, default: null },
    processing:            { type: Date, default: null },
    reprocessing:          { type: Date, default: null },
    readyForDelivery:      { type: Date, default: null },
    deliveryriderassigned: { type: Date, default: null },
    delivered:             { type: Date, default: null },
    cancelled:             { type: Date, default: null },
  },
  { _id: false },
);

const itemSchema = new mongoose.Schema({
  lineId: { type: String}, // Unique identifier for this item line (can be generated as orderId + index)
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CatalogItem",
    required: true,
  },
  label:                  String,
  price:                  Number,
  unit:                   String,
  intransitImages:        { type: [String], default: [] },
  readyForDeliveryImages: { type: [String], default: [] },
  status: {
    type: String,
    enum: [
      "intransit",
      "processing",
      "reprocessing",
      "ready for delivery",
      "delivery rider assigned",
      "delivered",
      "cancelled",
    ],
    default: "intransit",
  },
  statusHistory: { type: itemStatusHistorySchema, default: () => ({}) },
});

const assignedRiderSchema = new Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    riderName: {
      type: String,
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const navigationTimelineSchema = new Schema(
  {
    event: {
      type: String,
      enum: ["navigation_started", "location_update", "reached_location"],
      required: true,
    },
    trackingLegId: String,
    taskType: {
      type: String,
      enum: ["pickup", "delivery", "return_to_plant"],
      default: "delivery",
    },
    riderId: String,
    riderName: String,
    location: {
      latitude: Number,
      longitude: Number,
    },
    totalDistanceKm: { type: Number, default: 0 },
    message: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const paymentMethodDetailsSchema = new Schema(
  {
    cardType: String,
    cardLastFour: String,
    cardNetwork: String,
    upiId: String,
    bankCode: String,
    bankName: String,
    walletName: String,
    issuer: String,
    pgType: String,
  },
  { _id: false },
);

const paymentSchema = new Schema({
  paymentId: { type: String },
  transactionId: String,
  bankRefNum: String,

  // Razorpay fields (NEW - safe addition)
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },

  amount: { type: Number },
  currency: { type: String, default: "INR" },

  paymentMode: {
    type: String,
    enum: [
      "credit_card",
      "debit_card",
      "netbanking",
      "upi",
      "wallet",
      "emi",
      "cash",
      "upi_qr",
      "unknown",
    ],
    default: "unknown",
  },

  paymentGateway: {
    type: String,
    enum: ["payu", "razorpay", "cash", "upi_qr"],
    default: "payu",
  },

  status: {
    type: String,
    enum: [
      "pending",
      "processing",
      "success",
      "failed",
      "cancelled",
      "refunded",
    ],
    default: "pending",
  },
});

const qrPaymentSchema = new Schema(
  {
    qrId: { type: String }, // Razorpay QR ID
    qrImageUrl: String,
    qrString: String,

    status: {
      type: String,
      enum: ["generated", "active", "scanned", "paid", "expired", "cancelled"],
      default: "generated",
    },

    amount: Number,

    paymentId: String, // Razorpay payment id
    orderId: String,

    generatedAt: { type: Date, default: Date.now },
    paidAt: Date,
  },
  { _id: false },
);

const orderLocationSchema = new Schema(
  {
    latitude: Number,
    longitude: Number,
    address: String,
    accuracy: Number,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const statusHistorySchema = new Schema(
  {
    pending: { type: Date, default: null },
    confirmed: { type: Date, default: null },
    processing: { type: Date, default: null },
    reprocessing: { type: Date, default: null },
    ready_for_delivery: { type: Date, default: null },
    out_for_delivery: { type: Date, default: null },
    delivered: { type: Date, default: null },
    cancelled: { type: Date, default: null },
    refunded: { type: Date, default: null },
  },
  { _id: false },
);

const CouponManageSchema = new Schema(
  {
    coupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
      code: {
        type: String,
      },
      discount: {
        type: Number,
      },
      type: {
        type: String,
      },
    },
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CouponReservation",
    },
  },
  { _id: false },
);


// ========= INVOICE SCHEMA  ==========

const invoiceSnapshotSchema = new mongoose.Schema(
  {
    // Invoice identification
    invoiceNumber: { type: String, required: true, unique: true, sparse: true },
    invoiceDate: { type: Date, default: Date.now },
    invoiceGeneratedBy: { type: String, default: "system" },


    //gst number
    gstNumber: { type: String, default: "" },
 
    // Customer details (captured at generation time)
    customerName: String,
    address: String,
    contactNo: String,
    email: String,
 
    // Reference to the parent order
    orderId: String,
 
    // Frozen item list
    items: [
      {
        label: String,
        price: Number,
        quantity: Number,
        unit: String,
        totalItemPrice: String,   // price * quantity
        sku: String,
        sacid: String,
      },
    ],
 
    // Pricing breakdown
    subtotal: Number,
    deliveryCharges: Number,
    taxAmount: Number,
    discountAmount: Number,
    totalAmount: Number,
 
    // Payment snapshot (always "paid" since invoice is generated after payment)
    payment: {
      mode: String,              // e.g., 'upi', 'card', 'cash'
      transactionId: String,
      status: String,            // 'success'
      paidAt: Date,
    },
 
    // Document status
    status: {
      type: String,
      enum: ["generated", "sent", "void"],
      default: "generated",
    },
 
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }   // _id: false because it's embedded inside the order
);
 

// ========== MAIN ORDER SCHEMA ==========

const orderSchema = new Schema(
  {
    appCustomerId: String,
    tempPickupAdresssId: String,
    tempDeliveryAddressId: String,
    platform_type: {
      type: String,
      enum: ["wati", "app"],
      default: "wati",
    },
    contactNo: String,
    customerName: String,
    address: String,
    email: String,

    // ========== ORDER ITEMS ==========
    items: [itemSchema],

    // ========== PRICING ==========
    price: Number,
    deliveryCharges: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: Number,

    // ========== ORDER IDENTIFICATION ==========
    order_id: {
      type: String,
      unique: true,
    },

    // ========== PAYMENT INFORMATION ==========
    payment: paymentSchema,
    qrPayments: [qrPaymentSchema],
    isPaid: { type: Boolean, default: false },
    paymentAttempts: { type: Number, default: 0 },

    //==========COUPON MANAGEMENT==========
    Coupon: CouponManageSchema,

    // ========== ORDER STATUS ==========
    status: {
      type: String,
      // enum: [
      //   "pending",
      //   "confirmed",
      //   "processing",
      //   "ready_for_delivery",
      //   "out_for_delivery",
      //   "delivered",
      //   "cancelled",
      //   "refunded"
      // ],
      enum: [
        "intransit",
        "processing",
        "reprocessing",
        "ready for delivery",
        "delivery rider assigned",
        "delivered",
        "cancelled",
      ],
      default: "processing",
    },

    statusHistory: statusHistorySchema,

    // ========== DELIVERY INFORMATION ==========
    deliveryType: {
      type: String,
      enum: ["standard", "express", "scheduled"],
      default: "standard",
    },
    deliveryDate: Date,
    deliveryTimeSlot: String,

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },
    riderId: String,
    riderName: String,
    riderContact: String,
    riderDate: String,
    riderAssignedAt: Date,

    assignedRider: {
      pickup: {
        type: assignedRiderSchema,
        default: null,
      },
      delivery: {
        type: assignedRiderSchema,
        default: null,
      },
    },

    // ========== TRACKING & MEDIA ==========
    intransitImage: [String],
    intransitVoice: String,
    image: [String],
    voice: String,
    ready_for_delivery_images: [String],
    deliverImage: String,
    statusHistory: {
      intransit: { type: Date, default: null },
      processing: { type: Date, default: null },
      reprocessing: { type: Date, default: null },
      readyForDelivery: { type: Date, default: null },
      deliveryriderassigned: { type: Date, default: null },
      delivered: { type: Date, default: null },
      cancelled: { type: Date, default: null },
    },
    rescheduledDate: { type: Date, default: null }, // Add rescheduled date
    isRescheduled: { type: Boolean, default: false }, // Flag to check if rescheduled
    plantName: String,
    riderName: String,
    riderDate: String,
    contactName: String,
    contactPhone: String,
    note: String,
    orderLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },


  // ========== MORNING DELIVERY ==========
    morningDelivery: { type: Boolean, default: true },
     
  //  ========== CONFIRM COD==========

    isCODConfirmed: { type: Boolean, default: false },


    // ========== ADDITIONAL INFORMATION ==========
    notes: String,
    cancellationReason: String,
    refundReason: String,

    // Plant/Store Information
    plantName: String,
    storeId: String,
    storeName: String,

    // ========== TIMESTAMPS ==========
    estimatedDeliveryAt: Date,
    actualDeliveryAt: Date,

    // ========== RESCHEDULING ==========
    rescheduledDate: { type: Date, default: null },
    isRescheduled: { type: Boolean, default: false },

    // ========== AUDIT FIELDS ==========
    createdBy: { type: String, default: "customer" },
    updatedBy: String,
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false, index: true },

    invoice: { type: invoiceSnapshotSchema, default: null },
    navigationTimeline: {
      type: [navigationTimelineSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// ========== AUTO CALCULATE TOTAL ==========
orderSchema.pre("save", function (next) {
  const price = this.price || 0;
  const delivery = this.deliveryCharges || 0;
  const tax = this.taxAmount || 0;
  const discount = this.discountAmount || 0;

  this.totalAmount = Math.max(
    0,
    Number((price + delivery + tax - discount).toFixed(2)),
  );

  next();
});

// ========== INDEXES ==========
orderSchema.index({ "payment.razorpayPaymentId": 1 });
orderSchema.index({ order_id: 1 }, { unique: true });
orderSchema.index({ contactNo: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ isPaid: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ "payment.paymentId": 1 });
orderSchema.index({ "qrPayments.qrId": 1 });
orderSchema.index({ riderId: 1, status: 1 });

orderSchema.pre(/^find/, function (next) {
  this.populate({
    path: "items.itemId",
    select: "images videos type sku sacid",
  });
  next();
});

const Order = mongoose.model("Order", orderSchema);


export default Order;

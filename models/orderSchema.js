import mongoose from "mongoose";

const { Schema } = mongoose;

// ========== SUB-SCHEMAS ==========

const itemSchema = new Schema({
  heading: String,
  subHeading: String,
  viewPrice: String,
  quantity: { type: Number, default: 1 },
  price: { type: Number, required: true },
  newQtyPrice: { type: Number, default: 0 }
}, { _id: false });

const paymentMethodDetailsSchema = new Schema({
  cardType: String,
  cardLastFour: String,
  cardNetwork: String,
  upiId: String,
  bankCode: String,
  bankName: String,
  walletName: String,
  issuer: String,
  pgType: String
}, { _id: false });

const paymentSchema = new Schema({
  // Payment Identification
  paymentId: { type: String }, // Your internal payment ID
  transactionId: String, // PayU transaction ID (mihpayid)
  bankRefNum: String, // Bank reference number
  
  // Payment Details
  amount: { type: Number },
  currency: { type: String, default: "INR" },
  paymentMode: {
    type: String,
    enum: [
      "credit_card", "debit_card", "netbanking", "upi", 
      "wallet", "emi", "cash", "upi_qr", "unknown"
    ],
    default: "unknown"
  },
  paymentGateway: {
    type: String,
    enum: ["payu", "razorpay", "cash", "upi_qr"],
    default: "payu"
  },
  status: {
    type: String,
    enum: ["pending", "processing", "success", "failed", "cancelled", "refunded"],
    default: "pending"
  },
  
  // Method Details
  methodDetails: paymentMethodDetailsSchema,
  
  // Timestamps
  initiatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  
  // Gateway Response
  gatewayResponse: Schema.Types.Mixed,
  hash: String,
  
  // Error Details
  errorCode: String,
  errorMessage: String,
  
  // Additional Info
  discount: Number,
  netAmountDebited: Number,
  
  // Refund Info
  refundId: String,
  refundAmount: Number,
  refundDate: Date,
  refundStatus: String,
  refundResponse: Schema.Types.Mixed,
  refundReason: String
}, { _id: false });

const qrPaymentSchema = new Schema({
  qrId: { type: String },
  qrImageUrl: String,
  qrString: String,
  status: {
    type: String,
    enum: ["generated", "active", "scanned", "paid", "expired", "cancelled"],
    default: "generated"
  },
  amount: Number,
  upiId: String,
  upiName: String,
  generatedBy: String,
  generatedAt: { type: Date, default: Date.now },
  expiresAt: Date,
  scannedAt: Date,
  paidAt: Date,
  transactionId: String,
  payerUpiId: String,
  payerName: String,
  paymentMethod: String
}, { _id: false });

const orderLocationSchema = new Schema({
  latitude: Number,
  longitude: Number,
  address: String,
  accuracy: Number,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const statusHistorySchema = new Schema({
  pending: { type: Date, default: null },
  confirmed: { type: Date, default: null },
  processing: { type: Date, default: null },
  ready_for_delivery: { type: Date, default: null },
  out_for_delivery: { type: Date, default: null },
  delivered: { type: Date, default: null },
  cancelled: { type: Date, default: null },
  refunded: { type: Date, default: null }
}, { _id: false });

// ========== MAIN ORDER SCHEMA ==========

const orderSchema = new Schema(
  { 
    appCustomerId : String,
    tempPickupAdresssId: String,
    tempDeliveryAddressId: String,
    platform_type: {
      type: String,
      enum: ["wati","app"],
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
      unique: true
    },
    
    // ========== PAYMENT INFORMATION ==========
    payment: paymentSchema,
    qrPayments: [qrPaymentSchema],
    isPaid: { type: Boolean, default: false },
    paymentAttempts: { type: Number, default: 0 },
    
    // ========== ORDER STATUS ==========
    status: {
      type: String,
      enum: [
        "pending", 
        "confirmed", 
        "processing", 
        "ready_for_delivery",
        "out_for_delivery", 
        "delivered", 
        "cancelled", 
        "refunded"
      ],
      default: "pending"
    },
    
    statusHistory: statusHistorySchema,
    
    // ========== DELIVERY INFORMATION ==========
    deliveryType: {
      type: String,
      enum: ["standard", "express", "scheduled"],
      default: "standard"
    },
    deliveryDate: Date,
    deliveryTimeSlot: String,
    
    riderId: String,
    riderName: String,
    riderContact: String,
    riderDate: String,
    riderAssignedAt: Date,
    
    // ========== TRACKING & MEDIA ==========
    intransitImage: [String],
    intransitVoice: String,
    image: [String],
    voice: String,
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
    contactName: String,
    contactPhone : String,
    note : String,
    orderLocation: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    
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
    isActive: { type: Boolean, default: true }
  },
  { 
    timestamps: true
  }
);

// ========== INDEXES ==========

orderSchema.index({ order_id: 1 }, { unique: true });
orderSchema.index({ contactNo: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ isPaid: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'payment.paymentId': 1 });
orderSchema.index({ 'qrPayments.qrId': 1 });
orderSchema.index({ 'riderId': 1, status: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
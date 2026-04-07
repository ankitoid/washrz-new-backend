import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },

    type: {
      type: String,
      enum: ["flat", "discount"],
      required: true
    },

    discount: {
      type: Number,
      required: true,
      min: 0
    },

    maxCap: {
      type: Number,
      default: null
    },

    totalLimit: {
      type: Number,
      required: true,
      min: 1
    },

    usedCount: {
      type: Number,
      default: 0
    },

    reservedCount: {
      type: Number,
      default: 0
    },

    perUser: {
      type: Number,
      default: 1
    },

    minOrder: {
      type: Number,
      default: 0
    },

    startDate: {
      type: Date,
      required: true
    },

    expiryDate: {
      type: Date,
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    categories: {
      type: [String],
      enum: ["LAUNDRY", "DRYCLEAN", "SHOESPA"],
      default: []
    }
  },
  {
    timestamps: true,
    collection: "coupons"
  }
);


couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ expiryDate: 1 });


couponSchema.pre("save", function (next) {
  if (this.startDate > this.expiryDate) {
    return next(new Error("Start date cannot be after expiry date"));
  }

  if (this.type === "discount" && !this.maxCap) {
    return next(new Error("maxCap is required for percentage discount"));
  }

  next();
});

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
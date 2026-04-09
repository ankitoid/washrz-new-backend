// import mongoose from "mongoose";

// const couponSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//       trim: true
//     },

//     code: {
//       type: String,
//       required: true,
//       unique: true,
//       uppercase: true,
//       trim: true
//     },

//     type: {
//       type: String,
//       enum: ["flat", "discount"],
//       required: true
//     },

//     discount: {
//       type: Number,
//       required: true,
//       min: 0
//     },

//     maxCap: {
//       type: Number,
//       default: null
//     },

//     totalLimit: {
//       type: Number,
//       required: true,
//       min: 1
//     },

//     usedCount: {
//       type: Number,
//       default: 0
//     },

//     reservedCount: {
//       type: Number,
//       default: 0
//     },

//     perUser: {
//       type: Number,
//       default: 1
//     },

//     minOrder: {
//       type: Number,
//       default: 0
//     },

//     startDate: {
//       type: Date,
//       required: true
//     },

//     expiryDate: {
//       type: Date,
//       required: true
//     },

//     isActive: {
//       type: Boolean,
//       default: true
//     },

//     categories: {
//       type: [String],
//       enum: ["LAUNDRY", "DRYCLEAN", "SHOESPA"],
//       default: []
//     }
//   },
//   {
//     timestamps: true,
//     collection: "coupons"
//   }
// );


// couponSchema.index({ code: 1 });
// couponSchema.index({ isActive: 1 });
// couponSchema.index({ expiryDate: 1 });


// couponSchema.pre("save", function (next) {
//   if (this.startDate > this.expiryDate) {
//     return next(new Error("Start date cannot be after expiry date"));
//   }

//   if (this.type === "discount" && !this.maxCap) {
//     return next(new Error("maxCap is required for percentage discount"));
//   }

//   next();
// });

// const Coupon = mongoose.model("Coupon", couponSchema);
// export default Coupon;


import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["flat", "discount"],
      required: true,
    },

    discount: {
      type: Number,
      required: true,
      min: 0,
    },

    maxCap: {
      type: Number,
      default: null,
    },

    totalLimit: {
      type: Number,
      required: true,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    reservedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUser: {
      type: Number,
      default: 1,
      min: 1,
    },

    minOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    startDate: {
      type: Date,
      required: true,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    categories: {
      type: [String],
      enum: ["LAUNDRY", "DRYCLEAN", "SHOESPA"],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "coupons",
  }
);


// ================= INDEXES =================

couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ startDate: 1 });


// ================= VALIDATIONS =================

couponSchema.pre("save", function (next) {
  // ✅ DATE VALIDATION
  if (this.startDate > this.expiryDate) {
    return next(new Error("Start date cannot be after expiry date"));
  }

  // ✅ PERCENTAGE COUPON MUST HAVE maxCap
  if (this.type === "discount" && !this.maxCap) {
    return next(new Error("maxCap is required for percentage discount"));
  }

  // ✅ FLAT COUPON SHOULD NOT HAVE maxCap (optional but clean)
  if (this.type === "flat" && this.maxCap) {
    this.maxCap = null;
  }

  // ✅ ENSURE COUNTS NEVER BREAK LIMIT
  if (this.usedCount + this.reservedCount > this.totalLimit) {
    return next(new Error("Coupon usage exceeds total limit"));
  }

  next();
});


// ================= HELPER METHODS (OPTIONAL BUT POWERFUL) =================

// ✅ Check if coupon is valid (central logic)
couponSchema.methods.isValidCoupon = function (cartAmount, category) {
  const now = new Date();

  if (!this.isActive) return false;
  if (this.startDate > now || this.expiryDate < now) return false;
  if (cartAmount < this.minOrder) return false;

  if (
    this.categories.length &&
    !this.categories.includes(category?.toUpperCase())
  ) {
    return false;
  }

  if (this.usedCount + this.reservedCount >= this.totalLimit) {
    return false;
  }

  return true;
};


// ✅ Calculate discount (reusable everywhere)
couponSchema.methods.calculateDiscount = function (amount) {
  if (this.type === "flat") {
    return this.discount;
  }

  if (this.type === "discount") {
    let discount = (amount * this.discount) / 100;

    if (this.maxCap) {
      discount = Math.min(discount, this.maxCap);
    }

    return Math.round(discount);
  }

  return 0;
};


const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
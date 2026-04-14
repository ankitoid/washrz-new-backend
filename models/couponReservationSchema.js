import mongoose from "mongoose";

const couponReservationSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: ["reserved", "confirmed", "expired"],
      default: "reserved"
    },

    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    collection: "coupon_reservations"
  }
);


couponReservationSchema.index({ couponId: 1 });
couponReservationSchema.index({ userId: 1 });
couponReservationSchema.index({ status: 1 });
couponReservationSchema.index({ expiresAt: 1 });


// couponReservationSchema.index(
//   { expiresAt: 1 },
//   { expireAfterSeconds: 0 }
// );

const CouponReservation = mongoose.model(
  "CouponReservation",
  couponReservationSchema
);

export default CouponReservation;
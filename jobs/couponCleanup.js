import CouponReservation from "../models/couponReservationSchema.js";
import Coupon from "../models/couponSchema.js";

export const cleanupExpiredCoupons = async () => {
  const now = new Date();

  const expired = await CouponReservation.find({
    status: "reserved",
    expiresAt: { $lt: now }
  });

  if (!expired.length) return;

  const bulkCouponOps = [];
  const bulkReservationOps = [];

  for (const res of expired) {
    bulkCouponOps.push({
      updateOne: {
        filter: { _id: res.couponId },
        update: { $inc: { reservedCount: -1 } }
      }
    });

    bulkReservationOps.push({
      updateOne: {
        filter: { _id: res._id, status: "reserved" },
        update: { $set: { status: "expired" } }
      }
    });
  }

  await Promise.all([
    Coupon.bulkWrite(bulkCouponOps),
    CouponReservation.bulkWrite(bulkReservationOps)
  ]);

  console.log(`✅ Cleaned ${expired.length} expired coupons`);
};
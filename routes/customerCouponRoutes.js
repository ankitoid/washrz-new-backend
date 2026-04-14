import express from "express";
import customerCoupons from "../controller/customerCouponController.js";


const router = express.Router()

// GET available coupons
router.get("/", customerCoupons.getAvailableCoupons);

// // APPLY coupon
router.post("/apply", customerCoupons.applyCouponToOrder);

// // CONFIRM coupon
router.post("/confirm", customerCoupons.confirmCouponAfterPayment);

// // RELEASE coupon
router.post("/remove", customerCoupons.removeCouponFromOrder);

export { router as default };
import coupons_service from "../services/coupon.service.js";
import catchAsync from "../utills/catchAsync.js";



const customerCoupons = {};


// GET AVAILABLE COUPONS
customerCoupons.getAvailableCoupons = catchAsync(async (req, res) => {
  const data = await coupons_service.getAvailable(req.query);
  res.send({ success: true, data });
});

// APPLY COUPON
customerCoupons.applyCouponToOrder = catchAsync(async (req, res) => {
  const result = await coupons_service.applyToOrder(req.user.id, req.body);
  res.send(result);
});

// CONFIRM COUPON
customerCoupons.confirmCouponAfterPayment = catchAsync(async (req, res) => {
  const result = await coupons_service.confirmAfterPayment(req.user.id, req.body);
  res.send(result);
});

// RELEASE COUPON
customerCoupons.removeCouponFromOrder = catchAsync(async (req, res) => {
  const result = await coupons_service.removeFromOrder(req.user.id, req.body);
  res.send(result);
})




export default customerCoupons;
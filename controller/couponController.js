import coupons_service from "../services/coupon.service.js";
import catchAsync from "../utills/catchAsync.js";



const adminCoupons = {}

/**
 * CREATE COUPON
 */
adminCoupons.createCoupon = catchAsync(async (req, res) => {
  const coupon = await coupons_service.create(req.body);
  res.status(201).send({ success: true, coupon });
});

/**
 * GET ALL COUPONS
 */
adminCoupons.getAllCoupons = catchAsync(async (req, res) => {
  const result = await coupons_service.list(req.query);
  res.send(result);
});

/**
 * UPDATE COUPON
 */
adminCoupons.updateCoupon = catchAsync(async (req, res) => {
  const coupon = await coupons_service.update(req.params.id, req.body);
  res.send({ success: true, coupon });
}); 

/**
 * TOGGLE COUPON
 */
adminCoupons.toggleCoupon = catchAsync(async (req, res) => {
  const coupon = await coupons_service.toggle(req.params.id);
  res.send({ success: true, coupon });
});

/**
 * DELETE COUPON
 */
adminCoupons.deleteCoupon = catchAsync(async (req, res) => {
  await coupons_service.remove(req.params.id);
  res.send({ success: true, message: "Coupon deleted" });
});


export default adminCoupons
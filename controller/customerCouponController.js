import coupons_service from "../services/coupon.service.js";
import catchAsync from "../utills/catchAsync.js";



const customerCoupons = {};


// GET AVAILABLE COUPONS
customerCoupons.getAvailableCoupons = catchAsync(async (req, res) => {
  const data = await coupons_service.getAvailable(req.query, req.body);
  res.send({ success: true, data });
});

// APPLY COUPON
customerCoupons.applyCouponToOrder = catchAsync(async (req, res) => {


  console.log("this is the req body",req.body)

   const userId = req.body?.userId
   if (!userId) throw new Error("User not found");

  const result = await coupons_service.applyToOrder(userId, req.body);
  res.send(result);
});

// CONFIRM COUPON
customerCoupons.confirmCouponAfterPayment = catchAsync(async (req, res) => {

  console.log("this is the req body",req.body)

  const result = await coupons_service.confirmAfterPayment(req.body);
  res.send(result);
});

// RELEASE COUPON
customerCoupons.removeCouponFromOrder = catchAsync(async (req, res) => {
  console.log("this is the req body-->>",req.body)
  const result = await coupons_service.removeFromOrder(req.body);
  res.send(result);
})




export default customerCoupons;
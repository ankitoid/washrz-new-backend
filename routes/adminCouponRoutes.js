
import adminCoupons from '../controller/couponController.js';
import express from "express";
const router = express.Router();

router.get('/', adminCoupons.getAllCoupons);
router.post('/',adminCoupons.createCoupon);
router.put('/:id', adminCoupons.updateCoupon);
router.patch('/:id/toggle',adminCoupons.toggleCoupon);
router.delete('/:id', adminCoupons.deleteCoupon);

export { router as default };
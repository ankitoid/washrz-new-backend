import express from "express";
import {
  initiatePayment,
  verifyRazorpayPayment,
  checkPaymentStatus,
  markAsPaid,
  initiateRefund,
  razorpayWebhook
} from "../controller/paymentController.js";

const router = express.Router();

// ================= PAYMENT =================

// Create Razorpay order
router.post("/initiate", initiatePayment);

// Verify payment after frontend success
router.post("/verify", verifyRazorpayPayment);

// Razorpay webhook
router.post("/webhook", razorpayWebhook);

// ================= ORDER PAYMENT MANAGEMENT =================

router.get("/status/:orderId", checkPaymentStatus);
router.post("/:orderId/mark-paid", markAsPaid);
router.post("/:orderId/refund", initiateRefund);

export default router;
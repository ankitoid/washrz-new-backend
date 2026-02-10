import express from 'express';
import {
  initiatePayment,
  paymentSuccessCallback,
  paymentFailureCallback,
  paymentWebhook,  // NEW WEBHOOK
  checkPaymentStatus,
  markAsPaid,
  initiateRefund,
//   markAsPaid,
} from '../controller/paymentController.js';

const router = express.Router();

// === CALLBACK ROUTES (for user redirect) ===
// These are what you configure in PayU dashboard as return URLs
router.post('/success-callback', paymentSuccessCallback);  // CALLBACK
router.post('/failure-callback', paymentFailureCallback);  // CALLBACK

// Also support GET for older PayU configurations
router.get('/success-callback', paymentSuccessCallback);   // CALLBACK
router.get('/failure-callback', paymentFailureCallback);   // CALLBACK

// === WEBHOOK ROUTE (for backend processing) ===
// This is configured in PayU dashboard as webhook URL
router.post('/webhook', paymentWebhook);                   // WEBHOOK

// === OTHER PAYMENT APIS ===
router.post('/initiate', initiatePayment);
router.get('/status/:orderId', checkPaymentStatus);
router.post('/:orderId/mark-paid', markAsPaid);
router.post('/:orderId/refund', initiateRefund);

export default router;
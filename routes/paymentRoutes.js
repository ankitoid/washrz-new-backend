import express from 'express';
import {
  initiatePayment,
  paymentSuccessCallback,
  paymentFailureCallback,
  paymentWebhook,  // NEW WEBHOOK
  checkPaymentStatus,
  markAsPaid,
  initiateRefund,
  autoTestPayU,
//   markAsPaid,
} from '../controller/paymentController.js';

const router = express.Router();

// === CALLBACK ROUTES (for user redirect) ===
// These are what you configure in PayU dashboard as return URLs
router.post('/success-callback', express.urlencoded({ extended: true }), paymentSuccessCallback);
router.post('/failure-callback', express.urlencoded({ extended: true }), paymentFailureCallback);

// Also support GET for older PayU configurations
router.get('/success-callback', paymentSuccessCallback);   // No urlencoded needed for GET
router.get('/failure-callback', paymentFailureCallback);   // No urlencoded needed for GET

// === WEBHOOK ROUTE (for backend processing) ===
// This is configured in PayU dashboard as webhook URL
router.post('/webhook', paymentWebhook);                   // WEBHOOK

// === OTHER PAYMENT APIS ===
router.post('/initiate', initiatePayment);
router.get('/test', autoTestPayU);
router.get('/status/:orderId', checkPaymentStatus);
router.post('/:orderId/mark-paid', markAsPaid);
router.post('/:orderId/refund', initiateRefund);

export default router;
import express from 'express';
import {
  generateQR,
  getQRForOrder,
  verifyQRPayment,
  getRiderQROrders,
  cancelQR,
  qrPaymentWebhook
} from '../controller/qrController.js';

const router = express.Router();

// QR routes
router.post('/:orderId/generate', generateQR);
router.get('/:orderId', getQRForOrder);
router.post('/:orderId/verify', verifyQRPayment);
router.post('/:orderId/cancel', cancelQR);

// Rider specific
router.get('/rider/:riderId/orders', getRiderQROrders);

// Webhook (for automatic payment confirmation)
router.post('/webhook', qrPaymentWebhook);

export default router;
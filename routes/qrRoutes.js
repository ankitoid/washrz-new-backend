import express from 'express';
import {
  generatePayUQR,
  generateSimpleQR,  // Add this
  testPayUConnection,
  checkQRStatus,
  getQRForOrder,
  cancelQR,
  handlePayUCallback
} from '../controller/qrController.js';

const router = express.Router();

// Test endpoints
router.get('/test/connection', testPayUConnection);

// Generate PayU Dynamic QR (tries multiple methods)
router.post('/:orderId/generate-payu', generatePayUQR);

// Generate Simple QR (fallback method)
router.post('/:orderId/generate-simple', generateSimpleQR);

// QR Management
router.get('/:qrId/status', checkQRStatus);
router.get('/order/:orderId', getQRForOrder);
router.post('/:qrId/cancel', cancelQR);

// PayU Callback
router.post('/payu-callback', handlePayUCallback);
router.get('/payu-callback', handlePayUCallback);

export default router;
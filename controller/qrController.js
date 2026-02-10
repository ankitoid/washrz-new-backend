import QRCode from 'qrcode';
import { sendSMS } from '../utills/helpers.js';
import Order from '../models/orderSchema.js';

// Generate QR for order
export const generateQR = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId, riderName, upiId, upiName } = req.body;
    
    const order = await Order.findOne({ order_id: orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if already paid
    if (order.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'Order already paid'
      });
    }
    
    // Generate QR ID
    const qrId = `QR${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // UPI parameters (customize with your UPI ID)
    const merchantUpiId = upiId || process.env.MERCHANT_UPI_ID || 'your-merchant@upi';
    const merchantName = upiName || process.env.MERCHANT_NAME || 'Your Store';
    
    // Create UPI deep link
    const upiParams = new URLSearchParams({
      pa: merchantUpiId,
      pn: merchantName,
      am: order.price.toString(),
      tr: qrId,
      tn: `Payment for order ${order.order_id}`,
      cu: 'INR'
    });
    
    const upiString = `upi://pay?${upiParams.toString()}`;
    
    // Generate QR image as base64
    const qrImage = await QRCode.toDataURL(upiString, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Save QR info to order
    const qrPayment = {
      qrId,
      qrImageUrl: qrImage,
      amount: order.price,
      upiId: merchantUpiId,
      upiString,
      status: 'generated',
      generatedBy: riderId,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    // Add to order
    if (!order.qrPayments) order.qrPayments = [];
    order.qrPayments.push(qrPayment);
    
    // Update order flags
    order.qrGenerated = true;
    order.qrId = qrId;
    order.qrImage = qrImage;
    order.qrGeneratedBy = riderId;
    order.qrGeneratedAt = new Date();
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'QR generated successfully',
      qrData: {
        qrId,
        qrImage,
        upiString,
        amount: order.price,
        expiresAt: qrPayment.expiresAt,
        orderId: order.order_id,
        customerName: order.customerName
      }
    });
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR',
      error: error.message
    });
  }
};

// Get QR for order
export const getQRForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({ order_id: orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (!order.qrGenerated || !order.qrId) {
      return res.status(404).json({
        success: false,
        message: 'No QR generated for this order'
      });
    }
    
    // Find active QR payment
    const activeQR = order.qrPayments?.find(qr => 
      qr.status === 'generated' || qr.status === 'active'
    );
    
    res.status(200).json({
      success: true,
      qrGenerated: order.qrGenerated,
      qrId: order.qrId,
      qrImage: order.qrImage,
      qrStatus: activeQR?.status || 'unknown',
      expiresAt: activeQR?.expiresAt,
      amount: order.price
    });
  } catch (error) {
    console.error('Get QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get QR',
      error: error.message
    });
  }
};

// Verify QR payment manually
export const verifyQRPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { 
      transactionId, 
      payerUpiId, 
      payerName, 
      paymentMethod,
      paymentTime 
    } = req.body;
    
    const order = await Order.findOne({ order_id: orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (order.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'Order already paid'
      });
    }
    
    // Find active QR
    const activeQRIndex = order.qrPayments?.findIndex(qr => 
      qr.status === 'generated' || qr.status === 'active'
    );
    
    if (activeQRIndex === -1 || !order.qrPayments?.[activeQRIndex]) {
      return res.status(400).json({
        success: false,
        message: 'No active QR found for this order'
      });
    }
    
    // Update QR payment
    const qrPayment = order.qrPayments[activeQRIndex];
    qrPayment.status = 'paid';
    qrPayment.transactionId = transactionId;
    qrPayment.payerUpiId = payerUpiId;
    qrPayment.payerName = payerName;
    qrPayment.paymentMethod = paymentMethod;
    qrPayment.paidAt = paymentTime ? new Date(paymentTime) : new Date();
    
    // Update order payment
    order.payment = {
      paymentId: `QR${transactionId}`,
      transactionId,
      amount: order.price,
      status: 'success',
      paymentMode: 'upi_qr',
      methodDetails: {
        upiId: payerUpiId,
        paymentMethod
      },
      completedAt: new Date()
    };
    
    order.isPaid = true;
    if (order.status === 'pending_payment') {
      order.status = 'processing';
    }
    
    await order.save();
    
    // Send confirmation
    if (order.contactNo) {
      await sendSMS(
        order.contactNo,
        `QR Payment of ₹${order.price} for order ${order.order_id} verified successfully. Transaction ID: ${transactionId}`
      );
    }
    
    res.status(200).json({
      success: true,
      message: 'QR payment verified and order updated',
      order: {
        orderId: order.order_id,
        isPaid: true,
        paymentStatus: 'success'
      }
    });
  } catch (error) {
    console.error('Verify QR payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify QR payment',
      error: error.message
    });
  }
};

// Get rider's QR orders
export const getRiderQROrders = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status } = req.query;
    
    const query = { 
      qrGeneratedBy: riderId,
      isPaid: false 
    };
    
    if (status) {
      query.status = status;
    }
    
    const orders = await Order.find(query)
      .sort({ qrGeneratedAt: -1 })
      .select('order_id customerName contactNo address price qrGenerated qrId qrImage status qrGeneratedAt');
    
    // Check for expired QRs
    const now = new Date();
    const updatedOrders = orders.map(order => {
      const qrPayment = order.qrPayments?.find(qr => 
        qr.status === 'generated' || qr.status === 'active'
      );
      
      const isExpired = qrPayment?.expiresAt && new Date(qrPayment.expiresAt) < now;
      
      return {
        ...order.toObject(),
        isExpired,
        expiresIn: qrPayment?.expiresAt ? 
          Math.max(0, Math.floor((new Date(qrPayment.expiresAt) - now) / 1000 / 60)) : null // minutes
      };
    });
    
    res.status(200).json({
      success: true,
      orders: updatedOrders
    });
  } catch (error) {
    console.error('Get rider QR orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch QR orders',
      error: error.message
    });
  }
};

// Cancel/expire QR
export const cancelQR = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    
    const order = await Order.findOne({ order_id: orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update all active QRs to expired
    if (order.qrPayments && order.qrPayments.length > 0) {
      order.qrPayments = order.qrPayments.map(qr => {
        if (qr.status === 'generated' || qr.status === 'active') {
          return {
            ...qr,
            status: 'expired',
            cancelledReason: reason
          };
        }
        return qr;
      });
    }
    
    order.qrGenerated = false;
    order.lastQrActive = false;
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'QR cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel QR',
      error: error.message
    });
  }
};

// QR Payment Webhook (for automatic verification)
export const qrPaymentWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Verify webhook signature if provided
    if (process.env.QR_WEBHOOK_SECRET) {
      const signature = req.headers['x-webhook-signature'];
      // Add signature verification logic here
    }
    
    const { 
      event, 
      qrId, 
      transactionId, 
      amount, 
      payerUpiId,
      payerName,
      paymentMethod,
      paymentTime 
    } = webhookData;
    
    if (event !== 'payment.success') {
      return res.status(400).json({
        success: false,
        message: 'Unsupported event type'
      });
    }
    
    // Find order by QR ID
    const order = await Order.findOne({ 'qrPayments.qrId': qrId });
    
    if (!order) {
      console.error(`Order not found for QR: ${qrId}`);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if already paid
    if (order.isPaid) {
      return res.status(200).json({
        success: true,
        message: 'Order already paid'
      });
    }
    
    // Verify amount matches
    if (amount !== order.price) {
      console.error(`Amount mismatch for QR ${qrId}: received ${amount}, expected ${order.price}`);
      return res.status(400).json({
        success: false,
        message: 'Amount mismatch'
      });
    }
    
    // Update QR payment status
    const qrIndex = order.qrPayments.findIndex(qr => qr.qrId === qrId);
    if (qrIndex !== -1) {
      order.qrPayments[qrIndex].status = 'paid';
      order.qrPayments[qrIndex].transactionId = transactionId;
      order.qrPayments[qrIndex].payerUpiId = payerUpiId;
      order.qrPayments[qrIndex].payerName = payerName;
      order.qrPayments[qrIndex].paymentMethod = paymentMethod;
      order.qrPayments[qrIndex].paidAt = new Date(paymentTime);
    }
    
    // Update order payment
    order.payment = {
      paymentId: `QR${transactionId}`,
      transactionId,
      amount: order.price,
      status: 'success',
      paymentMode: 'upi_qr',
      methodDetails: {
        upiId: payerUpiId,
        paymentMethod
      },
      completedAt: new Date()
    };
    
    order.isPaid = true;
    if (order.status === 'pending_payment') {
      order.status = 'processing';
    }
    
    await order.save();
    
    // Send notifications
    if (order.contactNo) {
      await sendSMS(
        order.contactNo,
        `Payment of ₹${order.price} for order ${order.order_id} received via QR. Thank you!`
      );
    }
    
    res.status(200).json({
      success: true,
      message: 'QR payment processed successfully',
      orderId: order.order_id
    });
  } catch (error) {
    console.error('QR webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error.message
    });
  }
};
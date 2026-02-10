import crypto from 'crypto';
import { sendSMS } from '../utills/helpers.js';
import Order from '../models/orderSchema.js';

// Generate PayU hash
const generateHash = (data) => {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email
  } = data;
  
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${process.env.PAYU_SALT}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

// === CALLBACKS (for user redirect) ===

// PayU Success Callback - User redirected here after successful payment
export const paymentSuccessCallback = async (req, res) => {
  try {
    const paymentData = req.method === 'POST' ? req.body : req.query;
    
    console.log('Success callback received:', paymentData);
    
    // Verify hash
    const generatedHash = generateHash({
      key: process.env.PAYU_KEY,
      txnid: paymentData.txnid,
      amount: paymentData.amount,
      productinfo: paymentData.productinfo,
      firstname: paymentData.firstname,
      email: paymentData.email
    });
    
    if (generatedHash !== paymentData.hash) {
      console.error('Hash verification failed in callback');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=failed&reason=hash_mismatch`);
    }
    
    // Find order by payment ID - UPDATED FIELD NAME
    const order = await Order.findOne({ 'payment.paymentId': paymentData.txnid });
    
    if (!order) {
      console.error('Order not found for payment:', paymentData.txnid);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=failed&reason=order_not_found`);
    }
    
    // Update payment status (if not already updated by webhook)
    if (!order.isPaid) {
      order.payment.status = 'success';
      order.payment.transactionId = paymentData.mihpayid || paymentData.bank_ref_num;
      order.payment.methodDetails = {
        paymentMode: paymentData.mode,
        bankCode: paymentData.bankcode,
        cardLastFour: paymentData.cardnum ? paymentData.cardnum.slice(-4) : null
      };
      order.payment.gatewayResponse = paymentData;
      order.payment.completedAt = new Date();
      
      // Update order - UPDATED STATUS CHECK
      order.isPaid = true;
      // Use your existing status values from your original schema
      if (order.status === 'pending' || order.status === 'confirmed') {
        order.status = 'processing';
      }
      
      await order.save();
      
      // Send confirmation - UPDATED FIELD NAME
      if (order.contactNo) {
        await sendSMS(
          order.contactNo,
          `Payment of ₹${order.totalAmount || order.price} successful. Order: ${order.order_id}, Txn: ${order.payment.transactionId}`
        );
      }
    }
    
    // Redirect to frontend with success - UPDATED FIELD NAME
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=success&orderId=${order.order_id}&paymentId=${paymentData.txnid}`);
    
  } catch (error) {
    console.error('Payment success callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=error`);
  }
};

// PayU Failure Callback - User redirected here after failed payment
export const paymentFailureCallback = async (req, res) => {
  try {
    const paymentData = req.method === 'POST' ? req.body : req.query;
    
    console.log('Failure callback received:', paymentData);
    
    // Find order
    const order = await Order.findOne({ 'payment.paymentId': paymentData.txnid });
    
    if (order && !order.isPaid) {
      order.payment.status = 'failed';
      order.payment.errorCode = paymentData.error_code;
      order.payment.errorMessage = paymentData.error_Message;
      order.payment.gatewayResponse = paymentData;
      order.paymentAttempts = (order.paymentAttempts || 0) + 1;
      
      await order.save();
    }
    
    const redirectUrl = `${process.env.FRONTEND_URL}/payment/status?status=failed&orderId=${order?.order_id || ''}&reason=${paymentData.error_Message || 'payment_failed'}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Payment failure callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=error`);
  }
};

// === WEBHOOK (for backend processing) ===

// PayU Webhook - Server-to-server notification
export const paymentWebhook = async (req, res) => {
  try {
    const webhookData = req.body;

    console.log("webhook data", webhookData)
    
    console.log('PayU webhook received:', webhookData);
    
    // Verify webhook signature if available
    if (req.headers['x-payu-signature']) {
      const signature = req.headers['x-payu-signature'];
      // Add signature verification logic here
      console.log('Webhook signature:', signature);
    }
    
    const { 
      txnid, 
      mihpayid, 
      status, 
      amount,
      productinfo,
      firstname,
      email,
      phone,
      mode,
      bankcode,
      bank_ref_num,
      error_code,
      error_Message,
      net_amount_debit,
      addedon
    } = webhookData;
    
    // Find order by payment ID

    const order = await Order.findOne({ 'payment.paymentId': txnid });
    
    if (!order) {
      console.error('Order not found in webhook:', txnid);
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    // Update based on webhook status
    if (status === 'success' && !order.isPaid) {
      // Update payment
      order.payment.status = 'success';
      order.payment.transactionId = mihpayid || bank_ref_num;
      order.payment.methodDetails = {
        paymentMode: mode,
        bankCode: bankcode
      };
      order.payment.gatewayResponse = webhookData;
      order.payment.completedAt = new Date(addedon) || new Date();
      order.payment.netAmountDebited = net_amount_debit;
      
      // Update order - UPDATED STATUS CHECK
      order.isPaid = true;
      if (order.status === 'pending' || order.status === 'confirmed') {
        order.status = 'processing';
      }
      
      await order.save();
      
      console.log(`Webhook: Order ${order.order_id} marked as paid via webhook`);
      
      // Send notifications (optional) - UPDATED FIELD NAME
      if (order.contactNo) {
        await sendSMS(
          order.contactNo,
          `Payment received for order ${order.order_id}. Amount: ₹${order.totalAmount || order.price}`
        );
      }
      
    } else if (status === 'failure' && order.payment.status !== 'success') {
      // Only update if not already successful
      order.payment.status = 'failed';
      order.payment.errorCode = error_code;
      order.payment.errorMessage = error_Message;
      order.payment.gatewayResponse = webhookData;
      order.paymentAttempts = (order.paymentAttempts || 0) + 1;
      
      await order.save();
      
      console.log(`Webhook: Order ${order.order_id} payment failed`);
    }
    
    // Always return 200 to acknowledge webhook
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed' 
    });
    
  } catch (error) {
    console.error('Payment webhook error:', error);
    // Still return 200 so PayU doesn't retry excessively
    res.status(200).json({ 
      success: false, 
      message: 'Webhook processing error',
      error: error.message 
    });
  }
};

// === OTHER PAYMENT APIS ===

export const initiatePayment = async (req, res) => {
  try {
    const { orderId, paymentMode = 'upi' } = req.body;
    
    // Find order - UPDATED FIELD NAME
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
    
    // Generate payment ID
    const paymentId = `PAY${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Use totalAmount if available, otherwise use price - UPDATED FIELD
    const amount = order.totalAmount || order.price || 0;
    
    // Prepare payment data for PayU
    const paymentData = {
      key: process.env.PAYU_KEY,
      txnid: paymentId,
      amount: amount.toString(),
      productinfo: `Order ${order.order_id}`,
      firstname: order.customerName || 'Customer',
      email: order.email || 'customer@example.com',
      phone: order.contactNo || '0000000000',
      surl: `${process.env.BACKEND_URL}/api/v1/payments/success-callback`,
      furl: `${process.env.BACKEND_URL}/api/v1/payments/failure-callback`,
      service_provider: 'payu_paisa'
    };
    
    // Generate hash
    paymentData.hash = generateHash(paymentData);
    
    // Save payment info to order
    order.payment = {
      paymentId,
      amount: amount,
      status: 'pending',
      paymentMode,
      initiatedAt: new Date()
    };
    
    await order.save();
    
    res.status(200).json({
      success: true,
      paymentData,
      orderId: order.order_id,
      amount: amount,
      webhookUrl: `${process.env.BACKEND_URL}/api/v1/payments/webhook`
    });
    
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({ order_id: orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.status(200).json({
      success: true,
      isPaid: order.isPaid || false,
      paymentStatus: order.payment?.status || 'pending',
      paymentMode: order.payment?.paymentMode,
      transactionId: order.payment?.transactionId,
      amount: order.totalAmount || order.price || 0,
      orderStatus: order.status,
      orderId: order.order_id
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};

// ========== ADDITIONAL PAYMENT APIS ==========

export const markAsPaid = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMode = 'cash', transactionId, notes } = req.body;
    
    const order = await Order.findOne({ order_id: orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update payment info
    order.payment = {
      paymentId: `MANUAL${Date.now()}`,
      transactionId,
      amount: order.totalAmount || order.price || 0,
      status: 'success',
      paymentMode,
      methodDetails: { paymentMode },
      completedAt: new Date()
    };
    
    order.isPaid = true;
    if (notes) order.notes = notes;
    
    // Update order status if it's pending
    if (order.status === 'pending' || order.status === 'confirmed') {
      order.status = 'processing';
    }
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Order marked as paid successfully',
      order: {
        orderId: order.order_id,
        isPaid: true,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Mark as paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as paid',
      error: error.message
    });
  }
};

export const initiateRefund = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { refundAmount, reason } = req.body;
    
    const order = await Order.findOne({ order_id: orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (!order.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'Order not paid yet'
      });
    }
    
    // Update payment with refund info
    order.payment.refundStatus = 'initiated';
    order.payment.refundAmount = refundAmount || (order.totalAmount || order.price);
    order.payment.refundReason = reason;
    order.status = 'refunded';
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Refund initiated',
      refundAmount: order.payment.refundAmount
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate refund',
      error: error.message
    });
  }
};
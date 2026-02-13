import crypto from 'crypto';
import { sendSMS } from '../utills/helpers.js';
import Order from '../models/orderSchema.js';
import axios from 'axios';
import querystring from 'querystring';

// ==================== UPDATED HASH FUNCTIONS ====================
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

  console.log("obj-> in has function: ",  {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email
  })
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${process.env.PAYU_SALT}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

// For callback verification (what PayU sends back)
const generateCallbackHash = (data) => {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    status,
    udf1 = '',
    udf2 = '',
    udf3 = '',
    udf4 = '',
    udf5 = '',
  } = data;


  // WORKING FORMAT: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  const hashString = `${process.env.PAYU_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    
  const hash = crypto.createHash('sha512').update(hashString).digest('hex');
  console.log("Generated callback hash:", hash);
  
  return hash;
};

// ==================== CALLBACK FUNCTIONS ====================

// PayU Success Callback - User redirected here after successful payment
export const paymentSuccessCallback = async (req, res) => {
  try {
    const paymentData = req.method === 'POST' ? req.body : req.query;

    console.log("this is the body data:: ", req.body)


    const {  key,
    txnid,
    amount,
    productinfo,
    firstname,
    email, hash } = paymentData;

    const amt = (String(amount)).split(".")[0];
    // Verify hash with correct format
    const generatedHash = generateCallbackHash({ ...paymentData, amount: amt});

    console.log("PayU Has-->> ", hash)
    console.log("Re- Gen Hash-->>", generatedHash)

    console.log("obj-> ", {  key: key.trim(),
    txnid: txnid.trim(),
    amount: amt.trim(),
    productinfo: productinfo.trim(),
    firstname: firstname.trim(),
    email: email.trim() })


    console.log("before-->> ", hash)
    console.log("after-->>", generatedHash)
    
    if (generatedHash !== paymentData.hash) {
      console.error('Hash verification failed in callback');
      console.log('Generated hash:', generatedHash.substring(0, 32) + '...');
      console.log('Received hash:', paymentData.hash?.substring(0, 32) + '...');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=failed&reason=hash_mismatch`);
    }
    
    console.log('✅ Hash verification successful');
    console.log("paymentData.txnid =>> ", paymentData.txnid)
    
    // Find order by payment ID
    const order = await Order.findOne({ 'payment.paymentId': paymentData.txnid });
    console.log("here is the order--> ", order)
    
    if (!order) {
      console.error('Order not found for payment:', paymentData.txnid);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=failed&reason=order_not_found`);
    }
    
    // Update payment status (if not already updated by webhook)
    console.log("this is the=========>>  ", order.isPaid)
    if (!order.isPaid) {
      order.payment.status = 'success';
      order.payment.transactionId = paymentData.mihpayid || paymentData.bank_ref_num;
      order.payment.methodDetails = {
        paymentMode: paymentData.mode,
        bankCode: paymentData.bankcode,
        cardLastFour: paymentData.cardnum ? paymentData.cardnum.slice(-4) : null,
        upiTransactionId: paymentData.upi_transaction_id,
        upiVpa: paymentData.upi_vpa
      };
      order.payment.gatewayResponse = paymentData;
      order.payment.completedAt = new Date();
      
      // Update order
      order.isPaid = true;
      if (order.status === 'pending' || order.status === 'confirmed') {
        order.status = 'processing';
      }
      
      await order.save();
      
      console.log(`✅ Payment successful for order ${order.order_id}`);
      
      // Send confirmation
      if (order.contactNo) {
        try {
          await sendSMS(
            order.contactNo,
            `Payment of ₹${order.totalAmount || order.price} successful. Order: ${order.order_id}, Txn: ${order.payment.transactionId}`
          );
        } catch (smsError) {
          console.error('Failed to send SMS:', smsError.message);
        }
      }
    }
    
    // Redirect to frontend with success
    const redirectUrl = `${process.env.FRONTEND_URL}/payment/status?status=success&orderId=${order.order_id}&paymentId=${paymentData.txnid}&amount=${paymentData.amount}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Payment success callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=error&message=${encodeURIComponent(error.message)}`);
  }
};

// PayU Failure Callback - User redirected here after failed payment
export const paymentFailureCallback = async (req, res) => {
  try {
    console.log("called------------------------>> paymentFailureCallback")
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
      
      console.log(`❌ Payment failed for order ${order.order_id}: ${paymentData.error_Message}`);
    }
    
    const reason = paymentData.error_Message || paymentData.error_code || 'payment_failed';
    const redirectUrl = `${process.env.FRONTEND_URL}/payment/status?status=failed&orderId=${order?.order_id || ''}&reason=${encodeURIComponent(reason)}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Payment failure callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?status=error&message=${encodeURIComponent(error.message)}`);
  }
};

// ==================== WEBHOOK FUNCTION ====================

// PayU Webhook - Server-to-server notification
export const paymentWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    console.log('PayU webhook received:', webhookData);
    
    // Verify webhook signature if available
    if (req.headers['x-payu-signature']) {
      const signature = req.headers['x-payu-signature'];
      console.log('Webhook signature:', signature);
      // Add signature verification logic here if needed
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
      addedon,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5
    } = webhookData;
    
    console.log(`Webhook for TXN: ${txnid}, Status: ${status}`);
    
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
        bankCode: bankcode,
        upiTransactionId: webhookData.upi_transaction_id,
        upiVpa: webhookData.upi_vpa
      };
      order.payment.gatewayResponse = webhookData;
      order.payment.completedAt = new Date(addedon) || new Date();
      order.payment.netAmountDebited = net_amount_debit;
      
      // Update order
      order.isPaid = true;
      if (order.status === 'pending' || order.status === 'confirmed') {
        order.status = 'processing';
      }
      
      // Update UDF fields if present
      if (udf1) order.payment.udf1 = udf1;
      if (udf2) order.payment.udf2 = udf2;
      if (udf3) order.payment.udf3 = udf3;
      
      await order.save();
      
      console.log(`✅ Webhook: Order ${order.order_id} marked as paid via webhook`);
      
      // Send notifications
      if (order.contactNo) {
        try {
          await sendSMS(
            order.contactNo,
            `Payment received for order ${order.order_id}. Amount: ₹${order.totalAmount || order.price}`
          );
        } catch (smsError) {
          console.error('Failed to send SMS:', smsError.message);
        }
      }
      
    } else if (status === 'failure' && order.payment.status !== 'success') {
      // Only update if not already successful
      order.payment.status = 'failed';
      order.payment.errorCode = error_code;
      order.payment.errorMessage = error_Message;
      order.payment.gatewayResponse = webhookData;
      order.paymentAttempts = (order.paymentAttempts || 0) + 1;
      
      await order.save();
      
      console.log(`❌ Webhook: Order ${order.order_id} payment failed: ${error_Message}`);
    } else if (status === 'pending') {
      // Payment is still pending
      order.payment.status = 'pending';
      await order.save();
      console.log(`ℹ️ Webhook: Order ${order.order_id} payment still pending`);
    }
    
    // Always return 200 to acknowledge webhook
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      orderId: order.order_id,
      paymentStatus: status
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

// ==================== PAYMENT INITIATION ====================

export const initiatePayment = async (req, res) => {
  try {
    const { orderId, paymentMode = 'upi' } = req.body;
    
    // Find order
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
    
    // Use totalAmount if available, otherwise use price
    const amount = order.totalAmount || order.price || 0;
    
    // Prepare payment data for PayU with UDF fields
    const paymentData = {
      key: process.env.PAYU_KEY,
      txnid: paymentId,
      amount: amount.toString(),
      productinfo: `Order ${order.order_id}`,
      firstname: order.customerName || 'Customer',
      email: order.email || 'customer@example.com',
      phone: order.contactNo || '0000000000',
      
      // Callback URLs
      surl: `${process.env.BACKEND_URL}/api/v1/payments/success-callback`,
      furl: `${process.env.BACKEND_URL}/api/v1/payments/failure-callback`,
      
      // UDF fields for tracking
      udf1: order.order_id,
      udf2: 'ONLINE_PAYMENT',
      udf3: paymentMode.toUpperCase(),
      udf4: '',
      udf5: '',
      
      // Additional info
      address1: order.address || '',
      city: order.city || '',
      state: order.state || '',
      country: 'India',
      zipcode: order.pincode || '',
      service_provider: 'payu_paisa'
    };
    
    // Generate hash with correct format
    paymentData.hash = generateHash(paymentData);
    
    console.log('Payment hash generated:', paymentData.hash.substring(0, 32) + '...');
    
    // Save payment info to order
    order.payment = {
      paymentId,
      amount: amount,
      status: 'pending',
      paymentMode,
      initiatedAt: new Date(),
      udf1: order.order_id,
      udf2: 'ONLINE_PAYMENT',
      udf3: paymentMode.toUpperCase()
    };
    
    await order.save();
    
    // Determine PayU URL based on environment
    const payuBaseUrl = process.env.PAYU_MODE === 'production' 
      ? 'https://secure.payu.in'
      : 'https://test.payu.in';
    
    const payuUrl = `${payuBaseUrl}/_payment`;
    
    res.status(200).json({
      success: true,
      message: 'Payment initiated successfully',
      paymentData: {
        ...paymentData,
        key: paymentData.key,
        hash: paymentData.hash,
      },
      payuUrl: payuUrl,
      orderId: order.order_id,
      amount: amount,
      webhookUrl: `${process.env.BACKEND_URL}/api/v1/payments/webhook`,
      callbackUrls: {
        success: paymentData.surl,
        failure: paymentData.furl
      }
    });
    
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message,
      debug: {
        payuKeySet: !!process.env.PAYU_KEY,
        payuSaltSet: !!process.env.PAYU_SALT,
        backendUrl: process.env.BACKEND_URL
      }
    });
  }
};

// ==================== PAYMENT STATUS CHECK ====================

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
    
    const paymentStatus = {
      isPaid: order.isPaid || false,
      paymentStatus: order.payment?.status || 'pending',
      paymentMode: order.payment?.paymentMode,
      transactionId: order.payment?.transactionId,
      amount: order.totalAmount || order.price || 0,
      orderStatus: order.status,
      orderId: order.order_id,
      paymentId: order.payment?.paymentId,
      paymentInitiatedAt: order.payment?.initiatedAt,
      paymentCompletedAt: order.payment?.completedAt
    };
    
    // If payment is pending, check if it might have been updated via webhook
    if (!order.isPaid && order.payment?.paymentId) {
      console.log(`Payment ${order.payment.paymentId} is still pending for order ${orderId}`);
    }
    
    res.status(200).json({
      success: true,
      ...paymentStatus
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

// ==================== MANUAL PAYMENT MANAGEMENT ====================

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
      transactionId: transactionId || `CASH${Date.now()}`,
      amount: order.totalAmount || order.price || 0,
      status: 'success',
      paymentMode,
      methodDetails: { 
        paymentMode,
        processedBy: req.user?.id || 'admin'
      },
      completedAt: new Date(),
      isManual: true
    };
    
    order.isPaid = true;
    if (notes) order.notes = (order.notes || '') + `\nManual payment: ${notes}`;
    
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
        status: order.status,
        paymentMode: paymentMode,
        transactionId: order.payment.transactionId
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
    order.payment.refundInitiatedAt = new Date();
    order.status = 'refund_pending';
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      refundDetails: {
        orderId: order.order_id,
        refundAmount: order.payment.refundAmount,
        reason: reason,
        originalAmount: order.totalAmount || order.price,
        status: 'initiated'
      }
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

export const autoTestPayU = async (req, res) => {
  try {
    console.log('🚀 START: Automated PayU Gateway Test');
    
    // Validate environment
    if (!process.env.PAYU_KEY || !process.env.PAYU_SALT) {
      return res.status(500).json({
        success: false,
        message: 'PayU credentials missing in .env file',
        required: ['PAYU_KEY', 'PAYU_SALT']
      });
    }
    
    const testResults = {
      startTime: new Date(),
      steps: {},
      overall: 'pending'
    };
    
    // Step 1: Environment Check
    testResults.steps.environment = {
      status: 'checking',
      details: {
        PAYU_KEY: process.env.PAYU_KEY ? `✓ (${process.env.PAYU_KEY.substring(0, 6)}...)` : '✗ Missing',
        PAYU_SALT: process.env.PAYU_SALT ? '✓ Set' : '✗ Missing',
        PAYU_MODE: process.env.PAYU_MODE || 'test',
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    };
    
    console.log('✅ Step 1: Environment check completed');
    
    // Step 2: Generate test payment data
    const testPaymentId = `AUTO_TEST_${Date.now()}`;
    const testAmount = '1.00';
    
    const paymentData = {
      key: process.env.PAYU_KEY.trim(),
      txnid: testPaymentId,
      amount: testAmount,
      productinfo: 'Test Product',
      firstname: 'Test Customer',
      email: 'mangaljeet@example.com',
      phone: '9876543210',
      surl: `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/v1/payments/auto-test/callback`,
      furl: `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/v1/payments/auto-test/callback`,
      udf1: 'AUTO_TEST_ORDER',
      udf2: 'AUTO_TEST_USER',
      udf3: 'AUTO_TEST',
      udf4: '',
      udf5: '',
      pg: 'UPI',
      address1: 'Test Address',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      zipcode: '400001',
      service_provider: 'payu_paisa'
    };
    
    // Generate hash
    paymentData.hash = generateHash(paymentData);
    
    testResults.steps.paymentData = {
      status: 'generated',
      details: {
        paymentId: testPaymentId,
        amount: testAmount,
        hashGenerated: paymentData.hash ? '✓' : '✗',
        hashLength: paymentData.hash?.length || 0
      }
    };
    
    console.log('✅ Step 2: Payment data generated');
    
    // Step 3: Test PayU endpoint connectivity
    const payuBaseUrl = process.env.PAYU_MODE === 'production' 
      ? 'https://secure.payu.in'
      : 'https://test.payu.in';
    
    const payuPaymentUrl = `${payuBaseUrl}/_payment`;
    
    let connectivityTest = { status: 'pending' };
    
    try {
      const startTime = Date.now();
      const response = await axios.head(payuBaseUrl, { timeout: 10000 });
      const endTime = Date.now();
      
      connectivityTest = {
        status: 'success',
        details: {
          url: payuBaseUrl,
          responseTime: `${endTime - startTime}ms`,
          statusCode: response.status,
          accessible: true
        }
      };
      console.log('✅ Step 3: PayU endpoint is reachable');
    } catch (error) {
      connectivityTest = {
        status: 'failed',
        details: {
          url: payuBaseUrl,
          error: error.message,
          code: error.code,
          accessible: false
        }
      };
      console.log('❌ Step 3: PayU endpoint not reachable');
    }
    
    testResults.steps.connectivity = connectivityTest;
    
    // Step 4: Try to initiate payment (simulate API call)
    let paymentInitiation = { status: 'pending' };
    
    try {
      console.log('🔄 Step 4: Testing payment initiation...');
      
      // Make actual request to PayU
      const formData = querystring.stringify(paymentData);
      
      const paymentResponse = await axios.post(payuPaymentUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html',
          'User-Agent': 'AutoTest/1.0'
        },
        timeout: 15000,
        maxRedirects: 0, // Don't follow redirects
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept success and redirect
        }
      });
      
      paymentInitiation = {
        status: 'success',
        details: {
          payuResponseCode: paymentResponse.status,
          responseType: typeof paymentResponse.data,
          dataLength: paymentResponse.data?.length || 0,
          isRedirect: paymentResponse.status >= 300 && paymentResponse.status < 400,
          redirectLocation: paymentResponse.headers?.location || null
        }
      };
      
      console.log('✅ Step 4: Payment initiation successful');
      
      // Check if we got a valid response
      if (paymentResponse.status === 200 && paymentResponse.data) {
        // Check for common PayU responses
        if (typeof paymentResponse.data === 'string') {
          if (paymentResponse.data.includes('hash') && paymentResponse.data.includes('error')) {
            paymentInitiation.details.hasHashError = true;
            paymentInitiation.details.errorDetected = 'Hash validation error detected';
          } else if (paymentResponse.data.includes('success') || paymentResponse.data.includes('redirect')) {
            paymentInitiation.details.isValidResponse = true;
          }
        }
      }
      
    } catch (error) {
      paymentInitiation = {
        status: 'failed',
        details: {
          error: error.message,
          code: error.code,
          responseStatus: error.response?.status,
          responseData: error.response?.data
        }
      };
      console.log('❌ Step 4: Payment initiation failed');
    }
    
    testResults.steps.paymentInitiation = paymentInitiation;
    
    // Step 5: Hash validation test
    let hashTest = { status: 'pending' };
    
    try {
      // Create a known test case to verify hash calculation
      const knownTestData = {
        key: 'FyUrKB',
        txnid: 'TEST1770723855564',
        amount: '1.00',
        productinfo: 'Test Product',
        firstname: 'Test Customer',
        email: 'test@example.com',
        udf1: 'TEST_ORDER_123',
        udf2: 'TEST_RIDER',
        udf3: 'TEST_PAYMENT',
        udf4: '',
        udf5: ''
      };
      
      const salt = '4GccXBMEtKYZQD7KRmJ8uYDRZkLkAk19';
      const expectedHash = '1311cad5e80fb11acc903f23f98cc8f3411e84cde84625c466bf99b0fe4abca9502225fff31279ab428c3f0046b7baf2135304b3e7cdf4adf821586b4372b9f5';
      
      const testHash = generateHash({
        ...knownTestData,
        // Override salt for test
      });
      
      // Temporarily override salt for test
      const originalSalt = process.env.PAYU_SALT;
      process.env.PAYU_SALT = salt;
      const calculatedHash = generateHash(knownTestData);
      process.env.PAYU_SALT = originalSalt;
      
      hashTest = {
        status: calculatedHash === expectedHash ? 'success' : 'failed',
        details: {
          hashMatch: calculatedHash === expectedHash,
          expectedFirst10: expectedHash.substring(0, 10),
          calculatedFirst10: calculatedHash.substring(0, 10),
          isCorrectFormat: calculatedHash.length === 128 // SHA512 hex length
        }
      };
      
      console.log(`✅ Step 5: Hash calculation ${hashTest.status}`);
      
    } catch (error) {
      hashTest = {
        status: 'failed',
        details: {
          error: error.message
        }
      };
      console.log('❌ Step 5: Hash test failed');
    }
    
    testResults.steps.hashValidation = hashTest;
    
    // Step 6: Overall assessment
    const endTime = new Date();
    const timeTaken = endTime - testResults.startTime;
    
    // Determine overall status
    const allSteps = [
      testResults.steps.environment,
      testResults.steps.connectivity,
      testResults.steps.paymentInitiation,
      testResults.steps.hashValidation
    ];
    
    const failedSteps = allSteps.filter(step => step.status === 'failed');
    const successSteps = allSteps.filter(step => step.status === 'success');
    
    testResults.overall = failedSteps.length === 0 ? 'SUCCESS' : 'FAILED';
    testResults.endTime = endTime;
    testResults.timeTaken = `${timeTaken}ms`;
    testResults.summary = {
      totalSteps: allSteps.length,
      successful: successSteps.length,
      failed: failedSteps.length,
      pending: allSteps.filter(step => step.status === 'pending').length
    };
    
    console.log(`\n🎯 TEST COMPLETE: ${testResults.overall}`);
    console.log(`⏱️  Time taken: ${timeTaken}ms`);
    console.log(`📊 Results: ${successSteps.length} successful, ${failedSteps.length} failed`);
    
    // Prepare final response
    const responsePayload = {
      success: testResults.overall === 'SUCCESS',
      message: testResults.overall === 'SUCCESS' 
        ? '🎉 PayU Gateway Test PASSED! All systems working correctly.'
        : '❌ PayU Gateway Test FAILED! Check the failed steps below.',
      
      testResults: testResults,
      
      // Quick status indicators
      quickStatus: {
        environment: testResults.steps.environment.status === 'checking' ? '✓' : '✗',
        connectivity: testResults.steps.connectivity.status === 'success' ? '✓' : '✗',
        paymentInit: testResults.steps.paymentInitiation.status === 'success' ? '✓' : '✗',
        hashCalc: testResults.steps.hashValidation.status === 'success' ? '✓' : '✗'
      },
      
      // Recommendations
      recommendations: testResults.overall === 'SUCCESS' ? [
        '✅ All PayU integration tests passed successfully',
        '✅ Gateway is accessible and responding',
        '✅ Hash calculation is correct',
        '✅ Payment initiation works',
        '🚀 Ready for production use!'
      ] : [
        '🔧 Check PAYU_KEY and PAYU_SALT in .env file',
        '🌐 Verify network connectivity to test.payu.in',
        '🔑 Ensure test credentials are valid',
        '📞 Contact PayU support if issues persist'
      ],
      
      // Next steps
      nextSteps: testResults.overall === 'SUCCESS' 
        ? 'You can now proceed with actual payment integration.'
        : 'Fix the issues above before proceeding.',
      
      timestamp: new Date().toISOString()
    };
    
    res.status(testResults.overall === 'SUCCESS' ? 200 : 400).json(responsePayload);
    
  } catch (error) {
    console.error('🔥 Automated test crashed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Automated test crashed unexpectedly',
      // error: error.message,
      // stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
};
import Order from '../models/orderSchema.js';
import crypto from 'crypto';
import axios from 'axios';
import { sendSMS } from '../utills/helpers.js';
import querystring from 'querystring';

// ==================== HELPER FUNCTIONS ====================

// Generate PayU hash for DYNAMIC QR
const generateQRHash = (data) => {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1 = '',
    udf2 = '',
    udf3 = '',
    udf4 = '',
    udf5 = ''
  } = data;
  
  const clean = (val) => {
    if (val === null || val === undefined) return '';
    return String(val).trim();
  };
  
  const hashString = [
    clean(key),
    clean(txnid),
    clean(amount),
    clean(productinfo),
    clean(firstname),
    clean(email),
    clean(udf1),
    clean(udf2),
    clean(udf3),
    clean(udf4),
    clean(udf5),
    '', '', '', '', '', // 5 empty fields
    clean(process.env.PAYU_SALT)
  ].join('|');
  
  console.log('=== QR HASH DEBUG ===');
  console.log('Hash String:', hashString);
  console.log('=====================');
  
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

// Test hash calculation
const testHashCalculation = () => {
  const testData = {
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
  
  const hashString = [
    testData.key,
    testData.txnid,
    testData.amount,
    testData.productinfo,
    testData.firstname,
    testData.email,
    testData.udf1,
    testData.udf2,
    testData.udf3,
    testData.udf4,
    testData.udf5,
    '', '', '', '', '',
    salt
  ].join('|');
  
  const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  return calculatedHash === expectedHash;
};

// ==================== MAIN QR GENERATION FUNCTION ====================

export const generatePayUQR = async (req, res) => {
  try {
    console.log('=== START: PayU Dynamic QR Generation ===');
    
    const { orderId } = req.params;
    const { riderId, riderName, deviceInfo = {}, clientIp = req.ip } = req.body;
    
    console.log('Order ID:', orderId);
    console.log('Rider ID:', riderId);
    
    // Test hash calculation
    console.log('Testing hash calculation...');
    const hashTest = testHashCalculation();
    if (!hashTest) {
      console.error('❌ Hash calculation test failed!');
      return res.status(500).json({
        success: false,
        message: 'Hash calculation error'
      });
    }
    console.log('✅ Hash calculation test passed');
    
    // Validate environment
    if (!process.env.PAYU_KEY || !process.env.PAYU_SALT) {
      return res.status(500).json({
        success: false,
        message: 'PayU configuration missing'
      });
    }
    
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
    
    // Generate transaction ID
    const qrTxnId = `QR${Date.now()}${Math.floor(Math.random() * 1000)}`;
    console.log('Generated TXN ID:', qrTxnId);
    
    const amount = parseFloat(order.totalAmount || order.price || 0);
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    // ===== CRITICAL: Use PayU's API endpoint for Dynamic QR =====
    const payuQRParams = {
      // Basic parameters
      key: process.env.PAYU_KEY.trim(),
      txnid: qrTxnId,
      amount: amount.toFixed(2),
      productinfo: `Order ${order.order_id}`.substring(0, 100),
      firstname: (order.customerName || 'Customer').replace(/[^a-zA-Z\s]/g, '').substring(0, 60),
      email: (order.email || `customer${Date.now()}@example.com`).substring(0, 50),
      phone: (order.contactNo || '9999999999').substring(0, 10),
      
      // CRITICAL: Use these parameters for QR
      pg: 'UPI',                    // Payment gateway
      bankcode: 'UPI',              // For UPI QR
      
      // Callback URLs
      surl: `${process.env.BACKEND_URL}/api/v1/qr/payu-callback`,
      furl: `${process.env.BACKEND_URL}/api/v1/qr/payu-callback`,
      
      // UDF fields
      udf1: (order.order_id || '').substring(0, 255),
      udf2: (riderId || 'RIDER').substring(0, 255),
      udf3: 'QR_PAYMENT',
      udf4: '',
      udf5: '',
      
      // QR specific - IMPORTANT for API mode
      qr_code: 'yes',
      
      // Optional
      address1: (order.address || '').substring(0, 100),
      city: '',
      state: '',
      country: 'India',
      zipcode: ''
    };
    
    // Generate hash
    payuQRParams.hash = generateQRHash(payuQRParams);
    
    console.log('=== Request Parameters ===');
    console.log('TXN ID:', payuQRParams.txnid);
    console.log('Amount:', payuQRParams.amount);
    console.log('PG:', payuQRParams.pg);
    console.log('Bankcode:', payuQRParams.bankcode);
    console.log('Generated Hash (first 32):', payuQRParams.hash?.substring(0, 32) + '...');
    console.log('==========================');
    
    // ===== METHOD 1: Try PayU's POST service API =====
    const payuBaseUrl = process.env.PAYU_MODE === 'production' 
      ? 'https://secure.payu.in'
      : 'https://test.payu.in';
    
    // Try the API endpoint first
    const apiUrl = `${payuBaseUrl}/merchant/postservice?form=2`;
    
    console.log('Using PayU API URL:', apiUrl);
    
    // Prepare API request
    const apiParams = {
      key: process.env.PAYU_KEY.trim(),
      command: 'initiateTransaction',
      var1: JSON.stringify({
        amount: amount.toFixed(2),
        txnid: qrTxnId,
        productinfo: `Order ${order.order_id}`,
        firstname: order.customerName || 'Customer',
        email: order.email || `customer${Date.now()}@example.com`,
        phone: order.contactNo || '9999999999',
        surl: `${process.env.BACKEND_URL}/api/v1/qr/payu-callback`,
        furl: `${process.env.BACKEND_URL}/api/v1/qr/payu-callback`,
        pg: 'UPI',
        bankcode: 'UPI',
        udf1: order.order_id,
        udf2: riderId || 'RIDER',
        udf3: 'QR_PAYMENT',
        qr_code: 'yes'
      })
    };
    
    // Generate hash for API request
    const apiHashString = [
      apiParams.key,
      apiParams.command,
      apiParams.var1,
      process.env.PAYU_SALT
    ].join('|');
    
    apiParams.hash = crypto.createHash('sha512').update(apiHashString).digest('hex');
    
    console.log('API Hash String:', apiHashString);
    console.log('API Hash:', apiParams.hash.substring(0, 32) + '...');
    
    let qrResponse = null;
    
    try {
      console.log('Making API request to PayU...');
      const apiResponse = await axios.post(apiUrl, querystring.stringify(apiParams), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      });
      
      console.log('API Response Status:', apiResponse.status);
      console.log('API Response Data:', apiResponse.data);
      
      qrResponse = apiResponse.data;
      
    } catch (apiError) {
      console.error('API method failed:', apiError.message);
      
      // ===== METHOD 2: Fallback to standard payment flow =====
      console.log('Trying standard payment flow...');
      
      try {
        const standardUrl = `${payuBaseUrl}/_payment`;
        const formData = querystring.stringify(payuQRParams);
        
        const standardResponse = await axios.post(standardUrl, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml',
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 30000,
          maxRedirects: 5,
          validateStatus: (status) => status < 400 // Allow redirects
        });
        
        console.log('Standard Response Status:', standardResponse);
        
        // Parse HTML response for QR
        if (standardResponse.data && typeof standardResponse.data === 'string') {
          // Extract QR from HTML
          const qrRegex = /"qr_code":"([^"]+)"/;
          const qrMatch = standardResponse.data.match(qrRegex);
          
          if (qrMatch && qrMatch[1]) {
            qrResponse = {
              status: 1,
              qr_code: qrMatch[1],
              message: 'QR generated via HTML response'
            };
          }
        }
        
      } catch (standardError) {
        console.error('Standard method failed:', standardError.message);
      }
    }
    
    // ===== METHOD 3: Generate QR locally as fallback =====
    let qrCode = null;
    let qrImageUrl = null;
    
    if (qrResponse && qrResponse.status === 1 && qrResponse.qr_code) {
      // Success from PayU API
      qrCode = qrResponse.qr_code;
      console.log('✅ Got QR code from PayU API');
      
    } else if (qrResponse && qrResponse.qrString) {
      // Alternative response format
      qrCode = qrResponse.qrString;
      console.log('✅ Got QR string from PayU');
      
    } else {
      // Generate local UPI QR string
      console.log('⚠️ Using local QR generation as fallback');
      
      const upiId = 'drydash@payu'; // Your PayU UPI ID
      const upiString = `upi://pay?pa=${upiId}&pn=DryDash&am=${amount}&tn=${qrTxnId}&cu=INR`;
      
      qrCode = upiString;
      qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
      
      console.log('Generated UPI String:', upiString);
    }
    
    // Create QR payment record
    const qrPayment = {
      qrId: qrTxnId,
      payuPaymentId: qrTxnId,
      qrString: qrCode,
      qrImageUrl: qrImageUrl,
      status: 'generated',
      amount: amount,
      generatedBy: riderId,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1800000), // 30 minutes
      payuRequest: {
        ...payuQRParams,
        key: '[REDACTED]',
        hash: '[REDACTED]'
      },
      payuResponse: qrResponse
    };
    
    if (!order.qrPayments) order.qrPayments = [];
    order.qrPayments.push(qrPayment);
    await order.save();
    
    console.log('✅ QR payment record saved');
    
    // ===== PREPARE RESPONSE =====
    const responseData = {
      success: true,
      message: 'QR generated successfully',
      qrData: {
        qrId: qrTxnId,
        amount: amount,
        currency: 'INR',
        orderId: order.order_id,
        customerName: order.customerName,
        expiresAt: qrPayment.expiresAt,
        status: 'generated',
        timestamp: new Date().toISOString()
      }
    };
    
    // Add QR code data based on what we have
    if (qrCode && qrCode.startsWith('upi://')) {
      // UPI string
      responseData.qrData.upiString = qrCode;
      responseData.qrData.qrImageUrl = qrImageUrl || 
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`;
      responseData.qrData.instructions = 'Scan this QR with any UPI app';
      
    } else if (qrCode && qrCode.length > 100) {
      // Likely a base64 QR image
      responseData.qrData.qrCode = qrCode;
      responseData.qrData.qrType = 'base64';
      responseData.qrData.instructions = 'Display this base64 image as QR';
      
    } else if (qrCode) {
      // Other QR string
      responseData.qrData.qrString = qrCode;
      responseData.qrData.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`;
      responseData.qrData.instructions = 'Use this string to generate QR';
    }
    
    // Add PayU transaction details
    responseData.qrData.payuDetails = {
      txnid: qrTxnId,
      merchantKey: process.env.PAYU_KEY.substring(0, 6) + '...',
      mode: process.env.PAYU_MODE || 'test'
    };
    
    // Add payment instructions
    responseData.qrData.paymentInstructions = [
      '1. Open any UPI app (GPay, PhonePe, Paytm, etc.)',
      '2. Tap on "Scan QR Code"',
      '3. Scan the QR code displayed',
      '4. Verify amount and complete payment',
      '5. Payment will be confirmed automatically'
    ];
    
    console.log('✅ Returning QR response');
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('❌=== PayU QR Generation FAILED ===');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
      
      // Try to extract error message
      if (error.response.data && typeof error.response.data === 'string') {
        const errorMatch = error.response.data.match(/<b>([^<]+)<\/b>/);
        if (errorMatch) {
          console.error('PayU Error:', errorMatch[1]);
        }
      }
    }
    
    console.error('==================================');
    
    // Provide helpful error message
    let userMessage = 'Failed to generate QR';
    let suggestion = '';
    
    if (error.message.includes('302')) {
      userMessage = 'PayU is redirecting. This usually means the payment gateway parameters need adjustment.';
      suggestion = 'Try using different pg/bankcode combinations or contact PayU support for Dynamic QR API access.';
    } else if (error.message.includes('hash')) {
      userMessage = 'Hash calculation error';
      suggestion = 'Verify PAYU_SALT environment variable is correct.';
    }
    
    res.status(500).json({
      success: false,
      message: userMessage,
      error: error.message,
      suggestion: suggestion,
      debug: process.env.NODE_ENV === 'development' ? {
        payuKey: process.env.PAYU_KEY ? 'Set' : 'Missing',
        payuMode: process.env.PAYU_MODE || 'test',
        timestamp: new Date().toISOString()
      } : undefined
    });
  }
};

// ==================== SIMPLE QR GENERATION (ALTERNATIVE) ====================

export const generateSimpleQR = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;
    
    console.log('Generating simple QR for order:', orderId);
    
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
    
    const amount = parseFloat(order.totalAmount || order.price || 0);
    const qrTxnId = `SQR${Date.now()}`;
    
    // Generate UPI payment string
    const upiId = 'drydash@payu'; // Replace with your actual PayU UPI ID
    const merchantName = 'DryDash';
    
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tn=${qrTxnId}&cu=INR`;
    
    // Generate QR image URL using external service
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
    
    // Save to order
    const qrPayment = {
      qrId: qrTxnId,
      qrString: upiString,
      qrImageUrl: qrImageUrl,
      status: 'generated',
      amount: amount,
      generatedBy: riderId,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1800000),
      isSimpleQR: true
    };
    
    if (!order.qrPayments) order.qrPayments = [];
    order.qrPayments.push(qrPayment);
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Simple QR generated successfully',
      qrData: {
        qrId: qrTxnId,
        upiString: upiString,
        qrImageUrl: qrImageUrl,
        amount: amount,
        currency: 'INR',
        orderId: order.order_id,
        customerName: order.customerName,
        merchantUpiId: upiId,
        merchantName: merchantName,
        expiresAt: qrPayment.expiresAt,
        status: 'generated',
        instructions: 'Scan QR with any UPI app or use UPI string for manual payment',
        paymentLink: `upi://pay?pa=${upiId}&am=${amount}&tn=Order${orderId}`
      }
    });
    
  } catch (error) {
    console.error('Simple QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate simple QR',
      error: error.message
    });
  }
};

// ==================== OTHER FUNCTIONS (UNCHANGED) ====================

export const testPayUConnection = async (req, res) => {
  try {
    console.log('=== START: PayU Connection Test ===');
    
    const hashTest = testHashCalculation();
    
    const envCheck = {
      PAYU_KEY: process.env.PAYU_KEY ? `✓ Set (${process.env.PAYU_KEY.substring(0, 6)}...)` : '✗ Missing',
      PAYU_SALT: process.env.PAYU_SALT ? '✓ Set' : '✗ Missing',
      PAYU_MODE: process.env.PAYU_MODE || 'Not set (default: test)',
      BACKEND_URL: process.env.BACKEND_URL || 'Not set',
      NODE_ENV: process.env.NODE_ENV || 'Not set'
    };
    
    console.log('Environment Check:', envCheck);
    
    // Test connectivity
    const payuUrl = process.env.PAYU_MODE === 'production' 
      ? 'https://secure.payu.in'
      : 'https://test.payu.in';
    
    let connectivityTest = '❓ Not tested';
    
    try {
      const startTime = Date.now();
      await axios.head(payuUrl, { timeout: 10000 });
      const endTime = Date.now();
      connectivityTest = `✓ Reachable (${endTime - startTime}ms)`;
    } catch (connectError) {
      connectivityTest = `✗ Failed: ${connectError.message}`;
    }
    
    const testPassed = hashTest && connectivityTest.includes('✓');
    
    res.status(testPassed ? 200 : 500).json({
      success: testPassed,
      message: testPassed ? 'PayU connection test passed' : 'PayU connection test failed',
      environment: envCheck,
      hashCalculation: hashTest ? '✓ Correct' : '✗ Incorrect',
      connectivity: connectivityTest,
      timestamp: new Date().toISOString(),
      recommendations: testPassed ? [] : [
        '1. Check PAYU_KEY and PAYU_SALT environment variables',
        '2. Verify network connectivity to PayU',
        '3. Ensure test credentials are active'
      ]
    });
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
};

export const handlePayUCallback = async (req, res) => {
  try {
    console.log('=== START: PayU Callback Received ===');
    
    const callbackData = req.method === 'POST' ? req.body : req.query;
    console.log('Callback Data:', callbackData);
    
    const txnid = callbackData.txnid;
    const status = callbackData.status;
    const orderId = callbackData.udf1 || callbackData.productinfo?.replace('Order ', '');
    
    if (!orderId) {
      return res.status(400).send('Order ID not found');
    }
    
    const order = await Order.findOne({ order_id: orderId });
    if (!order) {
      return res.status(404).send('Order not found');
    }
    
    // Update QR payment
    if (order.qrPayments && order.qrPayments.length > 0) {
      const qrPayment = order.qrPayments.find(qr => qr.qrId === txnid);
      if (qrPayment) {
        qrPayment.status = status === 'success' ? 'completed' : 'failed';
        qrPayment.completedAt = new Date();
        qrPayment.payuCallback = callbackData;
        
        if (status === 'success') {
          order.isPaid = true;
          order.paymentStatus = 'completed';
          order.paymentId = callbackData.mihpayid || txnid;
          order.paidAt = new Date();
          
          console.log(`✅ Payment successful for order ${orderId}`);
          
          // Send SMS
          if (order.contactNo) {
            try {
              await sendSMS(
                order.contactNo,
                `Payment of ₹${order.totalAmount || order.price} received for order ${order.order_id}. Thank you!`
              );
            } catch (smsError) {
              console.error('SMS failed:', smsError.message);
            }
          }
        }
      }
    }
    
    await order.save();
    
    if (req.method === 'POST') {
      res.status(200).json({
        success: true,
        message: 'Callback processed',
        orderId: orderId,
        status: status
      });
    } else {
      res.send(`
        <html>
          <head><title>Payment Status</title></head>
          <body>
            <h1>Payment ${status === 'success' ? 'Successful' : 'Failed'}</h1>
            <p>Order ID: ${orderId}</p>
            <p>Status: ${status}</p>
            <p>You can close this window.</p>
          </body>
        </html>
      `);
    }
    
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send('Internal error');
  }
};

export const checkQRStatus = async (req, res) => {
  try {
    const { qrId } = req.params;
    const order = await Order.findOne({ 'qrPayments.qrId': qrId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'QR not found'
      });
    }
    
    const qrPayment = order.qrPayments.find(qr => qr.qrId === qrId);
    
    res.status(200).json({
      success: true,
      qrStatus: {
        qrId: qrPayment.qrId,
        status: qrPayment.status,
        amount: qrPayment.amount,
        generatedAt: qrPayment.generatedAt,
        expiresAt: qrPayment.expiresAt,
        orderId: order.order_id,
        qrString: qrPayment.qrString,
        qrImageUrl: qrPayment.qrImageUrl,
        orderPaid: order.isPaid
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check QR status'
    });
  }
};

export const getQRForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ order_id: orderId });
    
    if (!order || !order.qrPayments || order.qrPayments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No QR found'
      });
    }
    
    const latestQR = order.qrPayments[order.qrPayments.length - 1];
    
    res.status(200).json({
      success: true,
      qrData: {
        qrId: latestQR.qrId,
        qrString: latestQR.qrString,
        qrImageUrl: latestQR.qrImageUrl,
        status: latestQR.status,
        amount: latestQR.amount,
        generatedAt: latestQR.generatedAt,
        expiresAt: latestQR.expiresAt,
        orderPaid: order.isPaid
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get QR'
    });
  }
};

export const cancelQR = async (req, res) => {
  try {
    const { qrId } = req.params;
    const order = await Order.findOne({ 'qrPayments.qrId': qrId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'QR not found'
      });
    }
    
    const qrPayment = order.qrPayments.find(qr => qr.qrId === qrId);
    qrPayment.status = 'cancelled';
    qrPayment.cancelledAt = new Date();
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'QR cancelled',
      qrId: qrId
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel QR'
    });
  }
};
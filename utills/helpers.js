import axios from "axios";

// SMS sending utility (using Twilio or other service)
export const sendSMS = async (phone, message) => {
  try {
    // Implement your SMS service (Twilio, MSG91, etc.)
    console.log(`SMS to ${phone}: ${message}`);
    
    // Example with Twilio:
    /*
    const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: `+91${phone}`
    });
    */
    
    return true;
  } catch (error) {
    console.error('Send SMS error:', error);
    return false;
  }
};

// Email sending utility
export const sendEmail = async (to, subject, html) => {
  try {
    // Implement your email service
    console.log(`Email to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('Send email error:', error);
    return false;
  }
};

// Generate unique ID
export const generateId = (prefix = '') => {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

// Validate phone number
export const validatePhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
};

// Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

// Calculate expiry time
export const calculateExpiryTime = (hours = 24) => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};


export const sendSmsthroughMSG91 = async (phone, otp, hash) => {
  try {
    // TEST MODE: Force specific OTP for test number
    const TEST_PHONE = '8518062933';
    const TEST_OTP = '654321';
   
    if (phone === TEST_PHONE) {
      otp = TEST_OTP;
      console.log(`🧪 TEST MODE: Forcing OTP ${otp} for ${phone}`);
    }
   
    const authKey = '493629AuSjxCEOg69ae9683P1';
    const templateId = '69d6332e06c866bb220b5c82';
    const apiUrl = 'https://control.msg91.com/api/v5/flow';
   
    const payload = {
      template_id: templateId,
      short_url: "0",
      recipients: [
        {
          mobiles: `91${phone}`,
          var1: otp,  
          var2: "5",  
          var3: hash
        }
      ]
    };
   
    // Configure headers
    const headers = {
      'Content-Type': 'application/json',
      'authkey': authKey,
      'Accept': 'application/json'
    };
   
    // Make API request to MSG91
    const response = await axios.post(apiUrl, payload, { headers });
   
    console.log('MSG91 API Response:', response.data);
   
    // Check if message was sent successfully
    if (response.data && response.data.type === 'success') {
      console.log(`OTP sent successfully to ${phone}`);
      return true;
    } else {
      console.log('Failed to send OTP:', response.data);
      return false;
    }
   
  } catch (error) {
    console.log('Error in MSG91 service:', error.response ? error.response.data : error.message);
    return false;
  }
};
 
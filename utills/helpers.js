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



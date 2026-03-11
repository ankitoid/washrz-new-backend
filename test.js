import axios from 'axios'
import crypto from 'crypto'
import querystring from 'querystring'

// Test credentials
const PAYU_KEY = 'FyUrKB'
const PAYU_SALT = '4GccXBMEtKYZQD7KRmJ8uYDRZkLkAk19'

// Generate hash
const generateHash = (params) => {
  const hashString = [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 || '',
    params.udf2 || '',
    params.udf3 || '',
    params.udf4 || '',
    params.udf5 || '',
    '', '', '', '', '',
    PAYU_SALT
  ].join('|');
  
  console.log('Hash String:', hashString);
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

// Test parameters
const testParams = {
  key: PAYU_KEY,
  txnid: 'TEST' + Date.now(),
  amount: '100.00',
  productinfo: 'Test Product',
  firstname: 'Test',
  email: 'test@example.com',
  phone: '9876543210',
  pg: 'DBQR',
  bankcode: 'UPIDBQR',
  surl: 'https://your-callback.com/success',
  furl: 'https://your-callback.com/failure',
  s2s_client_ip: '192.168.1.1',
  s2s_device_info: 'Test/1.0',
  txn_s2s_flow: '4',
  expiry_time: '300',
  udf1: 'TEST1',
  udf2: 'TEST2',
  udf3: 'TEST3'
};

// Add hash
testParams.hash = generateHash(testParams);

console.log('Test Parameters:', testParams);

// Make request
axios.post('https://test.payu.in/_payment', querystring.stringify(testParams), {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json'
  },
  timeout: 30000
})
.then(response => {
  console.log('Success! Response:', response.data);
})
.catch(error => {
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Headers:', error.response.headers);
    console.error('Data:', error.response.data);
  }
});
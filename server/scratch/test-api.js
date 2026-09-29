// Quick test: reproduce the 500 error and capture the actual exception
const http = require('http');

const postData = JSON.stringify({ role: 'CTO', adminId: 'LEGATRIXON20', password: 'test' });

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/founder-security/admin-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(postData);
req.end();

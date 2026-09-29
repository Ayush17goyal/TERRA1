const http = require('http');

console.log('Testing GET http://localhost:4000/api/v1/contracts/active...');

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/contracts/active',
  method: 'GET'
}, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', JSON.stringify(res.headers));
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('BODY:', body);
  });
});

req.on('error', (e) => {
  console.error('Problem with request:', e.message);
});

req.end();

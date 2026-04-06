const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/playback/play',
  method: 'POST',
  headers: {
    'X-Admin-Password': 'admin123'
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();

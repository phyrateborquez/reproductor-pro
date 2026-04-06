const http = require('http');

const data = JSON.stringify({
  title: "Video de Prueba - Birds",
  source_url: "https://www.youtube.com/embed/y6120QOlsfU",
  source_type: "youtube",
  duration: 233
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/playlist',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
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

req.write(data);
req.end();

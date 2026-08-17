const http = require('http');

const payload = JSON.stringify({
  messages: [
    {
      content: 'hola',
      role: 'user'
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE:');
    console.log(data.substring(0, 500));
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

console.log('Sending:', payload);
req.write(payload);
req.end();

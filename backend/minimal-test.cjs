const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Request received:', req.method, req.url);
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
});

server.listen(3008, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    return;
  }
  console.log('Server running at http://localhost:3008/');
});

console.log('Starting minimal test server...');
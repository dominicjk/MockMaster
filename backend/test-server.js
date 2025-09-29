// Very simple test server
import http from 'http';

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  
  res.end(JSON.stringify({ message: 'Server is working', status: 'ok' }));
});

server.listen(3002, () => {
  console.log('🎯 Test server running on http://localhost:3002');
});

server.on('error', (error) => {
  console.error('Server error:', error);
});
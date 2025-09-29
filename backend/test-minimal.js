// Minimal server test
import http from 'http';

const PORT = 3008;

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Server is working!', url: req.url }));
});

server.listen(PORT, () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
});

// Add error handling
server.on('error', (err) => {
  console.error('Server error:', err);
});
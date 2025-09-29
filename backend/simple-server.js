// Simple server for testing authentication - uses only built-in Node.js modules
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3006;
const JWT_SECRET = 'your-secret-key';

// Simple in-memory storage
const users = new Map();
const sessions = new Map();

// Helper functions
function generateToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [payload, signature] = token.split('.');
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64');
    if (signature !== expectedSignature) return null;
    
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    if (Date.now() > data.exp) return null;
    
    return data;
  } catch (error) {
    return null;
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        console.log('📨 Raw body received:', body);
        const parsed = JSON.parse(body);
        console.log('📋 Parsed body:', parsed);
        resolve(parsed);
      } catch (error) {
        console.error('❌ JSON parse error:', error.message);
        console.error('❌ Raw body was:', body);
        resolve({});
      }
    });
  });
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:4321',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true'
  });
  res.end(JSON.stringify(data));
}

// Server
const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    console.log(`${method} ${pathname}`);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': 'http://localhost:4321',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end();
      return;
    }

  // Auth routes
  if (pathname === '/auth/signup' && method === 'POST') {
    const body = await parseBody(req);
    console.log('📝 Signup request received:', body);
    const { name, email } = body;
    
    if (!name || !email) {
      console.log('❌ Missing required fields:', { name: !!name, email: !!email });
      return sendJSON(res, { message: 'Missing required fields', received: Object.keys(body) }, 400);
    }

    if (users.has(email)) {
      console.log('❌ User already exists:', email);
      return sendJSON(res, { message: 'User already exists' }, 400);
    }

    const userId = crypto.randomUUID();
    users.set(email, { id: userId, name, email, verified: true }); // Skip email verification for testing
    console.log('✅ User created successfully:', { id: userId, name, email });
    
    const token = generateToken(userId);
    res.setHeader('Set-Cookie', `auth_token=${token}; HttpOnly; Path=/; Max-Age=86400`);
    
    sendJSON(res, { message: 'User created successfully', user: { id: userId, name, email } });
  }
  
  else if (pathname === '/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password } = body;
    
    const user = users.get(email);
    if (!user || user.password !== password) {
      return sendJSON(res, { message: 'Invalid credentials' }, 401);
    }

    const token = generateToken(user.id);
    res.setHeader('Set-Cookie', `auth_token=${token}; HttpOnly; Path=/; Max-Age=86400`);
    
    sendJSON(res, { message: 'Login successful', user: { id: user.id, name: user.name, email: user.email } });
  }
  
  else if (pathname === '/auth/status' && method === 'GET') {
    const cookies = req.headers.cookie;
    let token = null;
    if (cookies) {
      const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }

    const tokenData = verifyToken(token);
    if (!tokenData) {
      return sendJSON(res, { authenticated: false }, 401);
    }

    const user = [...users.values()].find(u => u.id === tokenData.userId);
    if (!user) {
      return sendJSON(res, { authenticated: false }, 401);
    }

    sendJSON(res, { 
      authenticated: true, 
      user: { id: user.id, name: user.name, email: user.email } 
    });
  }
  
  else if (pathname === '/auth/me' && method === 'GET') {
    const cookies = req.headers.cookie;
    let token = null;
    if (cookies) {
      const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }

    const tokenData = verifyToken(token);
    if (!tokenData) {
      return sendJSON(res, { authenticated: false }, 401);
    }

    const user = [...users.values()].find(u => u.id === tokenData.userId);
    if (!user) {
      return sendJSON(res, { authenticated: false }, 401);
    }

    sendJSON(res, { 
      id: user.id, 
      name: user.name, 
      email: user.email,
      verified: user.verified || true
    });
  }
  
  else if (pathname === '/auth/logout' && method === 'POST') {
    res.setHeader('Set-Cookie', 'auth_token=; HttpOnly; Path=/; Max-Age=0');
    sendJSON(res, { message: 'Logged out successfully' });
  }

  // Protected routes (require authentication)
  else if (pathname.startsWith('/api/')) {
    const cookies = req.headers.cookie;
    let token = null;
    if (cookies) {
      const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }

    const tokenData = verifyToken(token);
    if (!tokenData) {
      return sendJSON(res, { message: 'Unauthorized' }, 401);
    }

    // Mock API responses
    if (pathname === '/api/topics' && method === 'GET') {
      sendJSON(res, { 
        topics: ['algebra', 'geometry', 'trigonometry', 'calculus'] 
      });
    } else if (pathname === '/api/topics/questions' && method === 'POST') {
      sendJSON(res, { 
        questions: [
          { id: '1', name: 'Sample Question 1', topic: 'algebra', difficulty: 'easy' },
          { id: '2', name: 'Sample Question 2', topic: 'geometry', difficulty: 'medium' }
        ]
      });
    } else {
      sendJSON(res, { message: 'API endpoint not found' }, 404);
    }
  }
  
  else {
    sendJSON(res, { message: 'Not found' }, 404);
  }
  
  } catch (error) {
    console.error('Server error:', error);
    sendJSON(res, { message: 'Internal server error' }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Simple auth server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /auth/signup - Create account');
  console.log('  POST /auth/login - Login');
  console.log('  GET  /auth/status - Check auth status');
  console.log('  POST /auth/logout - Logout');
  console.log('  GET  /api/topics - Get topics (protected)');
  console.log('  POST /api/topics/questions - Get questions (protected)');
});
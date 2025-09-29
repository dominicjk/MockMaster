// Ultra-simple authentication server - no async issues
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = 3008;
const JWT_SECRET = 'your-secret-key-change-in-production';

// In-memory storage
const users = new Map();

// Load questions data
let questionsData = [];
try {
  const questionsPath = path.join(__dirname, 'data', 'questions.json');
  const questionsContent = fs.readFileSync(questionsPath, 'utf8');
  questionsData = JSON.parse(questionsContent);
  console.log(`📚 Loaded ${questionsData.length} questions from database`);
} catch (error) {
  console.warn('⚠️  Could not load questions data:', error.message);
}

console.log('🔄 Starting simple auth server...');

// Helper functions
function generateToken(userId) {
  const payload = Buffer.from(JSON.stringify({ 
    userId, 
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  })).toString('base64');
  
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(payload)
    .digest('base64');
    
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [payload, signature] = token.split('.');
    
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET)
      .update(payload)
      .digest('base64');
      
    if (signature !== expectedSignature) {
      return null;
    }
    
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    if (data.exp < Date.now()) {
      return null;
    }
    
    return data;
  } catch (error) {
    return null;
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:4321',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  });
  res.end(JSON.stringify(data));
}

function generateUserId() {
  return crypto.randomBytes(16).toString('hex');
}

const server = http.createServer((req, res) => {
  console.log(`📝 ${req.method} ${req.url}`);
  
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': 'http://localhost:4321',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Handle GET requests immediately
    if (method === 'GET') {
      if (pathname === '/') {
        return sendJSON(res, { 
          message: 'Simple Auth Server',
          version: '1.0.0',
          status: 'running',
          endpoints: [
            'POST /auth/signup',
            'POST /auth/login', 
            'POST /auth/logout',
            'GET  /auth/status',
            'GET  /auth/me',
            'GET  /api/topics',
            'GET  /api/topics/questions',
            'GET  /api/questions',
            'GET  /questions/* (static files)'
          ]
        });
      }
      
      if (pathname === '/auth/status') {
        const cookies = req.headers.cookie || '';
        const authMatch = cookies.match(/auth_token=([^;]+)/);
        const token = authMatch ? authMatch[1] : null;

        if (!token) {
          return sendJSON(res, { authenticated: false });
        }

        const tokenData = verifyToken(token);
        if (!tokenData) {
          return sendJSON(res, { authenticated: false });
        }

        const user = users.get(tokenData.userId);
        if (!user) {
          return sendJSON(res, { authenticated: false });
        }

        return sendJSON(res, { 
          authenticated: true, 
          user: { id: user.id, username: user.username, email: user.email } 
        });
      }

      if (pathname === '/auth/me') {
        const cookies = req.headers.cookie || '';
        const authMatch = cookies.match(/auth_token=([^;]+)/);
        const token = authMatch ? authMatch[1] : null;

        if (!token) {
          return sendJSON(res, { message: 'Not authenticated' }, 401);
        }

        const tokenData = verifyToken(token);
        if (!tokenData) {
          return sendJSON(res, { message: 'Invalid token' }, 401);
        }

        const user = users.get(tokenData.userId);
        if (!user) {
          return sendJSON(res, { message: 'User not found' }, 404);
        }

        return sendJSON(res, { 
          user: { id: user.id, username: user.username, email: user.email } 
        });
      }

      // API: Get topics
      if (pathname === '/api/topics') {
        const topics = [...new Set(questionsData.map(q => q.topic))].sort();
        return sendJSON(res, topics);
      }

      // API: Get questions by topic
      if (pathname === '/api/topics/questions') {
        const { topic } = parsedUrl.query;
        let filteredQuestions = questionsData;
        
        if (topic) {
          filteredQuestions = questionsData.filter(q => q.topic === topic);
        }
        
        return sendJSON(res, filteredQuestions);
      }

      // API: Get questions (with filtering)
      if (pathname === '/api/questions') {
        const { id, topic, difficulty, limit } = parsedUrl.query;
        let filteredQuestions = questionsData;
        
        if (id) {
          filteredQuestions = questionsData.filter(q => q.id === id);
        } else {
          if (topic) {
            filteredQuestions = filteredQuestions.filter(q => q.topic === topic);
          }
          if (difficulty) {
            filteredQuestions = filteredQuestions.filter(q => q.difficulty === parseInt(difficulty));
          }
          if (limit) {
            filteredQuestions = filteredQuestions.slice(0, parseInt(limit));
          }
        }
        
        return sendJSON(res, filteredQuestions);
      }

      // Serve static files from public/questions directory
      if (pathname.startsWith('/questions/')) {
        const filePath = path.join(__dirname, 'public', pathname);
        
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          let contentType = 'application/octet-stream';
          
          switch (ext) {
            case '.png': contentType = 'image/png'; break;
            case '.jpg': case '.jpeg': contentType = 'image/jpeg'; break;
            case '.gif': contentType = 'image/gif'; break;
            case '.tif': case '.tiff': contentType = 'image/tiff'; break;
            case '.pdf': contentType = 'application/pdf'; break;
          }
          
          try {
            const fileContent = fs.readFileSync(filePath);
            res.writeHead(200, {
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': 'http://localhost:4321',
              'Access-Control-Allow-Credentials': 'true'
            });
            res.end(fileContent);
            return;
          } catch (error) {
            console.error('Error serving file:', error);
          }
        }
        
        // File not found
        res.writeHead(404, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:4321',
          'Access-Control-Allow-Credentials': 'true'
        });
        res.end(JSON.stringify({ message: 'File not found' }));
        return;
      }

      if (pathname === '/debug/users') {
        const userList = [...users.values()].map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          createdAt: u.createdAt
        }));
        return sendJSON(res, { users: userList, count: userList.length });
      }

      return sendJSON(res, { message: 'Not found' }, 404);
    }

    // Handle POST requests
    if (method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {};
          
          if (pathname === '/auth/signup') {
            console.log('🔐 Signup request:', { username: data.username, email: data.email });
            
            const { username, email, password } = data;

            if (!username || !email || !password) {
              return sendJSON(res, { message: 'Username, email, and password are required' }, 400);
            }

            // Check if user already exists
            const existingUser = [...users.values()].find(u => u.email === email || u.username === username);
            if (existingUser) {
              return sendJSON(res, { message: 'User with this email or username already exists' }, 400);
            }

            // Create new user
            const userId = generateUserId();
            const hashedPassword = hashPassword(password);
            
            const user = {
              id: userId,
              username,
              email,
              password: hashedPassword,
              createdAt: new Date().toISOString()
            };

            users.set(userId, user);

            // Generate token and set cookie
            const token = generateToken(userId);
            res.writeHead(201, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:4321',
              'Access-Control-Allow-Credentials': 'true',
              'Set-Cookie': `auth_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`
            });
            
            res.end(JSON.stringify({ 
              message: 'Account created successfully',
              user: { id: userId, username, email }
            }));
            
            console.log(`✅ New user created: ${username} (${email})`);
            return;
          }

          if (pathname === '/auth/login') {
            console.log('🔐 Login request:', data.emailOrUsername);
            
            const { emailOrUsername, password } = data;

            if (!emailOrUsername || !password) {
              return sendJSON(res, { message: 'Email/username and password are required' }, 400);
            }

            // Find user by email or username
            const user = [...users.values()].find(u => 
              u.email === emailOrUsername || u.username === emailOrUsername
            );

            if (!user) {
              return sendJSON(res, { message: 'Invalid credentials' }, 401);
            }

            // Check password
            const hashedPassword = hashPassword(password);
            if (user.password !== hashedPassword) {
              return sendJSON(res, { message: 'Invalid credentials' }, 401);
            }

            // Generate token and set cookie
            const token = generateToken(user.id);
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:4321',
              'Access-Control-Allow-Credentials': 'true',
              'Set-Cookie': `auth_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`
            });
            
            res.end(JSON.stringify({ 
              message: 'Login successful',
              user: { id: user.id, username: user.username, email: user.email }
            }));

            console.log(`✅ User logged in: ${user.username}`);
            return;
          }

          if (pathname === '/auth/logout') {
            console.log('🔐 Logout request');
            
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:4321',
              'Access-Control-Allow-Credentials': 'true',
              'Set-Cookie': 'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
            });
            res.end(JSON.stringify({ message: 'Logged out successfully' }));
            return;
          }

          return sendJSON(res, { message: 'Not found' }, 404);
          
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          return sendJSON(res, { message: 'Invalid JSON' }, 400);
        }
      });
      
      return; // Let the 'end' event handler take over
    }

    return sendJSON(res, { message: 'Method not allowed' }, 405);

  } catch (error) {
    console.error('❌ Request error:', error);
    return sendJSON(res, { message: 'Internal server error' }, 500);
  }
});

server.on('error', (err) => {
  console.error('❌ Server startup error:', err);
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use. Trying a different port...`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Simple auth server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /auth/signup - Create account (username, email, password)');
  console.log('  POST /auth/login - Login (emailOrUsername, password)');
  console.log('  POST /auth/logout - Logout');
  console.log('  GET  /auth/status - Check auth status');
  console.log('  GET  /auth/me - Get user info');
  console.log('  GET  /debug/users - List all users');
  console.log('\n🔐 Authentication: Username + Email + Password');
  console.log('🍪 Sessions: HTTP-only cookies with JWT tokens');
  console.log('⏰ Token expiry: 24 hours');
  console.log(`\n✅ Server is ready and listening on port ${PORT}`);
});

console.log(`🔄 Starting server on port ${PORT}...`);
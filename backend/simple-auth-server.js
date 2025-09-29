// Simple authentication server with username/email/password
import http from 'http';
import url from 'url';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3008;
const JWT_SECRET = 'your-secret-key-change-in-production';

// In-memory storage (use proper database in production)
const users = new Map();
const sessions = new Map();

// Load questions data from topic-specific JSON files
let questionsData = [];
function loadQuestionsData() {
  try {
    questionsData = [];
    const questionPairsPath = path.join(__dirname, 'src', 'data', 'question-pairs');
    console.log(`Loading questions from: ${questionPairsPath}`);
    
    if (!fs.existsSync(questionPairsPath)) {
      console.error('❌ Question-pairs directory not found:', questionPairsPath);
      return [];
    }

    const topicFiles = fs.readdirSync(questionPairsPath).filter(file => file.endsWith('.json'));
    console.log(`📁 Found ${topicFiles.length} topic files:`, topicFiles);

    const allQuestions = [];
    topicFiles.forEach(file => {
      try {
        const filePath = path.join(questionPairsPath, file);
        const data = fs.readFileSync(filePath, 'utf8');
        const topicQuestions = JSON.parse(data);
        
        // Add questions from this topic
        allQuestions.push(...topicQuestions);
        console.log(`✅ Loaded ${topicQuestions.length} questions from ${file}`);
      } catch (error) {
        console.error(`❌ Error loading ${file}:`, error);
      }
    });

    console.log(`🎯 Total questions loaded: ${allQuestions.length}`);
    return allQuestions;
  } catch (error) {
    console.error('❌ Error loading questions:', error);
    return [];
  }
}

// Initialize questions data
questionsData = loadQuestionsData();

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

const server = http.createServer(async (req, res) => {
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

    // Get request body for POST requests
    let body = '';
    if (method === 'POST') {
      for await (const chunk of req) {
        body += chunk.toString();
      }
      try {
        body = JSON.parse(body);
      } catch (error) {
        return sendJSON(res, { message: 'Invalid JSON' }, 400);
      }
    }

    // Routes
    if (pathname === '/auth/signup' && method === 'POST') {
      const { username, email, password } = body;

      if (!username || !email || !password) {
        return sendJSON(res, { message: 'Username, email, and password are required' }, 400);
      }

      // Check if user already exists
      const existingUser = [...users.values()].find(u => u.email === email || u.username === username);
      if (existingUser) {
        return sendJSON(res, { message: 'User with this email or username already exists' }, 400);
      }

      // Create new user
      const userId = crypto.randomUUID();
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
    }

    else if (pathname === '/auth/login' && method === 'POST') {
      const { emailOrUsername, password } = body;

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
    }

    else if (pathname === '/auth/logout' && method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:4321',
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie': 'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
      });
      res.end(JSON.stringify({ message: 'Logged out successfully' }));
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

      if (!token) {
        return sendJSON(res, { authenticated: false });
      }

      const tokenData = verifyToken(token);
      if (!tokenData) {
        return sendJSON(res, { authenticated: false }, 401);
      }

      const user = users.get(tokenData.userId);
      if (!user) {
        return sendJSON(res, { authenticated: false }, 401);
      }

      sendJSON(res, { 
        authenticated: true, 
        user: { id: user.id, username: user.username, email: user.email } 
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

      sendJSON(res, { 
        user: { id: user.id, username: user.username, email: user.email } 
      });
    }

    // Protected API routes
    else if (pathname === '/api/topics' && method === 'GET') {
      // Mock topics data
      const topics = [
        { id: 1, name: 'Algebra', description: 'Basic algebraic concepts' },
        { id: 2, name: 'Geometry', description: 'Shapes and spatial reasoning' },
        { id: 3, name: 'Calculus', description: 'Derivatives and integrals' }
      ];

      sendJSON(res, { topics });
    }

    else if (pathname === '/api/topics/questions' && method === 'POST') {
      const { topicId } = body;
      
      // Mock questions data
      const questions = [
        { id: 1, question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correct: 1 },
        { id: 2, question: 'What is 3 × 4?', options: ['10', '11', '12', '13'], correct: 2 }
      ];

      sendJSON(res, { questions });
    }

    // Questions endpoint
    // Supports two modes:
    //  1) GET /api/questions?id=<id>  (exact lookup)
    //  2) GET /api/questions?[topics=a,b&longOnly=true&shortOnly=true&count=10...] (filtered random set)
    else if (pathname === '/api/questions' && method === 'GET') {
      const {
        id: questionId,
        topics: topicsParam,
        longOnly,
        shortOnly,
        examOnly,
        yearFrom, // currently unused – placeholder for future metadata
        yearTo,   // currently unused – placeholder for future metadata
        count: countParam
      } = parsedUrl.query;

      // Helper: normalize topic on each question to array for filtering
      function getQuestionTopics(q) {
        if (Array.isArray(q.topic)) return q.topic;
        if (typeof q.topic === 'string') return [q.topic];
        return [];
      }

      // Helper: enrich question (ensure name + consistent fields)
      function enrich(q) {
        const normalizePath = (p) => {
          if (!p || typeof p !== 'string') return p;
          if (p.startsWith('http')) return p; // already absolute
          // ensure single leading slash
          return '/' + p.replace(/^\/+/, '');
        };
        let questionPath = normalizePath(q.questionTifUrl || q.questionImageUrl || q.questionImagePath || q.tifUrl || q.image);
        let solutionPath = normalizePath(q.solutionTifUrl || q.solutionImageUrl || q.solutionImagePath);

        // Derive canonical backend-served asset paths if not already in /questions/ scheme
        // Expected structure: /questions/<topic>/{questions|answers}/<id>[ -ans].png
        // Only derive if topic & id present and current path is missing or not already canonical.
        const topicValue = Array.isArray(q.topic) ? q.topic[0] : q.topic;
        if ((!questionPath || !questionPath.startsWith('/questions/')) && topicValue && q.id) {
          questionPath = `/questions/${topicValue}/questions/${q.id}.png`;
        }
        if ((!solutionPath || !solutionPath.startsWith('/questions/')) && topicValue && q.id) {
          // common convention: question id + '-ans' for answer image
            solutionPath = `/questions/${topicValue}/answers/${q.id}-ans.png`;
        }
        return {
          ...q,
            // Provide a derived name if missing
          name: q.name || q.title || q.id,
          // Normalized topic ALWAYS string (first) plus topicsAll array
          topic: Array.isArray(q.topic) ? q.topic[0] : q.topic,
          topicsAll: getQuestionTopics(q),
          questionTifUrl: questionPath,
          solutionTifUrl: solutionPath,
          // Aliases expected by frontend
          questionImageUrl: questionPath,
          solutionImageUrl: solutionPath
        };
      }

      // MODE 1: Direct ID lookup
      if (questionId) {
        console.log(`🔍 Looking for question with ID: "${questionId}"`);
        const question = questionsData.find(q => q.id === questionId);
        if (!question) {
          console.log(`❌ Question not found: "${questionId}"`);
          return sendJSON(res, { message: `Question with ID "${questionId}" not found` }, 404);
        }
        console.log(`✅ Found question: "${question.id}" - "${question.name || question.id}"`);
        return sendJSON(res, enrich(question));
      }

      // MODE 2: Filtered random selection
      let working = [...questionsData];

      // Topics filtering
      if (topicsParam && topicsParam.trim().length > 0) {
        const requestedTopics = topicsParam.split(',').map(t => t.trim()).filter(Boolean);
        working = working.filter(q => {
          const qTopics = getQuestionTopics(q).map(t => String(t).toLowerCase());
          return requestedTopics.some(rt => qTopics.includes(rt.toLowerCase()));
        });
      }

      // longOnly / shortOnly – interpret using isShort flag or timeLimitMinute heuristic
      function isShort(q) {
        if (typeof q.isShort === 'boolean') return q.isShort;
        if (q.timeLimitMinute != null) return q.timeLimitMinute <= 12; // heuristic
        return false;
      }
      if (longOnly === 'true') {
        working = working.filter(q => !isShort(q));
      }
      if (shortOnly === 'true') {
        working = working.filter(q => isShort(q));
      }

      // examOnly – basic heuristic: question-type not 'custom' OR has a name containing 'P'
      if (examOnly === 'true') {
        working = working.filter(q => {
          const qt = (q['question-type'] || q.questionType || '').toLowerCase();
            const n = (q.name || '').toUpperCase();
          return qt !== 'custom' || /\bP[12]\b/.test(n);
        });
      }

      // TODO: yearFrom/yearTo filtering when year metadata is available

      // Randomize
      for (let i = working.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [working[i], working[j]] = [working[j], working[i]];
      }

      const count = Math.min(parseInt(countParam) || 1, 50);
      const selected = working.slice(0, count).map(enrich);

      return sendJSON(res, count === 1 ? selected[0] : selected);
    }

    // Static question/answer images
    else if (pathname.startsWith('/questions/') && method === 'GET') {
      // Map URL path to filesystem under backend/src/data/questions
      // Security: prevent path traversal by normalizing and ensuring base containment
      const QUESTIONS_BASE_DIR = path.join(__dirname, 'src', 'data', 'questions');
      const requestedRelPath = pathname.replace(/^\/questions\//, ''); // <topic>/questions/<file>
      const safeRelPath = requestedRelPath.split('..').join(''); // rudimentary traversal neutralization
      const absPath = path.join(QUESTIONS_BASE_DIR, safeRelPath);
      const normalizedBase = path.normalize(QUESTIONS_BASE_DIR + path.sep);
      const normalizedTarget = path.normalize(absPath);
      if (!normalizedTarget.startsWith(normalizedBase)) {
        return sendJSON(res, { message: 'Invalid path' }, 400);
      }
      if (!fs.existsSync(normalizedTarget) || !fs.statSync(normalizedTarget).isFile()) {
        return sendJSON(res, { message: 'Image not found' }, 404);
      }
      const ext = path.extname(normalizedTarget).toLowerCase();
      const type = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
      const stream = fs.createReadStream(normalizedTarget);
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400', // 1 day
        'Access-Control-Allow-Origin': 'http://localhost:4321'
      });
      stream.pipe(res);
      stream.on('error', (err) => {
        console.error('Stream error serving image:', err);
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Error reading image' }));
      });
    }

    // Debug endpoints
    else if (pathname === '/debug/users' && method === 'GET') {
      const userList = [...users.values()].map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        createdAt: u.createdAt
      }));
      sendJSON(res, { users: userList, count: userList.length });
    }

    else if (pathname === '/debug/questions' && method === 'GET') {
      const limit = parseInt(parsedUrl.query.limit) || 20;
      
      // Create better titles for questions
      function createQuestionTitle(question) {
        const topicName = question.topic || 'Unknown';
        const formattedTopic = topicName
          .replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        const difficultyText = question.difficulty === 1 ? 'Easy' : 
                              question.difficulty === 2 ? 'Medium' : 'Hard';
        
        // Use ID as a more descriptive identifier
        return `${formattedTopic} - ${question.id.toUpperCase()} (${difficultyText})`;
      }
      
      const questions = questionsData.slice(0, limit).map(q => ({
        id: q.id,
        name: q.name, // Original name
        title: createQuestionTitle(q), // Better title
        topic: q.topic,
        difficulty: q.difficulty,
        tags: q.tags
      }));
      
      sendJSON(res, { 
        questions, 
        total: questionsData.length,
        showing: questions.length 
      });
    }

    else if (pathname === '/' && method === 'GET') {
      sendJSON(res, { 
        message: 'Simple Auth Server',
        version: '1.0.0',
        endpoints: [
          'POST /auth/signup',
          'POST /auth/login', 
          'POST /auth/logout',
          'GET  /auth/status',
          'GET  /auth/me',
          'GET  /api/topics',
          'POST /api/topics/questions',
          'GET  /api/questions?id=<questionId>',
          'GET  /debug/users',
          'GET  /debug/questions'
        ]
      });
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
  console.log('  POST /auth/signup - Create account (username, email, password)');
  console.log('  POST /auth/login - Login (emailOrUsername, password)');
  console.log('  POST /auth/logout - Logout');
  console.log('  GET  /auth/status - Check auth status');
  console.log('  GET  /auth/me - Get user info');
  console.log('  GET  /api/topics - Get topics');
  console.log('  POST /api/topics/questions - Get questions');
  console.log('  GET  /api/questions?id=<questionId> - Get specific question');
  console.log('  GET  /debug/users - List all users');
  console.log('  GET  /debug/questions - List questions (limit=20)');
  console.log('\n🔐 Authentication: Username + Email + Password');
  console.log('🍪 Sessions: HTTP-only cookies with JWT tokens');
  console.log('⏰ Token expiry: 24 hours');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Try stopping other Node.js processes or use a different port.`);
  }
});
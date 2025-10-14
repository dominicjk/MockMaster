import express from 'express';
import session from 'express-session';
import connectPgSimple from './config/connectPgSimple.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import questionsRouter from './routes/questions.js';
import topicsRouter from './routes/topics.js';
import progressRouter from './routes/progress.js';
import contactRouter from './routes/contact.js';
import authRouter from './routes/auth.js';
import userAuthRouter from './routes/userAuth.js';
import attemptsRouter from './routes/attempts.js';
import cookieParser from 'cookie-parser';
import UserModel from './database/users.js';
import EmailService from './services/emailService.js';
import pool, { testConnection } from './config/database.js';

const PgSession = connectPgSimple(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables. Primary attempt: process CWD (.env in project root if running from root)
dotenv.config();
// Fallback: if critical vars missing and a backend-local .env exists, load that too.
if (!process.env.EMAIL_USER || !process.env.PORT) {
  const backendEnvPath = path.join(__dirname, '..', '.env');
  try {
    if (fs.existsSync(backendEnvPath)) {
      dotenv.config({ path: backendEnvPath });
      if (!process.env.EMAIL_USER) {
        console.warn('⚠️  EMAIL_USER still undefined after loading backend/.env');
      }
    }
  } catch (e) {
    console.warn('⚠️  Failed loading backend/.env fallback:', e.message);
  }
}

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const PORT = process.env.PORT || 3001;

// Middleware - Security and parsing
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4321',
  credentials: true
}));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session Configuration with PostgreSQL Store
app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session', // Will auto-create this table
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production (HTTPS only)
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // parse cookies for JWT auth

// Middleware to log requests for question images
app.use('/questions', (req, res, next) => {
  console.log(`[Static Asset Request] Attempting to serve: ${req.originalUrl}`);
  next();
});

// Serve static files (question images)
app.use('/questions', express.static(path.join(__dirname, 'data/questions'), {
  // Optional: Add more logging for static file serving
  setHeaders: (res, filePath) => {
    console.log(`[Static Asset Served] Found and serving: ${filePath}`);
  }
}));

// Routes
app.use('/api/questions', questionsRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/auth', authRouter); // JWT-based auth endpoints (email code login + optional Google OAuth)
app.use('/api/user-auth', userAuthRouter); // Session-based auth endpoints (signup/login with bcrypt)
app.use('/api/attempts', attemptsRouter); // Database-backed attempts management
app.use('/api/progress', progressRouter);
app.use('/api/contact', contactRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test PostgreSQL connection
    await testConnection();
    
    // Initialize user database (JSON-based - legacy)
    await UserModel.initDatabase();
    console.log('✅ User database initialized');

    // Test email service (optional)
    try {
      await EmailService.testConnection();
      console.log('✅ Email service ready');
    } catch (error) {
      console.warn('⚠️  Email service not configured:', error.message);
    }

    // Start cleanup interval (every hour)
    setInterval(async () => {
      try {
        await UserModel.cleanupExpiredCodes();
        console.log('🧹 Cleaned up expired verification codes');
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, 60 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://localhost:${PORT}`);
      console.log(`📝 API endpoints available:`);
      console.log(`   - http://localhost:${PORT}/api/questions`);
      console.log(`   - http://localhost:${PORT}/api/topics`);
      console.log(`🔐 JWT Auth endpoints: /api/auth`);
      console.log(`🔑 Session Auth endpoints: /api/user-auth (signup/login)`);
      console.log(`🖼️  Static files served from http://localhost:${PORT}/questions`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

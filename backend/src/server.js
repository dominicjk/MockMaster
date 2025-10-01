import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import questionsRouter from './routes/questions.js';
import topicsRouter from './routes/topics.js';
import authRouter from './routes/auth.js';
import progressRouter from './routes/progress.js';
import passport from './middleware/auth.js';
import UserModel from './database/users.js';
import EmailService from './services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4321',
  credentials: true
}));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

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
app.use('/auth', authRouter);
app.use('/api/progress', progressRouter);

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
    // Initialize user database
    await UserModel.initDatabase();
    console.log('✅ Database initialized');

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
      console.log(`🔐 Authentication endpoints:`);
      console.log(`   - http://localhost:${PORT}/auth/google`);
      console.log(`   - http://localhost:${PORT}/auth/signup`);
      console.log(`   - http://localhost:${PORT}/auth/login`);
      console.log(`   - http://localhost:${PORT}/auth/me`);
      console.log(`🖼️  Static files served from http://localhost:${PORT}/questions`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

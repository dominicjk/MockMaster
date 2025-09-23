import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import UserModel from '../database/users.js';

// Passport configuration - temporarily disabled to avoid OAuth errors
// OAuth will be re-enabled when environment variables are properly configured
/*
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await UserModel.findUserByProviderId('google', profile.id);
    
    if (user) {
      // Update last login
      await UserModel.updateLastLogin(user.id);
      return done(null, user);
    }

    // Check if email already exists with different provider
    const email = profile.emails?.[0]?.value;
    if (email) {
      const existingUser = await UserModel.findUserByEmail(email);
      if (existingUser) {
        // Link Google account to existing user
        await UserModel.updateUser(existingUser.id, {
          provider: 'google',
          providerId: profile.id,
          emailVerified: true,
          avatar: profile.photos?.[0]?.value || existingUser.avatar
        });
        await UserModel.updateLastLogin(existingUser.id);
        return done(null, existingUser);
      }
    }

    // Create new user
    const newUserData = {
      email: email,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value || '',
      provider: 'google',
      providerId: profile.id,
      emailVerified: true
    };

    user = await UserModel.createUser(newUserData);
    return done(null, user);
    
  } catch (error) {
    return done(error, null);
  }
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await UserModel.findUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
} else {
  console.warn('⚠️  Google OAuth not configured - OAuth routes will be disabled');
}
*/

// Temporarily disable OAuth - just log that it's disabled
console.warn('🚫 Authentication temporarily disabled for development');

// JWT token generation
export const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// JWT verification middleware
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken;

  if (!token) {
    req.userId = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'access') {
      req.userId = decoded.userId;
    } else {
      req.userId = null;
    }
  } catch (error) {
    req.userId = null;
  }

  next();
};

// Refresh token verification
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded.userId;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// User loading middleware (after auth)
export const loadUser = async (req, res, next) => {
  if (!req.userId) {
    return next();
  }

  try {
    const user = await UserModel.findUserById(req.userId);
    if (user) {
      // Don't expose encrypted email in response
      req.user = {
        ...user,
        email: UserModel.decryptEmail(user.email)
      };
    }
    next();
  } catch (error) {
    console.error('Error loading user:', error);
    req.user = null;
    next();
  }
};

export default passport;

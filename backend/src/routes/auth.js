import express from 'express';
import passport from '../middleware/auth.js';
import { generateTokens, verifyToken, verifyRefreshToken, loadUser } from '../middleware/auth.js';
import UserModel from '../database/users.js';
import EmailService from '../services/emailService.js';

const router = express.Router();

// Google OAuth routes - only if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
  }));

  router.get('/google/callback', 
    passport.authenticate('google', { session: false }),
    async (req, res) => {
    try {
      // Generate JWT tokens
      const tokens = generateTokens(req.user.id);
      
      // Set secure cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4321';
      res.redirect(`${frontendUrl}/auth/success`);
      
    } catch (error) {
      console.error('OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4321';
      res.redirect(`${frontendUrl}/auth/error`);
    }
  }
  );
} else {
  // Disabled OAuth routes - return helpful error messages
  router.get('/google', (req, res) => {
    res.status(501).json({ error: 'Google OAuth not configured' });
  });
  
  router.get('/google/callback', (req, res) => {
    res.status(501).json({ error: 'Google OAuth not configured' });
  });
}

// Email signup route
router.post('/signup', async (req, res) => {
  try {
    const { email, name, marketingConsent = false } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await UserModel.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Generate verification code
    const verificationCode = UserModel.generateVerificationCode();
    
    // Store verification code
    await UserModel.storeVerificationCode(email, verificationCode, 'email_verification');

    // Send verification email
    await EmailService.sendVerificationEmail(email, verificationCode, name);

    // Store temporary user data in verification entry for later use
    // (In a real app, you might use Redis or a separate temp table)
    
    res.status(200).json({ 
      message: 'Verification code sent to your email',
      email: email
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email and complete registration
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code, name, marketingConsent = false } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    // Verify the code
    const isValidCode = await UserModel.verifyCode(email, code, 'email_verification');
    if (!isValidCode) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Create the user
    const userData = {
      email,
      name,
      marketingConsent,
      emailVerified: true,
      provider: 'email'
    };

    const user = await UserModel.createUser(userData);

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Set secure cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login with email (send verification code)
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const user = await UserModel.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate verification code
    const verificationCode = UserModel.generateVerificationCode();
    
    // Store verification code
    await UserModel.storeVerificationCode(email, verificationCode, 'login_verification');

    // Send verification email
    const decryptedEmail = UserModel.decryptEmail(user.email);
    await EmailService.sendVerificationEmail(decryptedEmail, verificationCode, user.name);

    res.status(200).json({ 
      message: 'Verification code sent to your email',
      email: decryptedEmail
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify login code
router.post('/verify-login', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    // Verify the code
    const isValidCode = await UserModel.verifyCode(email, code, 'login_verification');
    if (!isValidCode) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Find and update user
    const user = await UserModel.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update last login
    await UserModel.updateLastLogin(user.id);

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Set secure cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: UserModel.decryptEmail(user.email),
        name: user.name,
        avatar: user.avatar,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('Login verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const userId = verifyRefreshToken(refreshToken);
    const user = await UserModel.findUserById(userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new access token
    const tokens = generateTokens(userId);

    // Set new access token cookie
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(200).json({
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Get current user
router.get('/me', verifyToken, loadUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.status(200).json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
        emailVerified: req.user.emailVerified,
        preferences: req.user.preferences,
        stats: req.user.stats
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  try {
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({ message: 'Logged out successfully' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', verifyToken, loadUser, async (req, res) => {
  try {
    const { name, preferences, marketingConsent } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (preferences !== undefined) updates.preferences = { ...req.user.preferences, ...preferences };
    if (marketingConsent !== undefined) {
      updates.marketingConsent = marketingConsent;
      updates.consentDate = new Date().toISOString();
    }

    const updatedUser = await UserModel.updateUser(req.userId, updates);

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: UserModel.decryptEmail(updatedUser.email),
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        emailVerified: updatedUser.emailVerified,
        preferences: updatedUser.preferences
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GDPR: Export user data
router.get('/export', verifyToken, async (req, res) => {
  try {
    const userData = await UserModel.exportUserData(req.userId);
    
    res.setHeader('Content-Disposition', 'attachment; filename=user_data.json');
    res.setHeader('Content-Type', 'application/json');
    
    res.status(200).json(userData);

  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GDPR: Delete user account
router.delete('/account', verifyToken, async (req, res) => {
  try {
    await UserModel.deleteUserData(req.userId);
    
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({ message: 'Account deleted successfully' });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend verification code
router.post('/resend-code', async (req, res) => {
  try {
    const { email, type = 'email_verification' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Generate new verification code
    const verificationCode = UserModel.generateVerificationCode();
    
    // Store verification code
    await UserModel.storeVerificationCode(email, verificationCode, type);

    // Send verification email
    await EmailService.sendVerificationEmail(email, verificationCode);

    res.status(200).json({ 
      message: 'New verification code sent to your email'
    });

  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

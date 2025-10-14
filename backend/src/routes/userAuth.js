import express from 'express';
import UserAuthService from '../services/userAuthService.js';

const router = express.Router();

/**
 * POST /api/auth/signup
 * Create a new user account
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Create user
    const user = await UserAuthService.signup({
      email,
      password,
      firstName: firstName || null,
      lastName: lastName || null,
      role: role || 'user'
    });

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Signup route error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    if (error.message.includes('Password must be')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ 
      error: 'Failed to create user account' 
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Authenticate user
    const user = await UserAuthService.login(email, password);

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('Login route error:', error);
    
    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.status(500).json({ 
      error: 'Login failed' 
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and destroy session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }

    res.clearCookie('connect.sid'); // Clear session cookie
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /api/auth/me
 * Get current logged-in user info
 */
router.get('/me', async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch user data
    const user = await UserAuthService.findUserById(req.session.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

/**
 * PUT /api/auth/password
 * Update user password (requires authentication)
 */
router.put('/password', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
    }

    // Verify current password
    const user = await UserAuthService.findUserByEmail(req.session.userEmail);
    const isValidPassword = await UserAuthService.verifyPassword(
      currentPassword, 
      user.password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    await UserAuthService.updatePassword(req.session.userId, newPassword);

    res.status(200).json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Update password error:', error);
    
    if (error.message.includes('Password must be')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to update password' });
  }
});

/**
 * PUT /api/user-auth/update-profile
 * Update user profile (firstName, lastName)
 */
router.put('/update-profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { firstName, lastName } = req.body;

    if (!firstName) {
      return res.status(400).json({ 
        error: 'First name is required' 
      });
    }

    // Update profile using the service
    await UserAuthService.updateProfile(req.session.userId, firstName, lastName);

    res.status(200).json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * GET /api/auth/check
 * Check if user is authenticated (simple status check)
 */
router.get('/check', (req, res) => {
  res.status(200).json({
    authenticated: !!req.session.userId,
    userId: req.session.userId || null
  });
});

export default router;

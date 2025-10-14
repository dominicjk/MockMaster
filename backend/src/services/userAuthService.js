import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcrypt');
import pool from '../config/database.js';

const SALT_ROUNDS = 10;

/**
 * User Authentication Service
 * Handles user signup, login, and password management
 */
class UserAuthService {
  /**
   * Create a new user with hashed password
   */
  async signup({ email, password, firstName, lastName, role = 'user' }) {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Check if user already exists
      const existingUser = await this.findUserByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Insert user into database
      const query = `
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, first_name, last_name, role, created_at
      `;

      const values = [email.toLowerCase(), passwordHash, firstName, lastName, role];
      const result = await pool.query(query, values);

      return result.rows[0];
    } catch (error) {
      console.error('Signup error:', error.message);
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(email, password) {
    try {
      // Find user by email
      const user = await this.findUserByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Update last login timestamp
      await this.updateLastLogin(user.id);

      // Return user without password hash
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Login error:', error.message);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await pool.query(query, [email.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Find user error:', error.message);
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findUserById(id) {
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, created_at, last_login
        FROM users 
        WHERE id = $1
      `;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Find user by ID error:', error.message);
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId) {
    try {
      const query = `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = $1
        RETURNING last_login
      `;
      const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Update last login error:', error.message);
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId, newPassword) {
    try {
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      
      const query = `
        UPDATE users 
        SET password_hash = $1 
        WHERE id = $2
        RETURNING id, email
      `;
      
      const result = await pool.query(query, [passwordHash, userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Update password error:', error.message);
      throw error;
    }
  }

  /**
   * Update user profile (firstName, lastName)
   */
  async updateProfile(userId, firstName, lastName) {
    try {
      if (!firstName) {
        throw new Error('First name is required');
      }

      const query = `
        UPDATE users 
        SET first_name = $1, last_name = $2 
        WHERE id = $3
        RETURNING id, email, first_name, last_name, role, created_at, last_login
      `;
      
      const result = await pool.query(query, [firstName, lastName || '', userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Update profile error:', error.message);
      throw error;
    }
  }

  /**
   * Verify if a password matches the stored hash
   */
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Get all users (admin only - excludes passwords)
   */
  async getAllUsers(limit = 50, offset = 0) {
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, created_at, last_login
        FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Get all users error:', error.message);
      throw error;
    }
  }

  /**
   * Delete user by ID
   */
  async deleteUser(userId) {
    try {
      const query = 'DELETE FROM users WHERE id = $1 RETURNING id, email';
      const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Delete user error:', error.message);
      throw error;
    }
  }
}

export default new UserAuthService();

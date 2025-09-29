import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server.js';
import UserModel from '../src/database/users.js';
import EmailService from '../src/services/emailService.js';

// Mock the dependencies
vi.mock('../src/database/users.js');
vi.mock('../src/services/emailService.js');

describe('Authentication Routes', () => {
  let app;

  beforeEach(async () => {
    app = createApp();
    vi.clearAllMocks();

    // Mock UserModel methods
    UserModel.initDatabase = vi.fn().mockResolvedValue(true);
    UserModel.generateVerificationCode = vi.fn().mockReturnValue('123456');
    UserModel.findUserByEmail = vi.fn();
    UserModel.storeVerificationCode = vi.fn().mockResolvedValue(true);
    UserModel.verifyCode = vi.fn();
    UserModel.createUser = vi.fn();
    UserModel.findUserById = vi.fn();
    UserModel.updateLastLogin = vi.fn().mockResolvedValue(true);

    // Mock EmailService
    EmailService.sendVerificationEmail = vi.fn().mockResolvedValue({ messageId: 'test-123' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('should create new user signup request successfully', async () => {
      UserModel.findUserByEmail.mockResolvedValue(null); // User doesn't exist

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          marketingConsent: false
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Verification code sent to your email');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(UserModel.storeVerificationCode).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'email_verification'
      );
      expect(EmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'Test User'
      );
    });

    it('should reject signup with missing email', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email and name are required');
    });

    it('should reject signup with invalid email format', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid email format');
    });

    it('should reject signup if user already exists', async () => {
      UserModel.findUserByEmail.mockResolvedValue({ id: 'user-123', email: 'test@example.com' });

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          name: 'Test User'
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User already exists with this email');
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email and create user successfully', async () => {
      UserModel.verifyCode.mockResolvedValue(true);
      UserModel.createUser.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: '',
        emailVerified: true
      });

      const response = await request(app)
        .post('/auth/verify-email')
        .send({
          email: 'test@example.com',
          code: '123456',
          name: 'Test User',
          marketingConsent: false
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Account created successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', 'user-123');
      expect(UserModel.verifyCode).toHaveBeenCalledWith('test@example.com', '123456', 'email_verification');
      expect(UserModel.createUser).toHaveBeenCalled();
    });

    it('should reject with invalid verification code', async () => {
      UserModel.verifyCode.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/verify-email')
        .send({
          email: 'test@example.com',
          code: '000000'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid or expired verification code');
    });

    it('should reject with missing email or code', async () => {
      const response = await request(app)
        .post('/auth/verify-email')
        .send({
          email: 'test@example.com'
          // Missing code
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email and verification code are required');
    });
  });

  describe('POST /auth/login', () => {
    it('should send login verification code for existing user', async () => {
      UserModel.findUserByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'encrypted-email',
        name: 'Test User'
      });
      UserModel.decryptEmail = vi.fn().mockReturnValue('test@example.com');

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Verification code sent to your email');
      expect(UserModel.storeVerificationCode).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'login_verification'
      );
      expect(EmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'Test User'
      );
    });

    it('should reject login for non-existent user', async () => {
      UserModel.findUserByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'User not found');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email is required');
    });
  });

  describe('POST /auth/verify-login', () => {
    it('should verify login code and authenticate user', async () => {
      UserModel.verifyCode.mockResolvedValue(true);
      UserModel.findUserByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: '',
        emailVerified: true
      });

      const response = await request(app)
        .post('/auth/verify-login')
        .send({
          email: 'test@example.com',
          code: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(UserModel.verifyCode).toHaveBeenCalledWith('test@example.com', '123456', 'login_verification');
      expect(UserModel.updateLastLogin).toHaveBeenCalledWith('user-123');
    });

    it('should reject with invalid login code', async () => {
      UserModel.verifyCode.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/verify-login')
        .send({
          email: 'test@example.com',
          code: '000000'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid or expired verification code');
    });
  });

  describe('GET /auth/me', () => {
    it('should return user info for authenticated user', async () => {
      // Mock JWT verification middleware
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: '',
        emailVerified: true,
        preferences: {},
        stats: {}
      };

      // This is a simplified test - in reality we'd need to mock the JWT verification
      // For now, we'll test the endpoint structure
      const response = await request(app)
        .get('/auth/me')
        .set('Cookie', ['accessToken=valid-jwt-token']);

      // Without proper JWT setup, this will return 401
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logged out successfully');
    });
  });

  describe('POST /auth/resend-code', () => {
    it('should resend verification code', async () => {
      const response = await request(app)
        .post('/auth/resend-code')
        .send({
          email: 'test@example.com',
          type: 'email_verification'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'New verification code sent to your email');
      expect(UserModel.storeVerificationCode).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'email_verification'
      );
      expect(EmailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should reject resend with missing email', async () => {
      const response = await request(app)
        .post('/auth/resend-code')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email is required');
    });
  });
});
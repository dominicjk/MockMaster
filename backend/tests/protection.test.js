import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server.js';

// Mock the dependencies
vi.mock('../src/database/users.js');
vi.mock('../src/services/emailService.js');

describe('Protected Routes', () => {
  let app;

  beforeEach(async () => {
    app = createApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Questions API Protection', () => {
    it('should reject unauthenticated requests to GET /api/questions', async () => {
      const response = await request(app)
        .get('/api/questions');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });

    it('should reject unauthenticated requests to GET /api/questions/all', async () => {
      const response = await request(app)
        .get('/api/questions/all');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });

    it('should reject unauthenticated requests to GET /api/questions/:id', async () => {
      const response = await request(app)
        .get('/api/questions/test-id');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });

    it('should reject unauthenticated requests to PATCH /api/questions/:id', async () => {
      const response = await request(app)
        .patch('/api/questions/test-id')
        .send({ complete: true });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });

    it('should reject unauthenticated requests to POST /api/questions/reset', async () => {
      const response = await request(app)
        .post('/api/questions/reset');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });
  });

  describe('Topics API Protection', () => {
    it('should reject unauthenticated requests to GET /api/topics', async () => {
      const response = await request(app)
        .get('/api/topics');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });

    it('should reject unauthenticated requests to POST /api/topics/questions', async () => {
      const response = await request(app)
        .post('/api/topics/questions')
        .send({ topics: ['algebra'] });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });

    it('should reject unauthenticated requests to GET /api/topics/questions', async () => {
      const response = await request(app)
        .get('/api/topics/questions?topics=algebra');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });

    it('should reject unauthenticated requests to GET /api/topics/available', async () => {
      const response = await request(app)
        .get('/api/topics/available');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });
  });

  describe('Public Endpoints', () => {
    it('should allow access to health check endpoint', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });

  describe('Invalid JWT Tokens', () => {
    it('should reject requests with invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', 'Bearer invalid-jwt-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should reject requests with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', 'invalid-format');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No access token provided');
    });
  });
});
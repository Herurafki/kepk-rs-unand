'use strict';
/**
 * Integration tests — JWT Authentication Middleware
 * Task 16.3: Test JWT authentication
 *
 * Requirements:
 *  - Requirement 2 (User Authentication)
 *  - Requirement 3 (Role-Based Authorization)
 *  - Requirement 16 (API)
 *  - Requirement 18 (Security)
 *
 * Test endpoint: GET /api/auth/me (requires authenticate middleware)
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');

const RUN_ID = Date.now();
const JWT_EMAIL = `test.jwt.${RUN_ID}@example.com`;
const JWT_PASSWORD = 'Password123!';
const JWT_NAME = 'JWT Test User';

let validToken = '';

describe('GET /api/auth/me — JWT Authentication Middleware', () => {
  // Register a real user and obtain a valid token before running tests
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: JWT_NAME, email: JWT_EMAIL, password: JWT_PASSWORD });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: JWT_EMAIL, password: JWT_PASSWORD });

    validToken = loginRes.body.data.access_token;
  });

  // Clean up the user created for this test run
  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE email = $1`, [JWT_EMAIL]);
    await pool.end();
  });

  // ─── Valid token ──────────────────────────────────────────────────────────────

  describe('Valid Bearer token', () => {
    it('should return 200 and user identity when a valid token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(JWT_EMAIL.toLowerCase());
    });

    it('should not expose the password in the response', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.body.data.password).toBeUndefined();
    });
  });

  // ─── Missing Authorization header ────────────────────────────────────────────

  describe('Missing Authorization header', () => {
    it('should return 401 when no Authorization header is sent', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when Authorization header is an empty string', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', '');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Wrong format (no Bearer prefix) ─────────────────────────────────────────

  describe('Wrong Authorization format', () => {
    it('should return 401 when token is sent without the Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', validToken);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when the scheme is "Token" instead of "Bearer"', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Token ${validToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when the header is "Bearer " with no token after it', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Expired token ────────────────────────────────────────────────────────────

  describe('Expired token', () => {
    it('should return 401 when the JWT has expired', async () => {
      // Sign a token that expires in 1 ms, then wait for it to expire
      const secret = process.env.JWT_SECRET;
      const expiredToken = jwt.sign(
        { sub: 'fake-id', email: JWT_EMAIL, roles: ['PENELITI'] },
        secret,
        { expiresIn: '1ms' }
      );

      // Ensure the token has expired before sending
      await new Promise((resolve) => setTimeout(resolve, 50));

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/expired/i);
    });
  });

  // ─── Invalid / malformed token ────────────────────────────────────────────────

  describe('Invalid or malformed token', () => {
    it('should return 401 when the token is a random string', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer this.is.not.a.jwt');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when the token has been tampered with', async () => {
      // Flip one character in the signature part of a real token
      const parts = validToken.split('.');
      parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('a') ? 'b' : 'a');
      const tamperedToken = parts.join('.');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when the token has only two parts (header.payload)', async () => {
      const parts = validToken.split('.');
      const truncated = `${parts[0]}.${parts[1]}`;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${truncated}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Wrong secret ─────────────────────────────────────────────────────────────

  describe('Token signed with wrong secret', () => {
    it('should return 401 when the JWT was signed with a different secret', async () => {
      const wrongSecretToken = jwt.sign(
        { sub: 'fake-id', email: JWT_EMAIL, roles: ['PENELITI'] },
        'completely-wrong-secret-key',
        { expiresIn: '1d' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

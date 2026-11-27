'use strict';
/**
 * Integration tests — POST /api/auth/login
 * Task 16.2: Test login
 *
 * Requirements:
 *  - Requirement 2 (User Authentication)
 *  - Requirement 16 (API)
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const app = require('../app');
const pool = require('../config/database');

const RUN_ID = Date.now();
const LOGIN_EMAIL = `test.login.${RUN_ID}@example.com`;
const LOGIN_PASSWORD = 'Password123!';
const LOGIN_NAME = 'Login Test User';

describe('POST /api/auth/login', () => {
  // Seed: register a user before all login tests
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: LOGIN_NAME, email: LOGIN_EMAIL, password: LOGIN_PASSWORD });
  });

  // Tear down: remove the user created for this test run
  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE email = $1`, [LOGIN_EMAIL]);
    await pool.end();
  });

  // ─── Success ────────────────────────────────────────────────────────────────

  describe('Success cases', () => {
    it('should authenticate with valid credentials and return 200', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');
    });

    it('should return an access token in the response', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD });

      expect(res.body.data.access_token).toBeDefined();
      expect(typeof res.body.data.access_token).toBe('string');
      expect(res.body.data.access_token.length).toBeGreaterThan(0);
    });

    it('should return a refresh token in the response', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD });

      expect(res.body.data.refresh_token).toBeDefined();
      expect(typeof res.body.data.refresh_token).toBe('string');
    });

    it('should return user identity (id, name, email, roles) without password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD });

      const { user } = res.body.data;
      expect(user.id).toBeDefined();
      expect(user.name).toBe(LOGIN_NAME);
      expect(user.email).toBe(LOGIN_EMAIL.toLowerCase());
      expect(Array.isArray(user.roles)).toBe(true);
      expect(user.roles).toContain('PENELITI');
      // Password must never appear in the response
      expect(user.password).toBeUndefined();
    });

    it('should accept email in a different case', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOGIN_EMAIL.toUpperCase(), password: LOGIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Invalid credentials ─────────────────────────────────────────────────────

  describe('Invalid credentials', () => {
    it('should return 401 when password is wrong', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOGIN_EMAIL, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      // Must not leak which part was wrong (security: generic message)
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it('should return 401 when email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `nonexistent.${RUN_ID}@example.com`, password: 'SomePassword1' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });
  });

  // ─── Validation errors ───────────────────────────────────────────────────────

  describe('Validation errors', () => {
    it('should return 422 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: LOGIN_PASSWORD });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors.email).toBeDefined();
    });

    it('should return 422 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOGIN_EMAIL });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.password).toBeDefined();
    });

    it('should return 422 when both fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.email).toBeDefined();
      expect(res.body.errors.password).toBeDefined();
    });
  });
});

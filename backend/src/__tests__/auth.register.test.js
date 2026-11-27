'use strict';
/**
 * Integration tests — POST /api/auth/register
 * Task 16.1: Test registration
 *
 * Requirements:
 *  - Requirement 1 (User Registration)
 *  - Requirement 16 (API)
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const app = require('../app');
const pool = require('../config/database');

// Unique suffix per test run so re-running tests against the same DB is safe.
const RUN_ID = Date.now();
const uniqueEmail = (tag) => `test.register.${tag}.${RUN_ID}@example.com`;

describe('POST /api/auth/register', () => {
  // Tear down: remove any users created during this test run
  afterAll(async () => {
    await pool.query(
      `DELETE FROM users WHERE email LIKE $1`,
      [`test.register.%.${RUN_ID}@example.com`]
    );
    await pool.end();
  });

  // ─── Success ────────────────────────────────────────────────────────────────

  describe('Success cases', () => {
    it('should create a new researcher account and return 201', async () => {
      const email = uniqueEmail('success');
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email, password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Registration successful');
      expect(res.body.data).toMatchObject({
        name: 'Test User',
        email: email.toLowerCase(),
        roles: ['PENELITI'],
      });
      expect(res.body.data.id).toBeDefined();
      // Password must NOT be present in the response
      expect(res.body.data.password).toBeUndefined();
    });

    it('should store the email in lowercase', async () => {
      const email = uniqueEmail('case');
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Case Test', email: email.toUpperCase(), password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe(email.toLowerCase());
    });
  });

  // ─── Duplicate email ─────────────────────────────────────────────────────────

  describe('Duplicate email', () => {
    const dupEmail = uniqueEmail('dup');

    beforeAll(async () => {
      // Register once first
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'First User', email: dupEmail, password: 'password123' });
    });

    it('should return 409 when email is already registered', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Second User', email: dupEmail, password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Validation errors ───────────────────────────────────────────────────────

  describe('Validation errors', () => {
    it('should return 422 when name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: uniqueEmail('noname'), password: 'password123' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors.name).toBeDefined();
    });

    it('should return 422 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', password: 'password123' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.email).toBeDefined();
    });

    it('should return 422 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: uniqueEmail('nopass') });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.password).toBeDefined();
    });

    it('should return 422 when all fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.name).toBeDefined();
      expect(res.body.errors.email).toBeDefined();
      expect(res.body.errors.password).toBeDefined();
    });

    it('should return 422 when email format is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(422);
      expect(res.body.errors.email).toBeDefined();
    });

    it('should return 422 when password is too short (less than 8 characters)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: uniqueEmail('shortpass'), password: 'abc' });

      expect(res.status).toBe(422);
      expect(res.body.errors.password).toBeDefined();
    });
  });
});

'use strict';
/**
 * Integration tests — Role Authorization Middleware
 * Task 16.4: Test role authorization
 *
 * Requirements:
 *  - Requirement 3 (Role-Based Authorization)
 *  - Requirement 16 (API)
 *  - Requirement 18 (Security)
 *
 * Strategy:
 *  - Register a real PENELITI user and obtain a token (default role on registration).
 *  - Build tokens carrying other role payloads via jsonwebtoken directly — this lets us
 *    test role checking without needing seeded DIKLIT/KETUA/REVIEWER accounts.
 *  - Test endpoints that are restricted to a single role to confirm that every other
 *    role receives 403.
 *
 * Endpoints under test:
 *  - GET  /api/admin/applications         → requires DIKLIT (or SUPERADMIN)
 *  - POST /api/assignments/applications/:id/assign → requires KETUA
 *  - POST /api/applications/:id/reviews   → requires REVIEWER
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');

const RUN_ID = Date.now();
const PENELITI_EMAIL = `test.roles.researcher.${RUN_ID}@example.com`;
const PENELITI_PASSWORD = 'Password123!';
const PENELITI_NAME = 'Roles Test Researcher';

// Tokens obtained in beforeAll
let researcherToken = '';

/**
 * Build a signed token carrying an arbitrary role payload.
 * Uses the app's own JWT_SECRET so the authenticate middleware accepts it.
 */
const makeTokenWithRoles = (roles, userId = 'synthetic-user-id') => {
  const secret = process.env.JWT_SECRET;
  return jwt.sign(
    {
      sub: userId,
      name: 'Synthetic User',
      email: `synthetic.${roles.join('.')}.${RUN_ID}@example.com`,
      roles,
    },
    secret,
    { expiresIn: '1d' }
  );
};

describe('Role Authorization Middleware', () => {
  beforeAll(async () => {
    // Register a real PENELITI so we have a DB-backed token
    await request(app)
      .post('/api/auth/register')
      .send({ name: PENELITI_NAME, email: PENELITI_EMAIL, password: PENELITI_PASSWORD });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: PENELITI_EMAIL, password: PENELITI_PASSWORD });

    researcherToken = loginRes.body.data.access_token;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE email = $1`, [PENELITI_EMAIL]);
    await pool.end();
  });

  // ─── DIKLIT-only endpoint: GET /api/admin/applications ────────────────────────

  describe('GET /api/admin/applications — requires DIKLIT', () => {
    it('should return 200 when user has DIKLIT role', async () => {
      const diklatToken = makeTokenWithRoles(['DIKLIT']);
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${diklatToken}`);

      // 200 is the success case; 404 would also be acceptable if no applications
      // exist, but the middleware should not block a DIKLIT user.
      expect([200, 404]).toContain(res.status);
      expect(res.body.success).not.toBe(false); // must not be a middleware rejection
      // Specifically must not be 401 or 403
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('should return 403 when user has PENELITI role', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has KETUA role', async () => {
      const chiefToken = makeTokenWithRoles(['KETUA']);
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${chiefToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has REVIEWER role', async () => {
      const reviewerToken = makeTokenWithRoles(['REVIEWER']);
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .get('/api/admin/applications');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── KETUA-only endpoint: POST /api/assignments/applications/:id/assign ──

  describe('POST /api/assignments/applications/:id/assign — requires KETUA', () => {
    // Use a placeholder application ID — the role check happens before any DB lookup
    const fakeApplicationId = '00000000-0000-0000-0000-000000000000';

    it('should pass role check when user has KETUA role (may 404 on missing resource)', async () => {
      const chiefToken = makeTokenWithRoles(['KETUA']);
      const res = await request(app)
        .post(`/api/assignments/applications/${fakeApplicationId}/assign`)
        .set('Authorization', `Bearer ${chiefToken}`)
        .send({ reviewer_id: '00000000-0000-0000-0000-000000000001' });

      // Role check passed — response is 400/404/422 from business logic, NOT 403
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });

    it('should return 403 when user has PENELITI role', async () => {
      const res = await request(app)
        .post(`/api/assignments/applications/${fakeApplicationId}/assign`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ reviewer_id: '00000000-0000-0000-0000-000000000001' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has DIKLIT role', async () => {
      const diklatToken = makeTokenWithRoles(['DIKLIT']);
      const res = await request(app)
        .post(`/api/assignments/applications/${fakeApplicationId}/assign`)
        .set('Authorization', `Bearer ${diklatToken}`)
        .send({ reviewer_id: '00000000-0000-0000-0000-000000000001' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has REVIEWER role', async () => {
      const reviewerToken = makeTokenWithRoles(['REVIEWER']);
      const res = await request(app)
        .post(`/api/assignments/applications/${fakeApplicationId}/assign`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ reviewer_id: '00000000-0000-0000-0000-000000000001' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .post(`/api/assignments/applications/${fakeApplicationId}/assign`)
        .send({ reviewer_id: '00000000-0000-0000-0000-000000000001' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── REVIEWER-only endpoint: POST /api/applications/:id/reviews ───────────────

  describe('POST /api/applications/:id/reviews — requires REVIEWER', () => {
    const fakeApplicationId = '00000000-0000-0000-0000-000000000000';

    it('should pass role check when user has REVIEWER role (may 404 on missing resource)', async () => {
      const reviewerToken = makeTokenWithRoles(['REVIEWER']);
      const res = await request(app)
        .post(`/api/applications/${fakeApplicationId}/reviews`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ recommendation: 'APPROVE', comments: 'Looks good' });

      // Role check passed — should not be 401 or 403
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('should return 403 when user has PENELITI role', async () => {
      const res = await request(app)
        .post(`/api/applications/${fakeApplicationId}/reviews`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ recommendation: 'APPROVE', comments: 'Looks good' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has DIKLIT role', async () => {
      const diklatToken = makeTokenWithRoles(['DIKLIT']);
      const res = await request(app)
        .post(`/api/applications/${fakeApplicationId}/reviews`)
        .set('Authorization', `Bearer ${diklatToken}`)
        .send({ recommendation: 'APPROVE', comments: 'Looks good' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has KETUA role', async () => {
      const chiefToken = makeTokenWithRoles(['KETUA']);
      const res = await request(app)
        .post(`/api/applications/${fakeApplicationId}/reviews`)
        .set('Authorization', `Bearer ${chiefToken}`)
        .send({ recommendation: 'APPROVE', comments: 'Looks good' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .post(`/api/applications/${fakeApplicationId}/reviews`)
        .send({ recommendation: 'APPROVE', comments: 'Looks good' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Multi-role token ─────────────────────────────────────────────────────────

  describe('Multi-role tokens', () => {
    it('should allow access when user holds multiple roles that include the required one', async () => {
      // A user with both PENELITI and DIKLIT should pass a DIKLIT-only check
      const multiRoleToken = makeTokenWithRoles(['PENELITI', 'DIKLIT']);
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${multiRoleToken}`);

      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });

    it('should return 403 when a multi-role token does not include the required role', async () => {
      // PENELITI + REVIEWER — neither is DIKLIT
      const multiRoleToken = makeTokenWithRoles(['PENELITI', 'REVIEWER']);
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${multiRoleToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});

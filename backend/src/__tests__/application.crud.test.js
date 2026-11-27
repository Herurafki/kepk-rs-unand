'use strict';
/**
 * Integration tests — Research Application CRUD
 * Task 16.5: Test application CRUD
 *
 * Requirements:
 *  - Requirement 4 (Research Application)
 *  - Requirement 5 (Research Information)
 *  - Requirement 13 (Application Status Workflow)
 *  - Requirement 16 (API)
 *  - Requirement 18 (Security)
 *
 * Endpoints under test:
 *  - POST   /api/applications         — create draft (PENELITI only)
 *  - GET    /api/applications         — list (PENELITI sees only own)
 *  - GET    /api/applications/:id     — get by ID
 *  - PUT    /api/applications/:id     — update draft
 *  - DELETE /api/applications/:id     — delete draft
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');

const RUN_ID = Date.now();
const uniqueEmail = (tag) => `test.app.crud.${tag}.${RUN_ID}@example.com`;

// ─── Shared state ─────────────────────────────────────────────────────────────
let researcherToken = '';
let researcherToken2 = '';
let diklatToken = '';

// IDs created during tests — collected for cleanup
const createdApplicationIds = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Register a PENELITI and return their access token.
 */
const registerResearcher = async (tag) => {
  const email = uniqueEmail(tag);
  const password = 'Password123!';

  await request(app)
    .post('/api/auth/register')
    .send({ name: `CRUD Test ${tag}`, email, password });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  return loginRes.body.data.access_token;
};

/**
 * Build a signed JWT with an arbitrary role array (for role tests).
 * Uses the same JWT_SECRET as the app so authenticate middleware accepts it.
 */
const makeTokenWithRoles = (roles) => {
  return jwt.sign(
    {
      sub: `synthetic-${roles.join('-')}-${RUN_ID}`,
      name: 'Synthetic User',
      email: uniqueEmail(`synthetic-${roles.join('-')}`),
      roles,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

/**
 * Create a minimal valid draft application and return the response body.
 * Tracks the created ID so afterAll can clean it up.
 */
const createDraft = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send({
      group_category: 'MAHASISWA',
      research_title: `Test Research ${RUN_ID}`,
      ...overrides,
    });
  if (res.body.data && res.body.data.id) {
    createdApplicationIds.push(res.body.data.id);
  }
  return res;
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  researcherToken = await registerResearcher('r1');
  researcherToken2 = await registerResearcher('r2');
  diklatToken = makeTokenWithRoles(['DIKLIT']);
});

afterAll(async () => {
  // Delete all applications created during this test run
  for (const id of createdApplicationIds) {
    await pool.query('DELETE FROM applications WHERE id = $1', [id]).catch(() => {});
  }
  // Delete test users
  await pool.query(
    `DELETE FROM users WHERE email LIKE $1`,
    [`test.app.crud.%.${RUN_ID}@example.com`]
  );
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications — Create draft
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications — Create draft', () => {
  describe('Success', () => {
    it('should create a new draft application and return 201', async () => {
      const res = await createDraft(researcherToken);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        status: 'DRAFT',
        group_category: 'MAHASISWA',
        research_title: `Test Research ${RUN_ID}`,
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.application_number).toBeDefined();
    });

    it('should accept all valid group_category values', async () => {
      const categories = ['DOSEN', 'NAKES', 'DOKTER', 'MANDIRI'];
      for (const cat of categories) {
        const res = await createDraft(researcherToken, {
          group_category: cat,
          research_title: `Research ${cat} ${RUN_ID}`,
        });
        expect(res.status).toBe(201);
        expect(res.body.data.group_category).toBe(cat);
      }
    });

    it('should associate the application with the authenticated researcher', async () => {
      const res = await createDraft(researcherToken);

      expect(res.status).toBe(201);
      // Verify by fetching the application — it should be visible to the creator
      const getRes = await request(app)
        .get(`/api/applications/${res.body.data.id}`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(getRes.status).toBe(200);
    });
  });

  describe('Validation errors', () => {
    it('should return 422 when group_category is missing', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ research_title: 'A title' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors.group_category).toBeDefined();
    });

    it('should return 422 when group_category is invalid', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ group_category: 'INVALID', research_title: 'A title' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.group_category).toBeDefined();
    });

    it('should return 422 when research_title is missing', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ group_category: 'MAHASISWA' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.research_title).toBeDefined();
    });

    it('should return 422 when both required fields are missing', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.group_category).toBeDefined();
      expect(res.body.errors.research_title).toBeDefined();
    });
  });

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({ group_category: 'MAHASISWA', research_title: 'Some research' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has DIKLIT role', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${diklatToken}`)
        .send({ group_category: 'MAHASISWA', research_title: 'Some research' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has KETUA role', async () => {
      const chiefToken = makeTokenWithRoles(['KETUA']);
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${chiefToken}`)
        .send({ group_category: 'MAHASISWA', research_title: 'Some research' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 when user has REVIEWER role', async () => {
      const reviewerToken = makeTokenWithRoles(['REVIEWER']);
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ group_category: 'MAHASISWA', research_title: 'Some research' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applications — List
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/applications — List', () => {
  let r1AppId = '';
  let r2AppId = '';

  beforeAll(async () => {
    // Create one application for each researcher
    const r1Res = await createDraft(researcherToken, { research_title: `R1 List Test ${RUN_ID}` });
    r1AppId = r1Res.body.data.id;

    const r2Res = await createDraft(researcherToken2, { research_title: `R2 List Test ${RUN_ID}` });
    r2AppId = r2Res.body.data.id;
  });

  it('should return 200 with a list for an authenticated researcher', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PENELITI should see their own application in the list', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${researcherToken}`);

    const ids = res.body.data.map((a) => a.id);
    expect(ids).toContain(r1AppId);
  });

  it("PENELITI should NOT see another researcher's application in the list", async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${researcherToken}`);

    const ids = res.body.data.map((a) => a.id);
    expect(ids).not.toContain(r2AppId);
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app)
      .get('/api/applications');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applications/:id — Get by ID
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/applications/:id — Get by ID', () => {
  let appId = '';

  beforeAll(async () => {
    const res = await createDraft(researcherToken, { research_title: `Get By ID Test ${RUN_ID}` });
    appId = res.body.data.id;
  });

  it('should return 200 and the application when the owner requests it', async () => {
    const res = await request(app)
      .get(`/api/applications/${appId}`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(appId);
    expect(res.body.data.status).toBe('DRAFT');
  });

  it("should return 404 when another researcher requests the owner's application", async () => {
    const res = await request(app)
      .get(`/api/applications/${appId}`)
      .set('Authorization', `Bearer ${researcherToken2}`);

    // Service returns 404 for ownership (not 403) to avoid enumeration
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when the application does not exist', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/applications/${nonExistentId}`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 for a non-UUID id format', async () => {
    const res = await request(app)
      .get('/api/applications/not-a-uuid')
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app)
      .get(`/api/applications/${appId}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/applications/:id — Update draft
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/applications/:id — Update draft', () => {
  let draftAppId = '';

  beforeAll(async () => {
    const res = await createDraft(researcherToken, { research_title: `Update Test ${RUN_ID}` });
    draftAppId = res.body.data.id;
  });

  it('should return 200 and update a DRAFT application', async () => {
    const updatedTitle = `Updated Title ${RUN_ID}`;
    const res = await request(app)
      .put(`/api/applications/${draftAppId}`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({
        research_title: updatedTitle,
        research_background: 'Updated background information',
        research_objectives: 'Updated objectives',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.research_title).toBe(updatedTitle);
    expect(res.body.data.research_background).toBe('Updated background information');
  });

  it('should persist the updated fields', async () => {
    const getRes = await request(app)
      .get(`/api/applications/${draftAppId}`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.research_title).toBe(`Updated Title ${RUN_ID}`);
  });

  it('should return 403 when another researcher tries to update the application', async () => {
    const res = await request(app)
      .put(`/api/applications/${draftAppId}`)
      .set('Authorization', `Bearer ${researcherToken2}`)
      .send({ research_title: 'Hijacked title' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when the application does not exist', async () => {
    const res = await request(app)
      .put('/api/applications/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({ research_title: 'Nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app)
      .put(`/api/applications/${draftAppId}`)
      .send({ research_title: 'Some update' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 422 when group_category is invalid', async () => {
    const res = await request(app)
      .put(`/api/applications/${draftAppId}`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({ group_category: 'INVALID_CATEGORY' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.group_category).toBeDefined();
  });

  describe('Cannot update a non-DRAFT application', () => {
    let submittedAppId = '';

    beforeAll(async () => {
      // Create a fully filled application and submit it to move it out of DRAFT
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          group_category: 'MAHASISWA',
          research_title: `Submit For Update Block ${RUN_ID}`,
          research_background: 'Background text',
          research_objectives: 'Objectives text',
          research_methodology: 'Methodology text',
          research_location: 'Location text',
          research_institution: 'Institution text',
          research_duration: '3 months',
          data_needed: 'Data needed text',
          purpose: 'Purpose text',
        });
      submittedAppId = createRes.body.data.id;
      createdApplicationIds.push(submittedAppId);

      // Manually set status to SUBMITTED in DB to bypass document requirement
      await pool.query(
        `UPDATE applications SET status = 'SUBMITTED' WHERE id = $1`,
        [submittedAppId]
      );
    });

    it('should return 400 when trying to update a SUBMITTED application', async () => {
      const res = await request(app)
        .put(`/api/applications/${submittedAppId}`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ research_title: 'Attempt to update submitted' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/applications/:id — Delete draft
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/applications/:id — Delete draft', () => {
  it('should return 200 and delete a DRAFT application', async () => {
    // Create a fresh draft specifically for deletion
    const createRes = await createDraft(researcherToken, { research_title: `Delete Me ${RUN_ID}` });
    const appId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/applications/${appId}`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is gone
    const getRes = await request(app)
      .get(`/api/applications/${appId}`)
      .set('Authorization', `Bearer ${researcherToken}`);
    expect(getRes.status).toBe(404);

    // Remove from cleanup list since it's already deleted
    const idx = createdApplicationIds.indexOf(appId);
    if (idx !== -1) createdApplicationIds.splice(idx, 1);
  });

  it('should return 403 when another researcher tries to delete the application', async () => {
    const createRes = await createDraft(researcherToken, { research_title: `Other Delete ${RUN_ID}` });
    const appId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/applications/${appId}`)
      .set('Authorization', `Bearer ${researcherToken2}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when the application does not exist', async () => {
    const res = await request(app)
      .delete('/api/applications/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 when no token is provided', async () => {
    const createRes = await createDraft(researcherToken, { research_title: `Unauth Delete ${RUN_ID}` });
    const appId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/applications/${appId}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  describe('Cannot delete a non-DRAFT application', () => {
    let submittedAppId = '';

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          group_category: 'MAHASISWA',
          research_title: `Submit For Delete Block ${RUN_ID}`,
          research_background: 'Background text',
          research_objectives: 'Objectives text',
          research_methodology: 'Methodology text',
          research_location: 'Location text',
          research_institution: 'Institution text',
          research_duration: '3 months',
          data_needed: 'Data needed text',
          purpose: 'Purpose text',
        });
      submittedAppId = createRes.body.data.id;
      createdApplicationIds.push(submittedAppId);

      // Manually advance status to SUBMITTED in DB
      await pool.query(
        `UPDATE applications SET status = 'SUBMITTED' WHERE id = $1`,
        [submittedAppId]
      );
    });

    it('should return 400 when trying to delete a SUBMITTED application', async () => {
      const res = await request(app)
        .delete(`/api/applications/${submittedAppId}`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

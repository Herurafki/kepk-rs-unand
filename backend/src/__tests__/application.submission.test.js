'use strict';
/**
 * Integration tests — Application Submission
 * Task 16.8: Test application submission
 *
 * Requirements:
 *  - Requirement 7  (Application Submission)
 *  - Requirement 13 (Application Status Workflow)
 *  - Requirement 3  (Role-Based Authorization)
 *  - Requirement 16 (API)
 *  - Requirement 18 (Security)
 *
 * Endpoint under test:
 *  POST /api/applications/:id/submit
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');

const RUN_ID = Date.now();
const uniqueEmail = (tag) => `test.sub.${tag}.${RUN_ID}@example.com`;

// ─── Minimal valid PDF buffer ──────────────────────────────────────────────────
const VALID_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\nxref\n0 1\n' +
  '0000000000 65535 f\ntrailer\n<</Size 1>>\nstartxref\n9\n%%EOF'
);

// ─── Full set of required fields for submission ───────────────────────────────
const FULL_FIELDS = {
  group_category: 'MAHASISWA',
  research_title: `Submission Test ${RUN_ID}`,
  research_background: 'Background of the research',
  research_objectives: 'Objectives of the research',
  research_methodology: 'Methodology of the research',
  research_location: 'Location of the research',
  research_institution: 'Research institution name',
  research_duration: '3 months',
  data_needed: 'Patient records and demographic data',
  purpose: 'To assess health outcomes',
};

// ─── Shared state ─────────────────────────────────────────────────────────────
let researcherToken = '';
let researcher2Token = '';

const createdApplicationIds = [];
const createdDocumentIds = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const registerAndLogin = async (tag) => {
  const email = uniqueEmail(tag);
  const password = 'Password123!';
  await request(app)
    .post('/api/auth/register')
    .send({ name: `Submission Test ${tag}`, email, password });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return loginRes.body.data.access_token;
};

/**
 * Create a minimal draft application and track it for cleanup.
 */
const createDraft = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send({ group_category: 'MAHASISWA', research_title: `Draft ${RUN_ID}`, ...overrides });
  if (res.body.data && res.body.data.id) {
    createdApplicationIds.push(res.body.data.id);
  }
  return res.body.data.id;
};

/**
 * Fill all required submission fields on an existing draft via PUT.
 */
const fillRequiredFields = async (token, appId) => {
  await request(app)
    .put(`/api/applications/${appId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(FULL_FIELDS);
};

/**
 * Upload a valid PDF document to the given application.
 * Returns the document ID.
 */
const uploadDocument = async (token, appId) => {
  const res = await request(app)
    .post(`/api/applications/${appId}/documents`)
    .set('Authorization', `Bearer ${token}`)
    .field('document_type', 'PROPOSAL')
    .attach('file', VALID_PDF, { filename: 'proposal.pdf', contentType: 'application/pdf' });
  if (res.body.data && res.body.data.id) {
    createdDocumentIds.push(res.body.data.id);
  }
  return res.body.data && res.body.data.id;
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  researcherToken = await registerAndLogin('r1');
  researcher2Token = await registerAndLogin('r2');
});

afterAll(async () => {
  // Delete in dependency order: history → documents → applications → users

  for (const appId of createdApplicationIds) {
    await pool.query('DELETE FROM application_status_histories WHERE application_id = $1', [appId]).catch(() => {});
  }
  for (const docId of createdDocumentIds) {
    await pool.query('DELETE FROM documents WHERE id = $1', [docId]).catch(() => {});
  }
  for (const appId of createdApplicationIds) {
    await pool.query('DELETE FROM applications WHERE id = $1', [appId]).catch(() => {});
  }
  await pool.query(
    'DELETE FROM users WHERE email LIKE $1',
    [`test.sub.%.${RUN_ID}@example.com`]
  );
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/submit — Success
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/submit — Success', () => {
  it('1. should submit a fully filled application with a document and return 200 with status SUBMITTED', async () => {
    const appId = await createDraft(researcherToken);
    await fillRequiredFields(researcherToken, appId);
    await uploadDocument(researcherToken, appId);

    const res = await request(app)
      .post(`/api/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.id).toBe(appId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/submit — Invalid status transition
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/submit — Invalid status transition', () => {
  it('2. should return 400 when submitting an already SUBMITTED application', async () => {
    // Create and successfully submit first
    const appId = await createDraft(researcherToken);
    await fillRequiredFields(researcherToken, appId);
    await uploadDocument(researcherToken, appId);

    const firstSubmit = await request(app)
      .post(`/api/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${researcherToken}`);
    expect(firstSubmit.status).toBe(200);

    // Try to submit again
    const res = await request(app)
      .post(`/api/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/submit — Missing required fields
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/submit — Missing required fields', () => {
  it('3. should return 422 with field errors when only the title is filled', async () => {
    // Only research_title is filled (from the initial draft creation)
    const appId = await createDraft(researcherToken, {
      research_title: `Incomplete Draft ${RUN_ID}`,
    });
    // Upload a document so the field check is hit (not the document check)
    await uploadDocument(researcherToken, appId);

    const res = await request(app)
      .post(`/api/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    // Should report multiple missing fields
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.research_background).toBeDefined();
    expect(res.body.errors.research_objectives).toBeDefined();
    expect(res.body.errors.research_methodology).toBeDefined();
    expect(res.body.errors.research_location).toBeDefined();
    expect(res.body.errors.research_institution).toBeDefined();
    expect(res.body.errors.research_duration).toBeDefined();
    expect(res.body.errors.data_needed).toBeDefined();
    expect(res.body.errors.purpose).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/submit — Missing document
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/submit — Missing document', () => {
  it('4. should return 422 when all fields are filled but no document is uploaded', async () => {
    const appId = await createDraft(researcherToken);
    // Fill all required fields but skip document upload
    await fillRequiredFields(researcherToken, appId);

    const res = await request(app)
      .post(`/api/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/document/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/submit — Ownership
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/submit — Ownership enforcement', () => {
  it('5. should return 403 when a different researcher tries to submit the application', async () => {
    const appId = await createDraft(researcherToken);
    await fillRequiredFields(researcherToken, appId);
    await uploadDocument(researcherToken, appId);

    const res = await request(app)
      .post(`/api/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${researcher2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/submit — Authentication
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/submit — Authentication', () => {
  it('6. should return 401 when no token is provided', async () => {
    const appId = await createDraft(researcherToken);

    const res = await request(app)
      .post(`/api/applications/${appId}/submit`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/submit — Not found
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/submit — Not found', () => {
  it('7. should return 404 when the application does not exist', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .post(`/api/applications/${nonExistentId}/submit`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

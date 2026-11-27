'use strict';
/**
 * Integration tests — Document Download
 * Task 16.7: Test document download
 *
 * Requirements:
 *  - Requirement 6  (Document Upload / Download)
 *  - Requirement 3  (Role-Based Authorization)
 *  - Requirement 16 (API)
 *  - Requirement 18 (Security)
 *
 * Endpoint under test:
 *  GET /api/documents/:id/download
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');

const RUN_ID = Date.now();
const uniqueEmail = (tag) => `test.doc.dl.${tag}.${RUN_ID}@example.com`;

// ─── Minimal valid PDF buffer ─────────────────────────────────────────────────
const VALID_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\nxref\n0 1\n' +
  '0000000000 65535 f\ntrailer\n<</Size 1>>\nstartxref\n9\n%%EOF'
);

// ─── Shared state ─────────────────────────────────────────────────────────────
let ownerToken = '';      // researcher 1 — uploads and owns the document
let stranger2Token = '';  // researcher 2 — different user, no access
let diklatToken = '';     // DIKLAT synthetic token — read access to all docs

let applicationId = '';
let uploadedDocumentId = '';

const createdApplicationIds = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const registerAndLogin = async (tag) => {
  const email = uniqueEmail(tag);
  const password = 'Password123!';
  await request(app)
    .post('/api/auth/register')
    .send({ name: `DL Test ${tag}`, email, password });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return loginRes.body.data.access_token;
};

const makeTokenWithRoles = (roles) =>
  jwt.sign(
    {
      sub: `synthetic-${roles.join('-')}-${RUN_ID}`,
      name: 'Synthetic User',
      email: uniqueEmail(`synthetic-${roles.join('-')}`),
      roles,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Create two real researchers
  ownerToken = await registerAndLogin('owner');
  stranger2Token = await registerAndLogin('stranger');
  diklatToken = makeTokenWithRoles(['DIKLAT']);

  // Create a DRAFT application owned by researcher 1
  const appRes = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      group_category: 'MAHASISWA',
      research_title: `Download Test App ${RUN_ID}`,
    });
  applicationId = appRes.body.data.id;
  createdApplicationIds.push(applicationId);

  // Upload a PDF document as researcher 1 — this is the document under test
  const uploadRes = await request(app)
    .post(`/api/applications/${applicationId}/documents`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .field('document_type', 'PROPOSAL')
    .attach('file', VALID_PDF, { filename: 'proposal.pdf', contentType: 'application/pdf' });

  uploadedDocumentId = uploadRes.body.data.id;
});

afterAll(async () => {
  // Documents are cascade-deleted with the application; explicit cleanup is a safety net
  for (const appId of createdApplicationIds) {
    await pool.query('DELETE FROM applications WHERE id = $1', [appId]).catch(() => {});
  }
  await pool.query(
    'DELETE FROM users WHERE email LIKE $1',
    [`test.doc.dl.%.${RUN_ID}@example.com`]
  );
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/documents/:id/download
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/documents/:id/download', () => {
  it('1. owner can download their own document (200 with file content)', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocumentId}/download`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    // Response should be the PDF binary (not a JSON body)
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/attachment/i);
  });

  it('2. returns 401 when no token is provided', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocumentId}/download`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('3. returns 403 when a different researcher tries to download', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocumentId}/download`)
      .set('Authorization', `Bearer ${stranger2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('4. returns 404 when the document ID does not exist', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/documents/${nonExistentId}/download`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('5. DIKLAT role can download documents from any application', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocumentId}/download`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });
});

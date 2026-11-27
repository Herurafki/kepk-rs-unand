'use strict';
/**
 * Integration tests — Document Upload
 * Task 16.6: Test document upload
 *
 * Requirements:
 *  - Requirement 6  (Document Upload)
 *  - Requirement 3  (Role-Based Authorization)
 *  - Requirement 16 (API)
 *  - Requirement 18 (Security)
 *
 * Endpoint under test:
 *  POST /api/applications/:id/documents   (multipart/form-data, field: 'file')
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = require('../app');
const pool = require('../config/database');

const RUN_ID = Date.now();
const uniqueEmail = (tag) => `test.doc.upload.${tag}.${RUN_ID}@example.com`;

// ─── Minimal test file buffers ─────────────────────────────────────────────────
// These buffers carry the correct magic bytes so MIME detection by extension
// and Content-Type header work correctly when sent via supertest's .attach().

/**
 * Minimal valid PDF (enough bytes to pass extension + MIME checks).
 * The MIME type is declared by supertest when we pass { contentType: 'application/pdf' }.
 */
const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<</Size 1>>\nstartxref\n9\n%%EOF');

/**
 * Minimal JPEG (SOI + EOI markers — smallest valid JPEG structure).
 */
const VALID_JPEG = Buffer.from([
  0xff, 0xd8, // SOI
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, // APP0
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xdb, 0x00, 0x43, 0x00,
  ...Array(64).fill(0x10),
  0xff, 0xd9, // EOI
]);

/**
 * Minimal PNG (signature + IHDR + IEND).
 */
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1×1 pixels
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, // bit depth, color, crc
  0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, // IDAT
  0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
  0xe2, 0x21, 0xbc, 0x33,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82, // IEND
]);

/** Plain text — should be rejected */
const INVALID_TEXT = Buffer.from('This is a plain text file that should be rejected.');

/**
 * Buffer that exceeds the default 10 MB limit.
 * Lazily created once so memory is not allocated at module load.
 */
const makeLargeBuffer = () => Buffer.alloc(11 * 1024 * 1024, 0x25); // 11 MB of '%'

// ─── Shared state ─────────────────────────────────────────────────────────────
let researcherToken = '';
let researcher2Token = '';
let diklatToken = '';

let applicationId = ''; // DRAFT application owned by researcher 1
const createdDocumentIds = [];
const createdApplicationIds = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const registerAndLogin = async (tag) => {
  const email = uniqueEmail(tag);
  const password = 'Password123!';
  await request(app)
    .post('/api/auth/register')
    .send({ name: `Upload Test ${tag}`, email, password });
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

const createDraftApplication = async (token) => {
  const res = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send({
      group_category: 'MAHASISWA',
      research_title: `Upload Test App ${RUN_ID}`,
    });
  return res.body.data.id;
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  researcherToken = await registerAndLogin('r1');
  researcher2Token = await registerAndLogin('r2');
  diklatToken = makeTokenWithRoles(['DIKLAT']);

  applicationId = await createDraftApplication(researcherToken);
  createdApplicationIds.push(applicationId);
});

afterAll(async () => {
  // Delete documents created during the run
  for (const docId of createdDocumentIds) {
    await pool.query('DELETE FROM documents WHERE id = $1', [docId]).catch(() => {});
  }
  // Delete applications created during the run
  for (const appId of createdApplicationIds) {
    await pool.query('DELETE FROM applications WHERE id = $1', [appId]).catch(() => {});
  }
  // Delete test users
  await pool.query(
    'DELETE FROM users WHERE email LIKE $1',
    [`test.doc.upload.%.${RUN_ID}@example.com`]
  );
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/documents — Valid uploads
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/documents — Valid file uploads', () => {
  it('1. should upload a valid PDF and return 201 with document metadata', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .field('document_type', 'PROPOSAL')
      .attach('file', VALID_PDF, { filename: 'test.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      application_id: applicationId,
      original_name: 'test.pdf',
      mime_type: 'application/pdf',
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.stored_name).toBeDefined();
    // stored_name should not equal original_name (safe generated filename)
    expect(res.body.data.stored_name).not.toBe('test.pdf');
    if (res.body.data.id) createdDocumentIds.push(res.body.data.id);
  });

  it('2. should upload a valid JPEG and return 201', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .field('document_type', 'ATTACHMENT')
      .attach('file', VALID_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mime_type).toBe('image/jpeg');
    if (res.body.data.id) createdDocumentIds.push(res.body.data.id);
  });

  it('3. should upload a valid PNG and return 201', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .field('document_type', 'ATTACHMENT')
      .attach('file', VALID_PNG, { filename: 'image.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mime_type).toBe('image/png');
    if (res.body.data.id) createdDocumentIds.push(res.body.data.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/documents — Invalid file uploads
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/documents — Invalid file uploads', () => {
  it('4. should return 400 when an invalid MIME type (.txt) is uploaded', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .attach('file', INVALID_TEXT, { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('5. should return 413 when the file exceeds the maximum size', async () => {
    const largeBuffer = makeLargeBuffer();
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .attach('file', largeBuffer, { filename: 'huge.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it('6. should return 400 when no file is attached', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .field('document_type', 'PROPOSAL');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/documents — Authentication
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/documents — Authentication', () => {
  it('7. should return 401 when no token is provided', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .attach('file', VALID_PDF, { filename: 'test.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('8. should return 403 when a DIKLAT user tries to upload', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .attach('file', VALID_PDF, { filename: 'test.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/:id/documents — Ownership
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/applications/:id/documents — Ownership enforcement', () => {
  it('9. should return 403 when a different researcher tries to upload to another researcher\'s application', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${researcher2Token}`)
      .attach('file', VALID_PDF, { filename: 'test.pdf', contentType: 'application/pdf' });

    // Role middleware passes (RESEARCHER role ok), but ownership check in service returns 403
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

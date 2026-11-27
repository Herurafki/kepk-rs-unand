'use strict';
/**
 * Integration tests — Revision Workflow
 * Task 16.10: Test revision workflow
 *
 * Requirements:
 *  - Requirement 9  (Application Revision)
 *  - Requirement 13 (Application Status Workflow)
 *  - Requirement 14 (Application Status History)
 *  - Requirement 3  (Role-Based Authorization)
 *  - Requirement 18 (Security)
 *
 * Endpoint under test:
 *  POST /api/applications/:id/revise
 *
 * Revision flow:
 *  DRAFT → SUBMITTED → ADMIN_REVIEW → REVISION_REQUIRED → SUBMITTED (→ repeat)
 *
 * Step-by-step per test:
 *  1. Researcher submits (DRAFT → SUBMITTED)
 *  2. DIKLIT opens     (SUBMITTED → ADMIN_REVIEW)
 *  3. DIKLIT requests revision (ADMIN_REVIEW → REVISION_REQUIRED, with note)
 *  4. Researcher calls POST /api/applications/:id/revise  (REVISION_REQUIRED → SUBMITTED)
 *
 * PREREQUISITE: PostgreSQL must be running and the DB configured in .env
 * must exist with the correct schema applied.
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../app');
const pool = require('../config/database');

const RUN_ID = Date.now();

// ─── Shared auth state ────────────────────────────────────────────────────────
let researcherToken = '';
let researcher2Token = '';
let diklatToken = '';

// ─── Tracked IDs for cleanup ──────────────────────────────────────────────────
const trackedApplicationIds = [];
const trackedDocumentIds = [];
const trackedUserEmails = [];

// ─── Minimal valid PDF buffer (passes MIME + extension validation) ─────────────
const VALID_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\nxref\n0 1\n' +
  '0000000000 65535 f\ntrailer\n<</Size 1>>\nstartxref\n9\n%%EOF'
);

// ─── Full set of required application fields (passes submission validation) ───
const FULL_FIELDS = {
  group_category: 'MAHASISWA',
  research_title: `Revision Test ${RUN_ID}`,
  research_background: 'Background of the revision test research',
  research_objectives: 'Objectives of the revision test research',
  research_methodology: 'Quantitative methodology for revision testing',
  research_location: 'RSUP Dr. Sardjito',
  research_institution: 'Universitas Gadjah Mada',
  research_duration: '3 bulan',
  data_needed: 'Rekam medis pasien',
  purpose: 'Penyusunan tugas akhir',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Register a PENELITI via the public API and return their JWT.
 */
const registerResearcher = async (tag) => {
  const email = `test.rev.${tag}.${RUN_ID}@example.com`;
  const password = 'Password123!';
  trackedUserEmails.push(email);
  await request(app)
    .post('/api/auth/register')
    .send({ name: `Revision Test ${tag}`, email, password });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return loginRes.body.data.access_token;
};

/**
 * Seed a real DIKLIT user directly in the DB (cannot self-register).
 * Required because changed_by in application_status_histories has a FK
 * constraint to users.
 */
const seedDiklatUser = async () => {
  const email = `diklat.rev.${RUN_ID}@kepk.test`;
  const password = 'Diklat123!';
  trackedUserEmails.push(email);

  const hashedPassword = await bcrypt.hash(password, 10);

  const userRes = await pool.query(
    `INSERT INTO users (id, name, email, password, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
     RETURNING id`,
    ['Petugas Diklat Revision Test', email, hashedPassword]
  );
  const userId = userRes.rows[0].id;

  const roleRes = await pool.query(`SELECT id FROM roles WHERE name = 'DIKLIT'`);
  const roleId = roleRes.rows[0].id;

  await pool.query(
    `INSERT INTO user_roles (id, user_id, role_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, NOW())`,
    [userId, roleId]
  );

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return { userId, token: loginRes.body.data?.access_token };
};

/**
 * Create a minimal DRAFT application and track it for cleanup.
 */
const createDraft = async (token) => {
  const res = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send({ group_category: 'MAHASISWA', research_title: `Draft ${RUN_ID}` });
  const id = res.body.data?.id;
  if (id) trackedApplicationIds.push(id);
  return id;
};

/**
 * Fill all required submission fields on a draft application via PUT.
 */
const fillFields = async (token, appId) => {
  await request(app)
    .put(`/api/applications/${appId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(FULL_FIELDS);
};

/**
 * Upload a valid PDF to the given application and track the document.
 */
const uploadDocument = async (token, appId) => {
  const res = await request(app)
    .post(`/api/applications/${appId}/documents`)
    .set('Authorization', `Bearer ${token}`)
    .field('document_type', 'PROPOSAL')
    .attach('file', VALID_PDF, { filename: 'proposal.pdf', contentType: 'application/pdf' });
  if (res.body.data?.id) trackedDocumentIds.push(res.body.data.id);
};

/**
 * Bring an application to SUBMITTED status (DRAFT → SUBMITTED).
 */
const getSubmittedApp = async (token) => {
  const appId = await createDraft(token);
  await fillFields(token, appId);
  await uploadDocument(token, appId);
  await request(app)
    .post(`/api/applications/${appId}/submit`)
    .set('Authorization', `Bearer ${token}`);
  return appId;
};

/**
 * Bring an application to REVISION_REQUIRED status.
 * DRAFT → SUBMITTED → ADMIN_REVIEW → REVISION_REQUIRED
 */
const getRevisionRequiredApp = async (researcherTok, diklatTok, note = 'Mohon lengkapi dokumen persyaratan.') => {
  const appId = await getSubmittedApp(researcherTok);
  // SUBMITTED → ADMIN_REVIEW
  await request(app)
    .post(`/api/admin/applications/${appId}/open`)
    .set('Authorization', `Bearer ${diklatTok}`);
  // ADMIN_REVIEW → REVISION_REQUIRED
  await request(app)
    .post(`/api/admin/applications/${appId}/revision`)
    .set('Authorization', `Bearer ${diklatTok}`)
    .send({ note });
  return appId;
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  researcherToken = await registerResearcher('r1');
  researcher2Token = await registerResearcher('r2');
  const diklat = await seedDiklatUser();
  diklatToken = diklat.token;
});

afterAll(async () => {
  // Clean up in FK-safe order
  for (const appId of trackedApplicationIds) {
    await pool.query('DELETE FROM application_status_histories WHERE application_id = $1', [appId]).catch(() => {});
    await pool.query('DELETE FROM revisions WHERE application_id = $1', [appId]).catch(() => {});
  }
  for (const docId of trackedDocumentIds) {
    await pool.query('DELETE FROM documents WHERE id = $1', [docId]).catch(() => {});
  }
  for (const appId of trackedApplicationIds) {
    await pool.query('DELETE FROM applications WHERE id = $1', [appId]).catch(() => {});
  }
  for (const email of trackedUserEmails) {
    const u = await pool.query('SELECT id FROM users WHERE email = $1', [email]).catch(() => ({ rows: [] }));
    if (u.rows[0]) {
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [u.rows[0].id]).catch(() => {});
    }
  }
  await pool.query(
    `DELETE FROM users WHERE email = ANY($1)`,
    [trackedUserEmails]
  ).catch(() => {});
  await pool.end();
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/applications/:id/revise — Full revision cycle
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/applications/:id/revise — Full revision cycle', () => {
  it('1. Researcher can revise a REVISION_REQUIRED application and status becomes SUBMITTED', async () => {
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.id).toBe(appId);
  });

  it('2. Revise records REVISION_REQUIRED→SUBMITTED in status history', async () => {
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken);

    await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(histRes.status).toBe(200);
    const history = histRes.body.data || [];
    const entry = history.find(
      (h) => h.previous_status === 'REVISION_REQUIRED' && h.new_status === 'SUBMITTED'
    );
    expect(entry).toBeDefined();
    expect(entry.changed_by).toBeTruthy();
  });

  it('3. Researcher can update application fields while revising', async () => {
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken);

    const updatedTitle = `Updated Title After Revision ${RUN_ID}`;
    const res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({ research_title: updatedTitle });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  it('4. Full two-cycle revision: REVISION_REQUIRED→SUBMITTED→ADMIN_REVIEW→REVISION_REQUIRED→SUBMITTED', async () => {
    // Cycle 1
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken, 'Siklus revisi pertama.');

    const revise1Res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    expect(revise1Res.status).toBe(200);
    expect(revise1Res.body.data.status).toBe('SUBMITTED');

    // Diklat opens again: SUBMITTED → ADMIN_REVIEW
    const open2Res = await request(app)
      .post(`/api/admin/applications/${appId}/open`)
      .set('Authorization', `Bearer ${diklatToken}`);
    expect(open2Res.status).toBe(200);
    expect(open2Res.body.data.status).toBe('ADMIN_REVIEW');

    // Diklat requests revision again: ADMIN_REVIEW → REVISION_REQUIRED
    const revision2Res = await request(app)
      .post(`/api/admin/applications/${appId}/revision`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({ note: 'Siklus revisi kedua.' });
    expect(revision2Res.status).toBe(200);
    expect(revision2Res.body.data.status).toBe('REVISION_REQUIRED');

    // Cycle 2: researcher revises again
    const revise2Res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    expect(revise2Res.status).toBe(200);
    expect(revise2Res.body.data.status).toBe('SUBMITTED');

    // History should contain two REVISION_REQUIRED→SUBMITTED entries
    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    const history = histRes.body.data || [];
    const reviseEntries = history.filter(
      (h) => h.previous_status === 'REVISION_REQUIRED' && h.new_status === 'SUBMITTED'
    );
    expect(reviseEntries.length).toBeGreaterThanOrEqual(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/applications/:id/revise — Revision note visible in history
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/applications/:id/revise — Revision note visible in history', () => {
  it('5. Researcher can see the DIKLIT revision note in the application history', async () => {
    const revisionNote = 'Lampirkan surat keterangan dari institusi penelitian.';
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken, revisionNote);

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(histRes.status).toBe(200);
    const history = histRes.body.data || [];
    const revisionEntry = history.find(
      (h) => h.new_status === 'REVISION_REQUIRED'
    );
    expect(revisionEntry).toBeDefined();
    expect(revisionEntry.note).toBe(revisionNote);
  });

  it('6. Full history audit trail contains all expected status transitions', async () => {
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken, 'Audit trail test note.');

    await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(histRes.status).toBe(200);
    const history = histRes.body.data || [];
    const statuses = history.map((h) => h.new_status);

    // Expect the full breadcrumb to be present
    expect(statuses).toContain('SUBMITTED');
    expect(statuses).toContain('ADMIN_REVIEW');
    expect(statuses).toContain('REVISION_REQUIRED');

    // The final SUBMITTED entry should come after REVISION_REQUIRED
    const revisionIdx = history.findIndex((h) => h.new_status === 'REVISION_REQUIRED');
    const resubmitIdx = history.findLastIndex((h) => h.new_status === 'SUBMITTED');
    expect(resubmitIdx).toBeGreaterThan(revisionIdx);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/applications/:id/revise — Invalid status transitions
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/applications/:id/revise — Invalid status transitions', () => {
  it('7. Cannot revise a DRAFT application — returns 400', async () => {
    // A fresh draft has never been submitted, so it is in DRAFT status
    const appId = await createDraft(researcherToken);
    await fillFields(researcherToken, appId);
    await uploadDocument(researcherToken, appId);

    const res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('8. Cannot revise an already SUBMITTED application — returns 400', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('9. Cannot revise an ADMIN_REVIEW application — returns 400', async () => {
    // Open a SUBMITTED app to ADMIN_REVIEW but do NOT request revision
    const appId = await getSubmittedApp(researcherToken);
    await request(app)
      .post(`/api/admin/applications/${appId}/open`)
      .set('Authorization', `Bearer ${diklatToken}`);

    const res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('10. Cannot revise twice without a new revision request — second call returns 400', async () => {
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken);

    // First revise succeeds
    const firstRes = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.data.status).toBe('SUBMITTED');

    // Second revise on the now-SUBMITTED application should fail
    const secondRes = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});
    expect(secondRes.status).toBe(400);
    expect(secondRes.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/applications/:id/revise — Authentication
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/applications/:id/revise — Authentication', () => {
  it('11. No token → 401', async () => {
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/applications/:id/revise — Ownership
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/applications/:id/revise — Ownership enforcement', () => {
  it('12. Another researcher cannot revise someone else\'s application — returns 403', async () => {
    const appId = await getRevisionRequiredApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/applications/${appId}/revise`)
      .set('Authorization', `Bearer ${researcher2Token}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/applications/:id/revise — Not found
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/applications/:id/revise — Not found', () => {
  it('13. Non-existent application ID → 404', async () => {
    const res = await request(app)
      .post('/api/applications/00000000-0000-0000-0000-000000000000/revise')
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

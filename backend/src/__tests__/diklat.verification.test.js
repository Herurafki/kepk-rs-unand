'use strict';
/**
 * Integration tests — Diklat (Administrative) Verification
 * Task 16.9: Test Diklat verification
 *
 * Requirements:
 *  - Requirement 8  (Administrative Verification)
 *  - Requirement 13 (Application Status Workflow)
 *  - Requirement 3  (Role-Based Authorization)
 *  - Requirement 14 (Application Status History)
 *  - Requirement 16 (API)
 *  - Requirement 18 (Security)
 *
 * Endpoints under test (all under /api/admin):
 *  GET  /api/admin/applications
 *  GET  /api/admin/applications/:id
 *  POST /api/admin/applications/:id/open
 *  POST /api/admin/applications/:id/revision
 *  POST /api/admin/applications/:id/reject
 *  POST /api/admin/applications/:id/approve-without-ethics
 *  POST /api/admin/applications/:id/approve-with-ethics
 *
 * NOTE: DIKLIT role cannot self-register through the public API.
 *       A real DIKLIT user must be seeded directly into the DB so that the
 *       `changed_by` FK in application_status_histories resolves correctly.
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
let diklatUserId = '';

// ─── Tracked IDs for cleanup ──────────────────────────────────────────────────
const trackedApplicationIds = [];
const trackedDocumentIds = [];
const trackedUserEmails = [];

// ─── Minimal valid PDF ────────────────────────────────────────────────────────
const VALID_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\nxref\n0 1\n' +
  '0000000000 65535 f\ntrailer\n<</Size 1>>\nstartxref\n9\n%%EOF'
);

// ─── Full set of required application fields ──────────────────────────────────
const FULL_FIELDS = {
  group_category: 'MAHASISWA',
  research_title: `Diklat Test ${RUN_ID}`,
  research_background: 'Background of the research',
  research_objectives: 'Objectives of the research',
  research_methodology: 'Quantitative methodology',
  research_location: 'RSUP Dr. Sardjito',
  research_institution: 'Universitas Gadjah Mada',
  research_duration: '3 bulan',
  data_needed: 'Rekam medis pasien',
  purpose: 'Penyusunan tugas akhir',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Register a PENELITI via API and return their access token.
 */
const registerResearcher = async (tag) => {
  const email = `test.diklat.${tag}.${RUN_ID}@example.com`;
  const password = 'Password123!';
  trackedUserEmails.push(email);
  await request(app)
    .post('/api/auth/register')
    .send({ name: `Diklat Test ${tag}`, email, password });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return loginRes.body.data.access_token;
};

/**
 * Seed a real DIKLIT user directly in the DB (DIKLIT cannot self-register).
 * Returns { userId, token }.
 *
 * A real DB user is required because `changed_by` in
 * application_status_histories has a FK constraint to users.
 */
const seedDiklatUser = async () => {
  const email = `diklat.${RUN_ID}@kepk.test`;
  const password = 'Diklat123!';
  trackedUserEmails.push(email);

  const hashedPassword = await bcrypt.hash(password, 10);

  const userRes = await pool.query(
    `INSERT INTO users (id, name, email, password, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
     RETURNING id`,
    ['Petugas Diklat Test', email, hashedPassword]
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
  const token = loginRes.body.data?.access_token;

  return { userId, token };
};

/**
 * Create a DRAFT application and track its ID.
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
 * Fill all required submission fields via PUT.
 */
const fillFields = async (token, appId) => {
  await request(app)
    .put(`/api/applications/${appId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(FULL_FIELDS);
};

/**
 * Upload a valid PDF document to the given application.
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
 * Helper: bring an application to SUBMITTED status.
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
 * Helper: bring an application to ADMIN_REVIEW status.
 */
const getAdminReviewApp = async (researcherTok, diklatTok) => {
  const appId = await getSubmittedApp(researcherTok);
  await request(app)
    .post(`/api/admin/applications/${appId}/open`)
    .set('Authorization', `Bearer ${diklatTok}`);
  return appId;
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Seed users
  researcherToken = await registerResearcher('r1');
  researcher2Token = await registerResearcher('r2');
  const diklat = await seedDiklatUser();
  diklatToken = diklat.token;
  diklatUserId = diklat.userId;
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
  // Remove user_roles before users
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
// GET /api/admin/applications — List
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/applications — List', () => {
  it('1. DIKLIT can list applications and receives 200', async () => {
    // Ensure at least one SUBMITTED app exists
    await getSubmittedApp(researcherToken);

    const res = await request(app)
      .get('/api/admin/applications')
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('2. PENELITI cannot access the admin queue and receives 403', async () => {
    const res = await request(app)
      .get('/api/admin/applications')
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('3. Unauthenticated request returns 401', async () => {
    const res = await request(app)
      .get('/api/admin/applications');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('4. A freshly submitted application appears in the admin queue', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .get('/api/admin/applications')
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body.data || []).map((a) => a.id);
    expect(ids).toContain(appId);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/applications/:id — Detail
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/applications/:id — Detail', () => {
  it('5. DIKLIT can retrieve application detail and receives 200', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .get(`/api/admin/applications/${appId}`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(appId);
  });

  it('6. Detail response includes a documents array', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .get(`/api/admin/applications/${appId}`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.documents)).toBe(true);
    expect(res.body.data.documents.length).toBeGreaterThan(0);
  });

  it('7. Returns 404 for a non-existent application ID', async () => {
    const res = await request(app)
      .get('/api/admin/applications/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/applications/:id/open — SUBMITTED → ADMIN_REVIEW
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/applications/:id/open — SUBMITTED → ADMIN_REVIEW', () => {
  it('8. DIKLIT can open a SUBMITTED application and receives 200', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/open`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ADMIN_REVIEW');
  });

  it('9. Opening a SUBMITTED application records SUBMITTED→ADMIN_REVIEW in status history', async () => {
    const appId = await getSubmittedApp(researcherToken);

    await request(app)
      .post(`/api/admin/applications/${appId}/open`)
      .set('Authorization', `Bearer ${diklatToken}`);

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(histRes.status).toBe(200);
    const history = histRes.body.data || [];
    const entry = history.find(
      (h) => h.previous_status === 'SUBMITTED' && h.new_status === 'ADMIN_REVIEW'
    );
    expect(entry).toBeDefined();
    expect(entry.changed_by).toBeTruthy();
  });

  it('10. Cannot open a DRAFT application (invalid transition) — returns 400', async () => {
    const appId = await createDraft(researcherToken);
    await fillFields(researcherToken, appId);
    await uploadDocument(researcherToken, appId);
    // Do NOT submit — leave it as DRAFT

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/open`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('11. Cannot open an already ADMIN_REVIEW application (invalid transition) — returns 400', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/open`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('12. PENELITI cannot open an application — returns 403', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/open`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('13. Unauthenticated open request returns 401', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/open`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('14. Open on non-existent application returns 404', async () => {
    const res = await request(app)
      .post('/api/admin/applications/00000000-0000-0000-0000-000000000000/open')
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/applications/:id/revision — ADMIN_REVIEW → REVISION_REQUIRED
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/applications/:id/revision — Revision request', () => {
  it('15. DIKLIT can request revision from ADMIN_REVIEW and receives 200 with REVISION_REQUIRED status', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);
    const note = 'Dokumen persyaratan tidak lengkap.';

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/revision`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({ note });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('REVISION_REQUIRED');
  });

  it('16. Revision request records ADMIN_REVIEW→REVISION_REQUIRED in status history with the note', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);
    const note = 'Data penelitian belum lengkap.';

    await request(app)
      .post(`/api/admin/applications/${appId}/revision`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({ note });

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    const history = histRes.body.data || [];
    const entry = history.find(
      (h) => h.previous_status === 'ADMIN_REVIEW' && h.new_status === 'REVISION_REQUIRED'
    );
    expect(entry).toBeDefined();
    expect(entry.note).toBe(note);
    expect(entry.changed_by).toBeTruthy();
  });

  it('17. Missing note returns 422', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/revision`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('18. Blank (whitespace-only) note returns 422', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/revision`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({ note: '   ' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('19. Cannot request revision from SUBMITTED (not ADMIN_REVIEW) — returns 400', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/revision`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({ note: 'Some note' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('20. PENELITI cannot request revision — returns 403', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/revision`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({ note: 'note' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/applications/:id/reject — ADMIN_REVIEW → REJECTED
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/applications/:id/reject — Rejection', () => {
  it('21. DIKLIT can reject an ADMIN_REVIEW application and receives 200 with REJECTED status', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);
    const note = 'Pengajuan tidak memenuhi syarat administrasi.';

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({ note });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('REJECTED');
  });

  it('22. Rejection records ADMIN_REVIEW→REJECTED in status history', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);
    const note = 'Dokumen tidak valid.';

    await request(app)
      .post(`/api/admin/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({ note });

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    const history = histRes.body.data || [];
    const entry = history.find(
      (h) => h.previous_status === 'ADMIN_REVIEW' && h.new_status === 'REJECTED'
    );
    expect(entry).toBeDefined();
    expect(entry.changed_by).toBeTruthy();
  });

  it('23. Rejection without note still succeeds — note is optional for rejection', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
  });

  it('24. Cannot reject from SUBMITTED (not ADMIN_REVIEW) — returns 400', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${diklatToken}`)
      .send({ note: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('25. PENELITI cannot reject an application — returns 403', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({ note: 'note' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/applications/:id/approve-without-ethics — ADMIN_REVIEW → ADMIN_APPROVED
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/applications/:id/approve-without-ethics — Approval (no ethics)', () => {
  it('26. DIKLIT can approve-without-ethics from ADMIN_REVIEW and receives 200 with APPROVED status', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/approve-without-ethics`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('27. Approval records ADMIN_REVIEW→APPROVED in status history', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    await request(app)
      .post(`/api/admin/applications/${appId}/approve-without-ethics`)
      .set('Authorization', `Bearer ${diklatToken}`);

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    const history = histRes.body.data || [];
    const entry = history.find(
      (h) => h.previous_status === 'ADMIN_REVIEW' && h.new_status === 'APPROVED'
    );
    expect(entry).toBeDefined();
    expect(entry.changed_by).toBeTruthy();
  });

  it('28. Cannot approve-without-ethics from SUBMITTED (not ADMIN_REVIEW) — returns 400', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/approve-without-ethics`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('29. PENELITI cannot approve-without-ethics — returns 403', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/approve-without-ethics`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/applications/:id/approve-with-ethics — ADMIN_REVIEW → ADMIN_APPROVED
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/applications/:id/approve-with-ethics — Approval (with ethics)', () => {
  it('30. DIKLIT can approve-with-ethics from ADMIN_REVIEW and receives 200 with REQUIRED_ETHICS status', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/approve-with-ethics`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('REQUIRED_ETHICS');
  });

  it('31. Approval-with-ethics records ADMIN_REVIEW→REQUIRED_ETHICS in status history', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    await request(app)
      .post(`/api/admin/applications/${appId}/approve-with-ethics`)
      .set('Authorization', `Bearer ${diklatToken}`);

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    const history = histRes.body.data || [];
    const entry = history.find(
      (h) => h.previous_status === 'ADMIN_REVIEW' && h.new_status === 'REQUIRED_ETHICS'
    );
    expect(entry).toBeDefined();
    expect(entry.changed_by).toBeTruthy();
  });

  it('32. Cannot approve-with-ethics from SUBMITTED (not ADMIN_REVIEW) — returns 400', async () => {
    const appId = await getSubmittedApp(researcherToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/approve-with-ethics`)
      .set('Authorization', `Bearer ${diklatToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('33. PENELITI cannot approve-with-ethics — returns 403', async () => {
    const appId = await getAdminReviewApp(researcherToken, diklatToken);

    const res = await request(app)
      .post(`/api/admin/applications/${appId}/approve-with-ethics`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

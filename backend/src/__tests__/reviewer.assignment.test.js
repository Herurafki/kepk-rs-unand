'use strict';
/**
 * Integration tests — Reviewer Assignment Workflow
 * Task 16.11: Test reviewer assignment
 *
 * Requirements:
 *  - Requirement 10 (Reviewer Assignment)
 *  - Requirement 11 (Review Process — access control)
 *  - Requirement 13 (Application Status Workflow)
 *  - Requirement 3  (Role-Based Authorization)
 *  - Requirement 14 (Application Status History)
 *  - Requirement 16 (API)
 *  - Requirement 18 (Security)
 *
 * Endpoints under test:
 *  GET  /api/assignments/reviewers                          — list available reviewers
 *  POST /api/assignments/applications/:id/assign           — assign reviewer (KETUA)
 *  POST /api/assignments/:id/accept                        — reviewer accepts assignment
 *  POST /api/assignments/:id/reject                        — reviewer rejects assignment
 *
 * State path to reach WAITING_REVIEWER:
 *   create draft
 *   → fill fields
 *   → upload document
 *   → submit           (DRAFT → SUBMITTED)
 *   → open             (SUBMITTED → ADMIN_REVIEW)         [DIKLIT]
 *   → approve-with-ethics (ADMIN_REVIEW → ADMIN_APPROVED) [DIKLIT]
 *   → sekretaris forward  (ADMIN_APPROVED → WAITING_REVIEWER) [SEKRETARIAT]
 *
 * NOTE: DIKLIT, SEKRETARIAT, KETUA and REVIEWER cannot self-register.
 *       They are seeded directly into the DB so FK constraints are satisfied.
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
let diklatToken = '';
let sekretarisToken = '';
let chiefToken = '';
let reviewerToken = '';
let reviewer2Token = '';

let chiefUserId = '';
let reviewerUserId = '';
let reviewer2UserId = '';
let diklatUserId = '';
let sekretarisUserId = '';

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
  research_title: `Assignment Test ${RUN_ID}`,
  research_background: 'Background for assignment integration test',
  research_objectives: 'Objectives for assignment integration test',
  research_methodology: 'Quantitative methodology',
  research_location: 'RSUP Dr. Sardjito',
  research_institution: 'Universitas Gadjah Mada',
  research_duration: '3 bulan',
  data_needed: 'Rekam medis pasien',
  purpose: 'Penyusunan tugas akhir',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Register a PENELITI via the public API and return their access token.
 */
const registerResearcher = async (tag) => {
  const email = `test.assign.${tag}.${RUN_ID}@example.com`;
  const password = 'Password123!';
  trackedUserEmails.push(email);
  await request(app)
    .post('/api/auth/register')
    .send({ name: `Assignment Test ${tag}`, email, password });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return loginRes.body.data.access_token;
};

/**
 * Seed a user with the given role directly in the DB.
 * Returns { userId, token }.
 */
const seedUserWithRole = async (tag, roleName) => {
  const email = `${tag}.${RUN_ID}@kepk.test`;
  const password = 'Test123!';
  trackedUserEmails.push(email);

  const hashedPassword = await bcrypt.hash(password, 10);

  const userRes = await pool.query(
    `INSERT INTO users (id, name, email, password, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
     RETURNING id`,
    [`${roleName} Test ${RUN_ID}`, email, hashedPassword]
  );
  const userId = userRes.rows[0].id;

  const roleRes = await pool.query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
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
 * Upload a minimal valid PDF document.
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
 * Bring an application to WAITING_REVIEWER status.
 * Path: DRAFT → SUBMITTED → ADMIN_REVIEW → ADMIN_APPROVED → WAITING_REVIEWER
 */
const getWaitingReviewerApp = async () => {
  const appId = await createDraft(researcherToken);
  await fillFields(researcherToken, appId);
  await uploadDocument(researcherToken, appId);

  // Submit
  await request(app)
    .post(`/api/applications/${appId}/submit`)
    .set('Authorization', `Bearer ${researcherToken}`);

  // DIKLIT: SUBMITTED → ADMIN_REVIEW
  await request(app)
    .post(`/api/admin/applications/${appId}/open`)
    .set('Authorization', `Bearer ${diklatToken}`);

  // DIKLIT: ADMIN_REVIEW → ADMIN_APPROVED
  await request(app)
    .post(`/api/admin/applications/${appId}/approve-with-ethics`)
    .set('Authorization', `Bearer ${diklatToken}`);

  // SEKRETARIAT: ADMIN_APPROVED → WAITING_REVIEWER
  await request(app)
    .post(`/api/sekretaris/applications/${appId}/forward`)
    .set('Authorization', `Bearer ${sekretarisToken}`);

  return appId;
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  researcherToken = await registerResearcher('r1');

  const diklat = await seedUserWithRole('diklat', 'DIKLIT');
  diklatToken = diklat.token;
  diklatUserId = diklat.userId;

  const sekretaris = await seedUserWithRole('sekretaris', 'SEKRETARIAT');
  sekretarisToken = sekretaris.token;
  sekretarisUserId = sekretaris.userId;

  const chief = await seedUserWithRole('chief', 'KETUA');
  chiefToken = chief.token;
  chiefUserId = chief.userId;

  const reviewer = await seedUserWithRole('reviewer1', 'REVIEWER');
  reviewerToken = reviewer.token;
  reviewerUserId = reviewer.userId;

  const reviewer2 = await seedUserWithRole('reviewer2', 'REVIEWER');
  reviewer2Token = reviewer2.token;
  reviewer2UserId = reviewer2.userId;
}, 30000);

afterAll(async () => {
  // Clean in FK-safe order
  for (const appId of trackedApplicationIds) {
    await pool.query('DELETE FROM reviews WHERE application_id = $1', [appId]).catch(() => {});
    await pool.query('DELETE FROM review_assignments WHERE application_id = $1', [appId]).catch(() => {});
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
// GET /api/assignments/reviewers — List available reviewers
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/assignments/reviewers — List available reviewers', () => {
  it('1. KETUA can list available reviewers and receives 200', async () => {
    const res = await request(app)
      .get('/api/assignments/reviewers')
      .set('Authorization', `Bearer ${chiefToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('2. Reviewer list includes the seeded REVIEWER user', async () => {
    const res = await request(app)
      .get('/api/assignments/reviewers')
      .set('Authorization', `Bearer ${chiefToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body.data || []).map((r) => r.id);
    expect(ids).toContain(reviewerUserId);
  });

  it('3. PENELITI cannot access reviewer list — returns 403', async () => {
    const res = await request(app)
      .get('/api/assignments/reviewers')
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('4. Unauthenticated request returns 401', async () => {
    const res = await request(app)
      .get('/api/assignments/reviewers');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/assignments/applications/:id/assign — Assign reviewer
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/assignments/applications/:id/assign — Assign reviewer', () => {
  it('5. KETUA can assign a reviewer to a WAITING_REVIEWER application — returns 201', async () => {
    const appId = await getWaitingReviewerApp();

    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      application_id: appId,
      reviewer_id: reviewerUserId,
    });
  });

  it('6. Assignment records assigned_by and assigned_at', async () => {
    const appId = await getWaitingReviewerApp();

    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    expect(res.status).toBe(201);
    expect(res.body.data.assigned_by).toBe(chiefUserId);
    expect(res.body.data.assigned_at).toBeTruthy();
  });

  it('7. Assignment status is PENDING after creation', async () => {
    const appId = await getWaitingReviewerApp();

    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('8. Cannot assign reviewer to app not in WAITING_REVIEWER — returns 400', async () => {
    // Create a SUBMITTED app (not yet at WAITING_REVIEWER)
    const appId = await createDraft(researcherToken);
    await fillFields(researcherToken, appId);
    await uploadDocument(researcherToken, appId);
    await request(app)
      .post(`/api/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${researcherToken}`);

    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('9. Cannot assign duplicate active reviewer to same application — returns 409', async () => {
    const appId = await getWaitingReviewerApp();

    // First assignment
    await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    // Duplicate attempt
    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('10. PENELITI cannot assign a reviewer — returns 403', async () => {
    const appId = await getWaitingReviewerApp();

    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({ reviewer_id: reviewerUserId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('11. Missing reviewer_id in body returns 422 or 400', async () => {
    const appId = await getWaitingReviewerApp();

    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({});

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('12. Different reviewers can both be assigned to the same app', async () => {
    const appId = await getWaitingReviewerApp();

    const first = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    const second = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewer2UserId });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it('13. Unauthenticated request returns 401', async () => {
    const appId = await getWaitingReviewerApp();

    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .send({ reviewer_id: reviewerUserId });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/assignments/:id/accept — Reviewer accepts assignment
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/assignments/:id/accept — Reviewer accepts assignment', () => {
  it('14. Reviewer can accept their own PENDING assignment — returns 200', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/accept`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACCEPTED');
  });

  it('15. Accepted assignment has accepted_at timestamp', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/accept`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.accepted_at).toBeTruthy();
  });

  it('16. A different (non-assigned) reviewer cannot accept the assignment — returns 403', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    // reviewer2 tries to accept reviewer1's assignment
    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/accept`)
      .set('Authorization', `Bearer ${reviewer2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('17. KETUA cannot accept an assignment (wrong role) — returns 403', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/accept`)
      .set('Authorization', `Bearer ${chiefToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('18. Cannot accept an already ACCEPTED assignment — returns 400', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    // Accept once
    await request(app)
      .post(`/api/assignments/${assignmentId}/accept`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    // Try again
    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/accept`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('19. Accepting with EXPEDITED review type transitions app to UNDER_REVIEW', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId, review_type: 'EXPEDITED' });
    const assignmentId = assignRes.body.data.id;

    await request(app)
      .post(`/api/assignments/${assignmentId}/accept`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    // Check app status
    const appRes = await request(app)
      .get(`/api/applications/${appId}`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(appRes.body.data.status).toBe('UNDER_REVIEW');
  });

  it('20. Accept records WAITING_REVIEWER→UNDER_REVIEW in status history when conditions met', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId, review_type: 'EXPEDITED' });
    const assignmentId = assignRes.body.data.id;

    await request(app)
      .post(`/api/assignments/${assignmentId}/accept`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    const history = histRes.body.data || [];
    const entry = history.find(
      (h) => h.previous_status === 'WAITING_REVIEWER' && h.new_status === 'UNDER_REVIEW'
    );
    expect(entry).toBeDefined();
  });

  it('21. Unauthenticated accept request returns 401', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/accept`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/assignments/:id/reject — Reviewer rejects assignment
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/assignments/:id/reject — Reviewer rejects assignment', () => {
  it('22. Reviewer can reject their own PENDING assignment — returns 200', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/reject`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('REJECTED');
  });

  it('23. Rejected assignment has rejected_at timestamp', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/reject`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rejected_at).toBeTruthy();
  });

  it('24. A different (non-assigned) reviewer cannot reject the assignment — returns 403', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    // reviewer2 tries to reject reviewer1's assignment
    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/reject`)
      .set('Authorization', `Bearer ${reviewer2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('25. Cannot reject an already REJECTED assignment — returns 400', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    // Reject once
    await request(app)
      .post(`/api/assignments/${assignmentId}/reject`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    // Try again
    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/reject`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('26. After rejecting, the same reviewer can be re-assigned to the same app', async () => {
    const appId = await getWaitingReviewerApp();

    // First assignment
    const firstAssign = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const firstId = firstAssign.body.data.id;

    // Reject it
    await request(app)
      .post(`/api/assignments/${firstId}/reject`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    // Re-assign the same reviewer — no active assignment exists now
    const res = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('27. KETUA cannot reject an assignment (wrong role) — returns 403', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/reject`)
      .set('Authorization', `Bearer ${chiefToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('28. Unauthenticated reject request returns 401', async () => {
    const appId = await getWaitingReviewerApp();

    const assignRes = await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });
    const assignmentId = assignRes.body.data.id;

    const res = await request(app)
      .post(`/api/assignments/${assignmentId}/reject`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Status history — assignment events are recorded
// ═════════════════════════════════════════════════════════════════════════════

describe('Status history — assignment events recorded', () => {
  it('29. Assigning a reviewer records a history entry for the application', async () => {
    const appId = await getWaitingReviewerApp();

    await request(app)
      .post(`/api/assignments/applications/${appId}/assign`)
      .set('Authorization', `Bearer ${chiefToken}`)
      .send({ reviewer_id: reviewerUserId });

    const histRes = await request(app)
      .get(`/api/applications/${appId}/history`)
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(histRes.status).toBe(200);
    const history = histRes.body.data || [];
    // Assignment records a note containing "Reviewer assigned"
    const entry = history.find((h) => h.note && h.note.includes('Reviewer assigned'));
    expect(entry).toBeDefined();
    expect(entry.changed_by).toBe(chiefUserId);
  });
});

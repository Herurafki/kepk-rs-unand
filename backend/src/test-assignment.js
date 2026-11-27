'use strict';
/**
 * Phase 9 Tests – Reviewer Assignment (tasks 9.1 – 9.14)
 *
 * Tests covered:
 *   9.5   GET /api/review-assignments/reviewers → list available reviewers
 *   9.6   POST /api/applications/:id/assign-reviewer → create assignment
 *   9.7   KETUA role validation (PENELITI → 403)
 *   9.8   Application status validation (not WAITING_REVIEWER → 400)
 *   9.9   Duplicate active assignment → 409
 *   9.10  Assignment actor (assigned_by) is recorded
 *   9.11  Assignment timestamp (assigned_at) is recorded
 *   9.12  Auto-transition WAITING_REVIEWER → UNDER_REVIEW when EXPEDITED + 1 acceptance
 *   9.13  Status history recorded for assignment & UNDER_REVIEW transition
 *   9.14  REVIEWER accept/reject assignment endpoints
 *         - non-REVIEWER user assigned → 400
 *         - wrong reviewer accepts → 403
 *         - accept/reject non-pending assignment → 400
 */

require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('./config/database');

const PORT = process.env.PORT || 5000;

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (d) => (raw += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (_) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** Build a minimal multipart/form-data body with a tiny PDF-like file. */
function buildMultipartBody(boundary, fieldName, filename, mimeType, fileContent, extraFields = {}) {
  const parts = [];
  for (const [key, val] of Object.entries(extraFields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}`);
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const prefix = Buffer.from(parts.join('\r\n') + '\r\n');
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([prefix, fileContent, suffix]);
}

function multipartRequest(path, boundary, bodyBuffer, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (d) => (raw += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (_) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

// ── Setup helpers ────────────────────────────────────────────────────────────

/** Register a PENELITI and return their access_token and userId. */
async function registerAndLogin(nameSuffix) {
  const email = `test_assign_${nameSuffix}_${Date.now()}@example.com`;
  await request('POST', '/api/auth/register', {
    name: `Test Researcher ${nameSuffix}`,
    email,
    password: 'password123',
  });
  const res = await request('POST', '/api/auth/login', { email, password: 'password123' });
  const token = res.body.data?.access_token;
  const userId = res.body.data?.user?.id;
  return { token, userId, email };
}

/** Create a user with given role directly in DB, return { userId, token }. */
async function createUserWithRole(roleName, nameSuffix) {
  const email = `${roleName.toLowerCase()}_${nameSuffix.toLowerCase()}_${Date.now()}@kepk.test`;
  const password = 'testpass123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const userRes = await pool.query(
    `INSERT INTO users (id, name, email, password, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
     RETURNING id`,
    [`${roleName} User ${nameSuffix}`, email, hashedPassword]
  );
  const userId = userRes.rows[0].id;

  const roleRes = await pool.query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
  if (!roleRes.rows[0]) throw new Error(`Role ${roleName} not found in DB`);
  const roleId = roleRes.rows[0].id;

  await pool.query(
    `INSERT INTO user_roles (id, user_id, role_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, NOW())`,
    [userId, roleId]
  );

  const loginRes = await request('POST', '/api/auth/login', { email, password });
  const token = loginRes.body.data?.access_token;
  return { userId, token, email };
}

/** Create a fully-populated DRAFT application. */
async function createFullApplication(token) {
  const res = await request(
    'POST',
    '/api/applications',
    {
      group_category: 'MAHASISWA',
      research_title: 'Assignment Test Research ' + Date.now(),
      research_background: 'Background info',
      research_objectives: 'Objectives',
      research_methodology: 'Quantitative',
      research_location: 'RSUP Dr. Sardjito',
      research_institution: 'Universitas Gadjah Mada',
      research_duration: '3 bulan',
      data_needed: 'Data rekam medis.',
      purpose: 'Tugas akhir.',
    },
    token
  );
  return res.body.data?.id;
}

/** Upload a minimal PDF to an application. */
async function uploadDocument(appId, token) {
  const boundary = `----FormBoundary${crypto.randomBytes(8).toString('hex')}`;
  const minimalPdf = Buffer.from('%PDF-1.4 1 0 obj<</Type /Catalog>>endobj\n%%EOF');
  const body = buildMultipartBody(
    boundary, 'file', 'test-doc.pdf', 'application/pdf', minimalPdf,
    { document_type: 'PROPOSAL' }
  );
  return multipartRequest(`/api/applications/${appId}/documents`, boundary, body, token);
}

/**
 * Create a WAITING_REVIEWER application:
 * DRAFT → SUBMITTED → ADMIN_REVIEW → ADMIN_APPROVED → WAITING_REVIEWER
 */
async function createWaitingReviewerApp(researcherToken, diklatToken, sekretarisToken) {
  // Create and submit
  const appId = await createFullApplication(researcherToken);
  await uploadDocument(appId, researcherToken);
  await request('POST', `/api/applications/${appId}/submit`, {}, researcherToken);

  // Diklat: open → approve-with-ethics
  await request('POST', `/api/admin/applications/${appId}/open`, {}, diklatToken);
  await request('POST', `/api/admin/applications/${appId}/approve-with-ethics`, {}, diklatToken);

  // Sekretaris: forward → SEKRETARIS_REVIEW → WAITING_REVIEWER
  await request('POST', `/api/sekretaris/applications/${appId}/forward`, {}, sekretarisToken);

  return appId;
}

// ── Main test runner ─────────────────────────────────────────────────────────

async function run() {
  const results = [];
  const pass = (name) => { console.log(`  ✅ ${name}`); results.push({ ok: true, name }); };
  const fail = (name, detail) => { console.log(`  ❌ ${name}: ${detail}`); results.push({ ok: false, name, detail }); };
  const assert = (name, condition, detail = '') => condition ? pass(name) : fail(name, detail);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Phase 9 – Reviewer Assignment Tests');
  console.log('══════════════════════════════════════════════════════\n');

  // ── Setup: create users ──────────────────────────────────────────────────
  console.log('── Setup: Creating users ─────────────────────────────');

  const { token: researcherToken } = await registerAndLogin('R1');
  if (!researcherToken) {
    console.error('❌ Failed to register researcher. Is the server running on port ' + PORT + '?');
    process.exit(1);
  }

  const { token: diklatToken } = await createUserWithRole('DIKLIT', 'D1');
  if (!diklatToken) {
    console.error('❌ Failed to create DIKLIT user. Check DB connection and roles seed.');
    process.exit(1);
  }

  const { token: sekretarisToken } = await createUserWithRole('SEKRETARIAT', 'S1');
  if (!sekretarisToken) {
    console.error('❌ Failed to create SEKRETARIAT user.');
    process.exit(1);
  }

  const { token: chiefToken, userId: chiefId } = await createUserWithRole('KETUA', 'C1');
  if (!chiefToken) {
    console.error('❌ Failed to create KETUA user.');
    process.exit(1);
  }

  const { token: reviewerToken, userId: reviewerId } = await createUserWithRole('REVIEWER', 'V1');
  if (!reviewerToken) {
    console.error('❌ Failed to create REVIEWER user.');
    process.exit(1);
  }

  const { token: reviewer2Token, userId: reviewer2Id } = await createUserWithRole('REVIEWER', 'V2');
  console.log('  All users created.\n');

  // ── 9.5 Available reviewer list ──────────────────────────────────────────
  console.log('── 9.5 Available Reviewer List ──────────────────────');

  let r = await request('GET', '/api/review-assignments/reviewers', null, chiefToken);
  assert('9.5 GET /review-assignments/reviewers → 200', r.status === 200, `status=${r.status} body=${JSON.stringify(r.body)}`);
  assert('9.5 Response success=true', r.body.success === true, JSON.stringify(r.body));
  assert('9.5 Data is an array', Array.isArray(r.body.data), JSON.stringify(r.body));
  const foundReviewer = (r.body.data || []).some((u) => u.id === reviewerId);
  assert('9.5 Created REVIEWER appears in list', foundReviewer, `ids=${(r.body.data||[]).map(u=>u.id)}`);

  // PENELITI cannot access reviewer list → 403
  r = await request('GET', '/api/review-assignments/reviewers', null, researcherToken);
  assert('9.5 PENELITI GET reviewers → 403', r.status === 403, `status=${r.status}`);

  // Unauthenticated → 401
  r = await request('GET', '/api/review-assignments/reviewers', null, null);
  assert('9.5 Unauthenticated GET reviewers → 401', r.status === 401, `status=${r.status}`);
  console.log();

  // ── Setup: WAITING_REVIEWER application ─────────────────────────────────
  console.log('── Setup: Creating WAITING_REVIEWER application ─────');
  const waitingAppId = await createWaitingReviewerApp(researcherToken, diklatToken, sekretarisToken);
  assert('Setup: WAITING_REVIEWER application created', !!waitingAppId, `id=${waitingAppId}`);

  // Verify it's actually in WAITING_REVIEWER status
  r = await request('GET', `/api/applications/${waitingAppId}`, null, researcherToken);
  assert('Setup: Application status is WAITING_REVIEWER', r.body.data?.status === 'WAITING_REVIEWER', `status=${r.body.data?.status}`);
  console.log();

  // ── 9.6 Reviewer assignment ──────────────────────────────────────────────
  console.log('── 9.6 Reviewer Assignment ──────────────────────────');

  r = await request('POST', `/api/applications/${waitingAppId}/assign-reviewer`, {
    reviewer_id: reviewerId,
    review_type: 'EXPEDITED',
  }, chiefToken);
  assert('9.6 POST assign-reviewer → 201', r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
  assert('9.6 Response success=true', r.body.success === true, JSON.stringify(r.body));
  assert('9.6 Assignment data returned', !!r.body.data?.id, JSON.stringify(r.body));
  const assignmentId = r.body.data?.id;

  // ── 9.10 Record assignment actor ─────────────────────────────────────────
  assert('9.10 Assignment assigned_by is set', !!r.body.data?.assigned_by, JSON.stringify(r.body.data));

  // ── 9.11 Record assignment timestamp ────────────────────────────────────
  assert('9.11 Assignment assigned_at is set', !!r.body.data?.assigned_at, JSON.stringify(r.body.data));
  assert('9.11 Assignment status is PENDING', r.body.data?.status === 'PENDING', `status=${r.body.data?.status}`);
  assert('9.11 Assignment reviewer_id matches', r.body.data?.reviewer_id === reviewerId, `reviewer_id=${r.body.data?.reviewer_id}`);
  console.log();

  // ── 9.7 Validate KETUA role ─────────────────────────────────────────
  console.log('── 9.7 Role Validation ───────────────────────────────');

  // PENELITI cannot assign reviewer → 403
  r = await request('POST', `/api/applications/${waitingAppId}/assign-reviewer`, {
    reviewer_id: reviewerId,
    review_type: 'EXPEDITED',
  }, researcherToken);
  assert('9.7 PENELITI assign-reviewer → 403', r.status === 403, `status=${r.status}`);

  // DIKLIT cannot assign reviewer → 403
  r = await request('POST', `/api/applications/${waitingAppId}/assign-reviewer`, {
    reviewer_id: reviewerId,
    review_type: 'EXPEDITED',
  }, diklatToken);
  assert('9.7 DIKLIT assign-reviewer → 403', r.status === 403, `status=${r.status}`);

  // Unauthenticated → 401
  r = await request('POST', `/api/applications/${waitingAppId}/assign-reviewer`, {
    reviewer_id: reviewerId,
    review_type: 'EXPEDITED',
  }, null);
  assert('9.7 Unauthenticated assign-reviewer → 401', r.status === 401, `status=${r.status}`);
  console.log();

  // ── 9.9 Prevent duplicate active assignment ──────────────────────────────
  console.log('── 9.9 Duplicate Assignment Prevention ──────────────');

  // Same reviewer, same application (already PENDING) → 409
  r = await request('POST', `/api/applications/${waitingAppId}/assign-reviewer`, {
    reviewer_id: reviewerId,
    review_type: 'EXPEDITED',
  }, chiefToken);
  assert('9.9 Duplicate assignment → 409', r.status === 409, `status=${r.status} body=${JSON.stringify(r.body)}`);
  console.log();

  // ── 9.13 Status history for assignment ──────────────────────────────────
  console.log('── 9.13 Status History for Assignment ───────────────');

  r = await request('GET', `/api/applications/${waitingAppId}/history`, null, researcherToken);
  assert('9.13 GET application history → 200', r.status === 200, `status=${r.status}`);
  const history = r.body.data || [];
  const assignmentHistoryEntry = history.find((h) => h.note && h.note.includes('Reviewer assigned'));
  assert('9.13 History has reviewer assignment note', !!assignmentHistoryEntry, `history notes: ${history.map(h=>h.note)}`);
  assert('9.13 Assignment history has changed_by actor', !!assignmentHistoryEntry?.changed_by, JSON.stringify(assignmentHistoryEntry));
  console.log();

  // ── 9.8 Application status validation ───────────────────────────────────
  console.log('── 9.8 Application Status Validation ────────────────');

  // Create a SUBMITTED app (not WAITING_REVIEWER) and try to assign → 400
  const submittedAppId = await createFullApplication(researcherToken);
  await uploadDocument(submittedAppId, researcherToken);
  await request('POST', `/api/applications/${submittedAppId}/submit`, {}, researcherToken);

  r = await request('POST', `/api/applications/${submittedAppId}/assign-reviewer`, {
    reviewer_id: reviewerId,
    review_type: 'EXPEDITED',
  }, chiefToken);
  assert('9.8 Assign to SUBMITTED app → 400', r.status === 400, `status=${r.status} body=${JSON.stringify(r.body)}`);

  // Non-existent application → 404
  r = await request('POST', `/api/applications/00000000-0000-0000-0000-000000000000/assign-reviewer`, {
    reviewer_id: reviewerId,
    review_type: 'EXPEDITED',
  }, chiefToken);
  assert('9.8 Assign to non-existent app → 404', r.status === 404, `status=${r.status}`);

  // Assigning a non-REVIEWER user → 400
  r = await request('POST', `/api/applications/${waitingAppId}/assign-reviewer`, {
    reviewer_id: chiefId,
    review_type: 'EXPEDITED',
  }, chiefToken);
  assert('9.8 Assign non-REVIEWER user → 400', r.status === 400, `status=${r.status} body=${JSON.stringify(r.body)}`);

  // Missing reviewer_id → 422 (validation error)
  r = await request('POST', `/api/applications/${waitingAppId}/assign-reviewer`, {
    review_type: 'EXPEDITED',
  }, chiefToken);
  assert('9.8 Missing reviewer_id → 422', r.status === 422, `status=${r.status} body=${JSON.stringify(r.body)}`);
  console.log();

  // ── 9.14 Test reviewer accept/reject ────────────────────────────────────
  console.log('── 9.14 Accept / Reject Assignment ─────────────────');

  // Wrong reviewer tries to accept → 403
  r = await request('POST', `/api/review-assignments/${assignmentId}/accept`, {}, reviewer2Token);
  assert('9.14 Wrong reviewer accept → 403', r.status === 403, `status=${r.status} body=${JSON.stringify(r.body)}`);

  // Wrong reviewer tries to reject → 403
  r = await request('POST', `/api/review-assignments/${assignmentId}/reject`, {}, reviewer2Token);
  assert('9.14 Wrong reviewer reject → 403', r.status === 403, `status=${r.status}`);

  // Unauthenticated → 401
  r = await request('POST', `/api/review-assignments/${assignmentId}/accept`, {}, null);
  assert('9.14 Unauthenticated accept → 401', r.status === 401, `status=${r.status}`);

  // ── 9.12 EXPEDITED auto-transition: accept → UNDER_REVIEW ───────────────
  console.log('── 9.12 Auto-transition WAITING_REVIEWER → UNDER_REVIEW ─');

  // Reviewer accepts the assignment
  r = await request('POST', `/api/review-assignments/${assignmentId}/accept`, {}, reviewerToken);
  assert('9.12 Reviewer accepts assignment → 200', r.status === 200, `status=${r.status} body=${JSON.stringify(r.body)}`);
  assert('9.12 Assignment status is ACCEPTED', r.body.data?.status === 'ACCEPTED', `status=${r.body.data?.status}`);
  assert('9.12 accepted_at is set', !!r.body.data?.accepted_at, JSON.stringify(r.body.data));

  // Application should now be UNDER_REVIEW (EXPEDITED: 1 acceptance triggers transition)
  r = await request('GET', `/api/applications/${waitingAppId}`, null, researcherToken);
  assert('9.12 App status is UNDER_REVIEW after EXPEDITED acceptance', r.body.data?.status === 'UNDER_REVIEW', `status=${r.body.data?.status}`);

  // ── 9.13 Status history for UNDER_REVIEW transition ─────────────────────
  r = await request('GET', `/api/applications/${waitingAppId}/history`, null, researcherToken);
  const historyAfterAccept = r.body.data || [];
  const underReviewEntry = historyAfterAccept.find((h) => h.new_status === 'UNDER_REVIEW');
  assert('9.13 History has WAITING_REVIEWER→UNDER_REVIEW entry', !!underReviewEntry, `history: ${JSON.stringify(historyAfterAccept.map(h=>({prev:h.previous_status,new:h.new_status})))}`);
  assert('9.13 UNDER_REVIEW history has previous_status=WAITING_REVIEWER', underReviewEntry?.previous_status === 'WAITING_REVIEWER', `previous=${underReviewEntry?.previous_status}`);
  console.log();

  // ── Cannot accept an already-ACCEPTED assignment ─────────────────────────
  console.log('── Edge Cases ───────────────────────────────────────');

  r = await request('POST', `/api/review-assignments/${assignmentId}/accept`, {}, reviewerToken);
  assert('9.14 Accept already-ACCEPTED assignment → 400', r.status === 400, `status=${r.status} body=${JSON.stringify(r.body)}`);

  // ── List assignments (role-filtered) ─────────────────────────────────────
  r = await request('GET', `/api/review-assignments`, null, reviewerToken);
  assert('9.14 REVIEWER GET /review-assignments → 200', r.status === 200, `status=${r.status}`);
  assert('9.14 Assignments list is array', Array.isArray(r.body.data), JSON.stringify(r.body));
  const foundAssignment = (r.body.data || []).some((a) => a.id === assignmentId);
  assert('9.14 Accepted assignment appears in REVIEWER list', foundAssignment, `ids=${(r.body.data||[]).map(a=>a.id)}`);

  r = await request('GET', `/api/review-assignments`, null, chiefToken);
  assert('9.14 KETUA GET /review-assignments → 200', r.status === 200, `status=${r.status}`);

  r = await request('GET', `/api/review-assignments`, null, researcherToken);
  assert('9.14 PENELITI GET /review-assignments → 403', r.status === 403, `status=${r.status}`);

  // ── FULL_BOARD: all reviewers must accept before UNDER_REVIEW ─────────────
  console.log('── FULL_BOARD acceptance logic ───────────────────────');

  // Create a new WAITING_REVIEWER app for FULL_BOARD test
  const { token: researcher2Token } = await registerAndLogin('R2');
  const { token: diklatToken2 } = await createUserWithRole('DIKLIT', 'D2');
  const { token: sekretarisToken2 } = await createUserWithRole('SEKRETARIAT', 'S2');
  const fullBoardAppId = await createWaitingReviewerApp(researcher2Token, diklatToken2, sekretarisToken2);
  assert('Setup: FULL_BOARD app created', !!fullBoardAppId, `id=${fullBoardAppId}`);

  // Assign two reviewers with FULL_BOARD
  r = await request('POST', `/api/applications/${fullBoardAppId}/assign-reviewer`, {
    reviewer_id: reviewerId,
    review_type: 'FULL_BOARD',
  }, chiefToken);
  assert('FULL_BOARD: assign reviewer 1 → 201', r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
  const fbAssignment1Id = r.body.data?.id;

  r = await request('POST', `/api/applications/${fullBoardAppId}/assign-reviewer`, {
    reviewer_id: reviewer2Id,
    review_type: 'FULL_BOARD',
  }, chiefToken);
  assert('FULL_BOARD: assign reviewer 2 → 201', r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
  const fbAssignment2Id = r.body.data?.id;

  // Reviewer 1 accepts — should NOT transition (reviewer 2 still PENDING)
  r = await request('POST', `/api/review-assignments/${fbAssignment1Id}/accept`, {}, reviewerToken);
  assert('FULL_BOARD: reviewer 1 accepts → 200', r.status === 200, `status=${r.status}`);

  r = await request('GET', `/api/applications/${fullBoardAppId}`, null, researcher2Token);
  assert('FULL_BOARD: status still WAITING_REVIEWER after partial acceptance', r.body.data?.status === 'WAITING_REVIEWER', `status=${r.body.data?.status}`);

  // Reviewer 2 accepts — now ALL accepted → UNDER_REVIEW
  r = await request('POST', `/api/review-assignments/${fbAssignment2Id}/accept`, {}, reviewer2Token);
  assert('FULL_BOARD: reviewer 2 accepts → 200', r.status === 200, `status=${r.status}`);

  r = await request('GET', `/api/applications/${fullBoardAppId}`, null, researcher2Token);
  assert('FULL_BOARD: status UNDER_REVIEW after all accepted', r.body.data?.status === 'UNDER_REVIEW', `status=${r.body.data?.status}`);

  console.log();

  // ── Reject assignment flow ────────────────────────────────────────────────
  console.log('── Reject Assignment Flow ───────────────────────────');

  // Create another WAITING_REVIEWER app for reject test
  const { token: researcher3Token } = await registerAndLogin('R3');
  const { token: diklatToken3 } = await createUserWithRole('DIKLIT', 'D3');
  const { token: sekretarisToken3 } = await createUserWithRole('SEKRETARIAT', 'S3');
  const { token: reviewerToken3, userId: reviewerId3 } = await createUserWithRole('REVIEWER', 'V3');
  const rejectAppId = await createWaitingReviewerApp(researcher3Token, diklatToken3, sekretarisToken3);

  r = await request('POST', `/api/applications/${rejectAppId}/assign-reviewer`, {
    reviewer_id: reviewerId3,
    review_type: 'EXPEDITED',
  }, chiefToken);
  assert('Reject flow: assign reviewer → 201', r.status === 201, `status=${r.status}`);
  const rejectAssignmentId = r.body.data?.id;

  // Reviewer rejects
  r = await request('POST', `/api/review-assignments/${rejectAssignmentId}/reject`, {}, reviewerToken3);
  assert('9.14 Reviewer rejects assignment → 200', r.status === 200, `status=${r.status} body=${JSON.stringify(r.body)}`);
  assert('9.14 Assignment status is REJECTED', r.body.data?.status === 'REJECTED', `status=${r.body.data?.status}`);
  assert('9.14 rejected_at is set', !!r.body.data?.rejected_at, JSON.stringify(r.body.data));

  // App should remain WAITING_REVIEWER (no auto-transition on reject)
  r = await request('GET', `/api/applications/${rejectAppId}`, null, researcher3Token);
  assert('9.14 App stays WAITING_REVIEWER after rejection', r.body.data?.status === 'WAITING_REVIEWER', `status=${r.body.data?.status}`);

  // Cannot reject an already-REJECTED assignment → 400
  r = await request('POST', `/api/review-assignments/${rejectAssignmentId}/reject`, {}, reviewerToken3);
  assert('9.14 Reject already-REJECTED assignment → 400', r.status === 400, `status=${r.status}`);

  // KETUA can reassign after rejection (same reviewer)
  r = await request('POST', `/api/applications/${rejectAppId}/assign-reviewer`, {
    reviewer_id: reviewerId3,
    review_type: 'EXPEDITED',
  }, chiefToken);
  assert('9.14 KETUA can reassign after rejection → 201', r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
  console.log();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('══════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`  Total : ${results.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  if (failed > 0) {
    console.log('\n  Failed tests:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`    ❌ ${r.name}: ${r.detail}`));
    process.exitCode = 1;
  } else {
    console.log('\n  All reviewer assignment tests passed ✅');
  }
}

run()
  .catch((err) => {
    console.error('Test runner error:', err);
    process.exit(1);
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  });

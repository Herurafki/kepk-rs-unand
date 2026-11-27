'use strict';
/**
 * Phase 8 Tests – Diklat Verification (tasks 8.15, 8.16, 8.17)
 *
 * Tests covered:
 *   8.15  Test approval
 *         - POST approve-without-ethics → ADMIN_APPROVED + status history
 *         - POST approve-with-ethics    → ADMIN_APPROVED + status history
 *
 *   8.16  Test revision
 *         - POST revision { note } → REVISION_REQUIRED + status history
 *         - Revision note is required (missing note → 422)
 *
 *   8.17  Test rejection
 *         - POST reject { note } → REJECTED + status history
 *
 *   Additional edge-case / authorization tests:
 *         - GET admin/applications returns submitted apps
 *         - GET admin/applications/:id returns app detail with documents
 *         - PENELITI cannot access admin endpoints (403)
 *         - Invalid status transition: approve from SUBMITTED (not ADMIN_REVIEW) → 400
 *         - Invalid status transition: open already-ADMIN_REVIEW app → 400
 *         - Non-existent application returns 404
 *         - Unauthenticated request → 401
 */

require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('./config/database');

const PORT = process.env.PORT || 5000;

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method, path, body, token, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const data = body && contentType === 'application/json' ? JSON.stringify(body) : body;
    const isBuffer = Buffer.isBuffer(data);
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': contentType,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data
          ? { 'Content-Length': isBuffer ? data.length : Buffer.byteLength(data) }
          : {}),
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

/** Build a minimal valid multipart/form-data body with a tiny PDF-like file. */
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

/** Register a PENELITI and return their access_token. */
async function registerAndLogin(nameSuffix) {
  const email = `test_diklat_${nameSuffix}_${Date.now()}@example.com`;
  await request('POST', '/api/auth/register', {
    name: `Test Researcher ${nameSuffix}`,
    email,
    password: 'password123',
  });
  const res = await request('POST', '/api/auth/login', { email, password: 'password123' });
  return { token: res.body.data?.access_token, email };
}

/**
 * Create a DIKLIT user directly via pool query (DIKLIT cannot self-register).
 * Returns { userId, token }.
 */
async function createDiklatUser() {
  const email = `diklat_${Date.now()}@kepk.test`;
  const password = 'diklatpass123';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert user
  const userRes = await pool.query(
    `INSERT INTO users (id, name, email, password, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
     RETURNING id`,
    ['Petugas Diklat', email, hashedPassword]
  );
  const userId = userRes.rows[0].id;

  // Get DIKLIT role id
  const roleRes = await pool.query(`SELECT id FROM roles WHERE name = 'DIKLIT'`);
  const roleId = roleRes.rows[0].id;

  // Assign role
  await pool.query(
    `INSERT INTO user_roles (id, user_id, role_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, NOW())`,
    [userId, roleId]
  );

  // Login to get token
  const loginRes = await request('POST', '/api/auth/login', { email, password });
  const token = loginRes.body.data?.access_token;
  return { userId, token, email };
}

/** Create a fully-populated DRAFT application and return its id. */
async function createFullApplication(token) {
  const res = await request(
    'POST',
    '/api/applications',
    {
      group_category: 'MAHASISWA',
      research_title: 'Diklat Test Research ' + Date.now(),
      research_background: 'Background for diklat test.',
      research_objectives: 'Objectives for diklat test.',
      research_methodology: 'Quantitative methodology.',
      research_location: 'RSUP Dr. Sardjito',
      research_institution: 'Universitas Gadjah Mada',
      research_duration: '3 bulan',
      data_needed: 'Data rekam medis pasien.',
      purpose: 'Keperluan penyusunan tugas akhir.',
    },
    token
  );
  return res.body.data?.id;
}

/** Upload a minimal PDF document to an application. */
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
 * Create a fully-populated SUBMITTED application.
 * Returns { appId }.
 */
async function createSubmittedApp(researcherToken) {
  const appId = await createFullApplication(researcherToken);
  await uploadDocument(appId, researcherToken);
  await request('POST', `/api/applications/${appId}/submit`, {}, researcherToken);
  return appId;
}

/**
 * Create a SUBMITTED app then open it to ADMIN_REVIEW.
 * Returns { appId }.
 */
async function createAdminReviewApp(researcherToken, diklatToken) {
  const appId = await createSubmittedApp(researcherToken);
  await request('POST', `/api/admin/applications/${appId}/open`, {}, diklatToken);
  return appId;
}

// ── Main test runner ─────────────────────────────────────────────────────────

async function run() {
  const results = [];
  const pass = (name) => { console.log(`  ✅ ${name}`); results.push({ ok: true, name }); };
  const fail = (name, detail) => { console.log(`  ❌ ${name}: ${detail}`); results.push({ ok: false, name, detail }); };
  const assert = (name, condition, detail = '') => condition ? pass(name) : fail(name, detail);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Phase 8 – Diklat Verification Tests');
  console.log('══════════════════════════════════════════════════════\n');

  // ── Setup ────────────────────────────────────────────────────────────────
  console.log('── Setup ─────────────────────────────────────────────');
  const { token: researcherToken } = await registerAndLogin('R1');
  const { token: researcher2Token } = await registerAndLogin('R2');
  if (!researcherToken) {
    console.error('❌ Failed to register researcher. Is the server running on port ' + PORT + '?');
    process.exit(1);
  }

  const { token: diklatToken } = await createDiklatUser();
  if (!diklatToken) {
    console.error('❌ Failed to create/login DIKLIT user. Check DB connection and roles seed.');
    process.exit(1);
  }
  console.log('  Users created.\n');

  // ── Admin queue & detail ─────────────────────────────────────────────────
  console.log('── Admin queue & detail ──────────────────────────────');

  const submittedAppId = await createSubmittedApp(researcherToken);
  assert('Setup: submitted application created', !!submittedAppId, `id=${submittedAppId}`);

  // GET admin/applications — should list the submitted app
  const listRes = await request('GET', '/api/admin/applications', null, diklatToken);
  assert('GET /api/admin/applications → 200', listRes.status === 200, `status=${listRes.status}`);
  assert('GET /api/admin/applications → success=true', listRes.body.success === true, JSON.stringify(listRes.body));
  const listedApps = listRes.body.data || [];
  const foundInList = listedApps.some((a) => a.id === submittedAppId);
  assert('Submitted application appears in admin queue', foundInList, `ids=${listedApps.map(a=>a.id)}`);

  // GET admin/applications/:id — detail with documents
  const detailRes = await request('GET', `/api/admin/applications/${submittedAppId}`, null, diklatToken);
  assert('GET /api/admin/applications/:id → 200', detailRes.status === 200, `status=${detailRes.status}`);
  assert('Detail includes documents array', Array.isArray(detailRes.body.data?.documents), JSON.stringify(detailRes.body.data));
  console.log();

  // ── Open application (SUBMITTED → ADMIN_REVIEW) ──────────────────────────
  console.log('── Open application (prerequisite for approval tests) ─');
  const openRes = await request('POST', `/api/admin/applications/${submittedAppId}/open`, {}, diklatToken);
  assert('POST open → 200', openRes.status === 200, `status=${openRes.status} body=${JSON.stringify(openRes.body)}`);
  assert('Status after open = ADMIN_REVIEW', openRes.body.data?.status === 'ADMIN_REVIEW', `status=${openRes.body.data?.status}`);

  // Verify history for open
  const openHistRes = await request('GET', `/api/applications/${submittedAppId}/history`, null, researcherToken);
  const openHistory = openHistRes.body.data || [];
  const openEntry = openHistory.find((h) => h.new_status === 'ADMIN_REVIEW');
  assert('History contains SUBMITTED→ADMIN_REVIEW entry', !!openEntry, JSON.stringify(openHistory));

  // Invalid: open again (already ADMIN_REVIEW) → 400
  const doubleOpenRes = await request('POST', `/api/admin/applications/${submittedAppId}/open`, {}, diklatToken);
  assert('Open already-ADMIN_REVIEW → 400 (invalid transition)', doubleOpenRes.status === 400, `status=${doubleOpenRes.status}`);
  console.log();

  // ── 8.15 Test approval ───────────────────────────────────────────────────
  console.log('── 8.15 Test Approval ───────────────────────────────');

  // approve-without-ethics (current app: ADMIN_REVIEW)
  const approveWoRes = await request(
    'POST', `/api/admin/applications/${submittedAppId}/approve-without-ethics`, {}, diklatToken
  );
  assert('8.15 POST approve-without-ethics → 200', approveWoRes.status === 200, `status=${approveWoRes.status} body=${JSON.stringify(approveWoRes.body)}`);
  assert('8.15 Response success=true', approveWoRes.body.success === true, JSON.stringify(approveWoRes.body));
  assert('8.15 Status after approve-without-ethics = ADMIN_APPROVED', approveWoRes.body.data?.status === 'ADMIN_APPROVED', `status=${approveWoRes.body.data?.status}`);

  // Verify status history
  const approveWoHistRes = await request('GET', `/api/applications/${submittedAppId}/history`, null, researcherToken);
  const approveWoHistory = approveWoHistRes.body.data || [];
  const approveWoEntry = approveWoHistory.find((h) => h.new_status === 'ADMIN_APPROVED' && h.previous_status === 'ADMIN_REVIEW');
  assert('8.15 History contains ADMIN_REVIEW→ADMIN_APPROVED entry', !!approveWoEntry, JSON.stringify(approveWoHistory));
  assert('8.15 History entry has changed_by actor', !!approveWoEntry?.changed_by, JSON.stringify(approveWoEntry));

  // approve-with-ethics (need a fresh ADMIN_REVIEW app)
  const appForEthics = await createAdminReviewApp(researcherToken, diklatToken);
  const approveWiRes = await request(
    'POST', `/api/admin/applications/${appForEthics}/approve-with-ethics`, {}, diklatToken
  );
  assert('8.15 POST approve-with-ethics → 200', approveWiRes.status === 200, `status=${approveWiRes.status} body=${JSON.stringify(approveWiRes.body)}`);
  assert('8.15 Status after approve-with-ethics = ADMIN_APPROVED', approveWiRes.body.data?.status === 'ADMIN_APPROVED', `status=${approveWiRes.body.data?.status}`);

  const approveWiHistRes = await request('GET', `/api/applications/${appForEthics}/history`, null, researcherToken);
  const approveWiHistory = approveWiHistRes.body.data || [];
  const approveWiEntry = approveWiHistory.find((h) => h.new_status === 'ADMIN_APPROVED' && h.previous_status === 'ADMIN_REVIEW');
  assert('8.15 approve-with-ethics history entry exists', !!approveWiEntry, JSON.stringify(approveWiHistory));

  // Invalid: approve from SUBMITTED (not ADMIN_REVIEW) → 400
  const freshSubmitted = await createSubmittedApp(researcherToken);
  const invalidApproveRes = await request(
    'POST', `/api/admin/applications/${freshSubmitted}/approve-without-ethics`, {}, diklatToken
  );
  assert('8.15 Approve from SUBMITTED (not ADMIN_REVIEW) → 400', invalidApproveRes.status === 400, `status=${invalidApproveRes.status}`);
  console.log();

  // ── 8.16 Test revision ───────────────────────────────────────────────────
  console.log('── 8.16 Test Revision ───────────────────────────────');

  const appForRevision = await createAdminReviewApp(researcherToken, diklatToken);
  const revisionNote = 'Dokumen persyaratan tidak lengkap, mohon dilengkapi.';

  const revisionRes = await request(
    'POST', `/api/admin/applications/${appForRevision}/revision`,
    { note: revisionNote }, diklatToken
  );
  assert('8.16 POST revision → 200', revisionRes.status === 200, `status=${revisionRes.status} body=${JSON.stringify(revisionRes.body)}`);
  assert('8.16 Response success=true', revisionRes.body.success === true, JSON.stringify(revisionRes.body));
  assert('8.16 Status after revision = REVISION_REQUIRED', revisionRes.body.data?.status === 'REVISION_REQUIRED', `status=${revisionRes.body.data?.status}`);

  // Verify status history
  const revHistRes = await request('GET', `/api/applications/${appForRevision}/history`, null, researcherToken);
  const revHistory = revHistRes.body.data || [];
  const revEntry = revHistory.find((h) => h.new_status === 'REVISION_REQUIRED' && h.previous_status === 'ADMIN_REVIEW');
  assert('8.16 History contains ADMIN_REVIEW→REVISION_REQUIRED entry', !!revEntry, JSON.stringify(revHistory));
  assert('8.16 History entry has note', revEntry?.note === revisionNote, `note=${revEntry?.note}`);
  assert('8.16 History entry has changed_by', !!revEntry?.changed_by, JSON.stringify(revEntry));

  // Missing note → 422
  const appForRevision2 = await createAdminReviewApp(researcherToken, diklatToken);
  const missingNoteRes = await request(
    'POST', `/api/admin/applications/${appForRevision2}/revision`,
    {}, diklatToken
  );
  assert('8.16 Revision without note → 422', missingNoteRes.status === 422, `status=${missingNoteRes.status} body=${JSON.stringify(missingNoteRes.body)}`);

  // Empty note → 422
  const emptyNoteRes = await request(
    'POST', `/api/admin/applications/${appForRevision2}/revision`,
    { note: '   ' }, diklatToken
  );
  assert('8.16 Revision with empty note → 422', emptyNoteRes.status === 422, `status=${emptyNoteRes.status}`);

  // Invalid transition: revision from SUBMITTED (not ADMIN_REVIEW) → 400
  const freshSubmitted2 = await createSubmittedApp(researcherToken);
  const invalidRevisionRes = await request(
    'POST', `/api/admin/applications/${freshSubmitted2}/revision`,
    { note: 'Some note' }, diklatToken
  );
  assert('8.16 Revision from SUBMITTED → 400 (invalid transition)', invalidRevisionRes.status === 400, `status=${invalidRevisionRes.status}`);
  console.log();

  // ── 8.17 Test rejection ──────────────────────────────────────────────────
  console.log('── 8.17 Test Rejection ──────────────────────────────');

  const appForRejection = await createAdminReviewApp(researcherToken, diklatToken);
  const rejectionNote = 'Pengajuan tidak memenuhi persyaratan administrasi.';

  const rejectRes = await request(
    'POST', `/api/admin/applications/${appForRejection}/reject`,
    { note: rejectionNote }, diklatToken
  );
  assert('8.17 POST reject → 200', rejectRes.status === 200, `status=${rejectRes.status} body=${JSON.stringify(rejectRes.body)}`);
  assert('8.17 Response success=true', rejectRes.body.success === true, JSON.stringify(rejectRes.body));
  assert('8.17 Status after reject = REJECTED', rejectRes.body.data?.status === 'REJECTED', `status=${rejectRes.body.data?.status}`);

  // Verify status history
  const rejHistRes = await request('GET', `/api/applications/${appForRejection}/history`, null, researcherToken);
  const rejHistory = rejHistRes.body.data || [];
  const rejEntry = rejHistory.find((h) => h.new_status === 'REJECTED' && h.previous_status === 'ADMIN_REVIEW');
  assert('8.17 History contains ADMIN_REVIEW→REJECTED entry', !!rejEntry, JSON.stringify(rejHistory));
  assert('8.17 History entry has changed_by', !!rejEntry?.changed_by, JSON.stringify(rejEntry));

  // Reject without note — should still succeed (note is optional for rejection)
  const appForRejectionNoNote = await createAdminReviewApp(researcherToken, diklatToken);
  const rejectNoNoteRes = await request(
    'POST', `/api/admin/applications/${appForRejectionNoNote}/reject`,
    {}, diklatToken
  );
  assert('8.17 Reject without note → 200 (note optional for rejection)', rejectNoNoteRes.status === 200, `status=${rejectNoNoteRes.status}`);
  assert('8.17 Status = REJECTED (no note)', rejectNoNoteRes.body.data?.status === 'REJECTED', `status=${rejectNoNoteRes.body.data?.status}`);

  // Invalid transition: reject from SUBMITTED (not ADMIN_REVIEW) → 400
  const freshSubmitted3 = await createSubmittedApp(researcherToken);
  const invalidRejectRes = await request(
    'POST', `/api/admin/applications/${freshSubmitted3}/reject`,
    { note: 'test' }, diklatToken
  );
  assert('8.17 Reject from SUBMITTED → 400 (invalid transition)', invalidRejectRes.status === 400, `status=${invalidRejectRes.status}`);
  console.log();

  // ── Authorization tests ──────────────────────────────────────────────────
  console.log('── Authorization & Edge Cases ───────────────────────');

  // PENELITI cannot access admin endpoints
  const researcherAdminListRes = await request('GET', '/api/admin/applications', null, researcherToken);
  assert('PENELITI GET admin/applications → 403', researcherAdminListRes.status === 403, `status=${researcherAdminListRes.status}`);

  const freshSub = await createSubmittedApp(researcherToken);
  const researcherOpenRes = await request('POST', `/api/admin/applications/${freshSub}/open`, {}, researcherToken);
  assert('PENELITI POST admin open → 403', researcherOpenRes.status === 403, `status=${researcherOpenRes.status}`);

  // Unauthenticated → 401
  const noTokenListRes = await request('GET', '/api/admin/applications', null, null);
  assert('Unauthenticated GET admin/applications → 401', noTokenListRes.status === 401, `status=${noTokenListRes.status}`);

  const noTokenOpenRes = await request('POST', `/api/admin/applications/${freshSub}/open`, {}, null);
  assert('Unauthenticated POST admin open → 401', noTokenOpenRes.status === 401, `status=${noTokenOpenRes.status}`);

  // Non-existent application → 404
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const notFoundRes = await request('POST', `/api/admin/applications/${fakeId}/open`, {}, diklatToken);
  assert('Open non-existent application → 404', notFoundRes.status === 404, `status=${notFoundRes.status}`);

  const notFoundDetailRes = await request('GET', `/api/admin/applications/${fakeId}`, null, diklatToken);
  assert('GET non-existent application detail → 404', notFoundDetailRes.status === 404, `status=${notFoundDetailRes.status}`);

  // Researcher2 cannot see another researcher's app details via non-admin route (ownership)
  const r2AppId = await createFullApplication(researcher2Token);
  await uploadDocument(r2AppId, researcher2Token);
  await request('POST', `/api/applications/${r2AppId}/submit`, {}, researcher2Token);
  const ownershipRes = await request('GET', `/api/applications/${r2AppId}`, null, researcherToken);
  assert('Researcher cannot access another researcher\'s application → 403 or 404', ownershipRes.status === 403 || ownershipRes.status === 404, `status=${ownershipRes.status}`);

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
    console.log('\n  All Diklat verification tests passed ✅');
  }
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 500);
});

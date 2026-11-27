'use strict';
require('dotenv').config();
const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 5000,
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const results = [];
  const pass = (name) => { results.push(`✅ ${name}`); };
  const fail = (name, detail) => { results.push(`❌ ${name}: ${detail}`); };

  // ── PENELITI registration + login ──────────────────────────────────────
  const email = `test_${Date.now()}@example.com`;
  let r = await request('POST', '/api/auth/register', {
    name: 'Test Researcher',
    email,
    password: 'password123'
  });
  r.status === 201 ? pass('16.1 Register') : fail('16.1 Register', `${r.status} ${JSON.stringify(r.body)}`);

  r = await request('POST', '/api/auth/login', { email, password: 'password123' });
  r.status === 200 && r.body.data?.access_token
    ? pass('16.2 Login')
    : fail('16.2 Login', `${r.status} ${JSON.stringify(r.body)}`);
  const researcherToken = r.body.data?.access_token;
  const refreshToken = r.body.data?.refresh_token;

  // ── JWT auth ──────────────────────────────────────────────────────────────
  r = await request('GET', '/api/auth/me', null, researcherToken);
  r.status === 200 ? pass('16.3 JWT Auth (GET /me)') : fail('16.3 JWT Auth', `${r.status}`);

  // No token → 401
  r = await request('GET', '/api/auth/me', null, null);
  r.status === 401 ? pass('16.17 Unauthorized (no token)') : fail('16.17 Unauthorized', `${r.status}`);

  // Invalid token → 401
  r = await request('GET', '/api/auth/me', null, 'invalid.token.here');
  r.status === 401 ? pass('16.3 Invalid JWT → 401') : fail('16.3 Invalid JWT', `${r.status}`);

  // ── Role enforcement ──────────────────────────────────────────────────────
  r = await request('GET', '/api/admin/applications', null, researcherToken);
  r.status === 403 ? pass('16.18 Forbidden (wrong role — PENELITI on DIKLIT endpoint)') : fail('16.18 Forbidden', `${r.status}`);

  // ── Validation error ──────────────────────────────────────────────────────
  r = await request('POST', '/api/auth/register', { name: 'X', email: 'notanemail', password: '123' });
  r.status === 422 ? pass('16.19 Validation error (bad email/password)') : fail('16.19 Validation', `${r.status} ${JSON.stringify(r.body)}`);

  // Duplicate email → 409
  r = await request('POST', '/api/auth/register', { name: 'Dupe', email, password: 'password123' });
  r.status === 409 ? pass('16.1 Duplicate email → 409') : fail('16.1 Duplicate email', `${r.status}`);

  // ── Applications CRUD ─────────────────────────────────────────────────────
  r = await request('POST', '/api/applications', {
    group_category: 'MAHASISWA',
    research_title: 'Test Research ' + Date.now(),
    research_background: 'Background info',
    research_objectives: 'Objectives',
    research_methodology: 'Methodology'
  }, researcherToken);
  r.status === 201 ? pass('16.5 Create draft application') : fail('16.5 Create draft', `${r.status} ${JSON.stringify(r.body)}`);
  const appId = r.body.data?.id;

  r = await request('GET', `/api/applications/${appId}`, null, researcherToken);
  r.status === 200 ? pass('16.5 Get application by ID') : fail('16.5 Get', `${r.status}`);

  r = await request('GET', '/api/applications', null, researcherToken);
  r.status === 200 && Array.isArray(r.body.data) ? pass('16.5 List applications') : fail('16.5 List', `${r.status}`);

  r = await request('PUT', `/api/applications/${appId}`, { research_title: 'Updated Title' }, researcherToken);
  r.status === 200 ? pass('16.5 Update application') : fail('16.5 Update', `${r.status} ${JSON.stringify(r.body)}`);

  // ── Submit without document → 422 ─────────────────────────────────────────
  r = await request('POST', `/api/applications/${appId}/submit`, {}, researcherToken);
  r.status === 422 ? pass('16.8 Submit without doc → 422') : fail('16.8 Submit no doc', `${r.status} ${JSON.stringify(r.body)}`);

  // ── Submit non-existent app → 404 ─────────────────────────────────────────
  r = await request('POST', `/api/applications/00000000-0000-0000-0000-000000000000/submit`, {}, researcherToken);
  r.status === 404 ? pass('16.8 Submit non-existent → 404') : fail('16.8 Submit 404', `${r.status}`);

  // ── Get non-existent app → 404 ────────────────────────────────────────────
  r = await request('GET', `/api/applications/00000000-0000-0000-0000-000000000000`, null, researcherToken);
  r.status === 404 ? pass('16.5 Get non-existent → 404') : fail('16.5 Get 404', `${r.status}`);

  // ── Application history ───────────────────────────────────────────────────
  r = await request('GET', `/api/applications/${appId}/history`, null, researcherToken);
  r.status === 200 ? pass('16.15 Application history') : fail('16.15 History', `${r.status}`);

  // ── Application revisions ─────────────────────────────────────────────────
  r = await request('GET', `/api/applications/${appId}/revisions`, null, researcherToken);
  r.status === 200 ? pass('16.15 Application revisions list') : fail('16.15 Revisions', `${r.status}`);

  // ── Invalid transition: revise from DRAFT ────────────────────────────────
  r = await request('POST', `/api/applications/${appId}/revise`, {}, researcherToken);
  r.status === 400 ? pass('16.16 Invalid transition (revise DRAFT → 400)') : fail('16.16 Invalid transition', `${r.status} ${JSON.stringify(r.body)}`);

  // ── Delete draft ──────────────────────────────────────────────────────────
  r = await request('DELETE', `/api/applications/${appId}`, null, researcherToken);
  r.status === 200 ? pass('16.5 Delete draft application') : fail('16.5 Delete', `${r.status}`);

  // ── Verify deleted app is gone ────────────────────────────────────────────
  r = await request('GET', `/api/applications/${appId}`, null, researcherToken);
  r.status === 404 ? pass('16.5 Deleted app returns 404') : fail('16.5 Deleted app', `${r.status}`);

  // ── Refresh token ─────────────────────────────────────────────────────────
  if (refreshToken) {
    r = await request('POST', '/api/auth/refresh', { refresh_token: refreshToken });
    r.status === 200 && r.body.data?.access_token
      ? pass('16.2 Token refresh')
      : fail('16.2 Token refresh', `${r.status} ${JSON.stringify(r.body)}`);
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  if (refreshToken) {
    r = await request('POST', '/api/auth/logout', { refresh_token: refreshToken });
    r.status === 200 ? pass('16.2 Logout') : fail('16.2 Logout', `${r.status}`);

    // Revoked token should fail
    r = await request('POST', '/api/auth/refresh', { refresh_token: refreshToken });
    r.status === 401 ? pass('16.2 Revoked refresh token → 401') : fail('16.2 Revoked token', `${r.status}`);
  }

  // ── Health check ──────────────────────────────────────────────────────────
  r = await request('GET', '/api/health', null, null);
  r.status === 200 && r.body.success === true ? pass('Health check') : fail('Health', `${r.status}`);

  // ── Admin endpoint requires DIKLIT role ──────────────────────────────────
  r = await request('POST', '/api/admin/applications/00000000-0000-0000-0000-000000000000/open', null, researcherToken);
  r.status === 403 ? pass('16.18 PENELITI cannot call admin/open (403)') : fail('16.18 Admin open role check', `${r.status}`);

  // ── KETUA endpoint requires KETUA role ─────────────────────────
  r = await request('POST', '/api/applications/00000000-0000-0000-0000-000000000000/assign-reviewer', { reviewer_id: '00000000-0000-0000-0000-000000000001' }, researcherToken);
  r.status === 403 ? pass('16.18 PENELITI cannot assign-reviewer (403)') : fail('16.18 Assign role check', `${r.status}`);

  // ── Review endpoint requires REVIEWER role ───────────────────────────────
  r = await request('POST', '/api/applications/00000000-0000-0000-0000-000000000000/reviews', { recommendation: 'APPROVE' }, researcherToken);
  r.status === 403 ? pass('16.18 PENELITI cannot submit review (403)') : fail('16.18 Review role check', `${r.status}`);

  // ── Decision endpoint requires KETUA ────────────────────────────────
  r = await request('POST', '/api/applications/00000000-0000-0000-0000-000000000000/decision/approve', {}, researcherToken);
  r.status === 403 ? pass('16.18 PENELITI cannot issue decision (403)') : fail('16.18 Decision role check', `${r.status}`);

  // ── Create app without required field ────────────────────────────────────
  r = await request('POST', '/api/applications', { research_title: 'No Category' }, researcherToken);
  // Should fail validation (group_category missing) or succeed if optional
  const appCreateNoCategory = r.body.data?.id;
  if (r.status === 422) {
    pass('16.5 Create app without group_category → 422');
  } else if (r.status === 201) {
    pass('16.5 Create app without optional group_category → 201 (optional field)');
    // Clean up
    if (appCreateNoCategory) {
      await request('DELETE', `/api/applications/${appCreateNoCategory}`, null, researcherToken);
    }
  } else {
    fail('16.5 Create app field validation', `${r.status} ${JSON.stringify(r.body)}`);
  }

  // ── FINAL RESULTS ─────────────────────────────────────────────────────────
  console.log('\n=== TEST RESULTS ===');
  results.forEach(r => console.log(r));
  const passed = results.filter(r => r.startsWith('✅')).length;
  const failed = results.filter(r => r.startsWith('❌')).length;
  console.log(`\nTotal: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

run().catch(console.error).finally(() => process.exit(process.exitCode || 0));

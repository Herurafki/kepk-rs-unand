'use strict';
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const applicationModel = require('../models/application.model');
const letterModel = require('../models/letter.model');
const historyModel = require('../models/history.model');
const letterPdfService = require('./letter-pdf.service');

const VALID_LETTER_TYPES = ['DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK', 'BEBAS_KAJI_ETIK'];
const VALID_FROM_STATUSES = ['ADMIN_APPROVED', 'APPROVED'];
const ISSUER_ROLES = ['DIKLIT', 'SEKRETARIAT'];
const GENERATED_STATUS = 'GENERATED';
const SIGNED_STATUS = 'SIGNED_UPLOADED';
const ETHICS_LETTER_TYPE_BY_REVIEW_TYPE = { FULLBOARD: 'IZIN_ETIK', EXPEDITED: 'IZIN_ETIK', EXEMPTED: 'BEBAS_KAJI_ETIK' };

const getAllowedLetterTypes = (app, roles = []) => {
  if (roles.includes('DIKLIT') && app.application_type === 'DATA_AWAL' && ['APPROVED', 'ADMIN_APPROVED'].includes(app.status)) return ['DATA_AWAL'];
  if (roles.includes('DIKLIT') && app.application_type === 'IZIN_PENELITIAN' && ['APPROVED', 'ADMIN_APPROVED'].includes(app.status)) return ['IZIN_PENELITIAN'];
  if (roles.includes('SEKRETARIAT') && app.application_type === 'IZIN_ETIK' && app.status === 'APPROVED') {
    const letterType = ETHICS_LETTER_TYPE_BY_REVIEW_TYPE[app.review_type];
    return letterType ? [letterType] : [];
  }
  return [];
};

const getIssuerUserRoleId = async (userId, roles, client = pool) => {
  const issuerRole = roles.find((role) => ISSUER_ROLES.includes(role));
  if (!issuerRole) return null;
  const result = await client.query(
    `SELECT ur.id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 AND r.name = $2`,
    [userId, issuerRole]
  );
  return result.rows[0] ? result.rows[0].id : null;
};

const assertLetterTypeAllowed = (app, letterType, roles = []) => {
  if (!VALID_LETTER_TYPES.includes(letterType)) {
    const err = new Error(`Letter type must be one of: ${VALID_LETTER_TYPES.join(', ')}`);
    err.statusCode = 422;
    throw err;
  }
  if (!VALID_FROM_STATUSES.includes(app.status)) {
    const err = new Error(`Letter can only be generated for applications in ADMIN_APPROVED or APPROVED status (current: ${app.status})`);
    err.statusCode = 400;
    throw err;
  }
  const allowedLetterTypes = getAllowedLetterTypes(app, roles);
  if (!allowedLetterTypes.includes(letterType)) {
    const err = new Error(`Invalid letter type for this application. Allowed: ${allowedLetterTypes.length ? allowedLetterTypes.join(', ') : 'none'} (application type: ${app.application_type}, status: ${app.status}, review type: ${app.review_type || 'not set'})`);
    err.statusCode = 422;
    throw err;
  }
};

const generate = async (applicationId, issuerUserId, issuerRoles, letterType, manualNumber) => {
  const client = await pool.connect();
  let generatedFilePath = null;
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    assertLetterTypeAllowed(app, letterType, issuerRoles);
    if (letterType === 'DATA_AWAL' || letterType === 'IZIN_PENELITIAN') {
      const correspondenceResult = await client.query('SELECT * FROM application_correspondence WHERE application_id = $1', [applicationId]);
      app.correspondence = correspondenceResult.rows[0] || null;
      if (!app.correspondence) { const err = new Error('Institutional cover letter information is missing for this application'); err.statusCode = 422; throw err; }
    }
    const existing = await letterModel.findByApplicationId(applicationId, client);
    if (existing) { const err = new Error(existing.letter_status === SIGNED_STATUS ? 'A signed letter has already been uploaded for this application' : 'A letter has already been generated for this application'); err.statusCode = 409; throw err; }
    const issuerUserRoleId = await getIssuerUserRoleId(issuerUserId, issuerRoles, client);
    if (!issuerUserRoleId) { const err = new Error('Issuer role record not found for current user'); err.statusCode = 403; throw err; }
    const settingsResult = await client.query("SELECT setting_value FROM system_settings WHERE setting_key = 'letter_number_settings'");
    const config = settingsResult.rows[0]?.setting_value || {};
    const now = new Date();
    const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(now));
    const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'numeric' }).format(now));
    const romanMonths = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const render = (template, values) => template.replace(/\{(number|year|month_roman)\}/g, (_, key) => String(values[key] ?? ''));
    const templates = config.templates || {};
    const manualTypes = ['DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK'];
    let letterNumber;
    let registrationNumber = null;
    if (manualTypes.includes(letterType)) {
      const number = String(manualNumber ?? '').trim();
      if (!/^\d{1,12}$/.test(number)) { const err = new Error('Nomor surat wajib diisi dengan 1–12 digit angka.'); err.statusCode = 422; throw err; }
      const defaults = { DATA_AWAL: 'B/{number}/UN16.34/PT.01.04/{year}', IZIN_PENELITIAN: 'B/{number}/UN16.34/PK.01.06/{year}', IZIN_ETIK: '{number}/UN16.34/RSUNAND/{year}' };
      letterNumber = render(templates[letterType] || defaults[letterType], { number, year, month_roman: romanMonths[month] });
    }
    if (letterType === 'IZIN_ETIK' || letterType === 'BEBAS_KAJI_ETIK') {
      const initial = Number(config.registration_start || 1);
      if (!Number.isSafeInteger(initial) || initial < 1) { const err = new Error('Nilai awal nomor registrasi etik belum valid.'); err.statusCode = 422; throw err; }
      const counter = await client.query(
        `INSERT INTO ethics_registration_counters (year, last_value) VALUES ($1, $2)
         ON CONFLICT (year) DO UPDATE SET last_value = ethics_registration_counters.last_value + 1, updated_at = NOW()
         RETURNING last_value`,
        [year, initial]
      );
      const sequence = String(counter.rows[0].last_value).padStart(3, '0');
      const registrationTemplate = templates.REGISTRASI_ETIK || 'B{number}/UN.16.34/KEPK/{month_roman}/{year}';
      registrationNumber = render(registrationTemplate, { number: sequence, year, month_roman: romanMonths[month] });
    }
    const letter = await letterModel.create({ application_id: applicationId, letter_number: letterNumber, registration_number: registrationNumber, letter_type: letterType, file_path: null, generated_file_path: null, issued_by_user_role_id: issuerUserRoleId, letter_status: GENERATED_STATUS }, client);
    generatedFilePath = await letterPdfService.generate({ application: app, letter });
    const updatedLetter = await letterModel.updateGeneratedFile(letter.id, generatedFilePath, client);
    await client.query('COMMIT');
    return updatedLetter;
  } catch (err) {
    await client.query('ROLLBACK');
    if (generatedFilePath && fs.existsSync(generatedFilePath)) { try { fs.unlinkSync(generatedFilePath); } catch (_) {} }
    throw err;
  } finally { client.release(); }
};

const uploadSigned = async (applicationId, file, issuerUserId) => {
  if (!file) { const err = new Error('A signed letter file (PDF) is required'); err.statusCode = 400; throw err; }
  const client = await pool.connect();
  let signedFilePath = null;
  let uploadedFilePath = file.path;
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    const letter = await letterModel.findByApplicationId(applicationId, client);
    if (!letter) { const err = new Error('Generate the letter before uploading the signed PDF'); err.statusCode = 400; throw err; }
    if (letter.letter_status !== GENERATED_STATUS) { const err = new Error('The signed letter has already been uploaded for this application'); err.statusCode = 409; throw err; }
    if (!VALID_FROM_STATUSES.includes(app.status)) { const err = new Error(`Application must be ADMIN_APPROVED or APPROVED (current: ${app.status})`); err.statusCode = 400; throw err; }
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const signedDir = path.join(uploadDir, 'letters', String(applicationId));
    if (!fs.existsSync(signedDir)) fs.mkdirSync(signedDir, { recursive: true });
    signedFilePath = path.join(signedDir, `signed-${letter.letter_number}.pdf`);
    if (fs.existsSync(signedFilePath)) { const err = new Error('A signed letter file already exists for this application'); err.statusCode = 409; throw err; }
    fs.renameSync(uploadedFilePath, signedFilePath);
    uploadedFilePath = null;
    const updatedLetter = await letterModel.updateSignedFile(letter.id, signedFilePath, client);
    await applicationModel.updateStatus(applicationId, 'PERMIT_ISSUED', client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: 'PERMIT_ISSUED', changed_by: issuerUserId, note: `Signed letter uploaded: ${letter.letter_number}` }, client);
    await client.query('COMMIT');
    return updatedLetter;
  } catch (err) {
    await client.query('ROLLBACK');
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) { try { fs.unlinkSync(uploadedFilePath); } catch (_) {} }
    if (signedFilePath && fs.existsSync(signedFilePath)) { try { fs.unlinkSync(signedFilePath); } catch (_) {} }
    throw err;
  } finally { client.release(); }
};

const issue = uploadSigned;

const list = async () => letterModel.findAll();

const get = async (applicationId, userId, roles) => {
  const app = await applicationModel.findById(applicationId);
  if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
  const canAccess = roles.includes('DIKLIT') || roles.includes('SEKRETARIAT') || roles.includes('KETUA') || roles.includes('SUPERADMIN') || (roles.includes('PENELITI') && String(app.researcher_user_id) === String(userId));
  if (!canAccess) { const err = new Error('Forbidden'); err.statusCode = 403; throw err; }
  const letter = await letterModel.findByApplicationId(applicationId);
  if (!letter) { const err = new Error('No letter has been generated for this application'); err.statusCode = 404; throw err; }
  if (roles.includes('PENELITI') && letter.letter_status !== SIGNED_STATUS) { const err = new Error('The signed letter is not available yet'); err.statusCode = 404; throw err; }
  return letter;
};

const download = async (letterId, userId, roles) => {
  const letter = await letterModel.findById(letterId);
  if (!letter) { const err = new Error('Letter not found'); err.statusCode = 404; throw err; }
  const app = await applicationModel.findById(letter.application_id);
  const isResearcher = roles.includes('PENELITI');
  const canAccess = roles.includes('DIKLIT') || roles.includes('SEKRETARIAT') || roles.includes('KETUA') || roles.includes('SUPERADMIN') || (isResearcher && app && String(app.researcher_user_id) === String(userId));
  if (!canAccess) { const err = new Error('Forbidden'); err.statusCode = 403; throw err; }
  if (isResearcher && letter.letter_status !== SIGNED_STATUS) { const err = new Error('The signed letter is not available yet'); err.statusCode = 404; throw err; }
  const filePath = letter.letter_status === GENERATED_STATUS ? letter.generated_file_path : letter.file_path;
  if (!filePath || !fs.existsSync(filePath)) { const err = new Error('Letter file not found on server'); err.statusCode = 404; throw err; }
  return { filePath, originalName: `${letter.letter_number}.pdf`, mimeType: 'application/pdf' };
};

module.exports = { generate, uploadSigned, issue, list, get, download };

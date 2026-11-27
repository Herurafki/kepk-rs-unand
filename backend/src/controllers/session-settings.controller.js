'use strict';

const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { success, error } = require('../utils/response');

const getIdleSessionSettings = async (req, res, next) => {
  try {
    return success(res, await userModel.getIdleSettings(), 'Pengaturan sesi berhasil dimuat.');
  } catch (err) { next(err); }
};

const updateIdleSessionSettings = async (req, res, next) => {
  try {
    const idle = Number(req.body?.idle_timeout_minutes);
    const warning = Number(req.body?.idle_warning_minutes);
    if (!Number.isInteger(idle) || idle < 5 || idle > 1440) {
      return error(res, 'Batas inaktivitas harus berupa bilangan bulat 5–1440 menit.', 422);
    }
    if (!Number.isInteger(warning) || warning < 1 || warning >= idle) {
      return error(res, 'Peringatan harus minimal 1 menit dan lebih kecil dari batas inaktivitas.', 422);
    }
    const settings = await userModel.updateIdleSettings({
      idle_timeout_minutes: idle,
      idle_warning_minutes: warning,
    }, req.user.id);
    return success(res, settings, 'Pengaturan sesi berhasil diperbarui.');
  } catch (err) { next(err); }
};


const DEFAULT_LETTER_SETTINGS = {
  templates: {
    DATA_AWAL: 'B/{number}/UN16.34/PT.01.04/{year}',
    IZIN_PENELITIAN: 'B/{number}/UN16.34/PK.01.06/{year}',
    IZIN_ETIK: '{number}/UN16.34/RSUNAND/{year}',
    REGISTRASI_ETIK: 'B{number}/UN.16.34/KEPK/{month_roman}/{year}',
  },
  registration_start: 1,
};

const getLetterNumberSettings = async (req, res, next) => {
  try {
    const result = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'letter_number_settings'");
    const stored = result.rows[0]?.setting_value || {};
    return success(res, {
      templates: { ...DEFAULT_LETTER_SETTINGS.templates, ...(stored.templates || {}) },
      registration_start: Number(stored.registration_start || 1),
      editable_templates: req.user.roles.includes('DIKLIT')
        ? ['DATA_AWAL', 'IZIN_PENELITIAN']
        : Object.keys(DEFAULT_LETTER_SETTINGS.templates),
      can_edit_registration_start: req.user.roles.includes('SEKRETARIAT'),
    }, 'Pengaturan nomor surat berhasil dimuat.');
  } catch (err) { next(err); }
};

const updateLetterNumberSettings = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const password = req.body?.password;
    if (typeof password !== 'string' || !password) return error(res, 'Password akun wajib diisi.', 422);
    const user = await userModel.findPasswordById(req.user.id, client);
    if (!user || !(await bcrypt.compare(password, user.password))) return error(res, 'Password akun tidak sesuai.', 401);

    await client.query('BEGIN');
    const currentResult = await client.query("SELECT setting_value FROM system_settings WHERE setting_key = 'letter_number_settings' FOR UPDATE");
    const current = currentResult.rows[0]?.setting_value || {};
    const templates = { ...DEFAULT_LETTER_SETTINGS.templates, ...(current.templates || {}) };
    const incoming = req.body?.templates || {};
    const editable = req.user.roles.includes('DIKLIT')
      ? ['DATA_AWAL', 'IZIN_PENELITIAN']
      : Object.keys(DEFAULT_LETTER_SETTINGS.templates);

    for (const key of editable) {
      if (incoming[key] === undefined) continue;
      const value = String(incoming[key]).trim();
      if (!value || !value.includes('{number}') || !value.includes('{year}') || (key === 'REGISTRASI_ETIK' && !value.includes('{month_roman}'))) {
        await client.query('ROLLBACK');
        return error(res, 'Template wajib memuat {number} dan {year}; template registrasi etik juga wajib memuat {month_roman}.', 422);
      }
      if (value.length > 255) {
        await client.query('ROLLBACK');
        return error(res, 'Panjang template maksimal 255 karakter.', 422);
      }
      templates[key] = value;
    }

    let registrationStart = Number(current.registration_start || 1);
    if (req.user.roles.includes('SEKRETARIAT') && req.body?.registration_start !== undefined) {
      registrationStart = Number(req.body.registration_start);
      if (!Number.isSafeInteger(registrationStart) || registrationStart < 1) {
        await client.query('ROLLBACK');
        return error(res, 'Nomor awal registrasi etik minimal 1.', 422);
      }
    }

    const settings = { templates, registration_start: registrationStart };
    await client.query(
      "INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at) VALUES ('letter_number_settings', $1::jsonb, $2, NOW()) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()",
      [JSON.stringify(settings), req.user.id]
    );
    await client.query('COMMIT');
    return success(res, { templates, registration_start: registrationStart }, 'Pengaturan nomor surat berhasil disimpan.');
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
};

module.exports = { getIdleSessionSettings, updateIdleSessionSettings, getLetterNumberSettings, updateLetterNumberSettings };

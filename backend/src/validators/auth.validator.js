'use strict';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIK_REGEX = /^\d{16}$/;
const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

const validateRegister = (body) => {
  const errors = {};

  if (!isPlainObject(body)) {
    return { body: 'Request body must be a JSON object' };
  }

  const { name, email, password, category_id, profile } = body;

  // ── name ────────────────────────────────────────────────
  if (!isNonEmptyString(name)) {
    errors.name = 'Name is required';
  } else if (name.trim().length < 3) {
    errors.name = 'Name must be at least 3 characters';
  } else if (name.trim().length > 100) {
    errors.name = 'Name must be at most 100 characters';
  }

  // ── email ───────────────────────────────────────────────
  if (!isNonEmptyString(email)) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Email must be a valid email address';
  } else if (email.trim().length > 254) {
    errors.email = 'Email must be at most 254 characters';
  }

  // ── password ────────────────────────────────────────────
  // Password TIDAK di-trim: spasi di awal/akhir adalah karakter sah.
  if (typeof password !== 'string' || password.length === 0) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  } else if (password.length > 128) {
    errors.password = 'Password must be at most 128 characters';
  }

  // ── category_id ─────────────────────────────────────────
  if (
    category_id === undefined ||
    category_id === null ||
    category_id === ''
  ) {
    errors.category_id = 'Researcher category is required';
  } else if (
    typeof category_id !== 'string' &&
    typeof category_id !== 'number'
  ) {
    errors.category_id = 'Researcher category is invalid';
  }

  // ── profile ─────────────────────────────────────────────
  if (!isPlainObject(profile)) {
    errors.profile = 'Researcher profile is required';
  } else {
    const { nik, nim, nip, phone, address } = profile;

    // Minimal salah satu identifier akademik harus ada
    const hasIdentifier =
      isNonEmptyString(nik) ||
      isNonEmptyString(nim) ||
      isNonEmptyString(nip);

    if (!hasIdentifier) {
      errors['profile.nik'] =
        'At least one of NIK, NIM, or NIP is required';
    }

    // NIK opsional, tapi kalau diisi harus 16 digit angka
    if (nik !== undefined && nik !== null && String(nik).trim() !== '') {
      if (!NIK_REGEX.test(String(nik).trim())) {
        errors['profile.nik'] = 'NIK must be exactly 16 digits';
      }
    }

    // NIM / NIP opsional, hanya cek tipe
    if (nim !== undefined && nim !== null && nim !== '') {
      if (!isNonEmptyString(String(nim))) {
        errors['profile.nim'] = 'NIM is invalid';
      }
    }

    if (nip !== undefined && nip !== null && nip !== '') {
      if (!isNonEmptyString(String(nip))) {
        errors['profile.nip'] = 'NIP is invalid';
      }
    }

    // phone wajib (sesuai kontrak frontend)
    if (!isNonEmptyString(phone)) {
      errors['profile.phone'] = 'Phone is required';
    } else if (!PHONE_REGEX.test(phone.trim())) {
      errors['profile.phone'] = 'Phone number is invalid';
    }

    // address wajib
    if (!isNonEmptyString(address)) {
      errors['profile.address'] = 'Address is required';
    } else if (address.trim().length > 500) {
      errors['profile.address'] = 'Address must be at most 500 characters';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateLogin = (body) => {
  const errors = {};

  if (!isPlainObject(body)) {
    return { body: 'Request body must be a JSON object' };
  }

  const { email, nik, password } = body;

  const hasEmail = isNonEmptyString(email);
  const hasNik = isNonEmptyString(nik) || (typeof nik === 'number');

  // ── identifier: email ATAU nik ──────────────────────────
  if (!hasEmail && !hasNik) {
    errors.identifier = 'Email or NIK is required';
  }

  if (hasEmail && !EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Email must be a valid email address';
  }

  if (hasNik && !NIK_REGEX.test(String(nik).trim())) {
    errors.nik = 'NIK must be exactly 16 digits';
  }

  // ── password ────────────────────────────────────────────
  if (typeof password !== 'string' || password.length === 0) {
    errors.password = 'Password is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

module.exports = {
  validateRegister,
  validateLogin,
};
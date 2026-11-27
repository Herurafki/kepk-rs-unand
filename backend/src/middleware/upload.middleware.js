'use strict';
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const ALLOWED_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

/**
 * Read MAX_FILE_SIZE at call time so that dotenv is guaranteed to have loaded.
 * Falls back to 10 MB if the variable is absent or non-numeric.
 */
const getMaxFileSize = () => {
  const parsed = parseInt(process.env.MAX_FILE_SIZE, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 1024 * 1024;
};

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const documentFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIMETYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    const err = new Error('Invalid file type. Allowed: PDF, JPEG, PNG');
    err.statusCode = 400;
    return cb(err, false);
  }
  cb(null, true);
};

/**
 * Document upload middleware (for application documents).
 * A new multer instance is created per request so that MAX_FILE_SIZE is
 * evaluated at request time rather than at module-load time.
 */
const uploadApplicationDocuments = (req, res, next) => {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const tempId = crypto.randomUUID();
  const dest = path.join(uploadDir, 'applications', 'pending', tempId);
  ensureDirExists(dest);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: documentFileFilter,
    limits: { fileSize: getMaxFileSize(), files: 10 },
  }).array('documents', 10);

  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.statusCode = 413;
        err.message = `File too large. Maximum size is ${getMaxFileSize() / (1024 * 1024)} MB`;
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        err.statusCode = 413;
        err.message = 'Too many documents. Maximum is 10 files';
      } else if (!err.statusCode) {
        err.statusCode = 400;
      }
      return next(err);
    }
    req.applicationUploadDir = dest;
    next();
  });
};

const uploadDocument = (req, res, next) => {
  const applicationId = req.params.id || req.params.applicationId || 'unknown';
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const dest = path.join(uploadDir, 'applications', applicationId);
  ensureDirExists(dest);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: documentFileFilter,
    limits: { fileSize: getMaxFileSize() },
  }).single('file');

  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.statusCode = 413;
        err.message = `File too large. Maximum size is ${getMaxFileSize() / (1024 * 1024)} MB`;
      } else if (!err.statusCode) {
        err.statusCode = 400;
      }
      return next(err);
    }
    next();
  });
};

/**
 * Letter upload middleware.
 * A new multer instance is created per request for the same reason as above.
 * Only PDF files are accepted for letters.
 */
const letterFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype !== 'application/pdf' || ext !== '.pdf') {
    const err = new Error('Invalid file type. Only PDF files are accepted for letters');
    err.statusCode = 400;
    return cb(err, false);
  }
  cb(null, true);
};

const uploadLetter = (req, res, next) => {
  const applicationId = req.params.id || 'unknown';
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const dest = path.join(uploadDir, 'letters', applicationId);
  ensureDirExists(dest);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: letterFileFilter,
    limits: { fileSize: getMaxFileSize() },
  }).single('file');

  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.statusCode = 413;
        err.message = `File too large. Maximum size is ${getMaxFileSize() / (1024 * 1024)} MB`;
      } else if (!err.statusCode) {
        err.statusCode = 400;
      }
      return next(err);
    }
    next();
  });
};

module.exports = {
  uploadApplicationDocuments,
  uploadDocument,
  uploadLetter,
  ALLOWED_MIMETYPES,
  ALLOWED_EXTENSIONS,
  getMaxFileSize,
};

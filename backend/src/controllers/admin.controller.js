'use strict';
const verificationService = require('../services/verification.service');
const { success } = require('../utils/response');

// ─── DIKLIT endpoints ───────────────────────────────────────────────

const list = async (req, res, next) => {
  try {
    const apps = await verificationService.getAdminQueue([
      'SUBMITTED', 'ADMIN_REVIEW', 'REVISION_REQUIRED', 'ADMIN_APPROVED',
      'SEKRETARIS_REVIEW', 'WAITING_REVIEWER', 'UNDER_REVIEW', 'REVIEW_COMPLETED',
      'APPROVED', 'REJECTED', 'PERMIT_ISSUED',
    ], ['DATA_AWAL', 'IZIN_PENELITIAN']);
    return success(res, apps, 'Applications retrieved');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const app = await verificationService.getAdminDetail(req.params.id, req.user.id, ['DATA_AWAL', 'IZIN_PENELITIAN']);
    return success(res, app, 'Application retrieved');
  } catch (err) {
    next(err);
  }
};

const open = async (req, res, next) => {
  try {
    const app = await verificationService.open(req.params.id, req.user.id);
    return success(res, app, 'Application opened for review');
  } catch (err) {
    next(err);
  }
};

const revision = async (req, res, next) => {
  try {
    const { note } = req.body;
    const app = await verificationService.requestRevision(req.params.id, note, req.user.id);
    return success(res, app, 'Revision requested');
  } catch (err) {
    next(err);
  }
};

const reject = async (req, res, next) => {
  try {
    const { note } = req.body;
    const app = await verificationService.reject(req.params.id, note, req.user.id);
    return success(res, app, 'Application rejected');
  } catch (err) {
    next(err);
  }
};

const approveWithoutEthics = async (req, res, next) => {
  try {
    const app = await verificationService.approveWithoutEthics(req.params.id, req.user.id);
    return success(res, app, 'Application approved (no ethics review)');
  } catch (err) {
    next(err);
  }
};

const approveWithEthics = async (req, res, next) => {
  try {
    const app = await verificationService.approveWithEthics(req.params.id, req.user.id);
    return success(res, app, 'Application approved (ethics review path)');
  } catch (err) {
    next(err);
  }
};

// ─── SEKRETARIAT endpoints ──────────────────────────────────────

const sekretarisList = async (req, res, next) => {
  try {
    const apps = await verificationService.getAdminQueue([
      'ADMIN_APPROVED', 'SEKRETARIS_REVIEW', 'WAITING_REVIEWER', 'UNDER_REVIEW',
      'REVIEW_COMPLETED', 'APPROVED', 'PERMIT_ISSUED',
    ], ['IZIN_ETIK']);
    return success(res, apps, 'Applications retrieved');
  } catch (err) {
    next(err);
  }
};

const sekretarisDetail = async (req, res, next) => {
  try {
    const app = await verificationService.getAdminDetail(req.params.id, req.user.id, ['IZIN_ETIK']);
    return success(res, app, 'Application retrieved');
  } catch (err) {
    next(err);
  }
};

const sekretarisForward = async (req, res, next) => {
  try {
    const app = await verificationService.sekretarisForward(req.params.id, req.user.id);
    return success(res, app, 'Application forwarded to ethics review');
  } catch (err) {
    next(err);
  }
};

const sekretarisRevision = async (req, res, next) => {
  try {
    const { note } = req.body;
    const app = await verificationService.sekretarisRevision(req.params.id, note, req.user.id);
    return success(res, app, 'Revision requested by Sekretaris KEPK');
  } catch (err) {
    next(err);
  }
};

const sekretarisReject = async (req, res, next) => {
  try {
    const { note } = req.body;
    const app = await verificationService.sekretarisReject(req.params.id,note,req.user.id);
    return success(res,app,'Application rejected by Sekretaris KEPK');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list, getById, open, revision, reject, approveWithoutEthics, approveWithEthics,
  sekretarisList, sekretarisDetail, sekretarisForward, sekretarisRevision, sekretarisReject,

};

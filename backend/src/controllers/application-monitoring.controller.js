'use strict';

const service = require('../services/application-monitoring.service');
const { success } = require('../utils/response');

const list = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 20));
    const data = await service.list({
      page, limit,
      search: String(req.query.search || '').trim(),
      status: String(req.query.status || '').trim().toUpperCase(),
      type: String(req.query.type || '').trim().toUpperCase(),
      from: String(req.query.from || ''),
      to: String(req.query.to || ''),
    });
    return success(res, data, 'Monitoring pengajuan berhasil dimuat.');
  } catch (err) { return next(err); }
};

const summary = async (req, res, next) => {
  try {
    const data = await service.summary({ from: String(req.query.from || ''), to: String(req.query.to || '') });
    return success(res, data, 'Ringkasan pengajuan berhasil dimuat.');
  } catch (err) { return next(err); }
};

const history = async (req, res, next) => {
  try {
    const data = await service.getHistory(req.params.id);
    return success(res, data, 'Riwayat status pengajuan berhasil dimuat.');
  } catch (err) { return next(err); }
};

module.exports = { list, summary, history };

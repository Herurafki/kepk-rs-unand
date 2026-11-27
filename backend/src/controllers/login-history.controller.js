'use strict';

const loginHistoryService = require('../services/login-history.service');
const { success } = require('../utils/response');

const list = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
    const data = await loginHistoryService.list({
      page, limit,
      search: String(req.query.search || '').trim(),
      status: String(req.query.status || '').toUpperCase(),
      from: String(req.query.from || ''),
      to: String(req.query.to || ''),
    });
    return success(res, data, 'Riwayat login berhasil dimuat.');
  } catch (err) { return next(err); }
};

module.exports = { list };

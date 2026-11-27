'use strict';

const paymentService = require('../services/payment.service');
const { success } = require('../utils/response');
const { recordAuditEvent } = require('../services/audit.service');

const getTariffs = async (req, res, next) => {
  try {
    const data = await paymentService.getTransmedikTariffs({
      name: req.query.namaproduk,
      take: req.query.take,
    });
    return success(res, data, 'Transmedik tariff catalog retrieved');
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    const invoice = await paymentService.createInvoice({
      applicationId: req.body.application_id,
      invoiceType: req.body.invoice_type,
      items: req.body.items,
      invoiceDiscountPercent: req.body.invoice_discount_percent,
      replacementInvoiceId: req.body.replacement_invoice_id,
      issuedBy: req.user.id,
      roles: req.user.roles,
    });
    return success(res, invoice, 'Invoice issued successfully', 201);
  } catch (error) { next(error); }
};

const cancel = async (req, res, next) => {
  try {
    const invoice = await paymentService.cancelInvoice(req.params.id, req.user);
    return success(res, invoice, 'Invoice cancelled successfully');
  } catch (error) { next(error); }
};

const cancelAndReplace = async (req, res, next) => {
  try {
    const result = await paymentService.cancelAndReplaceInvoice(req.params.id, req.body, req.user);
    return success(res, result, 'Invoice cancelled and replacement issued');
  } catch (error) { next(error); }
};

const listApplicationInvoices = async (req, res, next) => {
  try {
    const data = await paymentService.listApplicationInvoices(req.params.applicationId, req.user.id, req.user.roles);
    return success(res, data, 'Application invoices retrieved');
  } catch (error) { next(error); }
};

const searchForCashier = async (req, res, next) => {
  try {
    const data = await paymentService.searchInvoicesForCashier({
      refNumber: req.query.ref,
      researcherName: req.query.nama,
      limit: req.query.take,
      offset: req.query.offset,
    });
    return success(res, data, 'Invoices retrieved');
  } catch (error) { next(error); }
};

const submitReceipt = async (req, res, next) => {
  try {
    const result = await paymentService.submitReceiptAndVerify(req.params.id, req.body, req.user.id);
    return success(res, result, 'Payment verification processed');
  } catch (error) { next(error); }
};

const inspectTransmedik = async (req, res, next) => {
  try {
    const result = await paymentService.inspectTransmedikPayment(req.params.id, req.user);
    return success(res, result, 'Transmedik payment details retrieved');
  } catch (error) { next(error); }
};


const decideInvalidRef = async (req, res, next) => {
  try {
    const result = await paymentService.decideInvalidRefManually(req.params.id, req.body, req.user);
    await recordAuditEvent({
      user: req.user,
      action: result.decision === 'APPROVE' ? 'PAYMENT_INVALID_REF_MANUALLY_APPROVED' : 'PAYMENT_INVALID_REF_REJECTED',
      req,
      entityType: 'PAYMENT',
      entityId: String(req.params.id),
      oldData: result.oldData,
      newData: { ...result.newData, decision: result.decision },
      statusCode: 200,
    });
    return success(res, result, result.decision === 'APPROVE'
      ? 'Payment manually approved by DIKLIT'
      : 'Payment rejected; invoice returned to unpaid status');
  } catch (error) { next(error); }
};

module.exports = { getTariffs, create, cancel, cancelAndReplace, listApplicationInvoices, searchForCashier, submitReceipt, inspectTransmedik, decideInvalidRef };

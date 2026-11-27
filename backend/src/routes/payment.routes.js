'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.get('/integrations/transmedik/invoices/search', require('../middleware/transmedik.middleware').authenticateTransmedik, controller.searchForCashier);

router.use(authenticate);
router.get('/payments/tariffs', authorize('DIKLIT', 'SEKRETARIAT', 'SUPERADMIN'), controller.getTariffs);
router.get('/payments/applications/:applicationId/invoices', authorize('PENELITI', 'DIKLIT', 'SEKRETARIAT', 'SUPERADMIN'), controller.listApplicationInvoices);
router.post('/payments/invoices', authorize('DIKLIT', 'SEKRETARIAT'), controller.create);
router.post('/payments/invoices/:id/cancel', authorize('DIKLIT', 'SEKRETARIAT', 'SUPERADMIN'), controller.cancel);
router.post('/payments/invoices/:id/replace', authorize('DIKLIT', 'SEKRETARIAT'), controller.cancelAndReplace);
router.post('/payments/invoices/:id/verify-payment', authorize('PENELITI'), controller.submitReceipt);
router.post('/payments/invoices/:id/inspect-transmedik', authorize('DIKLIT', 'SUPERADMIN'), controller.inspectTransmedik);
router.post('/payments/invoices/:id/invalid-ref-decision', authorize('DIKLIT', 'SUPERADMIN'), controller.decideInvalidRef);

module.exports = router;

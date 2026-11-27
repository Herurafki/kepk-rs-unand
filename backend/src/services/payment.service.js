'use strict';

const pool = require('../config/database');

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const money = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw httpError(`Invalid ${field}`);
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

const percent = (value, field) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw httpError(`Invalid ${field}; value must be between 0 and 100`);
  return number;
};

const generateRefNumber = async (client) => {
  const result = await client.query(
    `INSERT INTO payment_ref_counters (ref_date, last_sequence)
     VALUES (CURRENT_DATE, 1)
     ON CONFLICT (ref_date) DO UPDATE
       SET last_sequence = payment_ref_counters.last_sequence + 1,
           updated_at = NOW()
     WHERE payment_ref_counters.last_sequence < 999
     RETURNING ref_date, last_sequence`
  );
  if (!result.rows[0]) throw httpError('Daily Ref Number limit (999) has been reached', 409);
  const { ref_date: date, last_sequence: sequence } = result.rows[0];
  const dateValue = new Date(date);
  const yy = String(dateValue.getUTCFullYear()).slice(-2);
  const mm = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateValue.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}${String(sequence).padStart(3, '0')}`;
};

const buildItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw httpError('At least one invoice item is required');
  return items.map((item, index) => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw httpError(`Invalid quantity for item ${index + 1}`);
    const unitPrice = money(item.unit_price, 'unit_price');
    const discountPercent = percent(item.discount_percent, 'discount_percent');
    const gross = Math.round(quantity * unitPrice * 100) / 100;
    const discountAmount = Math.round(gross * discountPercent) / 100;
    return {
      product_id: item.product_id ? String(item.product_id) : null,
      product_name: String(item.product_name || '').trim(),
      quantity,
      unit_price: unitPrice,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      total: Math.round((gross - discountAmount) * 100) / 100,
      gross,
    };
  }).map((item, index) => {
    if (!item.product_name) throw httpError(`Product name is required for item ${index + 1}`);
    return item;
  });
};

const createInvoiceInTransaction = async (client, { applicationId, invoiceType, items, invoiceDiscountPercent, replacementInvoiceId, issuedBy }) => {
  const appResult = await client.query(
    `SELECT a.id, a.application_type, a.status, u.name AS researcher_name
     FROM applications a
     JOIN researchers r ON r.id = a.researcher_id
     JOIN users u ON u.id = r.user_id
     WHERE a.id = $1 FOR UPDATE OF a`,
    [applicationId]
  );
  const app = appResult.rows[0];
  if (!app) throw httpError('Application not found', 404);
  if (invoiceType === 'RESEARCH' && !['DATA_AWAL', 'IZIN_PENELITIAN'].includes(app.application_type)) {
    throw httpError('Research invoice is only allowed for DATA_AWAL or IZIN_PENELITIAN');
  }
  if (invoiceType === 'RESEARCH' && !['APPROVED', 'REQUIRED_ETHICS', 'ADMIN_APPROVED'].includes(app.status)) {
    throw httpError('Research invoice can only be issued after DIKLIT approval', 409);
  }
  if (invoiceType === 'ETHICS' && app.application_type !== 'IZIN_ETIK') {
    throw httpError('Ethics invoice is only allowed for IZIN_ETIK');
  }
  if (invoiceType === 'ETHICS' && app.status !== 'SEKRETARIS_REVIEW') {
    throw httpError('Ethics invoice can only be issued while the application is under Sekretariat review', 409);
  }
  const activeInvoice = await client.query(
    `SELECT id FROM invoices
     WHERE application_id = $1 AND invoice_type = $2 AND status = 'ISSUED'
     LIMIT 1 FOR UPDATE`,
    [applicationId, invoiceType]
  );
  if (activeInvoice.rows[0]) throw httpError('An active invoice of this type already exists for this application', 409);

  if (replacementInvoiceId) {
    const cancelledInvoice = await client.query(
      `SELECT id FROM invoices
       WHERE id = $1 AND application_id = $2 AND invoice_type = $3
         AND status = 'CANCELLED' AND replacement_invoice_id IS NULL
       FOR UPDATE`,
      [replacementInvoiceId, applicationId, invoiceType]
    );
    if (!cancelledInvoice.rows[0]) throw httpError('Cancelled invoice is not eligible for replacement', 409);
  }

  const normalizedItems = buildItems(items);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.gross, 0);
  const itemDiscount = normalizedItems.reduce((sum, item) => sum + item.discount_amount, 0);
  const afterItemDiscount = Math.round((subtotal - itemDiscount) * 100) / 100;
  const invoicePercent = percent(invoiceDiscountPercent, 'invoice_discount_percent');
  const invoiceDiscountAmount = Math.round(afterItemDiscount * invoicePercent) / 100;
  const discountTotal = Math.round((itemDiscount + invoiceDiscountAmount) * 100) / 100;
  const total = Math.round((subtotal - discountTotal) * 100) / 100;

  const refNumber = await generateRefNumber(client);
  const invoiceNumberResult = await client.query(
    `INSERT INTO invoice_number_counters (year, last_value)
     VALUES (EXTRACT(YEAR FROM CURRENT_DATE)::int, 1)
     ON CONFLICT (year) DO UPDATE SET last_value = invoice_number_counters.last_value + 1, updated_at = NOW()
     RETURNING year, last_value`
  ).catch(async (error) => {
    if (error.code === '42P01') throw httpError('Invoice number counter migration is missing', 500);
    throw error;
  });
  const counter = invoiceNumberResult.rows[0];
  const invoiceNumber = `INV-KEPK-${counter.year}-${String(counter.last_value).padStart(6, '0')}`;
  const invoiceResult = await client.query(
    `INSERT INTO invoices (application_id, invoice_number, invoice_type, issued_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [applicationId, invoiceNumber, invoiceType, issuedBy]
  );
  const invoice = invoiceResult.rows[0];

  if (replacementInvoiceId) {
    await client.query(
      `UPDATE invoices SET replacement_invoice_id = $1, updated_at = NOW() WHERE id = $2`,
      [invoice.id, replacementInvoiceId]
    );
  }

  for (const item of normalizedItems) {
    await client.query(
      `INSERT INTO payment_items
       (invoice_id, product_id, product_name, quantity, unit_price, discount_percent, discount_amount, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [invoice.id, item.product_id, item.product_name, item.quantity, item.unit_price,
        item.discount_percent, item.discount_amount, item.total]
    );
  }

  await client.query(
    `INSERT INTO payments
     (application_id, invoice_id, ref_number, subtotal, discount_total,
      invoice_discount_percent, invoice_discount_amount, total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [applicationId, invoice.id, refNumber, subtotal, discountTotal, invoicePercent, invoiceDiscountAmount, total]
  );

  return { ...invoice, ref_number: refNumber, researcher_name: app.researcher_name, subtotal, discount_total: discountTotal, total };
};

const assertInvoiceRole = (invoiceType, roles = []) => {
  const allowed = invoiceType === 'RESEARCH' ? 'DIKLIT' : 'SEKRETARIAT';
  if (!roles.includes(allowed) && !roles.includes('SUPERADMIN')) {
    throw httpError('You are not allowed to manage this invoice type', 403);
  }
};

const createInvoice = async (data) => {
  assertInvoiceRole(data.invoiceType, data.roles);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invoice = await createInvoiceInTransaction(client, data);
    await client.query('COMMIT');
    return invoice;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const cancelInvoice = async (invoiceId, actor) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT i.*, p.nostruk, p.nosbm, p.verification, p.status AS payment_check_status
       FROM invoices i JOIN payments p ON p.invoice_id = i.id
       WHERE i.id = $1 FOR UPDATE OF i, p`,
      [invoiceId]
    );
    const invoice = result.rows[0];
    if (!invoice) throw httpError('Invoice not found', 404);
    if (invoice.status !== 'ISSUED') throw httpError('Only an issued invoice can be cancelled', 409);
    assertInvoiceRole(invoice.invoice_type, actor.roles || []);
    if (invoice.verification === 'verified' || invoice.payment_check_status === '01_VALID') {
      throw httpError('A verified/paid invoice cannot be cancelled', 409);
    }
    if (invoice.nostruk || invoice.nosbm) {
      throw httpError('Invoice has cashier receipt identifiers; confirm its payment status with Transmedik before cancellation', 409);
    }
    const cancelled = await client.query(
      `UPDATE invoices SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [invoiceId]
    );
    await client.query('COMMIT');
    return cancelled.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const cancelAndReplaceInvoice = async (invoiceId, data, actor) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT i.*, p.nostruk, p.nosbm, p.verification, p.invoice_discount_percent, p.status AS payment_check_status
       FROM invoices i JOIN payments p ON p.invoice_id = i.id
       WHERE i.id = $1 FOR UPDATE OF i, p`,
      [invoiceId]
    );
    const current = currentResult.rows[0];
    if (!current) throw httpError('Invoice not found', 404);
    if (current.status !== 'ISSUED') throw httpError('Only an issued invoice can be cancelled', 409);
    assertInvoiceRole(current.invoice_type, actor.roles || []);
    if (current.verification === 'verified' || current.payment_check_status === '01_VALID') {
      throw httpError('A verified/paid invoice cannot be cancelled', 409);
    }
    if (current.nostruk || current.nosbm) {
      throw httpError('Invoice has cashier receipt identifiers; confirm its payment status with Transmedik before cancellation', 409);
    }

    const oldItems = await client.query(
      `SELECT product_id, product_name, quantity, unit_price, discount_percent
       FROM payment_items WHERE invoice_id = $1 ORDER BY id`,
      [invoiceId]
    );
    await client.query(
      `UPDATE invoices SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [invoiceId]
    );
    const replacementData = {
      applicationId: current.application_id,
      invoiceType: current.invoice_type,
      items: data.items || oldItems.rows,
      invoiceDiscountPercent: data.invoice_discount_percent ?? current.invoice_discount_percent ?? 0,
      issuedBy: actor.id,
    };
    const replacement = await createInvoiceInTransaction(client, replacementData);
    await client.query(
      `UPDATE invoices SET replacement_invoice_id = $1, updated_at = NOW() WHERE id = $2`,
      [replacement.id, invoiceId]
    );
    await client.query('COMMIT');
    return { cancelled_invoice_id: current.id, replacement_invoice: replacement };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};


const listApplicationInvoices = async (applicationId, userId, roles = []) => {
  const appResult = await pool.query(
    `SELECT a.id, r.user_id AS researcher_user_id
     FROM applications a JOIN researchers r ON r.id = a.researcher_id
     WHERE a.id = $1`,
    [applicationId]
  );
  const app = appResult.rows[0];
  if (!app) throw httpError('Application not found', 404);
  if (roles.includes('PENELITI') && String(app.researcher_user_id) !== String(userId)) {
    throw httpError('Forbidden', 403);
  }
  if (!roles.some((role) => ['PENELITI','DIKLIT','SEKRETARIAT','SUPERADMIN'].includes(role))) {
    throw httpError('Forbidden', 403);
  }
  const conditions = ['i.application_id = $1'];
  const params = [applicationId];
  if (roles.includes('DIKLIT') && !roles.includes('SUPERADMIN')) conditions.push("i.invoice_type = 'RESEARCH'");
  if (roles.includes('SEKRETARIAT') && !roles.includes('SUPERADMIN')) conditions.push("i.invoice_type = 'ETHICS'");
  const result = await pool.query(
    `SELECT i.*, p.id AS payment_id, p.ref_number, p.subtotal, p.discount_total,
            p.invoice_discount_percent, p.invoice_discount_amount, p.total,
            p.nostruk, p.nosbm, p.status_pembayaran, p.is_lunas,
            p.dibayar_oleh, p.total_dibayar, p.total_tagihan, p.sisa_tagihan,
            p.tgl_pembayaran, p.cara_bayar, p.kasir, p.keterangan,
            p.verification, p.status AS payment_status, p.verified_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', pi.id, 'product_id', pi.product_id,
                'product_name', pi.product_name, 'quantity', pi.quantity,
                'unit_price', pi.unit_price, 'discount_percent', pi.discount_percent,
                'discount_amount', pi.discount_amount, 'total', pi.total
              ) ORDER BY pi.id)
              FROM payment_items pi WHERE pi.invoice_id = i.id
            ), '[]'::json) AS items
     FROM invoices i JOIN payments p ON p.invoice_id = i.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.created_at DESC`,
    params
  );
  return result.rows;
};

const searchInvoicesForCashier = async ({ refNumber, researcherName, limit = 20, offset = 0 }) => {
  if (!refNumber && !researcherName) throw httpError('Provide ref_number or researcher_name');
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const params = [];
  const conditions = [`i.status = 'ISSUED' AND p.verification = 'unverified' AND p.nostruk IS NULL AND p.nosbm IS NULL`];
  if (refNumber) {
    params.push(String(refNumber).trim());
    conditions.push(`p.ref_number = $${params.length}`);
  } else {
    const name = String(researcherName).trim();
    if (name.length < 3) throw httpError('researcher_name must contain at least 3 characters');
    params.push(`%${name}%`);
    conditions.push(`u.name ILIKE $${params.length}`);
  }
  params.push(safeLimit, safeOffset);
  const result = await pool.query(
    `SELECT p.ref_number, i.invoice_number, u.name AS nama,
            p.total AS total_pembayaran, TO_CHAR(i.issued_at AT TIME ZONE 'Asia/Jakarta','DD-MM-YYYY HH24:MI:SS') AS tanggal_dibuat,
            i.status AS status_invoice,
            CASE WHEN p.verification = 'verified' THEN 'PAID' ELSE 'UNPAID' END AS status_pembayaran
     FROM invoices i
     JOIN payments p ON p.invoice_id = i.id
     JOIN applications a ON a.id = i.application_id
     JOIN researchers r ON r.id = a.researcher_id
     JOIN users u ON u.id = r.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.issued_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const submitReceiptAndVerify = async (invoiceId, { nostruk, nosbm }, userId) => {
  if (!nostruk || !nosbm) {
    throw httpError('nostruk and nosbm are required');
  }

  let invoice;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query(
      `SELECT i.id, i.application_id, i.status,
              p.ref_number, p.total, p.verification
       FROM invoices i
       JOIN payments p ON p.invoice_id = i.id
       WHERE i.id = $1
       FOR UPDATE OF i, p`,
      [invoiceId]
    );

    invoice = invoiceResult.rows[0];

    if (!invoice) {
      throw httpError('Invoice not found', 404);
    }
    const ownerResult = await client.query(
      `SELECT r.user_id FROM applications a
       JOIN researchers r ON r.id = a.researcher_id
       WHERE a.id = $1`,
      [invoice.application_id]
    );
    if (!ownerResult.rows[0] || String(ownerResult.rows[0].user_id) !== String(userId)) {
      throw httpError('You can only submit payment details for your own application', 403);
    }
    if (invoice.status !== 'ISSUED') throw httpError('Invoice is not payable', 409);
    if (invoice.verification === 'verified') throw httpError('Payment is already verified', 409);

    await client.query(
      `UPDATE payments SET nostruk = $1, nosbm = $2, status = NULL,
       verification = 'unverified', verified_at = NULL, verified_by = NULL,
       updated_at = NOW() WHERE invoice_id = $3`,
      [String(nostruk).trim(), String(nosbm).trim(), invoiceId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505' &&
      error.constraint === 'uq_payments_nostruk_nosbm') {
    throw httpError(
      'Nomor struk dan nomor bukti pembayaran ini sudah pernah digunakan. Silakan periksa kembali data pembayaran Anda.',
      409
    );
  }
    throw error;
  } finally {
    client.release();
  }

  const endpoint = process.env.TRANSMEDIK_PAYMENT_CHECK_URL;
  if (!endpoint) throw httpError('TRANSMEDIK_PAYMENT_CHECK_URL is not configured', 503);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.TRANSMEDIK_API_KEY) headers['X-API-Key'] = process.env.TRANSMEDIK_API_KEY;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ nostruk: String(nostruk).trim(), nosbm: String(nosbm).trim() }),
      signal: AbortSignal.timeout(Number(process.env.TRANSMEDIK_TIMEOUT_MS || 10000)),
    });
    if (!response.ok) {
      await updatePaymentCheck(invoiceId, { status: '03_HTTP_ERROR' });
      throw httpError(`Transmedik returned HTTP ${response.status}`, 502);
    }
    const payload = await response.json();
    const remote = payload.response || payload.data || {};
    const remoteRef = String(remote.ref_number || remote.refnumber || '').trim();
    const refMatches = remoteRef === String(invoice.ref_number);
    const amount = Number(remote.total_tagihan);
    const amountMatches = Number.isFinite(amount) && Math.round(amount * 100) === Math.round(Number(invoice.total) * 100);
    const receiptMatches = String(remote.nostruk || '').trim() === String(nostruk).trim()
      && String(remote.nosbm || '').trim() === String(nosbm).trim();
    const status = refMatches && amountMatches ? '01_VALID'
      : !refMatches && amountMatches ? '01_INVALID_REF'
        : refMatches && !amountMatches ? '01_INVALID_NOM'
          : '01_INVALID_BOTH';
    const isPaid = remote.is_lunas === true || remote.is_lunas === 'true' || remote.is_lunas === 1;
    const valid = status === '01_VALID' && receiptMatches && isPaid
      && Number(remote.sisa_tagihan) === 0;
    const finalStatus = valid ? '01_VALID' : (status === '01_VALID' ? '01_INVALID_BOTH' : status);
    await updatePaymentCheck(invoiceId, {
      status: finalStatus,
      verification: valid ? 'verified' : 'unverified',
      verifiedAt: valid ? new Date() : null,
      verifiedBy: null,
      remote,
    });
    return { verification: valid ? 'verified' : 'unverified', status: finalStatus, transmedik: remote };
  } catch (error) {
    console.error('[TRANSMEDIK PAYMENT ERROR]', {
      name: error.name,
      message: error.message,
      cause: error.cause?.message,
      stack: error.stack,
    });
  
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      await updatePaymentCheck(invoiceId, { status: '03_TIMEOUT' });
      throw httpError('Transmedik request timed out', 504);
    }
  
    if (error.statusCode) throw error;
  
    await updatePaymentCheck(invoiceId, {
      status: '03_CONNECTION_ERROR'
    });
  
    throw httpError('Unable to connect to Transmedik', 502);
  }
};

const updatePaymentCheck = async (invoiceId, { status, verification = 'unverified', verifiedAt = null, verifiedBy = null, remote = {} }) => {
  await pool.query(
    `UPDATE payments SET
       status = $1, verification = $2, verified_at = $3, verified_by = $4,
       status_pembayaran = $5, is_lunas = $6, dibayar_oleh = $7,
       total_dibayar = $8, total_tagihan = $9, sisa_tagihan = $10,
       tgl_pembayaran = $11, cara_bayar = $12, kasir = $13, keterangan = $14,
       updated_at = NOW()
     WHERE invoice_id = $15`,
    [status, verification, verifiedAt, verifiedBy,
      remote.status_pembayaran ?? null, (remote.is_lunas === true || remote.is_lunas === 'true' || remote.is_lunas === 1),
      remote.dibayar_oleh ?? null, remote.total_dibayar ?? null,
      remote.total_tagihan ?? null, remote.sisa_tagihan ?? null,
      remote.tgl_pembayaran ?? null, remote.cara_bayar ?? null,
      remote.kasir ?? null, remote.keterangan ?? null, invoiceId]
  );
};


const getTransmedikTariffs = async ({ name = '', take = 10 } = {}) => {
  const endpoint = process.env.TRANSMEDIK_PRODUCT_LIST_URL;
  if (!endpoint) throw httpError('TRANSMEDIK_PRODUCT_LIST_URL is not configured', 503);

  const safeTake = Math.min(Math.max(Number(take) || 10, 1), 100);
  const url = new URL(endpoint);
  url.searchParams.set('namaproduk', String(name).trim());
  url.searchParams.set('take', String(safeTake));

  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (process.env.TRANSMEDIK_X_TOKEN) headers['x-token'] = process.env.TRANSMEDIK_X_TOKEN;
    if (process.env.TRANSMEDIK_X_USERNAME) headers['x-username'] = process.env.TRANSMEDIK_X_USERNAME;

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(Number(process.env.TRANSMEDIK_TIMEOUT_MS || 10000)),
    });

    if (!response.ok) {
      throw httpError(`Transmedik tariff service returned HTTP ${response.status}`, 502);
    }

    const payload = await response.json();
    if (payload?.metadata?.code !== undefined && ![200, '200'].includes(payload.metadata.code)) {
      throw httpError(payload.metadata.message || 'Transmedik rejected tariff request', 502);
    }

    const products = payload?.response?.produk;
    if (!Array.isArray(products)) {
      throw httpError('Invalid tariff response from Transmedik', 502);
    }

    return {
      total: Number(payload.response.total ?? products.length),
      products: products.map((product) => {
        const price = Number(product.harga);
        if (!product.id || !String(product.namaproduk || '').trim() || !Number.isFinite(price) || price < 0) {
          return null;
        }
        return {
          id: String(product.id),
          name: String(product.namaproduk).trim(),
          price,
        };
      }).filter(Boolean),
    };
  } catch (error) {
    if (error.statusCode) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw httpError('Transmedik tariff request timed out', 504);
    }
    console.error('[TRANSMEDIK TARIFF ERROR]', error.message);
    throw httpError('Unable to retrieve tariff catalog from Transmedik', 502);
  }
};


const inspectTransmedikPayment = async (invoiceId, actor = {}) => {
  const roles = actor.roles || [];
  if (!roles.includes('DIKLIT') && !roles.includes('SUPERADMIN')) {
    throw httpError('Only DIKLIT can inspect this Transmedik payment', 403);
  }

  const result = await pool.query(
    `SELECT i.id, i.invoice_number, i.invoice_type, i.status AS invoice_status,
            p.ref_number, p.total, p.nostruk, p.nosbm, p.status AS payment_status
     FROM invoices i
     JOIN payments p ON p.invoice_id = i.id
     WHERE i.id = $1`,
    [invoiceId]
  );
  const invoice = result.rows[0];
  if (!invoice) throw httpError('Invoice not found', 404);
  if (invoice.invoice_type !== 'RESEARCH') throw httpError('Only research invoices can be inspected by DIKLIT', 403);
  if (invoice.invoice_status !== 'ISSUED') throw httpError('Only issued invoices can be inspected', 409);
  if (!['01_INVALID_REF', '01_INVALID_NOM'].includes(invoice.payment_status)) {
    throw httpError('Transmedik inspection is only available for INVALID_REF or INVALID_NOM invoices', 409);
  }
  if (!invoice.nostruk || !invoice.nosbm) {
    throw httpError('Receipt number and payment proof number are required', 409);
  }

  const endpoint = process.env.TRANSMEDIK_PAYMENT_CHECK_URL;
  if (!endpoint) throw httpError('TRANSMEDIK_PAYMENT_CHECK_URL is not configured', 503);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.TRANSMEDIK_API_KEY) headers['X-API-Key'] = process.env.TRANSMEDIK_API_KEY;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ nostruk: invoice.nostruk, nosbm: invoice.nosbm }),
      signal: AbortSignal.timeout(Number(process.env.TRANSMEDIK_TIMEOUT_MS || 10000)),
    });
    if (!response.ok) throw httpError(`Transmedik returned HTTP ${response.status}`, 502);

    const payload = await response.json();
    const remote = payload.response || payload.data || {};
    const remoteRef = String(remote.ref_number || remote.refnumber || '').trim();
    const remoteTotal = Number(remote.total_tagihan);
    const remoteNostruk = String(remote.nostruk || '').trim();
    const remoteNosbm = String(remote.nosbm || '').trim();

    return {
      invoice: {
        invoice_number: invoice.invoice_number,
        payment_status: invoice.payment_status,
        ref_number: invoice.ref_number,
        total: Number(invoice.total),
        nostruk: invoice.nostruk,
        nosbm: invoice.nosbm,
      },
      comparison: {
        ref_number: {
          expected: String(invoice.ref_number),
          received: remoteRef || null,
          matches: Boolean(remoteRef) && remoteRef === String(invoice.ref_number),
        },
        total_tagihan: {
          expected: Number(invoice.total),
          received: Number.isFinite(remoteTotal) ? remoteTotal : null,
          matches: Number.isFinite(remoteTotal)
            && Math.round(remoteTotal * 100) === Math.round(Number(invoice.total) * 100),
        },
        nostruk: {
          expected: invoice.nostruk,
          received: remoteNostruk || null,
          matches: Boolean(remoteNostruk) && remoteNostruk === String(invoice.nostruk),
        },
        nosbm: {
          expected: invoice.nosbm,
          received: remoteNosbm || null,
          matches: Boolean(remoteNosbm) && remoteNosbm === String(invoice.nosbm),
        },
        is_lunas: remote.is_lunas ?? null,
        sisa_tagihan: remote.sisa_tagihan ?? null,
      },
      transmedik: remote,
      metadata: payload.metadata || null,
    };
  } catch (error) {
    if (error.statusCode) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw httpError('Transmedik request timed out', 504);
    }
    console.error('[TRANSMEDIK INSPECTION ERROR]', error.message);
    throw httpError('Unable to retrieve payment details from Transmedik', 502);
  }
};


const decideInvalidRefManually = async (invoiceId, { decision, note }, actor = {}) => {
  const roles = actor.roles || [];
  if (!roles.includes('DIKLIT') && !roles.includes('SUPERADMIN')) {
    throw httpError('Only DIKLIT can decide an INVALID_REF or INVALID_NOM payment', 403);
  }
  const normalizedDecision = String(decision || '').trim().toUpperCase();
  if (!['APPROVE', 'REJECT'].includes(normalizedDecision)) {
    throw httpError('Decision must be APPROVE or REJECT');
  }
  const reason = String(note || '').trim();

  // Approval requires a fresh Transmedik response, not only the values previously
  // displayed in the browser. Rejection can reset the payment without another call.
  let inspection = null;
  if (normalizedDecision === 'APPROVE') {
    inspection = await inspectTransmedikPayment(invoiceId, actor);
    const comparison = inspection.comparison;
    const isPaid = comparison.is_lunas === true
      || comparison.is_lunas === 'true'
      || comparison.is_lunas === 1
      || comparison.is_lunas === '1';
    const noRemainingBalance = Number(comparison.sisa_tagihan) === 0;

    const paymentStatus = inspection.invoice.payment_status;
    if (!comparison.ref_number.received) {
      throw httpError('Manual approval is blocked because Ref Number is unavailable from Transmedik', 409);
    }
    if (paymentStatus === '01_INVALID_REF') {
      if (comparison.ref_number.matches) {
        throw httpError('INVALID_REF approval requires a different Ref Number from Transmedik', 409);
      }
      if (!comparison.total_tagihan.matches) {
        throw httpError('INVALID_REF approval requires Total Tagihan to match', 409);
      }
      if (!comparison.nostruk.matches || !comparison.nosbm.matches) {
        throw httpError('INVALID_REF approval requires both receipt identifiers to match Transmedik', 409);
      }
      if (!isPaid || !noRemainingBalance) {
        throw httpError('INVALID_REF approval requires Transmedik to confirm a fully paid transaction', 409);
      }
    } else if (paymentStatus === '01_INVALID_NOM') {
      // For INVALID_NOM, DIKLIT may approve the nominal discrepancy manually
      // as long as the Ref Number returned by Transmedik matches the KEPK invoice.
      if (!comparison.ref_number.matches) {
        throw httpError('INVALID_NOM approval requires Ref Number to match', 409);
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT i.id, i.invoice_number, i.invoice_type, i.status AS invoice_status,
              p.ref_number, p.total, p.nostruk, p.nosbm, p.status,
              p.verification, p.verified_by, p.verified_at,
              p.status_pembayaran, p.is_lunas, p.dibayar_oleh,
              p.total_dibayar, p.total_tagihan, p.sisa_tagihan,
              p.tgl_pembayaran, p.cara_bayar, p.kasir, p.keterangan
       FROM invoices i JOIN payments p ON p.invoice_id = i.id
       WHERE i.id = $1 FOR UPDATE OF i, p`,
      [invoiceId]
    );
    const current = locked.rows[0];
    if (!current) throw httpError('Invoice not found', 404);
    if (current.invoice_type !== 'RESEARCH') throw httpError('Only RESEARCH invoices can be decided by DIKLIT', 403);
    if (current.invoice_status !== 'ISSUED') throw httpError('Only issued invoices can be decided', 409);
    if (!['01_INVALID_REF', '01_INVALID_NOM'].includes(current.status) || current.verification === 'verified') {
      throw httpError('Invoice is no longer awaiting INVALID_REF or INVALID_NOM manual decision', 409);
    }
    if (inspection && current.status !== inspection.invoice.payment_status) {
      throw httpError('Payment status changed after Transmedik inspection. Please inspect again.', 409);
    }
    if (normalizedDecision === 'APPROVE') {
      if (String(current.nostruk) !== String(inspection.invoice.nostruk)
        || String(current.nosbm) !== String(inspection.invoice.nosbm)
        || String(current.ref_number) !== String(inspection.invoice.ref_number)
        || Number(current.total) !== Number(inspection.invoice.total)) {
        throw httpError('Payment details changed after Transmedik inspection. Please inspect again.', 409);
      }
      const remote = inspection.transmedik || {};
      await client.query(
        `UPDATE payments SET
           status = '01_VALID', verification = 'verified',
           verified_by = $1, verified_at = NOW(),
           status_pembayaran = $2, is_lunas = TRUE,
           dibayar_oleh = $3, total_dibayar = $4, total_tagihan = $5,
           sisa_tagihan = 0, tgl_pembayaran = $6, cara_bayar = $7,
           kasir = $8, keterangan = $9, updated_at = NOW()
         WHERE invoice_id = $10`,
        [
          actor.id,
          remote.status_pembayaran ?? null,
          remote.dibayar_oleh ?? null,
          remote.total_dibayar ?? null,
          remote.total_tagihan ?? current.total,
          remote.tgl_pembayaran ?? null,
          remote.cara_bayar ?? null,
          remote.kasir ?? null,
          `Disetujui manual oleh DIKLIT untuk ${current.status}. Ref Number Transmedik: ${inspection.comparison.ref_number.received}; Ref Number KEPK: ${current.ref_number}. Catatan: ${reason || 'Tidak ada catatan tambahan.'}`,
          invoiceId,
        ]
      );
    } else {
      // Rejected receipt details are cleared so the researcher can submit a new
      // receipt pair and the payment returns to the unpaid state.
      await client.query(
        `UPDATE payments SET
           nostruk = NULL, nosbm = NULL, status = NULL,
           verification = 'unverified', verified_by = NULL, verified_at = NULL,
           status_pembayaran = NULL, is_lunas = NULL, dibayar_oleh = NULL,
           total_dibayar = NULL, total_tagihan = NULL, sisa_tagihan = NULL,
           tgl_pembayaran = NULL, cara_bayar = NULL, kasir = NULL,
           keterangan = $1, updated_at = NOW()
         WHERE invoice_id = $2`,
        [`Ditolak oleh DIKLIT. Peneliti dapat mengirim ulang bukti pembayaran. Catatan: ${reason || 'Tidak ada catatan tambahan.'}`, invoiceId]
      );
    }

    const after = await client.query(
      `SELECT invoice_id, ref_number, total, nostruk, nosbm, status,
              verification, verified_by, verified_at, status_pembayaran,
              is_lunas, total_dibayar, total_tagihan, sisa_tagihan, keterangan
       FROM payments WHERE invoice_id = $1`,
      [invoiceId]
    );
    await client.query('COMMIT');
    return {
      decision: normalizedDecision,
      payment: after.rows[0],
      oldData: {
        status: current.status,
        verification: current.verification,
        verified_by: current.verified_by,
        verified_at: current.verified_at,
        nostruk: current.nostruk,
        nosbm: current.nosbm,
        ref_number: current.ref_number,
        total: current.total,
      },
      newData: after.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { getTransmedikTariffs, createInvoice, cancelInvoice, cancelAndReplaceInvoice, listApplicationInvoices, searchInvoicesForCashier, submitReceiptAndVerify, inspectTransmedikPayment, decideInvalidRefManually };

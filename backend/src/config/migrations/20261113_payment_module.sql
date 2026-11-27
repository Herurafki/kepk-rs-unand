BEGIN;

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('RESEARCH','ETHICS')),
  issued_by BIGINT REFERENCES users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','CANCELLED')),
  replacement_invoice_id BIGINT REFERENCES invoices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, application_id)
);
CREATE INDEX IF NOT EXISTS idx_invoices_application_id ON invoices(application_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id),
  invoice_id BIGINT NOT NULL UNIQUE,
  ref_number VARCHAR(11) NOT NULL UNIQUE,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  invoice_discount_percent NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK (invoice_discount_percent BETWEEN 0 AND 100),
  invoice_discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (invoice_discount_amount >= 0),
  total NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  nostruk VARCHAR(50),
  nosbm VARCHAR(50),
  status_pembayaran VARCHAR(100),
  is_lunas BOOLEAN,
  dibayar_oleh VARCHAR(255),
  total_dibayar NUMERIC(15,2),
  total_tagihan NUMERIC(15,2),
  sisa_tagihan NUMERIC(15,2),
  tgl_pembayaran TIMESTAMPTZ,
  cara_bayar VARCHAR(100),
  kasir VARCHAR(255),
  keterangan TEXT,
  verification VARCHAR(20) NOT NULL DEFAULT 'unverified'
    CHECK (verification IN ('verified','unverified')),
  status VARCHAR(50) CHECK (status IS NULL OR status IN (
    '01_VALID','01_INVALID_REF','01_INVALID_NOM','01_INVALID_BOTH',
    '02_MISSING_REF_NOM_MATCH','02_MISSING_REF_NOM_MISMATCH',
    '03_HTTP_ERROR','03_TIMEOUT','03_CONNECTION_ERROR'
  )),
  verified_by BIGINT REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_payment_invoice_application
    FOREIGN KEY (invoice_id, application_id) REFERENCES invoices(id, application_id),
  CONSTRAINT chk_payment_verified_consistency CHECK (
    (verification = 'verified' AND status = '01_VALID' AND verified_at IS NOT NULL)
    OR (verification = 'unverified' AND status IS DISTINCT FROM '01_VALID' AND verified_at IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_payments_application_id ON payments(application_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_nostruk_nosbm
  ON payments(nostruk, nosbm) WHERE nostruk IS NOT NULL AND nosbm IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  product_id VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
  discount_percent NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total NUMERIC(15,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_items_invoice_id ON payment_items(invoice_id);

CREATE TABLE IF NOT EXISTS invoice_number_counters (
  year INTEGER PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_ref_counters (
  ref_date DATE PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence BETWEEN 0 AND 999),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

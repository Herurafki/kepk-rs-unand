import apiClient from './api/client'

export interface TransmedikTariff {
  id: string
  name: string
  price: number
}

export interface PaymentItemPayload {
  product_id?: string | null
  product_name: string
  quantity: number
  unit_price: number
  discount_percent: number
}

export interface InvoiceItem extends PaymentItemPayload {
  id: string
  discount_amount: number
  total: number
}

export interface PaymentInvoice {
  id: string
  application_id: string
  invoice_number: string
  invoice_type: 'RESEARCH' | 'ETHICS'
  issued_at: string
  status: 'ISSUED' | 'CANCELLED'
  replacement_invoice_id?: string | null
  ref_number: string
  subtotal: number
  discount_total: number
  invoice_discount_percent: number
  invoice_discount_amount: number
  total: number
  nostruk?: string | null
  nosbm?: string | null
  status_pembayaran?: string | null
  is_lunas?: boolean | null
  dibayar_oleh?: string | null
  total_dibayar?: number | null
  total_tagihan?: number | null
  sisa_tagihan?: number | null
  tgl_pembayaran?: string | null
  cara_bayar?: string | null
  kasir?: string | null
  keterangan?: string | null
  verification: 'verified' | 'unverified'
  payment_status?: string | null
  verified_at?: string | null
  items: InvoiceItem[]
}

interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

export async function getTransmedikTariffs(params: { namaproduk?: string; take?: number } = {}) {
  const response = await apiClient.get<ApiResponse<{ total: number; products: TransmedikTariff[] }>>(
    '/payments/tariffs',
    { params },
  )
  return response.data
}

export async function getApplicationInvoices(applicationId: string) {
  const response = await apiClient.get<ApiResponse<PaymentInvoice[]>>(
    '/payments/applications/' + applicationId + '/invoices',
  )
  return response.data
}

export async function createPaymentInvoice(payload: {
  application_id: string
  invoice_type: 'RESEARCH' | 'ETHICS'
  items: PaymentItemPayload[]
  invoice_discount_percent: number
  replacement_invoice_id?: string
}) {
  const response = await apiClient.post<ApiResponse<PaymentInvoice>>('/payments/invoices', payload)
  return response.data
}

export async function replacePaymentInvoice(invoiceId: string, payload: {
  invoice_discount_percent?: number
  items?: PaymentItemPayload[]
}) {
  const response = await apiClient.post<ApiResponse<{ cancelled_invoice_id: string; replacement_invoice: PaymentInvoice }>>(
    '/payments/invoices/' + invoiceId + '/replace',
    payload,
  )
  return response.data
}

export async function cancelPaymentInvoice(invoiceId: string) {
  const response = await apiClient.post<ApiResponse<PaymentInvoice>>(
    '/payments/invoices/' + invoiceId + '/cancel',
  )
  return response.data
}


export interface TransmedikInspection {
  invoice: {
    invoice_number: string
    payment_status: string
    ref_number: string
    total: number
    nostruk: string
    nosbm: string
  }
  comparison: {
    ref_number: { expected: string; received: string | null; matches: boolean }
    total_tagihan: { expected: number; received: number | null; matches: boolean }
    nostruk: { expected: string; received: string | null; matches: boolean }
    nosbm: { expected: string; received: string | null; matches: boolean }
    is_lunas: unknown
    sisa_tagihan: unknown
  }
  transmedik: Record<string, unknown>
  metadata: Record<string, unknown> | null
}

export async function inspectTransmedikPayment(invoiceId: string) {
  const response = await apiClient.post<ApiResponse<TransmedikInspection>>(
    '/payments/invoices/' + invoiceId + '/inspect-transmedik',
  )
  return response.data
}

export async function verifyPayment(invoiceId: string, payload: { nostruk: string; nosbm: string }) {
  const response = await apiClient.post<ApiResponse<{
    verification: 'verified' | 'unverified'
    status: string
    transmedik: Record<string, unknown>
  }>>('/payments/invoices/' + invoiceId + '/verify-payment', payload)
  return response.data
}


export async function decideInvalidRefPayment(invoiceId: string, payload: { decision: 'APPROVE' | 'REJECT' }) {
  const response = await apiClient.post<ApiResponse<{
    decision: 'APPROVE' | 'REJECT'
    payment: PaymentInvoice
  }>>('/payments/invoices/' + invoiceId + '/invalid-ref-decision', payload)
  return response.data
}

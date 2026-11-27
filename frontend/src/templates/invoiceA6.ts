import type { InvoiceItem, PaymentInvoice } from '../services/payment.service' // sesuaikan path

type ApplicationOption = {
    id: string
    application_number?: string
    application_type?: string
    research_title?: string
    researcher_name?: string
    researcher_phone?: string
    status?: string
    created_at?: string
  }

interface InvoiceTemplateOptions {
  formatMoney: (value: number | string) => string
  fallbackResearcher?: string
}


type ListedInvoice = PaymentInvoice & { application?: ApplicationOption }

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const styles = `
  @page { size: A6 landscape; margin: 6mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font: 8.5pt/1.35 Arial, Helvetica, sans-serif;
    color: #1f2937;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { width: 136mm; }

  .header { text-align: center; padding-bottom: 3mm; border-bottom: 1.5pt solid #111827; }
  .header h1 { margin: 0; font-size: 13pt; letter-spacing: 1.5pt; text-transform: uppercase; }
  .header .inv-no { margin-top: 1mm; font-size: 8pt; color: #4b5563; }

  .info { width: 100%; margin-top: 3mm; border-collapse: collapse; }
  .info td { padding: 0.6mm 0; vertical-align: top; border: none; }
  .info td.label { width: 25mm; color: #6b7280; }
  .info td.sep { width: 3mm; color: #6b7280; }
  .info td.value { font-weight: 600; word-break: break-word; }

  table.items { width: 100%; margin-top: 3.5mm; border-collapse: collapse; table-layout: fixed; font-size: 7.5pt; }
  table.items thead { display: table-header-group; }
  table.items th { background: #111827; color: #fff; padding: 1.6mm 1.2mm; text-align: left; font-weight: 600; }
  table.items td { padding: 1.6mm 1.2mm; border-bottom: 0.5pt solid #d1d5db; vertical-align: top; }
  table.items tbody tr:nth-child(even) td { background: #f9fafb; }
  table.items tr { page-break-inside: avoid; }
  table.items th:nth-child(1) { width: 27%; }
  table.items th:nth-child(2) { width: 7%; text-align: center; }
  table.items th:nth-child(3) { width: 18%; text-align: right; }
  table.items th:nth-child(4) { width: 8%; text-align: center; }
  table.items th:nth-child(5) { width: 17%; text-align: right; }
  table.items th:nth-child(6) { width: 23%; text-align: right; }
  td.prod { word-break: break-word; }
  td.num { text-align: right; white-space: nowrap; }
  td.center { text-align: center; white-space: nowrap; }

  .total-box {
    margin-top: 3mm; padding: 2mm 2.5mm; border: 1.2pt solid #111827;
    display: flex; justify-content: space-between; align-items: center; font-weight: 700;
  }
  .total-box .t-label { font-size: 8.5pt; }
  .total-box .t-value { font-size: 11pt; }

  .footer { margin-top: 4mm; text-align: center; font-size: 7pt; color: #6b7280; }
`

export function buildInvoiceA6Html(
  invoice: ListedInvoice,
  { formatMoney, fallbackResearcher = '-' }: InvoiceTemplateOptions,
): string {
  const rows = invoice.items
    .map(
      (item: InvoiceItem) => `
        <tr>
          <td class="prod">${escapeHtml(item.product_name)}</td>
          <td class="center">${item.quantity}</td>
          <td class="num">${formatMoney(Number(item.unit_price) * Number(item.quantity))}</td>
          <td class="center">${Number(item.discount_percent || 0)}%</td>
          <td class="num">${formatMoney(item.discount_amount || 0)}</td>
          <td class="num">${formatMoney(item.total)}</td>
        </tr>`,
    )
    .join('')

  const itemDiscountTotal = invoice.items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0)
  const invoicesubtotal = Number(invoice.subtotal - itemDiscountTotal)
  const invoiceDiscount = Number(invoice.invoice_discount_amount || 0)
  const app = invoice.application

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(invoice.invoice_number)}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <h1>KEPK Rumah Sakit Unand</h1>
      <div class="inv-no">${escapeHtml(invoice.invoice_number)}</div>
    </div>

    <table class="info">
      <tr><td class="label">Ref Number</td><td class="sep">:</td><td class="value">${escapeHtml(invoice.ref_number)}</td></tr>
      <tr><td class="label">Peneliti</td><td class="sep">:</td><td class="value">${escapeHtml(app?.researcher_name || fallbackResearcher)}</td></tr>
      <tr><td class="label">No Handphone</td><td class="sep">:</td><td class="value">${escapeHtml(app?.researcher_phone || '-')}</td></tr>
    </table>

    <table class="items">
      <thead>
        <tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Disk. %</th><th>Potongan</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="info" style="margin-top:2mm">
      <tr><td class="label">Subtotal</td><td class="sep">:</td><td class="value" style="text-align:right">${formatMoney(invoicesubtotal)}</td></tr>
      <tr><td class="label">Diskon invoice (${Number(invoice.invoice_discount_percent || 0)}%)</td><td class="sep">:</td><td class="value" style="text-align:right">− ${formatMoney(invoiceDiscount)}</td></tr>
    </table>
    <div class="total-box">
      <span class="t-label">Total Tagihan</span>
      <span class="t-value">${formatMoney(invoice.total)}</span>
    </div>

    <div class="footer">Terima kasih. Simpan invoice ini sebagai bukti tagihan.</div>
  </div>
  <script>window.onload=function(){window.print()}<\/script>
</body>
</html>`
}
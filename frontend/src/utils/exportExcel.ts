export interface ExcelExportColumn<T> {
  key: string
  title: string
  width?: number
  value: (row: T) => unknown
}

export interface ExcelExportOptions<T> {
  title: string
  fileName: string
  columns: ExcelExportColumn<T>[]
  rows: readonly T[]
  subtitle?: string
  generatedAt?: Date
}

/** Shared Excel-compatible SpreadsheetML export helper (.xls). */
export function exportExcel<T>(options: ExcelExportOptions<T>): void {
  const { title, fileName, columns, rows, subtitle } = options
  if (!columns.length) throw new Error('Export membutuhkan minimal satu kolom.')

  const escapeXml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

  const cell = (value: unknown, style?: string) =>
    '<Cell' + (style ? ' ss:StyleID="' + style + '"' : '') + '><Data ss:Type="String">' +
    escapeXml(value) + '</Data></Cell>'

  const generatedAt = (options.generatedAt ?? new Date()).toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const mergeAcross = Math.max(0, columns.length - 1)
  const headerRow = 4
  const lastRow = Math.max(headerRow, headerRow + rows.length)
  const filterRange = 'R' + headerRow + 'C1:R' + lastRow + 'C' + columns.length

  const columnXml = columns.map(column =>
    '<Column ss:Width="' + Math.max(70, Math.min(column.width ?? 150, 360)) + '"/>'
  ).join('')
  const headerXml = '<Row ss:AutoFitHeight="1">' +
    columns.map(column => cell(column.title, 'Header')).join('') + '</Row>'
  const dataXml = rows.map((row, index) =>
    '<Row>' + columns.map(column => cell(column.value(row), index % 2 ? 'Alternate' : 'Body')).join('') + '</Row>'
  ).join('')

  const reportSubtitle = subtitle || ('Diekspor ' + generatedAt + ' · ' + rows.length + ' data')
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">' +
    '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>' + escapeXml(title) +
    '</Title><Author>KEPK</Author><Created>' + new Date().toISOString() + '</Created></DocumentProperties>' +
    '<ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel"><ProtectStructure>False</ProtectStructure>' +
    '<ProtectWindows>False</ProtectWindows></ExcelWorkbook><Styles>' +
    '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10"/></Style>' +
    '<Style ss:ID="Title"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos Display" ss:Size="16" ss:Bold="1" ss:Color="#17365D"/><Interior ss:Color="#DCE6F1" ss:Pattern="Solid"/></Style>' +
    '<Style ss:ID="Subtitle"><Font ss:FontName="Aptos" ss:Size="10" ss:Color="#666666"/></Style>' +
    '<Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Aptos" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1F4E78" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#17365D"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/></Borders></Style>' +
    '<Style ss:ID="Body"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/></Borders></Style>' +
    '<Style ss:ID="Alternate"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#F2F6FA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2F3"/></Borders></Style>' +
    '</Styles><Worksheet ss:Name="Data"><Table ss:DefaultColumnWidth="110" ss:DefaultRowHeight="20">' +
    columnXml +
    '<Row ss:Height="30"><Cell ss:MergeAcross="' + mergeAcross + '" ss:StyleID="Title"><Data ss:Type="String">' + escapeXml(title) + '</Data></Cell></Row>' +
    '<Row ss:Height="22"><Cell ss:MergeAcross="' + mergeAcross + '" ss:StyleID="Subtitle"><Data ss:Type="String">' + escapeXml(reportSubtitle) + '</Data></Cell></Row>' +
    '<Row/>' + headerXml + dataXml + '</Table><AutoFilter x:Range="' + filterRange + '" xmlns="urn:schemas-microsoft-com:office:excel"/>' +
    '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>' +
    '</Worksheet></Workbook>'

  const blob = new Blob(['\uFEFF', xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.toLowerCase().endsWith('.xls') ? fileName : fileName + '.xls'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

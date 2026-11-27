'use strict';

const fs = require('fs');
const path = require('path');

const mockPdf = jest.fn();
const mockSetContent = jest.fn();
const mockNewPage = jest.fn();
const mockClose = jest.fn();
const mockLaunch = jest.fn();

jest.mock('puppeteer', () => ({
  launch: (...args) => mockLaunch(...args)
}));

const service = require('../../services/letter-pdf.service');

const application = {
  id: 987654,
  application_number: 'KEPK-TEST-001',
  researcher_name: 'Nama Peneliti Uji',
  researcher_nim: '23123456',
  researcher_institution: 'Politeknik Contoh',
  researcher_faculty: 'Fakultas Informatika',
  research_title: 'Pengujian Template Surat KEPK'
};

const letter = {
  letter_type: 'DATA_AWAL',
  letter_number: 'TEST/KEPK/001',
  created_at: '2026-10-29T00:00:00.000Z'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPdf.mockResolvedValue(undefined);
  mockSetContent.mockResolvedValue(undefined);
  mockClose.mockResolvedValue(undefined);
  mockNewPage.mockResolvedValue({
    setContent: mockSetContent,
    pdf: mockPdf
  });
  mockLaunch.mockResolvedValue({
    newPage: mockNewPage,
    close: mockClose
  });
});

afterAll(() => {
  const outputDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'letters', String(application.id));
  // Unit tests do not need generated PDF artifacts to persist.
  if (fs.existsSync(outputDir)) {
    for (const file of fs.readdirSync(outputDir)) {
      if (file.startsWith('generated-TEST_KEPK_001')) {
        try { fs.unlinkSync(path.join(outputDir, file)); } catch (_) {}
      }
    }
  }
});

describe('letter-pdf.service (EJS + Puppeteer)', () => {
  test('renders DATA_AWAL HTML with application data and requests an A4 PDF', async () => {
    const filePath = await service.generate({ application, letter });

    expect(filePath).toContain(path.join('letters', String(application.id)));
    expect(filePath).toContain('generated-TEST_KEPK_001.pdf');
    expect(mockLaunch).toHaveBeenCalledWith({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    expect(mockSetContent).toHaveBeenCalledTimes(1);
    const html = mockSetContent.mock.calls[0][0];
    expect(html).toContain('Surat Pengambilan Data Awal');
    expect(html).toContain('Nama Peneliti Uji');
    expect(html).toContain('23123456');
    expect(html).toContain('Politeknik Contoh');
    expect(html).toContain('Pengujian Template Surat KEPK');
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({
      path: filePath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    }));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('escapes user-supplied HTML in template values', async () => {
    await service.generate({
      application: { ...application, researcher_name: '<script>alert("x")</script>' },
      letter
    });

    const html = mockSetContent.mock.calls[0][0];
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test.each([
    ['IZIN_PENELITIAN', 'Surat Izin Penelitian'],
    ['IZIN_ETIK', 'Persetujuan Etik Penelitian'],
    ['BEBAS_KAJI_ETIK', 'Keterangan Bebas Kaji Etik']
  ])('selects the correct template for %s', async (letterType, expectedTitle) => {
    await service.generate({
      application,
      letter: { ...letter, letter_type: letterType, letter_number: 'TEST-' + letterType }
    });

    expect(mockSetContent).toHaveBeenCalledTimes(1);
    expect(mockSetContent.mock.calls[0][0]).toContain(expectedTitle);
    expect(mockPdf).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('closes Chromium and rethrows if PDF rendering fails', async () => {
    const renderError = new Error('PDF rendering failed');
    mockPdf.mockRejectedValue(renderError);

    await expect(service.generate({
      application,
      letter: { ...letter, letter_number: 'TEST-ERROR' }
    })).rejects.toThrow('PDF rendering failed');

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('rejects an unsupported letter type', async () => {
    await expect(service.generate({
      application,
      letter: { ...letter, letter_type: 'UNKNOWN' }
    })).rejects.toThrow('Unsupported letter template type: UNKNOWN');
    expect(mockLaunch).not.toHaveBeenCalled();
  });
});

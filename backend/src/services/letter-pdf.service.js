'use strict';

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'letters');
const ASSET_DIR = path.join(TEMPLATE_DIR, 'assets');
// Place the official header image at src/templates/letters/assets/kop-surat.png.
// Place the accreditation mark at src/templates/letters/assets/logo-akreditasi.png.

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
  }).format(safe);
};

const selectTemplate = (type) => {
  const templates = {
    DATA_AWAL: 'data-awal.ejs',
    IZIN_PENELITIAN: 'izin-penelitian.ejs',
    IZIN_ETIK: 'izin-etik.ejs',
    BEBAS_KAJI_ETIK: 'bebas-kaji-etik.ejs'
  };
  const file = templates[type];
  if (!file) throw new Error('Unsupported letter template type: ' + type);
  return path.join(TEMPLATE_DIR, file);
};

const generate = async ({ application, letter }) => {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const dir = path.join(uploadDir, 'letters', String(application.id));
  fs.mkdirSync(dir, { recursive: true });
  const safeLetterNumber = String(letter.letter_number || 'letter').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(dir, 'generated-' + safeLetterNumber + '.pdf');
  const templatePath = selectTemplate(letter.letter_type);
  const cssPath = path.join(TEMPLATE_DIR, 'styles.css');
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

  const data = {
    letterType: letter.letter_type,
    letterNumber: letter.letter_number || '-',
    date: formatDate(letter.created_at),
    applicationNumber: letter.registration_number || application.application_number || '-',
    researcherName: application.researcher_name || application.person_responsible || '-',
    researcherId: application.researcher_nim || application.researcher_nip || application.researcher_nik || '-',
    institution: application.researcher_institution || application.research_institution || '-',
    faculty: application.researcher_faculty || application.researcher_department || '-',
    researchTitle: application.research_title || '-',
    correspondence: application.correspondence || {},
    formatDate,
    hasKop: fs.existsSync(path.join(ASSET_DIR, 'kop-surat.png')),
    kopDataUri: fs.existsSync(path.join(ASSET_DIR, 'kop-surat.png')) ? 'data:image/png;base64,' + fs.readFileSync(path.join(ASSET_DIR, 'kop-surat.png')).toString('base64') : '',
    hasAccreditation: fs.existsSync(path.join(ASSET_DIR, 'logo-akreditasi.png')),
    accreditationDataUri: fs.existsSync(path.join(ASSET_DIR, 'logo-akreditasi.png')) ? 'data:image/png;base64,' + fs.readFileSync(path.join(ASSET_DIR, 'logo-akreditasi.png')).toString('base64') : '',
    css
  };

  const html = await ejs.renderFile(templatePath, data, { async: true });
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw error;
  } finally {
    await browser.close();
  }
  return filePath;
};

module.exports = { generate };

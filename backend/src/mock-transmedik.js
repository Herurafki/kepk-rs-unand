require("dotenv").config();
const http = require('http');

const PORT = 5001;

const server = http.createServer((req, res) => {
  if (
    req.method !== 'POST' ||
    req.url !== '/service/medifirst2000/bridging/kepk/cek-status-pembayaran'
  ) {
    res.writeHead(404);
    return res.end(JSON.stringify({ message: 'Endpoint not found' }));
  }

  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    const { nostruk, nosbm, } = JSON.parse(body || '{}');

    if (!nostruk || !nosbm) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        metadata: { code: 400, message: 'Nomor struk dan SBM wajib diisi' }
      }));
    }

    const result = {
      metadata: {
        code: 200,
        message: 'OK'
      },
      response: {
        status_pembayaran: 'LUNAS',
        is_lunas: true,
        nostruk: process.env.MOCK_NOSTRUK ,
        nosbm: process.env.MOCK_NOSBM ,
        ref_number: process.env.MOCK_REF_NUMBER ,
        dibayar_oleh: 'Heru Ganteng Bgt',
        total_dibayar: Number(process.env.MOCK_TOTAL ),
        total_tagihan: Number(process.env.MOCK_TOTAL ),
        sisa_tagihan: 0,
        tgl_pembayaran: '2026-11-14 10:00:00',
        cara_bayar: 'TUNAI',
        kasir: 'Kasir Cantik',
        keterangan: 'Pembayaran simulasi berhasil'
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    console.log('[MOCK REQUEST]', {
        method: req.method,
        url: req.url,
        body: body
      });
  });
});

server.listen(PORT, () => {
  console.log(`Mock Transmedik berjalan di http://localhost:${PORT}`);
});

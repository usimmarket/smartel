// netlify/functions/generate_top.js
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

function asset(p) {
  return path.join(__dirname, 'assets', p);
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: ''
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const templatePdfBytes = fs.readFileSync(asset('template.pdf'));
    const fontBytes = fs.readFileSync(asset('font.ttf'));

    const pdfDoc = await PDFDocument.load(templatePdfBytes);
    const font = await pdfDoc.embedFont(fontBytes);
    const pages = pdfDoc.getPages();
    const first = pages[0];

    const draw = (text, x, y, size=11) => {
      if (!text) return;
      first.drawText(String(text), { x, y, size, font, color: rgb(0,0,0) });
    };

    // --- Very basic sample mapping (replace with your JSON later) ---
    // Coordinates assume a typical A4 portrait starting from bottom-left.
    draw(payload.subscriber || '', 110, 700, 12);      // 가입자명
    draw(payload.birth || '', 110, 680, 11);           // 생년월일
    draw(payload.addr || '', 110, 660, 11);            // 주소
    draw(payload.subscriber_phone || payload.phone || '', 110, 640, 11); // 연락처
    draw(payload.plan || '', 110, 620, 11);            // 요금제명
    draw(payload.sim2 || payload.usim_serial || '', 110, 600, 11); // USIM 일련번호
    // --------------------------------------------------------------

    const out = await pdfDoc.save();
    const base64 = Buffer.from(out).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      },
      isBase64Encoded: true,
      body: base64
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
      body: 'Error: ' + (err && err.message || String(err))
    };
  }
};

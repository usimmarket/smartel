
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
let fontkit;
try { fontkit = require('@pdf-lib/fontkit'); } catch(_) {}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  let data = {};
  try { data = JSON.parse(event.body || '{}'); } catch(_){}

  try {
    const pdfDoc = await PDFDocument.load(fs.readFileSync(path.join(__dirname, 'assets', 'template.pdf')));
    let font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    if (fontkit) {
      try {
        pdfDoc.registerFontkit(fontkit);
        const fontBytes = fs.readFileSync(path.join(__dirname, 'assets', 'NotoSansKR.ttf'));
        font = await pdfDoc.embedFont(fontBytes);
      } catch(_){}
    }
    const page = pdfDoc.getPages()[0];
    const subscriber = (data.subscriber || data.subscriber_name || data.applicant || 'SMARTEL');
    page.drawText(subscriber, { x: 72, y: 720, size: 12, color: rgb(0,0,0), font });
    const out = await pdfDoc.save();
    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/pdf', 'Content-Disposition':'attachment; filename="application.pdf"' },
      body: Buffer.from(out).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: 'PDF ERROR: ' + (e && e.message ? e.message : String(e)) };
  }
};

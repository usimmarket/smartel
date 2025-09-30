const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
let fontkit;
try { fontkit = require('@pdf-lib/fontkit'); } catch (_) {}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data = {};
  try { data = JSON.parse(event.body || '{}'); } catch (_) {}

  try {
    const templatePath = path.join(__dirname, 'assets', 'template.pdf');
    const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));

    // 기본 폰트로 시작(영문 대비)
    let font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // 한글 폰트가 있으면 등록 + "부분 임베드"로 용량 최소화
    if (fontkit) {
      pdfDoc.registerFontkit(fontkit);
      try {
        const fontBytes = fs.readFileSync(path.join(__dirname, 'assets', 'NotoSansKR.ttf'));
        font = await pdfDoc.embedFont(fontBytes, { subset: true }); // ★ 핵심: 서브셋 임베드
      } catch (e) {
        // 실패 시 헬베티카 유지(영문만)
        console.warn('[generate_pdf] custom font embed failed:', e && e.message);
      }
    }

    const page = pdfDoc.getPages()[0];
    const subscriber = (data.subscriber || data.subscriber_name || data.applicant || 'SMARTEL');

    page.drawText(subscriber, { x: 72, y: 720, size: 12, color: rgb(0, 0, 0), font });

    // 기본 저장(용량이 가장 작음)
    const out = await pdfDoc.save();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="application.pdf"'
      },
      body: Buffer.from(out).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: 'PDF ERROR: ' + (e && e.message ? e.message : String(e)) };
  }
};

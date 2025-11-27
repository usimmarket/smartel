const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
let fontkit;
try { fontkit = require('@pdf-lib/fontkit'); } catch (_) {}

// ★ 좌표 매핑 JSON 불러오기
const MAP = require('./assets/smartel_transport_map.json');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data = {};
  try {
    data = JSON.parse(event.body || '{}');
  } catch (_) {
    data = {};
  }

  try {
    const templatePath = path.join(__dirname, 'assets', 'template.pdf');
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // 폰트 설정
    let font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    if (fontkit) {
      pdfDoc.registerFontkit(fontkit);
      try {
        const fontBytes = fs.readFileSync(
          path.join(__dirname, 'assets', 'NotoSansKR.ttf')
        );
        font = await pdfDoc.embedFont(fontBytes, { subset: true });
      } catch (e) {
        console.warn('[generate_pdf] custom font embed failed:', e && e.message);
      }
    }

    const pages = pdfDoc.getPages();
    const black = rgb(0, 0, 0);

    // 1) 일반 텍스트 필드 출력
    const fields = MAP.fields || {};
    Object.keys(fields).forEach((key) => {
      const cfg = fields[key];
      if (!cfg) return;
      const pageIndex = (cfg.page || 1) - 1;
      const page = pages[pageIndex];
      if (!page) return;

      const src = cfg.source || [];
      let value = '';

      if (Array.isArray(src) && src.length > 0) {
        value = src
          .map((name) => {
            const k = (name || '').trim();
            return data[k] == null ? '' : String(data[k]);
          })
          .join(' ');
      } else if (typeof src === 'string') {
        const k = src.trim();
        value = data[k] == null ? '' : String(data[k]);
      }

      if (!value) return;

      page.drawText(value, {
        x: cfg.x,
        y: cfg.y,
        size: cfg.size || 10,
        font,
        color: black,
      });
    });

    // 2) 라디오/체크박스 (vmap) 출력
    //  - 예: vmap.gender_cb.domestic / vmap.gender_cb.foreigner
    const vmap = MAP.vmap || {};
    Object.keys(vmap).forEach((fieldName) => {
      const groupCfg = vmap[fieldName];
      if (!groupCfg) return;

      const value = data[fieldName]; // index.html 의 name="gender_cb" 등과 동일해야 함
      if (!value) return;

      const optCfg = groupCfg[value];
      if (!optCfg) return;

      const pageIndex = (optCfg.page || 1) - 1;
      const page = pages[pageIndex];
      if (!page) return;

      const size = optCfg.size || 11;

      // ■ 또는 ✓ 등 체크 모양
      page.drawText('■', {
        x: optCfg.x,
        y: optCfg.y,
        size,
        font,
        color: black,
      });
    });

    // 3) 항상 체크되는 고정 플래그 (fixed_flags)
    //  - 예: intl_roaming_block 등
    const fixedFlags = MAP.fixed_flags || {};
    Object.keys(fixedFlags).forEach((flagName) => {
      const boxes = fixedFlags[flagName];
      if (!Array.isArray(boxes)) return;

      boxes.forEach((box) => {
        const pageIndex = (box.page || 1) - 1;
        const page = pages[pageIndex];
        if (!page) return;

        const size = box.size || 11;

        page.drawText('■', {
          x: box.x,
          y: box.y,
          size,
          font,
          color: black,
        });
      });
    });

    // PDF 저장
    const out = await pdfDoc.save();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="smartel-application.pdf"',
      },
      body: Buffer.from(out).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: 'PDF ERROR: ' + (e && e.message ? e.message : String(e)),
    };
  }
};

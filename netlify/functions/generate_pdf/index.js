const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

let fontkit;
try {
  fontkit = require('@pdf-lib/fontkit');
} catch (_) {
  fontkit = null;
}

// ---- 1) 좌표 매핑 JSON 로드 ---------------------------------------------
let MAP = { fields: {}, vmap: {}, fixed_flags: {} };

try {
  const mapPath = path.join(__dirname, 'assets', 'smartel_transport_map.json');
  if (fs.existsSync(mapPath)) {
    const raw = fs.readFileSync(mapPath, 'utf8');
    MAP = JSON.parse(raw);
  } else {
    console.warn('[generate_pdf] smartel_transport_map.json not found in assets/');
  }
} catch (e) {
  console.warn('[generate_pdf] failed to load smartel_transport_map.json:', e && e.message);
}

// -------------------------------------------------------------------------
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ---- 2) 요청 데이터 파싱 (JSON + form-urlencoded 둘 다 지원) ----------
  let data = {};
  const bodyRaw = event.body || '';

  // 2-1) 먼저 JSON 시도
  if (bodyRaw) {
    try {
      data = JSON.parse(bodyRaw);
    } catch (e) {
      data = {};
    }
  }

  // 2-2) JSON 파싱 실패 / 비어있을 경우, form-urlencoded 파싱 시도
  if ((!data || Object.keys(data).length === 0) && bodyRaw) {
    try {
      const params = new URLSearchParams(bodyRaw);
      const obj = {};
      params.forEach((value, key) => {
        obj[key] = value;
      });
      data = obj;
    } catch (e) {
      console.warn('[generate_pdf] failed to parse body as form-urlencoded:', e && e.message);
    }
  }

  try {
    const templatePath = path.join(__dirname, 'assets', 'template.pdf');
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // 기본 폰트: 헬베티카
    let font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // NotoSansKR 폰트가 있으면 등록 (한글용)
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

    // ---- 3) 일반 텍스트 필드 출력 (fields) --------------------------------
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

    // ---- 4) 체크박스/라디오(vmap) 출력 -----------------------------------
    //  - optKey 형식 예: "join_type:new", "gender_cb:domestic"
    const vmap = MAP.vmap || {};
    Object.keys(vmap).forEach((optKey) => {
      const cfg = vmap[optKey];
      if (!cfg) return;

      const parts = String(optKey).split(':');
      const fieldName = (parts[0] || '').trim();
      const matchValue = (parts[1] || '').trim();

      if (!fieldName) return;

      const current = data[fieldName];

      // optKey에 값이 들어있으면 (join_type:new) → 그 값과 일치할 때만 체크
      if (matchValue) {
        if (current !== matchValue) return;
      } else {
        // 값이 없으면, 해당 필드가 비어있지 않을 때만 찍어준다.
        if (current == null || current === '') return;
      }

      const pageIndex = (cfg.page || 1) - 1;
      const page = pages[pageIndex];
      if (!page) return;

      const size = cfg.size || 11;

      page.drawText('■', {
        x: cfg.x,
        y: cfg.y,
        size,
        font,
        color: black,
      });
    });

    // ---- 5) 고정 라벨(fixed_flags) 출력 -----------------------------------
    const fixedFlags = MAP.fixed_flags || {};
    Object.keys(fixedFlags).forEach((flagName) => {
      const boxes = fixedFlags[flagName];
      if (!Array.isArray(boxes)) return;

      boxes.forEach((box) => {
        const pageIndex = (box.page || 1) - 1;
        const page = pages[pageIndex];
        if (!page) return;

        const size = box.size || 10;
        page.drawText('■', {
          x: box.x,
          y: box.y,
          size,
          font,
          color: black,
        });
      });
    });

    // ---- 6) 디버그: data가 비어 있으면 표시 ------------------------------
    if (!data || Object.keys(data).length === 0) {
      const page0 = pages[0];
      page0.drawText('DEBUG: NO DATA', {
        x: 20,
        y: 810,
        size: 10,
        font,
        color: rgb(1, 0, 0),
      });
    }

    // ---- 7) PDF 저장 & 반환 -----------------------------------------------
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
    console.error('[generate_pdf] ERROR:', e);
    return {
      statusCode: 500,
      body: 'PDF ERROR: ' + (e && e.message ? e.message : String(e)),
    };
  }
};

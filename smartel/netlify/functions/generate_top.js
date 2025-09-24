// smartel/netlify/functions/generate_top.js
// Netlify Functions (Node 18, CJS)
// 템플릿(pdf/template_smartel.pdf) + 좌표맵(pdf/map_smartel.json) 로
// index.html에서 보낸 값들을 PDF에 그려 반환합니다.

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

// HEX → pdf-lib rgb 변환
function hexToRgb(hex = "#000000") {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // index.html에서 JSON.stringify(formValues)로 보낸 데이터
    const form = JSON.parse(event.body || "{}");

    // 함수 파일 기준으로 pdf 폴더 접근
    const templatePath = path.join(__dirname, "../../pdf/template_smartel.pdf");
    const mapPath = path.join(__dirname, "../../pdf/map_smartel.json");

    // 파일 존재 검사
    if (!fs.existsSync(templatePath)) {
      return { statusCode: 500, body: "TEMPLATE_NOT_FOUND" };
    }
    if (!fs.existsSync(mapPath)) {
      return { statusCode: 500, body: "MAP_NOT_FOUND" };
    }

    const templateBytes = fs.readFileSync(templatePath);
    const mapRaw = fs.readFileSync(mapPath, "utf8");
    let mapping = JSON.parse(mapRaw);

    // 매핑 포맷을 유연하게 지원: 배열 or 객체
    // 배열 예: [{key:"subscriber_name", page:0, x:100, y:500, size:10, color:"#000"}]
    // 객체 예: {"subscriber_name": {"page":0,"x":100,"y":500,"size":10,"color":"#000"}}
    if (!Array.isArray(mapping)) {
      mapping = Object.entries(mapping).map(([key, cfg]) => ({ key, ...cfg }));
    }

    // PDF 로드
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    // 각 필드 그리기
    for (const field of mapping) {
      const key = field.key;
      if (!key) continue;
      const val = form[key];
      if (val == null || String(val) === "") continue;

      const pageIndex = field.page || 0;
      if (!pages[pageIndex]) continue;

      pages[pageIndex].drawText(String(val), {
        x: field.x,
        y: field.y,
        size: field.size || 11,
        font,
        color: hexToRgb(field.color || "#000000"),
      });
    }

    const pdfBytes = await pdfDoc.save();

    // Netlify 런타임에서 PDF 바이너리 반환 형식
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.from(pdfBytes).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "PDF_GENERATE_ERROR" };
  }
};

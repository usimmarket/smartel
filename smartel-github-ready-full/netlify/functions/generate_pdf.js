// Netlify Function: generate_pdf
// Creates a PDF from template + mapping + fields
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

// Helper to load asset that was bundled with the function
function readAsset(rel){
  const p = path.join(__dirname, 'assets', rel);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

exports.handler = async (event) => {
  try{
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const payload = JSON.parse(event.body || '{}');
    const fields = payload.fields || {};
    const mapping = payload.mapping || { pages: [] };

    // Load template
    let tplBytes = readAsset('template.pdf');
    if(!tplBytes){
      return { statusCode: 500, body: 'Template not found' };
    }
    const pdfDoc = await PDFDocument.load(tplBytes);
    pdfDoc.registerFontkit(fontkit);

    // Try to embed NotoSansKR.ttf; if missing, fallback to StandardFonts.Helvetica
    let noto = readAsset('NotoSansKR.ttf');
    let font;
    try {
      font = noto ? await pdfDoc.embedFont(noto, { subset: true }) : await pdfDoc.embedFont(StandardFonts.Helvetica);
    } catch (e) {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Draw fields according to mapping
    const pages = pdfDoc.getPages();
    (mapping.pages || []).forEach((pg, i)=>{
      const page = pages[i] || pages[0];
      (pg.fields||[]).forEach(item=>{
        const txt = (fields[item.name] ?? '').toString();
        if(!txt) return;
        page.drawText(txt, {
          x: Number(item.x||0),
          y: Number(item.y||0),
          size: Number(item.size||12),
          font,
          color: rgb(0,0,0)
        });
      });
    });

    const out = await pdfDoc.save();
    const base64 = Buffer.from(out).toString('base64');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="smartel_form.pdf"'
      },
      isBase64Encoded: true,
      body: base64
    };
  }catch(err){
    return { statusCode: 500, body: String(err && err.stack || err) };
  }
};

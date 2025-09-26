
(function () {
  const log = (...args) => (console && console.log && console.log("[PDF]", ...args));

  function findButton({ id, texts }) {
    let el = document.getElementById(id);
    if (el) return el;
    const all = Array.from(document.querySelectorAll("button, a, [role='button']"));
    const regexes = texts.map(t => new RegExp("^" + t.replace(/\s+/g, "\\s*") + "$", "i"));
    for (const b of all) {
      const txt = (b.textContent || "").trim();
      if (regexes.some(r => r.test(txt))) return b;
    }
    return null;
  }

  function getValueBySelector(selector) {
    if (!selector) return "";
    let el = document.querySelector(selector);
    if (!el) return "";
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
      return (el.value || "").toString().trim();
    }
    return (el.textContent || "").toString().trim();
  }

  async function loadJSON(url) {
    const resp = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
    if (!resp.ok) throw new Error("mapping.json fetch failed " + resp.status);
    return await resp.json();
  }
  async function fetchArrayBuffer(url) {
    const resp = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
    if (!resp.ok) throw new Error("fetch failed " + url + " " + resp.status);
    return await resp.arrayBuffer();
  }

  async function buildPDFBlob() {
    const { PDFDocument, rgb } = window.PDFLib || {};
    if (!PDFDocument) throw new Error("pdf-lib not loaded");

    const mapping = await loadJSON("./mapping.json");
    const pdfBytes = await fetchArrayBuffer("./template.pdf");
    const fontPath = (mapping.font && mapping.font.path) || "fonts/NotoSansKR.ttf";
    const fontBytes = await fetchArrayBuffer("./" + fontPath);

    const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
    const customFont = await pdfDoc.embedFont(fontBytes);

    const fields = Array.isArray(mapping.fields) ? mapping.fields : [];
    for (const f of fields) {
      try {
        const page = pdfDoc.getPage(f.page || 0);
        const value = getValueBySelector(f.selector);
        const size = f.size || (mapping.font && mapping.font.size) || 10;
        if (value) {
          page.drawText(value, {
            x: f.x, y: f.y, size, font: customFont, color: rgb(0, 0, 0)
          });
        }
      } catch (e) {
        console.warn("Field draw error", f, e);
      }
    }

    const bytes = await pdfDoc.save();
    return new Blob([bytes], { type: "application/pdf" });
  }

  async function onSave(ev) {
    ev && ev.preventDefault && ev.preventDefault();
    try {
      const blob = await buildPDFBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "smartel_form.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert("PDF 저장 중 오류가 발생했습니다.");
      console.error(e);
    }
  }
  async function onPrint(ev) {
    ev && ev.preventDefault && ev.preventDefault();
    try {
      const blob = await buildPDFBlob();
      const url = URL.createObjectURL(blob);
      const w = window.open("", "_blank", "noopener");
      if (!w) throw new Error("팝업이 차단되었습니다.");
      w.document.write("<!doctype html><title>SMARTEL 신청서</title>");
      const iframe = w.document.createElement("iframe");
      iframe.style.cssText = "border:0;width:100vw;height:100vh";
      iframe.src = url;
      w.document.body.appendChild(iframe);
      iframe.addEventListener("load", () => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
        catch (_) { w.focus(); w.print(); }
      });
      w.addEventListener("afterprint", () => setTimeout(() => w.close(), 400));
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert("PDF 인쇄 중 오류가 발생했습니다.");
      console.error(e);
    }
  }

  function ready() {
    const save = findButton({ id: "saveBtn", texts: ["PDF 저장", "Save PDF"] });
    const print = findButton({ id: "printBtn", texts: ["인쇄", "Print"] });
    if (save) save.addEventListener("click", onSave, { passive: false });
    if (print) print.addEventListener("click", onPrint, { passive: false });
    log("handlers bound", !!save, !!print);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else { ready(); }
})();

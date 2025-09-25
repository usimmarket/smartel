/**
 * smartel-pdf-binder.js
 * Binds Save/Print buttons and calls Netlify Function to render PDF.
 */
(function() {
  const FN_URL = '/.netlify/functions/generate_top';

  function findForm() {
    return document.getElementById('form') || document.querySelector('form');
  }

  function collectFormJSON() {
    const form = findForm();
    if (!form) return {};
    return Object.fromEntries(new FormData(form).entries());
  }

  async function generatePDFBlob() {
    const payload = collectFormJSON();
    const resp = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text().catch(()=>'');
      throw new Error('PDF function error: ' + resp.status + ' ' + t);
    }
    return await resp.blob();
  }

  function validateIfExists() {
    try { return (typeof window.validate === 'function') ? !!window.validate() : true; }
    catch(e) { return true; }
  }

  async function onSave(e) {
    e.preventDefault();
    if (!validateIfExists()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const blob = await generatePDFBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartel_form.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60_000);
  }

  async function onPrint(e) {
    e.preventDefault();
    if (!validateIfExists()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const blob = await generatePDFBlob();
    const url = URL.createObjectURL(blob);
    const w = window.open('about:blank','_blank','noopener,noreferrer');
    const doc = w.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>SMARTEL 신청서</title></head><body style="margin:0;background:#111"></body></html>');
    doc.close();
    const iframe = doc.createElement('iframe');
    iframe.style.cssText = 'border:0;width:100vw;height:100vh';
    iframe.src = url;
    doc.body.appendChild(iframe);
    iframe.addEventListener('load', () => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      catch(e) { w.focus(); w.print(); }
    });
    w.addEventListener('afterprint', () => setTimeout(()=>w.close(), 400));
    setTimeout(()=>URL.revokeObjectURL(url), 60_000);
  }

  function btnByIdOrText(id, textRegex) {
    const el = document.getElementById(id);
    if (el) return el;
    const nodes = Array.from(document.querySelectorAll('button,a,[role="button"]'));
    return nodes.find(n => textRegex.test((n.textContent||'').trim()));
  }

  function bindOnce(el, handler) {
    if (!el || el.__pdfBound) return;
    el.addEventListener('click', handler, { passive:false });
    el.__pdfBound = true;
  }

  function init() {
    // Save button (KR/EN text fallback)
    bindOnce(btnByIdOrText('saveBtn', /^(PDF\s*저장|Save\s*PDF)$/i), onSave);
    // Print button (KR/EN text fallback)
    bindOnce(btnByIdOrText('printBtn', /^(인쇄|Print)$/i), onPrint);
    console.log('[SMARTEL] binder ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function(){
  'use strict';
  if (window.__SMARTEL_BIND_FIX_V2__) return; window.__SMARTEL_BIND_FIX_V2__ = true;
  const LOG = s => console.log('[bind-fix v2]', s);

  // ---------- Helpers ----------
  function detectFnUrl(){
    try{
      if (typeof window.fnUrl==='function'){ return window.fnUrl(); }
      const REL = '/.netlify/functions/generate_pdf';
      if (location.origin && /smartel\.netlify\.app/.test(location.origin)) return REL;
      return 'https://smartel.netlify.app' + REL;
    }catch(_){ return '/.netlify/functions/generate_pdf'; }
  }

  function collectPayload(){
    const f = document.getElementById('form');
    let data = {};
    if (f){ try{ data = Object.fromEntries(new FormData(f).entries()); }catch(_){ } }
    const birthIn = document.getElementById('birth_in');
    if (birthIn) data.birth = (birthIn.value||'').replace(/\D/g,'');
    const yy = document.getElementById('cardYY') || document.getElementById('card_exp_year');
    const mm = document.getElementById('cardMM') || document.getElementById('card_exp_month');
    if (yy && mm) data.autopay_exp = ((yy.value||'').trim()+'/'+(mm.value||'').trim());
    return data;
  }

  async function buildPdfBlob(){
    // Prefer page-provided function if available
    if (typeof window.generatePDFBlob==='function'){
      try{
        const any = await window.generatePDFBlob();
        if (any instanceof Blob) return any;
        if (any && typeof any.arrayBuffer==='function') return new Blob([await any.arrayBuffer()], {type:'application/pdf'});
      }catch(e){ console.warn('[bind-fix v2] page generatePDFBlob failed', e); }
    }
    // Fallback direct POST
    const url = detectFnUrl();
    const payload = collectPayload();
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!res.ok){
      const t = await res.text().catch(()=>'');
      throw new Error('PDF server error '+res.status+': '+t);
    }
    const blob = await res.blob();
    if (!(blob instanceof Blob) || !blob.size) throw new Error('Empty PDF blob');
    return blob;
  }

  // ---------- SAVE ----------
  let saving = false;
  async function handleSave(ev){
    try{
      ev && ev.preventDefault();
      if (saving) return;
      saving = true;
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'smartel_form.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 60_000);
    }catch(e){
      console.error('[bind-fix v2] save error', e);
      alert('PDF 저장 중 오류: '+e.message);
    }finally{ saving = false; }
  }

  // ---------- PRINT ----------
  let popupRef = null;
  function getPopup(){
    try{ if (popupRef && !popupRef.closed) return popupRef; }catch(_){}
    popupRef = window.open('', 'smartel-print', 'noopener,width=1024,height=768');
    return popupRef;
  }
  function writePopupShell(w){
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>Print</title>' +
                 '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style>' +
                 '</head><body>' +
                 '<iframe id="pv" type="application/pdf" allow="fullscreen"></iframe>' +
                 '<script>' +
                 '  const f = document.getElementById("pv");' +
                 '  f.addEventListener("load", function(){' +
                 '    try { (f.contentWindow||window).focus(); (f.contentWindow||window).print(); }' +
                 '    catch(e){ try{ window.focus(); window.print(); }catch(_e){} }' +
                 '  });' +
                 '  window.addEventListener("afterprint", function(){ setTimeout(function(){ window.close(); }, 400); });' +
                 '<\/script>' +
                 '</body></html>';
    try{ w.document.open(); w.document.write(html); w.document.close(); }catch(e){ console.error('[bind-fix v2] popup shell fail', e); }
  }

  let printing = false;
  async function handlePrint(ev){
    try{
      ev && ev.preventDefault();
      if (printing) return;
      printing = true;
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const w = getPopup();
      if (!w){
        // fallback: download instead of doing nothing
        const a = document.createElement('a');
        a.href = url; a.download = 'smartel_form.pdf';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 60_000);
        return;
      }
      try{ if (!w.document || !w.document.getElementById('pv')) writePopupShell(w); }catch(_){ writePopupShell(w); }
      try{ w.document.getElementById('pv').src = url; }catch(_){ try{ w.location.href = url; }catch(__){} }
      setTimeout(()=>URL.revokeObjectURL(url), 60_000);
    }catch(e){
      console.error('[bind-fix v2] print error', e);
      alert('PDF 인쇄 중 오류: '+e.message);
    }finally{ setTimeout(()=>{ printing = false; }, 1200); }
  }

  // ---------- Global fallbacks for inline onclick="onSavePDF()" / "onPrintPDF()" ----------
  window.onSavePDF = handleSave;
  window.onPrintPDF = handlePrint;

  // ---------- Rebind buttons without touching design ----------
  function removeInlineAndBind(el, fn){
    if (!el) return;
    try{ el.onclick = null; el.removeAttribute('onclick'); }catch(_){}
    el.addEventListener('click', fn, false);
  }

  function start(){
    LOG('handlers attaching');
    // catch common ids
    removeInlineAndBind(document.getElementById('saveBtn'), handleSave);
    removeInlineAndBind(document.getElementById('printBtn'), handlePrint);

    // catch any element that calls inline handlers
    document.querySelectorAll('[onclick*="onSavePDF"]').forEach(el=> removeInlineAndBind(el, handleSave));
    document.querySelectorAll('[onclick*="onPrintPDF"]').forEach(el=> removeInlineAndBind(el, handlePrint));

    // extra: buttons with names or roles
    document.querySelectorAll('[data-role="save"], .btn-save').forEach(el=> removeInlineAndBind(el, handleSave));
    document.querySelectorAll('[data-role="print"], .btn-print').forEach(el=> removeInlineAndBind(el, handlePrint));

    LOG('handlers attached');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, {once:true});
  }else{
    start();
  }
})();
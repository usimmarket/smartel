/*! smartel-print-dropin v1.0 */
(function(){
  'use strict';
  if (window.__SMARTEL_PRINT_DROPIN__) return; window.__SMARTEL_PRINT_DROPIN__ = true;
  const LOG = (...a)=>console.log('[smartel-print]', ...a);

  // ---- Config (adjust only if your Netlify domain or function path changes) ----
  const ABS_ENDPOINT = 'https://smartel.netlify.app/.netlify/functions/generate_pdf';

  // ---- Helpers ----
  function collectPayload(){
    const f = document.getElementById('form');
    let data = {};
    if (f){ try{ data = Object.fromEntries(new FormData(f).entries()); }catch(_){}
    }
    const birthIn = document.getElementById('birth_in');
    if (birthIn) data.birth = (birthIn.value||'').replace(/\D/g,'');
    const yy = document.getElementById('cardYY') || document.getElementById('card_exp_year');
    const mm = document.getElementById('cardMM') || document.getElementById('card_exp_month');
    if (yy && mm) data.autopay_exp = ((yy.value||'').trim()+'/'+(mm.value||'').trim());
    return data;
  }

  async function requestPdfBlob(){
    const payload = collectPayload();
    const res = await fetch(ABS_ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok){
      const t = await res.text().catch(()=>'');
      throw new Error('HTTP '+res.status+' '+t);
    }
    const blob = await res.blob();
    if (!blob || !blob.size) throw new Error('Empty PDF');
    return blob;
  }

  // ---- Save ----
  let saving = false;
  async function onSave(ev){
    try{
      ev && ev.preventDefault();
      if (saving) return; saving = true;
      const blob = await requestPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'smartel_form.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 60_000);
    }catch(e){
      console.error('[smartel-print] save error', e);
      alert('PDF 저장 오류: '+e.message);
    }finally{ saving = false; }
  }

  // ---- Print ----
  let printing = false;
  function openPopupSync(){
    // important: open synchronously to keep user gesture
    return window.open('', 'smartel-print', 'noopener,width=1024,height=768');
  }
  function ensureShell(win){
    if (!win) return;
    try{
      if (win.document && win.document.getElementById('pv')) return; // already
      const html = '<!doctype html><html><head><meta charset="utf-8"><title>Print</title>' +
                   '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style>' +
                   '</head><body>' +
                   '<iframe id="pv" type="application/pdf" allow="fullscreen"></iframe>' +
                   '<script>' +
                   '  const f = document.getElementById("pv");' +
                   '  f.addEventListener("load", function(){' +
                   '    try{ (f.contentWindow||window).focus(); (f.contentWindow||window).print(); }' +
                   '    catch(e){ try{ window.focus(); window.print(); }catch(_e){} }' +
                   '  });' +
                   '  window.addEventListener("afterprint", function(){ setTimeout(function(){ window.close(); }, 400); });' +
                   '<\/script>' +
                   '</body></html>';
      win.document.open(); win.document.write(html); win.document.close();
    }catch(e){ console.warn('[smartel-print] popup shell write fail', e); }
  }

  async function onPrint(ev){
    try{
      ev && ev.preventDefault();
      if (printing) return; printing = true;

      const w = openPopupSync();
      if (!w){ alert('팝업이 차단되었습니다. 주소창 오른쪽 팝업 아이콘에서 허용해 주세요.'); return; }
      ensureShell(w);

      const blob = await requestPdfBlob();
      const url = URL.createObjectURL(blob);
      try{
        const iframe = w.document.getElementById('pv');
        if (iframe) iframe.src = url;
        else w.location.href = url;
      }catch(_){ try{ w.location.href = url; }catch(__){} }
      setTimeout(()=>URL.revokeObjectURL(url), 60_000);
    }catch(e){
      console.error('[smartel-print] print error', e);
      alert('PDF 인쇄 오류: '+e.message);
    }finally{ setTimeout(()=>{ printing = false; }, 1200); }
  }

  // ---- Bind (idempotent, no UI changes) ----
  function bindBtn(sel, handler){
    document.querySelectorAll(sel).forEach(el=>{
      el.addEventListener('click', handler, false);
    });
  }
  function init(){
    LOG('ready');
    // do not remove existing onclick; we just add listeners to standard selectors
    bindBtn('#saveBtn,[data-action="save-pdf"]', onSave);
    bindBtn('#printBtn,[data-action="print-pdf"]', onPrint);
    // expose fallbacks for inline usage
    window.onSavePDF = onSave;
    window.onPrintPDF = onPrint;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
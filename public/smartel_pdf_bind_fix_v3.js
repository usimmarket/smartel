(function(){
  'use strict';
  if (window.__SMARTEL_BIND_FIX_V3__) return; window.__SMARTEL_BIND_FIX_V3__ = true;
  const LOG = (...a)=>console.log('[bind-fix v3]', ...a);

  function detectFnUrl(){
    try{
      if (typeof window.fnUrl==='function') return window.fnUrl();
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
    if (typeof window.generatePDFBlob==='function'){
      try{
        const any = await window.generatePDFBlob();
        if (any instanceof Blob) return any;
        if (any && typeof any.arrayBuffer==='function') return new Blob([await any.arrayBuffer()], {type:'application/pdf'});
      }catch(e){ console.warn('[bind-fix v3] page generatePDFBlob failed', e); }
    }
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

  let popupRef = null;
  function getPopupSync(){
    try{ if (popupRef && !popupRef.closed) return popupRef; }catch(_){}
    return (popupRef = window.open('', 'smartel-print', 'noopener,width=1024,height=768'));
  }
  function ensureShell(w){
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
    try{ if (!w.document || !w.document.getElementById('pv')){ w.document.open(); w.document.write(html); w.document.close(); } }catch(e){ LOG('popup shell write fail', e); }
  }

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
      console.error('[bind-fix v3] save error', e);
      alert('PDF 저장 오류: '+e.message);
    }finally{ saving = false; }
  }

  let printing = false;
  async function handlePrint(ev){
    try{
      ev && ev.preventDefault();
      if (printing) return;
      printing = true;

      const w = getPopupSync(); // open first (keeps user gesture)
      if (!w){
        alert('팝업이 차단되었습니다. 주소창 오른쪽 팝업 아이콘을 눌러 허용해 주세요.');
        printing = false; return;
      }
      ensureShell(w);

      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      try{
        const iframe = w.document.getElementById('pv');
        iframe.src = url;
      }catch(e){
        try{ w.location.href = url; }catch(_){}
      }
      setTimeout(()=>URL.revokeObjectURL(url), 60_000);
    }catch(e){
      console.error('[bind-fix v3] print error', e);
      alert('PDF 인쇄 오류: '+e.message);
    }finally{
      setTimeout(()=>{ printing = false; }, 1200);
    }
  }

  window.onSavePDF = handleSave;
  window.onPrintPDF = handlePrint;

  function bindOnce(id, fn){
    const el = document.getElementById(id);
    if (!el) return;
    try{ el.onclick = null; el.removeAttribute('onclick'); }catch(_){}
    el.addEventListener('click', fn, false);
  }

  function start(){
    LOG('handlers attaching');
    bindOnce('saveBtn', handleSave);
    bindOnce('printBtn', handlePrint);
    document.querySelectorAll('[onclick*="onSavePDF"]').forEach(el=>{ try{ el.onclick=null; el.removeAttribute('onclick'); }catch(_){ } el.addEventListener('click', handleSave, false); });
    document.querySelectorAll('[onclick*="onPrintPDF"]').forEach(el=>{ try{ el.onclick=null; el.removeAttribute('onclick'); }catch(_){ } el.addEventListener('click', handlePrint, false); });
    LOG('handlers attached');
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
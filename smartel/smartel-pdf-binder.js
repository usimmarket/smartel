
/*! smartel-pdf-binder.js (v2) - robust binder for Save/Print + leak killer */
(function(){
  'use strict';

  // ---------- Utils
  function qs(s, r){ return (r||document).querySelector(s); }
  function qsa(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function txt(el){ return (el && (el.textContent||'').trim()) || ''; }
  function on(el, ev, fn, opts){ el && el.addEventListener(ev, fn, opts||false); }

  // ---------- Leak killer (remove long stray text blocks that look like code)
  function leakKiller(){
    try{
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var kill = [];
      while (walker.nextNode()){
        var v = walker.currentNode.nodeValue || '';
        if (v.length > 400 && /const\s+I18N|applyLang\(|<\/script>|function\s*\(|smartel|autopay/i.test(v)) {
          kill.push(walker.currentNode);
        }
      }
      kill.forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); });
      document.body.style.overflowX = 'hidden';
    }catch(e){}
  }

  // ---------- Validator bridge
  function runValidate(){
    try {
      if (typeof window.__smartelValidate === 'function') {
        return !!window.__smartelValidate();
      }
      if (typeof window.validate === 'function') {
        return !!window.validate();
      }
    } catch(e){}
    return true; // no validator => pass
  }

  // ---------- Form -> JSON helper
  function collectFormJSON(){
    var f = qs('#form') || qs('form');
    if (!f) throw new Error('FORM_NOT_FOUND');
    var data = Object.fromEntries(new FormData(f).entries());

    // birth sync
    var rawBirth = (qs('#birth_in') && qs('#birth_in').value || '').replace(/\D/g,'');
    if (rawBirth) data.birth = rawBirth;

    // autopay exp (card only)
    var method = (qs('input[name="autopay_method"]:checked')||{}).value;
    if (method === 'card'){
      var yy = (qs('#card_exp_year')||{}).value || '';
      var mm = (qs('#card_exp_month')||{}).value || '';
      if (yy && mm){ data.autopay_exp = yy.replace(/\D/g,'') + '/' + mm.replace(/\D/g,''); }
    }
    return data;
  }

  function fnUrl(){
    return location.origin + '/.netlify/functions/generate_top';
  }

  async function generatePDFBlob(){
    var payload = collectFormJSON();
    console.log('[SMARTEL] POST ->', fnUrl(), payload);
    var resp = await fetch(fnUrl(), {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!resp.ok){
      var t=''; try{ t = await resp.text(); }catch(_){}
      console.error('[SMARTEL] Function error', resp.status, t);
      throw new Error('FN_FAIL_' + resp.status);
    }
    return await resp.blob();
  }

  // ---------- Actions
  async function onSave(e){
    e && e.preventDefault && e.preventDefault();
    if (!runValidate()){ window.scrollTo({top:0, behavior:'smooth'}); return; }
    try{
      const blob = await generatePDFBlob();
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'smartel_form.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 600000);
    }catch(err){
      alert('PDF 생성 중 오류가 발생했습니다.');
      console.error(err);
    }
  }

  async function onPrint(e){
    e && e.preventDefault && e.preventDefault();
    if (!runValidate()){ window.scrollTo({top:0, behavior:'smooth'}); return; }
    try{
      const blob = await generatePDFBlob();
      const url  = URL.createObjectURL(blob);
      const w = window.open('about:blank','_blank','noopener,noreferrer');
      const doc = w.document;
      doc.open();
      doc.write('<!doctype html><html><head><meta charset="utf-8"><title>SMARTEL 신청서</title>' +
                '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style>' +
                '</head><body></body></html>');
      doc.close();
      const iframe = doc.createElement('iframe');
      iframe.style.cssText = 'border:0;width:100vw;height:100vh';
      iframe.src = url;
      doc.body.appendChild(iframe);
      iframe.addEventListener('load', function(){
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
        catch (_){ w.focus(); w.print(); }
      });
      w.addEventListener('afterprint', function(){ setTimeout(function(){ w.close(); }, 400); });
      setTimeout(()=>URL.revokeObjectURL(url), 600000);
    }catch(err){
      alert('PDF 생성 중 오류가 발생했습니다.');
      console.error(err);
    }
  }

  // ---------- Button binding
  function findSaveButtons(){
    var cands = [
      '#saveBtn', '#savePdfBtn', '#pdfBtn', '[data-action="save-pdf"]'
    ];
    var els = cands.map(qs).filter(Boolean);
    if (!els.length){
      qsa('button,a,[role="button"]').forEach(function(b){
        var t = txt(b);
        if (/^(PDF\s*저장|Save\s*PDF)$/i.test(t)) els.push(b);
      });
    }
    return Array.from(new Set(els));
  }
  function findPrintButtons(){
    var cands = ['#printBtn', '[data-action="print-pdf"]'];
    var els = cands.map(qs).filter(Boolean);
    if (!els.length){
      qsa('button,a,[role="button"]').forEach(function(b){
        var t = txt(b);
        if (/^(인쇄|Print)$/i.test(t)) els.push(b);
      });
    }
    return Array.from(new Set(els));
  }

  function bindButtons(){
    findSaveButtons().forEach(function(el){
      if (el.__smartelBoundSave) return;
      on(el, 'click', onSave, {passive:false});
      el.__smartelBoundSave = true;
    });
    findPrintButtons().forEach(function(el){
      if (el.__smartelBoundPrint) return;
      on(el, 'click', onPrint, {passive:false});
      el.__smartelBoundPrint = true;
    });
    console.log('[SMARTEL] PDF handlers ready');
  }

  // Optional UI: toggle card fields if present
  function toggleCardFields(){
    var method = qs('input[name="autopay_method"]:checked');
    var box = qs('#card_fields');
    if (box){ box.style.display = (method && method.value === 'card') ? 'block' : 'none'; }
  }

  function boot(){
    leakKiller();
    bindButtons();
    toggleCardFields();
    qsa('input[name="autopay_method"]').forEach(function(r){ on(r, 'change', toggleCardFields); });
    // auto-fill apply date if #apply_date exists
    var ad = qs('#apply_date');
    if (ad && !ad.value){
      var d=new Date(), pad=n=>String(n).padStart(2,'0');
      ad.value = '신청일자 '+d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+pad(d.getDate())+'일';
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  // re-run leak killer a bit later too
  setTimeout(leakKiller, 800);
})();

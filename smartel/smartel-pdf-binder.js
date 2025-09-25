/* smartel-pdf-binder.js
 * Single drop-in script that wires PDF 저장 / 인쇄 to your Netlify Function
 * and cleans up any accidentally leaked inline script text.
 *
 * Required server endpoint: /.netlify/functions/generate_top  (same origin)
 * Works without touching index.html other than adding this <script> tag.
 */

(function(){
  'use strict';

  // ---- guard against double-load
  if (window.__SMARTEL_PDF_BINDER__) return;
  window.__SMARTEL_PDF_BINDER__ = true;

  // ---- helpers
  var log = function(){ try{ console.log.apply(console, ['[SMARTEL]'].concat([].slice.call(arguments))); }catch(_){} };
  var err = function(){ try{ console.error.apply(console, ['[SMARTEL]'].concat([].slice.call(arguments))); }catch(_){} };

  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  // Netlify Function URL (same-origin)
  function fnUrl(){
    return window.location.origin.replace(/\/$/, '') + '/.netlify/functions/generate_top';
  }

  // Form → JSON (with a few smart fields)
  function collectFormJSON(){
    var form = qs('#form') || qs('form');
    if(!form){ throw new Error('FORM_NOT_FOUND'); }
    var data = Object.fromEntries(new FormData(form).entries());

    // birth: prefer visible birth_in -> numeric only
    var rawBirth = (qs('#birth_in') && qs('#birth_in').value || '').replace(/\D/g,'');
    if (rawBirth) data.birth = rawBirth;

    // card expire: YY/MM
    var method = (qs('input[name="autopay_method"]:checked')||{}).value;
    if (method === 'card') {
      var yy = (qs('#card_exp_year')||{}).value||'';
      var mm = (qs('#card_exp_month')||{}).value||'';
      if (yy && mm) data.autopay_exp = (yy+'/'+mm).replace(/\s+/g,'');
    }
    return data;
  }

  async function generatePDFBlob(){
    var payload = collectFormJSON();
    log('POST', fnUrl(), payload);
    var resp = await fetch(fnUrl(), {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    if(!resp.ok){
      var t='';
      try{ t = await resp.text(); }catch(_){}
      err('Function error', resp.status, t);
      throw new Error('PDF_FUNCTION_ERROR_'+resp.status);
    }
    return await resp.blob();
  }

  function runValidate(){
    try {
      if (typeof window.__smartelValidate === 'function') return !!window.__smartelValidate();
      if (typeof window.validate === 'function') return !!window.validate();
      return true;
    } catch(_) { return true; }
  }

  // Find buttons robustly: by id first, then by [data-action], then by text content
  function findSaveButton(){
    return qs('#saveBtn') || qs('#savePdfBtn') || qs('#pdfBtn') ||
           qs('[data-action="save-pdf"]') ||
           qsa('button,a,[role="button"]').find(function(b){
             var t=(b.textContent||'').trim();
             return /^(PDF\s*저장|Save\s*PDF)$/i.test(t);
           }) || null;
  }
  function findPrintButton(){
    return qs('#printBtn') || qs('[data-action="print-pdf"]') ||
           qsa('button,a,[role="button"]').find(function(b){
             var t=(b.textContent||'').trim();
             return /^(인쇄|Print)$/i.test(t);
           }) || null;
  }

  // Open blob in new window
  function openBlobInNewWindow(blob, autoPrint){
    var url = URL.createObjectURL(blob);
    var w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.'); URL.revokeObjectURL(url); return; }

    // Write minimal document + iframe
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>SMARTEL PDF</title>'+
                     '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style>'+
                     '</head><body></body></html>');
    w.document.close();
    var iframe = w.document.createElement('iframe');
    iframe.id = 'pv';
    iframe.src = url;
    iframe.onload = function(){
      try {
        if (autoPrint) { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      } catch(e) { try{ w.focus(); if (autoPrint) w.print(); }catch(_){} }
    };
    w.addEventListener('afterprint', function(){ setTimeout(function(){ try{ w.close(); }catch(_){} }, 300); });
    w.document.body.appendChild(iframe);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 600000);
  }

  async function onSave(e){
    if (e) { e.preventDefault(); e.stopPropagation(); }
    try {
      if (!runValidate()) { window.scrollTo({top:0, behavior:'smooth'}); return; }
      var blob = await generatePDFBlob();
      // Download
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'smartel_form.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 600000);
    } catch (ex) {
      alert('PDF 생성 중 오류가 발생했습니다.\n(콘솔을 확인하세요)');
      err(ex);
    }
  }

  async function onPrint(e){
    if (e) { e.preventDefault(); e.stopPropagation(); }
    try {
      if (!runValidate()) { window.scrollTo({top:0, behavior:'smooth'}); return; }
      var blob = await generatePDFBlob();
      openBlobInNewWindow(blob, true);
    } catch (ex) {
      alert('PDF 생성 중 오류가 발생했습니다.\n(콘솔을 확인하세요)');
      err(ex);
    }
  }

  // Cleanup any leaked script text at page bottom (defensive)
  function leakKiller(){
    try {
      var killer = [];
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()){
        var node = walker.currentNode;
        var v = (node.nodeValue||'').trim();
        if (!v) continue;
        // Heuristics: long text that looks like code / i18n dump / function source
        if (v.length > 120 &&
            (v.indexOf('const I18N')>=0 ||
             v.indexOf('KR: {')>=0 ||
             v.indexOf('applyLang(')>=0 ||
             v.indexOf('function fnUrl(')>=0 ||
             v.indexOf('smartel')>=0 && v.indexOf('PDF')>=0)) {
          killer.push(node);
        }
      }
      killer.forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); });
      if (killer.length) { document.body.style.overflowX = 'hidden'; log('Removed leaked code nodes:', killer.length); }
    } catch(_) {}
  }

  function bindAll(){
    var save = findSaveButton();
    var print = findPrintButton();
    if (save && !save.__smartelBound){
      save.addEventListener('click', onSave, {passive:false});
      save.__smartelBound = true;
      log('Save button bound');
    }
    if (print && !print.__smartelBound){
      print.addEventListener('click', onPrint, {passive:false});
      print.__smartelBound = true;
      log('Print button bound');
    }
    // fill apply date if empty
    try {
      var el = qs('#apply_date');
      if (el && !el.value) {
        var d = new Date(), pad = function(n){return String(n).padStart(2,'0');};
        el.value = '신청일자 ' + d.getFullYear() + '년 ' + (d.getMonth()+1) + '월 ' + pad(d.getDate()) + '일';
      }
    } catch(_) {}
    leakKiller();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll);
  } else {
    bindAll();
  }
  // and re-run once more after layout (in case buttons are late-rendered)
  setTimeout(bindAll, 600);
  setTimeout(leakKiller, 900);
})();
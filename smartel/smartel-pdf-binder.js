
/*! smartel-pdf-binder.js (drop‑in, no markup changes required)
 *  - Catches clicks on “PDF 저장 / Save PDF / 인쇄 / Print” anywhere
 *  - Calls Netlify function `/.netlify/functions/generate_top` with form JSON
 *  - Opens the returned PDF (save or print)
 *  - Cleans up accidental “leaked script text” at the bottom of the page
 *  - Safe alongside existing validate()/__smartelValidate() if present
 *  - Idempotent; ok to include multiple times.
 */
(function () {
  'use strict';

  if (window.__SMARTEL_BINDER_READY__) return;
  window.__SMARTEL_BINDER_READY__ = true;

  /* ---------- Utils ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function log() { try { console.log.apply(console, ['[SMARTEL]'].concat([].slice.call(arguments))); } catch (_) {} }
  function warn(){ try { console.warn.apply(console, ['[SMARTEL]'].concat([].slice.call(arguments))); } catch (_) {} }

  // Debounced leak cleaner (handles the “code printed at bottom” case).
  function cleanupLeak() {
    try {
      var kill = [];
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        var t = walker.currentNode.nodeValue || '';
        // Signatures that should never be visible
        if (t.indexOf('const I18N') > -1 ||
            t.indexOf('applyLang(') > -1 ||
            t.indexOf('.netlify/functions/generate_top') > -1 ||
            t.indexOf('PDF handlers ready') > -1 ||
            t.indexOf('document.write(') > -1) {
          kill.push(walker.currentNode);
        }
      }
      kill.forEach(function(n){ if (n && n.parentNode) n.parentNode.removeChild(n); });
      document.body.style.overflowX = 'hidden';
    } catch (e) {}
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function originFnUrl(){
    // Always same-origin to avoid CORS surprises on the live site
    return window.location.origin.replace(/\/$/,'') + '/.netlify/functions/generate_top';
  }

  function formEl(){
    return $('#form') || document.forms[0] || document.querySelector('form');
  }

  function collectFormJSON(){
    var f = formEl();
    var data = {};
    if (f) {
      try {
        data = Object.fromEntries(new FormData(f).entries());
      } catch (e) {
        // Safari < 14 fallback
        data = {};
        $$( 'input,select,textarea', f ).forEach(function(el){
          if (!el.name) return;
          if (el.type === 'radio') {
            if (el.checked) data[el.name] = el.value;
          } else if (el.type === 'checkbox') {
            if (!data[el.name]) data[el.name] = [];
            if (el.checked) data[el.name].push(el.value);
          } else {
            data[el.name] = el.value;
          }
        });
      }
    }
    // Hidden helpers
    var rawBirth = ($('#birth_in') && $('#birth_in').value || '').replace(/\D/g,'');
    if (rawBirth) data.birth = rawBirth;

    var method = (document.querySelector('input[name="autopay_method"]:checked')||{}).value;
    if (method === 'card') {
      var yy = ($('#card_exp_year')||{}).value || '';
      var mm = ($('#card_exp_month')||{}).value || '';
      if (yy && mm) data.autopay_exp = (yy.trim() + '/' + mm.trim());
    }
    return data;
  }

  async function generatePDFBlob(){
    var payload = collectFormJSON();
    var url = originFnUrl();
    log('POST →', url, payload);
    var resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (netErr) {
      warn('Network error:', netErr);
      throw new Error('네트워크 오류로 PDF를 불러오지 못했습니다.');
    }
    if (!resp.ok) {
      var txt = '';
      try { txt = await resp.text(); } catch (_) {}
      warn('Function error', resp.status, txt);
      throw new Error('서버 함수 오류(' + resp.status + ') - Netlify Functions 상태를 확인하세요.');
    }
    return await resp.blob();
  }

  function callValidate(){
    try {
      if (typeof window.__smartelValidate === 'function') return !!window.__smartelValidate();
      if (typeof window.validate === 'function') return !!window.validate();
    } catch (e) {}
    return true; // no validator → pass
  }

  async function doSavePDF(){
    if (!callValidate()) { window.scrollTo({top:0,behavior:'smooth'}); return; }
    var blob = await generatePDFBlob();
    var url  = URL.createObjectURL(blob);
    // Prefer file-save
    var a = document.createElement('a');
    a.href = url;
    a.download = 'smartel_form.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 600000);
  }

  async function doPrintPDF(){
    if (!callValidate()) { window.scrollTo({top:0,behavior:'smooth'}); return; }
    var blob = await generatePDFBlob();
    var url  = URL.createObjectURL(blob);
    var w    = window.open('about:blank','_blank','noopener,noreferrer');
    if (!w) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.'); return; }
    var doc  = w.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>SMARTEL 신청서</title>'+
              '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style>'+
              '</head><body></body></html>');
    doc.close();
    var iframe = doc.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = 'border:0;width:100vw;height:100vh';
    doc.body.appendChild(iframe);
    iframe.addEventListener('load', function(){
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      catch (e) { w.focus(); w.print(); }
    });
    w.addEventListener('afterprint', function(){ setTimeout(function(){ w.close(); }, 400); });
    setTimeout(function(){ URL.revokeObjectURL(url); }, 600000);
  }

  // Very tolerant matcher for label text
  function labelTextOf(el){
    if (!el) return '';
    var t = (el.textContent || '').replace(/\s+/g,' ').trim();
    return t;
  }
  function isSaveLabel(t){
    return /^(PDF\s*저장|Save\s*PDF)$/i.test(t);
  }
  function isPrintLabel(t){
    return /^(인쇄|Print)$/i.test(t);
  }

  // Global click delegation (so we don’t depend on IDs)
  function handleDelegatedClick(ev){
    var btn = ev.target && (ev.target.closest && ev.target.closest('button, a, [role="button"]'));
    if (!btn) return;
    var t = labelTextOf(btn);
    // Also allow explicit data-action attributes
    var act = (btn.getAttribute('data-action') || '').toLowerCase();
    if (act === 'save-pdf' || isSaveLabel(t)) {
      ev.preventDefault();
      ev.stopPropagation();
      doSavePDF().catch(function(e){ alert(e.message || 'PDF 생성 실패'); });
      return;
    }
    if (act === 'print-pdf' || isPrintLabel(t)) {
      ev.preventDefault();
      ev.stopPropagation();
      doPrintPDF().catch(function(e){ alert(e.message || 'PDF 생성 실패'); });
      return;
    }
  }

  // Expose a manual API if needed
  window.SmartelPDF = {
    save: function(){ return doSavePDF(); },
    print: function(){ return doPrintPDF(); },
    cleanup: cleanupLeak
  };

  // Init
  onReady(function(){
    // leak cleaner now + a short retry
    cleanupLeak();
    setTimeout(cleanupLeak, 500);
    setTimeout(cleanupLeak, 2000);

    // Pre-attach explicit IDs if present (does nothing if not present)
    var save = $('#saveBtn') || $('#pdfBtn');
    var print = $('#printBtn');
    if (save) save.addEventListener('click', function(e){ e.preventDefault(); doSavePDF().catch(function(err){ alert(err.message || 'PDF 생성 실패'); }); }, { capture: true });
    if (print) print.addEventListener('click', function(e){ e.preventDefault(); doPrintPDF().catch(function(err){ alert(err.message || 'PDF 생성 실패'); }); }, { capture: true });

    // And always keep a global delegator as ultimate fallback
    document.addEventListener('click', handleDelegatedClick, true);

    log('PDF handlers ready');
  });
})();

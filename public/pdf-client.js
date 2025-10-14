(function(){
  'use strict';

  // ---- 0) Optional validation hook (kept backward compatible)
  function validateGate(){
    try { if (typeof window.__smartelValidate === 'function') return !!window.__smartelValidate(); } catch(_){}
    try { if (typeof window.validate === 'function') return !!window.validate(); } catch(_){}
    return true;
  }

  // ---- 1) Collect form data + a few derived fields (kept from current impl)
  function collect(){
    var form = document.getElementById('form') || document.querySelector('form');
    var data = {};
    if (form){
      try { data = Object.fromEntries(new FormData(form).entries()); } catch(_){}
    }
    // birth
    var birthIn = document.getElementById('birth_in');
    if (birthIn) data.birth = (birthIn.value||'').replace(/\D/g,'');

    // autopay expiry (card)
    var yy = document.getElementById('cardYY') || document.getElementById('card_exp_year');
    var mm = document.getElementById('cardMM') || document.getElementById('card_exp_month');
    if (yy && mm) data.autopay_exp = ((yy.value||'').trim() + "/" + (mm.value||'').trim());

    // autopay_org / autopay_number 3-key model 지원(필요 시)
    if (data.bank_name || data.card_company){
      data.autopay_org = data.card_company || data.bank_name || data.autopay_org || '';
    }
    if (data.bank_account || data.card_number){
      data.autopay_number = data.card_number || data.bank_account || data.autopay_number || '';
    }

    // method-based nulling (은행/카드 중 선택된 것만 남김)
    if (data.autopay_method === 'bank'){
      data.card_company = data.card_number = data.card_exp_year = data.card_exp_month = data.card_name = '';
    }else if (data.autopay_method === 'card'){
      data.bank_name = data.bank_account = '';
    }

    return data;
  }

  // ---- 2) Endpoint resolver (dev vs deployed)
  function fnUrl(){
    var REL = '/.netlify/functions/generate_pdf';
    if (location.origin && location.origin.includes('smartel.netlify.app')){
      return REL; // same origin in production
    }
    // local file:// or preview -> hit prod absolute URL to avoid CORS surprises
    return 'https://smartel.netlify.app' + REL;
  }

  // ---- 3) Call serverless to get a PDF Blob
  async function generatePDFBlob(payload){
    var res = await fetch(fnUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || collect())
    });
    if (!res.ok){
      var text = '';
      try { text = await res.text(); } catch(_){}
      throw new Error('PDF server error: ' + res.status + ' ' + text);
    }
    // Netlify functions will serve application/pdf; in browser we can read as Blob
    return await res.blob();
  }

  // ---- 4) Save helper
  async function savePDF(){
    var blob0 = await generatePDFBlob();
    var blob = (blob0 instanceof Blob) ? blob0 :
               (blob0 && blob0.arrayBuffer ? new Blob([await blob0.arrayBuffer()], {type:'application/pdf'}) :
                new Blob([blob0||''], {type:'application/pdf'}));
    var url = URL.createObjectURL(blob);
    try {
      var a = document.createElement('a');
      a.href = url;
      a.download = 'smartel_form.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(function(){ URL.revokeObjectURL(url); }, 60_000);
    }
  }

  // ---- 5) Reliable print via popup + iframe.contentWindow.print()
  function openPrintPopup(){
    // Avoid 'noreferrer' here — it can sometimes break focus/print on some browsers.
    var w = window.open('', 'pdf-preview', 'noopener');
    return w;
  }

  async function printPDF(){
    var blob0 = await generatePDFBlob();
    var blob = (blob0 instanceof Blob) ? blob0 :
               (blob0 && blob0.arrayBuffer ? new Blob([await blob0.arrayBuffer()], {type:'application/pdf'}) :
                new Blob([blob0||''], {type:'application/pdf'}));

    var url = URL.createObjectURL(blob);

    // Open popup synchronously (closest to user gesture) BEFORE async awaits where possible
    var w = openPrintPopup();
    if (!w){
      // Popup blocked → graceful fallback: download
      try {
        var a = document.createElement('a');
        a.href = url;
        a.download = 'smartel_form.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        setTimeout(function(){ URL.revokeObjectURL(url); }, 60_000);
      }
      return;
    }

    // Compose a minimal document with an iframe
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Print</title>' +
               '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style>' +
               '</head><body>' +
               '<iframe id="pv" allow="fullscreen"></iframe>' +
               '<script>' +
               'var f=document.getElementById("pv");' +
               'f.addEventListener("load",function(){' +
               '  try{ (f.contentWindow||window).focus(); (f.contentWindow||window).print(); }' +
               '  catch(e){ try{ window.focus(); window.print(); }catch(_e){} }' +
               '});' +
               'window.addEventListener("afterprint", function(){ setTimeout(function(){ window.close(); }, 400); });' +
               '<\/script>' +
               '</body></html>';

    // Write the shell first so the load listener is attached BEFORE src is set
    try{
      w.document.open();
      w.document.write(html);
      w.document.close();
    }catch(_){}

    try {
      var iframe = w.document.getElementById('pv');
      iframe.src = url;
    } catch(_){}

    // Clean up the blob URL a bit later
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60_000);
  }

  // ---- 6) Required field toggle for autopay (optional keep)
  function toggleRequired(){
    var method = (document.querySelector('[name="autopay_method"]:checked') || {}).value || '';
    var bankEls = ['bank_name','bank_account'].map(function(id){ return document.getElementById(id); });
    var cardEls = ['card_company','card_number','card_exp_year','card_exp_month','card_name'].map(function(id){ return document.getElementById(id); });

    bankEls.forEach(function(el){ if (el){ el.required = (method === 'bank'); } });
    cardEls.forEach(function(el){ if (el){ el.required = (method === 'card'); } });
  }

  // ---- 7) Bind buttons
  document.addEventListener('change', function(e){
    if (e && e.target && e.target.name === 'autopay_method') toggleRequired();
  });

  document.addEventListener('DOMContentLoaded', function(){
    toggleRequired();

    var saveBtn  = document.getElementById('saveBtn');
    var printBtn = document.getElementById('printBtn');

    if (saveBtn && !saveBtn.dataset.pdfBound){
      saveBtn.dataset.pdfBound = '1';
      saveBtn.addEventListener('click', function(e){
        e.preventDefault();
        if (!validateGate()){
          try{ window.scrollTo({top:0, behavior:'smooth'});}catch(_){}
          return;
        }
        savePDF().catch(function(err){
          alert('PDF 저장 중 오류가 발생했습니다. 콘솔 로그를 확인하세요.');
          console.error(err);
        });
      });
    }

    if (printBtn && !printBtn.dataset.pdfBound){
      printBtn.dataset.pdfBound = '1';
      printBtn.addEventListener('click', function(e){
        e.preventDefault();
        if (!validateGate()){
          try{ window.scrollTo({top:0, behavior:'smooth'});}catch(_){}
          return;
        }
        // Open popup first to keep user-gesture linkage, then proceed
        // (we open and immediately close if blocked inside printPDF)
        printPDF().catch(function(err){
          alert('인쇄 준비 중 오류가 발생했습니다. 콘솔 로그를 확인하세요.');
          console.error(err);
        });
      });
    }
  });
})();
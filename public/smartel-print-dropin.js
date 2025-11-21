/*! smartel-print-dropin v2.0 (simple open-in-new-tab print) */
(function(){
  'use strict';
  if (window.__SMARTEL_PRINT_DROPIN__) return;
  window.__SMARTEL_PRINT_DROPIN__ = true;

  const ABS_ENDPOINT = 'https://smartel.netlify.app/.netlify/functions/generate_pdf';
  const LOG = (...a)=>console.log('[smartel-print]', ...a);

  function collectPayload(){
    const form = document.getElementById('form');
    const data = {};

    if (form) {
      try{
        const fd = new FormData(form);
        fd.forEach((v,k)=>{ data[k] = v; });
      }catch(e){
        console.error('[smartel-print] FormData error', e);
      }
    }

    // 생년월일: birth_in → 숫자만 모아서 birth
    const birthIn = document.getElementById('birth_in');
    if (birthIn) {
      data.birth = (birthIn.value || '').replace(/\D/g, '');
    }

    // 카드 유효기간 → autopay_exp (YY/MM)
    const yyEl = document.getElementById('cardYY') || document.getElementById('card_exp_year');
    const mmEl = document.getElementById('cardMM') || document.getElementById('card_exp_month');
    if (yyEl || mmEl) {
      const yy = (yyEl && yyEl.value || '').trim();
      const mm = (mmEl && mmEl.value || '').trim();
      if (yy || mm) {
        const yy2 = yy.padStart(2, '0');
        const mm2 = mm.padStart(2, '0');
        data.autopay_exp = yy2 + '/' + mm2;
      }
    }

    // 자동이체 org/number
    const bankName = document.getElementById('bank_name');
    const bankAccount = document.getElementById('bank_account');
    const cardCompany = document.getElementById('card_company');
    const cardNumber = document.getElementById('card_number');

    if (cardCompany && cardCompany.value.trim()) {
      data.autopay_org = cardCompany.value.trim();
    } else if (bankName && bankName.value.trim()) {
      data.autopay_org = bankName.value.trim();
    }

    if (cardNumber && cardNumber.value.trim()) {
      data.autopay_number = cardNumber.value.replace(/\s+/g, '');
    } else if (bankAccount && bankAccount.value.trim()) {
      data.autopay_number = bankAccount.value.replace(/\s+/g, '');
    }

    return data;
  }

  async function requestPdfBlob(){
    const payload = collectPayload();
    LOG('requesting PDF...', payload);

    const res = await fetch(ABS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error('PDF 생성 실패 (HTTP ' + res.status + ') ' + text);
    }

    const buf = await res.arrayBuffer();
    return new Blob([buf], { type: 'application/pdf' });
  }

  async function onSave(ev){
    if (ev && ev.preventDefault) ev.preventDefault();
    try{
      const blob = await requestPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smartel_form.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 600000);
    }catch(err){
      console.error('[smartel-print] save error', err);
      alert('PDF 저장 중 오류가 발생했습니다. (' + (err && err.message ? err.message : err) + ')');
    }
  }

  async function onPrint(ev){
    if (ev && ev.preventDefault) ev.preventDefault();

    // 팝업 차단을 줄이기 위해 먼저 about:blank 탭을 연 후,
    // PDF가 생성되면 그 탭의 주소를 blob URL로 바꿉니다.
    const w = window.open('', '_blank');
    if (!w) {
      alert('팝업이 차단되었습니다. 주소창 오른쪽 팝업 아이콘에서 허용해 주세요.');
      return;
    }

    try{
      const blob = await requestPdfBlob();
      const url = URL.createObjectURL(blob);
      w.location.href = url;
      setTimeout(()=>URL.revokeObjectURL(url), 600000);
    }catch(err){
      console.error('[smartel-print] print error', err);
      alert('PDF 인쇄용 미리보기 생성 중 오류가 발생했습니다. (' + (err && err.message ? err.message : err) + ')');
      try { w.close(); } catch(_){}
    }
  }

  function bindBtn(selector, handler){
    const list = document.querySelectorAll(selector);
    list.forEach((el)=>{
      el.addEventListener('click', handler, false);
    });
  }

  function init(){
    LOG('init');
    bindBtn('#saveBtn,[data-action="save-pdf"]', onSave);
    bindBtn('#printBtn,[data-action="print-pdf"]', onPrint);
    window.onSavePDF = onSave;
    window.onPrintPDF = onPrint;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();


(function(){
  function validateGate(){
    try { if (typeof window.__smartelValidate === 'function') return !!window.__smartelValidate(); } catch(e){}
    try { if (typeof window.validate === 'function') return !!window.validate(); } catch(e){}
    return true;
  }
  function collect(){
    var form = document.getElementById('form') || document.querySelector('form');
    var data = {};
    if (form){ try { data = Object.fromEntries(new FormData(form).entries()); } catch(e){} }
    var birthIn = document.getElementById('birth_in');
    if (birthIn) data.birth = (birthIn.value||'').replace(/\D/g,'');
    var yy = document.getElementById('cardYY') || document.getElementById('card_exp_year');
    var mm = document.getElementById('cardMM') || document.getElementById('card_exp_month');
    if (yy && mm) data.autopay_exp = ((yy.value||'').trim() + "/" + (mm.value||'').trim());
    return data;
  }
  function toggleRequired(){
    var sel = document.querySelector('input[name="autopay_method"]:checked');
    var isCard = sel && sel.value==='card';
    var yy = document.getElementById('cardYY') || document.getElementById('card_exp_year');
    var mm = document.getElementById('cardMM') || document.getElementById('card_exp_month');
    [yy,mm].forEach(function(el){ if(!el) return; try { el.required = !!isCard; } catch(_){}});
  }
  // [ADD @ L23+1] 전역 프린트 팝업 핸들
let __pdfWin = null;
function ensurePopup() {
  // 이미 떠 있으면 재사용, 없으면 새로 오픈 (팝업 차단 회피)
  if (!__pdfWin || __pdfWin.closed) {
    __pdfWin = window.open('about:blank', 'pdf-preview', 'noopener,noreferrer');
  }
  return __pdfWin;
}
  document.addEventListener('change', function(e){ if (e.target && e.target.name==='autopay_method') toggleRequired(); });
  document.addEventListener('DOMContentLoaded', function(){
    toggleRequired();
    var save = document.getElementById('saveBtn') || document.getElementById('pdfBtn') || document.querySelector('[data-action="save-pdf"]');
    var printB = document.getElementById('printBtn') || document.querySelector('[data-action="print-pdf"]');
    // [REPLACE @ L31–L53]
async function run(doPrint) {
  const payload = collect();

  let resp;
  try {
    resp = await fetch('/.netlify/functions/generate_pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    alert('네트워크 오류: ' + err.message);
    return;
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    alert('상태코드 ' + resp.status + ' / ' + (t || '응답 본문 없음'));
    return;
  }

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);

  if (doPrint) {
    // 이미 클릭 시 ensurePopup()로 창을 열어 두었기 때문에 차단되지 않음
    const w = ensurePopup();
    const doc = w.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>html,body{margin:0;height:100%}</style></head><body><iframe id="pv" style="border:0;width:100%;height:100%"></iframe></body></html>');
    doc.close();

    const iframe = doc.getElementById('pv');
    iframe.src = url;
    iframe.addEventListener('load', () => {
      try { w.focus(); w.print(); } catch (_) {}
    });

    // 메모리 정리
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    // 저장(다운로드)
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartel_form.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

// 버튼 바인딩
const save = document.getElementById('saveBtn') || document.getElementById('pdfBtn');
const print = document.getElementById('printBtn');

if (save)  save.addEventListener('click',  (e) => { e.preventDefault(); run(false); });
if (print) print.addEventListener('click', (e) => {
  e.preventDefault();
  // ★ 여기서 먼저 팝업을 띄워 두면(사용자 동작 시점) 팝업 차단 안 걸림
  ensurePopup();
  run(true);
});

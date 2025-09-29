
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
  document.addEventListener('change', function(e){ if (e.target && e.target.name==='autopay_method') toggleRequired(); });
  document.addEventListener('DOMContentLoaded', function(){
    toggleRequired();
    var save = document.getElementById('saveBtn') || document.getElementById('pdfBtn') || document.querySelector('[data-action="save-pdf"]');
    var printB = document.getElementById('printBtn') || document.querySelector('[data-action="print-pdf"]');
    async function run(printMode){
      if (!validateGate()) { try{ window.scrollTo({top:0,behavior:'smooth'});}catch(_){ } return; }
      var payload = collect();
      var resp = await fetch('/.netlify/functions/generate_pdf',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!resp.ok){ alert('PDF 생성 중 오류가 발생했습니다. Netlify Functions 배포/경로를 확인해주세요.'); return; }
      var blob = await resp.blob();
      var url = URL.createObjectURL(blob);
      if (printMode){
        var w = window.open('about:blank','_blank','noopener,noreferrer');
        var doc = w.document;
        doc.write('<!doctype html><meta charset="utf-8"><title>Print</title><iframe id="pv" style="border:0;width:100vw;height:100vh"></iframe>');
        doc.close();
        var f = doc.getElementById('pv'); f.src = url;
        f.addEventListener('load', function(){ try{ f.contentWindow.print(); }catch(e){ w.print(); } });
        w.addEventListener('afterprint', function(){ URL.revokeObjectURL(url); setTimeout(function(){ try{w.close();}catch(_){}} , 300); });
      } else {
        var a = document.createElement('a'); a.href = url; a.download = 'smartel_form.pdf';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      }
    }
    if (save)  save.addEventListener('click',  function(e){ e.preventDefault(); run(false); });
    if (printB) printB.addEventListener('click', function(e){ e.preventDefault(); run(true);  });
  });
})();

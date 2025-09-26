
(function(){
  async function loadMapping(){
    try{
      const r = await fetch('mapping.json',{cache:'no-store'});
      if(!r.ok) return null;
      return await r.json();
    }catch(e){ return null; }
  }

  function gatherForm(){
    const form = document.getElementById('form') || document.querySelector('form');
    const data = Object.fromEntries(new FormData(form).entries());
    return data;
  }

  async function callFn(payload){
    const r = await fetch('/.netlify/functions/generate_pdf', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!r.ok){
      const t = await r.text();
      throw new Error('Function error: '+r.status+' '+t);
    }
    // Netlify returns binary for isBase64Encoded:true, so r.blob() works.
    return await r.blob();
  }

  function saveBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'smartel_form.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60_000);
  }

  function printBlob(blob){
    const url = URL.createObjectURL(blob);
    const w = window.open('', '_blank', 'noopener');
    if(!w){ alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.'); return; }
    w.document.write('<!doctype html><meta charset="utf-8"><title>Print</title><style>html,body{margin:0;height:100%}</style><iframe id="pv" style="border:0;width:100vw;height:100vh"></iframe>');
    w.document.close();
    const ifr = w.document.getElementById('pv');
    ifr.src = url;
    ifr.addEventListener('load', function(){
      try{ ifr.contentWindow.focus(); ifr.contentWindow.print(); }catch(_){ w.focus(); w.print(); }
    });
    w.addEventListener('afterprint', ()=> setTimeout(()=>w.close(), 400));
    setTimeout(()=>URL.revokeObjectURL(url), 60_000);
  }

  async function handleSave(){
    try{
      const mapping = await loadMapping();
      const fields = gatherForm();
      const blob = await callFn({fields, mapping});
      saveBlob(blob, 'smartel_form.pdf');
    }catch(e){
      console.error(e);
      alert('PDF 생성 실패: ' + e.message);
    }
  }
  async function handlePrint(){
    try{
      const mapping = await loadMapping();
      const fields = gatherForm();
      const blob = await callFn({fields, mapping});
      printBlob(blob);
    }catch(e){
      console.error(e);
      alert('PDF 생성 실패: ' + e.message);
    }
  }

  function bind(){
    const save = document.getElementById('saveBtn') || document.getElementById('savePdfBtn') || document.querySelector('[data-action="save-pdf"]');
    const print = document.getElementById('printBtn') || document.querySelector('[data-action="print-pdf"]');
    if(save) save.addEventListener('click', handleSave);
    if(print) print.addEventListener('click', handlePrint);
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
})();

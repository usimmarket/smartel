
// pdf-client.js — binds Save/Print buttons and calls the Netlify function
(function () {
  function $(sel){ return document.querySelector(sel); }
  function byText(text){
    return Array.from(document.querySelectorAll('button,a,[role="button"]'))
      .find(b => (b.textContent||'').trim() === text);
  }
  function collectFormJSON(){
    const f = document.getElementById('form') || document.querySelector('form');
    const data = f ? Object.fromEntries(new FormData(f).entries()) : {};
    // normalize some known fields
    if (data.birth_in && !data.birth) data.birth = String(data.birth_in).replace(/\D+/g,'');
    return data;
  }
  async function call(fn, payload){
    const resp = await fetch('/.netlify/functions/'+fn, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload||{})
    });
    if(!resp.ok){
      const t = await resp.text().catch(()=>'');
      throw new Error('Function failed '+resp.status+': '+t);
    }
    return await resp.blob();
  }
  async function onSave(ev){
    ev && ev.preventDefault && ev.preventDefault();
    const data = collectFormJSON();
    const blob = await call('generate_pdf', {data});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartel_form.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 600000);
  }
  async function onPrint(ev){
    ev && ev.preventDefault && ev.preventDefault();
    const data = collectFormJSON();
    const blob = await call('generate_pdf', {data});
    const url = URL.createObjectURL(blob);
    const w = window.open('', '_blank','noopener');
    w.document.write('<!doctype html><title>SMARTEL PDF</title><style>html,body{margin:0;height:100%}</style><embed src="'+url+'" type="application/pdf" style="width:100%;height:100%"/>');
    w.document.close();
    setTimeout(()=>{ try{w.focus();w.print();}catch(_){/* noop */} }, 250);
    setTimeout(()=>URL.revokeObjectURL(url), 600000);
  }
  function bind(){
    const save = document.getElementById('saveBtn') || document.getElementById('pdfBtn') || byText('PDF 저장') || byText('Save PDF');
    const print = document.getElementById('printBtn') || byText('인쇄') || byText('Print');
    if (save && !save.__pdfbound){ save.addEventListener('click', onSave, {passive:false}); save.__pdfbound=true; }
    if (print && !print.__pdfbound){ print.addEventListener('click', onPrint, {passive:false}); print.__pdfbound=true; }
    console.log('[pdf-client] ready');
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

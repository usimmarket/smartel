(function(){
  'use strict';
  if (window.__SMARTEL_BIND_FIX__) return; window.__SMARTEL_BIND_FIX__=true;
  function fnUrl(){
    try{
      const REL='/.netlify/functions/generate_pdf';
      if (location.origin && location.origin.indexOf('smartel.netlify.app')>=0) return REL;
      return 'https://smartel.netlify.app'+REL;
    }catch(_){ return '/.netlify/functions/generate_pdf'; }
  }
  async function generatePDFBlob(){
    // prefer page function
    if (typeof window.generatePDFBlob==='function'){
      try{
        const v = await window.generatePDFBlob();
        if (v instanceof Blob) return v;
        if (v && v.arrayBuffer) return new Blob([await v.arrayBuffer()], {type:'application/pdf'});
      }catch(e){ console.warn('[bind-fix] page generatePDFBlob failed', e); }
    }
    const form = document.getElementById('form');
    const data = form ? Object.fromEntries(new FormData(form).entries()) : {};
    const res = await fetch(fnUrl(), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
    if (!res.ok){
      const t = await res.text().catch(()=>'');
      alert('PDF 서버 오류: '+res.status+'\n'+t);
      throw new Error('HTTP '+res.status);
    }
    return await res.blob();
  }
  async function onSave(e){
    e && e.preventDefault && e.preventDefault();
    const blob = await generatePDFBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download='smartel_form.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
  }
  function openPopup(){ return window.open('', 'smartel-print', 'noopener,width=1024,height=768'); }
  async function onPrint(e){
    e && e.preventDefault && e.preventDefault();
    const blob = await generatePDFBlob();
    const url = URL.createObjectURL(blob);
    const w = openPopup();
    if (!w){ // fallback: download
      const a=document.createElement('a'); a.href=url; a.download='smartel_form.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      return;
    }
    const html='<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style></head><body><iframe id="pv" allow="fullscreen"></iframe><script>var f=document.getElementById(\"pv\");f.addEventListener(\"load\",function(){try{(f.contentWindow||window).focus();(f.contentWindow||window).print();}catch(e){try{window.focus();window.print();}catch(_){}}});<\/script></body></html>';
    try{ w.document.open(); w.document.write(html); w.document.close(); }catch(_){}
    try{ w.document.getElementById('pv').src=url; }catch(_){ try{ w.location.href=url; }catch(__){} }
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
  }
  function rebind(id, fn){
    var el = document.getElementById(id);
    if (!el) return;
    try{ el.onclick=null; el.removeAttribute('onclick'); }catch(_){}
    var clone=el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    clone.addEventListener('click', fn, false);
  }
  function start(){
    rebind('saveBtn', onSave);
    rebind('printBtn', onPrint);
    console.log('[bind-fix] handlers attached');
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
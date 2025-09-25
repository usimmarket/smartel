/*! SMARTEL PDF Binder (no-dup safe) */
(function(){
  'use strict';
  var FN_REL='/.netlify/functions/generate_top';
  var FN_ABS='https://smartel.netlify.app/.netlify/functions/generate_top'; // <- 필요시 귀사 도메인으로 변경
  function fnUrl(){try{return(location.protocol.indexOf('http')===0)?FN_REL:FN_ABS;}catch(_){return FN_ABS;}}
  function qs(s){return document.querySelector(s)} function qsa(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function getLabelFor(name){try{var el=document.querySelector('[name="'+CSS.escape(name)+'"],#'+CSS.escape(name));if(!el)return name;
    var lab=(el.id&&document.querySelector('label[for="'+el.id+'"]'))||(el.closest&&el.closest('label'));return lab?(lab.textContent||'').trim():name}catch(_){return name}}
  function collectFormJSON(){var form=qs('#form')||qs('form');if(!form)throw new Error('FORM_NOT_FOUND');
    var data=Object.fromEntries(new FormData(form).entries());
    var birthIn=qs('#birth_in');if(birthIn)data.birth=(birthIn.value||'').replace(/\D/g,'');
    var payBirth=qs('#autopay_birth');if(payBirth&&!data.pay_birth)data.pay_birth=(payBirth.value||'').replace(/\D/g,'');
    var m=document.querySelector('input[name="autopay_method"]:checked');if(m&&m.value==='card'){var yy=(qs('#card_exp_year')||{}).value||'';var mm=(qs('#card_exp_month')||{}).value||'';if(yy&&mm)data.autopay_exp=(yy.trim()+'/'+mm.trim());}
    return data;}
  function buildLocalPrintableHTML(){var form=qs('#form')||qs('form');var fd=new FormData(form);var rows=Array.from(fd.entries()).filter(p=>String(p[1]).trim()!=='').map(function(p){var k=p[0],v=p[1];return '<tr><th>'+esc(getLabelFor(k))+'</th><td>'+esc(v)+'</td></tr>';}).join('');
    return '<!doctype html><meta charset="utf-8"><title>SMARTEL 신청서</title><style>body{font:14px/1.6 system-ui;padding:24px}h1{font-size:20px;margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:8px;vertical-align:top}th{background:#f8fafc;width:32%}@page{margin:16mm}@media print{.noprint{display:none}}</style><h1>SMARTEL 신청서</h1><table>'+rows+'</table><div class="noprint" style="margin-top:16px"><button onclick="window.print()">인쇄</button></div>';}
  async function requestServerPDF(){var payload=collectFormJSON();var url=fnUrl();try{console.log('[SMARTEL] POST ->',url,payload)}catch(_){}
    var resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!resp.ok){var txt='';try{txt=await resp.text()}catch(_){}
      throw new Error('FN_FAIL_'+resp.status+' '+txt);}return await resp.blob();}
  function onConsoleWarn(err){try{console.warn('[SMARTEL] server PDF failed, fallback to local print view.',err)}catch(_){}} 
  async function onSave(e){if(e&&e.preventDefault)e.preventDefault();try{if(typeof window.validate==='function'&&!window.validate()){try{window.scrollTo({top:0,behavior:'smooth'})}catch(_){}
        return;}try{var blob=await requestServerPDF();var u=URL.createObjectURL(blob);var a=Object.assign(document.createElement('a'),{href:u,download:'smartel_form.pdf'});document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},600000);}catch(err){onConsoleWarn(err);var html=buildLocalPrintableHTML();var w=window.open('about:blank','_blank','noopener');w.document.open();w.document.write(html);w.document.close();w.focus();}}catch(e2){alert('PDF 저장 중 오류가 발생했습니다.');console.error(e2);}}
  async function onPrint(e){if(e&&e.preventDefault)e.preventDefault();try{if(typeof window.validate==='function'&&!window.validate()){try{window.scrollTo({top:0,behavior:'smooth'})}catch(_){}
        return;}try{var blob=await requestServerPDF();var u=URL.createObjectURL(blob);var w=window.open('', '_blank','noopener');if(!w){var a=Object.assign(document.createElement('a'),{href:u,download:'smartel_form.pdf'});document.body.appendChild(a);a.click();a.remove();}else{w.document.write('<!doctype html><meta charset=\"utf-8\"><title>SMARTEL 신청서</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style><iframe id=\"pv\" src=\"'+u+'\"></iframe>');w.document.close();}setTimeout(function(){URL.revokeObjectURL(u)},600000);}catch(err){onConsoleWarn(err);var html=buildLocalPrintableHTML();var w=window.open('about:blank','_blank','noopener');w.document.open();w.document.write(html);w.document.close();w.focus();w.print();}}catch(e2){alert('인쇄 중 오류가 발생했습니다.');console.error(e2);}}
  function once(el,type,fn){if(!el||el.__smartelBound)return;el.addEventListener(type,fn,{passive:false});el.__smartelBound=true;}
  function bind(){var save=document.getElementById('saveBtn')||document.getElementById('pdfBtn')||qsa('button,a,[role="button"]').find(b=>/^(PDF\s*저장|Save\s*PDF)$/i.test((b.textContent||'').trim()));
    var print=document.getElementById('printBtn')||qsa('button,a,[role="button"]').find(b=>/^(인쇄|Print)$/i.test((b.textContent||'').trim()));
    if(save){try{save.type='button'}catch(_){ }once(save,'click',onSave);} if(print){try{print.type='button'}catch(_){ }once(print,'click',onPrint);} console.log('[SMARTEL] binder ready. url=',fnUrl());}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
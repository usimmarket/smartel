/*! post-submit-smartel v1.0 (ktwelcome pattern) */
(function(){
  'use strict';
  if (window.__POST_SUBMIT_SMARTEL__) return; window.__POST_SUBMIT_SMARTEL__=true;
  var ABS_ENDPOINT = 'https://smartel.netlify.app/.netlify/functions/generate_pdf';

  function toJSON(form){
    var data = {};
    try{
      var fd = new FormData(form);
      fd.forEach(function(v,k){ data[k]=v; });
    }catch(e){}
    var birthIn = document.getElementById('birth_in');
    if (birthIn) data.birth = (birthIn.value||'').replace(/\D/g,'');
    var yy = document.getElementById('cardYY') || document.getElementById('card_exp_year');
    var mm = document.getElementById('cardMM') || document.getElementById('card_exp_month');
    if (yy && mm) data.autopay_exp = ((yy.value||'').trim()+'/'+(mm.value||'').trim());
    return data;
  }

  function openPrintPopup(){ return window.open('', 'smartel-print', 'width=1024,height=768'); }
  function writeShell(win){
    if (!win) return;
    try{
      if (win.document && win.document.getElementById('pv')) return;
      var html = '<!doctype html><html><head><meta charset="utf-8"><title>Print</title>' +
                 '<style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh}</style>' +
                 '</head><body>' +
                 '<iframe id="pv" type="application/pdf" allow="fullscreen"></iframe>' +
                 '<script>' +
                 'const f=document.getElementById("pv");' +
                 'f.addEventListener("load",function(){try{(f.contentWindow||window).focus();(f.contentWindow||window).print();}catch(e){try{window.focus();window.print();}catch(_e){}}});' +
                 'window.addEventListener("afterprint",function(){setTimeout(function(){window.close();},400);});' +
                 '<\/script>' +
                 '</body></html>';
      win.document.open(); win.document.write(html); win.document.close();
    }catch(e){}
  }

  async function generateBlob(payload){
    var res = await fetch(ABS_ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload||{})
    });
    if (!res.ok){ var t=''; try{t=await res.text();}catch(_){}
      throw new Error('HTTP '+res.status+' '+t);
    }
    var blob = await res.blob();
    if (!blob || !blob.size) throw new Error('Empty PDF');
    return blob;
  }

  function modeFrom(actionUrl){
    try{ var u=new URL(actionUrl, location.href); return (u.searchParams.get('mode')||'').toLowerCase()==='print'?'print':'save'; }
    catch(e){ return 'save'; }
  }

  function attach(){
    var form = document.getElementById('form');
    if (!form) return;
    var lastSubmitter = null;
    form.addEventListener('click', function(e){
      var el = e.target; if(!el) return;
      if (el.type==='submit' || el.getAttribute('type')==='submit'){ lastSubmitter = el; }
    }, true);

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      var sub = e.submitter || lastSubmitter || form.querySelector('[type="submit"]');
      var actionUrl = (sub && sub.formAction) ? sub.formAction : form.getAttribute('action') || ABS_ENDPOINT;
      var mode = modeFrom(actionUrl);
      try{
        var w=null;
        if (mode==='print'){
          w=openPrintPopup();
          if(!w){ alert('팝업이 차단되었습니다. 주소창 오른쪽 팝업 아이콘에서 허용해 주세요.'); return; }
          writeShell(w);
        }
        var payload = toJSON(form);
        var blob = await generateBlob(payload);
        var url = URL.createObjectURL(blob);
        if (mode==='print'){
          try{ var f=w && w.document.getElementById('pv'); if(f) f.src=url; else if(w) w.location.href=url; else window.open(url,'_blank'); }
          catch(_){ if(w) w.location.href=url; else window.open(url,'_blank'); }
          setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
        }else{
          var a=document.createElement('a'); a.href=url; a.download='smartel_form.pdf';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
        }
      }catch(err){
        console.error('[post-submit-smartel]', err);
        alert('PDF 생성 오류: '+(err && err.message? err.message: err));
      }
    });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', attach, {once:true});
  else attach();
})();
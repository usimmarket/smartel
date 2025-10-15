(function(){
  'use strict';
  // Force absolute Netlify Functions URL when not on smartel.netlify.app
  if (window.__SMARTEL_HOST_PATCH__) return; window.__SMARTEL_HOST_PATCH__ = true;

  var NETLIFY_BASE = 'https://smartel.netlify.app';
  var REL = '/.netlify/functions/generate_pdf';

  function isOnNetlify(){
    try { return /smartel\.netlify\.app$/i.test(location.hostname); } catch(_){ return false; }
  }

  // Patch fnUrl() if present, else define
  (function patchFnUrl(){
    var absolute = NETLIFY_BASE + REL;
    try{
      var old = window.fnUrl;
      window.fnUrl = function(){
        if (isOnNetlify()) return REL;  // on Netlify, keep relative
        return absolute;                 // elsewhere (e.g., GitHub Pages), force absolute
      };
      window.fnUrl.__patched = true;
      window.fnUrl.__orig = old;
    }catch(_){
      window.fnUrl = function(){ return isOnNetlify()? REL : absolute; };
    }
  })();

  // Patch generatePDFBlob() if it exists and posts to relative path
  (function patchGenerate(){
    if (typeof window.generatePDFBlob !== 'function') return;
    var orig = window.generatePDFBlob;
    window.generatePDFBlob = async function(){
      var out = await orig.apply(this, arguments);
      // If the page's impl returned a Blob already, pass through
      if (out instanceof Blob) return out;

      // If the page's impl internally tries to POST to relative path, we can't intercept here.
      // As a fallback, if out is falsy or looks wrong, we will perform our own POST.
      if (!out || (out && out.size === 0)){
        var url = (isOnNetlify()? REL : (NETLIFY_BASE + REL));
        var form = document.getElementById('form');
        var data = {};
        if (form){ try{ data = Object.fromEntries(new FormData(form).entries()); }catch(_){ } }
        // best-effort normalized fields
        var birthIn = document.getElementById('birth_in');
        if (birthIn) data.birth = (birthIn.value||'').replace(/\D/g,'');
        var yy = document.getElementById('cardYY') || document.getElementById('card_exp_year');
        var mm = document.getElementById('cardMM') || document.getElementById('card_exp_month');
        if (yy && mm) data.autopay_exp = ((yy.value||'').trim()+'/'+(mm.value||'').trim());
        var res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (!res.ok) throw new Error('Netlify function error: '+res.status);
        return await res.blob();
      }
      return out;
    };
    window.generatePDFBlob.__patched = true;
    window.generatePDFBlob.__orig = orig;
  })();

  console.log('[host-patch] Netlify base forced when off Netlify host');
})();
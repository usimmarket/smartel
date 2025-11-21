(function(){
  'use strict';
  if (window.__SMARTEL_TRANSPORT_MAP__) return; window.__SMARTEL_TRANSPORT_MAP__ = true;

  var ABS_BASE   = 'https://smartel.netlify.app'; // Netlify site base (user-confirmed)
  var REL_PREFIX = '/.netlify/functions/';        // Adjust if your function prefix differs

  function onNetlifyHost(){
    try { return /smartel\.netlify\.app$/i.test(location.hostname); } catch(_) { return false; }
  }
  function normalizeToAbs(input){
    try{
      var u = new URL(input, location.href); // resolves ./ and ../
      if (!onNetlifyHost() && u.pathname.startsWith(REL_PREFIX)){
        return ABS_BASE + u.pathname + (u.search || '');
      }
      return input;
    }catch(_){ return input; }
  }

  // fetch rewrite
  var _fetch = window.fetch;
  window.fetch = function(input, init){
    try{
      if (typeof input === 'string'){
        input = normalizeToAbs(input);
      } else if (input && typeof input.url === 'string'){
        var abs = normalizeToAbs(input.url);
        if (abs !== input.url) input = new Request(abs, input);
      }
    }catch(e){ console.warn('[transport-map] fetch rewrite skipped:', e); }
    return _fetch.call(this, input, init);
  };

  // XHR rewrite
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    try{ if (typeof url === 'string') url = normalizeToAbs(url); }catch(_) {}
    var args = Array.prototype.slice.call(arguments);
    args[1] = url;
    return _open.apply(this, args);
  };

  console.log('[transport-map] fetch + XHR URL rewrite active (off Netlify host ->', ABS_BASE, ')');
})();
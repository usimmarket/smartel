(function(){
  'use strict';
  if (window.__SMARTEL_FETCH_MAP_V2__) return; window.__SMARTEL_FETCH_MAP_V2__ = true;

  var REL_PREFIX = '/.netlify/functions/';
  var ABS_BASE   = 'https://smartel.netlify.app'; // change here if your Netlify domain differs

  function onNetlifyHost(){
    try{ return /smartel\.netlify\.app$/i.test(location.hostname); }catch(_){ return false; }
  }

  function toAbsolute(url){
    if (!url) return url;
    if (onNetlifyHost()) return url;                 // keep relative on Netlify
    if (typeof url !== 'string') return url;
    if (url.startsWith(REL_PREFIX)) return ABS_BASE + url;
    return url;
  }

  var _fetch = window.fetch;
  window.fetch = function(input, init){
    try{
      if (typeof input === 'string'){
        input = toAbsolute(input);
      } else if (input && typeof input.url === 'string'){
        // It's a Request object
        var abs = toAbsolute(input.url);
        if (abs !== input.url){
          // Rebuild a new Request with same options (clone)
          input = new Request(abs, input);
        }
      }
    }catch(e){
      console.warn('[fetch-map v2] rewrite skipped:', e);
    }
    return _fetch.call(this, input, init);
  };

  console.log('[fetch-map v2] Request/URL rewrite active (off Netlify host)');
})();
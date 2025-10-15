(function(){
  'use strict';
  if (window.__SMARTEL_FETCH_MAP_V3__) return; window.__SMARTEL_FETCH_MAP_V3__ = true;

  var ABS_BASE = 'https://smartel.netlify.app'; // Netlify site base
  var REL_PREFIX = '/.netlify/functions/';

  function onNetlifyHost(){
    try{ return /smartel\.netlify\.app$/i.test(location.hostname); }catch(_){ return false; }
  }

  function normalizeToAbs(input){
    // input: string URL (possibly './.netlify/functions/...') or absolute/relative
    try{
      var u = new URL(input, location.href); // resolves ./ and ../ against current page
      // Only rewrite when not on Netlify host and the resolved PATH starts with REL_PREFIX
      if (!onNetlifyHost() && u.pathname.startsWith(REL_PREFIX)){
        return ABS_BASE + u.pathname + (u.search || '');
      }
      return input; // no change
    }catch(_){
      return input;
    }
  }

  var _fetch = window.fetch;
  window.fetch = function(input, init){
    try{
      if (typeof input === 'string'){
        input = normalizeToAbs(input);
      } else if (input && typeof input.url === 'string'){
        var abs = normalizeToAbs(input.url);
        if (abs !== input.url){
          // rebuild Request with same options; Request already contains method/headers/body
          input = new Request(abs, input);
        }
      }
    }catch(e){
      console.warn('[fetch-map v3] rewrite skipped:', e);
    }
    return _fetch.call(this, input, init);
  };

  console.log('[fetch-map v3] Relative Netlify function URLs normalized & rewritten (off Netlify host)');
})();
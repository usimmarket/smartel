(function(){
  'use strict';
  if (window.__SMARTEL_FETCH_MAP__) return; window.__SMARTEL_FETCH_MAP__ = true;
  var REL = '/.netlify/functions/generate_pdf';
  var ABS = 'https://smartel.netlify.app/.netlify/functions/generate_pdf';
  function onNetlifyHost(){
    try{ return /smartel\.netlify\.app$/i.test(location.hostname); }catch(_){ return false; }
  }
  var _fetch = window.fetch;
  window.fetch = function(input, init){
    try{
      var url = (typeof input === 'string') ? input : (input && input.url);
      if (!onNetlifyHost() && url === REL){
        input = ABS;
      }
    }catch(_){}
    return _fetch.apply(this, arguments);
  };
  console.log('[fetch-map] Relative function URL rewritten when off Netlify host');
})();
<script>
(function(){
  'use strict';
  if (window.__SMARTEL_TRANSPORT_MAP__) return; window.__SMARTEL_TRANSPORT_MAP__ = true;

  var ABS_BASE   = 'https://smartel.netlify.app'; // Netlify 사이트 도메인
  var REL_PREFIX = '/.netlify/functions/';        // 함수 경로 접두사 (배포와 다르면 여기만 바꿔주세요)

  function onNetlifyHost(){
    try { return /smartel\.netlify\.app$/i.test(location.hostname); } catch(_) { return false; }
  }
  function normalizeToAbs(input){
    try{
      var u = new URL(input, location.href); // './', '../' 정규화
      if (!onNetlifyHost() && u.pathname.startsWith(REL_PREFIX)){
        return ABS_BASE + u.pathname + (u.search || '');
      }
      return input;
    }catch(_){ return input; }
  }

  // fetch 재작성
  var _fetch = window.fetch;
  window.fetch = function(input, init){
    try{
      if (typeof input === 'string'){
        input = normalizeToAbs(input);
      } else if (input && typeof input.url === 'string'){
        var abs = normalizeToAbs(input.url);
        if (abs !== input.url) input = new Request(abs, input); // Request 복제
      }
    }catch(e){ console.warn('[transport-map] fetch rewrite skipped:', e); }
    return _fetch.call(this, input, init);
  };

  // XHR 재작성
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    try{ if (typeof url === 'string') url = normalizeToAbs(url); }catch(_) {}
    // 인자 재구성해서 원본 open 호출
    var args = Array.prototype.slice.call(arguments);
    args[1] = url;
    return _open.apply(this, args);
  };

  console.log('[transport-map] fetch + XHR URL rewrite active (off Netlify host)');
})();
</script>

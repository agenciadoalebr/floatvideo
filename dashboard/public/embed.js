/**
 * embed.js — Loader oficial do widget de vídeo flutuante.
 * Único arquivo que o cliente cola no site (via <script>, GTM, WordPress ou Shopify).
 *
 * Uso:
 * <script>window.FVW_EMBED_KEY = "EMBED_KEY_DO_PROJETO";</script>
 * <script async src="https://SEU-DOMINIO/embed.js"></script>
 *
 * A chave vem de uma variável global definida num <script> inline antes
 * deste — não de um atributo nem da query string da URL. Ferramentas como
 * o Google Tag Manager recriam a tag <script src="...">, e nessa recriação
 * descartam tanto atributos customizados (data-key) quanto a query string
 * do "src". O conteúdo de um <script> inline, porém, nunca é reescrito —
 * é a única forma garantida de passar um valor até aqui.
 */
(function () {
  "use strict";

  var CURRENT_SCRIPT = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf("/embed.js") !== -1) {
          return scripts[i];
        }
      }
      return scripts[scripts.length - 1];
    })();

  var SCRIPT_URL = new URL(CURRENT_SCRIPT.src);
  var EMBED_KEY =
    window.FVW_EMBED_KEY ||
    SCRIPT_URL.searchParams.get("key") ||
    CURRENT_SCRIPT.getAttribute("data-key");
  var SCRIPT_ORIGIN = SCRIPT_URL.origin;
  // O minificado é gerado na build e já traz o CSS dentro. O original
  // fica como reserva: em desenvolvimento ele é o único que existe.
  var PLAYER_BUNDLE_URL = SCRIPT_ORIGIN + "/player.min.js";
  var PLAYER_FALLBACK_URL = SCRIPT_ORIGIN + "/player.js";

  if (!EMBED_KEY) {
    console.error("[FloatingVideoWidget] data-key ausente no <script>.");
    return;
  }

  if (window.__FVW_LOADED__) return;
  window.__FVW_LOADED__ = true;

  function carregar(url, aoFalhar) {
    var s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.defer = true;
    s.onload = function () {
      if (window.FVWPlayer) {
        window.FVWPlayer.boot(EMBED_KEY);
      }
    };
    if (aoFalhar) s.onerror = aoFalhar;
    document.head.appendChild(s);
  }

  function boot() {
    carregar(PLAYER_BUNDLE_URL, function () {
      carregar(PLAYER_FALLBACK_URL);
    });
  }

  if (document.readyState === "complete") {
    boot();
  } else {
    window.addEventListener("load", boot, { once: true });
  }
})();

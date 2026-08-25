/**
 * embed.js — Loader oficial do widget de vídeo flutuante.
 * Este é o único arquivo que o cliente cola no site (via <script>, GTM, WordPress ou Shopify).
 * Objetivo: ser MINÚSCULO, assíncrono, e nunca bloquear o render da página.
 *
 * Uso no site do cliente:
 * <script async src="https://cdn.seudominio.com/embed.js" data-key="EMBED_KEY_DO_PROJETO"></script>
 */
(function () {
  "use strict";

  var CURRENT_SCRIPT = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  var EMBED_KEY = CURRENT_SCRIPT.getAttribute("data-key");
  var API_BASE = "https://api.seudominio.com";
  var PLAYER_BUNDLE_URL = "https://cdn.seudominio.com/player.js";

  if (!EMBED_KEY) {
    console.error("[FloatingVideoWidget] data-key ausente no <script>.");
    return;
  }

  // Evita duplo carregamento se o script for injetado 2x (comum em GTM)
  if (window.__FVW_LOADED__) return;
  window.__FVW_LOADED__ = true;

  function boot() {
    // 1. Busca a config do widget (formato, cor, vídeo, CTA) via API pública, cacheável em CDN.
    fetch(API_BASE + "/v1/widget-config?key=" + encodeURIComponent(EMBED_KEY), {
      method: "GET",
      credentials: "omit",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("config indisponível");
        return res.json();
      })
      .then(function (config) {
        if (!config || config.is_active === false) return;
        loadPlayerBundle(config);
      })
      .catch(function (err) {
        console.warn("[FloatingVideoWidget] falha ao carregar config:", err);
      });
  }

  function loadPlayerBundle(config) {
    var s = document.createElement("script");
    s.src = PLAYER_BUNDLE_URL;
    s.async = true;
    s.defer = true;
    s.onload = function () {
      if (window.FVWPlayer) {
        window.FVWPlayer.init(config);
      }
    };
    document.head.appendChild(s);
  }

  // Não bloqueia: espera o documento estar pronto o suficiente pra não competir com LCP
  if (document.readyState === "complete") {
    boot();
  } else {
    window.addEventListener("load", boot, { once: true });
  }
})();

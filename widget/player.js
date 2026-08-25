/**
 * player.js — Bundle "pesado" do widget, carregado assincronamente pelo embed.js
 * depois que a config chegou. Contém toda a lógica de:
 *  - Montagem do DOM do balão flutuante
 *  - Alternância entre <video> próprio (MP4/WebM via CDN) e YouTube IFrame API
 *  - CTA / captura de lead
 *  - Envio de eventos de analytics
 *
 * Este arquivo é minificado no build final (esbuild/rollup) e servido via CDN.
 */
(function (global) {
  "use strict";

  var API_BASE = "https://api.seudominio.com";
  var YT_API_SRC = "https://www.youtube.com/iframe_api";

  var FVWPlayer = {
    init: function (config) {
      injectStyles();
      var el = buildWidgetDOM(config);
      document.body.appendChild(el);

      // Delay de aparição configurável (ex: só aparece depois de 3s no site)
      var delay = (config.delay_seconds || 0) * 1000;
      setTimeout(function () {
        el.classList.add("fvw-visible");
        trackEvent(config, "impression");
      }, delay);

      wireCloseButton(el, config);
      wireCTA(el, config);

      if (config.video.source_type === "youtube") {
        mountYouTubePlayer(el, config);
      } else {
        mountNativeVideo(el, config);
      }
    },
  };

  // ---------- DOM ----------

  function buildWidgetDOM(config) {
    var wrapper = document.createElement("div");
    wrapper.className = [
      "fvw-wrapper",
      "fvw-shape-" + (config.shape || "round"),
      "fvw-size-" + (config.size || "md"),
      "fvw-pos-" + (config.position || "bottom-right"),
    ].join(" ");
    wrapper.style.setProperty("--fvw-border-color", config.border_color || "#000");

    wrapper.innerHTML =
      '<button class="fvw-close" aria-label="Fechar vídeo">&times;</button>' +
      '<div class="fvw-media-slot"></div>' +
      (config.cta ? buildCTAMarkup(config.cta) : "");

    return wrapper;
  }

  function buildCTAMarkup(cta) {
    if (cta.type === "form") {
      var fields = (cta.form_fields || [])
        .map(function (f) {
          return (
            '<input class="fvw-input" name="' + f.name + '" type="' + (f.type || "text") +
            '" placeholder="' + f.label + '" ' + (f.required ? "required" : "") + " />"
          );
        })
        .join("");
      return (
        '<form class="fvw-cta fvw-cta-form">' + fields +
        '<button type="submit" class="fvw-cta-btn">' + escapeHtml(cta.label) + "</button></form>"
      );
    }
    // link / whatsapp
    return (
      '<a class="fvw-cta fvw-cta-btn" href="' + escapeAttr(cta.target_url) +
      '" target="_blank" rel="noopener noreferrer">' + escapeHtml(cta.label) + "</a>"
    );
  }

  function wireCloseButton(el, config) {
    el.querySelector(".fvw-close").addEventListener("click", function () {
      el.classList.remove("fvw-visible");
      trackEvent(config, "close");
    });
  }

  function wireCTA(el, config) {
    var form = el.querySelector(".fvw-cta-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = {};
        new FormData(form).forEach(function (v, k) {
          data[k] = v;
        });
        submitLead(config, data);
        trackEvent(config, "cta_click");
      });
      return;
    }
    var link = el.querySelector(".fvw-cta-btn");
    if (link && link.tagName === "A") {
      link.addEventListener("click", function () {
        trackEvent(config, "cta_click");
      });
    }
  }

  // ---------- Vídeo próprio (self-hosted, servido via CDN) ----------

  function mountNativeVideo(el, config) {
    var slot = el.querySelector(".fvw-media-slot");
    var video = document.createElement("video");
    video.className = "fvw-video";
    video.playsInline = true;
    video.muted = config.muted_start !== false; // autoplay confiável exige muted
    video.autoplay = config.autoplay !== false;
    video.loop = false;
    video.poster = config.video.thumbnail_url || "";

    // Prioriza WebM (menor, melhor compressão) com fallback para MP4 (compatibilidade)
    if (config.video.webm_url) {
      var srcWebm = document.createElement("source");
      srcWebm.src = config.video.webm_url;
      srcWebm.type = "video/webm";
      video.appendChild(srcWebm);
    }
    if (config.video.mp4_url) {
      var srcMp4 = document.createElement("source");
      srcMp4.src = config.video.mp4_url;
      srcMp4.type = "video/mp4";
      video.appendChild(srcMp4);
    }

    video.addEventListener("playing", function () {
      trackEvent(config, "play");
    }, { once: true });
    video.addEventListener("ended", function () {
      trackEvent(config, "complete");
    });

    // Clique no vídeo desmuta (padrão estilo Sharelo/VideoAsk)
    video.addEventListener("click", function () {
      video.muted = !video.muted;
    });

    slot.appendChild(video);
  }

  // ---------- YouTube (fallback leve, zero storage) ----------

  var ytApiPromise = null;
  function loadYouTubeAPI() {
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise(function (resolve) {
      if (global.YT && global.YT.Player) {
        resolve(global.YT);
        return;
      }
      var prevCallback = global.onYouTubeIframeAPIReady;
      global.onYouTubeIframeAPIReady = function () {
        if (typeof prevCallback === "function") prevCallback();
        resolve(global.YT);
      };
      var tag = document.createElement("script");
      tag.src = YT_API_SRC;
      tag.async = true;
      document.head.appendChild(tag);
    });
    return ytApiPromise;
  }

  function mountYouTubePlayer(el, config) {
    var slot = el.querySelector(".fvw-media-slot");
    var mount = document.createElement("div");
    var mountId = "fvw-yt-" + config.widget_id;
    mount.id = mountId;
    slot.appendChild(mount);

    loadYouTubeAPI().then(function (YT) {
      new YT.Player(mountId, {
        videoId: config.video.youtube_id,
        playerVars: {
          autoplay: config.autoplay !== false ? 1 : 0,
          mute: config.muted_start !== false ? 1 : 0,
          controls: 0,        // esconde controles nativos p/ manter estética "redondinha"
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,  // sem anotações
        },
        events: {
          onReady: function (e) {
            e.target.playVideo();
          },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING) trackEvent(config, "play");
            if (e.data === YT.PlayerState.ENDED) trackEvent(config, "complete");
          },
        },
      });
    });
  }

  // ---------- Analytics & Leads ----------

  function trackEvent(config, eventType) {
    navigator.sendBeacon
      ? navigator.sendBeacon(
          API_BASE + "/v1/events",
          JSON.stringify({
            widget_id: config.widget_id,
            event_type: eventType,
            page_url: location.href,
          })
        )
      : fetch(API_BASE + "/v1/events", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            widget_id: config.widget_id,
            event_type: eventType,
            page_url: location.href,
          }),
        }).catch(function () {});
  }

  function submitLead(config, data) {
    fetch(API_BASE + "/v1/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        widget_id: config.widget_id,
        data: data,
        page_url: location.href,
      }),
    }).catch(function () {});
  }

  // ---------- Utils ----------

  function injectStyles() {
    if (document.getElementById("fvw-styles")) return;
    var link = document.createElement("link");
    link.id = "fvw-styles";
    link.rel = "stylesheet";
    link.href = "https://cdn.seudominio.com/styles.css";
    document.head.appendChild(link);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return (str || "").replace(/"/g, "&quot;");
  }

  global.FVWPlayer = FVWPlayer;
})(window);

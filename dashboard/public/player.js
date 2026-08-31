/**
 * player.js — Lógica principal do widget flutuante. Fala direto com o
 * Supabase (PostgREST) através das RPCs públicas, sem precisar de um
 * backend próprio:
 *   - get_widget_config(p_embed_key)          -> carrega a config
 *   - record_widget_event(...)                -> analytics
 *   - record_widget_lead(...)                 -> captura de lead
 * Essas RPCs são SECURITY DEFINER e só devolvem/gravam exatamente o
 * necessário — a anon key usada aqui é pública por design.
 */
(function (global) {
  "use strict";

  var SUPABASE_URL = "https://shlblslzuyubhutzypid.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobGJsc2x6dXl1Ymh1dHp5cGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjI0MDEsImV4cCI6MjEwMjg5ODQwMX0.4x1jByYqrXG-KXkQo3SvAhIzgYpvTOPuS_KNHDz2-wk";
  var YT_API_SRC = "https://www.youtube.com/iframe_api";
  // Precisa casar com o width/height do iframe recolhido no
  // fvw-styles.css (300%): e o fator que converte "andar 1% do video"
  // em "andar N% da altura do balao".
  var ZOOM = 3;

  function rpc(name, body) {
    return fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  }

  var FVWPlayer = {
    boot: function (embedKey) {
      // Atalho de teste: abrir a pagina com ?fvw_reset na URL apaga a
      // supressao e traz o balao de volta. Sem isso, quem fecha o widget
      // durante um teste precisa achar a chave no localStorage ou abrir
      // uma janela anonima toda vez.
      clearSuppression(embedKey);

      // Se a pessoa já fechou o balão nos últimos dias, não insiste —
      // evita irritar quem visita o site várias vezes.
      if (isSuppressed(embedKey)) return;

      // p_page_url deixa o servidor escolher o video pela regra de
      // pagina. A escolha e feita la, e nao aqui, pra o mesmo criterio
      // valer tambem no registro de evento e de lead.
      rpc("get_widget_config", {
        p_embed_key: embedKey,
        p_origin: location.origin,
        p_page_url: location.href,
      })
        .then(function (res) {
          if (!res.ok) throw new Error("config indisponível");
          return res.json();
        })
        .then(function (config) {
          if (!config || config.is_active === false || !config.video) return;
          FVWPlayer.init(config, embedKey);
        })
        .catch(function (err) {
          console.warn("[FloatingVideoWidget] falha ao carregar config:", err);
        });
    },

    init: function (config, embedKey) {
      ensureViewportMeta();

      // O widget vive dentro de um Shadow DOM: o CSS do site hospedeiro
      // simplesmente não atravessa essa fronteira. Sem isso, qualquer
      // regra genérica do tema (um "button { padding; background;
      // border-radius }" de WordPress/Elementor, por exemplo) pintava e
      // esticava os nossos botões — o X redondo virava uma pílula com a
      // cor do site. Nada de !important nem de disputa de
      // especificidade: o isolamento é real.
      var root = createIsolatedRoot();
      injectStyles(root);

      var backdrop = document.createElement("div");
      backdrop.className = "fvw-backdrop";
      // Estado inicial fixado por JS (não depende do CSS externo terminar
      // de carregar): evita o "flash" de balão grande e sem estilo antes
      // de esconder e só então reaparecer depois do delay.
      backdrop.style.opacity = "0";
      backdrop.style.visibility = "hidden";
      root.appendChild(backdrop);

      var el = buildWidgetDOM(config);
      el.style.position = "fixed";
      el.style.zIndex = "2147483000";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      el.style.transform = "translateY(16px) scale(0.9)";
      root.appendChild(el);

      var delay = (config.delay_seconds || 0) * 1000;
      setTimeout(function () {
        el.classList.add("fvw-visible");
        el.style.opacity = "";
        el.style.pointerEvents = "";
        el.style.transform = "";
        trackEvent(config, "impression");
      }, delay);

      wireCloseButton(el, backdrop, config, embedKey);
      wireExpand(el, backdrop, config);
      wireCTA(el, config);
      wireMuteToggle(el);
      wirePlayToggle(el);
      wireRestartButton(el);
      wireProgressBar(el);
      startProgressLoop(el);

      if (config.video.source_type === "youtube") {
        mountYouTubePlayer(el, config);
      } else {
        mountNativeVideo(el, config);
      }
    },
  };

  // ---------- DOM ----------

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
  }

  // Escolhe os valores de mobile só quando a tela é pequena E o usuário
  // configurou algo específico pra mobile; senão cai de volta pro desktop.
  function effectiveLayout(config) {
    var mobile = isMobileViewport();
    var m = config.mobile || {};
    return {
      size: (mobile && m.size) || config.size || "md",
      position: (mobile && m.position) || config.position || "bottom-right",
      offsetX: mobile && m.offset_x != null ? m.offset_x : (config.offset_x ?? 24),
      offsetY: mobile && m.offset_y != null ? m.offset_y : (config.offset_y ?? 24),
    };
  }

  function buildWidgetDOM(config) {
    var layout = effectiveLayout(config);
    var wrapper = document.createElement("div");
    wrapper.className = [
      "fvw-wrapper",
      "fvw-shape-" + (config.shape || "round"),
      "fvw-size-" + layout.size,
      "fvw-pos-" + layout.position,
    ].join(" ");
    wrapper.style.setProperty("--fvw-border-color", config.border_color || "#000");
    wrapper.style.setProperty("--fvw-offset-x", layout.offsetX + "px");
    wrapper.style.setProperty("--fvw-offset-y", layout.offsetY + "px");
    applyFocalPoint(wrapper, config.video);

    wrapper.innerHTML =
      '<button class="fvw-close" aria-label="Fechar vídeo">&times;</button>' +
      '<button class="fvw-restart" aria-label="Ver do início">↺</button>' +
      '<button class="fvw-mute" aria-label="Ativar som">🔇</button>' +
      '<button class="fvw-play" aria-label="Pausar">❚❚</button>' +
      // Barra de progresso e CTA ficam DENTRO do .fvw-media-slot de
      // proposito: e ele que recorta no formato do balao. Como irmaos do
      // slot, encostados nas bordas, os cantos retos deles escapavam por
      // cima da curva do wrapper (que nao pode ter overflow:hidden, senao
      // corta o botao de fechar). Os dois ja fazem stopPropagation no
      // clique, entao descer um nivel nao dispara o expandir do slot.
      '<div class="fvw-media-slot">' +
      '<div class="fvw-progress"><div class="fvw-progress-fill"></div></div>' +
      (config.cta ? buildCTAMarkup(config.cta) : "") +
      "</div>";

    return wrapper;
  }

  // Enquadramento do video dentro do balao.
  //
  // Video proprio: "object-position" resolve direto, porque o corte e
  // feito pelo object-fit: cover.
  //
  // YouTube: o iframe e esticado a 300% e centralizado pra esconder o
  // letterbox do proprio player. Deslocar o ponto focal ali exige levar
  // em conta essa ampliacao — mover 1% do video equivale a 3% da altura
  // do balao. Sem esse fator, o ajuste pareceria nao fazer quase nada.
  function applyFocalPoint(wrapper, video) {
    var fx = video && video.focal_x != null ? Number(video.focal_x) : 50;
    var fy = video && video.focal_y != null ? Number(video.focal_y) : 50;
    wrapper.style.setProperty("--fvw-focal-x", fx + "%");
    wrapper.style.setProperty("--fvw-focal-y", fy + "%");
    wrapper.style.setProperty("--fvw-iframe-left", 50 + (50 - fx) * ZOOM + "%");
    wrapper.style.setProperty("--fvw-iframe-top", 50 + (50 - fy) * ZOOM + "%");
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
    return (
      '<div class="fvw-cta"><a class="fvw-cta-btn" href="' + escapeAttr(cta.target_url) +
      '" target="_blank" rel="noopener noreferrer">' + escapeHtml(cta.label) + "</a></div>"
    );
  }

  // ---------- Expandir / recolher (estilo "reels") ----------

  function wireExpand(el, backdrop, config) {
    var mediaSlot = el.querySelector(".fvw-media-slot");

    mediaSlot.addEventListener("click", function () {
      if (el.classList.contains("fvw-expanded")) return;
      expand(el, backdrop, config);
    });

    backdrop.addEventListener("click", function () {
      collapse(el, backdrop, config);
    });
  }

  function expand(el, backdrop, config) {
    el.classList.add("fvw-expanded");
    backdrop.classList.add("fvw-visible");
    backdrop.style.opacity = "";
    backdrop.style.visibility = "";
    setMuted(el, false);
    setLoop(el, false);
    // Ao expandir o video sempre segue tocando, entao o botao ja nasce
    // mostrando "pausar".
    setPlayIcon(el, true);
    trackEvent(config, "expand");
    // Ao expandir o video ja vem tocando do balao, entao o evento de
    // "comecou a tocar" pode nao disparar de novo: confere na hora.
    if (estaTocando(el)) maybeTrackPlay(el, config);
  }

  function collapse(el, backdrop, config) {
    el._playTracked = false;
    el.classList.remove("fvw-expanded");
    backdrop.classList.remove("fvw-visible");
    setMuted(el, true);
    setLoop(el, true);
  }

  // Enquanto recolhido (balão), o vídeo fica em loop eterno pra chamar
  // atenção; ao expandir, o loop é desligado pra pessoa assistir o vídeo
  // completo uma vez (o botão de reiniciar cobre quem quiser rever).
  function setLoop(el, loop) {
    var video = el.querySelector(".fvw-video");
    if (video) {
      video.loop = loop;
    } else if (el._ytPlayer && typeof el._ytPlayer.setLoop === "function") {
      try {
        el._ytPlayer.setLoop(loop);
      } catch (e) {}
    }
  }

  // "Vídeo iniciou" so vale com o video ABERTO. No balao recolhido ele
  // toca sozinho e em loop, entao contar ali dava um numero maior que o
  // de impressoes (cada volta do loop disparava um evento) — media
  // repeticao de animacao, nao interesse de quem visita.
  //
  // Uma contagem por abertura: a marca e limpa ao recolher, entao abrir
  // duas vezes conta duas.
  function maybeTrackPlay(el, config) {
    if (!el.classList.contains("fvw-expanded")) return;
    if (el._playTracked) return;
    el._playTracked = true;
    trackEvent(config, "play");
  }

  // Diz se a midia esta de fato rodando agora, seja video nativo ou YouTube.
  function estaTocando(el) {
    var video = el.querySelector(".fvw-video");
    if (video) return !video.paused;
    if (el._ytPlayer && typeof el._ytPlayer.getPlayerState === "function") {
      return el._ytPlayer.getPlayerState() === 1;
    }
    return false;
  }

  // ---------- Som ----------

  function wireMuteToggle(el) {
    var btn = el.querySelector(".fvw-mute");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var video = el.querySelector(".fvw-video");
      var currentlyMuted = video ? video.muted : !!(el._ytPlayer && el._ytPlayer.isMuted());
      setMuted(el, !currentlyMuted);
    });
  }

  function setMuted(el, muted) {
    var video = el.querySelector(".fvw-video");
    if (video) {
      video.muted = muted;
    } else if (el._ytPlayer) {
      if (muted) {
        el._ytPlayer.mute();
      } else {
        el._ytPlayer.unMute();
      }
    }
    var btn = el.querySelector(".fvw-mute");
    if (btn) {
      btn.textContent = muted ? "🔇" : "🔊";
      btn.setAttribute("aria-label", muted ? "Ativar som" : "Silenciar");
    }
  }

  // Play/pause proprio. Existe porque o iframe do YouTube nao recebe
  // cliques (senao o overlay nativo dele aparece por cima do video) —
  // entao a funcao de pausar precisa vir de um botao nosso.
  function wirePlayToggle(el) {
    var btn = el.querySelector(".fvw-play");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var video = el.querySelector(".fvw-video");
      var tocando;
      if (video) {
        tocando = !video.paused;
        if (tocando) {
          video.pause();
        } else {
          video.play().catch(function () {});
        }
      } else if (el._ytPlayer) {
        tocando = el._ytPlayer.getPlayerState() === 1;
        if (tocando) {
          el._ytPlayer.pauseVideo();
        } else {
          el._ytPlayer.playVideo();
        }
      } else {
        return;
      }
      setPlayIcon(el, !tocando);
    });
  }

  function setPlayIcon(el, tocando) {
    var btn = el.querySelector(".fvw-play");
    if (!btn) return;
    btn.textContent = tocando ? "❚❚" : "▶";
    btn.setAttribute("aria-label", tocando ? "Pausar" : "Reproduzir");
  }

  // ---------- Barra de progresso e reiniciar ----------

  // Funciona tanto pro vídeo nativo (evento "timeupdate") quanto pro
  // player do YouTube (que não dispara esse evento) — por isso um polling
  // simples cobre os dois casos com o mesmo código.
  function startProgressLoop(el) {
    setInterval(function () {
      var fill = el.querySelector(".fvw-progress-fill");
      if (!fill) return;
      var duration = 0;
      var currentTime = 0;
      var video = el.querySelector(".fvw-video");
      if (video && video.duration) {
        duration = video.duration;
        currentTime = video.currentTime;
      } else if (el._ytPlayer && typeof el._ytPlayer.getDuration === "function") {
        duration = el._ytPlayer.getDuration() || 0;
        currentTime = el._ytPlayer.getCurrentTime() || 0;
      }
      if (duration > 0) {
        var pct = Math.min(100, (currentTime / duration) * 100);
        fill.style.width = pct + "%";
      }
    }, 250);
  }

  function wireProgressBar(el) {
    var bar = el.querySelector(".fvw-progress");
    bar.addEventListener("click", function (e) {
      e.stopPropagation();
      var rect = bar.getBoundingClientRect();
      var ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      var video = el.querySelector(".fvw-video");
      if (video && video.duration) {
        video.currentTime = ratio * video.duration;
      } else if (el._ytPlayer && typeof el._ytPlayer.getDuration === "function") {
        el._ytPlayer.seekTo(ratio * (el._ytPlayer.getDuration() || 0), true);
      }
    });
  }

  function wireRestartButton(el) {
    el.querySelector(".fvw-restart").addEventListener("click", function (e) {
      e.stopPropagation();
      var video = el.querySelector(".fvw-video");
      if (video) {
        video.currentTime = 0;
        video.play().catch(function () {});
      } else if (el._ytPlayer) {
        el._ytPlayer.seekTo(0, true);
        el._ytPlayer.playVideo();
      }
      var fill = el.querySelector(".fvw-progress-fill");
      if (fill) fill.style.width = "0%";
      setPlayIcon(el, true);
    });
  }

  function wireCloseButton(el, backdrop, config, embedKey) {
    el.querySelector(".fvw-close").addEventListener("click", function (e) {
      e.stopPropagation();
      if (el.classList.contains("fvw-expanded")) {
        collapse(el, backdrop, config);
        return;
      }
      el.classList.remove("fvw-visible");
      backdrop.classList.remove("fvw-visible");
      trackEvent(config, "close");
      // Fechou o balão de vez (não é o "recolher" do vídeo expandido) —
      // não mostra de novo pra essa pessoa por uns dias.
      suppressForDays(embedKey, 7);
    });
  }

  // Guarda no navegador de quem fechou o balão, pra não insistir toda
  // vez que a pessoa volta ao site.
  function suppressForDays(embedKey, days) {
    try {
      localStorage.setItem("fvw_closed_" + embedKey, String(Date.now() + days * 86400000));
    } catch (e) {}
  }

  function clearSuppression(embedKey) {
    try {
      if (location.search.indexOf("fvw_reset") === -1) return;
      localStorage.removeItem("fvw_closed_" + embedKey);
    } catch (e) {}
  }

  function isSuppressed(embedKey) {
    try {
      var until = localStorage.getItem("fvw_closed_" + embedKey);
      return !!until && Date.now() < Number(until);
    } catch (e) {
      return false;
    }
  }

  function wireCTA(el, config) {
    var form = el.querySelector(".fvw-cta-form");
    if (form) {
      form.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = {};
        new FormData(form).forEach(function (v, k) {
          data[k] = v;
        });
        submitLead(config, data);
        // De proposito sem os campos preenchidos: o dataLayer e visivel
        // pra qualquer script da pagina, entao dado de lead nao entra ai.
        trackEvent(config, "cta_click", {
          cta_type: "form",
          cta_label: (config.cta && config.cta.label) || "",
        });
      });
      return;
    }
    var link = el.querySelector("a.fvw-cta-btn");
    if (link) {
      link.addEventListener("click", function (e) {
        e.stopPropagation();
        trackEvent(config, "cta_click", {
          cta_type: (config.cta && config.cta.type) || "link",
          cta_label: (config.cta && config.cta.label) || "",
          cta_url: link.href,
        });
        // CTA de WhatsApp/link não tem formulário, mas o clique em si já
        // é um lead pro negócio (a pessoa demonstrou intenção de
        // contato) — sem isso, esse tipo de CTA nunca aparecia no
        // painel de Leads, só nas Métricas.
        submitLead(config, {
          Ação: config.cta && config.cta.type === "whatsapp" ? "Clique no WhatsApp" : "Clique no link",
          Destino: link.href,
        });
      });
    }
  }

  // ---------- Vídeo próprio (self-hosted, servido via CDN do Supabase Storage) ----------

  function mountNativeVideo(el, config) {
    var slot = el.querySelector(".fvw-media-slot");
    var video = document.createElement("video");
    video.className = "fvw-video";
    video.playsInline = true;
    video.muted = config.muted_start !== false;
    video.autoplay = config.autoplay !== false;
    // Começa em loop (balão recolhido) — desliga automaticamente ao
    // expandir, veja setLoop().
    video.loop = true;
    video.poster = config.video.thumbnail_url || "";

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
      maybeTrackPlay(el, config);
    });
    video.addEventListener("ended", function () {
      trackEvent(config, "complete");
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
    slot.appendChild(mount);

    // Camada transparente por cima do iframe: o YouTube engole cliques
    // dentro do próprio player, então sem isso o clique para expandir
    // nunca chegaria ao listener do wrapper.
    var clickCatcher = document.createElement("div");
    clickCatcher.className = "fvw-click-catcher";
    slot.appendChild(clickCatcher);

    loadYouTubeAPI().then(function (YT) {
      // Passa o elemento em si, não um id: dentro do shadow root o
      // YouTube não acharia o id via document.getElementById.
      new YT.Player(mount, {
        videoId: config.video.youtube_id,
        playerVars: {
          autoplay: config.autoplay !== false ? 1 : 0,
          mute: config.muted_start !== false ? 1 : 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          // Loop de vídeo único no player do YouTube só funciona com
          // "playlist" apontando pro próprio vídeo — começa em loop
          // (balão recolhido) e setLoop(false) desliga isso ao expandir.
          loop: 1,
          playlist: config.video.youtube_id,
          // "origin" é recomendado pela própria documentação do YouTube
          // pra API de postMessage funcionar de forma confiável — sem
          // isso, em alguns navegadores o autoplay via API falha
          // silenciosamente e o player fica "pausado", mostrando o
          // botão de play/pause do próprio YouTube por cima do vídeo.
          origin: location.origin,
        },
        events: {
          onReady: function (e) {
            el._ytPlayer = e.target;
            e.target.playVideo();
          },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING) maybeTrackPlay(el, config);
            if (e.data === YT.PlayerState.ENDED) trackEvent(config, "complete");
            // Enquanto recolhido (balão), o vídeo nunca deve ficar
            // parado — se pausar por qualquer motivo (autoplay
            // bloqueado, transição do loop, etc.), volta a tocar na
            // hora, pra nunca aparecer o botão de pause do YouTube por
            // cima do balão.
            if (e.data === YT.PlayerState.PAUSED && !el.classList.contains("fvw-expanded")) {
              e.target.playVideo();
            }
          },
        },
      });
    });
  }

  // ---------- Analytics & Leads (via RPC pública do Supabase) ----------

  function trackEvent(config, eventType, extra) {
    rpc("record_widget_event", {
      p_widget_id: config.widget_id,
      p_event_type: eventType,
      p_page_url: location.href,
      p_session_id: getSessionId(),
    }).catch(function () {});

    pushToDataLayer(config, eventType, extra);
  }

  // Empurra o evento pro dataLayer da pagina, que e por onde o Google Tag
  // Manager escuta. Assim o cliente marca "clique no WhatsApp" como
  // conversao no Google Ads / GA4 sem precisar de codigo extra no site:
  // basta um gatilho de Evento personalizado no proprio GTM.
  //
  // Se nao houver GTM na pagina, o array so acumula e nada acontece — o
  // dataLayer e um array comum, nao depende do GTM existir.
  function pushToDataLayer(config, eventType, extra) {
    try {
      var dl = (global.dataLayer = global.dataLayer || []);
      var payload = {
        event: "floatvideo_" + eventType,
        floatvideo: {
          widget_id: config.widget_id,
          page_url: location.href,
          video:
            config.video && config.video.source_type === "youtube"
              ? "youtube:" + config.video.youtube_id
              : "upload",
        },
      };
      if (extra) {
        for (var k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k)) {
            payload.floatvideo[k] = extra[k];
          }
        }
      }
      dl.push(payload);
    } catch (e) {}
  }

  function submitLead(config, data) {
    rpc("record_widget_lead", {
      p_widget_id: config.widget_id,
      p_data: data,
      p_page_url: location.href,
      // Manda a sessão pra RPC poder limitar quantos envios a mesma
      // pessoa faz (proteção simples contra bot martelando o formulário).
      p_session_id: getSessionId(),
    }).catch(function () {});
  }

  function getSessionId() {
    try {
      var key = "fvw_session_id";
      var id = sessionStorage.getItem(key);
      if (!id) {
        id = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  // ---------- Utils ----------

  // Sem <meta name="viewport"> o celular renderiza a página inteira como se
  // fosse desktop (~980px) e depois espreme tudo pra caber na tela — nesse
  // caso vw/vh e o media query de mobile do CSS nunca "veem" a largura real
  // do aparelho, e a bolha e o vídeo expandido saem minúsculos mesmo com o
  // CSS certo. Alguns sites de cliente já têm essa tag, mas nem todos —
  // então garantimos aqui, sem sobrescrever se já existir uma.
  function ensureViewportMeta() {
    if (document.querySelector('meta[name="viewport"]')) return;
    var meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    document.head.appendChild(meta);
  }

  // Cria a raiz isolada onde o widget inteiro vive. Devolve o shadow root
  // quando o navegador suporta; se não suportar, cai no <body> e o widget
  // segue funcionando (só volta a ficar sujeito ao CSS do site).
  function createIsolatedRoot() {
    var host = document.createElement("div");
    host.className = "fvw-host";
    // "all: initial" corta a herança vinda do site (fonte, cor,
    // line-height, text-transform...). O que é herdável atravessa o
    // shadow boundary pelo host, então zerar aqui é o que impede, por
    // exemplo, um "text-transform: uppercase" global de chegar nos
    // nossos botões.
    host.setAttribute("style", "all: initial;");
    document.body.appendChild(host);

    if (typeof host.attachShadow !== "function") return host;
    return host.attachShadow({ mode: "open" });
  }

  function injectStyles(root) {
    // Dentro do shadow root o <link> é local: não polui o site e não
    // pode ser sobrescrito por ele.
    var doc = root.getElementById ? root : document;
    if (doc.getElementById && doc.getElementById("fvw-styles")) return;
    var link = document.createElement("link");
    link.id = "fvw-styles";
    link.rel = "stylesheet";
    link.href = getScriptOrigin() + "/fvw-styles.css";
    root.appendChild(link);
  }

  function getScriptOrigin() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf("/player.js") !== -1) {
        return new URL(scripts[i].src).origin;
      }
    }
    return "";
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

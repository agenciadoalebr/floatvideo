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
          // A supressao e por video, entao so da pra consultar depois de
          // saber qual video esta pagina pediu: quem fechou o video de um
          // produto continua vendo o dos outros.
          if (isSuppressed(embedKey, config.video.id)) return;
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

      agendarAparicao(config, function (gatilho) {
        // O vídeo só é carregado agora, e não no load da página. Para o
        // YouTube isso é o que mais pesa: a API dele são centenas de KB
        // que antes desciam junto com a loja abrindo, mesmo quando o
        // balão só ia aparecer 8 segundos depois — ou nunca, no gatilho
        // de saída. Aqui, o download acontece durante a animação de
        // entrada do balão.
        montarVideo(el, config);

        el.classList.add("fvw-visible");
        el.style.opacity = "";
        el.style.pointerEvents = "";
        el.style.transform = "";
        // Qual gatilho trouxe o balao vai junto do evento: e o que
        // permite comparar "apareceu na saida" com "apareceu no tempo"
        // sem criar um evento novo pra cada modo.
        trackEvent(config, "impression", { gatilho: gatilho });
      }, function () {
        montarVideo(el, config);
      });

      wireCloseButton(el, backdrop, config, embedKey);
      wireExpand(el, backdrop, config);
      wireCTA(el, backdrop, config, root);
      wireMuteToggle(el);
      wirePlayToggle(el);
      wireRestartButton(el);
      wireProgressBar(el);
      startProgressLoop(el, config);

    },
  };

  function montarVideo(el, config) {
    if (el._videoMontado) return;
    el._videoMontado = true;
    if (config.video.source_type === "youtube") {
      mountYouTubePlayer(el, config);
    } else {
      mountNativeVideo(el, config);
    }
  }

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
    // Cor do botao de acao, escolhida no painel e valida pra qualquer
    // tipo de CTA. O texto se ajusta por contraste: sobre um amarelo,
    // por exemplo, o branco sumiria.
    var corCta = config.cta_color || "#25d366";
    wrapper.style.setProperty("--fvw-cta-bg", corCta);
    wrapper.style.setProperty("--fvw-cta-fg", corDeTextoPara(corCta));
    wrapper.style.setProperty("--fvw-offset-x", layout.offsetX + "px");
    wrapper.style.setProperty("--fvw-offset-y", layout.offsetY + "px");
    applyFocalPoint(wrapper, config.video);

    wrapper.innerHTML =
      '<button class="fvw-close" aria-label="Fechar vídeo">&times;</button>' +
      // Os tres controles do video ficam juntos numa barra so; o fechar
      // segue separado, como badge na borda do balao.
      '<div class="fvw-controls">' +
      '<button class="fvw-play" aria-label="Pausar">❚❚</button>' +
      '<button class="fvw-mute" aria-label="Ativar som">🔇</button>' +
      '<button class="fvw-restart" aria-label="Ver do início">↺</button>' +
      "</div>" +
      // Barra de progresso e CTA ficam DENTRO do .fvw-media-slot de
      // proposito: e ele que recorta no formato do balao. Como irmaos do
      // slot, encostados nas bordas, os cantos retos deles escapavam por
      // cima da curva do wrapper (que nao pode ter overflow:hidden, senao
      // corta o botao de fechar). Os dois ja fazem stopPropagation no
      // clique, entao descer um nivel nao dispara o expandir do slot.
      '<div class="fvw-media-slot">' +
      // Miniatura primeiro: ela e o que a pessoa ve enquanto o video
      // carrega. Sem isso o balao entra na tela como um circulo chapado
      // da cor da borda — preto num cliente, branco em outro — e so
      // depois vira video.
      posterMarkup(config.video) +
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
  function posterMarkup(video) {
    if (!video || !video.thumbnail_url) return "";
    return (
      '<div class="fvw-poster" style="background-image:url(' +
      escapeAttr(video.thumbnail_url).replace(/[()]/g, encodeURIComponent) +
      ')"></div>'
    );
  }

  // Some com a miniatura assim que ha imagem de verdade por cima. Fica um
  // instante depois do "tocando" porque o primeiro quadro do YouTube
  // demora a pintar mesmo depois de o player dizer que comecou.
  function esconderPoster(el) {
    var poster = el.querySelector(".fvw-poster");
    if (poster) setTimeout(function () { poster.style.opacity = "0"; }, 300);
  }

  function applyFocalPoint(wrapper, video) {
    var fx = video && video.focal_x != null ? Number(video.focal_x) : 50;
    var fy = video && video.focal_y != null ? Number(video.focal_y) : 50;
    wrapper.style.setProperty("--fvw-focal-x", fx + "%");
    wrapper.style.setProperty("--fvw-focal-y", fy + "%");
    wrapper.style.setProperty("--fvw-iframe-left", 50 + (50 - fx) * ZOOM + "%");
    wrapper.style.setProperty("--fvw-iframe-top", 50 + (50 - fy) * ZOOM + "%");
  }

  // Os campos de cada formulario sao fixos, definidos aqui e nao no
  // banco: sao dois formatos com proposito claro, e deixar a lista
  // configuravel so adicionaria uma tela de montagem de formulario que
  // ninguem pediu.
  var CAMPOS = {
    whatsapp_form: [
      { name: "Nome", type: "text", required: true },
      { name: "Telefone", type: "tel", required: true },
    ],
    form: [
      { name: "Nome", type: "text", required: true },
      { name: "Telefone", type: "tel", required: true },
      { name: "E-mail", type: "email", required: true },
      { name: "Assunto", type: "text", required: false },
      { name: "Mensagem", type: "textarea", required: false },
    ],
  };

  // Icones do cartao. Sao caminhos SVG inline: um <img> externo pediria
  // outra requisicao e ficaria sujeito ao CSP do site do cliente.
  var ICONES = {
    whatsapp:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34M12.05 21.8h-.01c-1.77 0-3.51-.48-5.03-1.38l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.9-9.88 9.9"/></svg>',
    carrinho:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4m10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4M6.2 15h11.1c.7 0 1.3-.4 1.6-1l3-5.5A1 1 0 0 0 21 7H6.3l-.7-3H2v2h2.2l2.9 12.4A2 2 0 0 0 9 20h11v-2H9.3z"/></svg>',
    balao:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2M7 9h10v2H7zm0-4h10v2H7zm0 8h7v2H7z"/></svg>',
    link:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3zM5 5h5V3H3v18h18v-7h-2v5H5z"/></svg>',
  };

  function iconeDoCta(tipo) {
    if (tipo === "whatsapp" || tipo === "whatsapp_form") return ICONES.whatsapp;
    if (tipo === "buy") return ICONES.carrinho;
    if (tipo === "link") return ICONES.link;
    return ICONES.balao;
  }

  // Miolo do cartao: circulo colorido com o icone + as duas linhas de
  // texto. A segunda linha e opcional; sem ela o cartao fica de uma
  // linha so, e nao com um vazio embaixo do titulo.
  function conteudoCartao(cta) {
    return (
      '<span class="fvw-cta-icone">' + iconeDoCta(cta.type) + "</span>" +
      '<span class="fvw-cta-textos">' +
      '<span class="fvw-cta-titulo">' + escapeHtml(cta.label) + "</span>" +
      (cta.sublabel
        ? '<span class="fvw-cta-sub">' + escapeHtml(cta.sublabel) + "</span>"
        : "") +
      "</span>"
    );
  }

  function buildCTAMarkup(cta) {
    if (cta.type === "none") return "";

    // Formularios nao ficam mais dentro do video: o CTA e sempre um
    // botao, e o formulario abre num modal por cima. Empilhar campos
    // sobre o video comia a imagem justamente enquanto a pessoa assiste,
    // e num balao pequeno nao sobrava espaco pra cinco campos.
    // Cartao: fundo claro, icone redondo na cor escolhida e duas linhas
    // de texto. Chama mais atencao que a barra chapada e nao come tanto
    // do video. A barra solida continua disponivel no painel.
    var cartao = cta.button_style !== "solid";
    var classes = "fvw-cta-btn" + (cartao ? " fvw-cta-card" : "");
    // As classes de sempre continuam ai: e por elas que o wireCTA
    // encontra o botao, seja qual for o estilo.
    var miolo = cartao ? conteudoCartao(cta) : escapeHtml(cta.label);

    if (CAMPOS[cta.type]) {
      return (
        '<div class="fvw-cta"><button type="button" class="' + classes + '">' +
        miolo + "</button></div>"
      );
    }

    // Comprar tambem e botao, e nao link: o destino nao e outra pagina, e
    // o proprio botao de compra que ja existe nesta.
    if (cta.type === "buy") {
      return (
        '<div class="fvw-cta"><button type="button" class="' + classes +
        ' fvw-cta-comprar">' + miolo + "</button></div>"
      );
    }

    return (
      '<div class="fvw-cta"><a class="' + classes + '" href="' +
      escapeAttr(cta.target_url) +
      '" target="_blank" rel="noopener noreferrer">' + miolo + "</a></div>"
    );
  }

  // Modal do formulario. Fica fora do balao pra nao herdar o recorte
  // (circulo/retangulo) nem o tamanho dele.
  function buildFormModal(config) {
    var cta = config.cta;
    var campos = CAMPOS[cta.type] || [];
    var ehWhats = cta.type === "whatsapp_form";

    var inputs = campos
      .map(function (f) {
        var req = f.required ? "required" : "";
        if (f.type === "textarea") {
          return (
            '<textarea class="fvw-input" name="' + f.name +
            '" rows="3" placeholder="' + f.name + '" ' + req + "></textarea>"
          );
        }
        if (f.type === "tel") {
          // O +55 fica fixo ao lado, e nao dentro do campo, pra ninguem
          // apagar sem querer nem digitar o pais de novo.
          return (
            '<div class="fvw-tel"><span class="fvw-tel-ddi">+55</span>' +
            '<input class="fvw-input" name="' + f.name +
            '" type="tel" inputmode="numeric" placeholder="(11) 99999-9999" ' +
            req + " /></div>"
          );
        }
        return (
          '<input class="fvw-input" name="' + f.name +
          '" type="' + f.type + '" placeholder="' + f.name + '" ' + req + " />"
        );
      })
      .join("");

    var modal = document.createElement("div");
    // Dois visuais: o de WhatsApp imita a cara do aplicativo (fundo
    // bege, balao de mensagem, botao verde) porque a pessoa esta indo
    // pra la mesmo. O formulario comum nao vai pro WhatsApp, entao
    // usa cartao branco e a cor da marca do cliente.
    modal.className =
      "fvw-modal " + (ehWhats ? "fvw-modal-whats" : "fvw-modal-padrao");
    // A cor da marca precisa ser repetida aqui: ela e definida no balao,
    // e o modal vive fora dele (irmao no shadow root), entao nao herda.
    var cor = config.border_color || "#111";
    modal.style.setProperty("--fvw-border-color", cor);
    // Texto do cabecalho e do botao conforme a cor de fundo. Sem isto,
    // uma cor de marca clara (o widget da Agencia do Ale usa #cdd9e4)
    // ficava com texto branco por cima: parecia desbotado e o rotulo
    // sumia. A escolha e por luminancia, nao no olho.
    modal.style.setProperty("--fvw-modal-fg", corDeTextoPara(cor));
    // Idem pro botao de enviar: mesma cor do botao do balao, pra pessoa
    // reconhecer que e a continuacao do que ela clicou.
    var corCta = config.cta_color || "#25d366";
    modal.style.setProperty("--fvw-cta-bg", corCta);
    modal.style.setProperty("--fvw-cta-fg", corDeTextoPara(corCta));
    modal.innerHTML =
      '<div class="fvw-modal-card">' +
      '<div class="fvw-modal-head">' +
      "<div>" +
      '<p class="fvw-modal-title">' + escapeHtml(config.project_name || "Fale conosco") + "</p>" +
      '<p class="fvw-modal-sub">' +
      (ehWhats ? "Atendimento via WhatsApp" : "Envie sua mensagem") +
      "</p>" +
      "</div>" +
      '<button type="button" class="fvw-modal-close" aria-label="Fechar">&times;</button>' +
      "</div>" +
      '<div class="fvw-modal-body">' +
      '<p class="fvw-modal-intro">' +
      (ehWhats
        ? "Informe seus dados abaixo para falar com nossa equipe pelo WhatsApp."
        : "Preencha os campos abaixo e retornaremos em breve.") +
      "</p>" +
      '<form class="fvw-cta-form">' + inputs +
      '<button type="submit" class="fvw-cta-btn">' + escapeHtml(cta.label) + "</button>" +
      "</form>" +
      '<p class="fvw-modal-foot">Seus dados são usados apenas para o seu atendimento.</p>' +
      "</div>" +
      "</div>";
    return modal;
  }

  // Preto ou branco, o que ler melhor sobre a cor dada. Usa a formula de
  // luminancia relativa do WCAG: o olho enxerga verde bem mais que azul,
  // entao uma media simples dos canais erraria em cores como amarelo.
  function corDeTextoPara(hex) {
    var m = String(hex).replace("#", "");
    if (m.length === 3) {
      m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    }
    if (m.length !== 6) return "#fff";
    var canal = function (i) {
      var c = parseInt(m.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    var lum = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
    return lum > 0.45 ? "#111" : "#fff";
  }

  // Mascara de telefone brasileiro: (11) 99999-9999, aceitando fixo de 8
  // digitos. Feita na digitacao pra pessoa ver o formato enquanto
  // escreve, em vez de descobrir que errou so ao enviar.
  function aplicarMascaraTelefone(input) {
    input.addEventListener("input", function (e) {
      var d = input.value.replace(/\D/g, "").slice(0, 11);

      // Sem isto o backspace trava: o cursor come um caractere da
      // mascara — o ")" ou o espaco — e a formatacao recria na hora,
      // entao o campo nunca encolhe.
      var apagando = e && e.inputType && e.inputType.indexOf("delete") === 0;
      if (apagando && /[()\s-]$/.test(input.value)) {
        d = d.slice(0, -1);
      }
      var out = "";
      if (d.length > 0) out = "(" + d.slice(0, 2);
      if (d.length >= 2) out += ") ";
      if (d.length > 2) {
        var corpo = d.length > 10 ? d.slice(2, 7) : d.slice(2, 6);
        out += corpo;
        var fim = d.length > 10 ? d.slice(7) : d.slice(6);
        if (fim) out += "-" + fim;
      }
      input.value = out;
    });
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
    // Comeca do inicio: no balao o video roda em loop o tempo todo, entao
    // ao expandir ele estaria num ponto qualquer do meio. Quem clica pra
    // assistir espera ver desde o comeco.
    reiniciarVideo(el);
    trackEvent(config, "expand");
    // Ao expandir o video ja vem tocando do balao, entao o evento de
    // "comecou a tocar" pode nao disparar de novo: confere na hora.
    if (estaTocando(el)) maybeTrackPlay(el, config);
  }

  function collapse(el, backdrop, config) {
    el._playTracked = false;
    // Zera junto com o play: reabrir o video e uma nova assistida, e o
    // expand ja faz o video voltar pro comeco.
    el._marcos = null;
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
  // Marcos de retencao. Os quartis comparam videos de duracoes
  // diferentes de forma justa (e sao o que se mostra pro cliente); o de 3
  // segundos e o que denuncia abertura fraca, que em video vertical curto
  // e onde a maior parte das pessoas desiste.
  var MARCOS = [
    { chave: "progress_3s", segundos: 3 },
    { chave: "progress_25", fracao: 0.25 },
    { chave: "progress_50", fracao: 0.5 },
    { chave: "progress_75", fracao: 0.75 },
  ];

  function marcarRetencao(el, config, currentTime, duration) {
    // Mesma regra do "assistiu": so conta com o video aberto. No balao
    // recolhido o video roda em loop o tempo todo e marcaria retencao
    // pra sempre, exatamente como o play inflado que ja corrigimos.
    if (!el.classList.contains("fvw-expanded")) return;
    if (!(duration > 0)) return;

    var vistos = el._marcos || (el._marcos = {});
    for (var i = 0; i < MARCOS.length; i++) {
      var marco = MARCOS[i];
      if (vistos[marco.chave]) continue;

      var alvo = marco.segundos != null ? marco.segundos : marco.fracao * duration;
      // Marco alem do fim do video (3s num video de 2s) simplesmente nao
      // existe pra ele — nao fica pendente nem vira evento.
      if (!(alvo > 0) || alvo > duration) continue;

      // A janela de 1,5s e o que separa "assistiu ate aqui" de "arrastou
      // a barra pra frente": passando de verdade, o laco de 250ms pega o
      // instante; pulando, o tempo salta pra muito depois do marco e ele
      // continua sem ser contado.
      if (currentTime >= alvo && currentTime < alvo + 1.5) {
        vistos[marco.chave] = true;
        trackEvent(config, marco.chave);
      }
    }
  }

  function startProgressLoop(el, config) {
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
      marcarRetencao(el, config, currentTime, duration);
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

  // Volta o video pro comeco e toca. Serve ao botao de reiniciar e ao
  // expandir — nos dois casos a pessoa quer ver desde o inicio.
  function reiniciarVideo(el) {
    var video = el.querySelector(".fvw-video");
    if (video) {
      video.currentTime = 0;
      video.play().catch(function () {});
    } else if (el._ytPlayer && typeof el._ytPlayer.seekTo === "function") {
      el._ytPlayer.seekTo(0, true);
      el._ytPlayer.playVideo();
    }
    var fill = el.querySelector(".fvw-progress-fill");
    if (fill) fill.style.width = "0%";
    setPlayIcon(el, true);
  }

  function wireRestartButton(el) {
    el.querySelector(".fvw-restart").addEventListener("click", function (e) {
      e.stopPropagation();
      reiniciarVideo(el);
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
      // some com ESTE vídeo pelo tempo configurado no painel.
      suprimir(embedKey, config.video.id, config.reappear_hours);
    });
  }

  // A chave carrega o video: fechar o video de um produto nao pode
  // calar o video dos outros produtos da mesma loja. Sem id de video
  // (config antiga), cai na chave antiga, que valia pro site inteiro.
  function chaveSupressao(embedKey, videoId) {
    return "fvw_closed_" + embedKey + (videoId ? "_" + videoId : "");
  }

  // Decide QUANDO o balão entra na tela. Chama mostrar() uma única vez,
  // com o nome do gatilho que ganhou a corrida.
  //
  //   time   — depois de N segundos (o de sempre)
  //   scroll — quando a pessoa passa de X% da página
  //   exit   — quando o ponteiro sobe pra fechar a aba
  //   any    — o que vier primeiro
  // Quanto tempo antes da aparicao o video comeca a carregar, quando da
  // pra prever (gatilho de tempo).
  var ANTECEDENCIA = 1500;

  function agendarAparicao(config, mostrar, preparar) {
    var modo = config.trigger_mode || "time";
    var delay = (config.delay_seconds || 0) * 1000;
    var alvoScroll = config.trigger_scroll || 50;
    var pronto = false;

    function aparecer(gatilho) {
      if (pronto) return;
      pronto = true;
      window.removeEventListener("scroll", aoRolar);
      document.removeEventListener("mouseout", aoSair);
      mostrar(gatilho);
    }

    function aoRolar() {
      var doc = document.documentElement;
      var rolavel = doc.scrollHeight - window.innerHeight;
      // Página que cabe na tela não tem como ser rolada: esperar por
      // rolagem ali seria esperar pra sempre.
      if (rolavel <= 0) {
        aparecer("scroll");
        return;
      }
      if ((window.scrollY / rolavel) * 100 >= alvoScroll) aparecer("scroll");
    }

    function aoSair(e) {
      // Só conta quando o ponteiro sai pela BORDA DE CIMA da janela, que
      // é pra onde ele vai quando a pessoa busca a aba ou a barra de
      // endereço. Sair pelos lados é troca de janela, não desistência.
      if (e.clientY > 0) return;
      if (e.relatedTarget || e.toElement) return;
      aparecer("exit");
    }

    // Toque não tem ponteiro, então "intenção de saída" simplesmente não
    // existe no celular: sem uma saída de emergência, o balão nunca
    // apareceria pra metade das visitas. O tempo assume o lugar.
    var semPonteiro =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

    if (modo === "time" || modo === "any" || (modo === "exit" && semPonteiro)) {
      // Prepara o video um pouco antes da hora marcada: com o tempo, da
      // pra prever a entrada, entao o balao ja aparece com imagem em
      // movimento em vez de esperar o carregamento na frente da pessoa.
      // Continua fora do carregamento da pagina, que era o problema.
      if (typeof preparar === "function" && delay > ANTECEDENCIA) {
        setTimeout(preparar, delay - ANTECEDENCIA);
      }
      setTimeout(function () {
        aparecer("time");
      }, delay);
    }

    if (modo === "scroll" || modo === "any") {
      window.addEventListener("scroll", aoRolar, { passive: true });
      aoRolar();
    }

    if ((modo === "exit" || modo === "any") && !semPonteiro) {
      document.addEventListener("mouseout", aoSair);
    }
  }

  // Guarda no navegador de quem fechou o balão, pra não insistir toda
  // vez que a pessoa volta ao site. O prazo vem do painel: uma hora
  // costuma bastar numa loja, onde a pessoa volta no mesmo dia pra
  // decidir a compra.
  function suprimir(embedKey, videoId, horas) {
    var prazo = Number(horas) > 0 ? Number(horas) : 1;
    try {
      localStorage.setItem(
        chaveSupressao(embedKey, videoId),
        String(Date.now() + prazo * 3600000)
      );
    } catch (e) {}
  }

  // ?fvw_reset limpa a supressao de TODOS os vídeos deste site — quem
  // está testando fechou vários e não vai adivinhar o id de cada um.
  function clearSuppression(embedKey) {
    try {
      if (location.search.indexOf("fvw_reset") === -1) return;
      var prefixo = "fvw_closed_" + embedKey;
      var apagar = [];
      for (var i = 0; i < localStorage.length; i++) {
        var chave = localStorage.key(i);
        if (chave && chave.indexOf(prefixo) === 0) apagar.push(chave);
      }
      for (var j = 0; j < apagar.length; j++) {
        localStorage.removeItem(apagar[j]);
      }
    } catch (e) {}
  }

  function isSuppressed(embedKey, videoId) {
    try {
      var until = localStorage.getItem(chaveSupressao(embedKey, videoId));
      return !!until && Date.now() < Number(until);
    } catch (e) {
      return false;
    }
  }

  function wireCTA(el, backdrop, config, root) {
    if (!config.cta || config.cta.type === "none") return;

    // Formulario: o botao do balao apenas abre o modal.
    if (CAMPOS[config.cta.type]) {
      var botao = el.querySelector("button.fvw-cta-btn");
      if (!botao) return;
      var modal = buildFormModal(config);
      root.appendChild(modal);

      var form = modal.querySelector(".fvw-cta-form");
      var tel = modal.querySelector('input[type="tel"]');
      if (tel) aplicarMascaraTelefone(tel);

      function abrir(e) {
        e.stopPropagation();
        modal.classList.add("fvw-modal-aberto");
        var primeiro = modal.querySelector(".fvw-input");
        if (primeiro) primeiro.focus();
      }
      function fechar() {
        modal.classList.remove("fvw-modal-aberto");
      }

      botao.addEventListener("click", abrir);
      modal.querySelector(".fvw-modal-close").addEventListener("click", fechar);
      // Clique fora do cartao fecha; dentro, nao.
      modal.addEventListener("click", function (e) {
        if (e.target === modal) fechar();
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = {};
        new FormData(form).forEach(function (v, k) {
          // Telefone vai com o +55 na frente: quem recebe o lead precisa
          // do numero completo pra discar ou importar no CRM.
          data[k] = k.toLowerCase().indexOf("telefone") !== -1
            ? "+55 " + v
            : v;
        });

        submitLead(config, data);
        // De proposito sem os campos preenchidos: o dataLayer e visivel
        // pra qualquer script da pagina, entao dado de lead nao entra ai.
        trackEvent(config, "cta_click", {
          cta_type: config.cta.type,
          cta_label: config.cta.label || "",
        });

        // No formulario de WhatsApp o envio e so a primeira metade: a
        // pessoa espera cair na conversa. Abre ja com o nome dela na
        // mensagem, pra quem atende saber quem chegou.
        if (config.cta.type === "whatsapp_form" && config.cta.target_url) {
          var texto = data["Nome"] ? "Olá! Meu nome é " + data["Nome"] + "." : "Olá!";
          var url =
            config.cta.target_url +
            (config.cta.target_url.indexOf("?") === -1 ? "?" : "&") +
            "text=" + encodeURIComponent(texto);
          // Aberto no mesmo gesto do envio: sem interacao direta o
          // navegador barraria a janela nova como popup.
          window.open(url, "_blank", "noopener");
          mostrarAgradecimento(form, "Redirecionando pro WhatsApp...");
          return;
        }

        mostrarAgradecimento(form, "Recebemos seu contato. Já retornamos!");
      });
      return;
    }

    if (config.cta.type === "buy") {
      wireComprar(el, backdrop, config, root);
      return;
    }

    var link = el.querySelector("a.fvw-cta-btn");
    if (link) {
      link.addEventListener("click", function (e) {
        e.stopPropagation();
        trackEvent(config, "cta_click", {
          cta_type: config.cta.type,
          cta_label: config.cta.label || "",
          cta_url: link.href,
        });
        // CTA de WhatsApp/link não tem formulário, mas o clique em si já
        // é um lead pro negócio (a pessoa demonstrou intenção de
        // contato) — sem isso, esse tipo de CTA nunca aparecia no
        // painel de Leads, só nas Métricas.
        submitLead(config, {
          Ação: config.cta.type === "whatsapp" ? "Clique no WhatsApp" : "Clique no link",
          Destino: link.href,
        });
      });
    }
  }

  // ---------- Botao Comprar ----------

  // Seletores do botao de compra das plataformas mais usadas no Brasil. A
  // ordem dentro de cada lista importa: vence o primeiro que existir e
  // estiver visivel na pagina. Sao varios por plataforma de proposito —
  // tema, versao e tipo de pagina mudam a marcacao, e um seletor unico
  // quebraria em metade das lojas.
  var SELETORES_COMPRA = {
    vtex: [
      'button[class*="vtex-add-to-cart-button"]',
      '[class*="vtex-add-to-cart-button"] button',
      '[class*="vtex-add-to-cart-button"]',
      ".buy-button",
      "#buy-button",
      ".vtex-button.buy-button",
    ],
    loja_integrada: [
      "#comprar",
      "button#comprar",
      ".botao-comprar",
      "button.comprar",
      "a.comprar",
      ".comprar-produto",
    ],
    nuvemshop: [
      ".js-addtocart",
      '[name="add-to-cart"]',
      '.js-prod-submit-form [type="submit"]',
      '.js-product-form [type="submit"]',
      'form[action*="/cart/add"] [type="submit"]',
    ],
    woocommerce: [
      "button.single_add_to_cart_button",
      'form.cart button[type="submit"]',
      "a.ajax_add_to_cart",
      ".add_to_cart_button",
    ],
    shopify: [
      'form[action*="/cart/add"] button[type="submit"]',
      'button[name="add"]',
      ".product-form__submit",
      "#AddToCart",
      ".shopify-payment-button__button",
    ],
    wix: [
      'button[data-hook="add-to-cart"]',
      '[data-hook="add-to-cart"]',
      '[data-hook="product-page-add-to-cart"]',
      '[data-testid="add-to-cart"]',
    ],
    tray: [
      "#smart_button",
      "#botaoComprar",
      "#comprar",
      ".botao-comprar",
      'button[name="comprar"]',
      ".comprar",
    ],
  };

  // Ultimo recurso quando nenhum seletor casa: procurar pelo texto. Pega
  // loja feita a mao e tema tao customizado que nenhuma classe da
  // plataforma sobreviveu.
  var TEXTO_COMPRA = /(comprar|adicionar ao carrinho|add to cart|eu quero)/i;

  function wireComprar(el, backdrop, config, root) {
    var botao = el.querySelector("button.fvw-cta-comprar");
    if (!botao) return;

    botao.addEventListener("click", function (e) {
      e.stopPropagation();
      var alvo = acharBotaoComprar(config.cta);

      trackEvent(config, "cta_click", {
        cta_type: "buy",
        cta_label: config.cta.label || "",
        // Da pra descobrir, sem pedir print pro cliente, se o seletor
        // configurado esta achando o botao naquela loja.
        botao_encontrado: !!alvo,
      });
      submitLead(config, {
        "Ação": "Clique em Comprar",
        Destino: alvo
          ? "botão de compra da página"
          : config.cta.target_url || "não encontrado",
      });

      // O video sai da frente antes do scroll: ele e fixo na tela e
      // taparia justamente o botao pra onde estamos levando a pessoa.
      esconderBalao(el, backdrop, config);

      if (alvo) {
        levarAte(alvo, root, config.cta_color || "#25d366");
        return;
      }
      // Sem botao na pagina vale a URL de reserva (a pagina do produto,
      // por exemplo). Sem ela tambem, so resta ter fechado o video.
      if (config.cta.target_url) {
        window.open(config.cta.target_url, "_blank", "noopener");
      }
    });
  }

  function acharBotaoComprar(cta) {
    var lista = [];
    if (cta.buy_selector) lista.push(cta.buy_selector);

    var plataforma = cta.buy_platform;
    if (plataforma && SELETORES_COMPRA[plataforma]) {
      lista = lista.concat(SELETORES_COMPRA[plataforma]);
    }
    // "Detectar sozinho" (ou plataforma nao informada) varre todas as
    // listas. E um querySelectorAll por seletor, uma unica vez, no
    // clique — nada disso roda no carregamento da pagina.
    if (!plataforma || plataforma === "auto" || plataforma === "custom") {
      for (var chave in SELETORES_COMPRA) {
        if (Object.prototype.hasOwnProperty.call(SELETORES_COMPRA, chave)) {
          lista = lista.concat(SELETORES_COMPRA[chave]);
        }
      }
    }

    for (var i = 0; i < lista.length; i++) {
      var achados;
      try {
        achados = document.querySelectorAll(lista[i]);
      } catch (err) {
        // Seletor invalido digitado no painel nao pode derrubar o clique.
        continue;
      }
      for (var j = 0; j < achados.length; j++) {
        if (estaVisivel(achados[j])) return achados[j];
      }
    }

    return acharPorTexto();
  }

  function acharPorTexto() {
    var candidatos = document.querySelectorAll(
      'button, a, input[type="submit"], [role="button"]'
    );
    for (var i = 0; i < candidatos.length; i++) {
      var alvo = candidatos[i];
      // Nao pode achar o nosso proprio botao: ele tambem diz "Comprar".
      if (alvo.closest && alvo.closest(".fvw-host")) continue;
      var texto = (alvo.value || alvo.textContent || "").trim();
      // Texto longo e paragrafo com a palavra dentro, nao botao de compra.
      if (!texto || texto.length > 40) continue;
      if (TEXTO_COMPRA.test(texto) && estaVisivel(alvo)) return alvo;
    }
    return null;
  }

  // Botao escondido (aba fechada, modal, variacao indisponivel) nao
  // serve: rolar ate ele deixaria a pessoa olhando pra lugar nenhum.
  function estaVisivel(alvo) {
    if (!alvo || !alvo.getBoundingClientRect) return false;
    var r = alvo.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function levarAte(alvo, root, cor) {
    try {
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      alvo.scrollIntoView();
    }
    // Rede de seguranca: ha site que desliga a rolagem suave (um
    // "scroll-behavior" proprio, um plugin de scroll customizado) e a
    // chamada acima simplesmente nao faz nada. Se um segundo depois o
    // botao continuar fora da tela, leva na marra.
    setTimeout(function () {
      var r = alvo.getBoundingClientRect();
      var dentro = r.top >= 0 && r.bottom <= window.innerHeight;
      if (!dentro) alvo.scrollIntoView({ block: "center" });
    }, 1000);
    // Foco pra quem navega por teclado seguir dali — sem mexer no scroll
    // de novo, que ja esta indo pro lugar certo.
    try {
      alvo.focus({ preventScroll: true });
    } catch (err) {}
    destacar(alvo, root, cor);
  }

  // Anel piscando por cima do botao de compra. E um elemento nosso, no
  // shadow root, posicionado sobre o do site: nao alteramos nem uma linha
  // do estilo da loja, e por isso nao ha nada pra restaurar depois.
  function destacar(alvo, root, cor) {
    if (!root.appendChild) return;
    var anel = document.createElement("div");
    anel.className = "fvw-realce";
    // O anel e irmao do balao, nao filho: a variavel de cor da marca vive
    // no wrapper e nao chegaria ate aqui sozinha.
    anel.style.setProperty("--fvw-realce-cor", cor || "#25d366");
    try {
      anel.style.borderRadius = getComputedStyle(alvo).borderRadius || "8px";
    } catch (err) {}
    root.appendChild(anel);

    var fim = Date.now() + 2600;
    // O rAF para de rodar em aba de fundo; sem este timeout o anel
    // ficaria na tela ate a pessoa voltar pra aba.
    setTimeout(function () {
      if (anel.parentNode) anel.parentNode.removeChild(anel);
    }, 3200);
    (function seguir() {
      var r = alvo.getBoundingClientRect();
      anel.style.top = r.top - 4 + "px";
      anel.style.left = r.left - 4 + "px";
      anel.style.width = r.width + 8 + "px";
      anel.style.height = r.height + 8 + "px";
      // Acompanha o scroll suave quadro a quadro; parado, marcaria a
      // posicao antiga do botao.
      if (Date.now() < fim) {
        requestAnimationFrame(seguir);
      } else if (anel.parentNode) {
        anel.parentNode.removeChild(anel);
      }
    })();
  }

  // Tira o balao da tela e cala o video. Diferente do X, nao grava
  // supressao: quem clicou em comprar pode ver o video de novo na
  // proxima visita.
  function esconderBalao(el, backdrop, config) {
    if (el.classList.contains("fvw-expanded")) collapse(el, backdrop, config);
    el.classList.remove("fvw-visible");
    backdrop.classList.remove("fvw-visible");
    var video = el.querySelector("video");
    if (video) {
      video.pause();
    } else if (el._ytPlayer && typeof el._ytPlayer.pauseVideo === "function") {
      el._ytPlayer.pauseVideo();
    }
  }

  // Troca o formulario por uma confirmacao. Sem isso a tela nao muda
  // depois do envio, a pessoa envia de novo, e o limite anti-spam da RPC
  // descarta o segundo envio em silencio.
  function mostrarAgradecimento(form, mensagem) {
    var aviso = document.createElement("p");
    aviso.className = "fvw-obrigado";
    aviso.textContent = mensagem;
    form.parentNode.replaceChild(aviso, form);
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
      esconderPoster(el);
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
          // Nao ligar a legenda automatica: os videos ja costumam ter
          // legenda embutida, e a do YouTube entrava por cima, dobrada.
          cc_load_policy: 0,
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
            insistirEmDesligarLegendas(e.target);
            e.target.playVideo();
          },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING) {
              esconderPoster(el);
              // O modulo de legenda so existe depois que o video comeca,
              // entao desligar no onReady sozinho nao basta.
              insistirEmDesligarLegendas(e.target);
              maybeTrackPlay(el, config);
            }
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

  // Desliga a legenda do YouTube.
  //
  // "cc_load_policy: 0" nos playerVars nao resolve sozinho: ele apenas
  // deixa de FORCAR a legenda, e o YouTube continua ligando por conta
  // propria conforme a preferencia de quem assiste — inclusive a legenda
  // gerada automaticamente (kind "asr").
  //
  // Duas abordagens porque nenhuma e confiavel sozinha: setOption limpa
  // a trilha ativa e unloadModule tira o modulo inteiro. Os nomes
  // "captions" e "cc" mudam conforme a versao do player, e chamar o que
  // nao existe e inofensivo.
  function desligarLegendas(player) {
    if (!player) return;
    ["captions", "cc"].forEach(function (modulo) {
      try {
        player.setOption(modulo, "track", {});
      } catch (e) {}
      try {
        player.unloadModule(modulo);
      } catch (e) {}
    });
  }

  // O modulo de legenda nao existe no onReady e nem sempre esta pronto
  // quando o video comeca: ele aparece em algum momento dos primeiros
  // segundos, e o instante varia com a rede. Em vez de apostar num
  // unico momento, insiste algumas vezes e para.
  function insistirEmDesligarLegendas(player) {
    [0, 400, 1000, 2000, 4000].forEach(function (espera) {
      setTimeout(function () {
        desligarLegendas(player);
      }, espera);
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

    enviarParaAnalytics(config, eventType, extra);
  }

  // Manda o evento pras ferramentas de medicao do proprio site. O
  // caminho principal e o dataLayer, que e por onde o Google Tag Manager
  // escuta: com um gatilho de Evento personalizado, o cliente marca
  // "clique no WhatsApp" como conversao no GA4 / Google Ads sem uma
  // linha de codigo a mais. Sem GTM na pagina, o array so acumula — ele
  // e um array comum, nao depende do GTM existir.
  //
  // O modo vem do painel, e o padrao ("auto") existe por causa de uma
  // armadilha: gtag e GTM dividem o MESMO dataLayer. Num site com os
  // dois, mandar pelos dois caminhos faria o evento chegar duas vezes no
  // GA4, e a conversao apareceria dobrada — numero inflado e pior que
  // numero faltando, porque e nele que o cliente decide gasto de midia.
  function enviarParaAnalytics(config, eventType, extra) {
    var modo = config.analytics_mode || "auto";
    if (modo === "none") return;

    var nome = "floatvideo_" + eventType;
    var dados = {
      widget_id: config.widget_id,
      page_url: location.href,
      video:
        config.video && config.video.source_type === "youtube"
          ? "youtube:" + config.video.youtube_id
          : "upload",
    };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) {
          dados[k] = extra[k];
        }
      }
    }

    if (modo !== "gtag") {
      try {
        var dl = (global.dataLayer = global.dataLayer || []);
        dl.push({ event: nome, floatvideo: dados });
      } catch (e) {}
    }

    // "google_tag_manager" e deixado na pagina pelo proprio container do
    // GTM: e como saber que ele esta ali sem perguntar pro cliente.
    var temGtm = !!global.google_tag_manager;
    var usarGtag =
      typeof global.gtag === "function" &&
      (modo === "gtag" || (modo === "auto" && !temGtm));

    if (usarGtag) {
      try {
        global.gtag("event", nome, dados);
      } catch (e) {}
    }
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

  // A build troca este marcador pelo CSS inteiro, minificado (ver
  // scripts/build-widget.mjs). Em desenvolvimento ele continua vazio, e
  // aí o estilo vem por <link> como sempre veio.
  var CSS_EMBUTIDO = "__FVW_CSS__";

  function injectStyles(root) {
    var doc = root.getElementById ? root : document;
    if (doc.getElementById && doc.getElementById("fvw-styles")) return;

    // Dentro do shadow root, tanto o <style> quanto o <link> são locais:
    // não poluem o site e não podem ser sobrescritos por ele. Embutido
    // poupa uma ida e volta de rede — e o balão nunca aparece sem estilo,
    // porque o CSS chega junto do próprio script.
    if (CSS_EMBUTIDO && CSS_EMBUTIDO !== "__FVW_CSS__") {
      var style = document.createElement("style");
      style.id = "fvw-styles";
      style.textContent = CSS_EMBUTIDO;
      root.appendChild(style);
      return;
    }

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

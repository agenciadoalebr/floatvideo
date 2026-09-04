"use client";

import { useEffect } from "react";
import type { CtaType, Video } from "@/lib/types";
import { corDeTextoPara } from "@/lib/contraste";

type Props = {
  tipo: CtaType;
  estilo: "card" | "solid";
  rotulo: string;
  subRotulo: string;
  cor: string;
  /**
   * O vídeo que serve de fundo. É o mesmo que o visitante veria — sobre
   * um degradê cinza não dá para julgar se o cartão translúcido continua
   * legível quando por trás dele passa um rosto em movimento.
   */
  fundo?: Video | null;
};

/** Os mesmos desenhos do player.js — ver ICONES lá. */
function Icone({ tipo }: { tipo: CtaType }) {
  if (tipo === "whatsapp" || tipo === "whatsapp_form") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34M12.05 21.8h-.01c-1.77 0-3.51-.48-5.03-1.38l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.9-9.88 9.9" />
      </svg>
    );
  }
  if (tipo === "buy") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4m10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4M6.2 15h11.1c.7 0 1.3-.4 1.6-1l3-5.5A1 1 0 0 0 21 7H6.3l-.7-3H2v2h2.2l2.9 12.4A2 2 0 0 0 9 20h11v-2H9.3z" />
      </svg>
    );
  }
  if (tipo === "link") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3zM5 5h5V3H3v18h18v-7h-2v5H5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2M7 9h10v2H7zm0-4h10v2H7zm0 8h7v2H7z" />
    </svg>
  );
}

/**
 * Prévia do botão de ação, montada com as classes de produção do
 * /fvw-styles.css — igual à prévia do balão. Reimplementar o visual aqui
 * garantiria divergência: o cartão translúcido depende de blur, sombra e
 * de duas variáveis de cor que ninguém lembraria de repetir a cada
 * ajuste.
 */
export default function CtaPreview({
  tipo,
  estilo,
  rotulo,
  subRotulo,
  cor,
  fundo = null,
}: Props) {
  useEffect(() => {
    if (document.getElementById("fvw-styles")) return;
    const link = document.createElement("link");
    link.id = "fvw-styles";
    link.rel = "stylesheet";
    link.href = "/fvw-styles.css";
    document.head.appendChild(link);
  }, []);

  const cartao = estilo === "card";

  // A prévia leve não serve aqui: ela é a versão curta do balão
  // recolhido, e o que se está julgando é o vídeo aberto.
  const arquivo = fundo?.mp4_url ?? null;
  const imagem = arquivo ? null : (fundo?.thumbnail_url ?? null);
  const vars = {
    "--fvw-cta-bg": cor,
    "--fvw-cta-fg": corDeTextoPara(cor),
  } as React.CSSProperties;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-neutral-700">
        Prévia do botão
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        É assim que ele aparece quando alguém abre o vídeo.
      </p>

      <div
        className="relative mt-3 h-56 overflow-hidden rounded-xl"
        // O degradê continua embaixo como último recurso: conta sem
        // vídeo nenhum, ou vídeo do YouTube sem miniatura, ainda precisa
        // de algo escuro para o cartão translúcido pousar.
        style={{
          background:
            "radial-gradient(120% 90% at 20% 15%, #6d7f92 0%, #38445280 45%, #1f2937 100%), linear-gradient(160deg, #c2937a 0%, #3f4a56 60%, #111827 100%)",
        }}
      >
        {arquivo ? (
          <video
            src={arquivo}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            // Como na hero: o atributo autoplay não dispara em elemento
            // criado depois do carregamento da página.
            onCanPlay={(e) => {
              void e.currentTarget.play().catch(() => {});
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagem}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="fvw-cta" style={{ ...vars, display: "flex" }}>
          <span className={"fvw-cta-btn" + (cartao ? " fvw-cta-card" : "")}>
            {cartao ? (
              <>
                <span className="fvw-cta-icone">
                  <Icone tipo={tipo} />
                </span>
                <span className="fvw-cta-textos">
                  <span className="fvw-cta-titulo">
                    {rotulo || "Quer saber mais?"}
                  </span>
                  {subRotulo && (
                    <span className="fvw-cta-sub">{subRotulo}</span>
                  )}
                </span>
              </>
            ) : (
              rotulo || "Quer saber mais?"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

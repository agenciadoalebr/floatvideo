"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/**
 * Lê uma media query e reage quando ela muda.
 *
 * useSyncExternalStore em vez de useEffect + setState: além de o React
 * reclamar do segundo (renderiza duas vezes à toa), este responde a
 * quem redimensiona a janela ou muda a preferência de movimento com a
 * página já aberta. No servidor a resposta é "não" — lá não há tela.
 */
function useMedia(consulta: string) {
  const assinar = useCallback(
    (avisar: () => void) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    [consulta]
  );

  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(consulta).matches,
    () => false
  );
}

/**
 * O balão da ilustração, com o vídeo de verdade rodando dentro.
 *
 * É só figura: não abre, não expande e não reage a clique. Quem faz
 * isso é o widget de verdade, no site do cliente.
 *
 * É o produto se explicando sozinho: um retângulo cinza escrito "vídeo"
 * pede um esforço de imaginação que a pessoa não vai fazer no primeiro
 * segundo da página.
 *
 * Três travas para isso não virar peso morto:
 *
 * 1. Só carrega em tela grande. A ilustração já é `hidden lg:block`, mas
 *    o navegador baixa o vídeo de um elemento escondido assim mesmo — é
 *    por isso que o <video> só entra depois que o componente monta e
 *    confirma a largura.
 * 2. Respeita "reduzir movimento" do sistema. Quem pediu para o
 *    computador parar de animar não deve receber um vídeo em laço.
 * 3. Se o arquivo não existir ou falhar, some sem deixar buraco: fica o
 *    balão com o símbolo de play, que é o que havia antes.
 *
 * O arquivo é `public/hero-balao.mp4`. Curto, mudo e pequeno: são uns
 * poucos segundos em laço, num círculo de 100px.
 */
/**
 * O clipe que roda dentro do balão. `null` enquanto não houver arquivo:
 * apontar para um caminho inexistente faria todo visitante de desktop
 * gastar uma requisição num 404 para depois cair no mesmo desenho.
 *
 * Para ligar: colocar o arquivo em `public/` e trocar esta linha por
 * "/hero-balao.mp4".
 */
const FONTE: string | null = "/hero-balao.mp4";

export default function BalaoDaHero({
  tamanho = 100,
  className = "",
}: {
  /** Diâmetro em px — a home usa 100, o login 92. */
  tamanho?: number;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const grande = useMedia("(min-width: 1024px)");
  const calmo = useMedia("(prefers-reduced-motion: reduce)");

  const mostrandoVideo = !!FONTE && grande && !calmo && !falhou;

  return (
    <div
      style={{ width: tamanho, height: tamanho }}
      className={`relative shrink-0 overflow-hidden rounded-full border-[3px] border-black bg-gradient-to-br from-brand-blue to-brand-violet shadow-[0_8px_24px_rgba(0,0,0,0.25)] ${className}`}
    >
      {mostrandoVideo && (
        <video
          src={FONTE ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          // O atributo autoPlay sozinho não basta: este <video> nasce
          // depois do carregamento da página (só existe em tela grande),
          // e nesse caso o navegador não dispara a reprodução — o
          // elemento fica parado no primeiro quadro, sem erro nenhum.
          // Pedir play() quando há dado suficiente resolve; se a
          // política de autoplay recusar, o catch deixa o quadro parado,
          // que ainda é melhor que um buraco.
          onCanPlay={(e) => {
            void e.currentTarget.play().catch(() => {});
          }}
          onError={() => setFalhou(true)}
          // Sem eventos de ponteiro: isto é ilustração, não o widget.
          // Não abre, não expande, não tem controle nenhum — clicar aqui
          // não deve fazer nada além de clicar na página.
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Sem vídeo, o símbolo de play: o balão sozinho é só um círculo
          colorido e não se lê como vídeo. Com o vídeo rodando ele sai —
          o widget de verdade não tem botão de play por cima. */}
      {!mostrandoVideo && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="fill-white/85"
            style={{ width: tamanho * 0.28, height: tamanho * 0.28 }}
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      )}
    </div>
  );
}

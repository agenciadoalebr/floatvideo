"use client";

type Passo = {
  id: string;
  titulo: string;
  descricao: string;
  feito: boolean;
  /** Seção do projeto que resolve este passo. */
  destino: string;
  acao: string;
};

/**
 * Guia do primeiro acesso, mostrado enquanto o site não está no ar.
 *
 * Sem ele, quem entra pela primeira vez vê oito seções no menu e nenhuma
 * indicação de por onde começar — e a ordem importa: vídeo sem regra não
 * aparece em lugar nenhum, e widget nenhum aparece sem o código instalado.
 *
 * Some sozinho quando os três passos estão feitos: quem já entendeu o
 * caminho não precisa de guia ocupando a tela.
 */
export default function PrimeirosPassos({
  temVideo,
  temRegra,
  jaApareceu,
}: {
  temVideo: boolean;
  temRegra: boolean;
  /** O widget já registrou impressão: prova de que está no ar. */
  jaApareceu: boolean;
}) {
  const passos: Passo[] = [
    {
      id: "video",
      titulo: "Envie um vídeo",
      descricao: "Um arquivo seu ou um link do YouTube.",
      feito: temVideo,
      destino: "upload",
      acao: "Ir para Upload",
    },
    {
      id: "regra",
      titulo: "Diga onde ele aparece",
      descricao:
        "No card do vídeo, em “Onde aparece?”. Sem regra, o vídeo não entra em página nenhuma.",
      feito: temRegra,
      destino: "videos",
      acao: "Ir para Vídeos",
    },
    {
      id: "instalar",
      titulo: "Cole o código no seu site",
      descricao:
        "Uma linha, antes do fechamento do </body> ou pelo Google Tag Manager.",
      feito: jaApareceu,
      destino: "instalacao",
      acao: "Ver o código",
    },
  ];

  if (passos.every((p) => p.feito)) return null;

  const concluidos = passos.filter((p) => p.feito).length;

  return (
    <div className="mb-6 rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-brand-ink">
          Para o vídeo entrar no ar
        </h2>
        <span className="text-xs text-neutral-500">
          {concluidos} de {passos.length}
        </span>
      </div>

      <ol className="mt-4 space-y-3">
        {passos.map((passo, i) => (
          <li key={passo.id} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                passo.feito
                  ? "bg-emerald-600 text-white"
                  : "border border-neutral-300 bg-white text-neutral-500"
              }`}
            >
              {passo.feito ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  passo.feito ? "text-neutral-400 line-through" : "text-brand-ink"
                }`}
              >
                {passo.titulo}
              </p>
              {!passo.feito && (
                <p className="mt-0.5 text-xs text-neutral-600">
                  {passo.descricao}
                </p>
              )}
            </div>
            {!passo.feito && (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("fvw-goto-tab", { detail: passo.destino })
                  )
                }
                className="shrink-0 text-xs font-medium text-brand-blue hover:underline"
              >
                {passo.acao}
              </button>
            )}
          </li>
        ))}
      </ol>

      {concluidos === passos.length - 1 && !passos[2].feito && (
        <p className="mt-4 text-xs text-neutral-600">
          Depois de colar o código, abra seu site e espere o balão aparecer —
          este guia some sozinho quando registrarmos a primeira exibição.
        </p>
      )}
    </div>
  );
}

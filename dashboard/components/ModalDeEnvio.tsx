"use client";

import { useEffect } from "react";

export type Etapa = "comprimindo" | "enviando" | "registrando" | "acabamento";

export type Andamento = {
  etapa: Etapa;
  pct: number;
  /** Preenchido quando a compressão termina: tamanho antes e depois. */
  ganho?: { antes: number; depois: number } | null;
  /**
   * Se este vídeo passa mesmo pela compressão. Vídeo pequeno e vídeo
   * vindo do celular não passam — e aí a janela não pode listar uma
   * etapa que não vai acontecer nem se gabar de um trabalho que não fez.
   */
  comprimiu?: boolean;
};

const TODAS: Etapa[] = ["comprimindo", "enviando", "registrando", "acabamento"];

const ROTULOS: Record<Etapa, string> = {
  comprimindo: "Comprimindo o vídeo",
  enviando: "Enviando para o servidor",
  registrando: "Registrando na sua conta",
  acabamento: "Gerando miniatura e prévia",
};

function mb(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * A janela que acompanha o salvamento.
 *
 * Existe por dois motivos. O primeiro é não deixar a pessoa no escuro:
 * comprimir um vídeo de celular no navegador leva minutos, e sem número
 * na tela isso é indistinguível de travamento. O segundo é aproveitar
 * essa espera para explicar o que está acontecendo — a compressão é
 * trabalho de verdade sendo feito ali, e ninguém adivinha isso olhando
 * uma barra.
 *
 * O texto fala do que a ferramenta faz, e não do que os outros deixam de
 * fazer: o ganho aparece em número medido no próprio vídeo da pessoa,
 * que convence mais do que qualquer comparação.
 */
export default function ModalDeEnvio({ andamento }: { andamento: Andamento }) {
  // Fechar a aba no meio derruba o envio: o arquivo sobe daqui, não de um
  // servidor nosso. O aviso do navegador é o único que a pessoa não tem
  // como não ver.
  useEffect(() => {
    function avisar(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, []);

  const ordem = andamento.comprimiu
    ? TODAS
    : TODAS.filter((e) => e !== "comprimindo");
  const indiceAtual = ordem.indexOf(andamento.etapa);
  const comprimindoAgora = andamento.etapa === "comprimindo";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="cartao w-full max-w-md p-6">
        <p className="rotulo-metrica">Salvando o vídeo</p>

        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-semibold text-brand-ink">
            {andamento.pct}%
          </span>
          <span className="text-sm text-ink-muted">
            {ROTULOS[andamento.etapa]}
          </span>
        </p>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet transition-all duration-300"
            style={{ width: `${andamento.pct}%` }}
          />
        </div>

        <ul className="mt-4 space-y-1.5 text-xs">
          {ordem.map((etapa, i) => (
            <li
              key={etapa}
              className={`flex items-center gap-2 ${
                i < indiceAtual
                  ? "text-ink-faint"
                  : i === indiceAtual
                    ? "font-medium text-brand-ink"
                    : "text-ink-faint opacity-60"
              }`}
            >
              <span className={i < indiceAtual ? "text-emerald-600" : ""}>
                {i < indiceAtual ? "✓" : i === indiceAtual ? "•" : "○"}
              </span>
              {ROTULOS[etapa]}
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-xl bg-surface-soft p-4">
          {andamento.comprimiu ? (
            <>
              <p className="text-sm font-semibold text-brand-ink">
                Por que isto leva um tempo
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                {comprimindoAgora
                  ? "O vídeo está sendo comprimido aqui mesmo, no seu navegador, antes de subir."
                  : "O vídeo foi comprimido aqui mesmo, no seu navegador, antes de subir."}{" "}
                Um vídeo de celular costuma ter muito mais qualidade do que um
                balão de 160 pixels consegue mostrar — todo esse excesso
                viraria peso que o visitante do seu site baixaria à toa.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Comprimido antes de subir, o seu site continua rápido e o balão
                começa a tocar mais cedo. É por isso que vale a pena esperar
                esta barra em vez de mandar o arquivo cru.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-brand-ink">
                Este vídeo não precisou de compressão
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Ele já está leve o suficiente para o balão, então sobe como
                está. Quando o arquivo é grande, a compressão acontece aqui no
                seu navegador antes de subir — é o que mantém o site do
                visitante rápido.
              </p>
            </>
          )}

          {/* O número medido no vídeo da própria pessoa diz mais do que
              qualquer promessa escrita antes de acontecer. */}
          {andamento.ganho && (
            <p className="mt-3 rounded-lg bg-surface-card px-3 py-2 text-xs text-brand-ink">
              Neste vídeo:{" "}
              <strong>{mb(andamento.ganho.antes)}</strong> →{" "}
              <strong>{mb(andamento.ganho.depois)}</strong>
              {andamento.ganho.antes > andamento.ganho.depois && (
                <>
                  {" "}
                  <span className="text-emerald-700">
                    ({Math.round(
                      (1 - andamento.ganho.depois / andamento.ganho.antes) * 100
                    )}
                    % mais leve)
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs font-medium text-amber-900">
          Não feche nem saia desta página até terminar.
        </p>
      </div>
    </div>
  );
}

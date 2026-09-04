"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export type ArquivoDoCelular = {
  id: string;
  nome: string;
  url: string;
  tamanho: number | null;
  created_at: string;
};

function tamanhoLegivel(bytes: number | null) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * O QR code que traz o vídeo do celular sem sair desta tela.
 *
 * A pessoa está no computador preenchendo o cadastro e lembra que o
 * vídeo só existe no celular. Abrir o painel no celular significaria
 * refazer tudo lá; aqui o celular faz uma coisa só — mandar o arquivo —
 * e o cadastro continua onde já estava.
 *
 * A tela pergunta ao servidor a cada três segundos se chegou alguma
 * coisa. Não é elegante como uma conexão viva, mas a janela fica aberta
 * por poucos minutos e isso não exige infraestrutura nenhuma.
 */
export default function ModalDoCelular({
  projectId,
  aoEscolher,
  aoFechar,
}: {
  projectId: string;
  aoEscolher: (arquivo: ArquivoDoCelular) => void;
  aoFechar: () => void;
}) {
  const [token, setToken] = useState("");
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [expiraEm, setExpiraEm] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<ArquivoDoCelular[]>([]);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  // A janela fica aberta por minutos, então o prazo precisa mesmo andar
  // na tela — daí um relógio próprio, em vez de ler a hora no render.
  const [agora, setAgora] = useState(() => Date.now());
  const abriu = useRef(false);

  const abrir = useCallback(async () => {
    try {
      const resposta = await fetch("/api/envio-celular/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível abrir o envio.");
        return;
      }

      const endereco = `${window.location.origin}/enviar/${dados.token}`;
      setToken(dados.token);
      setLink(endereco);
      setExpiraEm(dados.expiraEm);
      setQr(
        await QRCode.toDataURL(endereco, {
          width: 480,
          margin: 1,
          color: { dark: "#00092d", light: "#ffffff" },
        })
      );
    } catch {
      setErro("Não foi possível falar com o servidor.");
    }
  }, [projectId]);

  useEffect(() => {
    // Em desenvolvimento o React monta duas vezes; sem esta trava, abrir
    // a janela criaria duas sessões e um dos QR codes nasceria órfão.
    if (abriu.current) return;
    abriu.current = true;
    abrir();
  }, [abrir]);

  useEffect(() => {
    if (!token) return;

    let vivo = true;
    const relogio = setInterval(async () => {
      try {
        const resposta = await fetch(`/api/envio-celular/${token}/arquivos`);
        if (!resposta.ok || !vivo) return;
        const dados = await resposta.json();
        setArquivos(dados.arquivos ?? []);
      } catch {
        // Falha de rede numa consulta de fundo não vira mensagem: a
        // próxima tentativa vem em três segundos.
      }
    }, 3000);

    return () => {
      vivo = false;
      clearInterval(relogio);
    };
  }, [token]);

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(relogio);
  }, []);

  const minutos = expiraEm
    ? Math.max(0, Math.round((new Date(expiraEm).getTime() - agora) / 60000))
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cartao max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-brand-ink">
              Enviar do celular
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Aponte a câmera do celular para o código. O vídeo aparece aqui
              sozinho.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="text-xl leading-none text-ink-faint hover:text-brand-ink"
          >
            &times;
          </button>
        </div>

        {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

        {!erro && (
          <div className="mt-5 text-center">
            {qr ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qr}
                alt="QR code para abrir o envio no celular"
                className="mx-auto h-48 w-48 rounded-xl border border-outline-soft"
              />
            ) : (
              <div className="mx-auto h-48 w-48 animate-pulse rounded-xl bg-surface-muted" />
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
                disabled={!link}
                className="rounded-lg border border-outline-soft px-3 py-2 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
              >
                {copiado ? "Link copiado" : "Copiar link"}
              </button>
            </div>

            {minutos !== null && (
              <p className="mt-2 text-xs text-ink-faint">
                {/* O prazo é curto de propósito: quem tiver este link
                    consegue mandar arquivo para esta conta. */}
                Este link vale por {minutos} minutos.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-outline-soft pt-4">
          {arquivos.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">
              Nenhum vídeo enviado ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {arquivos.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-soft px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-brand-ink">
                      {a.nome}
                    </span>
                    <span className="text-xs text-ink-faint">
                      {tamanhoLegivel(a.tamanho)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => aoEscolher(a)}
                    className="btn-brand shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    Usar este
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

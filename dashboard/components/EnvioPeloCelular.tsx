"use client";

import { useState } from "react";

type Enviado = { nome: string; url: string };

/**
 * A tela que abre no celular depois do QR code.
 *
 * Faz uma coisa só: mandar o arquivo. Nada de nome, regras ou plano —
 * quem está com o celular na mão está no meio de um cadastro que
 * continua no computador, e pedir qualquer outra coisa aqui seria
 * transformar o atalho no caminho longo.
 *
 * Diferente do painel, aqui o vídeo não é comprimido antes de subir: o
 * ffmpeg do navegador come memória demais e trava aparelho modesto. O
 * arquivo sobe como está.
 */
export default function EnvioPeloCelular({
  token,
  nomeDoSite,
}: {
  token: string;
  nomeDoSite: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState("");
  const [enviados, setEnviados] = useState<Enviado[]>([]);

  async function mandar(file: File) {
    setErro("");

    if (!file.type.startsWith("video/")) {
      setErro("Escolha um vídeo.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setErro("O vídeo passa de 500 MB. Grave um mais curto.");
      return;
    }

    setEnviando(true);
    setProgresso(0);

    try {
      const autorizacao = await fetch(`/api/envio-celular/${token}/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          tamanho: file.size,
          nome: file.name,
        }),
      });
      const dados = await autorizacao.json();
      if (!autorizacao.ok) throw new Error(dados.error ?? "Envio recusado.");

      // XMLHttpRequest, e não fetch, porque aqui o progresso importa:
      // num vídeo de celular por rede móvel, uma barra parada por dois
      // minutos parece travamento e a pessoa fecha a página.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", dados.url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.setRequestHeader(
          "Cache-Control",
          "public, max-age=31536000, immutable"
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgresso(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Falha ao enviar (${xhr.status}).`));
        xhr.onerror = () => reject(new Error("Falha de conexão no envio."));
        xhr.send(file);
      });

      const registro = await fetch(`/api/envio-celular/${token}/registrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chave: dados.chave,
          nome: file.name,
          tamanho: file.size,
          tipo: file.type,
        }),
      });
      const anotado = await registro.json();
      if (!registro.ok) throw new Error(anotado.error ?? "Falha ao registrar.");

      setEnviados((antes) => [
        ...antes,
        { nome: file.name, url: dados.publicUrl },
      ]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
      setProgresso(0);
    }
  }

  return (
    <div className="space-y-5">
      <label
        className={`block rounded-2xl border-2 border-dashed p-8 text-center ${
          enviando
            ? "border-outline-soft bg-surface-soft"
            : "border-brand-blue/40 bg-surface-soft"
        }`}
      >
        <input
          type="file"
          accept="video/*"
          disabled={enviando}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) mandar(file);
            e.target.value = "";
          }}
        />
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="h-7 w-7 text-brand-blue"
          >
            <path d="M12 16V4m0 0L7 9m5-5l5 5" />
            <path d="M4 17v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
          </svg>
        </span>
        <span className="mt-4 block text-lg font-semibold text-brand-ink">
          {enviando ? `Enviando... ${progresso}%` : "Toque para escolher"}
        </span>
        <span className="mt-1 block text-sm text-ink-muted">
          {enviando
            ? "Deixe esta tela aberta até terminar."
            : "O vídeo que está no seu celular"}
        </span>
        {!enviando && (
          <span className="btn-brand mt-5 inline-block rounded-lg px-5 py-3 text-sm font-medium">
            Escolher vídeo
          </span>
        )}
      </label>

      {enviando && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {enviados.length > 0 && (
        <div className="cartao p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <span className="text-emerald-600">✓</span>
            {enviados.length === 1
              ? "1 vídeo enviado"
              : `${enviados.length} vídeos enviados`}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Pronto — volte ao computador para terminar o cadastro em{" "}
            <strong className="text-brand-ink">{nomeDoSite}</strong>. Pode
            fechar esta página.
          </p>
          <ul className="mt-3 space-y-2">
            {enviados.map((e) => (
              <li
                key={e.url}
                className="truncate rounded-lg bg-surface-soft px-3 py-2 text-xs text-ink-muted"
              >
                {e.nome}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dito antes de escolher, e não como erro depois de a pessoa
          esperar o envio inteiro. */}
      <p className="text-center text-xs text-ink-faint">
        Até 500 MB por vídeo · MP4, WebM ou MOV
      </p>
    </div>
  );
}

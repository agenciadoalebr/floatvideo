"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { gerarEsalvarMiniatura, gerarEsalvarPrevia } from "@/lib/miniatura";
// Uma instância só de ffmpeg no painel inteiro: dois módulos com o
// próprio carregador baixariam o wasm duas vezes.
import { loadFFmpeg } from "@/lib/ffmpeg";
import { enviarArquivo } from "@/lib/upload";
import RegrasDoNovoVideo, {
  salvarRegras,
  type RegraNova,
} from "@/components/RegrasDoNovoVideo";

// Duas guardas de bom senso na compressão: vídeo pequeno não compensa
// (o ganho é mínimo e só atrasa o envio) e vídeo enorme pode travar o
// navegador — nos dois casos sobe o original.
const MIN_SIZE_TO_COMPRESS = 15 * 1024 * 1024; // 15MB
const MAX_SIZE_TO_COMPRESS = 150 * 1024 * 1024; // 150MB

async function compressVideo(file: File, onProgress: (pct: number) => void): Promise<File> {
  const [ffmpeg, { fetchFile }] = await Promise.all([loadFFmpeg(), import("@ffmpeg/util")]);

  const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".mp4";
  const inputName = "input" + extension;
  const outputName = "output.mp4";

  const handleProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) {
      onProgress(Math.min(99, Math.max(0, Math.round(progress * 100))));
    }
  };
  ffmpeg.on("progress", handleProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec([
      "-i",
      inputName,
      // Limita a 1280px no maior lado — resolução de sobra pra um balão
      // flutuante — sem forçar largura ímpar (o -2 arredonda pra par,
      // exigência do codec).
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const bytes = data as Uint8Array;
    return new File(
      [bytes.slice()],
      file.name.replace(/\.[a-z0-9]+$/i, "") + ".mp4",
      { type: "video/mp4" }
    );
  } finally {
    ffmpeg.off("progress", handleProgress);
    await Promise.all([
      ffmpeg.deleteFile(inputName).catch(() => {}),
      ffmpeg.deleteFile(outputName).catch(() => {}),
    ]);
  }
}

export default function VideoUploader({
  projectId,
  widgetId,
}: {
  projectId: string;
  widgetId: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [regras, setRegras] = useState<RegraNova[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // O nome é lido via ref no momento do insert: handleFile é um useCallback
  // e, se dependesse do state, cada tecla digitada recriaria a função (e
  // com ela o handler de drop). O ref é atualizado no onChange, nunca
  // durante o render — escrever nele no corpo do componente quebra o
  // modelo de renderização concorrente do React.
  const nameRef = useRef("");
  // As regras seguem o mesmo caminho do nome, e pelo mesmo motivo.
  const regrasRef = useRef<RegraNova[]>([]);

  const handleFile = useCallback(
    async (file: File) => {
      setError("");

      if (!file.type.startsWith("video/")) {
        setError("Envie um arquivo de vídeo (MP4, WebM ou MOV).");
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        setError("O arquivo excede o limite de 500MB.");
        return;
      }

      setUploading(true);

      let fileToUpload: File = file;
      if (file.size > MIN_SIZE_TO_COMPRESS && file.size <= MAX_SIZE_TO_COMPRESS) {
        try {
          setProgressLabel("Comprimindo vídeo... 0%");
          fileToUpload = await compressVideo(file, (pct) =>
            setProgressLabel(`Comprimindo vídeo... ${pct}%`)
          );
        } catch (err) {
          // Compressão é uma otimização, não um requisito — se falhar (navegador
          // sem suporte, sem memória, etc.), segue com o arquivo original.
          console.warn("[VideoUploader] falha ao comprimir, enviando original:", err);
          fileToUpload = file;
        }
      }

      setProgressLabel("Enviando vídeo...");

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Sessão expirada, faça login de novo.");
        setUploading(false);
        return;
      }

      const ext = fileToUpload.name.split(".").pop() || "mp4";
      const path = `${user.id}/${projectId}/${Date.now()}.${ext}`;

      // O arquivo vai direto do navegador pro R2, com uma autorização
      // temporária gerada pelo nosso servidor. Ele não passa pela Vercel:
      // não esbarra no limite de tamanho de requisição nem gasta banda
      // nossa no caminho.
      let publicUrl: string;
      try {
        const enviado = await enviarArquivo(fileToUpload, path, "video");
        publicUrl = enviado.publicUrl;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Falha ao enviar o vídeo."
        );
        setUploading(false);
        return;
      }

      setProgressLabel("Registrando vídeo...");

      const { data: criado, error: insertError } = await supabase
        .from("videos")
        .insert({
          project_id: projectId,
          name: nameRef.current.trim(),
          source_type: "upload",
          original_file_key: path,
          mp4_url: publicUrl,
          status: "ready",
        })
        .select("id")
        .single();

      if (insertError || !criado) {
        setUploading(false);
        setError(insertError?.message ?? "Erro ao registrar o vídeo.");
        return;
      }

      // As regras vêm antes da miniatura: é o que decide se o vídeo
      // aparece em algum lugar. Se falhar, a pessoa precisa saber agora,
      // e não descobrir olhando um site sem balão.
      if (widgetId) {
        const erroDasRegras = await salvarRegras(
          supabase,
          widgetId,
          criado.id,
          regrasRef.current
        );
        if (erroDasRegras) {
          setUploading(false);
          setError(
            `O vídeo subiu, mas as regras não foram salvas: ${erroDasRegras.message}. Ajuste em "Onde aparece?" na lista de vídeos.`
          );
          router.refresh();
          return;
        }
      }

      // Miniatura a partir do arquivo que está aqui na máquina, não do
      // que acabou de subir: é instantâneo e não gasta banda baixando de
      // volta o que acabamos de enviar.
      setProgressLabel("Gerando miniatura...");
      await gerarEsalvarMiniatura(supabase, criado.id, fileToUpload, path);

      // A prévia é o que roda no balão recolhido. Sai daqui, do arquivo
      // que já está na máquina, e não de um servidor: o navegador já tem
      // tudo o que precisa.
      setProgressLabel("Preparando a prévia do balão...");
      await gerarEsalvarPrevia(supabase, criado.id, fileToUpload, path);

      setUploading(false);

      setName("");
      nameRef.current = "";
      setRegras([]);
      regrasRef.current = [];
      router.refresh();
    },
    [projectId, router, widgetId]
  );

  // O que falta para o envio ser liberado. Um vídeo sem nome vira uma
  // linha vazia na lista, e um vídeo sem regra não aparece em lugar
  // nenhum — os dois só dão as caras bem depois, quando já não é óbvio
  // o que deu errado.
  const faltando: string[] = [];
  if (!name.trim()) faltando.push("o nome do vídeo");
  if (regras.length === 0) faltando.push("onde ele vai aparecer");
  const liberado = faltando.length === 0;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-ink-muted">
          1. Nome do vídeo
        </span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            nameRef.current = e.target.value;
          }}
          placeholder="Ex.: Apresentação da loja"
          className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />
      </label>

      <div>
        <span className="text-xs font-medium text-ink-muted">
          2. Onde ele vai aparecer
        </span>
        <p className="mt-0.5 mb-2 text-xs text-ink-faint">
          Em quais páginas do site o balão entra. Sem ao menos uma regra, o
          vídeo fica guardado aqui e não aparece para ninguém.
        </p>
        <RegrasDoNovoVideo
          regras={regras}
          aoMudar={(r) => {
            setRegras(r);
            regrasRef.current = r;
          }}
        />
      </div>

      <div>
        <span className="text-xs font-medium text-ink-muted">
          3. O arquivo
        </span>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (liberado) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!liberado) return;
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => {
            if (liberado) inputRef.current?.click();
          }}
          aria-disabled={!liberado}
          className={`mt-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
            !liberado
              ? "cursor-not-allowed border-outline bg-surface-soft opacity-60"
              : dragOver
                ? "cursor-pointer border-brand-blue bg-brand-blue/5"
                : "cursor-pointer border-outline bg-surface-soft hover:border-brand-blue"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {/* Seta para cima em traço: o mesmo desenho do menu lateral, para
              a tela inteira parecer feita pela mesma mão. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-10 w-10 ${liberado ? "text-brand-blue" : "text-ink-faint"}`}
          >
            <path d="M12 16V4m0 0L7 9m5-5l5 5" />
            <path d="M4 17v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
          </svg>
          <p className="mt-4 text-base font-medium text-brand-ink">
            {uploading ? progressLabel : "Arraste o seu vídeo aqui"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {uploading
              ? "Não feche esta aba enquanto o envio termina."
              : "ou clique para escolher um arquivo no computador"}
          </p>
          {/* Diz o que falta, e não só que está bloqueado: um botão apagado
              sem explicação é o tipo de coisa que vira chamado de suporte. */}
          {!liberado && !uploading && (
            <p className="mt-3 rounded-lg bg-surface-card px-3 py-2 text-xs text-ink-muted">
              Antes de enviar, preencha {faltando.join(" e ")}.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

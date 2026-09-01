"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { gerarEsalvarMiniatura } from "@/lib/miniatura";

// Versão fixa do core do ffmpeg.wasm, carregada direto do CDN em tempo de
// execução (não faz parte do bundle do site) — mantém o pacote do
// dashboard leve e usa a build single-thread, que não exige os headers
// COOP/COEP que a versão multi-thread precisaria no servidor.
const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

// Não vale a pena comprimir vídeo pequeno (o ganho é mínimo e só atrasa o
// upload), nem tentar em arquivos enormes (o navegador pode travar
// processando algo tão grande em memória) — nesses casos sobe original.
const MIN_SIZE_TO_COMPRESS = 15 * 1024 * 1024; // 15MB
const MAX_SIZE_TO_COMPRESS = 150 * 1024 * 1024; // 150MB

let ffmpegLoadPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

async function loadFFmpeg() {
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  return ffmpegLoadPromise;
}

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

export default function VideoUploader({ projectId }: { projectId: string }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // O nome é lido via ref no momento do insert: handleFile é um useCallback
  // e, se dependesse do state, cada tecla digitada recriaria a função (e
  // com ela o handler de drop). O ref é atualizado no onChange, nunca
  // durante o render — escrever nele no corpo do componente quebra o
  // modelo de renderização concorrente do React.
  const nameRef = useRef("");

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

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(path, fileToUpload, { cacheControl: "31536000", upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        return;
      }

      const { data: publicUrl } = supabase.storage.from("videos").getPublicUrl(path);

      setProgressLabel("Registrando vídeo...");

      const { data: criado, error: insertError } = await supabase
        .from("videos")
        .insert({
          project_id: projectId,
          name: nameRef.current.trim() || null,
          source_type: "upload",
          original_file_key: path,
          mp4_url: publicUrl.publicUrl,
          status: "ready",
        })
        .select("id")
        .single();

      if (insertError || !criado) {
        setUploading(false);
        setError(insertError?.message ?? "Erro ao registrar o vídeo.");
        return;
      }

      // Miniatura a partir do arquivo que está aqui na máquina, não do
      // que acabou de subir: é instantâneo e não gasta banda baixando de
      // volta o que acabamos de enviar.
      setProgressLabel("Gerando miniatura...");
      await gerarEsalvarMiniatura(supabase, criado.id, fileToUpload, path);

      setUploading(false);

      setName("");
      nameRef.current = "";
      router.refresh();
    },
    [projectId, router]
  );

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          nameRef.current = e.target.value;
        }}
        placeholder="Nome do vídeo (opcional)"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
        dragOver ? "border-brand-blue bg-brand-blue/5" : "border-neutral-300 bg-white"
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
      <p className="text-sm font-medium text-neutral-700">
        {uploading ? progressLabel : "Arraste um vídeo aqui ou clique para escolher"}
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        MP4, WebM ou MOV — até 500MB. Vídeos grandes são comprimidos
        automaticamente antes do envio.
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

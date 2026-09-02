import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarArquivo } from "@/lib/upload";

/**
 * Miniatura e duração de um vídeo, extraídas no próprio navegador.
 *
 * Não precisa de ffmpeg nem de serviço nenhum: o <video> já sabe decodificar
 * o arquivo, e o canvas copia um quadro dele. Vale tanto para o arquivo que
 * a pessoa acabou de escolher quanto para um vídeo já hospedado.
 */
export type Miniatura = {
  blob: Blob;
  duracao: number;
};

/**
 * Maior lado da miniatura, não a largura: vídeo de venda costuma ser
 * vertical, e limitar só a largura deixava um 1080x1920 virar um
 * 640x1138 — três vezes mais imagem do que cabe num card.
 */
const LADO_MAX = 640;

export async function extrairMiniatura(
  fonte: File | string
): Promise<Miniatura> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  // Vídeo de outro domínio (o CDN do Storage) só pode ser copiado para o
  // canvas com CORS declarado antes do src. Sem isso o canvas é marcado
  // como "sujo" e o toBlob falha por segurança.
  const objectUrl = typeof fonte === "string" ? null : URL.createObjectURL(fonte);
  if (typeof fonte === "string") video.crossOrigin = "anonymous";
  video.src = objectUrl ?? (fonte as string);

  try {
    const duracao = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration || 0);
      video.onerror = () => reject(new Error("não foi possível ler o vídeo"));
    });

    // Um pouco depois do começo: o primeiro quadro costuma ser preto,
    // fade-in ou claquete.
    const instante = Number.isFinite(duracao) && duracao > 0
      ? Math.min(duracao * 0.1, 2)
      : 0;

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("não foi possível posicionar o vídeo"));
      video.currentTime = instante;
    });

    const largura = video.videoWidth || LADO_MAX;
    const altura = video.videoHeight || 360;
    const escala = Math.min(1, LADO_MAX / Math.max(largura, altura));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponível");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("falha ao gerar a imagem"))),
        "image/jpeg",
        0.72
      );
    });

    return { blob, duracao: Math.round(duracao) || 0 };
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

/**
 * Extrai, sobe para o Storage e grava no vídeo. Devolve a URL, ou null se
 * qualquer etapa falhar — miniatura é um acabamento, e não pode derrubar
 * o envio de um vídeo que já está no ar.
 */
export async function gerarEsalvarMiniatura(
  supabase: SupabaseClient,
  videoId: string,
  fonte: File | string,
  caminhoBase: string
): Promise<string | null> {
  try {
    const { blob, duracao } = await extrairMiniatura(fonte);
    // Mesmo caminho do vídeo com outra extensão: apagar o vídeo leva a
    // miniatura junto, sem precisar de uma segunda referência.
    const caminho = caminhoBase.replace(/\.[a-z0-9]+$/i, "") + ".jpg";

    const { publicUrl } = await enviarArquivo(blob, caminho, "miniatura");

    await supabase
      .from("videos")
      .update({
        thumbnail_url: publicUrl,
        duration_seconds: duracao || null,
      })
      .eq("id", videoId);

    return publicUrl;
  } catch (err) {
    console.warn("[miniatura] não foi possível gerar:", err);
    return null;
  }
}

/**
 * Gera a prévia leve, sobe e grava no vídeo. Como a miniatura, é
 * acabamento: falhando, o widget usa o arquivo cheio como sempre usou.
 */
export async function gerarEsalvarPrevia(
  supabase: SupabaseClient,
  videoId: string,
  fonte: File | Blob,
  caminhoBase: string
): Promise<string | null> {
  try {
    const { gerarPreviaLeve } = await import("@/lib/ffmpeg");
    const blob = await gerarPreviaLeve(fonte);

    const caminho =
      caminhoBase.replace(/\.[a-z0-9]+$/i, "") + "-previa.mp4";

    const { publicUrl } = await enviarArquivo(
      new File([blob], "previa.mp4", { type: "video/mp4" }),
      caminho,
      "previa"
    );

    await supabase
      .from("videos")
      .update({ preview_url: publicUrl })
      .eq("id", videoId);

    return publicUrl;
  } catch (err) {
    console.warn("[prévia] não foi possível gerar:", err);
    return null;
  }
}

/** 95 → "1:35". Usado nos cards da lista de vídeos. */
export function formatarDuracao(segundos: number | null) {
  if (!segundos || segundos < 1) return null;
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

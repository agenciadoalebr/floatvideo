/**
 * ffmpeg.wasm carregado sob demanda, do CDN, fora do pacote do painel.
 * A build single-thread é de propósito: a multi-thread exigiria os
 * cabeçalhos COOP/COEP no servidor.
 *
 * Vive aqui, e não dentro do enviador, porque a prévia dos vídeos que já
 * foram enviados é gerada de outra tela.
 */
const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

let ffmpegLoadPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

export async function loadFFmpeg() {
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });
      return ffmpeg;
    })();
  }
  return ffmpegLoadPromise;
}

/** Segundos da prévia. O bastante para a pessoa perceber movimento. */
const SEGUNDOS_PREVIA = 8;

/**
 * Corta o começo do vídeo numa versão de balão: alguns segundos, largura
 * de miniatura e sem áudio (o balão nasce mudo de qualquer forma).
 *
 * A conta que justifica isso: o balão toca para todo visitante, mas só
 * ~9% abrem o vídeo. Sem a prévia, mais de 90% da banda vai para quem
 * nunca abriu.
 */
export async function gerarPreviaLeve(fonte: File | Blob): Promise<Blob> {
  const [ffmpeg, { fetchFile }] = await Promise.all([
    loadFFmpeg(),
    import("@ffmpeg/util"),
  ]);

  const entrada = "previa-entrada.mp4";
  const saida = "previa.mp4";

  try {
    await ffmpeg.writeFile(entrada, await fetchFile(fonte));
    await ffmpeg.exec([
      "-i",
      entrada,
      "-t",
      String(SEGUNDOS_PREVIA),
      // 360px no menor lado dá conta de um balão de até ~260px, inclusive
      // em tela retina. -2 arredonda o outro lado para par, exigência do
      // codec.
      "-vf",
      "scale='if(gt(iw,ih),-2,360)':'if(gt(iw,ih),360,-2)'",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "30",
      "-movflags",
      "+faststart",
      saida,
    ]);

    const data = await ffmpeg.readFile(saida);
    const bytes = data as Uint8Array;
    return new Blob([bytes.slice()], { type: "video/mp4" });
  } finally {
    await Promise.all([
      ffmpeg.deleteFile(entrada).catch(() => {}),
      ffmpeg.deleteFile(saida).catch(() => {}),
    ]);
  }
}

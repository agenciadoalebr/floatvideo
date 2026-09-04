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
import ModalDoCelular, {
  type ArquivoDoCelular,
} from "@/components/ModalDoCelular";
import ModalDeEnvio, { type Andamento } from "@/components/ModalDeEnvio";
import ModalDeSucesso from "@/components/ModalDeSucesso";

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

/**
 * Onde o arquivo mora no bucket: pasta do usuário, pasta do site, e um
 * carimbo de tempo para o nome não repetir.
 *
 * Fora do componente de propósito — dentro dele, a regra de pureza do
 * React acusa o Date.now() mesmo estando num manipulador de evento, onde
 * ele é perfeitamente legítimo.
 */
function caminhoNoBucket(userId: string, projectId: string, nome: string) {
  const ext = nome.split(".").pop() || "mp4";
  return `${userId}/${projectId}/${Date.now()}.${ext}`;
}

function tamanhoLegivel(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Envio de vídeo em três passos, com a subida disparada por botão.
 *
 * Escolher o arquivo só escolhe o arquivo. Antes, soltar o vídeo já
 * começava a subida na hora — não dava para conferir nada nem voltar
 * atrás depois de errar o arquivo. Agora o envio é um ato à parte, e o
 * botão só acende com nome, regras e arquivo os três prontos.
 */
export default function VideoUploader({
  projectId,
  widgetId,
  widgetAtivo,
  siteConectado,
  temCta,
}: {
  projectId: string;
  widgetId: string | null;
  /** Widget ligado. Desligado, nada aparece por mais certo que esteja. */
  widgetAtivo: boolean;
  /** O site já reportou exibição — prova de que o código está instalado. */
  siteConectado: boolean;
  temCta: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [regras, setRegras] = useState<RegraNova[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  // Vídeo que chegou pelo celular: já está no R2, então aqui não há
  // arquivo local nenhum para comprimir ou enviar.
  const [doCelular, setDoCelular] = useState<ArquivoDoCelular | null>(null);
  const [celularAberto, setCelularAberto] = useState(false);
  const [concluido, setConcluido] = useState<{
    nome: string;
    regras: RegraNova[];
    ganho: Andamento["ganho"];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Só valida e guarda. Como não dispara mais o envio, esta função não
  // depende de nada que mude — e some a necessidade dos refs que existiam
  // apenas para manter o handler de drop estável.
  const escolher = useCallback((file: File) => {
    setError("");
    if (!file.type.startsWith("video/")) {
      setError("Envie um arquivo de vídeo (MP4, WebM ou MOV).");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError("O arquivo excede o limite de 500MB.");
      return;
    }
    setArquivo(file);
    setDoCelular(null);
  }, []);

  async function salvar() {
    if (!liberado) return;

    setError("");
    setSalvando(true);

    const supabaseCel = createClient();

    // Vindo do celular o arquivo já está no R2: não há o que comprimir
    // nem o que subir de novo. Só falta registrar e gerar o acabamento.
    if (doCelular) {
      setAndamento({ etapa: "registrando", pct: 30, comprimiu: false });

      const { data: criado, error: insertError } = await supabaseCel
        .from("videos")
        .insert({
          project_id: projectId,
          name: name.trim(),
          source_type: "upload",
          original_file_key: caminhoDaUrl(doCelular.url),
          mp4_url: doCelular.url,
          status: "ready",
        })
        .select("id")
        .single();

      if (insertError || !criado) {
        setSalvando(false);
        setError(insertError?.message ?? "Erro ao registrar o vídeo.");
        return;
      }

      if (widgetId) {
        const erroDasRegras = await salvarRegras(
          supabaseCel,
          widgetId,
          criado.id,
          regras
        );
        if (erroDasRegras) {
          setSalvando(false);
          setError(
            `O vídeo entrou, mas as regras não foram salvas: ${erroDasRegras.message}. Ajuste em "Onde aparece?" na lista de vídeos.`
          );
          router.refresh();
          return;
        }
      }

      // A miniatura sai do próprio endereço do vídeo — o <video> do
      // navegador lê do CDN sem precisar baixar o arquivo inteiro.
      setAndamento({ etapa: "acabamento", pct: 60, comprimiu: false });
      const base = caminhoDaUrl(doCelular.url);
      await gerarEsalvarMiniatura(supabaseCel, criado.id, doCelular.url, base);

      // Já a prévia precisa dos bytes, porque passa pelo ffmpeg. Se o
      // download falhar, o widget usa o arquivo cheio como sempre usou —
      // por isso isto não derruba o cadastro.
      setAndamento({ etapa: "acabamento", pct: 80, comprimiu: false });
      try {
        const resposta = await fetch(doCelular.url);
        const blob = await resposta.blob();
        await gerarEsalvarPrevia(supabaseCel, criado.id, blob, base);
      } catch (err) {
        console.warn("[celular] prévia não gerada:", err);
      }

      setSalvando(false);
      setConcluido({ nome: name.trim(), regras, ganho: null });
      setName("");
      setRegras([]);
      setDoCelular(null);
      setAndamento(null);
      router.refresh();
      return;
    }

    if (!arquivo) return;

    let paraEnviar: File = arquivo;
    let ganho: Andamento["ganho"] = null;
    // Vídeo pequeno demais (o ganho não paga a espera) ou grande demais
    // (o navegador não aguenta) sobe como está — e a janela precisa
    // saber disso para não anunciar uma etapa que não vai existir.
    const comprimiu =
      arquivo.size > MIN_SIZE_TO_COMPRESS &&
      arquivo.size <= MAX_SIZE_TO_COMPRESS;
    if (
      arquivo.size > MIN_SIZE_TO_COMPRESS &&
      arquivo.size <= MAX_SIZE_TO_COMPRESS
    ) {
      try {
        setAndamento({ etapa: "comprimindo", pct: 0, comprimiu: true });
        paraEnviar = await compressVideo(arquivo, (pct) =>
          setAndamento({ etapa: "comprimindo", pct, comprimiu: true })
        );
        ganho = { antes: arquivo.size, depois: paraEnviar.size };
      } catch (err) {
        // Compressão é otimização, não requisito — se falhar (navegador
        // sem suporte, sem memória), segue com o arquivo original.
        console.warn(
          "[VideoUploader] falha ao comprimir, enviando original:",
          err
        );
        paraEnviar = arquivo;
      }
    }

    setAndamento({ etapa: "enviando", pct: 0, ganho, comprimiu });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada, faça login de novo.");
      setSalvando(false);
      return;
    }

    const path = caminhoNoBucket(user.id, projectId, paraEnviar.name);

    // O arquivo vai direto do navegador pro R2, com uma autorização
    // temporária gerada pelo nosso servidor. Ele não passa pela Vercel:
    // não esbarra no limite de tamanho de requisição nem gasta banda
    // nossa no caminho.
    let publicUrl: string;
    try {
      const enviado = await enviarArquivo(paraEnviar, path, "video", (pct) =>
        setAndamento({ etapa: "enviando", pct, ganho, comprimiu })
      );
      publicUrl = enviado.publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar o vídeo.");
      setSalvando(false);
      return;
    }

    setAndamento({ etapa: "registrando", pct: 40, ganho, comprimiu });

    const { data: criado, error: insertError } = await supabase
      .from("videos")
      .insert({
        project_id: projectId,
        name: name.trim(),
        source_type: "upload",
        original_file_key: path,
        mp4_url: publicUrl,
        status: "ready",
      })
      .select("id")
      .single();

    if (insertError || !criado) {
      setSalvando(false);
      setAndamento(null);
      setError(insertError?.message ?? "Erro ao registrar o vídeo.");
      return;
    }

    // As regras vêm antes da miniatura: é o que decide se o vídeo aparece
    // em algum lugar. Se falhar, a pessoa precisa saber agora, e não
    // descobrir olhando um site sem balão.
    if (widgetId) {
      const erroDasRegras = await salvarRegras(
        supabase,
        widgetId,
        criado.id,
        regras
      );
      if (erroDasRegras) {
        setSalvando(false);
        setError(
          `O vídeo subiu, mas as regras não foram salvas: ${erroDasRegras.message}. Ajuste em "Onde aparece?" na lista de vídeos.`
        );
        router.refresh();
        return;
      }
    }

    // Miniatura a partir do arquivo que está aqui na máquina, não do que
    // acabou de subir: é instantâneo e não gasta banda baixando de volta
    // o que acabamos de enviar.
    setAndamento({ etapa: "acabamento", pct: 60, ganho, comprimiu });
    await gerarEsalvarMiniatura(supabase, criado.id, paraEnviar, path);

    // A prévia é o que roda no balão recolhido. Sai daqui, do arquivo que
    // já está na máquina, e não de um servidor.
    setAndamento({ etapa: "acabamento", pct: 85, ganho, comprimiu });
    await gerarEsalvarPrevia(supabase, criado.id, paraEnviar, path);

    setSalvando(false);
    setConcluido({ nome: name.trim(), regras, ganho });
    setName("");
    setRegras([]);
    setArquivo(null);
    setAndamento(null);
    router.refresh();
  }

  /** "https://cdn/celular/abc/1.mp4" -> "celular/abc/1.mp4" */
  function caminhoDaUrl(url: string) {
    try {
      return new URL(url).pathname.replace(/^\//, "");
    } catch {
      return url;
    }
  }

  // O que falta, dito por extenso. Um vídeo sem nome vira uma linha vazia
  // na lista e um vídeo sem regra não aparece em lugar nenhum — os dois só
  // dão as caras bem depois, quando já não é óbvio o que deu errado.
  const faltando: string[] = [];
  if (!name.trim()) faltando.push("o nome do vídeo");
  if (regras.length === 0) faltando.push("onde ele vai aparecer");
  if (!arquivo && !doCelular) faltando.push("o arquivo");
  const liberado = faltando.length === 0;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-ink-muted">
          1. Nome do vídeo
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <RegrasDoNovoVideo regras={regras} aoMudar={setRegras} />
      </div>

      <div>
        <span className="text-xs font-medium text-ink-muted">3. O arquivo</span>

        {doCelular ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-soft bg-surface-soft px-4 py-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-brand-ink">
                {doCelular.nome}
              </span>
              <span className="text-xs text-ink-faint">
                Veio do celular · já está guardado
              </span>
            </span>
            <button
              type="button"
              onClick={() => setDoCelular(null)}
              disabled={salvando}
              className="text-xs font-medium text-brand-blue hover:underline disabled:opacity-50"
            >
              Trocar arquivo
            </button>
          </div>
        ) : arquivo ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-soft bg-surface-soft px-4 py-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-brand-ink">
                {arquivo.name}
              </span>
              <span className="text-xs text-ink-faint">
                {tamanhoLegivel(arquivo.size)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setArquivo(null)}
              disabled={salvando}
              className="text-xs font-medium text-brand-blue hover:underline disabled:opacity-50"
            >
              Trocar arquivo
            </button>
          </div>
        ) : (
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
              if (file) escolher(file);
            }}
            onClick={() => inputRef.current?.click()}
            className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
              dragOver
                ? "border-brand-blue bg-brand-blue/5"
                : "border-outline bg-surface-soft hover:border-brand-blue"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) escolher(file);
              }}
            />
            {/* Seta para cima em traço: o mesmo desenho do menu lateral,
                para a tela inteira parecer feita pela mesma mão. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-10 w-10 text-brand-blue"
            >
              <path d="M12 16V4m0 0L7 9m5-5l5 5" />
              <path d="M4 17v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
            </svg>
            <p className="mt-4 text-base font-medium text-brand-ink">
              Arraste o seu vídeo aqui
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              ou clique para escolher um arquivo no computador
            </p>
            {/* O vídeo quase sempre foi gravado no celular. Sem esta
                saída, a pessoa teria que passar o arquivo para o
                computador antes de continuar. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCelularAberto(true);
              }}
              className="mt-4 rounded-lg border border-outline-soft bg-surface-card px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
            >
              O vídeo está no meu celular
            </button>
          </div>
        )}
      </div>

      {/* Enquanto salva, a janela toma a tela: é ela que mostra o
          andamento e segura a pessoa na página. */}
      {salvando && andamento && <ModalDeEnvio andamento={andamento} />}

      {concluido && (
        <ModalDeSucesso
          nome={concluido.nome}
          regras={concluido.regras}
          ganho={concluido.ganho}
          widgetAtivo={widgetAtivo}
          siteConectado={siteConectado}
          temCta={temCta}
          aoFechar={() => setConcluido(null)}
          aoConfigurarCta={() => {
            setConcluido(null);
            window.dispatchEvent(
              new CustomEvent("fvw-goto-tab", { detail: "cta" })
            );
          }}
          aoVerVideos={() => {
            setConcluido(null);
            window.dispatchEvent(
              new CustomEvent("fvw-goto-tab", { detail: "videos" })
            );
          }}
        />
      )}

      {celularAberto && (
        <ModalDoCelular
          projectId={projectId}
          aoEscolher={(a) => {
            setDoCelular(a);
            setArquivo(null);
            setCelularAberto(false);
          }}
          aoFechar={() => setCelularAberto(false)}
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-soft pt-4">
        {/* Diz o que falta, e não só que está bloqueado: um botão apagado
            sem explicação é o tipo de coisa que vira chamado de suporte. */}
        {!liberado && !salvando && (
          <span className="text-xs text-ink-muted">
            Falta {faltando.join(", ")}.
          </span>
        )}
        <button
          type="button"
          onClick={salvar}
          disabled={!liberado || salvando}
          className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar vídeo"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

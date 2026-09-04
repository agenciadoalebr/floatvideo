"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { extractYouTubeId } from "@/lib/youtube";
import RegrasDoNovoVideo, {
  salvarRegras,
  type RegraNova,
} from "@/components/RegrasDoNovoVideo";

/**
 * Vídeo por link do YouTube.
 *
 * Pede nome e regras como o envio de arquivo: o vídeo que nasce aqui é o
 * mesmo, e sem as duas coisas ele acaba do mesmo jeito — uma linha sem
 * nome na lista, que não aparece em página nenhuma.
 */
export default function YouTubeForm({
  projectId,
  widgetId,
}: {
  projectId: string;
  widgetId: string | null;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [regras, setRegras] = useState<RegraNova[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const youtubeId = extractYouTubeId(url);
    if (!youtubeId) {
      setError("Não consegui reconhecer esse link do YouTube.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: criado, error: insertError } = await supabase
      .from("videos")
      .insert({
        project_id: projectId,
        name: name.trim(),
        source_type: "youtube",
        youtube_id: youtubeId,
        thumbnail_url: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        status: "ready",
      })
      .select("id")
      .single();

    if (insertError || !criado) {
      setLoading(false);
      setError(insertError?.message ?? "Erro ao registrar o vídeo.");
      return;
    }

    if (widgetId) {
      const erroDasRegras = await salvarRegras(
        supabase,
        widgetId,
        criado.id,
        regras
      );
      if (erroDasRegras) {
        setLoading(false);
        setError(
          `O vídeo entrou, mas as regras não foram salvas: ${erroDasRegras.message}. Ajuste em "Onde aparece?" na lista de vídeos.`
        );
        router.refresh();
        return;
      }
    }

    setLoading(false);
    setUrl("");
    setName("");
    setRegras([]);
    router.refresh();
  }

  const faltando: string[] = [];
  if (!url.trim()) faltando.push("o link");
  if (!name.trim()) faltando.push("o nome do vídeo");
  if (regras.length === 0) faltando.push("onde ele vai aparecer");

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2"
    >
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://youtube.com/watch?v=..."
        className="rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do vídeo"
        className="rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <RegrasDoNovoVideo regras={regras} aoMudar={setRegras} />

      {faltando.length > 0 && (
        <p className="text-xs text-ink-faint">
          Falta {faltando.join(" e ")}.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || faltando.length > 0}
        className="btn-brand rounded-lg px-3 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Salvar vídeo"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

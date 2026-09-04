"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { extractYouTubeId } from "@/lib/youtube";

export default function YouTubeForm({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
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
    const { error: insertError } = await supabase.from("videos").insert({
      project_id: projectId,
      name: name.trim() || null,
      source_type: "youtube",
      youtube_id: youtubeId,
      thumbnail_url: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      status: "ready",
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setUrl("");
    setName("");
    router.refresh();
  }

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
        placeholder="Nome do vídeo (opcional)"
        className="rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <button
        type="submit"
        disabled={loading || !url}
        className="btn-brand rounded-lg px-3 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Adicionando..." : "Usar este vídeo"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuDoSite from "@/components/MenuDoSite";

/**
 * A casca de um site: menu à esquerda, conteúdo à direita.
 *
 * O menu vive aqui, e não dentro da página, para poder encostar na borda
 * esquerda da tela logo abaixo do logo — como no desenho. Dentro da
 * página ele ficaria preso à coluna centralizada do conteúdo.
 */
export default async function LayoutDoSite({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: projeto } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!projeto) notFound();

  const { count: videos } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("status", "ready");

  const { data: widgets } = await supabase
    .from("widgets")
    .select("id, is_active")
    .eq("project_id", id);

  const ids = (widgets ?? []).map((w) => w.id);
  const ativo = (widgets ?? []).some((w) => w.is_active);

  const { count: leads } = ids.length
    ? await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .in("widget_id", ids)
    : { count: 0 };

  const { count: regras } = ids.length
    ? await supabase
        .from("widget_page_rules")
        .select("id", { count: "exact", head: true })
        .in("widget_id", ids)
    : { count: 0 };

  const noAr = ativo && (videos ?? 0) > 0 && (regras ?? 0) > 0;

  return (
    <div className="lg:flex lg:items-start">
      {/* useSearchParams precisa de fronteira de Suspense: sem ela, a
          página inteira deixaria de ser renderizada no servidor. */}
      <Suspense fallback={<div className="hidden w-[260px] shrink-0 lg:block" />}>
        <MenuDoSite
          projectId={id}
          contagens={{ videos: videos ?? 0, leads: leads ?? 0 }}
          rodape={
            <>
              {/* O estado de verdade, e não um "operando 100%"
                  decorativo: widget ligado, com vídeo e com regra. */}
              <p className="flex items-center gap-2 rounded-lg bg-surface-soft px-3 py-2 text-xs text-ink-muted">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    noAr ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {noAr ? "Vídeo no ar neste site" : "Ainda não está no ar"}
              </p>
              <a
                href="https://wa.me/5527999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-surface-soft px-3 py-2 text-xs font-medium text-ink-muted hover:text-brand-blue"
              >
                Suporte via WhatsApp
              </a>
            </>
          }
        />
      </Suspense>

      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

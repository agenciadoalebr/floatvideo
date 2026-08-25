import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VideoUploader from "@/components/VideoUploader";
import YouTubeForm from "@/components/YouTubeForm";
import VideoList from "@/components/VideoList";
import WidgetPanel from "@/components/WidgetPanel";
import LeadsPanel from "@/components/LeadsPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import type { Project, Video, Widget, WidgetCta, Lead } from "@/lib/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single<Project>();

  if (!project) notFound();

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .returns<Video[]>();

  const { data: widget } = await supabase
    .from("widgets")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Widget>();

  let cta: WidgetCta | null = null;
  let leads: Lead[] = [];
  let eventCounts: Record<string, number> = {};
  let eventCountsByVideo: Record<string, Record<string, number>> = {};
  let unattributedEvents = 0;
  if (widget) {
    const { data } = await supabase
      .from("widget_ctas")
      .select("*")
      .eq("widget_id", widget.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<WidgetCta>();
    cta = data ?? null;

    // Leads e métricas somam TODOS os widgets do projeto, não só o atual:
    // um projeto pode ter tido widgets anteriores (com outro vídeo), e os
    // números deles continuam valendo como histórico do site. Filtrando
    // só pelo widget atual, esse histórico sumia da tela.
    const { data: widgetRows } = await supabase
      .from("widgets")
      .select("id")
      .eq("project_id", id);
    const widgetIds = (widgetRows ?? []).map((w) => w.id);

    const { data: leadsData } = await supabase
      .from("leads")
      .select("*")
      .in("widget_id", widgetIds)
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<Lead[]>();
    leads = leadsData ?? [];

    const { data: eventsData } = await supabase
      .from("widget_events")
      .select("event_type, video_id")
      .in("widget_id", widgetIds)
      .limit(20000);

    for (const e of eventsData ?? []) {
      eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1;
      if (e.video_id) {
        const perVideo = (eventCountsByVideo[e.video_id] ??= {});
        perVideo[e.event_type] = (perVideo[e.event_type] ?? 0) + 1;
      } else {
        // Eventos anteriores à coluna video_id: contam no total, mas não
        // dá pra dizer honestamente de qual vídeo vieram.
        unattributedEvents += 1;
      }
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{project.name}</h1>
        <p className="text-sm text-neutral-500">
          {project.domain || "Nenhum domínio definido"}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-700">1. Vídeo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <VideoUploader projectId={project.id} />
          <YouTubeForm projectId={project.id} />
        </div>
        <VideoList videos={videos ?? []} projectId={project.id} widget={widget} />
      </section>

      <section id="widget-panel" className="space-y-4 scroll-mt-4">
        <h2 className="text-sm font-semibold text-neutral-700">
          2. Widget flutuante
        </h2>
        <WidgetPanel
          projectId={project.id}
          embedKey={project.embed_key}
          videos={videos ?? []}
          widget={widget}
          cta={cta}
        />
      </section>

      {widget && (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-700">3. Leads</h2>
            <LeadsPanel leads={leads} />
          </section>

          <section id="metrics-panel" className="space-y-4 scroll-mt-4">
            <h2 className="text-sm font-semibold text-neutral-700">
              4. Métricas{" "}
              <span className="font-normal text-neutral-400">
                — por vídeo ou tudo somado
              </span>
            </h2>
            <AnalyticsPanel
              totals={eventCounts}
              byVideo={eventCountsByVideo}
              videos={videos ?? []}
              unattributed={unattributedEvents}
            />
          </section>
        </>
      )}
    </div>
  );
}

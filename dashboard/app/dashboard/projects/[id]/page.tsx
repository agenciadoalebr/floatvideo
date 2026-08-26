import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VideoUploader from "@/components/VideoUploader";
import YouTubeForm from "@/components/YouTubeForm";
import VideoList from "@/components/VideoList";
import WidgetPanel from "@/components/WidgetPanel";
import LeadsPanel from "@/components/LeadsPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import ProjectTabs from "@/components/ProjectTabs";
import EmbedCodeBox from "@/components/EmbedCodeBox";
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
  const eventCounts: Record<string, number> = {};
  const eventCountsByVideo: Record<string, Record<string, number>> = {};
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
    // números deles continuam valendo como histórico do site.
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

  const readyVideos = (videos ?? []).filter((v) => v.status === "ready");
  const ativo = !!widget?.is_active;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-xs text-neutral-400 hover:text-brand-blue"
        >
          ← Seus sites
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-ink">{project.name}</h1>
          {widget && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                ativo
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-neutral-200 text-neutral-600"
              }`}
            >
              {ativo ? "Widget ativo" : "Widget pausado"}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-neutral-500">
          {project.domain || "Nenhum domínio definido — o widget funciona em qualquer site"}
        </p>
      </div>

      <ProjectTabs
        tabs={[
          {
            id: "videos",
            label: "Vídeos",
            count: readyVideos.length,
            content: (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <VideoUploader projectId={project.id} />
                  <YouTubeForm projectId={project.id} />
                </div>
                <VideoList
                  videos={videos ?? []}
                  projectId={project.id}
                  widget={widget}
                />
              </div>
            ),
          },
          {
            id: "widget",
            label: "Widget",
            content: (
              <WidgetPanel
                projectId={project.id}
                videos={videos ?? []}
                widget={widget}
                cta={cta}
              />
            ),
          },
          {
            id: "instalacao",
            label: "Instalação",
            content: <EmbedCodeBox embedKey={project.embed_key} />,
          },
          {
            id: "leads",
            label: "Leads",
            count: leads.length,
            content: widget ? (
              <LeadsPanel leads={leads} />
            ) : (
              <VazioSemWidget />
            ),
          },
          {
            id: "metricas",
            label: "Métricas",
            content: widget ? (
              <AnalyticsPanel
                totals={eventCounts}
                byVideo={eventCountsByVideo}
                videos={videos ?? []}
                unattributed={unattributedEvents}
              />
            ) : (
              <VazioSemWidget />
            ),
          },
        ]}
      />
    </div>
  );
}

function VazioSemWidget() {
  return (
    <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
      Configure o widget primeiro — os dados aparecem aqui depois que ele
      começar a rodar no site.
    </p>
  );
}

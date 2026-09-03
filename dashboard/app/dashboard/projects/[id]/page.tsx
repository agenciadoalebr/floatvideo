import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VideoUploader from "@/components/VideoUploader";
import YouTubeForm from "@/components/YouTubeForm";
import PainelDeVideos from "@/components/PainelDeVideos";
import {
  IconeVideos,
  IconeUpload,
  IconeWidget,
  IconeBotao,
  IconeCodigo,
  IconeAnalytics,
  IconeLeads,
  IconeMetricas,
} from "@/components/IconesDoMenu";
import WidgetPanel from "@/components/WidgetPanel";
import LeadsPanel from "@/components/LeadsPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import ProjectTabs from "@/components/ProjectTabs";
import ProjectDomainField from "@/components/ProjectDomainField";
import CtaPanel from "@/components/CtaPanel";
import AnalyticsSettings from "@/components/AnalyticsSettings";
import { gtmConfigurado } from "@/lib/gtm";
import PrimeirosPassos from "@/components/PrimeirosPassos";
import EmbedCodeBox from "@/components/EmbedCodeBox";
import type { Project, Video, Widget, WidgetCta, Lead, PageRule } from "@/lib/types";

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
  let pageRules: PageRule[] = [];
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

    const { data: rulesData } = await supabase
      .from("widget_page_rules")
      .select("*")
      .eq("widget_id", widget.id)
      .order("created_at", { ascending: true })
      .returns<PageRule[]>();
    pageRules = rulesData ?? [];

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
        <ProjectDomainField projectId={project.id} domain={project.domain} />
      </div>

      {/* Guia do primeiro acesso. Some sozinho quando o widget registra a
          primeira exibição — ou seja, quando o site está de fato no ar. */}
      <PrimeirosPassos
        temVideo={readyVideos.length > 0}
        temRegra={pageRules.length > 0}
        jaApareceu={(eventCounts.impression ?? 0) > 0}
      />

      <ProjectTabs
        rodape={
          <>
            {/* O estado de verdade, e não um "operando 100%" decorativo:
                é widget ligado com vídeo escolhido e regra de página. */}
            <p className="flex items-center gap-2 rounded-lg bg-surface-card px-3 py-2 text-xs text-ink-muted">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  ativo && readyVideos.length > 0 && pageRules.length > 0
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                }`}
              />
              {ativo && readyVideos.length > 0 && pageRules.length > 0
                ? "Vídeo no ar neste site"
                : "Ainda não está no ar"}
            </p>
            <a
              href="https://wa.me/5527999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg bg-surface-card px-3 py-2 text-xs font-medium text-ink-muted hover:text-brand-blue"
            >
              Suporte via WhatsApp
            </a>
          </>
        }
        tabs={[
          {
            id: "videos",
            icone: IconeVideos,
            label: "Vídeos",
            grupo: "Conteúdo",
            count: readyVideos.length,
            content:
              (videos ?? []).length > 0 ? (
                <PainelDeVideos
                  videos={videos ?? []}
                  projectId={project.id}
                  widget={widget}
                  cta={cta}
                  pageRules={pageRules}
                  leads={leads}
                  eventos={eventCounts}
                  dominio={project.domain}
                />
              ) : (
                <p className="cartao p-4 text-sm text-ink-muted">
                  Nenhum vídeo ainda. Vá em <strong>Upload</strong>, no menu ao
                  lado, para enviar um arquivo ou colar um link do YouTube.
                </p>
              ),
          },
          {
            id: "upload",
            icone: IconeUpload,
            label: "Upload",
            grupo: "Conteúdo",
            content: (
              <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                <VideoUploader projectId={project.id} />
                <YouTubeForm projectId={project.id} />
              </div>
            ),
          },
          {
            id: "widget",
            icone: IconeWidget,
            label: "Widget",
            grupo: "Aparência",
            content: (
              <WidgetPanel
                // A key remonta o painel quando o vídeo do widget muda no
                // servidor. É necessária porque as abas ficam montadas: sem
                // ela, clicar "Editar widget" no card de um vídeo atualizava
                // o banco mas o seletor continuava exibindo o vídeo anterior,
                // já que o estado inicial só é lido na primeira montagem.
                key={widget?.video_id ?? "sem-widget"}
                projectId={project.id}
                videos={videos ?? []}
                widget={widget}
              />
            ),
          },
          {
            id: "cta",
            icone: IconeBotao,
            label: "Botão de ação",
            grupo: "Aparência",
            content: <CtaPanel widget={widget} cta={cta} />,
          },
          {
            id: "instalacao",
            icone: IconeCodigo,
            label: "Instalação",
            grupo: "Publicação",
            content: (
              <EmbedCodeBox
                embedKey={project.embed_key}
                projectId={project.id}
                gtmDisponivel={gtmConfigurado()}
              />
            ),
          },
          {
            id: "analytics",
            icone: IconeAnalytics,
            label: "Analytics do site",
            grupo: "Publicação",
            content: (
              <AnalyticsSettings widget={widget} />
            ),
          },
          {
            id: "leads",
            icone: IconeLeads,
            label: "Leads",
            grupo: "Resultados",
            count: leads.length,
            content: widget ? (
              <LeadsPanel leads={leads} />
            ) : (
              <VazioSemWidget />
            ),
          },
          {
            id: "metricas",
            icone: IconeMetricas,
            label: "Métricas",
            grupo: "Resultados",
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

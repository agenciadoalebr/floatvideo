import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PainelDeUpload from "@/components/PainelDeUpload";
import PainelDeVideos from "@/components/PainelDeVideos";
import WidgetPanel from "@/components/WidgetPanel";
import LeadsPanel from "@/components/LeadsPanel";
import AnalyticsPanel, { type Metricas } from "@/components/AnalyticsPanel";
import { secaoValida } from "@/components/secoes";
import ProjectDomainField from "@/components/ProjectDomainField";
import CtaPanel from "@/components/CtaPanel";
import AnalyticsSettings from "@/components/AnalyticsSettings";
import { gtmConfigurado } from "@/lib/gtm";
import PrimeirosPassos from "@/components/PrimeirosPassos";
import EmbedCodeBox from "@/components/EmbedCodeBox";
import type { Project, Video, Widget, WidgetCta, Lead, PageRule } from "@/lib/types";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ secao?: string }>;
}) {
  const { id } = await params;
  const { secao } = await searchParams;
  const ativa = secaoValida(secao);
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

    // Contagem feita no banco. Ler linha a linha para somar aqui
    // parava no teto de linhas do PostgREST, e a soma saía errada sem
    // nenhum aviso — um site com 2.981 aparições mostrava 673.
    const { data: contagens } = await supabase.rpc("contar_eventos_do_site", {
      p_project_id: id,
    });

    for (const c of (contagens ?? []) as unknown as {
      video_id: string | null;
      event_type: string;
      total: number;
    }[]) {
      eventCounts[c.event_type] = (eventCounts[c.event_type] ?? 0) + c.total;
      if (c.video_id) {
        const perVideo = (eventCountsByVideo[c.video_id] ??= {});
        perVideo[c.event_type] = (perVideo[c.event_type] ?? 0) + c.total;
      }
    }
  }

  // O primeiro período das Métricas vem pronto do servidor; a troca de
  // período depois disso acontece no navegador.
  const { data: metricas } = widget
    ? await supabase.rpc("metricas_do_site", {
        p_project_id: id,
        p_dias: 30,
      })
    : { data: null };

  const readyVideos = (videos ?? []).filter((v) => v.status === "ready");

  return (
    <div className="space-y-6">
      {/* Guia do primeiro acesso. Some sozinho quando o widget registra a
          primeira exibição — ou seja, quando o site está de fato no ar. */}
      <PrimeirosPassos
        temVideo={readyVideos.length > 0}
        temRegra={pageRules.length > 0}
        jaApareceu={(eventCounts.impression ?? 0) > 0}
      />

      {/* Só a seção pedida é montada. Antes todas ficavam montadas e
          escondidas, porque a aba ativa vivia em memória; agora ela vive
          na URL, então trocar de seção é navegar — com o botão de voltar
          do navegador funcionando e o link de uma seção podendo ser
          compartilhado. */}
      {
        ({
        videos: ((videos ?? []).length > 0 ? (
                <PainelDeVideos
                  videos={videos ?? []}
                  widget={widget}
                  pageRules={pageRules}
                  dominio={project.domain}
                />
              ) : (
                <p className="cartao p-4 text-sm text-ink-muted">
                  Nenhum vídeo ainda. Vá em <strong>Upload</strong>, no menu ao
                  lado, para enviar um arquivo ou colar um link do YouTube.
                </p>
              )),
        upload: (
          <PainelDeUpload
            projectId={project.id}
            widgetId={widget?.id ?? null}
            widgetAtivo={!!widget?.is_active}
            siteConectado={(eventCounts.impression ?? 0) > 0}
            temCta={!!cta}
            totalDeVideos={(videos ?? []).length}
          />
        ),
        widget: ((
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
            )),
        cta: (<CtaPanel widget={widget} cta={cta} />),
        instalacao: (
          <div className="space-y-4">
            <div className="cartao p-4">
              <p className="rotulo-metrica">Domínio deste site</p>
              <ProjectDomainField
                projectId={project.id}
                domain={project.domain}
              />
            </div>
            <EmbedCodeBox
              embedKey={project.embed_key}
              projectId={project.id}
              gtmDisponivel={gtmConfigurado()}
              sinais={eventCounts.impression ?? 0}
            />
          </div>
        ),
        analytics: ((
              <AnalyticsSettings widget={widget} />
            )),
        leads: (widget ? (
              <LeadsPanel leads={leads} videos={videos ?? []} />
            ) : (
              <VazioSemWidget />
            )),
        metricas: (widget ? (
          <AnalyticsPanel
            projectId={project.id}
            inicial={(metricas ?? null) as unknown as Metricas | null}
          />
        ) : (
          <VazioSemWidget />
        )),
        } as Record<string, React.ReactNode>)[ativa]
      }
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

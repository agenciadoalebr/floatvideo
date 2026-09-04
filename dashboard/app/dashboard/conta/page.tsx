import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "@/components/PasswordForm";
import Assinatura, {
  type Plano,
  type AssinaturaAtual,
} from "@/components/Assinatura";
import { asaasConfigurado } from "@/lib/asaas";
import Conteudo from "@/components/Conteudo";

function data(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

/** "1 ano e 4 meses", como o desenho — dito em português, não em dias. */
function tempoDeCasa(iso: string | undefined) {
  if (!iso) return null;
  const meses = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 86400000))
  );
  if (meses < 1) return "menos de um mês";
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return (
    `${anos} ${anos === 1 ? "ano" : "anos"}` +
    (resto ? ` e ${resto} ${resto === 1 ? "mês" : "meses"}` : "")
  );
}

export default async function ContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select(
      "role, organization_id, organizations(name, plan, created_at, max_projects, plans(nome, preco_centavos, max_projects, descricao))"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const org = membership?.organizations as
    | {
        name: string;
        plan: string;
        created_at: string;
        max_projects: number | null;
        plans: {
          nome: string;
          preco_centavos: number;
          max_projects: number | null;
          descricao: string | null;
        } | null;
      }
    | undefined;

  // Quem foi convidado para a conta de outra pessoa não vê o plano: ele
  // não é dela, e não há nada ali que essa pessoa decida.
  const ehDono = membership?.role === "owner";
  const podeConvidar = ["owner", "admin"].includes(membership?.role ?? "");

  const { count: sites } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  const { count: pessoas } = await supabase
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", membership?.organization_id ?? "");

  const plano = org?.plans;

  // Assinatura e planos só interessam a quem é dono da conta; quem foi
  // convidado nem vê este bloco.
  const { data: assinatura } = ehDono
    ? await supabase
        .from("subscriptions")
        .select(
          "plan, status, trial_ends_at, current_period_end, overdue_since, invoice_url"
        )
        .eq("organization_id", membership?.organization_id ?? "")
        .maybeSingle()
    : { data: null };

  const { data: planosPublicos } = ehDono
    ? await supabase
        .from("plans")
        .select("id, nome, preco_centavos, max_projects, descricao, trial_dias")
        .eq("publico", true)
        .order("ordem")
    : { data: null };

  const limiteSites = org?.max_projects ?? plano?.max_projects ?? null;
  const usados = sites ?? 0;
  const proporcao =
    limiteSites && limiteSites > 0
      ? Math.min(100, Math.round((usados / limiteSites) * 100))
      : null;

  return (
    <Conteudo>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Configurações da conta
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {org?.name ? `${org.name} · ` : ""}
            {user.email}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-6">
            {ehDono && asaasConfigurado() && (
              <section>
                <h2 className="text-base font-semibold text-brand-ink">
                  Assinatura e cobrança
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  O que você paga, quando, e como parar de pagar.
                </p>
                <div className="mt-3">
                  <Assinatura
                    planos={(planosPublicos ?? []) as Plano[]}
                    atual={(assinatura ?? null) as AssinaturaAtual}
                    nomeDaConta={org?.name ?? ""}
                  />
                </div>
              </section>
            )}

            {ehDono && (
              <section id="plano">
                <h2 className="text-base font-semibold text-brand-ink">
                  Uso do plano
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Quanto do seu plano você está usando hoje.
                </p>

                <div className="cartao mt-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm text-ink-muted">
                      Cliente desde {data(org?.created_at)}
                      {tempoDeCasa(org?.created_at)
                        ? ` · ${tempoDeCasa(org?.created_at)}`
                        : ""}
                    </p>
                    <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-medium text-brand-blue">
                      {plano?.nome ?? "—"}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="flex items-baseline justify-between text-sm">
                      <span className="text-ink-muted">Sites cadastrados</span>
                      <span className="font-medium text-brand-ink">
                        {usados} de {limiteSites ?? "∞"}
                        {proporcao !== null && (
                          <span className="ml-1 text-xs text-ink-faint">
                            ({proporcao}%)
                          </span>
                        )}
                      </span>
                    </p>
                    <div className="mt-2 h-2 rounded-full bg-surface-muted">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet"
                        style={{ width: `${proporcao ?? 4}%` }}
                      />
                    </div>
                  </div>

                  {/* Vídeos e visualizações não têm barra porque não têm
                      teto: barra vazia sugeriria um limite que a gente não
                      cobra, e o ilimitado é argumento de venda. */}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Vídeos", "sem limite"],
                      ["Visualizações", "sem limite"],
                    ].map(([rotulo, valor]) => (
                      <div
                        key={rotulo}
                        className="rounded-xl bg-surface-soft p-3"
                      >
                        <p className="rotulo-metrica">{rotulo}</p>
                        <p className="mt-1 text-sm font-medium text-brand-ink">
                          {valor}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 border-t border-outline-soft pt-4 text-sm text-ink-muted">
                    Precisa de mais sites? Fale com a gente em{" "}
                    <a
                      href="mailto:contato@floatvideo.com.br"
                      className="font-medium text-brand-blue hover:underline"
                    >
                      contato@floatvideo.com.br
                    </a>
                    .
                  </p>
                </div>
              </section>
            )}

            <section id="senha">
              <h2 className="text-base font-semibold text-brand-ink">
                Senha e acesso
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Ao menos 8 caracteres. Você continua conectado nos aparelhos
                onde já entrou.
              </p>
              <div className="cartao mt-3 p-5">
                <PasswordForm />
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section id="equipe" className="cartao p-5">
              <h2 className="text-base font-semibold text-brand-ink">Equipe</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {pessoas === 1
                  ? "Só você tem acesso a esta conta."
                  : `${pessoas} pessoas têm acesso a esta conta.`}
              </p>

              {podeConvidar ? (
                <>
                  <p className="mt-3 text-xs text-ink-faint">
                    Quem você convida entra como editor: pode enviar vídeos e
                    configurar o widget, mas não vê nem mexe no plano.
                  </p>
                  <Link
                    href="/dashboard/team"
                    className="mt-4 block rounded-lg border border-outline-soft px-4 py-2.5 text-center text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                  >
                    Convidar e gerenciar
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-xs text-ink-faint">
                  Quem administra a conta pode convidar mais pessoas.
                </p>
              )}
            </section>

            <section className="cartao p-5">
              <h2 className="text-base font-semibold text-brand-ink">
                Precisa de ajuda?
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                A gente responde no WhatsApp e ajuda a instalar o primeiro
                vídeo com você.
              </p>
              <a
                href="https://wa.me/5511967136667"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block rounded-lg border border-outline-soft px-4 py-2.5 text-center text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
              >
                Falar no WhatsApp
              </a>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-outline-soft pt-3 text-xs">
                <Link
                  href="/termos"
                  className="text-ink-faint hover:text-brand-blue"
                >
                  Termos de uso
                </Link>
                <Link
                  href="/privacidade"
                  className="text-ink-faint hover:text-brand-blue"
                >
                  Política de privacidade
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Conteudo>
  );
}

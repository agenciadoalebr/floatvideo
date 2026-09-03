import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountMenu from "@/components/AccountMenu";
import SeletorDeSite, { type SiteDoMenu } from "@/components/SeletorDeSite";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canManageUsers = false;
  let ehAdminDaPlataforma = false;
  let ehDonoDaConta = false;
  if (user) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    // Autenticado sem organização é quem entrou pelo Google sem
    // convite: não há painel para essa pessoa até o código ser usado.
    if (!membership) {
      redirect("/completar-cadastro");
    }

    canManageUsers = !!membership && ["owner", "admin"].includes(membership.role);
    ehDonoDaConta = membership?.role === "owner";

    const { data: admin } = await supabase.rpc("e_admin_da_plataforma");
    ehAdminDaPlataforma = !!admin;
  }

  // O cabeçalho precisa saber os sites para o seletor. São poucos por
  // conta (o plano maior cobre cinco), então a consulta é barata.
  const { data: sites } = await supabase
    .from("projects")
    .select("id, name, domain, widgets(is_active)")
    .order("created_at", { ascending: false });

  const paraOMenu: SiteDoMenu[] = (sites ?? []).map((s) => ({
    id: s.id,
    nome: s.name,
    dominio: s.domain,
    ativo: (s.widgets as { is_active: boolean }[] | null)?.some(
      (w) => w.is_active
    ) ?? false,
  }));

  return (
    <div className="min-h-screen bg-surface">
      {/* Cabeçalho de largura total, fixo no topo: é a moldura do produto
          inteiro, e encolher para o meio da tela era desperdiçar as duas
          pontas — justamente onde ficam a identidade e a conta. */}
      <header className="sticky top-0 z-30 border-b border-outline-soft bg-surface-card/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-floatvideo.webp"
                alt="FloatVideo"
                className="h-8 w-auto"
              />
            </Link>

            <SeletorDeSite sites={paraOMenu} />

            {/* Links de administração da plataforma. Para o cliente, a
                equipe dele fica no menu da conta: ali é o lugar do que é
                "meu", e o cabeçalho continua sendo o dos vídeos. */}
            {ehAdminDaPlataforma && (
              <nav className="hidden items-center gap-4 lg:flex">
                <span className="h-8 w-px bg-outline-soft" />
                {[
                  ["/dashboard/team", "Usuários"],
                  ["/dashboard/contas", "Contas"],
                  ["/dashboard/convites", "Convites"],
                ].map(([href, rotulo]) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm text-ink-muted hover:text-brand-blue"
                  >
                    {rotulo}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden text-sm text-ink-muted hover:text-brand-blue sm:block"
            >
              Seus sites
            </Link>
            <AccountMenu
              email={user?.email ?? ""}
              ehAdminDaPlataforma={ehAdminDaPlataforma}
              podeGerenciarEquipe={canManageUsers}
              ehDonoDaConta={ehDonoDaConta}
            />
          </div>
        </div>
      </header>

      {/* Sem coluna central aqui: dentro de um site o menu precisa
          encostar na borda esquerda, logo abaixo do logo. Quem define o
          respiro é cada tela, pelo componente Conteudo. */}
      <main>{children}</main>
    </div>
  );
}

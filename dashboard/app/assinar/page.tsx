import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Checkout, { type PlanoPublico } from "@/components/Checkout";
import { asaasConfigurado } from "@/lib/asaas";

export const metadata = {
  title: "Assinar — FloatVideo",
  description:
    "Crie sua conta no FloatVideo e comece com dias grátis. Sem fidelidade.",
};

/**
 * Compra pela landing.
 *
 * A conta e a assinatura nascem juntas: é o pagamento que dá acesso, e
 * pedir os dados duas vezes (uma para cadastrar, outra para assinar)
 * seria motivo de desistência no meio.
 */
export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string; codigo?: string }>;
}) {
  const { plano = "", codigo = "" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Quem já tem conta não assina por aqui: o painel tem a tela dele, com
  // o estado da assinatura que ele já possa ter.
  if (user) {
    const { count } = await supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count) redirect("/dashboard/conta");
  }

  const { data: planos } = await supabase
    .from("plans")
    .select(
      "id, nome, preco_centavos, max_projects, descricao, trial_dias, trial_dias_convite"
    )
    .eq("publico", true)
    .order("ordem")
    .returns<PlanoPublico[]>();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-outline-soft bg-surface-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-floatvideo.webp"
              alt="FloatVideo"
              className="h-8 w-auto"
            />
          </Link>
          <p className="text-sm text-ink-muted">
            Já tem uma conta?{" "}
            <Link
              href="/login"
              className="font-medium text-brand-blue hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 lg:py-14">
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-brand-blue">
            Comece com 7 dias grátis
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-ink">
            Coloque seu vídeo para vender no seu site
          </h1>
          <p className="mt-2 text-ink-muted">
            Configure em poucos minutos, sem programador. Nada é cobrado hoje
            e você cancela quando quiser, pelo próprio painel.
          </p>
        </div>

        <div className="mt-8">
          {asaasConfigurado() ? (
            <Checkout
              planos={planos ?? []}
              planoInicial={plano}
              codigoInicial={codigo.toUpperCase()}
              jaLogado={Boolean(user)}
            />
          ) : (
            <p className="cartao p-6 text-sm text-ink-muted">
              A assinatura on-line está temporariamente indisponível. Fale com a
              gente em{" "}
              <a
                href="mailto:contato@floatvideo.com.br"
                className="font-medium text-brand-blue hover:underline"
              >
                contato@floatvideo.com.br
              </a>
              .
            </p>
          )}
        </div>
      </main>

      <footer className="mt-8 border-t border-outline-soft">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-faint sm:flex-row">
          <span>© {new Date().getFullYear()} FloatVideo — Agência do Alê</span>
          <span className="flex gap-4">
            <Link href="/termos" className="hover:text-brand-blue">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-brand-blue">
              Privacidade
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

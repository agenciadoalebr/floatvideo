import { createAdminClient } from "@/lib/supabase/admin";
import { lerSessao } from "@/lib/envioCelular";
import EnvioPeloCelular from "@/components/EnvioPeloCelular";

/** Moldura das duas respostas possíveis: o envio, ou o motivo de não dar. */
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-floatvideo.webp"
          alt="FloatVideo"
          className="mx-auto h-8 w-auto"
        />
        {children}
      </div>
    </div>
  );
}

/**
 * A página do QR code, aberta no celular.
 *
 * Sem login: quem chega aqui está com a câmera na mão, não com a senha.
 * O token do link é a credencial, vale uma hora e só serve para mandar
 * arquivo — ver o que já foi enviado exige sessão, em outra rota.
 */
export default async function EnviarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const leitura = await lerSessao(token);

  if (!leitura.ok) {
    return (
      <Moldura>
        <div className="cartao p-6 text-center">
          <h1 className="text-lg font-semibold text-brand-ink">
            Link indisponível
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{leitura.erro}</p>
        </div>
      </Moldura>
    );
  }

  const admin = createAdminClient();
  const { data: projeto } = await admin
    .from("projects")
    .select("name")
    .eq("id", leitura.sessao.project_id)
    .maybeSingle();

  return (
    <Moldura>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
          Envie seu vídeo
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Escolha o vídeo que está no celular. Ele aparece na hora na tela do
          computador, em{" "}
          <strong className="text-brand-ink">{projeto?.name ?? "seu site"}</strong>
          .
        </p>
      </div>

      <EnvioPeloCelular token={token} nomeDoSite={projeto?.name ?? "seu site"} />
    </Moldura>
  );
}

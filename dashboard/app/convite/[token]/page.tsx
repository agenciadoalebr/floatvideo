import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AceitarConvite from "@/components/AceitarConvite";

type Convite = {
  email: string;
  papel: string;
  conta: string;
  aceito: boolean;
  vencido: boolean;
};

/** Moldura comum das três respostas possíveis desta página. */
function Moldura({
  titulo,
  linha,
  children,
}: {
  titulo: string;
  linha: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-floatvideo.webp"
            alt="FloatVideo"
            className="h-10 w-auto"
          />
          <h1 className="text-xl font-semibold text-brand-ink">{titulo}</h1>
          <p className="text-sm text-ink-muted">{linha}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Consulta sem sessão: quem abre este link ainda não tem conta. O
  // token é a credencial, e a função no banco só devolve o que a tela
  // precisa mostrar.
  const supabase = await createClient();
  const { data } = await supabase.rpc("convite_por_token", { p_token: token });
  const convite = data as Convite | null;

  if (!convite) {
    return (
      <Moldura
        titulo="Convite não encontrado"
        linha="O link pode ter sido digitado errado ou o convite foi cancelado."
      >
        <Link
          href="/login"
          className="block text-center text-sm text-brand-blue hover:underline"
        >
          Ir para o login
        </Link>
      </Moldura>
    );
  }

  if (convite.aceito) {
    return (
      <Moldura
        titulo="Este convite já foi usado"
        linha={`Você já faz parte de ${convite.conta}. Entre com ${convite.email}.`}
      >
        <Link
          href="/login"
          className="btn-brand block rounded-lg px-3 py-2 text-center text-sm font-medium"
        >
          Fazer login
        </Link>
      </Moldura>
    );
  }

  if (convite.vencido) {
    return (
      <Moldura
        titulo="Este convite venceu"
        linha="Convites valem 7 dias. Peça um novo para quem te convidou."
      >
        <Link
          href="/login"
          className="block text-center text-sm text-brand-blue hover:underline"
        >
          Ir para o login
        </Link>
      </Moldura>
    );
  }

  return (
    <Moldura
      titulo={`Bem-vindo à ${convite.conta}`}
      linha="Escolha uma senha para entrar no painel."
    >
      <AceitarConvite
        token={token}
        email={convite.email}
        conta={convite.conta}
      />
      <p className="text-center text-xs text-ink-faint">
        Você entra como <strong>{convite.papel}</strong>: sobe vídeos e
        configura o widget. A cobrança é de quem administra a conta.
      </p>
      <p className="text-center text-xs text-ink-faint">
        Ao criar a conta você concorda com os{" "}
        <Link href="/termos" className="underline hover:text-ink-muted">
          termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline hover:text-ink-muted">
          política de privacidade
        </Link>
        .
      </p>
    </Moldura>
  );
}

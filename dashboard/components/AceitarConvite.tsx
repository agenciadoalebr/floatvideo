"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * A tela em que o convidado escolhe a senha.
 *
 * O e-mail não é editável: ele veio do convite, e deixar trocar aqui
 * abriria a porta para entrar na conta de outra pessoa com um link que
 * não era para você.
 */
export default function AceitarConvite({
  token,
  email,
  conta,
}: {
  token: string;
  email: string;
  conta: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (senha !== confirma) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (senha.length < 8) {
      setErro("Use uma senha com pelo menos 8 caracteres.");
      return;
    }

    setEnviando(true);
    const resposta = await fetch("/api/convite/aceitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, nome, senha }),
    });
    const dados = await resposta.json();
    setEnviando(false);

    if (!resposta.ok) {
      setErro(dados.error ?? "Não foi possível aceitar o convite.");
      return;
    }

    if (dados.jaTinhaConta) {
      setAviso(
        `Você já tinha conta no FloatVideo com este e-mail, então continua com a mesma senha de sempre. Agora ela também dá acesso a ${conta}.`
      );
      return;
    }

    if (dados.precisaEntrar) {
      setAviso("Conta criada. Entre com o e-mail e a senha que você acabou de escolher.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (aviso) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-ink-muted">{aviso}</p>
        <Link
          href="/login"
          className="btn-brand block rounded-lg px-3 py-2 text-sm font-medium"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-3">
      <div className="rounded-lg bg-surface-soft px-3 py-2 text-sm">
        <p className="rotulo-metrica">Seu acesso</p>
        <p className="mt-0.5 text-brand-ink">{email}</p>
      </div>
      <input
        placeholder="Seu nome (opcional)"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <input
        type="password"
        required
        placeholder="Crie uma senha"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        className="w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <input
        type="password"
        required
        placeholder="Confirme a senha"
        value={confirma}
        onChange={(e) => setConfirma(e.target.value)}
        className="w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <button
        type="submit"
        disabled={enviando}
        className="btn-brand w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? "Entrando..." : "Criar senha e entrar"}
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </form>
  );
}

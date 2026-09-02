"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PasswordForm() {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);

    if (senha.length < 8) {
      setErro("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não coincidem.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setSenha("");
    setConfirma("");
    setSalvo(true);
  }

  return (
    <form
      onSubmit={salvar}
      className="max-w-md space-y-3 rounded-lg border border-neutral-200 bg-white p-5"
    >
      <div>
        <h2 className="text-sm font-semibold text-neutral-700">Alterar senha</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Você continua conectado nos aparelhos onde já entrou.
        </p>
      </div>

      <label className="block">
        <span className="text-xs text-neutral-600">Nova senha</span>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />
      </label>
      <label className="block">
        <span className="text-xs text-neutral-600">Confirme a nova senha</span>
        <input
          type="password"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar nova senha"}
        </button>
        {salvo && !erro && (
          <span role="status" className="text-xs font-medium text-emerald-700">
            Senha alterada.
          </span>
        )}
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </form>
  );
}

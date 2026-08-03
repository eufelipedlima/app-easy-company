"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MeuPerfilPage() {
  const [loading, setLoading] = useState(true);
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [cargo, setCargo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");

      const { data: funcionario } = await supabase
        .from("funcionarios")
        .select("cargo, cargo_id, cargos ( nome ), papeis ( pessoa_id, pessoas ( id, nome, apelido ) )")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const f = funcionario as unknown as {
        cargo: string | null;
        cargos: { nome: string } | null;
        papeis: { pessoa_id: string; pessoas: { id: string; nome: string; apelido: string | null } | null } | null;
      } | null;

      setCargo(f?.cargos?.nome ?? f?.cargo ?? null);
      setPessoaId(f?.papeis?.pessoas?.id ?? null);
      setNome(f?.papeis?.pessoas?.nome ?? "");
      setApelido(f?.papeis?.pessoas?.apelido ?? "");
      setLoading(false);
    }
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pessoaId) return;
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    const supabase = createClient();
    const { error } = await supabase.from("pessoas").update({ apelido: apelido.trim() || null }).eq("id", pessoaId);
    setSalvando(false);
    if (error) {
      setErro(error.message);
    } else {
      setSucesso(true);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (!pessoaId) {
    return (
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="text-2xl font-extrabold text-ink mb-2">Meu perfil</h1>
        <p className="text-sm text-ink/60">
          Você ainda não tem um cadastro de Funcionário vinculado à sua conta. Peça pra alguém com
          acesso de Administrador te cadastrar em Pessoas → Funcionários.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-2xl font-extrabold text-ink mb-1">Meu perfil</h1>
      <p className="text-sm text-ink/60 mb-8">Como você aparece pro resto da equipe no Chat e nas tarefas.</p>

      <form onSubmit={salvar} className="space-y-4">
        <div className="rounded-2xl bg-card border border-black/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink/50">Nome completo</span>
            <span className="text-sm font-semibold text-ink">{nome}</span>
          </div>
          {cargo && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink/50">Cargo</span>
              <span className="text-sm font-semibold text-ink">{cargo}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink/50">E-mail de login</span>
            <span className="text-sm font-semibold text-ink">{email}</span>
          </div>
          <p className="text-xs text-ink/40 pt-1 border-t border-black/5">
            Nome, cargo e e-mail são editados em Pessoas → Funcionários.
          </p>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Como você quer ser chamado?</span>
          <input
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            className="input"
            placeholder={nome || "Ex: Felipe, Bia..."}
          />
          <span className="block text-xs text-ink/40 mt-1">
            Esse é o nome que aparece no Chat e nas tarefas. Deixe em branco pra usar seu nome completo.
          </span>
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {sucesso && <p className="text-sm text-forest font-semibold">Salvo!</p>}

        <button
          type="submit"
          disabled={salvando}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </main>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";

interface Pessoa {
  id: string;
  tipo_pessoa: "PF" | "PJ";
  nome: string;
  razao_social: string | null;
  documento: string;
  email: string | null;
  whatsapp: string | null;
  cidade: string | null;
  created_at: string;
}

export default function PessoasPage() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("pessoas")
      .select("id, tipo_pessoa, nome, razao_social, documento, email, whatsapp, cidade, created_at")
      .order("created_at", { ascending: false });
    setPessoas(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Pessoas</h1>
          <p className="text-sm text-ink/60 mt-1">
            Cadastro central de clientes, funcionários e parceiros da Easy Company.
          </p>
        </div>
        {!painelAberto && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPainelAberto(true)}
              className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
            >
              + Nova pessoa
            </button>
            <button
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="text-sm font-semibold text-ink/50 hover:text-ink"
            >
              Sair
            </button>
          </div>
        )}
      </div>

      {painelAberto && (
        <div className="mb-8 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-6">Cadastrar pessoa</h2>
          <PessoaForm
            onSaved={() => {
              setPainelAberto(false);
              carregar();
            }}
            onCancel={() => setPainelAberto(false)}
          />
        </div>
      )}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : pessoas.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">
            Nenhuma pessoa cadastrada ainda. Clique em &ldquo;Nova pessoa&rdquo; pra começar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Documento</th>
                <th className="px-6 py-3 font-medium">Contato</th>
                <th className="px-6 py-3 font-medium">Cidade</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
                  <td className="px-6 py-3 font-semibold text-ink">
                    {p.nome}
                    {p.razao_social && (
                      <span className="block text-xs font-normal text-ink/50">{p.razao_social}</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.tipo_pessoa === "PJ" ? "bg-mint text-forest" : "bg-surface text-ink/70"
                      }`}
                    >
                      {p.tipo_pessoa}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-ink/70">{p.documento}</td>
                  <td className="px-6 py-3 text-ink/70">
                    {p.email && <span className="block">{p.email}</span>}
                    {p.whatsapp && <span className="block text-xs text-ink/50">{p.whatsapp}</span>}
                  </td>
                  <td className="px-6 py-3 text-ink/70">{p.cidade ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

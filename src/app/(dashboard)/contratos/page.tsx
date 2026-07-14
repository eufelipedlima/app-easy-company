"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ContratoForm } from "@/components/contrato-form";

interface Contrato {
  id: string;
  tipo_contrato: "pontual" | "recorrente";
  status: "ativo" | "encerrado";
  descricao: string | null;
  forma_pagamento: string | null;
  valor_total: number | null;
  data_fechamento: string | null;
  valor_mensal: number | null;
  data_primeira_mensalidade: string | null;
  tempo_inicial_meses: number | null;
  created_at: string;
  clientes: {
    papeis: {
      pessoas: { nome: string } | null;
    } | null;
  } | null;
}

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contratos")
      .select(
        `id, tipo_contrato, status, descricao, forma_pagamento,
         valor_total, data_fechamento,
         valor_mensal, data_primeira_mensalidade, tempo_inicial_meses,
         created_at,
         clientes ( papeis ( pessoas ( nome ) ) )`
      )
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    setContratos((data as unknown as Contrato[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Contratos</h1>
          <p className="text-sm text-ink/60 mt-1">
            Contratos pontuais e recorrentes ativos e encerrados.
          </p>
        </div>
        {!painelAberto && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo contrato
          </button>
        )}
      </div>

      {painelAberto && (
        <div className="mb-8 rounded-3xl bg-card border border-black/5 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink mb-6">Cadastrar contrato</h2>
          <ContratoForm
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
        ) : contratos.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">
            Nenhum contrato cadastrado ainda. Clique em &ldquo;Novo contrato&rdquo; pra começar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                <th className="px-6 py-3 font-medium">Cliente</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Valor</th>
                <th className="px-6 py-3 font-medium">Início</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
                  <td className="px-6 py-3 font-semibold text-ink">
                    {c.clientes?.papeis?.pessoas?.nome ?? "—"}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.tipo_contrato === "recorrente"
                          ? "bg-mint text-forest"
                          : "bg-surface text-ink/70"
                      }`}
                    >
                      {c.tipo_contrato === "recorrente" ? "Recorrente" : "Pontual"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-ink/70">
                    {c.tipo_contrato === "recorrente"
                      ? `${formatarMoeda(c.valor_mensal)}/mês`
                      : formatarMoeda(c.valor_total)}
                  </td>
                  <td className="px-6 py-3 text-ink/70">
                    {formatarData(
                      c.tipo_contrato === "recorrente" ? c.data_primeira_mensalidade : c.data_fechamento
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.status === "ativo" ? "bg-mint text-forest" : "bg-black/5 text-ink/50"
                      }`}
                    >
                      {c.status === "ativo" ? "Ativo" : "Encerrado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

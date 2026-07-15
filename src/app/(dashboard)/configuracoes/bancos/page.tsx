"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Banco {
  id: string;
  nome: string;
  saldo_inicial: number;
}

interface LancamentoPago {
  tipo: "receita" | "despesa" | "transferencia";
  valor: number;
  banco_id: string | null;
  banco_destino_id: string | null;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BancosPage() {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [lancamentosPagos, setLancamentosPagos] = useState<LancamentoPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [novoSaldoInicial, setNovoSaldoInicial] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [saldoEditado, setSaldoEditado] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: b }, { data: l }] = await Promise.all([
      supabase.from("bancos").select("id, nome, saldo_inicial").order("nome"),
      supabase
        .from("lancamentos")
        .select("tipo, valor, banco_id, banco_destino_id")
        .eq("situacao", "pago"),
    ]);
    setBancos((b as Banco[]) ?? []);
    setLancamentosPagos((l as LancamentoPago[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function saldoAtual(banco: Banco) {
    let saldo = banco.saldo_inicial;
    for (const l of lancamentosPagos) {
      if (l.tipo === "receita" && l.banco_id === banco.id) saldo += l.valor;
      else if (l.tipo === "despesa" && l.banco_id === banco.id) saldo -= l.valor;
      else if (l.tipo === "transferencia") {
        if (l.banco_id === banco.id) saldo -= l.valor;
        if (l.banco_destino_id === banco.id) saldo += l.valor;
      }
    }
    return saldo;
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("bancos").insert({
      nome: novoNome.trim(),
      saldo_inicial: novoSaldoInicial ? Number(novoSaldoInicial) : 0,
    });
    setNovoNome("");
    setNovoSaldoInicial("");
    setSalvando(false);
    carregar();
  }

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("bancos").delete().eq("id", id);
    carregar();
  }

  async function salvarAjusteSaldo(banco: Banco) {
    const novoSaldo = saldoEditado ? Number(saldoEditado) : 0;
    const atual = saldoAtual(banco);
    const delta = novoSaldo - atual;

    if (delta !== 0) {
      const supabase = createClient();
      const hoje = new Date().toISOString().slice(0, 10);
      await supabase.from("lancamentos").insert({
        tipo: delta > 0 ? "receita" : "despesa",
        situacao: "pago",
        descricao: "Ajuste de saldo",
        valor: Math.abs(delta),
        data_vencimento: hoje,
        data_quitacao: hoje,
        banco_id: banco.id,
      });
    }
    setEditandoId(null);
    carregar();
  }

  return (
    <section>
      <form onSubmit={adicionar} className="flex gap-2 mb-4">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="input"
          placeholder="Novo banco..."
        />
        <input
          type="number"
          step="0.01"
          value={novoSaldoInicial}
          onChange={(e) => setNovoSaldoInicial(e.target.value)}
          className="input w-40"
          placeholder="Saldo inicial"
        />
        <button
          type="submit"
          disabled={salvando}
          className="shrink-0 rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-ink/50">Carregando...</p>
        ) : bancos.length === 0 ? (
          <p className="p-4 text-sm text-ink/50">Nenhum banco cadastrado ainda.</p>
        ) : (
          bancos.map((banco) => (
            <div
              key={banco.id}
              className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0"
            >
              <span className="text-sm font-medium text-ink">{banco.nome}</span>

              <div className="flex items-center gap-4">
                {editandoId === banco.id ? (
                  <>
                    <label className="text-xs text-ink/50">
                      Novo saldo
                      <input
                        type="number"
                        step="0.01"
                        autoFocus
                        value={saldoEditado}
                        onChange={(e) => setSaldoEditado(e.target.value)}
                        className="input w-32 py-1 text-sm ml-2"
                      />
                    </label>
                    <button
                      onClick={() => salvarAjusteSaldo(banco)}
                      className="text-xs font-semibold text-forest"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditandoId(null)}
                      className="text-xs font-semibold text-ink/40"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-right">
                      <p className="text-xs text-ink/40">Saldo atual</p>
                      <p
                        className={`text-sm font-bold ${
                          saldoAtual(banco) < 0 ? "text-red-600" : "text-forest"
                        }`}
                      >
                        {formatarMoeda(saldoAtual(banco))}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditandoId(banco.id);
                        setSaldoEditado(String(saldoAtual(banco)));
                      }}
                      className="text-xs font-semibold text-ink/40 hover:text-ink"
                      title="Ajustar saldo (gera um lançamento de ajuste)"
                    >
                      Ajustar
                    </button>
                    <button
                      onClick={() => remover(banco.id)}
                      className="text-xs font-semibold text-ink/40 hover:text-red-600"
                    >
                      Remover
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-ink/40 mt-3">
        Saldo atual = saldo inicial + receitas pagas − despesas pagas, considerando também
        transferências entre contas. Só entram lançamentos marcados como &ldquo;Pago&rdquo;.
        Ajustar o saldo cria um lançamento de &ldquo;Ajuste de saldo&rdquo; automaticamente, pra
        manter o histórico rastreável em Lançamentos.
      </p>
    </section>
  );
}

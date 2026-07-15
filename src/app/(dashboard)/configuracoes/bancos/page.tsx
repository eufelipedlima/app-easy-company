"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Banco {
  id: string;
  nome: string;
  saldo_inicial: number;
  ativo: boolean;
}

interface LancamentoPago {
  tipo: "receita" | "despesa" | "transferencia";
  valor: number;
  banco_id: string | null;
  banco_destino_id: string | null;
  data_quitacao: string | null;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
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
  const [verSaldoAte, setVerSaldoAte] = useState(hojeISO());
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: b }, { data: l }] = await Promise.all([
      supabase.from("bancos").select("id, nome, saldo_inicial, ativo").order("nome"),
      supabase
        .from("lancamentos")
        .select("tipo, valor, banco_id, banco_destino_id, data_quitacao")
        .eq("situacao", "pago"),
    ]);
    setBancos((b as Banco[]) ?? []);
    setLancamentosPagos((l as LancamentoPago[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function saldoAte(banco: Banco, dataLimite: string) {
    let saldo = banco.saldo_inicial;
    for (const l of lancamentosPagos) {
      if (!l.data_quitacao || l.data_quitacao > dataLimite) continue;
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
    if (!window.confirm("Excluir esse banco de vez? Se ele já tiver lançamentos, prefira arquivar em vez de excluir.")) return;
    const supabase = createClient();
    await supabase.from("bancos").delete().eq("id", id);
    carregar();
  }

  async function arquivar(id: string, ativo: boolean) {
    const supabase = createClient();
    await supabase.from("bancos").update({ ativo }).eq("id", id);
    carregar();
  }

  async function salvarAjusteSaldo(banco: Banco) {
    const novoSaldo = saldoEditado ? Number(saldoEditado) : 0;
    const atual = saldoAte(banco, hojeISO());
    const delta = novoSaldo - atual;

    if (delta !== 0) {
      const supabase = createClient();
      const hoje = hojeISO();
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

  const bancosAtivos = bancos.filter((b) => b.ativo);
  const bancosArquivados = bancos.filter((b) => !b.ativo);

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

      <label className="flex items-center gap-2 text-sm text-ink/70 mb-4 w-fit">
        Ver saldo até
        <input
          type="date"
          value={verSaldoAte}
          onChange={(e) => setVerSaldoAte(e.target.value)}
          className="input py-1.5"
        />
      </label>

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-ink/50">Carregando...</p>
        ) : bancosAtivos.length === 0 ? (
          <p className="p-4 text-sm text-ink/50">Nenhum banco cadastrado ainda.</p>
        ) : (
          bancosAtivos.map((banco) => (
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
                      <p className="text-xs text-ink/40">
                        {verSaldoAte === hojeISO() ? "Saldo atual" : `Saldo até ${verSaldoAte.split("-").reverse().join("/")}`}
                      </p>
                      <p
                        className={`text-sm font-bold ${
                          saldoAte(banco, verSaldoAte) < 0 ? "text-red-600" : "text-forest"
                        }`}
                      >
                        {formatarMoeda(saldoAte(banco, verSaldoAte))}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditandoId(banco.id);
                        setSaldoEditado(String(saldoAte(banco, hojeISO())));
                      }}
                      className="text-xs font-semibold text-ink/40 hover:text-ink"
                      title="Ajustar saldo (gera um lançamento de ajuste)"
                    >
                      Ajustar
                    </button>
                    <button
                      onClick={() => arquivar(banco.id, false)}
                      className="text-xs font-semibold text-ink/40 hover:text-ink"
                      title="Arquivar — some do menu e da hora de lançar, mas mantém o histórico"
                    >
                      Arquivar
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

      {bancosArquivados.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setMostrarArquivados((v) => !v)}
            className="text-xs font-semibold text-ink/50 hover:text-ink"
          >
            {mostrarArquivados ? "− Ocultar" : "+ Ver"} bancos arquivados ({bancosArquivados.length})
          </button>

          {mostrarArquivados && (
            <div className="rounded-3xl bg-card border border-black/5 overflow-hidden mt-2">
              {bancosArquivados.map((banco) => (
                <div
                  key={banco.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0 opacity-60"
                >
                  <span className="text-sm font-medium text-ink">{banco.nome}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-ink/50">
                      {formatarMoeda(saldoAte(banco, verSaldoAte))}
                    </span>
                    <button
                      onClick={() => arquivar(banco.id, true)}
                      className="text-xs font-semibold text-forest hover:text-ink"
                    >
                      Reativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-ink/40 mt-3">
        Saldo = saldo inicial + receitas pagas − despesas pagas até a data escolhida, considerando
        também transferências entre contas. Só entram lançamentos marcados como &ldquo;Pago&rdquo;.
        Ajustar o saldo cria um lançamento de &ldquo;Ajuste de saldo&rdquo; automaticamente. Arquivar
        um banco tira ele da lista de seleção e do menu, mas mantém o histórico de lançamentos intacto.
      </p>
    </section>
  );
}

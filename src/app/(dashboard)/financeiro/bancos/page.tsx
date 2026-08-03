"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

interface Banco {
  id: string;
  nome: string;
  saldo_inicial: number;
  ativo: boolean;
}

interface PagamentoComTipo {
  banco_id: string | null;
  valor: number;
  data_pagamento: string;
  lancamentos: { tipo: "receita" | "despesa" | "transferencia" } | null;
}

interface Transferencia {
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
  const [pagamentos, setPagamentos] = useState<PagamentoComTipo[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [verSaldoAte, setVerSaldoAte] = useState(hojeISO());
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!menuAbertoId) return;
    function fechar() {
      setMenuAbertoId(null);
    }
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [menuAbertoId]);

  const [painelNovoBanco, setPainelNovoBanco] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoSaldoInicial, setNovoSaldoInicial] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [painelAjuste, setPainelAjuste] = useState<Banco | null>(null);
  const [saldoEditado, setSaldoEditado] = useState("");

  const [painelEditar, setPainelEditar] = useState<Banco | null>(null);
  const [nomeEditadoBanco, setNomeEditadoBanco] = useState("");
  const [saldoInicialEditado, setSaldoInicialEditado] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const [painelTransferencia, setPainelTransferencia] = useState(false);
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [valorTransferencia, setValorTransferencia] = useState("");
  const [dataTransferencia, setDataTransferencia] = useState(hojeISO());
  const [salvandoTransferencia, setSalvandoTransferencia] = useState(false);
  const [erroTransferencia, setErroTransferencia] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: b }, { data: p }, { data: t }] = await Promise.all([
      supabase.from("bancos").select("id, nome, saldo_inicial, ativo").order("nome"),
      supabase
        .from("lancamento_pagamentos")
        .select("banco_id, valor, data_pagamento, lancamentos ( tipo )"),
      supabase
        .from("lancamentos")
        .select("valor, banco_id, banco_destino_id, data_quitacao")
        .eq("tipo", "transferencia")
        .eq("situacao", "pago"),
    ]);
    setBancos((b as Banco[]) ?? []);
    setPagamentos((p as unknown as PagamentoComTipo[]) ?? []);
    setTransferencias((t as Transferencia[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function saldoAte(banco: Banco, dataLimite: string) {
    let saldo = banco.saldo_inicial;
    for (const p of pagamentos) {
      if (p.banco_id !== banco.id || p.data_pagamento > dataLimite) continue;
      if (p.lancamentos?.tipo === "receita") saldo += p.valor;
      else if (p.lancamentos?.tipo === "despesa") saldo -= p.valor;
    }
    for (const t of transferencias) {
      if (!t.data_quitacao || t.data_quitacao > dataLimite) continue;
      if (t.banco_id === banco.id) saldo -= t.valor;
      if (t.banco_destino_id === banco.id) saldo += t.valor;
    }
    return saldo;
  }

  async function adicionarBanco(e: React.FormEvent) {
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
    setPainelNovoBanco(false);
    carregar();
  }

  async function remover(id: string) {
    if (!window.confirm("Excluir esse banco de vez? Se ele já tiver lançamentos, prefira arquivar em vez de excluir.")) return;
    const supabase = createClient();
    await supabase.from("bancos").delete().eq("id", id);
    setMenuAbertoId(null);
    carregar();
  }

  async function arquivar(id: string, ativo: boolean) {
    const supabase = createClient();
    await supabase.from("bancos").update({ ativo }).eq("id", id);
    setMenuAbertoId(null);
    carregar();
  }

  async function salvarEdicaoBanco() {
    if (!painelEditar || !nomeEditadoBanco.trim()) return;
    setSalvandoEdicao(true);
    const supabase = createClient();
    await supabase
      .from("bancos")
      .update({
        nome: nomeEditadoBanco.trim(),
        saldo_inicial: saldoInicialEditado ? Number(saldoInicialEditado) : 0,
      })
      .eq("id", painelEditar.id);
    setSalvandoEdicao(false);
    setPainelEditar(null);
    carregar();
  }

  async function salvarAjusteSaldo() {
    if (!painelAjuste) return;
    const novoSaldo = saldoEditado ? Number(saldoEditado) : 0;
    const atual = saldoAte(painelAjuste, hojeISO());
    const delta = novoSaldo - atual;

    if (delta !== 0) {
      const supabase = createClient();
      const hoje = hojeISO();
      const { data: lancamento, error } = await supabase
        .from("lancamentos")
        .insert({
          tipo: delta > 0 ? "receita" : "despesa",
          situacao: "pago",
          descricao: "Ajuste de saldo",
          valor: Math.abs(delta),
          data_vencimento: hoje,
          data_quitacao: hoje,
          banco_id: painelAjuste.id,
        })
        .select("id")
        .single();
      if (!error && lancamento) {
        await supabase.from("lancamento_pagamentos").insert({
          lancamento_id: lancamento.id,
          data_pagamento: hoje,
          banco_id: painelAjuste.id,
          valor: Math.abs(delta),
        });
      }
    }
    setPainelAjuste(null);
    carregar();
  }

  async function salvarTransferencia(e: React.FormEvent) {
    e.preventDefault();
    if (!origemId || !destinoId || !valorTransferencia) {
      setErroTransferencia("Preencha banco de origem, destino e valor.");
      return;
    }
    if (origemId === destinoId) {
      setErroTransferencia("Escolha bancos diferentes para origem e destino.");
      return;
    }
    setSalvandoTransferencia(true);
    setErroTransferencia(null);
    const supabase = createClient();
    const { error } = await supabase.from("lancamentos").insert({
      tipo: "transferencia",
      situacao: "pago",
      descricao: "Transferência de contas",
      valor: Number(valorTransferencia),
      data_vencimento: dataTransferencia,
      data_competencia: dataTransferencia,
      data_quitacao: dataTransferencia,
      banco_id: origemId,
      banco_destino_id: destinoId,
    });
    if (error) {
      setErroTransferencia(error.message);
      setSalvandoTransferencia(false);
      return;
    }
    setOrigemId("");
    setDestinoId("");
    setValorTransferencia("");
    setDataTransferencia(hojeISO());
    setSalvandoTransferencia(false);
    setPainelTransferencia(false);
    carregar();
  }

  const bancosAtivos = bancos.filter((b) => b.ativo);
  const bancosArquivados = bancos.filter((b) => !b.ativo);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Bancos</h1>
        <p className="text-sm text-ink/60">Saldo das contas usadas nos lançamentos financeiros.</p>
      </div>

      <div className="flex items-end justify-between gap-4 mb-4">
        <label className="text-sm text-ink/60">
          <span className="block mb-1">Ver saldo até</span>
          <input
            type="date"
            value={verSaldoAte}
            onChange={(e) => setVerSaldoAte(e.target.value)}
            className="input py-1.5"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPainelTransferencia(true)}
            className="rounded-full border-2 border-ink/15 text-ink px-4 py-2 text-sm font-semibold hover:bg-surface transition-colors"
          >
            Transferir entre bancos
          </button>
          <button
            onClick={() => setPainelNovoBanco(true)}
            className="rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo banco
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface text-left text-ink/40 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">Banco</th>
              <th className="px-4 py-3 font-semibold">Saldo atual</th>
              <th className="px-4 py-3 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-sm text-ink/50">Carregando...</td>
              </tr>
            ) : bancosAtivos.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-sm text-ink/50">Nenhum banco cadastrado ainda.</td>
              </tr>
            ) : (
              bancosAtivos.map((banco) => (
                <tr key={banco.id} className="border-t border-black/5 hover:bg-surface/60">
                  <td className="px-4 py-3 font-medium text-ink">{banco.nome}</td>
                  <td
                    className={`px-4 py-3 font-semibold ${
                      saldoAte(banco, verSaldoAte) < 0 ? "text-red-600" : "text-ink"
                    }`}
                  >
                    {formatarMoeda(saldoAte(banco, verSaldoAte))}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      onClick={(e) => {
                        if (menuAbertoId === banco.id) {
                          setMenuAbertoId(null);
                          return;
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
                        setMenuAbertoId(banco.id);
                      }}
                      className="text-ink/40 hover:text-ink px-2"
                    >
                      •••
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {menuAbertoId &&
        menuPos &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            const banco = bancos.find((b) => b.id === menuAbertoId);
            if (!banco) return null;
            return (
              <div
                className="fixed z-50 w-44 rounded-xl bg-white border border-black/10 shadow-lg overflow-hidden text-left"
                style={{ top: menuPos.top, left: menuPos.left }}
                onMouseLeave={() => setMenuAbertoId(null)}
              >
                <button
                  onClick={() => {
                    setPainelEditar(banco);
                    setNomeEditadoBanco(banco.nome);
                    setSaldoInicialEditado(String(banco.saldo_inicial));
                    setMenuAbertoId(null);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    setPainelAjuste(banco);
                    setSaldoEditado(String(saldoAte(banco, hojeISO())));
                    setMenuAbertoId(null);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  Ajustar saldo
                </button>
                <button
                  onClick={() => {
                    arquivar(banco.id, false);
                    setMenuAbertoId(null);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  Arquivar
                </button>
                <button
                  onClick={() => {
                    remover(banco.id);
                    setMenuAbertoId(null);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Remover
                </button>
              </div>
            );
          })(),
          document.body
        )}

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
        Saldo = saldo inicial + pagamentos recebidos − pagamentos feitos até a data escolhida
        (considerando o banco selecionado na hora de marcar como pago), mais transferências entre
        contas. Só entram lançamentos com pagamento já registrado.
      </p>

      {painelNovoBanco && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setPainelNovoBanco(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">Novo banco</h2>
            <form onSubmit={adicionarBanco} className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">Nome do banco</span>
                <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="input" required autoFocus />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">Saldo inicial (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  value={novoSaldoInicial}
                  onChange={(e) => setNovoSaldoInicial(e.target.value)}
                  className="input"
                  placeholder="0,00"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
                <button type="button" onClick={() => setPainelNovoBanco(false)} className="text-sm font-semibold text-ink/60 hover:text-ink">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {painelEditar && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setPainelEditar(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">Editar banco</h2>
            <label className="block mb-4">
              <span className="block text-sm font-medium text-ink/70 mb-1">Nome do banco</span>
              <input
                autoFocus
                value={nomeEditadoBanco}
                onChange={(e) => setNomeEditadoBanco(e.target.value)}
                className="input"
              />
            </label>
            <label className="block mb-5">
              <span className="block text-sm font-medium text-ink/70 mb-1">Saldo inicial (R$)</span>
              <input
                type="number"
                step="0.01"
                value={saldoInicialEditado}
                onChange={(e) => setSaldoInicialEditado(e.target.value)}
                className="input"
              />
              <span className="block text-xs text-ink/40 mt-1">
                Esse é o ponto de partida do cálculo — o saldo atual continua sendo saldo inicial +
                pagamentos. Pra corrigir um saldo errado sem mexer no histórico de pagamentos, prefira
                usar &ldquo;Ajustar saldo&rdquo; em vez disso.
              </span>
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={salvarEdicaoBanco}
                disabled={salvandoEdicao}
                className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
              >
                {salvandoEdicao ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setPainelEditar(null)} className="text-sm font-semibold text-ink/60 hover:text-ink">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {painelAjuste && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setPainelAjuste(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-1">Ajustar saldo — {painelAjuste.nome}</h2>
            <p className="text-xs text-ink/40 mb-5">Isso cria um lançamento de &ldquo;Ajuste de saldo&rdquo; automaticamente.</p>
            <label className="block mb-5">
              <span className="block text-sm font-medium text-ink/70 mb-1">Novo saldo (R$)</span>
              <input
                type="number"
                step="0.01"
                autoFocus
                value={saldoEditado}
                onChange={(e) => setSaldoEditado(e.target.value)}
                className="input"
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={salvarAjusteSaldo}
                className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
              >
                Salvar
              </button>
              <button onClick={() => setPainelAjuste(null)} className="text-sm font-semibold text-ink/60 hover:text-ink">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {painelTransferencia && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setPainelTransferencia(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">Transferir entre bancos</h2>
            <form onSubmit={salvarTransferencia} className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">De</span>
                <select value={origemId} onChange={(e) => setOrigemId(e.target.value)} className="input" required>
                  <option value="">Selecione...</option>
                  {bancosAtivos.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">Para</span>
                <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="input" required>
                  <option value="">Selecione...</option>
                  {bancosAtivos.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-medium text-ink/70 mb-1">Valor (R$)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={valorTransferencia}
                    onChange={(e) => setValorTransferencia(e.target.value)}
                    className="input"
                    required
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-ink/70 mb-1">Data</span>
                  <input
                    type="date"
                    value={dataTransferencia}
                    onChange={(e) => setDataTransferencia(e.target.value)}
                    className="input"
                    required
                  />
                </label>
              </div>

              {erroTransferencia && <p className="text-sm text-red-600">{erroTransferencia}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={salvandoTransferencia}
                  className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
                >
                  {salvandoTransferencia ? "Salvando..." : "Transferir"}
                </button>
                <button type="button" onClick={() => setPainelTransferencia(false)} className="text-sm font-semibold text-ink/60 hover:text-ink">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

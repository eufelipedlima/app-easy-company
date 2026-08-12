"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Wallet, Landmark, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";

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
  lancamentos: { tipo: "receita" | "despesa" | "transferencia"; descricao: string | null } | null;
}

interface Transferencia {
  valor: number;
  banco_id: string | null;
  banco_destino_id: string | null;
  data_quitacao: string | null;
}

interface Pendencia {
  tipo: "receita" | "despesa";
  valor: number;
  data_vencimento: string;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

async function buscarTudo<T>(construirQuery: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  let todos: T[] = [];
  let pagina = 0;
  const tamanho = 1000;
  while (true) {
    const { data } = await construirQuery(pagina * tamanho, pagina * tamanho + tamanho - 1);
    if (!data || data.length === 0) break;
    todos = [...todos, ...(data as T[])];
    if (data.length < tamanho) break;
    pagina++;
  }
  return todos;
}

const CORES_BANCO = ["#143421", "#dc9d3a", "#2563eb", "#dc2626", "#7c3aed", "#0d9488", "#db2777", "#ca8a04"];
function corBanco(index: number) {
  return CORES_BANCO[index % CORES_BANCO.length];
}
function iniciaisBanco(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function BancosPage() {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoComTipo[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [verSaldoAte, setVerSaldoAte] = useState(hojeISO());
  const [buscaBanco, setBuscaBanco] = useState("");
  const [periodoEvolucao, setPeriodoEvolucao] = useState<7 | 30 | 90>(7);
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
  const [nomeEditado, setNomeEditado] = useState("");
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
    const inicioMes = `${hojeISO().slice(0, 7)}-01`;
    const fimMes = new Date(Number(hojeISO().slice(0, 4)), Number(hojeISO().slice(5, 7)), 0).toISOString().slice(0, 10);

    const [{ data: b }, p, t, pend] = await Promise.all([
      supabase.from("bancos").select("id, nome, saldo_inicial, ativo").order("nome"),
      buscarTudo<PagamentoComTipo>((from, to) =>
        supabase
          .from("lancamento_pagamentos")
          .select("banco_id, valor, data_pagamento, lancamentos ( tipo, descricao )")
          .range(from, to)
      ),
      buscarTudo<Transferencia>((from, to) =>
        supabase
          .from("lancamentos")
          .select("valor, banco_id, banco_destino_id, data_quitacao")
          .eq("tipo", "transferencia")
          .eq("situacao", "pago")
          .range(from, to)
      ),
      buscarTudo<Pendencia>((from, to) =>
        supabase
          .from("lancamentos")
          .select("tipo, valor, data_vencimento")
          .eq("situacao", "pendente")
          .neq("tipo", "transferencia")
          .gte("data_vencimento", inicioMes)
          .lte("data_vencimento", fimMes)
          .range(from, to)
      ),
    ]);
    setBancos((b as Banco[]) ?? []);
    setPagamentos(p);
    setTransferencias(t);
    setPendencias(pend);
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
    if (!painelEditar || !nomeEditado.trim()) return;
    setSalvandoEdicao(true);
    const supabase = createClient();
    await supabase
      .from("bancos")
      .update({ nome: nomeEditado.trim(), saldo_inicial: saldoInicialEditado ? Number(saldoInicialEditado) : 0 })
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
  const bancosFiltrados = bancosAtivos.filter((b) => b.nome.toLowerCase().includes(buscaBanco.toLowerCase()));

  const saldoTotal = bancosAtivos.reduce((s, b) => s + saldoAte(b, verSaldoAte), 0);
  const totalAReceber = pendencias.filter((p) => p.tipo === "receita").reduce((s, p) => s + p.valor, 0);
  const totalAPagar = pendencias.filter((p) => p.tipo === "despesa").reduce((s, p) => s + p.valor, 0);

  const dadosDonut = bancosAtivos
    .map((b, i) => ({ nome: b.nome, valor: Math.max(saldoAte(b, verSaldoAte), 0), cor: corBanco(i) }))
    .filter((d) => d.valor > 0);
  const somaDonut = dadosDonut.reduce((s, d) => s + d.valor, 0);

  const dadosEvolucao = useMemo(() => {
    const pontos: { data: string; label: string; saldo: number }[] = [];
    const hoje = new Date();
    for (let i = periodoEvolucao - 1; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const total = bancosAtivos.reduce((s, b) => s + saldoAte(b, iso), 0);
      pontos.push({ data: iso, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), saldo: total });
    }
    return pontos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoEvolucao, bancosAtivos, pagamentos, transferencias]);

  const movimentacoes = useMemo(() => {
    const doPagamento = pagamentos
      .filter((p) => p.lancamentos?.tipo !== "transferencia")
      .map((p) => ({
        descricao: p.lancamentos?.descricao || (p.lancamentos?.tipo === "receita" ? "Recebimento" : "Pagamento"),
        valor: p.lancamentos?.tipo === "receita" ? p.valor : -p.valor,
        data: p.data_pagamento,
        bancoId: p.banco_id,
      }));
    const dasTransferencias = transferencias
      .filter((t) => t.data_quitacao)
      .flatMap((t) => [
        { descricao: "Transferência enviada", valor: -t.valor, data: t.data_quitacao!, bancoId: t.banco_id },
        { descricao: "Transferência recebida", valor: t.valor, data: t.data_quitacao!, bancoId: t.banco_destino_id },
      ]);
    return [...doPagamento, ...dasTransferencias].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 6);
  }, [pagamentos, transferencias]);

  function nomeDoBanco(id: string | null) {
    return bancos.find((b) => b.id === id)?.nome ?? "—";
  }

  return (
    <main className="w-full px-6 sm:px-8 lg:px-10 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Bancos</h1>
          <p className="text-sm text-ink/60">Visão geral dos saldos e movimentações das suas contas.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPainelTransferencia(true)}
            className="rounded-full border-2 border-ink/15 text-ink px-4 py-2 text-sm font-semibold hover:bg-surface transition-colors flex items-center gap-1.5"
          >
            <ArrowLeftRight size={15} /> Transferir entre bancos
          </button>
          <button
            onClick={() => setPainelNovoBanco(true)}
            className="rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo banco
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <label className="text-xs text-ink/50 flex items-center gap-2">
          Ver saldo até
          <input type="date" value={verSaldoAte} onChange={(e) => setVerSaldoAte(e.target.value)} className="input py-1.5 text-sm !w-auto" />
        </label>
      </div>

      <div className="anim-stagger grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink/40 font-semibold mb-1">Saldo total</p>
            <p className={`text-xl font-extrabold ${saldoTotal < 0 ? "text-red-600" : "text-ink"}`}>{formatarMoeda(saldoTotal)}</p>
          </div>
          <span className="h-9 w-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <Wallet size={16} />
          </span>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink/40 font-semibold mb-1">Contas ativas</p>
            <p className="text-xl font-extrabold text-ink">{bancosAtivos.length}</p>
          </div>
          <span className="h-9 w-9 rounded-full bg-surface text-ink/60 flex items-center justify-center shrink-0">
            <Landmark size={16} />
          </span>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink/40 font-semibold mb-1">A receber</p>
            <p className="text-xl font-extrabold text-emerald-600">{formatarMoeda(totalAReceber)}</p>
            <p className="text-[10px] text-ink/30 mt-0.5">este mês</p>
          </div>
          <span className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
            <TrendingUp size={16} />
          </span>
        </div>
        <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink/40 font-semibold mb-1">A pagar</p>
            <p className="text-xl font-extrabold text-red-500">{formatarMoeda(totalAPagar)}</p>
            <p className="text-[10px] text-ink/30 mt-0.5">este mês</p>
          </div>
          <span className="h-9 w-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <TrendingDown size={16} />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-3xl bg-card border border-black/5 p-5">
          <h2 className="text-sm font-bold text-ink mb-4">Distribuição do saldo</h2>
          {dadosDonut.length === 0 ? (
            <p className="text-sm text-ink/40 py-10 text-center">Sem saldo positivo pra distribuir ainda.</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosDonut} dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {dadosDonut.map((d, i) => (
                        <Cell key={i} fill={d.cor} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                {dadosDonut.map((d) => (
                  <div key={d.nome} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.cor }} />
                    <span className="text-ink font-medium truncate flex-1">{d.nome}</span>
                    <span className="text-ink/40 text-xs shrink-0">{((d.valor / somaDonut) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-card border border-black/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-ink">Contas cadastradas</h2>
          </div>
          <input
            value={buscaBanco}
            onChange={(e) => setBuscaBanco(e.target.value)}
            placeholder="Buscar banco..."
            className="input py-2 text-sm mb-3"
          />
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-ink/50 py-4">Carregando...</p>
            ) : bancosFiltrados.length === 0 ? (
              <p className="text-sm text-ink/50 py-4">Nenhum banco encontrado.</p>
            ) : (
              bancosFiltrados.map((banco, i) => {
                const saldo = saldoAte(banco, verSaldoAte);
                return (
                  <div key={banco.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-surface/60 transition-colors">
                    <span
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: corBanco(i) }}
                    >
                      {iniciaisBanco(banco.nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate">{banco.nome}</p>
                      <p className="text-xs text-ink/40">Conta corrente</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${saldo < 0 ? "text-red-600" : "text-ink"}`}>{formatarMoeda(saldo)}</span>
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
                      className="text-ink/30 hover:text-ink px-1 shrink-0"
                    >
                      •••
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-3xl bg-card border border-black/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-ink">Evolução do saldo total</h2>
            <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
              {([7, 30, 90] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodoEvolucao(p)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                    periodoEvolucao === p ? "bg-ink text-white" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  {p} dias
                </button>
              ))}
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosEvolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0000000d" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatarMoeda(v)} width={70} />
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Line type="monotone" dataKey="saldo" stroke="#143421" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl bg-card border border-black/5 p-5">
          <h2 className="text-sm font-bold text-ink mb-4">Últimas movimentações</h2>
          {movimentacoes.length === 0 ? (
            <p className="text-sm text-ink/40 py-6 text-center">Nenhuma movimentação ainda.</p>
          ) : (
            <div className="space-y-1">
              {movimentacoes.map((m, i) => (
                <div key={i} className="flex items-center gap-3 px-1 py-2.5 border-b border-black/5 last:border-0">
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.valor >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                    {m.valor >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">{m.descricao}</p>
                    <p className="text-xs text-ink/40">{nomeDoBanco(m.bancoId)}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${m.valor >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {m.valor >= 0 ? "+" : ""}
                    {formatarMoeda(m.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
                    setNomeEditado(banco.nome);
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
        <div className="mt-2 mb-4">
          <button onClick={() => setMostrarArquivados((v) => !v)} className="text-xs font-semibold text-ink/50 hover:text-ink">
            {mostrarArquivados ? "− Ocultar" : "+ Ver"} bancos arquivados ({bancosArquivados.length})
          </button>

          {mostrarArquivados && (
            <div className="rounded-3xl bg-card border border-black/5 overflow-hidden mt-2">
              {bancosArquivados.map((banco) => (
                <div key={banco.id} className="flex items-center justify-between px-4 py-3 border-b border-black/5 last:border-0 opacity-60">
                  <span className="text-sm font-medium text-ink">{banco.nome}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-ink/50">{formatarMoeda(saldoAte(banco, verSaldoAte))}</span>
                    <button onClick={() => arquivar(banco.id, true)} className="text-xs font-semibold text-forest hover:text-ink">
                      Reativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-ink/40 mb-8">
        Saldo = saldo inicial + pagamentos recebidos − pagamentos feitos até a data escolhida (considerando o banco selecionado
        na hora de marcar como pago), mais transferências entre contas. Só entram lançamentos com pagamento já registrado.
      </p>

      {painelNovoBanco && (
        <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={() => setPainelNovoBanco(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={() => setPainelEditar(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-ink mb-5">Editar banco</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">Nome do banco</span>
                <input value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} className="input" autoFocus />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">Saldo inicial (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  value={saldoInicialEditado}
                  onChange={(e) => setSaldoInicialEditado(e.target.value)}
                  className="input"
                />
                <span className="block text-xs text-ink/40 mt-1">
                  Isso muda o ponto de partida do cálculo — corrige o saldo de hoje na hora.
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
        </div>
      )}

      {painelAjuste && (
        <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={() => setPainelAjuste(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-ink mb-1">Ajustar saldo — {painelAjuste.nome}</h2>
            <p className="text-xs text-ink/40 mb-5">Isso cria um lançamento de &ldquo;Ajuste de saldo&rdquo; automaticamente.</p>
            <label className="block mb-5">
              <span className="block text-sm font-medium text-ink/70 mb-1">Novo saldo (R$)</span>
              <input type="number" step="0.01" autoFocus value={saldoEditado} onChange={(e) => setSaldoEditado(e.target.value)} className="input" />
            </label>
            <div className="flex items-center gap-3">
              <button onClick={salvarAjusteSaldo} className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors">
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
        <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={() => setPainelTransferencia(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
                  <input type="number" step="0.01" value={valorTransferencia} onChange={(e) => setValorTransferencia(e.target.value)} className="input" required />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-ink/70 mb-1">Data</span>
                  <input type="date" value={dataTransferencia} onChange={(e) => setDataTransferencia(e.target.value)} className="input" required />
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

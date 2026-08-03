"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { PessoaForm } from "@/components/pessoa-form";
import { useTabelaConfig, LINHAS_POR_PAGINA_OPCOES, type ColunaDef } from "@/lib/use-tabela-config";

interface Beneficio {
  id: string;
  nome: string;
  valor: number;
  tipo_valor: "mensal" | "diario";
}

function diasUteisNoMes(ano: number, mes: number) {
  let count = 0;
  const data = new Date(ano, mes, 1);
  while (data.getMonth() === mes) {
    const dia = data.getDay();
    if (dia !== 0 && dia !== 6) count++;
    data.setDate(data.getDate() + 1);
  }
  return count;
}

function valorMensalBeneficio(b: Beneficio, ano: number, mes: number) {
  return b.tipo_valor === "diario" ? b.valor * diasUteisNoMes(ano, mes) : b.valor;
}

function calcularEncargos(salario: number) {
  const fgts = salario * 0.08;
  return {
    fgts,
    decimoTerceiro: salario * 0.0833,
    ferias: salario * 0.0833,
    umTercoFerias: salario * 0.0278,
    avisoPrevio: salario * 0.0833,
    multaFgts: fgts * 0.4,
  };
}

interface Funcionario {
  id: string;
  papel_id: string;
  cargo: string | null;
  cargo_id: string | null;
  tipo_contrato: "CLT" | "PJ" | null;
  salario: number;
  data_admissao: string | null;
  tem_acesso_sistema: boolean;
  email_acesso: string | null;
  perfil_acesso_id: string | null;
  auth_user_id: string | null;
  papeis: { pessoas: { nome: string; pix: string | null } | null } | null;
  cargos: { nome: string } | null;
}

interface Cargo {
  id: string;
  nome: string;
}

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

const COLUNAS_DISPONIVEIS: ColunaDef[] = [
  { key: "nome", label: "Nome" },
  { key: "cargo", label: "Cargo" },
  { key: "contrato", label: "Contrato" },
  { key: "salario", label: "Salário bruto" },
  { key: "custo_total", label: "Custo total" },
  { key: "inicio", label: "Início" },
];

function renderCelulaFuncionario(key: string, f: Funcionario, custoTotal: number) {
  switch (key) {
    case "nome":
      return <span className="font-semibold text-ink">{f.papeis?.pessoas?.nome ?? "—"}</span>;
    case "cargo":
      return <span className="text-ink/70">{f.cargos?.nome ?? f.cargo ?? "—"}</span>;
    case "contrato":
      return <span className="text-ink/70">{f.tipo_contrato ?? "—"}</span>;
    case "salario":
      return <span className="text-ink/70">{formatarMoeda(f.salario)}</span>;
    case "custo_total":
      return <span className="font-semibold text-forest">{formatarMoeda(custoTotal)}</span>;
    case "inicio":
      return <span className="text-ink/70">{formatarData(f.data_admissao)}</span>;
    default:
      return null;
  }
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [beneficiosPorFuncionario, setBeneficiosPorFuncionario] = useState<Record<string, Beneficio[]>>({});
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<Funcionario | null>(null);

  const {
    colunas,
    painelColunasAberto,
    setPainelColunasAberto,
    linhasPorPagina,
    paginaAtual,
    setPaginaAtual,
    alternarVisibilidade,
    moverColuna,
    mudarLinhasPorPagina,
  } = useTabelaConfig("funcionarios", COLUNAS_DISPONIVEIS);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: func } = await supabase
      .from("funcionarios")
      .select(
        "id, papel_id, cargo, cargo_id, tipo_contrato, salario, data_admissao, tem_acesso_sistema, email_acesso, perfil_acesso_id, auth_user_id, papeis ( pessoas ( nome, pix ) ), cargos ( nome )"
      )
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    const lista = (func as unknown as Funcionario[]) ?? [];
    setFuncionarios(lista);

    if (lista.length > 0) {
      const { data: beneficios } = await supabase
        .from("funcionario_beneficios")
        .select("id, funcionario_id, nome, valor, tipo_valor")
        .in("funcionario_id", lista.map((f) => f.id));

      const agrupado: Record<string, Beneficio[]> = {};
      (beneficios ?? []).forEach((b) => {
        if (!agrupado[b.funcionario_id]) agrupado[b.funcionario_id] = [];
        agrupado[b.funcionario_id].push({ id: b.id, nome: b.nome, valor: b.valor, tipo_valor: b.tipo_valor });
      });
      setBeneficiosPorFuncionario(agrupado);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function custoTotal(f: Funcionario) {
    const beneficios = beneficiosPorFuncionario[f.id] ?? [];
    const hoje = new Date();
    const fgts = calcularEncargos(f.salario).fgts;
    return (
      f.salario +
      fgts +
      beneficios.reduce((s, b) => s + valorMensalBeneficio(b, hoje.getFullYear(), hoje.getMonth()), 0)
    );
  }

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("funcionarios").update({ ativo: false }).eq("id", id);
    carregar();
  }

  const totalPaginas = Math.max(Math.ceil(funcionarios.length / linhasPorPagina), 1);
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const paginados = funcionarios.slice((paginaSegura - 1) * linhasPorPagina, paginaSegura * linhasPorPagina);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <p className="text-xs text-ink/50 bg-surface rounded-full px-4 py-2 inline-flex items-center gap-1.5 w-fit">
          🐟 Esses valores são a base de cálculo pra ter noção do custo de cada funcionário — eles
          não são lançados automaticamente no financeiro. Se for pagar, lance à parte em Lançamentos.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => setPainelColunasAberto((v) => !v)}
              className="rounded-full border-2 border-ink/15 text-ink px-4 py-2.5 text-sm font-bold hover:bg-surface transition-colors"
            >
              ⚙ Colunas
            </button>
            {painelColunasAberto && (
              <div
                className="absolute right-0 z-10 mt-2 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-2"
                onMouseLeave={() => setPainelColunasAberto(false)}
              >
                {colunas.map((c, i) => {
                  const def = COLUNAS_DISPONIVEIS.find((d) => d.key === c.key);
                  if (!def) return null;
                  return (
                    <div key={c.key} className="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-surface rounded-lg">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={c.visivel}
                          onChange={() => alternarVisibilidade(c.key)}
                          className="h-3.5 w-3.5 rounded accent-forest"
                        />
                        <span className={c.visivel ? "text-ink" : "text-ink/40"}>{def.label}</span>
                      </label>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => moverColuna(c.key, -1)}
                          disabled={i === 0}
                          className="text-ink/40 hover:text-ink disabled:opacity-20 px-1"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moverColuna(c.key, 1)}
                          disabled={i === colunas.length - 1}
                          className="text-ink/40 hover:text-ink disabled:opacity-20 px-1"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
                <label className="flex items-center justify-between gap-2 px-2 py-2 mt-1 border-t border-black/5 text-sm">
                  <span className="text-ink/70">Linhas por página</span>
                  <select
                    value={linhasPorPagina}
                    onChange={(e) => mudarLinhasPorPagina(Number(e.target.value))}
                    className="input py-1 text-xs w-20"
                  >
                    {LINHAS_POR_PAGINA_OPCOES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
          {!painelAberto && (
            <button
              onClick={() => setPainelAberto(true)}
              className="shrink-0 rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
            >
              + Novo funcionário
            </button>
          )}
        </div>
      </div>

      {painelAberto && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setPainelAberto(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">Cadastrar funcionário</h2>
            <FuncionarioForm
              onSaved={() => {
                setPainelAberto(false);
                carregar();
              }}
              onCancel={() => setPainelAberto(false)}
            />
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : funcionarios.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhum funcionário cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                {colunas
                  .filter((c) => c.visivel)
                  .map((c) => (
                    <th key={c.key} className="px-4 py-3 font-medium">
                      {COLUNAS_DISPONIVEIS.find((d) => d.key === c.key)?.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {paginados.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setDetalhe(f)}
                  className="border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
                >
                  {colunas
                    .filter((c) => c.visivel)
                    .map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {renderCelulaFuncionario(c.key, f, custoTotal(f))}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {funcionarios.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-ink/50">
          <div className="flex items-center gap-4">
            <p>
              Mostrando {(paginaSegura - 1) * linhasPorPagina + 1}–
              {Math.min(paginaSegura * linhasPorPagina, funcionarios.length)} de {funcionarios.length}
            </p>
            <label className="flex items-center gap-2 text-xs">
              Linhas
              <select
                value={linhasPorPagina}
                onChange={(e) => mudarLinhasPorPagina(Number(e.target.value))}
                className="input py-1 text-xs w-16"
              >
                {LINHAS_POR_PAGINA_OPCOES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))}
              disabled={paginaSegura === 1}
              className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="px-2 text-xs">
              Página {paginaSegura} de {totalPaginas}
            </span>
            <button
              onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))}
              disabled={paginaSegura === totalPaginas}
              className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {detalhe && (
        <DetalheFuncionario
          funcionario={detalhe}
          beneficios={beneficiosPorFuncionario[detalhe.id] ?? []}
          onClose={() => setDetalhe(null)}
          onChange={carregar}
          onRemover={() => {
            remover(detalhe.id);
            setDetalhe(null);
          }}
        />
      )}
    </div>
  );
}

interface HistoricoSalario {
  id: string;
  tipo: "aumento" | "reajuste";
  salario_anterior: number;
  salario_novo: number;
  data_alteracao: string;
  observacao: string | null;
}

function DetalheFuncionario({
  funcionario,
  beneficios,
  onClose,
  onChange,
  onRemover,
}: {
  funcionario: Funcionario;
  beneficios: Beneficio[];
  onClose: () => void;
  onChange: () => void;
  onRemover: () => void;
}) {
  const [nomeBeneficio, setNomeBeneficio] = useState("");
  const [valorBeneficio, setValorBeneficio] = useState("");
  const [tipoValorBeneficio, setTipoValorBeneficio] = useState<"mensal" | "diario">("mensal");
  const [salvando, setSalvando] = useState(false);

  const [salarioAtual, setSalarioAtual] = useState(funcionario.salario);
  const [perfisAcesso, setPerfisAcesso] = useState<{ id: string; nome: string }[]>([]);
  const [perfilSelecionado, setPerfilSelecionado] = useState(funcionario.perfil_acesso_id ?? "");
  const [emailConvite, setEmailConvite] = useState(funcionario.email_acesso ?? "");
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const [vinculandoMinhaConta, setVinculandoMinhaConta] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [sucessoAcesso, setSucessoAcesso] = useState<string | null>(null);

  useEffect(() => {
    async function carregarPerfis() {
      const supabase = createClient();
      const { data } = await supabase.from("perfis_acesso").select("id, nome").order("ordem");
      setPerfisAcesso(data ?? []);
    }
    carregarPerfis();
  }, []);

  async function vincularMinhaConta() {
    setVinculandoMinhaConta(true);
    setErroAcesso(null);
    setSucessoAcesso(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErroAcesso("Não foi possível identificar sua sessão atual.");
      setVinculandoMinhaConta(false);
      return;
    }
    const { error } = await supabase
      .from("funcionarios")
      .update({
        auth_user_id: user.id,
        email_acesso: user.email,
        tem_acesso_sistema: true,
        perfil_acesso_id: perfilSelecionado || null,
      })
      .eq("id", funcionario.id);
    setVinculandoMinhaConta(false);
    if (error) {
      setErroAcesso(error.message);
    } else {
      setSucessoAcesso("Sua conta atual foi vinculada a este funcionário!");
      onChange();
    }
  }

  async function enviarConvite() {
    if (!emailConvite.trim()) {
      setErroAcesso("Preencha o e-mail.");
      return;
    }
    setEnviandoConvite(true);
    setErroAcesso(null);
    setSucessoAcesso(null);
    try {
      const res = await fetch("/api/usuarios/convidar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailConvite.trim(),
          funcionarioId: funcionario.id,
          perfilAcessoId: perfilSelecionado || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroAcesso(data.error ?? "Não foi possível enviar o convite.");
      } else {
        setSucessoAcesso("Convite enviado! A pessoa vai receber um e-mail pra criar a senha.");
        onChange();
      }
    } catch {
      setErroAcesso("Não foi possível enviar o convite.");
    }
    setEnviandoConvite(false);
  }
  const [historico, setHistorico] = useState<HistoricoSalario[]>([]);
  const [painelReajusteAberto, setPainelReajusteAberto] = useState(false);
  const [tipoReajuste, setTipoReajuste] = useState<"aumento" | "reajuste">("reajuste");
  const [novoSalario, setNovoSalario] = useState("");
  const [dataReajuste, setDataReajuste] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacaoReajuste, setObservacaoReajuste] = useState("");
  const [salvandoReajuste, setSalvandoReajuste] = useState(false);
  const [erroReajuste, setErroReajuste] = useState<string | null>(null);

  useEffect(() => {
    async function carregarHistorico() {
      const supabase = createClient();
      const { data } = await supabase
        .from("funcionario_historico_salario")
        .select("id, tipo, salario_anterior, salario_novo, data_alteracao, observacao")
        .eq("funcionario_id", funcionario.id)
        .order("data_alteracao", { ascending: false });
      setHistorico(data ?? []);
    }
    carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hoje = new Date();
  const dias = diasUteisNoMes(hoje.getFullYear(), hoje.getMonth());
  const encargos = calcularEncargos(salarioAtual);
  const custoTotal =
    salarioAtual +
    encargos.fgts +
    beneficios.reduce((s, b) => s + valorMensalBeneficio(b, hoje.getFullYear(), hoje.getMonth()), 0);

  async function removerHistorico(id: string) {
    if (!window.confirm("Excluir este registro do histórico salarial? Isso não altera o salário atual do funcionário.")) return;
    const supabase = createClient();
    await supabase.from("funcionario_historico_salario").delete().eq("id", id);
    const { data } = await supabase
      .from("funcionario_historico_salario")
      .select("id, tipo, salario_anterior, salario_novo, data_alteracao, observacao")
      .eq("funcionario_id", funcionario.id)
      .order("data_alteracao", { ascending: false });
    setHistorico(data ?? []);
  }

  async function registrarReajuste(e: React.FormEvent) {
    e.preventDefault();
    if (!novoSalario || !dataReajuste) {
      setErroReajuste("Informe o novo salário e a data.");
      return;
    }
    setSalvandoReajuste(true);
    setErroReajuste(null);
    try {
      const supabase = createClient();
      const { error: histError } = await supabase.from("funcionario_historico_salario").insert({
        funcionario_id: funcionario.id,
        tipo: tipoReajuste,
        salario_anterior: salarioAtual,
        salario_novo: Number(novoSalario),
        data_alteracao: dataReajuste,
        observacao: observacaoReajuste || null,
      });
      if (histError) throw histError;

      const { error: updError } = await supabase
        .from("funcionarios")
        .update({ salario: Number(novoSalario) })
        .eq("id", funcionario.id);
      if (updError) throw updError;

      setSalarioAtual(Number(novoSalario));
      setNovoSalario("");
      setObservacaoReajuste("");
      setPainelReajusteAberto(false);

      const { data } = await supabase
        .from("funcionario_historico_salario")
        .select("id, tipo, salario_anterior, salario_novo, data_alteracao, observacao")
        .eq("funcionario_id", funcionario.id)
        .order("data_alteracao", { ascending: false });
      setHistorico(data ?? []);

      onChange();
    } catch (err) {
      setErroReajuste(err instanceof Error ? err.message : "Erro ao registrar reajuste.");
    } finally {
      setSalvandoReajuste(false);
    }
  }

  async function adicionarBeneficio(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeBeneficio.trim() || !valorBeneficio) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("funcionario_beneficios").insert({
      funcionario_id: funcionario.id,
      nome: nomeBeneficio.trim(),
      valor: Number(valorBeneficio),
      tipo_valor: tipoValorBeneficio,
    });
    setNomeBeneficio("");
    setValorBeneficio("");
    setTipoValorBeneficio("mensal");
    setSalvando(false);
    onChange();
  }

  async function removerBeneficio(id: string) {
    const supabase = createClient();
    await supabase.from("funcionario_beneficios").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-bold text-ink leading-tight">{funcionario.papeis?.pessoas?.nome ?? "—"}</p>
            {(funcionario.cargos?.nome ?? funcionario.cargo) && (
              <p className="text-xs text-ink/50">{funcionario.cargos?.nome ?? funcionario.cargo}</p>
            )}
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="rounded-2xl bg-card p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink">Acesso ao sistema</p>
            {funcionario.auth_user_id ? (
              <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-mint text-forest">Vinculado</span>
            ) : (
              <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-black/5 text-ink/40">
                Sem acesso ainda
              </span>
            )}
          </div>

          {funcionario.email_acesso && (
            <p className="text-xs text-ink/50">
              Login: <span className="font-medium text-ink">{funcionario.email_acesso}</span>
            </p>
          )}

          <label className="block">
            <span className="block text-xs font-medium text-ink/60 mb-1">Perfil de acesso</span>
            <select value={perfilSelecionado} onChange={(e) => setPerfilSelecionado(e.target.value)} className="input py-1.5 text-sm">
              <option value="">Sem perfil</option>
              {perfisAcesso.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>

          {!funcionario.auth_user_id && (
            <button
              onClick={vincularMinhaConta}
              disabled={vinculandoMinhaConta}
              className="w-full rounded-full border-2 border-forest text-forest px-4 py-2 text-xs font-bold hover:bg-mint transition-colors disabled:opacity-50"
            >
              {vinculandoMinhaConta ? "Vinculando..." : "Sou eu — vincular minha conta atual"}
            </button>
          )}

          <div className="flex items-center gap-2">
            <input
              value={emailConvite}
              onChange={(e) => setEmailConvite(e.target.value)}
              placeholder="E-mail da pessoa..."
              className="input py-1.5 text-sm flex-1"
            />
            <button
              onClick={enviarConvite}
              disabled={enviandoConvite}
              className="shrink-0 rounded-full bg-ink text-white px-4 py-2 text-xs font-bold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {enviandoConvite ? "Enviando..." : "Convidar"}
            </button>
          </div>

          {erroAcesso && <p className="text-xs text-red-600">{erroAcesso}</p>}
          {sucessoAcesso && <p className="text-xs text-forest font-semibold">{sucessoAcesso}</p>}
        </div>

        <p className="text-xs text-ink/50 bg-card rounded-2xl px-3 py-2 mb-4">
          🐟 Base de cálculo de custo — não é lançado automaticamente no financeiro.
        </p>

        <div className="rounded-2xl bg-card p-4 mb-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-ink/50 mb-0.5">Custo total mensal (mês atual)</p>
              <p className="text-xl font-extrabold text-forest">{formatarMoeda(custoTotal)}</p>
            </div>
            {!painelReajusteAberto && (
              <button
                onClick={() => {
                  setNovoSalario(String(salarioAtual));
                  setPainelReajusteAberto(true);
                }}
                className="shrink-0 rounded-full bg-ink text-white px-3 py-1.5 text-xs font-bold hover:bg-forest transition-colors"
              >
                Reajuste / Aumento
              </button>
            )}
          </div>
          <p className="text-xs text-ink/40 mt-3 pt-3 border-t border-black/5">
            Salário base: {formatarMoeda(salarioAtual)} + FGTS {formatarMoeda(encargos.fgts)} · {dias} dias úteis este mês
          </p>
        </div>

        {funcionario.papeis?.pessoas?.pix && (
          <div className="rounded-2xl bg-card p-3 mb-4 shadow-sm flex items-center justify-between">
            <span className="text-xs text-ink/50">Chave PIX</span>
            <span className="text-sm font-semibold text-ink">{funcionario.papeis.pessoas.pix}</span>
          </div>
        )}

        {painelReajusteAberto && (
          <form onSubmit={registrarReajuste} className="rounded-2xl bg-card p-4 mb-4 shadow-sm space-y-3">
            <p className="text-sm font-bold text-ink">Registrar reajuste / aumento</p>
            <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
              <button
                type="button"
                onClick={() => setTipoReajuste("reajuste")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tipoReajuste === "reajuste" ? "bg-ink text-white" : "text-ink/60"
                }`}
              >
                Reajuste
              </button>
              <button
                type="button"
                onClick={() => setTipoReajuste("aumento")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tipoReajuste === "aumento" ? "bg-ink text-white" : "text-ink/60"
                }`}
              >
                Aumento
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-ink/70 mb-1">Salário anterior</span>
                <input value={formatarMoeda(salarioAtual)} disabled className="input text-sm opacity-60" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-ink/70 mb-1">Novo salário (R$) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={novoSalario}
                  onChange={(e) => setNovoSalario(e.target.value)}
                  className="input text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-ink/70 mb-1">Data *</span>
                <input
                  type="date"
                  value={dataReajuste}
                  onChange={(e) => setDataReajuste(e.target.value)}
                  className="input text-sm"
                />
              </label>
              <label className="block col-span-2">
                <span className="block text-xs font-medium text-ink/70 mb-1">Observação</span>
                <input
                  value={observacaoReajuste}
                  onChange={(e) => setObservacaoReajuste(e.target.value)}
                  className="input text-sm"
                  placeholder="Motivo, referência..."
                />
              </label>
            </div>

            {erroReajuste && <p className="text-sm text-red-600">{erroReajuste}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={salvandoReajuste}
                className="rounded-full bg-forest text-white px-5 py-2 text-xs font-bold hover:bg-ink transition-colors disabled:opacity-50"
              >
                {salvandoReajuste ? "Salvando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setPainelReajusteAberto(false)}
                className="text-xs font-semibold text-ink/60 hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Benefícios</p>
          <div className="rounded-2xl bg-card p-4 shadow-sm space-y-2.5">
            {beneficios.length === 0 ? (
              <p className="text-sm text-ink/40">Nenhum benefício cadastrado.</p>
            ) : (
              beneficios.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-ink/70">{b.nome}</span>
                    <span className="block text-xs text-ink/40">
                      {b.tipo_valor === "diario"
                        ? `${formatarMoeda(b.valor)}/dia útil × ${dias} dias`
                        : "valor fixo mensal"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">
                      {formatarMoeda(valorMensalBeneficio(b, hoje.getFullYear(), hoje.getMonth()))}
                    </span>
                    <button onClick={() => removerBeneficio(b.id)} className="text-xs text-ink/30 hover:text-red-600">
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}

            <form onSubmit={adicionarBeneficio} className="space-y-2 pt-2 border-t border-black/5">
              <input
                value={nomeBeneficio}
                onChange={(e) => setNomeBeneficio(e.target.value)}
                className="input text-sm"
                placeholder="Vale-refeição, vale-transporte..."
              />
              <div className="flex gap-2">
                <div className="flex items-center gap-1 rounded-full bg-surface p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTipoValorBeneficio("mensal")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      tipoValorBeneficio === "mensal" ? "bg-ink text-white" : "text-ink/60"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoValorBeneficio("diario")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      tipoValorBeneficio === "diario" ? "bg-ink text-white" : "text-ink/60"
                    }`}
                  >
                    Por dia útil
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={valorBeneficio}
                  onChange={(e) => setValorBeneficio(e.target.value)}
                  className="input text-sm"
                  placeholder={tipoValorBeneficio === "diario" ? "R$/dia" : "R$/mês"}
                />
                <button
                  type="submit"
                  disabled={salvando}
                  className="shrink-0 rounded-full bg-forest text-white px-3 text-xs font-bold hover:bg-ink transition-colors"
                >
                  +
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">
            Provisões trabalhistas <span className="normal-case font-normal text-ink/30">(reserva, não é custo mensal em caixa)</span>
          </p>
          <div className="rounded-2xl bg-card p-4 shadow-sm space-y-2">
            <ProvisaoLinha label="Provisão 13º" percentual="8,33%" valor={formatarMoeda(encargos.decimoTerceiro)} />
            <ProvisaoLinha label="Provisão de Férias" percentual="8,33%" valor={formatarMoeda(encargos.ferias)} />
            <ProvisaoLinha label="Provisão 1/3 Férias" percentual="2,78%" valor={formatarMoeda(encargos.umTercoFerias)} />
            <ProvisaoLinha label="Provisão Aviso Prévio" percentual="8,33%" valor={formatarMoeda(encargos.avisoPrevio)} />
            <ProvisaoLinha label="Multa FGTS" percentual="40,00%" valor={formatarMoeda(encargos.multaFgts)} />
          </div>
        </div>

        {historico.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Histórico salarial</p>
            <div className="rounded-2xl bg-card p-4 shadow-sm space-y-3">
              {historico.map((h) => (
                <div key={h.id} className="text-sm border-b border-black/5 last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        h.tipo === "aumento" ? "bg-mint text-forest" : "bg-black/5 text-ink/60"
                      }`}
                    >
                      {h.tipo === "aumento" ? "Aumento" : "Reajuste"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink/40">
                        {new Date(h.data_alteracao + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                      <button
                        onClick={() => removerHistorico(h.id)}
                        className="text-xs text-ink/30 hover:text-red-600"
                        title="Excluir este registro do histórico"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="text-ink/70 mt-1">
                    {formatarMoeda(h.salario_anterior)} → <span className="font-semibold text-ink">{formatarMoeda(h.salario_novo)}</span>
                  </p>
                  {h.observacao && <p className="text-xs text-ink/40 mt-0.5">{h.observacao}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onRemover}
          className="w-full rounded-full border-2 border-red-200 text-red-600 px-5 py-2.5 text-sm font-bold hover:bg-red-50 transition-colors"
        >
          Desativar funcionário
        </button>
      </div>
    </div>
  );
}

function ProvisaoLinha({ label, percentual, valor }: { label: string; percentual: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink/70">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink/40 w-14 text-right">{percentual}</span>
        <span className="font-semibold text-ink w-20 text-right">{valor}</span>
      </div>
    </div>
  );
}

function FuncionarioForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [busca, setBusca] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoPessoa, setCadastrandoPessoa] = useState(false);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [cargoSelecionado, setCargoSelecionado] = useState<Cargo | null>(null);
  const [buscaCargo, setBuscaCargo] = useState("");
  const [mostrarSugestoesCargo, setMostrarSugestoesCargo] = useState(false);
  const [tipoContrato, setTipoContrato] = useState<"CLT" | "PJ">("CLT");
  const [salario, setSalario] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarPessoas() {
      const supabase = createClient();
      const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
      setPessoas(data ?? []);
    }
    async function carregarCargos() {
      const supabase = createClient();
      const { data } = await supabase.from("cargos").select("id, nome").order("nome");
      setCargos(data ?? []);
    }
    carregarPessoas();
    carregarCargos();
  }, []);

  const sugestoes = pessoas.filter((p) => normalizar(p.nome).includes(normalizar(busca)));
  const sugestoesCargo = cargos.filter((c) => normalizar(c.nome).includes(normalizar(buscaCargo)));

  async function garantirFuncionarioPapelId(pessoaId: string): Promise<string> {
    const supabase = createClient();
    const { data: existente } = await supabase
      .from("papeis")
      .select("id")
      .eq("pessoa_id", pessoaId)
      .eq("papel", "funcionario")
      .maybeSingle();
    if (existente?.id) return existente.id;

    const { data: novo, error } = await supabase
      .from("papeis")
      .insert({ pessoa_id: pessoaId, papel: "funcionario" })
      .select("id")
      .single();
    if (error) throw error;
    return novo.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pessoaSelecionada || !salario) {
      setErro("Selecione a pessoa e informe o salário.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      const papelId = await garantirFuncionarioPapelId(pessoaSelecionada.id);

      let cargoFinalId = cargoSelecionado?.id ?? null;
      if (!cargoFinalId && buscaCargo.trim()) {
        const { data, error } = await supabase
          .from("cargos")
          .insert({ nome: buscaCargo.trim() })
          .select("id")
          .single();
        if (error) throw error;
        cargoFinalId = data.id;
      }

      const { error } = await supabase.from("funcionarios").insert({
        papel_id: papelId,
        cargo_id: cargoFinalId,
        tipo_contrato: tipoContrato,
        salario: Number(salario),
        data_admissao: dataAdmissao || null,
      });
      if (error) throw error;
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (cadastrandoPessoa) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setCadastrandoPessoa(false)}
          className="text-sm font-semibold text-ink/50 hover:text-ink mb-4"
        >
          ← Voltar
        </button>
        <PessoaForm
          nomeInicial={busca}
          onCancel={() => setCadastrandoPessoa(false)}
          onSaved={async (pessoa) => {
            const supabase = createClient();
            const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
            setPessoas(data ?? []);
            setPessoaSelecionada(data?.find((p) => p.id === pessoa.id) ?? { id: pessoa.id, nome: pessoa.nome, tipo_pessoa: "PF" });
            setBusca(pessoa.nome);
            setCadastrandoPessoa(false);
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="relative">
        <span className="block text-sm font-medium text-ink/70 mb-1">
          Pessoa<span className="text-forest"> *</span>
        </span>
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPessoaSelecionada(null);
            setMostrarSugestoes(true);
          }}
          onFocus={() => setMostrarSugestoes(true)}
          className="input"
          placeholder="Digite o nome..."
        />
        {mostrarSugestoes && busca && !pessoaSelecionada && (
          <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
            {sugestoes.length > 0 ? (
              sugestoes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPessoaSelecionada(p);
                    setBusca(p.nome);
                    setMostrarSugestoes(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  {p.nome}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => setCadastrandoPessoa(true)}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
              >
                + Cadastrar &ldquo;{busca}&rdquo; como nova pessoa
              </button>
            )}
          </div>
        )}
        <span className="block text-xs text-ink/40 mt-1">
          Se a pessoa ainda não existe, o cadastro completo (CPF, telefone, e-mail, nascimento e
          endereço) é feito na hora de criar — é só escolher &ldquo;cadastrar como nova pessoa&rdquo;.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block relative">
          <span className="block text-sm font-medium text-ink/70 mb-1">Cargo</span>
          <input
            value={buscaCargo}
            onChange={(e) => {
              setBuscaCargo(e.target.value);
              setCargoSelecionado(null);
              setMostrarSugestoesCargo(true);
            }}
            onFocus={() => setMostrarSugestoesCargo(true)}
            className="input"
            placeholder="Digite o cargo..."
          />
          {mostrarSugestoesCargo && buscaCargo && !cargoSelecionado && (
            <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
              {sugestoesCargo.length > 0 ? (
                sugestoesCargo.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCargoSelecionado(c);
                      setBuscaCargo(c.nome);
                      setMostrarSugestoesCargo(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                  >
                    {c.nome}
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarSugestoesCargo(false)}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
                >
                  + Cadastrar &ldquo;{buscaCargo}&rdquo; como novo cargo
                </button>
              )}
            </div>
          )}
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Tipo de contrato *</span>
          <select value={tipoContrato} onChange={(e) => setTipoContrato(e.target.value as "CLT" | "PJ")} className="input">
            <option value="CLT">CLT</option>
            <option value="PJ">PJ</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Salário bruto (R$) *</span>
          <input type="number" step="0.01" min="0" value={salario} onChange={(e) => setSalario(e.target.value)} className="input" />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Início do contrato</span>
          <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className="input" />
        </label>
      </div>

      <p className="text-xs text-ink/40">
        Depois de salvar, você pode adicionar benefícios (vale-refeição, plano de saúde, etc.) clicando no
        funcionário na lista. A chave PIX fica no cadastro da própria pessoa (aba Pessoas) — se já
        estiver preenchida lá, aparece aqui no detalhe do funcionário automaticamente.
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar funcionário"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}

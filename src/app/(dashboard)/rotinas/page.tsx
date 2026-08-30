"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Trash2 } from "lucide-react";

const DIAS_SEMANA_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CORES_AVATAR = [
  "bg-red-400", "bg-orange-400", "bg-amber-500", "bg-lime-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
];
function corAvatar(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % CORES_AVATAR.length;
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
function Avatar({ nome, fotoUrl, tamanho = 28 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome} className="rounded-full object-cover shrink-0" style={{ width: tamanho, height: tamanho }} />;
  }
  return (
    <div
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center font-bold shrink-0`}
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}
      title={nome}
    >
      {iniciais(nome)}
    </div>
  );
}

// ============================================================
// A lógica central: "essa tarefa vale nesse dia?"
// ============================================================
export function rotinaAplicavelNaData(
  rotina: { frequencia: string; dias_semana: number[] | null; dia_mes: number | null; criado_em?: string },
  data: Date
): boolean {
  // Nunca aparece em dias anteriores a quando a tarefa foi cadastrada —
  // sem isso, uma tarefa criada hoje "apareceria" retroativamente em
  // dias passados também.
  if (rotina.criado_em) {
    const criada = new Date(rotina.criado_em);
    criada.setHours(0, 0, 0, 0);
    if (data.getTime() < criada.getTime()) return false;
  }
  if (rotina.frequencia === "diaria") return true;
  if (rotina.frequencia === "semanal") return (rotina.dias_semana ?? []).includes(data.getDay());
  if (rotina.frequencia === "mensal") {
    if (!rotina.dia_mes) return false;
    return data.getDate() === calcularDiaEfetivoMensal(data.getFullYear(), data.getMonth(), rotina.dia_mes);
  }
  return false;
}

// Rotina mensal "dia 5" — se cair num sábado ou domingo, empurra pra
// sexta-feira anterior automaticamente.
export function calcularDiaEfetivoMensal(ano: number, mes: number, diaAlvo: number): number {
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
  const data = new Date(ano, mes, Math.min(diaAlvo, ultimoDiaDoMes));
  const diaSemana = data.getDay();
  if (diaSemana === 0) data.setDate(data.getDate() - 2);
  else if (diaSemana === 6) data.setDate(data.getDate() - 1);
  return data.getDate();
}

function descreverFrequencia(rotina: { frequencia: string; dias_semana: number[] | null; dia_mes: number | null }): string {
  if (rotina.frequencia === "diaria") return "Todo dia";
  if (rotina.frequencia === "semanal") return (rotina.dias_semana ?? []).map((d) => DIAS_SEMANA_LABEL[d]).join(", ") || "Semanal";
  if (rotina.frequencia === "mensal") return `Todo dia ${rotina.dia_mes ?? "?"}`;
  return "";
}

interface Rotina {
  id: string;
  texto: string;
  descricao: string | null;
  grupo: string | null;
  frequencia: string;
  dias_semana: number[] | null;
  dia_mes: number | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  cargoIds: string[];
  funcionarioIds: string[];
  concluidoHoje?: boolean;
}
interface Opcao {
  id: string;
  nome: string;
}
interface FuncionarioOpcao {
  id: string;
  nome: string;
  fotoUrl: string | null;
  cargoId: string | null;
}

function formatarDataExibicao(data: Date, ehHoje: boolean): string {
  if (ehHoje) return "Hoje";
  return data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export default function RotinasPage() {
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [meuFuncionarioId, setMeuFuncionarioId] = useState<string | null>(null);
  const [meuCargoId, setMeuCargoId] = useState<string | null>(null);
  const [souAdmin, setSouAdmin] = useState(false);
  const [cargos, setCargos] = useState<Opcao[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioOpcao[]>([]);

  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  });
  const [rotinasDoDia, setRotinasDoDia] = useState<Rotina[]>([]);
  const [loadingDia, setLoadingDia] = useState(true);

  const [todasRotinas, setTodasRotinas] = useState<Rotina[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [rotinaEditandoId, setRotinaEditandoId] = useState<string | null>(null);
  const [aba, setAba] = useState<"minhas" | "todas">("minhas");
  const [agrupamentoAdmin, setAgrupamentoAdmin] = useState<"nenhum" | "pessoa" | "cargo">("nenhum");

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ehHoje = dataSelecionada.getTime() === hoje.getTime();
  const dataRefIso = dataSelecionada.toISOString().slice(0, 10);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: func } = await supabase
        .from("funcionarios")
        .select("id, cargo_id, perfis_acesso ( nome )")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const f = func as unknown as { id: string; cargo_id: string | null; perfis_acesso: { nome: string } | null } | null;
      setMeuFuncionarioId(f?.id ?? null);
      setMeuCargoId(f?.cargo_id ?? null);
      setSouAdmin(f?.perfis_acesso?.nome === "Administrador");

      const [{ data: cargosData }, { data: funcData }] = await Promise.all([
        supabase.from("cargos").select("id, nome").order("nome"),
        supabase
          .from("funcionarios")
          .select("id, cargo_id, papeis ( pessoas ( nome, foto_url ) )")
          .eq("ativo", true),
      ]);
      setCargos(cargosData ?? []);
      setFuncionarios(
        ((funcData ?? []) as unknown as { id: string; cargo_id: string | null; papeis: { pessoas: { nome: string; foto_url: string | null } | null } | null }[]).map(
          (fu) => ({ id: fu.id, nome: fu.papeis?.pessoas?.nome ?? "—", fotoUrl: fu.papeis?.pessoas?.foto_url ?? null, cargoId: fu.cargo_id })
        )
      );
      setCarregandoBase(false);
    }
    carregar();
  }, []);

  const buscarRotinasCompletas = useCallback(async (): Promise<Rotina[]> => {
    const supabase = createClient();
    const [{ data: rotinasData }, { data: respCargoData }, { data: respFuncData }] = await Promise.all([
      supabase.from("rotinas").select("id, texto, descricao, grupo, frequencia, dias_semana, dia_mes, ativo, ordem, criado_em").order("ordem"),
      supabase.from("rotina_responsaveis_cargo").select("rotina_id, cargo_id"),
      supabase.from("rotina_responsaveis_funcionario").select("rotina_id, funcionario_id"),
    ]);
    return (rotinasData ?? []).map((r) => ({
      ...r,
      cargoIds: (respCargoData ?? []).filter((c) => c.rotina_id === r.id).map((c) => c.cargo_id),
      funcionarioIds: (respFuncData ?? []).filter((f) => f.rotina_id === r.id).map((f) => f.funcionario_id),
    }));
  }, []);

  const carregarRotinasDoDia = useCallback(async () => {
    if (!meuFuncionarioId) return;
    setLoadingDia(true);
    const supabase = createClient();
    const todas = await buscarRotinasCompletas();

    const minhas = todas
      .filter((r) => r.ativo)
      .filter((r) => (meuCargoId && r.cargoIds.includes(meuCargoId)) || r.funcionarioIds.includes(meuFuncionarioId))
      .filter((r) => rotinaAplicavelNaData(r, dataSelecionada));

    if (minhas.length > 0) {
      const ids = minhas.map((r) => r.id);
      const { data: execucoes } = await supabase
        .from("rotina_execucoes")
        .select("rotina_id")
        .eq("funcionario_id", meuFuncionarioId)
        .eq("data_referencia", dataRefIso)
        .in("rotina_id", ids);
      const feitos = new Set((execucoes ?? []).map((e) => e.rotina_id));
      minhas.forEach((r) => (r.concluidoHoje = feitos.has(r.id)));
    }

    setRotinasDoDia(minhas);
    setLoadingDia(false);
  }, [meuFuncionarioId, meuCargoId, dataSelecionada, dataRefIso, buscarRotinasCompletas]);

  useEffect(() => {
    if (meuFuncionarioId) carregarRotinasDoDia();
  }, [meuFuncionarioId, carregarRotinasDoDia]);

  async function toggleRotina(rotinaId: string, marcado: boolean) {
    if (!ehHoje || !meuFuncionarioId) return;
    const supabase = createClient();
    if (marcado) {
      await supabase.from("rotina_execucoes").insert({ rotina_id: rotinaId, funcionario_id: meuFuncionarioId, data_referencia: dataRefIso });
    } else {
      await supabase.from("rotina_execucoes").delete().eq("rotina_id", rotinaId).eq("funcionario_id", meuFuncionarioId).eq("data_referencia", dataRefIso);
    }
    setRotinasDoDia((atual) => atual.map((r) => (r.id === rotinaId ? { ...r, concluidoHoje: marcado } : r)));
  }

  function mudarDia(delta: number) {
    setDataSelecionada((atual) => {
      const nova = new Date(atual);
      nova.setDate(nova.getDate() + delta);
      return nova;
    });
  }

  const carregarTodasRotinas = useCallback(async () => {
    setLoadingAdmin(true);
    setTodasRotinas(await buscarRotinasCompletas());
    setLoadingAdmin(false);
  }, [buscarRotinasCompletas]);

  useEffect(() => {
    if (aba === "todas" && souAdmin) carregarTodasRotinas();
  }, [aba, souAdmin, carregarTodasRotinas]);

  async function excluirRotina(id: string, texto: string) {
    if (!window.confirm(`Excluir a tarefa "${texto}"? Isso remove o histórico de conclusões dela.`)) return;
    const supabase = createClient();
    await supabase.from("rotinas").delete().eq("id", id);
    carregarTodasRotinas();
    carregarRotinasDoDia();
  }

  async function alternarAtivo(rotina: Rotina) {
    const supabase = createClient();
    await supabase.from("rotinas").update({ ativo: !rotina.ativo }).eq("id", rotina.id);
    carregarTodasRotinas();
    carregarRotinasDoDia();
  }

  // Agrupa as tarefas do dia pelo campo "grupo" — quem não tem grupo
  // aparece solto, sem forçar nenhuma organização.
  const gruposDoDia: { grupo: string | null; itens: Rotina[] }[] = [];
  for (const r of rotinasDoDia) {
    let bucket = gruposDoDia.find((g) => g.grupo === r.grupo);
    if (!bucket) {
      bucket = { grupo: r.grupo, itens: [] };
      gruposDoDia.push(bucket);
    }
    bucket.itens.push(r);
  }

  const totalItens = rotinasDoDia.length;
  const totalFeitos = rotinasDoDia.filter((r) => r.concluidoHoje).length;

  if (carregandoBase) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Rotinas</h1>
        <p className="text-sm text-ink/60">Tarefas recorrentes — diárias, semanais ou mensais.</p>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-6 border-b-2 border-black/5 flex-1">
          <button
            onClick={() => setAba("minhas")}
            className={`relative pb-2.5 text-sm font-bold transition-colors ${aba === "minhas" ? "text-ink" : "text-ink/40 hover:text-ink/70"}`}
          >
            Minhas rotinas
            {aba === "minhas" && <span className="absolute left-0 right-0 -bottom-0.5 h-[3px] rounded-full bg-ink" />}
          </button>
          {souAdmin && (
            <button
              onClick={() => setAba("todas")}
              className={`relative pb-2.5 text-sm font-bold transition-colors ${aba === "todas" ? "text-ink" : "text-ink/40 hover:text-ink/70"}`}
            >
              Todas as rotinas
              {aba === "todas" && <span className="absolute left-0 right-0 -bottom-0.5 h-[3px] rounded-full bg-ink" />}
            </button>
          )}
        </div>
        {souAdmin && aba === "todas" && (
          <button
            onClick={() => {
              setRotinaEditandoId(null);
              setModalAberto(true);
            }}
            className="rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-forest transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus size={15} /> Adicionar rotina
          </button>
        )}
      </div>

      {aba === "minhas" && (
        <>
          <div className="flex items-center justify-center gap-4 mb-6 rounded-2xl bg-card border border-black/5 py-3">
            <button onClick={() => mudarDia(-1)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-surface text-ink/50">
              ‹
            </button>
            <div className="text-center min-w-[140px]">
              <p className="text-sm font-bold text-ink">{formatarDataExibicao(dataSelecionada, ehHoje)}</p>
              {!ehHoje && <p className="text-[11px] text-ink/40">{dataSelecionada.toLocaleDateString("pt-BR")}</p>}
            </div>
            <button onClick={() => mudarDia(1)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-surface text-ink/50">
              ›
            </button>
            {!ehHoje && (
              <button
                onClick={() => {
                  const h = new Date();
                  h.setHours(0, 0, 0, 0);
                  setDataSelecionada(h);
                }}
                className="text-xs font-semibold text-forest hover:text-ink ml-2"
              >
                Voltar pra hoje
              </button>
            )}
          </div>

          {!ehHoje && (
            <p className="text-xs text-ink/40 text-center mb-4">Só é possível marcar/desmarcar no dia de hoje — dias passados ficam só de consulta.</p>
          )}

          {totalItens > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="h-1.5 flex-1 rounded-full bg-black/5 overflow-hidden">
                <span
                  className={`block h-full rounded-full ${totalFeitos === totalItens ? "bg-forest" : "bg-amber-500"}`}
                  style={{ width: `${(totalFeitos / totalItens) * 100}%` }}
                />
              </span>
              <span className="text-xs font-bold text-ink/50 shrink-0">
                {totalFeitos}/{totalItens}
              </span>
            </div>
          )}

          {loadingDia ? (
            <p className="text-sm text-ink/50">Carregando...</p>
          ) : rotinasDoDia.length === 0 ? (
            <div className="rounded-2xl bg-card border border-black/5 p-8 text-center">
              <p className="text-sm text-ink/50">Nenhuma tarefa pra {ehHoje ? "hoje" : "esse dia"}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {gruposDoDia.map((bucket) => (
                <div key={bucket.grupo ?? "__solto__"} className="rounded-2xl bg-card border border-black/5 p-4">
                  {bucket.grupo && <p className="text-sm font-bold text-ink mb-2">{bucket.grupo}</p>}
                  <div className="space-y-1.5">
                    {bucket.itens.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-start gap-2.5 rounded-xl px-3 py-2 transition-colors ${
                          ehHoje ? "cursor-pointer hover:bg-surface" : "cursor-default"
                        } ${item.concluidoHoje ? "bg-mint/40" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!item.concluidoHoje}
                          disabled={!ehHoje}
                          onChange={(e) => toggleRotina(item.id, e.target.checked)}
                          className="h-4 w-4 rounded accent-forest mt-0.5 shrink-0 disabled:opacity-50"
                        />
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm ${item.concluidoHoje ? "text-ink/40 line-through" : "text-ink"}`}>{item.texto}</span>
                          {item.descricao && <span className="block text-xs text-ink/40 mt-0.5">{item.descricao}</span>}
                          {!bucket.grupo && <span className="block text-[10px] text-ink/30 mt-0.5">{descreverFrequencia(item)}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {aba === "todas" && souAdmin && (
        <div>
          <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 mb-4">
            <button
              onClick={() => setAgrupamentoAdmin("nenhum")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                agrupamentoAdmin === "nenhum" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Lista simples
            </button>
            <button
              onClick={() => setAgrupamentoAdmin("pessoa")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                agrupamentoAdmin === "pessoa" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Por pessoa
            </button>
            <button
              onClick={() => setAgrupamentoAdmin("cargo")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                agrupamentoAdmin === "cargo" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Por cargo
            </button>
          </div>

          {loadingAdmin ? (
            <p className="text-sm text-ink/50">Carregando...</p>
          ) : todasRotinas.length === 0 ? (
            <p className="text-sm text-ink/50">Nenhuma tarefa recorrente cadastrada ainda.</p>
          ) : agrupamentoAdmin === "nenhum" ? (
            <ListaRotinasFlat
              rotinas={todasRotinas}
              cargos={cargos}
              funcionarios={funcionarios}
              onEditar={(rid) => {
                setRotinaEditandoId(rid);
                setModalAberto(true);
              }}
              onExcluir={excluirRotina}
              onAlternarAtivo={alternarAtivo}
            />
          ) : agrupamentoAdmin === "pessoa" ? (
            <div className="space-y-4">
              {funcionarios.map((func) => {
                const dela = todasRotinas.filter(
                  (r) => (func.cargoId && r.cargoIds.includes(func.cargoId)) || r.funcionarioIds.includes(func.id)
                );
                if (dela.length === 0) return null;
                return (
                  <div key={func.id} className="rounded-2xl bg-card border border-black/5 p-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <Avatar nome={func.nome} fotoUrl={func.fotoUrl} tamanho={28} />
                      <p className="text-sm font-bold text-ink">{func.nome}</p>
                    </div>
                    <ListaRotinasFlat
                      rotinas={dela}
                      cargos={cargos}
                      funcionarios={funcionarios}
                      compacta
                      onEditar={(rid) => {
                        setRotinaEditandoId(rid);
                        setModalAberto(true);
                      }}
                      onExcluir={excluirRotina}
                      onAlternarAtivo={alternarAtivo}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {cargos.map((cargo) => {
                const doCargo = todasRotinas.filter((r) => r.cargoIds.includes(cargo.id));
                if (doCargo.length === 0) return null;
                return (
                  <div key={cargo.id} className="rounded-2xl bg-card border border-black/5 p-4">
                    <p className="text-sm font-bold text-ink mb-3">{cargo.nome}</p>
                    <ListaRotinasFlat
                      rotinas={doCargo}
                      cargos={cargos}
                      funcionarios={funcionarios}
                      compacta
                      onEditar={(rid) => {
                        setRotinaEditandoId(rid);
                        setModalAberto(true);
                      }}
                      onExcluir={excluirRotina}
                      onAlternarAtivo={alternarAtivo}
                    />
                  </div>
                );
              })}
              {(() => {
                const soPessoas = todasRotinas.filter((r) => r.cargoIds.length === 0 && r.funcionarioIds.length > 0);
                if (soPessoas.length === 0) return null;
                return (
                  <div className="rounded-2xl bg-card border border-black/5 p-4">
                    <p className="text-sm font-bold text-ink mb-3">Pessoas específicas (sem cargo definido)</p>
                    <ListaRotinasFlat
                      rotinas={soPessoas}
                      cargos={cargos}
                      funcionarios={funcionarios}
                      compacta
                      onEditar={(rid) => {
                        setRotinaEditandoId(rid);
                        setModalAberto(true);
                      }}
                      onExcluir={excluirRotina}
                      onAlternarAtivo={alternarAtivo}
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {modalAberto && (
        <ModalRotina
          rotinaId={rotinaEditandoId}
          rotinaExistente={todasRotinas.find((r) => r.id === rotinaEditandoId) ?? null}
          gruposExistentes={Array.from(new Set(todasRotinas.map((r) => r.grupo).filter(Boolean))) as string[]}
          cargos={cargos}
          funcionarios={funcionarios}
          onClose={() => setModalAberto(false)}
          onSalvo={async () => {
            setModalAberto(false);
            carregarTodasRotinas();
            carregarRotinasDoDia();
          }}
        />
      )}
    </main>
  );
}

// ============================================================
// Lista simples de rotinas (reaproveitada nas 3 formas de agrupar)
// ============================================================
function ListaRotinasFlat({
  rotinas,
  cargos,
  funcionarios,
  compacta,
  onEditar,
  onExcluir,
  onAlternarAtivo,
}: {
  rotinas: Rotina[];
  cargos: Opcao[];
  funcionarios: FuncionarioOpcao[];
  compacta?: boolean;
  onEditar: (id: string) => void;
  onExcluir: (id: string, texto: string) => void;
  onAlternarAtivo: (rotina: Rotina) => void;
}) {
  return (
    <div className={compacta ? "space-y-1.5" : "space-y-2"}>
      {rotinas.map((r) => {
        const nomesCargos = r.cargoIds.map((cid) => cargos.find((c) => c.id === cid)?.nome).filter(Boolean);
        const nomesFuncionarios = r.funcionarioIds.map((fid) => funcionarios.find((f) => f.id === fid)?.nome).filter(Boolean);
        return (
          <div
            key={r.id}
            className={`rounded-2xl border border-black/5 ${compacta ? "p-3" : "p-4"} ${r.ativo ? "bg-card" : "bg-surface/50 opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {r.grupo && <span className="text-[10px] font-bold bg-surface text-ink/50 rounded-full px-2 py-0.5 shrink-0">{r.grupo}</span>}
                  <p className="text-sm font-bold text-ink truncate">{r.texto}</p>
                </div>
                <p className="text-xs text-ink/40 mt-0.5">{descreverFrequencia(r)}</p>
                {!compacta && (nomesCargos.length > 0 || nomesFuncionarios.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {nomesCargos.map((n) => (
                      <span key={n} className="text-[10px] font-bold bg-mint text-forest rounded-full px-2 py-0.5">
                        {n}
                      </span>
                    ))}
                    {nomesFuncionarios.map((n) => (
                      <span key={n} className="text-[10px] font-bold bg-surface text-ink/60 rounded-full px-2 py-0.5">
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onAlternarAtivo(r)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${r.ativo ? "bg-mint text-forest" : "bg-black/5 text-ink/40"}`}
                >
                  {r.ativo ? "Ativa" : "Pausada"}
                </button>
                <button onClick={() => onEditar(r.id)} className="text-xs font-semibold text-ink/50 hover:text-ink px-2 py-1">
                  Editar
                </button>
                <button
                  onClick={() => onExcluir(r.id, r.texto)}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-ink/30 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Modal de criar/editar uma tarefa recorrente
// ============================================================
function ModalRotina({
  rotinaId,
  rotinaExistente,
  gruposExistentes,
  cargos,
  funcionarios,
  onClose,
  onSalvo,
}: {
  rotinaId: string | null;
  rotinaExistente: Rotina | null;
  gruposExistentes: string[];
  cargos: Opcao[];
  funcionarios: FuncionarioOpcao[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [texto, setTexto] = useState(rotinaExistente?.texto ?? "");
  const [descricao, setDescricao] = useState(rotinaExistente?.descricao ?? "");
  const [grupo, setGrupo] = useState(rotinaExistente?.grupo ?? "");
  const [frequencia, setFrequencia] = useState(rotinaExistente?.frequencia ?? "diaria");
  const [diasSemana, setDiasSemana] = useState<Set<number>>(new Set(rotinaExistente?.dias_semana ?? []));
  const [diaMes, setDiaMes] = useState(rotinaExistente?.dia_mes ? String(rotinaExistente.dia_mes) : "");
  const [cargosSelecionados, setCargosSelecionados] = useState<Set<string>>(new Set(rotinaExistente?.cargoIds ?? []));
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<Set<string>>(new Set(rotinaExistente?.funcionarioIds ?? []));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarConjunto<T>(set: Set<T>, valor: T, setter: (novo: Set<T>) => void) {
    const novo = new Set(set);
    if (novo.has(valor)) novo.delete(valor);
    else novo.add(valor);
    setter(novo);
  }

  async function salvar() {
    setErro(null);
    if (!texto.trim()) {
      setErro("Escreve o nome da tarefa.");
      return;
    }
    if (frequencia === "semanal" && diasSemana.size === 0) {
      setErro("Marca pelo menos 1 dia da semana.");
      return;
    }
    if (frequencia === "mensal" && !diaMes) {
      setErro("Escolhe o dia do mês.");
      return;
    }
    if (cargosSelecionados.size === 0 && funcionariosSelecionados.size === 0) {
      setErro("Escolhe pelo menos um cargo ou uma pessoa responsável.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const dadosRotina = {
      texto: texto.trim(),
      descricao: descricao.trim() || null,
      grupo: grupo.trim() || null,
      frequencia,
      dias_semana: frequencia === "semanal" ? Array.from(diasSemana) : null,
      dia_mes: frequencia === "mensal" ? Number(diaMes) : null,
    };

    let idRotina = rotinaId;
    if (idRotina) {
      await supabase.from("rotinas").update(dadosRotina).eq("id", idRotina);
      await supabase.from("rotina_responsaveis_cargo").delete().eq("rotina_id", idRotina);
      await supabase.from("rotina_responsaveis_funcionario").delete().eq("rotina_id", idRotina);
    } else {
      const { data: nova, error } = await supabase.from("rotinas").insert(dadosRotina).select("id").single();
      if (error || !nova) {
        setErro("Erro ao criar: " + (error?.message ?? ""));
        setSalvando(false);
        return;
      }
      idRotina = nova.id;
    }

    if (cargosSelecionados.size > 0) {
      await supabase.from("rotina_responsaveis_cargo").insert(Array.from(cargosSelecionados).map((cid) => ({ rotina_id: idRotina, cargo_id: cid })));
    }
    if (funcionariosSelecionados.size > 0) {
      await supabase
        .from("rotina_responsaveis_funcionario")
        .insert(Array.from(funcionariosSelecionados).map((fid) => ({ rotina_id: idRotina, funcionario_id: fid })));
    }

    setSalvando(false);
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4 anim-entrada" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ink">{rotinaId ? "Editar tarefa" : "Nova tarefa recorrente"}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-ink/40 hover:bg-surface hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Nome da tarefa</span>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} className="input" placeholder="Ex: Ligar as luzes da loja" />
          </label>

          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Detalhe (opcional)</span>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" placeholder="Instrução mais longa, se precisar" />
          </label>

          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">
              Grupo (opcional) <span className="normal-case font-normal text-ink/30">— só pra juntar visualmente com outras tarefas parecidas</span>
            </span>
            <input
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="input"
              placeholder="Ex: Abertura da loja"
              list="grupos-rotina"
            />
            <datalist id="grupos-rotina">
              {gruposExistentes.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Frequência</span>
            <select value={frequencia} onChange={(e) => setFrequencia(e.target.value)} className="input">
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
          </label>

          {frequencia === "semanal" && (
            <div>
              <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Quais dias</span>
              <div className="flex gap-1.5">
                {DIAS_SEMANA_LABEL.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => alternarConjunto(diasSemana, i, setDiasSemana)}
                    className={`h-9 w-9 rounded-full text-xs font-bold transition-colors ${
                      diasSemana.has(i) ? "bg-ink text-white" : "bg-surface text-ink/50 hover:bg-black/10"
                    }`}
                  >
                    {label[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequencia === "mensal" && (
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Dia do mês</span>
              <input type="number" min={1} max={31} value={diaMes} onChange={(e) => setDiaMes(e.target.value)} className="input" placeholder="Ex: 5" />
              <span className="block text-xs text-ink/40 mt-1">Se cair num sábado ou domingo, passa pra sexta-feira anterior automaticamente.</span>
            </label>
          )}

          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">
              Cargos responsáveis <span className="normal-case font-normal text-ink/30">— todo mundo com esse cargo vê essa tarefa</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {cargos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternarConjunto(cargosSelecionados, c.id, setCargosSelecionados)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    cargosSelecionados.has(c.id) ? "bg-mint text-forest border-forest" : "border-black/10 text-ink/60 hover:bg-surface"
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">
              Pessoas específicas <span className="normal-case font-normal text-ink/30">— além (ou no lugar) do cargo</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {funcionarios.map((f) => {
                const marcado = funcionariosSelecionados.has(f.id);
                return (
                  <button key={f.id} type="button" onClick={() => alternarConjunto(funcionariosSelecionados, f.id, setFuncionariosSelecionados)} className="relative" title={f.nome}>
                    <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={32} />
                    {marcado && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-forest text-white text-[9px] flex items-center justify-center ring-2 ring-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings2, Plus, X, GripVertical, Trash2 } from "lucide-react";

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
// A lógica central: "essa rotina vale nesse dia?"
// ============================================================
function rotinaAplicavelNaData(rotina: { frequencia: string; dias_semana: number[] | null; dia_mes: number | null }, data: Date): boolean {
  if (rotina.frequencia === "diaria") return true;
  if (rotina.frequencia === "semanal") return (rotina.dias_semana ?? []).includes(data.getDay());
  if (rotina.frequencia === "mensal") {
    if (!rotina.dia_mes) return false;
    return data.getDate() === calcularDiaEfetivoMensal(data.getFullYear(), data.getMonth(), rotina.dia_mes);
  }
  return false;
}

// Rotina mensal "dia 5" — se cair num sábado ou domingo, empurra pra
// sexta-feira anterior automaticamente (ninguém costuma estar
// trabalhando no fim de semana).
function calcularDiaEfetivoMensal(ano: number, mes: number, diaAlvo: number): number {
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

interface RotinaItem {
  id: string;
  texto: string;
  descricao: string | null;
  ordem: number;
  concluidoHoje?: boolean;
}
interface Rotina {
  id: string;
  nome: string;
  descricao: string | null;
  frequencia: string;
  dias_semana: number[] | null;
  dia_mes: number | null;
  ativo: boolean;
  ordem: number;
  itens: RotinaItem[];
  cargoIds: string[];
  funcionarioIds: string[];
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

  const [painelAdminAberto, setPainelAdminAberto] = useState(false);
  const [todasRotinas, setTodasRotinas] = useState<Rotina[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [rotinaEditandoId, setRotinaEditandoId] = useState<string | null>(null);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ehHoje = dataSelecionada.getTime() === hoje.getTime();
  const dataRefIso = dataSelecionada.toISOString().slice(0, 10);

  // ---------------- Carregamento base (usuário, cargos, funcionários) ----------------
  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: func } = await supabase
        .from("funcionarios")
        .select("id, cargo_id, papeis ( pessoas ( nome ) ), perfis_acesso ( nome )")
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

  // ---------------- Busca todas as rotinas ativas + itens + responsáveis ----------------
  const buscarRotinasCompletas = useCallback(async (): Promise<Rotina[]> => {
    const supabase = createClient();
    const [{ data: rotinasData }, { data: itensData }, { data: respCargoData }, { data: respFuncData }] = await Promise.all([
      supabase.from("rotinas").select("id, nome, descricao, frequencia, dias_semana, dia_mes, ativo, ordem").order("ordem"),
      supabase.from("rotina_itens").select("id, rotina_id, texto, descricao, ordem").order("ordem"),
      supabase.from("rotina_responsaveis_cargo").select("rotina_id, cargo_id"),
      supabase.from("rotina_responsaveis_funcionario").select("rotina_id, funcionario_id"),
    ]);
    return (rotinasData ?? []).map((r) => ({
      ...r,
      itens: (itensData ?? []).filter((i) => i.rotina_id === r.id).map((i) => ({ id: i.id, texto: i.texto, descricao: i.descricao, ordem: i.ordem })),
      cargoIds: (respCargoData ?? []).filter((c) => c.rotina_id === r.id).map((c) => c.cargo_id),
      funcionarioIds: (respFuncData ?? []).filter((f) => f.rotina_id === r.id).map((f) => f.funcionario_id),
    }));
  }, []);

  // ---------------- Carrega as rotinas do dia selecionado, pra mim ----------------
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
      const idsItens = minhas.flatMap((r) => r.itens.map((i) => i.id));
      const { data: execucoes } =
        idsItens.length > 0
          ? await supabase
              .from("rotina_execucoes")
              .select("rotina_item_id")
              .eq("funcionario_id", meuFuncionarioId)
              .eq("data_referencia", dataRefIso)
              .in("rotina_item_id", idsItens)
          : { data: [] };
      const feitos = new Set((execucoes ?? []).map((e) => e.rotina_item_id));
      minhas.forEach((r) => r.itens.forEach((i) => (i.concluidoHoje = feitos.has(i.id))));
    }

    setRotinasDoDia(minhas);
    setLoadingDia(false);
  }, [meuFuncionarioId, meuCargoId, dataSelecionada, dataRefIso, buscarRotinasCompletas]);

  useEffect(() => {
    if (meuFuncionarioId) carregarRotinasDoDia();
  }, [meuFuncionarioId, carregarRotinasDoDia]);

  async function toggleItem(itemId: string, marcado: boolean) {
    if (!ehHoje || !meuFuncionarioId) return;
    const supabase = createClient();
    if (marcado) {
      await supabase.from("rotina_execucoes").insert({ rotina_item_id: itemId, funcionario_id: meuFuncionarioId, data_referencia: dataRefIso });
    } else {
      await supabase
        .from("rotina_execucoes")
        .delete()
        .eq("rotina_item_id", itemId)
        .eq("funcionario_id", meuFuncionarioId)
        .eq("data_referencia", dataRefIso);
    }
    setRotinasDoDia((atual) => atual.map((r) => ({ ...r, itens: r.itens.map((i) => (i.id === itemId ? { ...i, concluidoHoje: marcado } : i)) })));
  }

  function mudarDia(delta: number) {
    setDataSelecionada((atual) => {
      const nova = new Date(atual);
      nova.setDate(nova.getDate() + delta);
      return nova;
    });
  }

  // ---------------- Painel de administração ----------------
  async function abrirPainelAdmin() {
    setPainelAdminAberto(true);
    setLoadingAdmin(true);
    setTodasRotinas(await buscarRotinasCompletas());
    setLoadingAdmin(false);
  }

  async function excluirRotina(id: string, nome: string) {
    if (!window.confirm(`Excluir a rotina "${nome}"? Isso remove os itens e o histórico de conclusões dela.`)) return;
    const supabase = createClient();
    await supabase.from("rotinas").delete().eq("id", id);
    setTodasRotinas(await buscarRotinasCompletas());
    carregarRotinasDoDia();
  }

  async function alternarAtivo(rotina: Rotina) {
    const supabase = createClient();
    await supabase.from("rotinas").update({ ativo: !rotina.ativo }).eq("id", rotina.id);
    setTodasRotinas(await buscarRotinasCompletas());
    carregarRotinasDoDia();
  }

  const totalItens = rotinasDoDia.reduce((s, r) => s + r.itens.length, 0);
  const totalFeitos = rotinasDoDia.reduce((s, r) => s + r.itens.filter((i) => i.concluidoHoje).length, 0);

  if (carregandoBase) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Rotinas</h1>
          <p className="text-sm text-ink/60">Suas tarefas recorrentes — diárias, semanais ou mensais.</p>
        </div>
        {souAdmin && (
          <button
            onClick={abrirPainelAdmin}
            className="rounded-full border-2 border-black/10 text-ink px-4 py-2 text-sm font-semibold hover:bg-surface transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Settings2 size={15} /> Gerenciar
          </button>
        )}
      </div>

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
            <span className={`block h-full rounded-full ${totalFeitos === totalItens ? "bg-forest" : "bg-amber-500"}`} style={{ width: `${(totalFeitos / totalItens) * 100}%` }} />
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
          <p className="text-sm text-ink/50">Nenhuma rotina pra {ehHoje ? "hoje" : "esse dia"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rotinasDoDia.map((rotina) => (
            <div key={rotina.id} className="rounded-2xl bg-card border border-black/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-ink">{rotina.nome}</p>
                <span className="text-[10px] font-semibold text-ink/40 bg-surface rounded-full px-2 py-0.5">{descreverFrequencia(rotina)}</span>
              </div>
              {rotina.descricao && <p className="text-xs text-ink/50 mb-3">{rotina.descricao}</p>}
              <div className="space-y-1.5">
                {rotina.itens.map((item) => (
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
                      onChange={(e) => toggleItem(item.id, e.target.checked)}
                      className="h-4 w-4 rounded accent-forest mt-0.5 shrink-0 disabled:opacity-50"
                    />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm ${item.concluidoHoje ? "text-ink/40 line-through" : "text-ink"}`}>{item.texto}</span>
                      {item.descricao && <span className="block text-xs text-ink/40 mt-0.5">{item.descricao}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {painelAdminAberto && (
        <PainelAdminRotinas
          rotinas={todasRotinas}
          loading={loadingAdmin}
          cargos={cargos}
          funcionarios={funcionarios}
          onClose={() => setPainelAdminAberto(false)}
          onNovaRotina={() => {
            setRotinaEditandoId(null);
            setModalAberto(true);
          }}
          onEditarRotina={(id) => {
            setRotinaEditandoId(id);
            setModalAberto(true);
          }}
          onExcluirRotina={excluirRotina}
          onAlternarAtivo={alternarAtivo}
        />
      )}

      {modalAberto && (
        <ModalRotina
          rotinaId={rotinaEditandoId}
          rotinaExistente={todasRotinas.find((r) => r.id === rotinaEditandoId) ?? null}
          cargos={cargos}
          funcionarios={funcionarios}
          onClose={() => setModalAberto(false)}
          onSalvo={async () => {
            setModalAberto(false);
            setTodasRotinas(await buscarRotinasCompletas());
            carregarRotinasDoDia();
          }}
        />
      )}
    </main>
  );
}

// ============================================================
// Painel de administração — lista todas as rotinas cadastradas
// ============================================================
function PainelAdminRotinas({
  rotinas,
  loading,
  cargos,
  funcionarios,
  onClose,
  onNovaRotina,
  onEditarRotina,
  onExcluirRotina,
  onAlternarAtivo,
}: {
  rotinas: Rotina[];
  loading: boolean;
  cargos: Opcao[];
  funcionarios: FuncionarioOpcao[];
  onClose: () => void;
  onNovaRotina: () => void;
  onEditarRotina: (id: string) => void;
  onExcluirRotina: (id: string, nome: string) => void;
  onAlternarAtivo: (rotina: Rotina) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-4 overflow-y-auto anim-entrada" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl mt-10 mb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <div>
            <h2 className="text-lg font-bold text-ink">Gerenciar rotinas</h2>
            <p className="text-xs text-ink/50">Só administradores veem essa área.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNovaRotina}
              className="rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-forest transition-colors flex items-center gap-1.5"
            >
              <Plus size={15} /> Nova rotina
            </button>
            <button onClick={onClose} className="h-9 w-9 rounded-full flex items-center justify-center text-ink/40 hover:bg-surface hover:text-ink">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-ink/50 p-4">Carregando...</p>
          ) : rotinas.length === 0 ? (
            <p className="text-sm text-ink/50 p-4">Nenhuma rotina cadastrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {rotinas.map((r) => {
                const nomesCargos = r.cargoIds.map((cid) => cargos.find((c) => c.id === cid)?.nome).filter(Boolean);
                const nomesFuncionarios = r.funcionarioIds.map((fid) => funcionarios.find((f) => f.id === fid)?.nome).filter(Boolean);
                return (
                  <div key={r.id} className={`rounded-2xl border border-black/5 p-4 ${r.ativo ? "bg-card" : "bg-surface/50 opacity-60"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink truncate">{r.nome}</p>
                        <p className="text-xs text-ink/40 mt-0.5">
                          {descreverFrequencia(r)} · {r.itens.length} {r.itens.length === 1 ? "item" : "itens"}
                        </p>
                        {(nomesCargos.length > 0 || nomesFuncionarios.length > 0) && (
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
                        <button
                          onClick={() => onEditarRotina(r.id)}
                          className="text-xs font-semibold text-ink/50 hover:text-ink px-2 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => onExcluirRotina(r.id, r.nome)}
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
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal de criar/editar rotina
// ============================================================
interface ItemEmEdicao {
  id: string; // id real (se já existe) ou um id temporário (se novo)
  texto: string;
  descricao: string;
}

function ModalRotina({
  rotinaId,
  rotinaExistente,
  cargos,
  funcionarios,
  onClose,
  onSalvo,
}: {
  rotinaId: string | null;
  rotinaExistente: Rotina | null;
  cargos: Opcao[];
  funcionarios: FuncionarioOpcao[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(rotinaExistente?.nome ?? "");
  const [descricao, setDescricao] = useState(rotinaExistente?.descricao ?? "");
  const [frequencia, setFrequencia] = useState(rotinaExistente?.frequencia ?? "diaria");
  const [diasSemana, setDiasSemana] = useState<Set<number>>(new Set(rotinaExistente?.dias_semana ?? []));
  const [diaMes, setDiaMes] = useState(rotinaExistente?.dia_mes ? String(rotinaExistente.dia_mes) : "");
  const [itens, setItens] = useState<ItemEmEdicao[]>(
    rotinaExistente?.itens.map((i) => ({ id: i.id, texto: i.texto, descricao: i.descricao ?? "" })) ?? []
  );
  const [cargosSelecionados, setCargosSelecionados] = useState<Set<string>>(new Set(rotinaExistente?.cargoIds ?? []));
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<Set<string>>(new Set(rotinaExistente?.funcionarioIds ?? []));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const indiceArrastado = useRef<number | null>(null);

  function alternarConjunto<T>(set: Set<T>, valor: T, setter: (novo: Set<T>) => void) {
    const novo = new Set(set);
    if (novo.has(valor)) novo.delete(valor);
    else novo.add(valor);
    setter(novo);
  }

  function adicionarItem() {
    setItens((atual) => [...atual, { id: `novo-${Date.now()}-${Math.random()}`, texto: "", descricao: "" }]);
  }
  function removerItem(id: string) {
    setItens((atual) => atual.filter((i) => i.id !== id));
  }
  function mudarItem(id: string, campo: "texto" | "descricao", valor: string) {
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }
  function onDragStartItem(index: number) {
    indiceArrastado.current = index;
  }
  function onDragOverItem(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (indiceArrastado.current === null || indiceArrastado.current === index) return;
    setItens((atual) => {
      const novo = [...atual];
      const [movido] = novo.splice(indiceArrastado.current!, 1);
      novo.splice(index, 0, movido);
      indiceArrastado.current = index;
      return novo;
    });
  }

  async function salvar() {
    setErro(null);
    if (!nome.trim()) {
      setErro("Escreve um nome pra rotina.");
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
    const itensValidos = itens.filter((i) => i.texto.trim());
    if (itensValidos.length === 0) {
      setErro("Adiciona pelo menos 1 item no checklist.");
      return;
    }
    if (cargosSelecionados.size === 0 && funcionariosSelecionados.size === 0) {
      setErro("Escolhe pelo menos um cargo ou uma pessoa responsável.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const dadosRotina = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      frequencia,
      dias_semana: frequencia === "semanal" ? Array.from(diasSemana) : null,
      dia_mes: frequencia === "mensal" ? Number(diaMes) : null,
    };

    let idRotina = rotinaId;
    if (idRotina) {
      await supabase.from("rotinas").update(dadosRotina).eq("id", idRotina);
      // Estratégia simples: substitui tudo (itens e responsáveis) em vez
      // de tentar calcular a diferença — mais fácil de manter certo.
      await supabase.from("rotina_itens").delete().eq("rotina_id", idRotina);
      await supabase.from("rotina_responsaveis_cargo").delete().eq("rotina_id", idRotina);
      await supabase.from("rotina_responsaveis_funcionario").delete().eq("rotina_id", idRotina);
    } else {
      const { data: nova, error } = await supabase.from("rotinas").insert(dadosRotina).select("id").single();
      if (error || !nova) {
        setErro("Erro ao criar a rotina: " + (error?.message ?? ""));
        setSalvando(false);
        return;
      }
      idRotina = nova.id;
    }

    await supabase.from("rotina_itens").insert(
      itensValidos.map((i, idx) => ({ rotina_id: idRotina, texto: i.texto.trim(), descricao: i.descricao.trim() || null, ordem: idx }))
    );
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
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-start justify-center p-4 overflow-y-auto anim-entrada" onClick={onClose}>
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl mt-10 mb-10 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ink">{rotinaId ? "Editar rotina" : "Nova rotina"}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-ink/40 hover:bg-surface hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" placeholder="Ex: Abertura da loja" />
          </label>

          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Descrição (opcional)</span>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" placeholder="Detalhe curto sobre essa rotina" />
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
              <input
                type="number"
                min={1}
                max={31}
                value={diaMes}
                onChange={(e) => setDiaMes(e.target.value)}
                className="input"
                placeholder="Ex: 5"
              />
              <span className="block text-xs text-ink/40 mt-1">Se cair num sábado ou domingo, passa pra sexta-feira anterior automaticamente.</span>
            </label>
          )}

          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Checklist</span>
            <div className="space-y-1.5">
              {itens.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStartItem(index)}
                  onDragOver={(e) => onDragOverItem(e, index)}
                  className="flex items-start gap-2 rounded-xl bg-surface p-2"
                >
                  <span className="cursor-grab active:cursor-grabbing text-ink/30 mt-2 shrink-0">
                    <GripVertical size={14} />
                  </span>
                  <div className="flex-1 space-y-1">
                    <input
                      value={item.texto}
                      onChange={(e) => mudarItem(item.id, "texto", e.target.value)}
                      className="input py-1.5 text-sm bg-white"
                      placeholder="Nome do item..."
                    />
                    <input
                      value={item.descricao}
                      onChange={(e) => mudarItem(item.id, "descricao", e.target.value)}
                      className="input py-1 text-xs bg-white"
                      placeholder="Instrução opcional..."
                    />
                  </div>
                  <button
                    onClick={() => removerItem(item.id)}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-ink/30 hover:text-red-600 hover:bg-red-50 mt-1 shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={adicionarItem}
              className="mt-2 text-xs font-semibold text-forest hover:text-ink flex items-center gap-1"
            >
              <Plus size={13} /> Adicionar item
            </button>
          </div>

          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">
              Cargos responsáveis <span className="normal-case font-normal text-ink/30">— todo mundo com esse cargo vê essa rotina</span>
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
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => alternarConjunto(funcionariosSelecionados, f.id, setFuncionariosSelecionados)}
                    className="relative"
                    title={f.nome}
                  >
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
              {salvando ? "Salvando..." : "Salvar rotina"}
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

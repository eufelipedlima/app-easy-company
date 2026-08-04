"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { corDoStatus } from "@/lib/status-conteudo";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

interface StatusItem {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface Opcao {
  id: string;
  nome: string;
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  responsavel_id: string | null;
  status_id: string;
  prioridade: "baixa" | "media" | "alta" | null;
  prazo: string | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  funcionarios: { papeis: { pessoas: { nome: string } | null } | null } | null;
}

interface CamposVisiveisTarefa {
  cliente: boolean;
  responsavel: boolean;
  indicadores: boolean;
}

const CAMPOS_PADRAO: CamposVisiveisTarefa = { cliente: true, responsavel: true, indicadores: true };

function carregarCamposVisiveis(): CamposVisiveisTarefa {
  if (typeof window === "undefined") return CAMPOS_PADRAO;
  try {
    const salvo = localStorage.getItem("tarefas-campos-visiveis");
    return salvo ? { ...CAMPOS_PADRAO, ...JSON.parse(salvo) } : CAMPOS_PADRAO;
  } catch {
    return CAMPOS_PADRAO;
  }
}

const PRIORIDADE_CONFIG: Record<string, { label: string; cor: string }> = {
  baixa: { label: "Baixa", cor: "bg-sky-100 text-sky-700" },
  media: { label: "Média", cor: "bg-amber-100 text-amber-700" },
  alta: { label: "Alta", cor: "bg-red-100 text-red-700" },
};

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
function AvatarMini({ nome }: { nome: string }) {
  return (
    <div className={`h-5 w-5 rounded-full ${corAvatar(nome)} text-white flex items-center justify-center text-[9px] font-bold shrink-0`} title={nome}>
      {iniciais(nome)}
    </div>
  );
}

function nomeCliente(t: Tarefa) {
  return t.clientes?.papeis?.pessoas?.nome ?? null;
}
function nomeResponsavel(t: Tarefa) {
  return t.funcionarios?.papeis?.pessoas?.nome ?? null;
}
function formatarPrazo(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function diasAtraso(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataPrazo = new Date(prazo + "T00:00:00");
  const diffDias = Math.floor((hoje.getTime() - dataPrazo.getTime()) / (1000 * 60 * 60 * 24));
  return diffDias > 0 ? diffDias : null;
}

export default function TarefasPage() {
  const router = useRouter();
  const [statusList, setStatusList] = useState<StatusItem[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [contagemSubtarefas, setContagemSubtarefas] = useState<Record<string, number>>({});
  const [contagemComentarios, setContagemComentarios] = useState<Record<string, number>>({});
  const [clienteFiltroId, setClienteFiltroId] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [camposVisiveis, setCamposVisiveis] = useState<CamposVisiveisTarefa>(CAMPOS_PADRAO);
  const [painelCamposAberto, setPainelCamposAberto] = useState(false);
  const [painelFiltroAberto, setPainelFiltroAberto] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Opcao[]>([]);
  const [visualizacao, setVisualizacao] = useState<"kanban" | "semana">("kanban");
  const [filtroStatusIds, setFiltroStatusIds] = useState<string[]>([]);
  const [filtroResponsavelId, setFiltroResponsavelId] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroSoAtrasadas, setFiltroSoAtrasadas] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCamposVisiveis(carregarCamposVisiveis());
  }, []);

  function alternarCampo(campo: keyof CamposVisiveisTarefa) {
    setCamposVisiveis((atual) => {
      const novo = { ...atual, [campo]: !atual[campo] };
      localStorage.setItem("tarefas-campos-visiveis", JSON.stringify(novo));
      return novo;
    });
  }

  function alternarFiltroStatus(statusId: string) {
    setFiltroStatusIds((atual) => (atual.includes(statusId) ? atual.filter((x) => x !== statusId) : [...atual, statusId]));
  }

  const filtrosAtivos =
    filtroStatusIds.length > 0 || !!filtroResponsavelId || !!filtroPrioridade || filtroSoAtrasadas;

  function limparFiltros() {
    setFiltroStatusIds([]);
    setFiltroResponsavelId("");
    setFiltroPrioridade("");
    setFiltroSoAtrasadas(false);
  }

  const tarefasFiltradas = tarefas.filter((t) => {
    if (filtroStatusIds.length > 0 && !filtroStatusIds.includes(t.status_id)) return false;
    if (filtroResponsavelId && t.responsavel_id !== filtroResponsavelId) return false;
    if (filtroPrioridade && t.prioridade !== filtroPrioridade) return false;
    if (filtroSoAtrasadas && !(t.prazo && new Date(t.prazo + "T00:00:00") < new Date(new Date().toDateString()))) return false;
    return true;
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const carregarStatus = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("status_conteudo").select("id, nome, cor, ordem").order("ordem");
    setStatusList(data ?? []);
  }, []);

  const carregarClientes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )");
    const lista = ((data ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
      .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setClientes(lista);
  }, []);

  const carregarFuncionarios = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("funcionarios").select("id, papeis ( pessoas ( nome ) )");
    const lista = ((data ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
      .map((f) => ({ id: f.id, nome: f.papeis?.pessoas?.nome ?? "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setFuncionarios(lista);
  }, []);

  const carregarTarefas = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("tarefas")
      .select(
        `id, titulo, descricao, cliente_id, responsavel_id, status_id, prioridade, prazo,
         clientes ( papeis ( pessoas ( nome ) ) ),
         funcionarios ( papeis ( pessoas ( nome ) ) )`
      )
      .is("tarefa_pai_id", null)
      .order("created_at", { ascending: false });
    if (clienteFiltroId === "internas") query = query.is("cliente_id", null);
    else if (clienteFiltroId) query = query.eq("cliente_id", clienteFiltroId);
    const { data, error } = await query;
    if (error) console.error("Erro ao carregar tarefas:", error);
    const lista = (data as unknown as Tarefa[]) ?? [];
    setTarefas(lista);
    setLoading(false);

    const ids = lista.map((t) => t.id);
    if (ids.length > 0) {
      const [{ data: filhas }, { data: comentarios }] = await Promise.all([
        supabase.from("tarefas").select("tarefa_pai_id").in("tarefa_pai_id", ids),
        supabase.from("tarefas_comentarios").select("tarefa_id").in("tarefa_id", ids),
      ]);
      const contFilhas: Record<string, number> = {};
      for (const f of filhas ?? []) {
        if (f.tarefa_pai_id) contFilhas[f.tarefa_pai_id] = (contFilhas[f.tarefa_pai_id] ?? 0) + 1;
      }
      setContagemSubtarefas(contFilhas);
      const contComentarios: Record<string, number> = {};
      for (const c of comentarios ?? []) {
        contComentarios[c.tarefa_id] = (contComentarios[c.tarefa_id] ?? 0) + 1;
      }
      setContagemComentarios(contComentarios);
    } else {
      setContagemSubtarefas({});
      setContagemComentarios({});
    }
  }, [clienteFiltroId]);

  useEffect(() => {
    carregarStatus();
    carregarClientes();
    carregarFuncionarios();
  }, [carregarStatus, carregarClientes, carregarFuncionarios]);

  useEffect(() => {
    carregarTarefas();
  }, [carregarTarefas]);

  async function moverTarefaStatus(tarefaId: string, novoStatusId: string) {
    setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, status_id: novoStatusId } : t)));
    const supabase = createClient();
    await supabase.from("tarefas").update({ status_id: novoStatusId }).eq("id", tarefaId);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Tarefas e Projetos</h1>
          <p className="text-sm text-ink/60">Demandas da equipe, por cliente ou internas.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => setPainelFiltroAberto((v) => !v)}
              className={`rounded-full h-10 px-4 flex items-center gap-1.5 border-2 text-sm font-semibold transition-colors ${
                filtrosAtivos ? "border-forest text-forest bg-mint" : "border-black/10 text-ink/50 hover:text-ink hover:bg-surface"
              }`}
            >
              🔍 Filtro
            </button>
            {painelFiltroAberto && (
              <div
                className="absolute z-20 right-0 mt-1 w-72 rounded-2xl bg-white border border-black/10 shadow-lg p-4 space-y-4"
                onMouseLeave={() => setPainelFiltroAberto(false)}
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {statusList.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => alternarFiltroStatus(s.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors ${
                          filtroStatusIds.includes(s.id) ? corDoStatus(s.cor).cor + " border-transparent" : "border-black/10 text-ink/50"
                        }`}
                      >
                        {s.nome}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Responsável</span>
                  <select value={filtroResponsavelId} onChange={(e) => setFiltroResponsavelId(e.target.value)} className="input py-1.5 text-sm">
                    <option value="">Todos</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wide text-ink/40 mb-1">Prioridade</span>
                  <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)} className="input py-1.5 text-sm">
                    <option value="">Todas</option>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filtroSoAtrasadas}
                    onChange={(e) => setFiltroSoAtrasadas(e.target.checked)}
                    className="h-4 w-4 rounded accent-red-600"
                  />
                  Só atrasadas
                </label>
                {filtrosAtivos && (
                  <button onClick={limparFiltros} className="text-xs font-semibold text-ink/50 hover:text-red-600">
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="relative">
          <button
            onClick={() => setPainelCamposAberto((v) => !v)}
            className="rounded-full h-10 w-10 flex items-center justify-center border-2 border-black/10 text-ink/50 hover:text-ink hover:bg-surface transition-colors"
            title="Escolher quais informações aparecem nos cards"
          >
            ⚙
          </button>
          {painelCamposAberto && (
            <div
              className="absolute z-20 right-0 mt-1 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-3"
              onMouseLeave={() => setPainelCamposAberto(false)}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2 px-1">Campos visíveis</p>
              {(
                [
                  ["cliente", "Cliente / Interna"],
                  ["responsavel", "Responsável"],
                  ["indicadores", "Descrição, comentários e subtarefas"],
                ] as [keyof CamposVisiveisTarefa, string][]
              ).map(([campo, label]) => (
                <label key={campo} className="flex items-center gap-2 px-1 py-1.5 text-sm text-ink cursor-pointer">
                  <input type="checkbox" checked={camposVisiveis[campo]} onChange={() => alternarCampo(campo)} className="h-4 w-4 rounded accent-forest" />
                  {label}
                </label>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <select value={clienteFiltroId} onChange={(e) => setClienteFiltroId(e.target.value)} className="input py-2 !w-auto">
            <option value="">Todos os clientes</option>
            <option value="internas">Internas (sem cliente)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
            <button
              onClick={() => setVisualizacao("kanban")}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                visualizacao === "kanban" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setVisualizacao("semana")}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                visualizacao === "semana" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Semana
            </button>
          </div>
        </div>
        <button
          onClick={() => setNovaAberta(true)}
          className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors"
        >
          + Nova tarefa
        </button>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-4">
        {loading ? (
          <p className="text-sm text-ink/50">Carregando...</p>
        ) : visualizacao === "kanban" ? (
          <TarefasBoard
            statusList={statusList}
            tarefas={tarefasFiltradas}
            contagemSubtarefas={contagemSubtarefas}
            contagemComentarios={contagemComentarios}
            camposVisiveis={camposVisiveis}
            onMoverTarefa={moverTarefaStatus}
            onAbrirTarefa={(t) => router.push(`/tarefas/${t.id}`)}
          />
        ) : (
          <TarefasSemana
            tarefas={tarefasFiltradas}
            contagemSubtarefas={contagemSubtarefas}
            contagemComentarios={contagemComentarios}
            camposVisiveis={camposVisiveis}
            onAbrirTarefa={(t) => router.push(`/tarefas/${t.id}`)}
          />
        )}
      </div>

      {novaAberta && (
        <NovaTarefaModal
          clientes={clientes}
          clienteFixoId={clienteFiltroId && clienteFiltroId !== "internas" ? clienteFiltroId : null}
          statusPadraoId={statusList[0]?.id ?? ""}
          onClose={() => setNovaAberta(false)}
          onCriada={(id) => router.push(`/tarefas/${id}`)}
        />
      )}
    </main>
  );
}

function TarefasBoard({
  statusList,
  tarefas,
  contagemSubtarefas,
  contagemComentarios,
  camposVisiveis,
  onMoverTarefa,
  onAbrirTarefa,
}: {
  statusList: StatusItem[];
  tarefas: Tarefa[];
  contagemSubtarefas: Record<string, number>;
  contagemComentarios: Record<string, number>;
  camposVisiveis: CamposVisiveisTarefa;
  onMoverTarefa: (tarefaId: string, novoStatusId: string) => void;
  onAbrirTarefa: (t: Tarefa) => void;
}) {
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const tarefaAtiva = tarefas.find((t) => t.id === ativoId) ?? null;

  function handleDragStart(e: DragStartEvent) {
    setAtivoId(e.active.id as string);
  }
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setAtivoId(null);
    if (over && active.data.current?.statusAtual !== over.id) {
      onMoverTarefa(active.id as string, over.id as string);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setAtivoId(null)}>
      <div className="flex gap-4 min-w-max items-start">
        {statusList.map((coluna) => (
          <TarefasColuna
            key={coluna.id}
            coluna={coluna}
            cards={tarefas.filter((t) => t.status_id === coluna.id)}
            contagemSubtarefas={contagemSubtarefas}
            contagemComentarios={contagemComentarios}
            camposVisiveis={camposVisiveis}
            onAbrirTarefa={onAbrirTarefa}
          />
        ))}
      </div>
      <DragOverlay>
        {tarefaAtiva && (
          <TarefaCardConteudo
            tarefa={tarefaAtiva}
            qtdSubtarefas={contagemSubtarefas[tarefaAtiva.id] ?? 0}
            qtdComentarios={contagemComentarios[tarefaAtiva.id] ?? 0}
            camposVisiveis={camposVisiveis}
            arrastando
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function TarefasColuna({
  coluna,
  cards,
  contagemSubtarefas,
  contagemComentarios,
  camposVisiveis,
  onAbrirTarefa,
}: {
  coluna: StatusItem;
  cards: Tarefa[];
  contagemSubtarefas: Record<string, number>;
  contagemComentarios: Record<string, number>;
  camposVisiveis: CamposVisiveisTarefa;
  onAbrirTarefa: (t: Tarefa) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const cor = corDoStatus(coluna.cor);
  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-3xl border-2 p-3 min-h-[60vh] transition-all duration-150 ${cor.colBg} ${
        isOver ? `${cor.colBorder} scale-[1.02] shadow-lg` : "border-transparent"
      }`}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cor.dot}`} />
        <p className="text-sm font-bold text-ink truncate">{coluna.nome}</p>
        <span className={`ml-auto text-xs font-bold rounded-full px-2 py-0.5 shrink-0 ${cor.cor}`}>{cards.length}</span>
      </div>
      <div className="space-y-2 min-h-[80px]">
        {cards.map((t) => (
          <TarefaCardArrastavel
            key={t.id}
            tarefa={t}
            statusAtual={coluna.id}
            qtdSubtarefas={contagemSubtarefas[t.id] ?? 0}
            qtdComentarios={contagemComentarios[t.id] ?? 0}
            camposVisiveis={camposVisiveis}
            onAbrirTarefa={onAbrirTarefa}
          />
        ))}
      </div>
    </div>
  );
}

function TarefaCardArrastavel({
  tarefa,
  statusAtual,
  qtdSubtarefas,
  qtdComentarios,
  camposVisiveis,
  onAbrirTarefa,
}: {
  tarefa: Tarefa;
  statusAtual: string;
  qtdSubtarefas: number;
  qtdComentarios: number;
  camposVisiveis: CamposVisiveisTarefa;
  onAbrirTarefa: (t: Tarefa) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: tarefa.id, data: { statusAtual } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onAbrirTarefa(tarefa)}
      className={`touch-none transition-opacity ${isDragging ? "opacity-30" : "opacity-100"}`}
    >
      <TarefaCardConteudo tarefa={tarefa} qtdSubtarefas={qtdSubtarefas} qtdComentarios={qtdComentarios} camposVisiveis={camposVisiveis} />
    </div>
  );
}

function TarefaCardConteudo({
  tarefa,
  qtdSubtarefas = 0,
  qtdComentarios = 0,
  camposVisiveis,
  arrastando,
}: {
  tarefa: Tarefa;
  qtdSubtarefas?: number;
  qtdComentarios?: number;
  camposVisiveis: CamposVisiveisTarefa;
  arrastando?: boolean;
}) {
  const cliente = nomeCliente(tarefa);
  const responsavel = nomeResponsavel(tarefa);
  const temIndicador = camposVisiveis.indicadores && (tarefa.descricao || qtdComentarios > 0 || qtdSubtarefas > 0);

  return (
    <div
      className={`rounded-2xl bg-white p-3 cursor-grab active:cursor-grabbing transition-shadow ${arrastando ? "w-72" : "w-full"} ${
        arrastando ? "shadow-2xl rotate-2 border-2 border-forest/30" : "border border-black/5 shadow-sm hover:shadow-md"
      }`}
    >
      <p className="text-sm font-semibold text-ink truncate">{tarefa.titulo}</p>
      {camposVisiveis.cliente && <p className="text-xs text-ink/50 truncate mt-0.5">{cliente ?? "Interna"}</p>}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {tarefa.prioridade && (
          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${PRIORIDADE_CONFIG[tarefa.prioridade].cor}`}>
            {PRIORIDADE_CONFIG[tarefa.prioridade].label}
          </span>
        )}
        {tarefa.prazo &&
          (() => {
            const atraso = diasAtraso(tarefa.prazo);
            return (
              <span className={`text-[10px] ${atraso ? "text-red-600 font-bold" : "text-ink/40"}`}>
                📅 {formatarPrazo(tarefa.prazo)}
                {atraso && ` · ${atraso}d atrasado`}
              </span>
            );
          })()}
      </div>

      {(temIndicador || (camposVisiveis.responsavel && responsavel)) && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
          <div className="flex items-center gap-2 text-ink/40">
            {temIndicador && (
              <>
                {tarefa.descricao && <span title="Tem descrição">☰</span>}
                {qtdComentarios > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px]" title="Comentários">
                    💬 {qtdComentarios}
                  </span>
                )}
                {qtdSubtarefas > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px]" title="Subtarefas">
                    🔗 {qtdSubtarefas}
                  </span>
                )}
              </>
            )}
          </div>
          {camposVisiveis.responsavel && responsavel && <AvatarMini nome={responsavel} />}
        </div>
      )}
    </div>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toISODateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TarefasSemana({
  tarefas,
  contagemSubtarefas,
  contagemComentarios,
  camposVisiveis,
  onAbrirTarefa,
}: {
  tarefas: Tarefa[];
  contagemSubtarefas: Record<string, number>;
  contagemComentarios: Record<string, number>;
  camposVisiveis: CamposVisiveisTarefa;
  onAbrirTarefa: (t: Tarefa) => void;
}) {
  const hoje = new Date();
  const [inicioSemana, setInicioSemana] = useState(() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });

  const semPrazo = tarefas.filter((t) => !t.prazo);
  const hojeISO = toISODateLocal(hoje);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => {
            const d = new Date(inicioSemana);
            d.setDate(d.getDate() - 7);
            setInicioSemana(d);
          }}
          className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-surface text-ink/50"
        >
          ←
        </button>
        <button
          onClick={() => {
            const d = new Date(hoje);
            d.setDate(d.getDate() - d.getDay());
            d.setHours(0, 0, 0, 0);
            setInicioSemana(d);
          }}
          className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-semibold hover:bg-surface"
        >
          Esta semana
        </button>
        <button
          onClick={() => {
            const d = new Date(inicioSemana);
            d.setDate(d.getDate() + 7);
            setInicioSemana(d);
          }}
          className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-surface text-ink/50"
        >
          →
        </button>
        <h2 className="text-lg font-bold text-ink ml-2">
          {dias[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – {dias[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </h2>
      </div>

      {semPrazo.length > 0 && (
        <details className="mb-4 rounded-2xl bg-surface p-3">
          <summary className="text-sm font-semibold text-ink/60 cursor-pointer">Sem prazo definido ({semPrazo.length})</summary>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {semPrazo.map((t) => (
              <div key={t.id} onClick={() => onAbrirTarefa(t)} className="cursor-pointer">
                <TarefaCardConteudo
                  tarefa={t}
                  qtdSubtarefas={contagemSubtarefas[t.id] ?? 0}
                  qtdComentarios={contagemComentarios[t.id] ?? 0}
                  camposVisiveis={camposVisiveis}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex gap-3 min-w-max">
        {dias.map((dia) => {
          const iso = toISODateLocal(dia);
          const tarefasDoDia = tarefas.filter((t) => t.prazo === iso);
          return (
            <div key={iso} className={`w-64 shrink-0 rounded-3xl p-3 min-h-[50vh] ${iso === hojeISO ? "bg-mint/40" : "bg-surface"}`}>
              <div className="mb-3 px-1">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/50">{DIAS_SEMANA[dia.getDay()]}</p>
                <p className={`text-lg font-extrabold ${iso === hojeISO ? "text-forest" : "text-ink"}`}>{dia.getDate()}</p>
              </div>
              <div className="space-y-2">
                {tarefasDoDia.map((t) => (
                  <div key={t.id} onClick={() => onAbrirTarefa(t)} className="cursor-pointer">
                    <TarefaCardConteudo
                      tarefa={t}
                      qtdSubtarefas={contagemSubtarefas[t.id] ?? 0}
                      qtdComentarios={contagemComentarios[t.id] ?? 0}
                      camposVisiveis={camposVisiveis}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BuscaCliente({
  clientes,
  valor,
  onSelecionar,
}: {
  clientes: Opcao[];
  valor: Opcao | null;
  onSelecionar: (c: Opcao | null) => void;
}) {
  const [busca, setBusca] = useState(valor?.nome ?? "");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const sugestoes = clientes.filter((c) => normalizar(c.nome).includes(normalizar(busca)));

  return (
    <div className="relative">
      <input
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          onSelecionar(null);
          setMostrarSugestoes(true);
        }}
        onFocus={() => setMostrarSugestoes(true)}
        className="input"
        placeholder="Digite pra buscar (deixe em branco = interna)..."
      />
      {mostrarSugestoes && busca && !valor && (
        <div className="absolute z-20 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
          {sugestoes.length > 0 ? (
            sugestoes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelecionar(c);
                  setBusca(c.nome);
                  setMostrarSugestoes(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
              >
                {c.nome}
              </button>
            ))
          ) : (
            <p className="px-4 py-2.5 text-sm text-ink/40">Nenhum cliente encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

function NovaTarefaModal({
  clientes,
  clienteFixoId,
  statusPadraoId,
  onClose,
  onCriada,
}: {
  clientes: Opcao[];
  clienteFixoId: string | null;
  statusPadraoId: string;
  onClose: () => void;
  onCriada: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Opcao | null>(
    clienteFixoId ? clientes.find((c) => c.id === clienteFixoId) ?? null : null
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro("Dê um título pra tarefa.");
      return;
    }
    setSaving(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tarefas")
      .insert({ titulo: titulo.trim(), cliente_id: clienteSelecionado?.id ?? null, status_id: statusPadraoId })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      setErro(error?.message ?? "Erro ao criar tarefa.");
      return;
    }
    onCriada(data.id);
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Nova tarefa</h2>
        <form onSubmit={criar} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Título *</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" autoFocus required />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Cliente</span>
            <BuscaCliente clientes={clientes} valor={clienteSelecionado} onSelecionar={setClienteSelecionado} />
          </label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {saving ? "Criando..." : "Criar e abrir"}
            </button>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

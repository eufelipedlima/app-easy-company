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
  cliente_id: string | null;
  responsavel_id: string | null;
  status_id: string;
  prioridade: "baixa" | "media" | "alta" | null;
  prazo: string | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  funcionarios: { papeis: { pessoas: { nome: string } | null } | null } | null;
}

const PRIORIDADE_CONFIG: Record<string, { label: string; cor: string }> = {
  baixa: { label: "Baixa", cor: "bg-sky-100 text-sky-700" },
  media: { label: "Média", cor: "bg-amber-100 text-amber-700" },
  alta: { label: "Alta", cor: "bg-red-100 text-red-700" },
};

function nomeCliente(t: Tarefa) {
  return t.clientes?.papeis?.pessoas?.nome ?? null;
}
function nomeResponsavel(t: Tarefa) {
  return t.funcionarios?.papeis?.pessoas?.nome ?? null;
}
function formatarPrazo(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function TarefasPage() {
  const router = useRouter();
  const [statusList, setStatusList] = useState<StatusItem[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [clienteFiltroId, setClienteFiltroId] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const carregarTarefas = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("tarefas")
      .select(
        `id, titulo, cliente_id, responsavel_id, status_id, prioridade, prazo,
         clientes ( papeis ( pessoas ( nome ) ) ),
         funcionarios ( papeis ( pessoas ( nome ) ) )`
      )
      .order("created_at", { ascending: false });
    if (clienteFiltroId === "internas") query = query.is("cliente_id", null);
    else if (clienteFiltroId) query = query.eq("cliente_id", clienteFiltroId);
    const { data, error } = await query;
    if (error) console.error("Erro ao carregar tarefas:", error);
    setTarefas((data as unknown as Tarefa[]) ?? []);
    setLoading(false);
  }, [clienteFiltroId]);

  useEffect(() => {
    carregarStatus();
    carregarClientes();
  }, [carregarStatus, carregarClientes]);

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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <select value={clienteFiltroId} onChange={(e) => setClienteFiltroId(e.target.value)} className="input py-2 !w-auto">
          <option value="">Todos os clientes</option>
          <option value="internas">Internas (sem cliente)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
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
        ) : (
          <TarefasBoard
            statusList={statusList}
            tarefas={tarefas}
            onMoverTarefa={moverTarefaStatus}
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
  onMoverTarefa,
  onAbrirTarefa,
}: {
  statusList: StatusItem[];
  tarefas: Tarefa[];
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
            onAbrirTarefa={onAbrirTarefa}
          />
        ))}
      </div>
      <DragOverlay>{tarefaAtiva && <TarefaCardConteudo tarefa={tarefaAtiva} arrastando />}</DragOverlay>
    </DndContext>
  );
}

function TarefasColuna({
  coluna,
  cards,
  onAbrirTarefa,
}: {
  coluna: StatusItem;
  cards: Tarefa[];
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
          <TarefaCardArrastavel key={t.id} tarefa={t} statusAtual={coluna.id} onAbrirTarefa={onAbrirTarefa} />
        ))}
      </div>
    </div>
  );
}

function TarefaCardArrastavel({
  tarefa,
  statusAtual,
  onAbrirTarefa,
}: {
  tarefa: Tarefa;
  statusAtual: string;
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
      <TarefaCardConteudo tarefa={tarefa} />
    </div>
  );
}

function TarefaCardConteudo({ tarefa, arrastando }: { tarefa: Tarefa; arrastando?: boolean }) {
  const cliente = nomeCliente(tarefa);
  const responsavel = nomeResponsavel(tarefa);
  return (
    <div
      className={`rounded-2xl bg-white p-3 cursor-grab active:cursor-grabbing transition-shadow w-72 ${
        arrastando ? "shadow-2xl rotate-2 border-2 border-forest/30" : "border border-black/5 shadow-sm hover:shadow-md"
      }`}
    >
      <p className="text-sm font-semibold text-ink truncate">{tarefa.titulo}</p>
      <p className="text-xs text-ink/50 truncate mt-0.5">{cliente ?? "Interna"}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {tarefa.prioridade && (
          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${PRIORIDADE_CONFIG[tarefa.prioridade].cor}`}>
            {PRIORIDADE_CONFIG[tarefa.prioridade].label}
          </span>
        )}
        {tarefa.prazo && <span className="text-[10px] text-ink/40">📅 {formatarPrazo(tarefa.prazo)}</span>}
        {responsavel && <span className="text-[10px] text-ink/40 ml-auto">👤 {responsavel}</span>}
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

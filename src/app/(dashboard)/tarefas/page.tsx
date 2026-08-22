"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { IconeTarefa, IconeProjeto } from "@/components/icones-tarefa";
import { EsqueletoLinha } from "@/components/esqueleto";
import { corDoStatus } from "@/lib/status-conteudo";
import { BuscaCliente } from "@/components/busca-cliente";
import {
  useListaAgrupavel,
  BotaoExibirLista,
  CorpoListaAgrupavel,
  type ColunaLista,
  type OpcaoAgrupamento,
} from "@/components/lista-agrupavel";
import { Filter } from "lucide-react";
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

interface Responsavel {
  id: string;
  nome: string;
  fotoUrl: string | null;
  authUserId: string | null;
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  status_id: string;
  prioridade: "baixa" | "media" | "alta" | null;
  data_inicio: string | null;
  prazo: string | null;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
  eh_projeto: boolean;
}

interface CamposVisiveisTarefa {
  cliente: boolean;
  responsavel: boolean;
  indicadores: boolean;
  mostrarFinsDeSemana: boolean;
}

const CAMPOS_PADRAO: CamposVisiveisTarefa = { cliente: true, responsavel: true, indicadores: true, mostrarFinsDeSemana: true };

function carregarCamposVisiveis(): CamposVisiveisTarefa {
  if (typeof window === "undefined") return CAMPOS_PADRAO;
  try {
    const salvo = localStorage.getItem("tarefas-campos-visiveis");
    return salvo ? { ...CAMPOS_PADRAO, ...JSON.parse(salvo) } : CAMPOS_PADRAO;
  } catch {
    return CAMPOS_PADRAO;
  }
}

interface AcoesCard {
  statusList: StatusItem[];
  funcionariosComAcesso: Responsavel[];
  responsaveisPorTarefa: Record<string, Responsavel[]>;
  progressoProjetos: Record<string, { total: number; completos: number }>;
  onRenomear: (t: Tarefa) => void;
  onMover: (tarefaId: string, novoStatusId: string) => void;
  onDuplicar: (t: Tarefa) => void;
  onExcluir: (t: Tarefa) => void;
  onArquivar: (t: Tarefa) => void;
  onToggleResponsavel: (tarefaId: string, funcionarioId: string) => void;
  onCopiarLink: (t: Tarefa) => void;
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
function Avatar({ nome, fotoUrl, tamanho = 28 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={fotoUrl}
        alt={nome}
        className="rounded-full object-cover shrink-0 ring-2 ring-white"
        style={{ height: tamanho, width: tamanho }}
      />
    );
  }
  return (
    <div
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center font-bold shrink-0 ring-2 ring-white`}
      style={{ height: tamanho, width: tamanho, fontSize: Math.max(9, tamanho * 0.36) }}
    >
      {iniciais(nome)}
    </div>
  );
}
function AvatarStack({ pessoas, tamanho = 22 }: { pessoas: Responsavel[]; tamanho?: number }) {
  if (pessoas.length === 0) return null;
  const visiveis = pessoas.slice(0, 3);
  const resto = pessoas.length - visiveis.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visiveis.map((p) => (
        <Avatar key={p.id} nome={p.nome} fotoUrl={p.fotoUrl} tamanho={tamanho} />
      ))}
      {resto > 0 && (
        <div
          className="rounded-full bg-surface ring-2 ring-white text-ink/60 font-bold flex items-center justify-center shrink-0"
          style={{ height: tamanho, width: tamanho, fontSize: Math.max(8, tamanho * 0.32) }}
        >
          +{resto}
        </div>
      )}
    </div>
  );
}

function nomeCliente(t: Tarefa) {
  return t.clientes?.papeis?.pessoas?.nome ?? null;
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
  const [funcionariosComAcesso, setFuncionariosComAcesso] = useState<Responsavel[]>([]);
  const [meuFuncionarioId, setMeuFuncionarioId] = useState<string | null>(null);
  const [souAdmin, setSouAdmin] = useState(false);
  const [novoProjetoAberto, setNovoProjetoAberto] = useState(false);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [contagemSubtarefas, setContagemSubtarefas] = useState<Record<string, number>>({});
  const [contagemComentarios, setContagemComentarios] = useState<Record<string, number>>({});
  const [progressoProjetos, setProgressoProjetos] = useState<Record<string, { total: number; completos: number }>>({});
  const [responsaveisPorTarefa, setResponsaveisPorTarefa] = useState<Record<string, Responsavel[]>>({});
  const [clienteFiltroId, setClienteFiltroId] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"tudo" | "tarefas" | "projetos">("tudo");
  const [novaAberta, setNovaAberta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [camposVisiveis, setCamposVisiveis] = useState<CamposVisiveisTarefa>(CAMPOS_PADRAO);
  const [painelCamposAberto, setPainelCamposAberto] = useState(false);
  const [painelFiltroAberto, setPainelFiltroAberto] = useState(false);
  const [visualizacao, setVisualizacao] = useState<"kanban" | "lista" | "semana" | "mes">("kanban");
  const estadoListaTarefas = useListaAgrupavel("tarefas-geral", ["status", "responsavel", "vencimento", "cliente", "prioridade"]);
  const [filtroStatusIds, setFiltroStatusIds] = useState<string[]>([]);
  const [filtroResponsavelId, setFiltroResponsavelId] = useState<string | null>(null);
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroSoAtrasadas, setFiltroSoAtrasadas] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollWheelCleanupRef = useRef<(() => void) | null>(null);

  const anexarScrollKanban = useCallback((el: HTMLDivElement | null) => {
    scrollWheelCleanupRef.current?.();
    scrollWheelCleanupRef.current = null;
    scrollRef.current = el;
    if (!el) return;
    const container = el;
    function onWheel(e: WheelEvent) {
      const alvo = (e.target as HTMLElement).closest("[data-coluna-scroll]") as HTMLElement | null;
      if (alvo && alvo.scrollHeight > alvo.clientHeight) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    scrollWheelCleanupRef.current = () => el.removeEventListener("wheel", onWheel);
  }, []);

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

  function mudarFiltroResponsavel(id: string | null) {
    setFiltroResponsavelId(id);
    localStorage.setItem("tarefas-filtro-responsavel", id ?? "");
  }

  const filtrosAtivos = filtroStatusIds.length > 0 || !!filtroResponsavelId || !!filtroPrioridade || filtroSoAtrasadas || !!clienteFiltroId;

  function limparFiltros() {
    setFiltroStatusIds([]);
    mudarFiltroResponsavel(null);
    setFiltroPrioridade("");
    setFiltroSoAtrasadas(false);
    setClienteFiltroId("");
  }

  const tarefasFiltradas = tarefas.filter((t) => {
    if (filtroStatusIds.length > 0 && !filtroStatusIds.includes(t.status_id)) return false;
    if (filtroResponsavelId && !(responsaveisPorTarefa[t.id] ?? []).some((r) => r.id === filtroResponsavelId)) return false;
    if (filtroPrioridade && t.prioridade !== filtroPrioridade) return false;
    if (filtroSoAtrasadas && !(t.prazo && new Date(t.prazo + "T00:00:00") < new Date(new Date().toDateString()))) return false;
    if (filtroTipo === "tarefas" && t.eh_projeto) return false;
    if (filtroTipo === "projetos" && !t.eh_projeto) return false;
    return true;
  });

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

  const carregarFuncionariosComAcesso = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("funcionarios")
      .select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )")
      .not("auth_user_id", "is", null);
    const lista = ((data ?? []) as unknown as {
      id: string;
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
    }[])
      .map((f) => ({
        id: f.id,
        nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega",
        fotoUrl: f.papeis?.pessoas?.foto_url ?? null,
        authUserId: f.auth_user_id,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setFuncionariosComAcesso(lista);

    if (user) {
      const eu = lista.find((f) => f.authUserId === user.id);
      setMeuFuncionarioId(eu?.id ?? null);

      const { data: perfilData } = await supabase
        .from("funcionarios")
        .select("perfil_acesso_id, perfis_acesso ( nome )")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const nomePerfil = (perfilData as unknown as { perfis_acesso: { nome: string } | null } | null)?.perfis_acesso?.nome;
      setSouAdmin(nomePerfil === "Administrador");

      const salvo = localStorage.getItem("tarefas-filtro-responsavel");
      if (salvo === null) {
        // primeira visita — padrão é "eu"
        if (eu) {
          setFiltroResponsavelId(eu.id);
          localStorage.setItem("tarefas-filtro-responsavel", eu.id);
        }
      } else {
        setFiltroResponsavelId(salvo || null);
      }
    }
  }, []);

  const carregarTarefas = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("tarefas")
      .select(
        `id, titulo, descricao, cliente_id, status_id, prioridade, data_inicio, prazo, eh_projeto,
         clientes ( papeis ( pessoas ( nome ) ) )`
      )
      .is("tarefa_pai_id", null)
      .eq("arquivada", false)
      .eq("eh_modelo_projeto", false)
      .is("excluido_em", null)
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
      const [{ data: filhas }, { data: comentarios }, { data: responsaveisData }] = await Promise.all([
        supabase.from("tarefas").select("tarefa_pai_id").in("tarefa_pai_id", ids).is("excluido_em", null),
        supabase.from("tarefas_comentarios").select("tarefa_id").in("tarefa_id", ids),
        supabase
          .from("tarefas_responsaveis")
          .select("tarefa_id, funcionarios ( id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
          .in("tarefa_id", ids),
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

      const mapaResponsaveis: Record<string, Responsavel[]> = {};
      for (const r of (responsaveisData ?? []) as unknown as {
        tarefa_id: string;
        funcionarios: { id: string; auth_user_id: string | null; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null } | null;
      }[]) {
        if (!r.funcionarios) continue;
        const pessoa = r.funcionarios.papeis?.pessoas;
        const resp: Responsavel = {
          id: r.funcionarios.id,
          nome: pessoa?.apelido || pessoa?.nome || "Colega",
          fotoUrl: pessoa?.foto_url ?? null,
          authUserId: r.funcionarios.auth_user_id,
        };
        if (!mapaResponsaveis[r.tarefa_id]) mapaResponsaveis[r.tarefa_id] = [];
        mapaResponsaveis[r.tarefa_id].push(resp);
      }
      setResponsaveisPorTarefa(mapaResponsaveis);

      const idsProjetos = lista.filter((t) => t.eh_projeto).map((t) => t.id);
      if (idsProjetos.length > 0) {
        let todasDescendentes: { id: string; status_id: string; eh_pasta: boolean; tarefa_pai_id: string | null }[] = [];
        let nivelAtual = idsProjetos;
        for (let i = 0; i < 8 && nivelAtual.length > 0; i++) {
          const { data: nivel } = await supabase
            .from("tarefas")
            .select("id, status_id, eh_pasta, tarefa_pai_id")
            .in("tarefa_pai_id", nivelAtual)
            .is("excluido_em", null);
          if (!nivel || nivel.length === 0) break;
          todasDescendentes = [...todasDescendentes, ...nivel];
          nivelAtual = nivel.map((n) => n.id);
        }
        const mapaPaiDireto = new Map<string, string>();
        // acha, pra cada descendente, a qual projeto ele pertence subindo a árvore
        const mapaTudoPorId = new Map(todasDescendentes.map((d) => [d.id, d]));
        function projetoDe(itemId: string): string | null {
          let atual = mapaTudoPorId.get(itemId);
          let atualId = itemId;
          for (let i = 0; i < 10 && atual; i++) {
            if (idsProjetos.includes(atual.tarefa_pai_id ?? "")) return atual.tarefa_pai_id;
            atualId = atual.tarefa_pai_id ?? "";
            atual = mapaTudoPorId.get(atualId);
          }
          return null;
        }
        void mapaPaiDireto;
        const progresso: Record<string, { total: number; completos: number }> = {};
        for (const item of todasDescendentes) {
          if (item.eh_pasta) continue; // pasta é só divisória, não conta como item de trabalho
          const projId = idsProjetos.includes(item.tarefa_pai_id ?? "") ? item.tarefa_pai_id! : projetoDe(item.id);
          if (!projId) continue;
          if (!progresso[projId]) progresso[projId] = { total: 0, completos: 0 };
          progresso[projId].total++;
          const statusItem = statusList.find((s) => s.id === item.status_id);
          if (statusItem?.cor === "verde") progresso[projId].completos++;
        }
        setProgressoProjetos(progresso);
      } else {
        setProgressoProjetos({});
      }
    } else {
      setContagemSubtarefas({});
      setContagemComentarios({});
      setResponsaveisPorTarefa({});
    }
  }, [clienteFiltroId]);

  useEffect(() => {
    carregarStatus();
    carregarClientes();
    carregarFuncionariosComAcesso();
  }, [carregarStatus, carregarClientes, carregarFuncionariosComAcesso]);

  useEffect(() => {
    carregarTarefas();
  }, [carregarTarefas]);

  async function moverTarefaStatus(tarefaId: string, novoStatusId: string) {
    setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, status_id: novoStatusId } : t)));
    const supabase = createClient();
    await supabase.from("tarefas").update({ status_id: novoStatusId }).eq("id", tarefaId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nomeStatus = statusList.find((s) => s.id === novoStatusId)?.nome ?? "outro status";
    if (user) await supabase.from("tarefas_historico").insert({ tarefa_id: tarefaId, autor_id: user.id, descricao: `mudou o status para "${nomeStatus}"` });
  }

  async function renomearTarefa(t: Tarefa) {
    const novoTitulo = window.prompt("Novo título:", t.titulo);
    if (!novoTitulo || !novoTitulo.trim() || novoTitulo.trim() === t.titulo) return;
    const supabase = createClient();
    await supabase.from("tarefas").update({ titulo: novoTitulo.trim() }).eq("id", t.id);
    carregarTarefas();
  }

  async function duplicarTarefa(t: Tarefa) {
    const supabase = createClient();
    const { data: nova } = await supabase
      .from("tarefas")
      .insert({
        titulo: `${t.titulo} (cópia)`,
        descricao: t.descricao,
        cliente_id: t.cliente_id,
        status_id: t.status_id,
        prioridade: t.prioridade,
      })
      .select("id")
      .single();
    const responsaveisAtuais = responsaveisPorTarefa[t.id] ?? [];
    if (nova && responsaveisAtuais.length > 0) {
      await supabase
        .from("tarefas_responsaveis")
        .insert(responsaveisAtuais.map((r) => ({ tarefa_id: nova.id, funcionario_id: r.id })));
    }
    carregarTarefas();
  }

  async function excluirTarefaMenu(t: Tarefa) {
    if (!window.confirm(`Mover "${t.titulo}" (e as subtarefas dela) pra lixeira? Um administrador pode restaurar em até 30 dias.`)) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let idsParaExcluir = [t.id];
    let nivelAtual = [t.id];
    for (let i = 0; i < 8 && nivelAtual.length > 0; i++) {
      const { data } = await supabase.from("tarefas").select("id").in("tarefa_pai_id", nivelAtual);
      if (!data || data.length === 0) break;
      const novosIds = data.map((d) => d.id);
      idsParaExcluir = [...idsParaExcluir, ...novosIds];
      nivelAtual = novosIds;
    }
    await supabase
      .from("tarefas")
      .update({ excluido_em: new Date().toISOString(), excluido_por: user?.id ?? null })
      .in("id", idsParaExcluir);
    carregarTarefas();
  }

  async function arquivarTarefaMenu(t: Tarefa) {
    const supabase = createClient();
    await supabase.from("tarefas").update({ arquivada: true }).eq("id", t.id);
    carregarTarefas();
  }

  async function toggleResponsavelTarefa(tarefaId: string, funcionarioId: string) {
    const supabase = createClient();
    const jaTem = (responsaveisPorTarefa[tarefaId] ?? []).some((r) => r.id === funcionarioId);
    if (jaTem) {
      setResponsaveisPorTarefa((atual) => ({
        ...atual,
        [tarefaId]: (atual[tarefaId] ?? []).filter((r) => r.id !== funcionarioId),
      }));
      await supabase.from("tarefas_responsaveis").delete().eq("tarefa_id", tarefaId).eq("funcionario_id", funcionarioId);
    } else {
      const pessoa = funcionariosComAcesso.find((f) => f.id === funcionarioId);
      if (pessoa) {
        setResponsaveisPorTarefa((atual) => ({
          ...atual,
          [tarefaId]: [...(atual[tarefaId] ?? []), pessoa],
        }));
      }
      await supabase.from("tarefas_responsaveis").insert({ tarefa_id: tarefaId, funcionario_id: funcionarioId });
    }
  }

  function copiarLinkTarefa(t: Tarefa) {
    navigator.clipboard.writeText(`${window.location.origin}/tarefas/${t.id}`);
  }

  const acoesCard: AcoesCard = {
    statusList,
    funcionariosComAcesso,
    responsaveisPorTarefa,
    progressoProjetos,
    onRenomear: renomearTarefa,
    onMover: moverTarefaStatus,
    onDuplicar: duplicarTarefa,
    onExcluir: excluirTarefaMenu,
    onArquivar: arquivarTarefaMenu,
    onToggleResponsavel: toggleResponsavelTarefa,
    onCopiarLink: copiarLinkTarefa,
  };

  const colunasListaTarefas: ColunaLista<Tarefa>[] = [
    {
      chave: "nome",
      label: "Nome",
      larguraCss: "1fr",
      ehNome: true,
      render: (t) => (
        <span className="text-sm text-ink truncate flex items-center gap-1.5">
          {t.eh_projeto && <IconeProjeto tamanho={13} />}
          <span className="truncate">{t.titulo}</span>
          {t.descricao && <span className="text-ink/25 text-xs shrink-0">☰</span>}
        </span>
      ),
    },
    {
      chave: "status",
      label: "Status",
      larguraCss: "110px",
      render: (t) => {
        const s = statusList.find((s) => s.id === t.status_id);
        return <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 w-fit ${corDoStatus(s?.cor ?? "cinza").cor}`}>{s?.nome ?? "—"}</span>;
      },
    },
    {
      chave: "responsavel",
      label: "Responsável",
      larguraCss: "110px",
      render: (t) => <AvatarStack pessoas={responsaveisPorTarefa[t.id] ?? []} />,
    },
    {
      chave: "vencimento",
      label: "Vencimento",
      larguraCss: "100px",
      render: (t) => <span className="text-xs text-ink/40">{t.prazo ? formatarPrazo(t.prazo) : "—"}</span>,
    },
    {
      chave: "cliente",
      label: "Cliente",
      larguraCss: "140px",
      render: (t) => <span className="text-xs text-ink/50 truncate">{t.clientes?.papeis?.pessoas?.nome ?? "Interna"}</span>,
    },
    {
      chave: "prioridade",
      label: "Prioridade",
      larguraCss: "90px",
      render: (t) => (
        <span className="text-xs text-ink/40">
          {t.prioridade === "alta" ? "🔴 Alta" : t.prioridade === "media" ? "🟡 Média" : t.prioridade === "baixa" ? "🟢 Baixa" : "—"}
        </span>
      ),
    },
  ];

  const opcoesAgrupamentoTarefas: OpcaoAgrupamento<Tarefa>[] = [
    {
      chave: "status",
      label: "Status",
      grupoDe: (t) => {
        const s = statusList.find((s) => s.id === t.status_id);
        return { chave: t.status_id, label: s?.nome ?? "—", cor: corDoStatus(s?.cor ?? "cinza").cor };
      },
    },
    {
      chave: "cliente",
      label: "Cliente",
      grupoDe: (t) => ({ chave: t.cliente_id ?? "interna", label: t.clientes?.papeis?.pessoas?.nome ?? "Interna" }),
    },
    {
      chave: "responsavel",
      label: "Responsável",
      grupoDe: (t) => {
        const resp = responsaveisPorTarefa[t.id] ?? [];
        return resp.length > 0 ? { chave: resp[0].id, label: resp[0].nome } : { chave: "sem-responsavel", label: "Sem responsável" };
      },
    },
    {
      chave: "prioridade",
      label: "Prioridade",
      grupoDe: (t) => ({
        chave: t.prioridade ?? "nenhuma",
        label: t.prioridade === "alta" ? "🔴 Alta" : t.prioridade === "media" ? "🟡 Média" : t.prioridade === "baixa" ? "🟢 Baixa" : "Sem prioridade",
      }),
      ordemGrupos: (a, b) => {
        const ordem = { alta: 0, media: 1, baixa: 2, nenhuma: 3 };
        return (ordem[a as keyof typeof ordem] ?? 9) - (ordem[b as keyof typeof ordem] ?? 9);
      },
    },
    {
      chave: "vencimento",
      label: "Data de vencimento",
      grupoDe: (t) => ({ chave: t.prazo ?? "sem-data", label: t.prazo ? formatarPrazo(t.prazo) : "Sem data" }),
    },
  ];

  return (
    <main className="mx-auto max-w-[2000px] px-6 py-6">
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
              <Filter size={15} /> Filtro
            </button>
            {painelFiltroAberto && (
              <div
                className="absolute z-20 right-0 mt-1 w-72 rounded-2xl bg-white border border-black/10 shadow-lg p-4 space-y-4"
                onMouseLeave={() => setPainelFiltroAberto(false)}
              >
                <FiltroCliente clientes={clientes} valorId={clienteFiltroId} onMudar={setClienteFiltroId} />
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
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Responsável</p>
                  <div className="flex flex-wrap gap-2">
                    {funcionariosComAcesso.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => mudarFiltroResponsavel(filtroResponsavelId === f.id ? null : f.id)}
                        className="relative"
                        title={f.nome}
                      >
                        <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={30} />
                        {filtroResponsavelId === f.id && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-forest text-white text-[8px] flex items-center justify-center ring-2 ring-white">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
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

          {visualizacao === "lista" && (
            <BotaoExibirLista estado={estadoListaTarefas} colunas={colunasListaTarefas} opcoesAgrupamento={opcoesAgrupamentoTarefas} />
          )}

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
                    ["mostrarFinsDeSemana", "Mostrar sábado e domingo (visão Semana)"],
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
              onClick={() => setVisualizacao("lista")}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                visualizacao === "lista" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setVisualizacao("semana")}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                visualizacao === "semana" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setVisualizacao("mes")}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                visualizacao === "mes" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Mês
            </button>
          </div>
          {filtroResponsavelId === meuFuncionarioId && meuFuncionarioId && (
            <span className="text-xs text-ink/40">Mostrando suas tarefas</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
            <button
              onClick={() => setFiltroTipo("tudo")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                filtroTipo === "tudo" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              Tudo
            </button>
            <button
              onClick={() => setFiltroTipo("tarefas")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                filtroTipo === "tarefas" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              ✔️ Tarefas
            </button>
            <button
              onClick={() => setFiltroTipo("projetos")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                filtroTipo === "projetos" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              📋 Projetos
            </button>
          </div>
          {souAdmin && (
            <button
              onClick={() => setNovoProjetoAberto(true)}
              className="rounded-full border-2 border-ink/15 text-ink px-5 py-2 text-sm font-semibold hover:bg-surface transition-colors"
            >
              + Novo projeto
            </button>
          )}
          <button
            onClick={() => setNovaAberta(true)}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Nova tarefa
          </button>
        </div>
      </div>

      <div ref={anexarScrollKanban} className="overflow-x-auto pb-4 min-h-[65vh]">
        {loading ? (
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-64 shrink-0 rounded-3xl bg-surface p-3 space-y-2">
                <EsqueletoLinha className="h-4 w-24 mb-2" />
                <EsqueletoLinha className="h-16 w-full rounded-2xl" />
                <EsqueletoLinha className="h-16 w-full rounded-2xl" />
                <EsqueletoLinha className="h-16 w-4/5 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : visualizacao === "kanban" ? (
          <TarefasBoard
            statusList={statusList}
            tarefas={tarefasFiltradas}
            contagemSubtarefas={contagemSubtarefas}
            contagemComentarios={contagemComentarios}
            camposVisiveis={camposVisiveis}
            acoes={acoesCard}
            onMoverTarefa={moverTarefaStatus}
            onAbrirTarefa={(t) => router.push(`/tarefas/${t.id}`)}
          />
        ) : visualizacao === "lista" ? (
          <CorpoListaAgrupavel<Tarefa>
            itens={tarefasFiltradas}
            chaveId={(t) => t.id}
            estado={estadoListaTarefas}
            onAbrir={(t) => router.push(`/tarefas/${t.id}`)}
            colunas={colunasListaTarefas}
            opcoesAgrupamento={opcoesAgrupamentoTarefas}
          />
        ) : visualizacao === "semana" ? (
          <TarefasSemana
            tarefas={tarefasFiltradas}
            contagemSubtarefas={contagemSubtarefas}
            contagemComentarios={contagemComentarios}
            camposVisiveis={camposVisiveis}
            acoes={acoesCard}
            onAbrirTarefa={(t) => router.push(`/tarefas/${t.id}`)}
          />
        ) : (
          <TarefasMes
            tarefas={tarefasFiltradas}
            contagemSubtarefas={contagemSubtarefas}
            contagemComentarios={contagemComentarios}
            camposVisiveis={camposVisiveis}
            acoes={acoesCard}
            statusList={statusList}
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
      {novoProjetoAberto && (
        <NovoProjetoModal
          clientes={clientes}
          statusPadraoId={statusList[0]?.id ?? ""}
          onClose={() => setNovoProjetoAberto(false)}
          onCriado={(id) => router.push(`/tarefas/${id}`)}
        />
      )}
    </main>
  );
}

async function registrarCriacaoTarefa(tarefaId: string, rotulo: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("tarefas_historico").insert({ tarefa_id: tarefaId, autor_id: user.id, descricao: `criou ${rotulo}` });
}

function TarefasBoard({
  statusList,
  tarefas,
  contagemSubtarefas,
  contagemComentarios,
  camposVisiveis,
  acoes,
  onMoverTarefa,
  onAbrirTarefa,
}: {
  statusList: StatusItem[];
  tarefas: Tarefa[];
  contagemSubtarefas: Record<string, number>;
  contagemComentarios: Record<string, number>;
  camposVisiveis: CamposVisiveisTarefa;
  acoes: AcoesCard;
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
            acoes={acoes}
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
            responsaveis={acoes.responsaveisPorTarefa[tarefaAtiva.id] ?? []}
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
  acoes,
  onAbrirTarefa,
}: {
  coluna: StatusItem;
  cards: Tarefa[];
  contagemSubtarefas: Record<string, number>;
  contagemComentarios: Record<string, number>;
  camposVisiveis: CamposVisiveisTarefa;
  acoes: AcoesCard;
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
      <div data-coluna-scroll className="space-y-2 min-h-[80px] max-h-[75vh] overflow-y-auto pr-1">
        {cards.map((t) => (
          <TarefaCardArrastavel
            key={t.id}
            tarefa={t}
            statusAtual={coluna.id}
            qtdSubtarefas={contagemSubtarefas[t.id] ?? 0}
            qtdComentarios={contagemComentarios[t.id] ?? 0}
            camposVisiveis={camposVisiveis}
            acoes={acoes}
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
  acoes,
  onAbrirTarefa,
}: {
  tarefa: Tarefa;
  statusAtual: string;
  qtdSubtarefas: number;
  qtdComentarios: number;
  camposVisiveis: CamposVisiveisTarefa;
  acoes: AcoesCard;
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
      <TarefaCardConteudo
        tarefa={tarefa}
        qtdSubtarefas={qtdSubtarefas}
        qtdComentarios={qtdComentarios}
        responsaveis={acoes.responsaveisPorTarefa[tarefa.id] ?? []}
        camposVisiveis={camposVisiveis}
        acoes={acoes}
      />
    </div>
  );
}

function MenuAcoesTarefa({ tarefa, acoes }: { tarefa: Tarefa; acoes: AcoesCard }) {
  const [aberto, setAberto] = useState(false);
  const [submenu, setSubmenu] = useState<"mover" | "atribuir" | null>(null);
  const [posicao, setPosicao] = useState({ top: 0, left: 0 });
  const botaoRef = useRef<HTMLButtonElement>(null);
  const responsaveisAtuais = acoes.responsaveisPorTarefa[tarefa.id] ?? [];

  function abrir() {
    const rect = botaoRef.current?.getBoundingClientRect();
    if (rect) setPosicao({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 210) });
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    setSubmenu(null);
  }

  return (
    <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        ref={botaoRef}
        onClick={() => (aberto ? fechar() : abrir())}
        className="h-6 w-6 rounded-full bg-white/90 hover:bg-surface flex items-center justify-center text-ink/50 shadow-sm text-xs font-bold"
      >
        ⋯
      </button>
      {aberto &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={fechar} />
            <div
              className="fixed z-50 w-52 rounded-xl bg-white border border-black/10 shadow-lg py-1"
              style={{ top: posicao.top, left: posicao.left }}
            >
              {submenu === null && (
                <>
                  <button
                    onClick={() => {
                      acoes.onRenomear(tarefa);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface"
                  >
                    Renomear
                  </button>
                  <button onClick={() => setSubmenu("mover")} className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface">
                    Mover para etapa
                  </button>
                  <button onClick={() => setSubmenu("atribuir")} className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface">
                    Atribuir a
                  </button>
                  <button
                    onClick={() => {
                      acoes.onDuplicar(tarefa);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => {
                      acoes.onCopiarLink(tarefa);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface"
                  >
                    Copiar link
                  </button>
                  <button
                    onClick={() => {
                      acoes.onArquivar(tarefa);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink/50 hover:bg-surface"
                  >
                    Arquivar
                  </button>
                  <button
                    onClick={() => {
                      acoes.onExcluir(tarefa);
                      fechar();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-surface"
                  >
                    Excluir
                  </button>
                </>
              )}
              {submenu === "mover" && (
                <>
                  <button onClick={() => setSubmenu(null)} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-ink/40 hover:bg-surface">
                    ← Voltar
                  </button>
                  {acoes.statusList.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        acoes.onMover(tarefa.id, s.id);
                        fechar();
                      }}
                      className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-ink/70 hover:bg-surface"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${corDoStatus(s.cor).dot}`} />
                      {s.nome}
                    </button>
                  ))}
                </>
              )}
              {submenu === "atribuir" && (
                <>
                  <button onClick={() => setSubmenu(null)} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-ink/40 hover:bg-surface">
                    ← Voltar
                  </button>
                  <div className="grid grid-cols-5 gap-2 p-2.5">
                    {acoes.funcionariosComAcesso.map((f) => {
                      const marcado = responsaveisAtuais.some((r) => r.id === f.id);
                      return (
                        <button key={f.id} onClick={() => acoes.onToggleResponsavel(tarefa.id, f.id)} className="relative" title={f.nome}>
                          <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={30} />
                          {marcado && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-forest text-white text-[8px] flex items-center justify-center ring-2 ring-white">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function TarefaCardConteudo({
  tarefa,
  qtdSubtarefas = 0,
  qtdComentarios = 0,
  responsaveis = [],
  camposVisiveis,
  acoes,
  arrastando,
}: {
  tarefa: Tarefa;
  qtdSubtarefas?: number;
  qtdComentarios?: number;
  responsaveis?: Responsavel[];
  camposVisiveis: CamposVisiveisTarefa;
  acoes?: AcoesCard;
  arrastando?: boolean;
}) {
  const cliente = nomeCliente(tarefa);
  const temIndicador = camposVisiveis.indicadores && (tarefa.descricao || qtdComentarios > 0 || qtdSubtarefas > 0);

  return (
    <div
      className={`relative group/card rounded-2xl bg-white p-3 cursor-grab active:cursor-grabbing transition-shadow ${arrastando ? "w-72" : "w-full"} ${
        arrastando ? "shadow-2xl rotate-2 border-2 border-forest/30" : "border border-black/5 shadow-sm hover:shadow-md"
      }`}
    >
      {acoes && !arrastando && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <MenuAcoesTarefa tarefa={tarefa} acoes={acoes} />
        </div>
      )}
      <p className="text-sm font-semibold text-ink truncate pr-5 flex items-center gap-1.5">
        {tarefa.eh_projeto ? <IconeProjeto /> : <IconeTarefa />} {tarefa.titulo}
      </p>
      {tarefa.eh_projeto &&
        acoes?.progressoProjetos[tarefa.id] &&
        acoes.progressoProjetos[tarefa.id].total > 0 &&
        (() => {
          const { total, completos } = acoes.progressoProjetos[tarefa.id];
          const pct = Math.round((completos / total) * 100);
          return (
            <div className="mt-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-semibold text-ink/40">
                  {completos}/{total} concluídas
                </span>
                <span className="text-[10px] font-bold text-amber-600">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct === 100 ? "bg-forest" : "bg-amber-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}
      {camposVisiveis.cliente && <p className="text-xs text-ink/50 truncate mt-0.5">{cliente ?? "Interna"}</p>}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {tarefa.prioridade && (
          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${PRIORIDADE_CONFIG[tarefa.prioridade].cor}`}>
            {PRIORIDADE_CONFIG[tarefa.prioridade].label}
          </span>
        )}
        {tarefa.data_inicio && <span className="text-[10px] text-ink/40">Início: {formatarPrazo(tarefa.data_inicio)}</span>}
        {tarefa.prazo &&
          (() => {
            const statusAtual = acoes?.statusList.find((s) => s.id === tarefa.status_id);
            const concluida = statusAtual?.cor === "verde";
            const atraso = concluida ? 0 : diasAtraso(tarefa.prazo);
            return (
              <span className={`text-[10px] ${atraso ? "text-red-600 font-bold" : "text-ink/40"}`}>
                Vencimento: {formatarPrazo(tarefa.prazo)}
                {atraso ? ` · ${atraso}d atrasado` : concluida ? " · concluída" : ""}
              </span>
            );
          })()}
      </div>

      {(temIndicador || (camposVisiveis.responsavel && responsaveis.length > 0)) && (
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
          {camposVisiveis.responsavel && responsaveis.length > 0 && <AvatarStack pessoas={responsaveis} />}
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
  acoes,
  onAbrirTarefa,
}: {
  tarefas: Tarefa[];
  contagemSubtarefas: Record<string, number>;
  contagemComentarios: Record<string, number>;
  camposVisiveis: CamposVisiveisTarefa;
  acoes: AcoesCard;
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
  }).filter((d) => camposVisiveis.mostrarFinsDeSemana || (d.getDay() !== 0 && d.getDay() !== 6));

  const semPrazo = tarefas.filter((t) => !t.prazo);
  const hojeISO = toISODateLocal(hoje);
  const diasISO = dias.map((d) => toISODateLocal(d));

  function colunaVisivel(dataISO: string, sentido: "frente" | "tras") {
    const idx = diasISO.indexOf(dataISO);
    if (idx !== -1) return idx;
    if (sentido === "frente") return diasISO.findIndex((d) => d > dataISO);
    for (let i = diasISO.length - 1; i >= 0; i--) if (diasISO[i] < dataISO) return i;
    return -1;
  }

  type Faixa = { tarefa: Tarefa; colStart: number; colSpan: number; lane: number };
  const idsEmFaixa = new Set<string>();
  let qtdLanes = 0;
  const faixas: Faixa[] = (() => {
    if (diasISO.length === 0) return [];
    const barras = tarefas
      .filter((t) => t.data_inicio && t.prazo && t.data_inicio !== t.prazo)
      .map((t) => {
        const inicioClip = t.data_inicio! < diasISO[0] ? diasISO[0] : t.data_inicio!;
        const fimClip = t.prazo! > diasISO[diasISO.length - 1] ? diasISO[diasISO.length - 1] : t.prazo!;
        const colStart = colunaVisivel(inicioClip, "frente");
        const colFim = colunaVisivel(fimClip, "tras");
        return { tarefa: t, colStart, colSpan: colFim - colStart + 1 };
      })
      .filter((b) => b.colStart !== -1 && b.colSpan > 0)
      .sort((a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan);

    const lanes: { fimCol: number }[] = [];
    const posicionadas = barras.map((b) => {
      let lane = lanes.findIndex((l) => l.fimCol < b.colStart);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push({ fimCol: b.colStart + b.colSpan - 1 });
      } else {
        lanes[lane].fimCol = b.colStart + b.colSpan - 1;
      }
      idsEmFaixa.add(b.tarefa.id);
      return { ...b, lane };
    });
    qtdLanes = lanes.length;
    return posicionadas;
  })();

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
          {dias[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – {dias[dias.length - 1].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </h2>
      </div>

      {semPrazo.length > 0 && (
        <details className="mb-4 rounded-2xl bg-surface p-3">
          <summary className="text-sm font-semibold text-ink/60 cursor-pointer">Sem vencimento definido ({semPrazo.length})</summary>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {semPrazo.map((t) => (
              <div key={t.id} onClick={() => onAbrirTarefa(t)} className="cursor-pointer">
                <TarefaCardConteudo
                  tarefa={t}
                  qtdSubtarefas={contagemSubtarefas[t.id] ?? 0}
                  qtdComentarios={contagemComentarios[t.id] ?? 0}
                  responsaveis={acoes.responsaveisPorTarefa[t.id] ?? []}
                  camposVisiveis={camposVisiveis}
                  acoes={acoes}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="overflow-x-auto">
        <div className="rounded-3xl bg-surface border border-black/5 overflow-hidden inline-block min-w-full">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${dias.length}, 16rem)`,
              gridTemplateRows: `auto ${qtdLanes > 0 ? `repeat(${qtdLanes}, auto) ` : ""}auto`,
            }}
          >
            {dias.map((dia, i) => {
              const iso = toISODateLocal(dia);
              return (
                <div
                  key={`cab-${iso}`}
                  style={{ gridColumn: i + 1, gridRow: 1 }}
                  className={`px-3 pt-3 pb-2 ${iso === hojeISO ? "bg-mint/40" : ""} ${i > 0 ? "border-l border-black/5" : ""}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/50">{DIAS_SEMANA[dia.getDay()]}</p>
                  <p className={`text-lg font-extrabold ${iso === hojeISO ? "text-forest" : "text-ink"}`}>{dia.getDate()}</p>
                </div>
              );
            })}

            {qtdLanes > 0 &&
              faixas.map((fx) => (
                <div
                  key={fx.tarefa.id}
                  onClick={() => onAbrirTarefa(fx.tarefa)}
                  className="cursor-pointer mx-1.5 mb-2"
                  style={{ gridColumn: `${fx.colStart + 1} / span ${fx.colSpan}`, gridRow: fx.lane + 2 }}
                >
                  <TarefaCardConteudo
                    tarefa={fx.tarefa}
                    qtdSubtarefas={contagemSubtarefas[fx.tarefa.id] ?? 0}
                    qtdComentarios={contagemComentarios[fx.tarefa.id] ?? 0}
                    responsaveis={acoes.responsaveisPorTarefa[fx.tarefa.id] ?? []}
                    camposVisiveis={camposVisiveis}
                    acoes={acoes}
                  />
                </div>
              ))}

            {dias.map((dia, i) => {
              const iso = toISODateLocal(dia);
              const tarefasDoDia = tarefas.filter((t) => t.prazo === iso && !idsEmFaixa.has(t.id));
              return (
                <div
                  key={`itens-${iso}`}
                  style={{ gridColumn: i + 1, gridRow: qtdLanes + 2 }}
                  className={`px-3 pb-3 pt-1 min-h-[45vh] space-y-2 ${iso === hojeISO ? "bg-mint/40" : ""} ${i > 0 ? "border-l border-black/5" : ""}`}
                >
                  {tarefasDoDia.map((t) => (
                    <div key={t.id} onClick={() => onAbrirTarefa(t)} className="cursor-pointer">
                      <TarefaCardConteudo
                        tarefa={t}
                        qtdSubtarefas={contagemSubtarefas[t.id] ?? 0}
                        qtdComentarios={contagemComentarios[t.id] ?? 0}
                        responsaveis={acoes.responsaveisPorTarefa[t.id] ?? []}
                        camposVisiveis={camposVisiveis}
                        acoes={acoes}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function TarefasMes({
  tarefas,
  statusList,
  onAbrirTarefa,
}: {
  tarefas: Tarefa[];
  contagemSubtarefas: Record<string, number>;
  contagemComentarios: Record<string, number>;
  camposVisiveis: CamposVisiveisTarefa;
  acoes: AcoesCard;
  statusList: StatusItem[];
  onAbrirTarefa: (t: Tarefa) => void;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const primeiroDiaMes = new Date(ano, mes, 1);
  const ultimoDiaMes = new Date(ano, mes + 1, 0);
  const dias: Date[] = [];
  const inicioGrade = new Date(primeiroDiaMes);
  inicioGrade.setDate(inicioGrade.getDate() - inicioGrade.getDay());
  const fimGrade = new Date(ultimoDiaMes);
  fimGrade.setDate(fimGrade.getDate() + (6 - fimGrade.getDay()));
  for (let d = new Date(inicioGrade); d <= fimGrade; d.setDate(d.getDate() + 1)) {
    dias.push(new Date(d));
  }

  const hojeISO = toISODateLocal(hoje);
  const tarefasPorDia = new Map<string, Tarefa[]>();
  for (const t of tarefas) {
    if (!t.prazo) continue;
    if (!tarefasPorDia.has(t.prazo)) tarefasPorDia.set(t.prazo, []);
    tarefasPorDia.get(t.prazo)!.push(t);
  }

  const tarefasMultiDia = tarefas.filter((t) => t.data_inicio && t.prazo && t.data_inicio !== t.prazo);
  const idsEmFaixa = new Set<string>();

  function calcularFaixasSemana(diasDaSemana: Date[]) {
    const semanaISO = diasDaSemana.map((d) => toISODateLocal(d));
    const barras = tarefasMultiDia
      .filter((t) => t.data_inicio! <= semanaISO[6] && t.prazo! >= semanaISO[0])
      .map((t) => {
        const inicioClip = t.data_inicio! < semanaISO[0] ? semanaISO[0] : t.data_inicio!;
        const fimClip = t.prazo! > semanaISO[6] ? semanaISO[6] : t.prazo!;
        const colStart = semanaISO.indexOf(inicioClip) + 1;
        const colFim = semanaISO.indexOf(fimClip) + 1;
        return { tarefa: t, colStart, colSpan: colFim - colStart + 1 };
      })
      .filter((b) => b.colStart > 0 && b.colSpan > 0)
      .sort((a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan);

    const lanes: { fimCol: number }[] = [];
    const faixas = barras.map((b) => {
      let lane = lanes.findIndex((l) => l.fimCol < b.colStart);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push({ fimCol: b.colStart + b.colSpan - 1 });
      } else {
        lanes[lane].fimCol = b.colStart + b.colSpan - 1;
      }
      idsEmFaixa.add(b.tarefa.id);
      return { ...b, lane };
    });
    return { faixas, qtdLanes: lanes.length };
  }

  const semanasMes: Date[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanasMes.push(dias.slice(i, i + 7));
  // roda uma vez pra marcar idsEmFaixa antes de desenhar as células de dia único
  for (const semana of semanasMes) calcularFaixasSemana(semana);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => {
            const d = new Date(ano, mes - 1, 1);
            setMes(d.getMonth());
            setAno(d.getFullYear());
          }}
          className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-surface text-ink/50"
        >
          ←
        </button>
        <button
          onClick={() => {
            setMes(hoje.getMonth());
            setAno(hoje.getFullYear());
          }}
          className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-semibold hover:bg-surface"
        >
          Hoje
        </button>
        <button
          onClick={() => {
            const d = new Date(ano, mes + 1, 1);
            setMes(d.getMonth());
            setAno(d.getFullYear());
          }}
          className="rounded-full h-9 w-9 flex items-center justify-center hover:bg-surface text-ink/50"
        >
          →
        </button>
        <h2 className="text-lg font-bold text-ink ml-2">
          {MESES[mes]} {ano}
        </h2>
      </div>

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        <div className="grid grid-cols-7 bg-surface text-xs font-semibold text-ink/50 uppercase tracking-wide">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="px-3 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        {semanasMes.map((diasDaSemana, idxSemana) => {
          const { faixas, qtdLanes } = calcularFaixasSemana(diasDaSemana);
          const linhasGrid = `auto ${qtdLanes > 0 ? `repeat(${qtdLanes}, auto) ` : ""}minmax(0, 1fr)`;
          return (
            <div key={idxSemana} className="grid grid-cols-7" style={{ gridTemplateRows: linhasGrid }}>
              {diasDaSemana.map((dia, i) => {
                const iso = toISODateLocal(dia);
                const doMes = dia.getMonth() === mes;
                return (
                  <div
                    key={`cab-${iso}`}
                    style={{ gridColumn: i + 1, gridRow: 1 }}
                    className={`border-r border-black/5 p-2 pb-1 ${doMes ? "bg-white" : "bg-surface/40"} ${iso === hojeISO ? "bg-mint/30" : ""}`}
                  >
                    <p className={`text-xs font-semibold ${doMes ? "text-ink/60" : "text-ink/30"} ${iso === hojeISO ? "text-forest" : ""}`}>
                      {dia.getDate()}
                    </p>
                  </div>
                );
              })}

              {qtdLanes > 0 &&
                faixas.map((fx) => {
                  const status = statusList.find((s) => s.id === fx.tarefa.status_id);
                  return (
                    <button
                      key={fx.tarefa.id}
                      onClick={() => onAbrirTarefa(fx.tarefa)}
                      style={{ gridColumn: `${fx.colStart} / span ${fx.colSpan}`, gridRow: fx.lane + 2 }}
                      className={`mx-1 mb-1 rounded-lg px-1.5 py-1 text-left text-[11px] font-medium truncate transition-colors ${corDoStatus(status?.cor ?? "cinza").cor}`}
                    >
                      {fx.tarefa.eh_projeto ? (
                        <IconeProjeto tamanho={11} className="inline-block align-[-1px]" />
                      ) : (
                        <IconeTarefa tamanho={11} className="inline-block align-[-1px]" />
                      )}{" "}
                      {fx.tarefa.titulo}
                    </button>
                  );
                })}

              {diasDaSemana.map((dia, i) => {
                const iso = toISODateLocal(dia);
                const doMes = dia.getMonth() === mes;
                const tarefasDoDia = (tarefasPorDia.get(iso) ?? []).filter((t) => !idsEmFaixa.has(t.id));
                return (
                  <div
                    key={`itens-${iso}`}
                    style={{ gridColumn: i + 1, gridRow: qtdLanes + 2 }}
                    className={`min-h-[90px] border-b border-r border-black/5 p-2 pt-0.5 ${doMes ? "bg-white" : "bg-surface/40"} ${
                      iso === hojeISO ? "bg-mint/30" : ""
                    }`}
                  >
                    <div className="space-y-1">
                      {tarefasDoDia.slice(0, 3).map((t) => {
                        const status = statusList.find((s) => s.id === t.status_id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => onAbrirTarefa(t)}
                            className={`w-full text-left rounded-lg px-1.5 py-1 text-[11px] font-medium truncate transition-colors ${corDoStatus(status?.cor ?? "cinza").cor}`}
                          >
                            {t.eh_projeto ? (
                              <IconeProjeto tamanho={11} className="inline-block align-[-1px]" />
                            ) : (
                              <IconeTarefa tamanho={11} className="inline-block align-[-1px]" />
                            )}{" "}
                            {t.titulo}
                          </button>
                        );
                      })}
                      {tarefasDoDia.length > 3 && <p className="text-[10px] text-ink/40 px-1.5">+{tarefasDoDia.length - 3} mais</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FiltroCliente({
  clientes,
  valorId,
  onMudar,
}: {
  clientes: Opcao[];
  valorId: string;
  onMudar: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const selecionado = valorId === "internas" ? { id: "internas", nome: "Internas (sem cliente)" } : clientes.find((c) => c.id === valorId);
  const sugestoes = clientes.filter((c) => normalizar(c.nome).includes(normalizar(busca)));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Cliente</p>
      {selecionado ? (
        <div className="flex items-center justify-between rounded-xl bg-mint px-3 py-2">
          <span className="text-sm font-semibold text-forest">{selecionado.nome}</span>
          <button onClick={() => onMudar("")} className="text-forest hover:text-ink text-xs font-bold">
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            className="input py-1.5 text-sm"
            placeholder="Digite pra buscar..."
          />
          {aberto && (
            <div className="absolute z-30 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-48 overflow-auto">
              <button
                onClick={() => {
                  onMudar("internas");
                  setAberto(false);
                  setBusca("");
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface text-ink/60 border-b border-black/5"
              >
                Internas (sem cliente)
              </button>
              {busca &&
                (sugestoes.length > 0 ? (
                  sugestoes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onMudar(c.id);
                        setAberto(false);
                        setBusca("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface"
                    >
                      {c.nome}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-ink/40">Nenhum cliente encontrado.</p>
                ))}
            </div>
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
  const [ehInterna, setEhInterna] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro("Dê um título pra tarefa.");
      return;
    }
    if (!clienteSelecionado && !ehInterna) {
      setErro('Escolhe um cliente, ou marca "Tarefa interna" se não for de nenhum cliente.');
      return;
    }
    setSaving(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tarefas")
      .insert({ titulo: titulo.trim(), cliente_id: ehInterna ? null : clienteSelecionado?.id ?? null, status_id: statusPadraoId })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      setErro(error?.message ?? "Erro ao criar tarefa.");
      return;
    }
    registrarCriacaoTarefa(data.id, "a tarefa");
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
            <BuscaCliente
              clientes={clientes}
              valor={clienteSelecionado}
              onSelecionar={(c) => {
                setClienteSelecionado(c);
                if (c) setEhInterna(false);
              }}
              placeholder="Digite pra buscar..."
            />
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={ehInterna}
              onChange={(e) => {
                setEhInterna(e.target.checked);
                if (e.target.checked) setClienteSelecionado(null);
              }}
            />
            Tarefa interna (não é de nenhum cliente)
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

interface ModeloProjeto {
  id: string;
  nome: string;
  etapas: { id: string; titulo: string; tarefa_pai_id: string | null; eh_pasta: boolean }[];
}

function NovoProjetoModal({
  clientes,
  statusPadraoId,
  onClose,
  onCriado,
}: {
  clientes: Opcao[];
  statusPadraoId: string;
  onClose: () => void;
  onCriado: (id: string) => void;
}) {
  const [modelos, setModelos] = useState<ModeloProjeto[]>([]);
  const [modeloId, setModeloId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Opcao | null>(null);
  const [carregandoModelos, setCarregandoModelos] = useState(true);
  const [ehInterna, setEhInterna] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarModelos = useCallback(async () => {
    setCarregandoModelos(true);
    const supabase = createClient();
    const { data: modelosData } = await supabase
      .from("tarefas")
      .select("id, titulo")
      .eq("eh_modelo_projeto", true)
      .is("excluido_em", null)
      .order("titulo");
    const idsModelos = (modelosData ?? []).map((m) => m.id);

    // Busca todas as subtarefas de cada modelo, recursivamente (várias camadas de pasta)
    let todasEtapas: { id: string; titulo: string; tarefa_pai_id: string | null; eh_pasta: boolean }[] = [];
    let nivelAtual = idsModelos;
    for (let i = 0; i < 8 && nivelAtual.length > 0; i++) {
      const { data } = await supabase.from("tarefas").select("id, titulo, tarefa_pai_id, eh_pasta").in("tarefa_pai_id", nivelAtual).is("excluido_em", null);
      if (!data || data.length === 0) break;
      todasEtapas = [...todasEtapas, ...data];
      nivelAtual = data.map((d) => d.id);
    }

    const mapaPai = new Map<string, string | null>();
    for (const e of todasEtapas) mapaPai.set(e.id, e.tarefa_pai_id);

    function pertenceAoModelo(etapaId: string, modeloId: string): boolean {
      let atual: string | null = etapaId;
      for (let i = 0; i < 10 && atual; i++) {
        const pai: string | null = mapaPai.get(atual) ?? null;
        if (pai === modeloId) return true;
        atual = pai;
      }
      return false;
    }

    const lista = (modelosData ?? []).map((m) => ({
      id: m.id,
      nome: m.titulo,
      etapas: todasEtapas.filter((e) => pertenceAoModelo(e.id, m.id)),
    }));
    setModelos(lista);
    setCarregandoModelos(false);
  }, []);

  useEffect(() => {
    carregarModelos();
  }, [carregarModelos]);

  const modeloSelecionado = modelos.find((m) => m.id === modeloId) ?? null;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!modeloId) {
      setErro("Escolhe um modelo de projeto.");
      return;
    }
    if (!titulo.trim()) {
      setErro("Dê um nome pro projeto.");
      return;
    }
    if (!clienteSelecionado && !ehInterna) {
      setErro('Escolhe um cliente, ou marca "Projeto interno" se não for de nenhum cliente.');
      return;
    }
    setSaving(true);
    setErro(null);
    const supabase = createClient();
    const { data: projeto, error } = await supabase
      .from("tarefas")
      .insert({ titulo: titulo.trim(), cliente_id: ehInterna ? null : clienteSelecionado?.id ?? null, status_id: statusPadraoId, eh_projeto: true })
      .select("id")
      .single();
    if (error || !projeto) {
      setErro(error?.message ?? "Erro ao criar projeto.");
      setSaving(false);
      return;
    }
    registrarCriacaoTarefa(projeto.id, "o projeto");
    const etapas = modeloSelecionado?.etapas ?? [];
    if (etapas.length > 0) {
      const mapaAntigoNovo = new Map<string, string>();
      const porNivel = (paiIdAntigo: string) => etapas.filter((et) => et.tarefa_pai_id === paiIdAntigo);
      async function criarNivel(paiIdAntigo: string, paiIdNovo: string) {
        for (const et of porNivel(paiIdAntigo)) {
          const { data: nova } = await supabase
            .from("tarefas")
            .insert({
              titulo: et.titulo,
              tarefa_pai_id: paiIdNovo,
              cliente_id: clienteSelecionado?.id ?? null,
              status_id: statusPadraoId,
              eh_pasta: et.eh_pasta,
            })
            .select("id")
            .single();
          if (nova) {
            mapaAntigoNovo.set(et.id, nova.id);
            await criarNivel(et.id, nova.id);
          }
        }
      }
      await criarNivel(modeloId, projeto.id);
    }
    setSaving(false);
    onCriado(projeto.id);
  }

  async function criarModeloRapido() {
    const supabase = createClient();
    const { data: modelo, error } = await supabase
      .from("tarefas")
      .insert({ titulo: "Novo modelo de projeto", eh_modelo_projeto: true, status_id: statusPadraoId })
      .select("id")
      .single();
    if (!error && modelo) {
      registrarCriacaoTarefa(modelo.id, "o modelo de projeto");
      window.open(`/tarefas/${modelo.id}`, "_blank");
      window.addEventListener("focus", function aoVoltar() {
        carregarModelos();
        window.removeEventListener("focus", aoVoltar);
      });
    }
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Novo projeto</h2>
        {carregandoModelos ? (
          <p className="text-sm text-ink/50">Carregando modelos...</p>
        ) : modelos.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink/50">Nenhum modelo de projeto cadastrado ainda.</p>
            <button
              onClick={criarModeloRapido}
              className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
            >
              + Criar novo modelo
            </button>
          </div>
        ) : (
          <form onSubmit={criar} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Modelo *</span>
              <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className="input">
                <option value="">Selecione...</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.etapas.length} etapas)
                  </option>
                ))}
              </select>
              <button type="button" onClick={criarModeloRapido} className="text-xs font-semibold text-forest hover:text-ink mt-1.5">
                + Criar novo modelo
              </button>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Nome do projeto *</span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" placeholder="Ex: Site da Boate Morcegão" required />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink/70 mb-1">Cliente</span>
              <BuscaCliente
                clientes={clientes}
                valor={clienteSelecionado}
                onSelecionar={(c) => {
                  setClienteSelecionado(c);
                  if (c) setEhInterna(false);
                }}
                placeholder="Digite pra buscar..."
              />
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={ehInterna}
                onChange={(e) => {
                  setEhInterna(e.target.checked);
                  if (e.target.checked) setClienteSelecionado(null);
                }}
              />
              Projeto interno (não é de nenhum cliente)
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
        )}
      </div>
    </div>
  );
}

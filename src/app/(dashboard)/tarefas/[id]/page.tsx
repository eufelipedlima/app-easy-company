"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { comLinks } from "@/lib/linkify";
import { sanearNomeArquivo } from "@/lib/nome-arquivo";
import { normalizar } from "@/lib/normalizar";
import { corDoStatus } from "@/lib/status-conteudo";
import { BuscaCliente } from "@/components/busca-cliente";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Cronometro } from "@/components/cronometro";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

interface Comentario {
  id: string;
  autor_id: string;
  texto: string;
  created_at: string;
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
  tarefa_pai_id: string | null;
  tempo_total_segundos: number;
  timer_iniciado_em: string | null;
  timer_iniciado_por: string | null;
  excluido_em: string | null;
  excluido_por: string | null;
  eh_projeto: boolean;
  eh_modelo_projeto: boolean;
}

interface Anexo {
  id: string;
  arquivo_path: string;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  tamanho_bytes: number | null;
  enviado_por: string | null;
  created_at: string;
  url: string;
}

interface Subtarefa {
  id: string;
  titulo: string;
  status_id: string;
  prazo: string | null;
  tarefa_pai_id: string | null;
  eh_pasta: boolean;
  ordem: number;
}

interface SubtarefaNode extends Subtarefa {
  filhos: SubtarefaNode[];
}

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
function Avatar({ nome, fotoUrl, tamanho = 32 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
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
  const visiveis = pessoas.slice(0, 4);
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

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderizarTexto(texto: string, todosOsNomes: string[]) {
  if (todosOsNomes.length === 0) return comLinks(texto, "txt");
  const nomesEscapados = [...todosOsNomes].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regexMencao = new RegExp(`@(${nomesEscapados.join("|")})`, "g");
  const partes = texto.split(regexMencao);
  return partes.map((p, i) =>
    todosOsNomes.includes(p) ? (
      <span key={i} className="text-forest font-semibold bg-mint rounded px-1">
        @{p}
      </span>
    ) : (
      <span key={i}>{comLinks(p, `txt-${i}`)}</span>
    )
  );
}

interface HistoricoItem {
  id: string;
  autor_id: string | null;
  descricao: string;
  created_at: string;
}

function formatarDataCurta(iso: string) {
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

export default function TarefaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [veioDePauta, setVeioDePauta] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setVeioDePauta(new URLSearchParams(window.location.search).get("from") === "pauta");
    }
  }, []);

  const [tarefa, setTarefa] = useState<Tarefa | null>(null);
  const [tituloTarefaMae, setTituloTarefaMae] = useState<string | null>(null);
  const [itensNav, setItensNav] = useState<{ id: string; titulo: string; status_id: string; eh_pasta: boolean }[]>([]);
  const [tituloNav, setTituloNav] = useState<string | null>(null);
  const [idPaiNav, setIdPaiNav] = useState<string | null>(null);
  const [railColapsado, setRailColapsado] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRailColapsado(localStorage.getItem("tarefa-rail-colapsado") === "true");
    }
  }, []);
  function alternarRail() {
    setRailColapsado((v) => {
      const novo = !v;
      if (typeof window !== "undefined") localStorage.setItem("tarefa-rail-colapsado", String(novo));
      return novo;
    });
  }
  const [statusList, setStatusList] = useState<StatusItem[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [funcionariosComAcesso, setFuncionariosComAcesso] = useState<Responsavel[]>([]);
  const [colegas, setColegas] = useState<Opcao[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [meuNome, setMeuNome] = useState("Você");
  const [meuFotoUrl, setMeuFotoUrl] = useState<string | null>(null);
  const [subtarefas, setSubtarefas] = useState<Subtarefa[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [pastasAbertas, setPastasAbertas] = useState<Set<string>>(new Set());
  const [secaoSubtarefasAberta, setSecaoSubtarefasAberta] = useState(true);
  const [responsaveisPorSubtarefa, setResponsaveisPorSubtarefa] = useState<Record<string, Responsavel[]>>({});
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [seletorResponsavelAberto, setSeletorResponsavelAberto] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusAberto, setStatusAberto] = useState(false);
  const [abaLateral, setAbaLateral] = useState<"ajustes" | "comentarios" | "historico">("comentarios");
  const [painelRecolhido, setPainelRecolhido] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Opcao | null>(null);
  const [prioridade, setPrioridade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [prazo, setPrazo] = useState("");

  const [novaSubtarefa, setNovaSubtarefa] = useState("");
  const [criandoSubtarefa, setCriandoSubtarefa] = useState(false);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [novoComentario, setNovoComentario] = useState("");
  const [mencaoBusca, setMencaoBusca] = useState<string | null>(null);
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const comentarioRef = useRef<HTMLTextAreaElement>(null);

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: t }, { data: statusData }, { data: clientesData }, { data: funcData }] = await Promise.all([
      supabase.from("tarefas").select("*").eq("id", id).maybeSingle(),
      supabase.from("status_conteudo").select("id, nome, cor, ordem").order("ordem"),
      supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )"),
      supabase.from("funcionarios").select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )"),
    ]);

    setStatusList(statusData ?? []);
    const listaClientes = ((clientesData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
      .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setClientes(listaClientes);

    const listaFunc = ((funcData ?? []) as unknown as {
      id: string;
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
    }[]).map((f) => ({
      id: f.id,
      nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega",
      fotoUrl: f.papeis?.pessoas?.foto_url ?? null,
      authUserId: f.auth_user_id,
    }));
    setFuncionariosComAcesso(listaFunc.filter((f) => f.authUserId).sort((a, b) => a.nome.localeCompare(b.nome)));
    setColegas(listaFunc.filter((f) => f.authUserId).map((f) => ({ id: f.id, nome: f.nome })));

    if (user) {
      setMeuId(user.id);
      const eu = listaFunc.find((f) => f.authUserId === user.id);
      setMeuNome(eu?.nome ?? "Você");
      setMeuFotoUrl(eu?.fotoUrl ?? null);
    }

    if (t) {
      setTarefa(t);
      setTitulo(t.titulo);
      setDescricao(t.descricao ?? "");
      setClienteSelecionado(t.cliente_id ? listaClientes.find((c) => c.id === t.cliente_id) ?? null : null);
      setPrioridade(t.prioridade ?? "");
      setDataInicio(t.data_inicio ?? "");
      setPrazo(t.prazo ?? "");

      if (t.tarefa_pai_id) {
        const { data: pai } = await supabase.from("tarefas").select("titulo").eq("id", t.tarefa_pai_id).maybeSingle();
        setTituloTarefaMae(pai?.titulo ?? null);
        setTituloNav(pai?.titulo ?? null);
        setIdPaiNav(t.tarefa_pai_id);
        const { data: irmaos } = await supabase
          .from("tarefas")
          .select("id, titulo, status_id, eh_pasta")
          .eq("tarefa_pai_id", t.tarefa_pai_id)
          .is("excluido_em", null)
          .order("ordem");
        setItensNav(irmaos ?? []);
      } else {
        setTituloTarefaMae(null);
        setTituloNav(t.titulo);
        setIdPaiNav(t.id);
        const { data: filhos } = await supabase
          .from("tarefas")
          .select("id, titulo, status_id, eh_pasta")
          .eq("tarefa_pai_id", t.id)
          .is("excluido_em", null)
          .order("ordem");
        setItensNav(filhos ?? []);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const carregarResponsaveis = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("tarefas_responsaveis")
      .select("funcionarios ( id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
      .eq("tarefa_id", id);
    const lista = ((data ?? []) as unknown as {
      funcionarios: { id: string; auth_user_id: string | null; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null } | null;
    }[])
      .map((r) => r.funcionarios)
      .filter(Boolean)
      .map((f) => ({
        id: f!.id,
        nome: f!.papeis?.pessoas?.apelido || f!.papeis?.pessoas?.nome || "Colega",
        fotoUrl: f!.papeis?.pessoas?.foto_url ?? null,
        authUserId: f!.auth_user_id,
      }));
    setResponsaveis(lista);
  }, [id]);

  const carregarSubtarefas = useCallback(async () => {
    const supabase = createClient();
    let todas: Subtarefa[] = [];
    let nivelAtual = [id];
    for (let i = 0; i < 8 && nivelAtual.length > 0; i++) {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, status_id, prazo, tarefa_pai_id, eh_pasta, ordem")
        .in("tarefa_pai_id", nivelAtual)
        .is("excluido_em", null)
        .order("ordem");
      if (!data || data.length === 0) break;
      todas = [...todas, ...data];
      nivelAtual = data.map((d) => d.id);
    }
    setSubtarefas(todas);

    const ids = todas.map((s) => s.id);
    if (ids.length > 0) {
      const { data: respData } = await supabase
        .from("tarefas_responsaveis")
        .select("tarefa_id, funcionarios ( id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
        .in("tarefa_id", ids);
      const mapa: Record<string, Responsavel[]> = {};
      for (const r of (respData ?? []) as unknown as {
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
        if (!mapa[r.tarefa_id]) mapa[r.tarefa_id] = [];
        mapa[r.tarefa_id].push(resp);
      }
      setResponsaveisPorSubtarefa(mapa);
    } else {
      setResponsaveisPorSubtarefa({});
    }
  }, [id]);

  const carregarComentarios = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("tarefas_comentarios").select("id, autor_id, texto, created_at").eq("tarefa_id", id).order("created_at");
    setComentarios(data ?? []);
  }, [id]);

  const carregarHistorico = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("tarefas_historico")
      .select("id, autor_id, descricao, created_at")
      .eq("tarefa_id", id)
      .order("created_at", { ascending: false });
    setHistorico(data ?? []);
  }, [id]);

  const carregarAnexos = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("tarefas_anexos").select("*").eq("tarefa_id", id).order("created_at", { ascending: false });
    setAnexos(
      (data ?? []).map((a) => ({
        ...a,
        url: supabase.storage.from("tarefas-anexos").getPublicUrl(a.arquivo_path).data.publicUrl,
      }))
    );
  }, [id]);

  useEffect(() => {
    carregarResponsaveis();
    carregarSubtarefas();
    carregarComentarios();
    carregarHistorico();
    carregarAnexos();
  }, [carregarResponsaveis, carregarSubtarefas, carregarComentarios, carregarHistorico, carregarAnexos]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`tarefa-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tarefas_comentarios", filter: `tarefa_id=eq.${id}` }, () =>
        carregarComentarios()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, carregarComentarios]);

  async function registrarHistorico(descricaoEvento: string) {
    const supabase = createClient();
    await supabase.from("tarefas_historico").insert({ tarefa_id: id, autor_id: meuId, descricao: descricaoEvento });
    setHistorico((atual) => [
      { id: `temp-${Date.now()}`, autor_id: meuId, descricao: descricaoEvento, created_at: new Date().toISOString() },
      ...atual,
    ]);

    const destinatarios = responsaveis.filter((r) => r.authUserId && r.authUserId !== meuId).map((r) => r.authUserId!);
    if (destinatarios.length > 0) {
      await supabase.from("notificacoes").insert(
        destinatarios.map((destId) => ({
          destinatario_id: destId,
          tipo: "mudanca_tarefa",
          titulo: `${meuNome} ${descricaoEvento} numa tarefa sua`,
          descricao: tarefa?.titulo ?? null,
          link: `/tarefas/${id}`,
          autor_id: meuId,
          autor_nome: meuNome,
          autor_foto_url: meuFotoUrl,
        }))
      );
    }
  }

  async function salvarCampo(campo: Record<string, string | null>, eventoHistorico?: string) {
    const supabase = createClient();
    await supabase.from("tarefas").update(campo).eq("id", id);
    if (eventoHistorico) registrarHistorico(eventoHistorico);
  }

  async function adicionarAnexos(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setEnviandoAnexo(true);
    const supabase = createClient();
    for (const arquivo of Array.from(arquivos)) {
      const caminho = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${sanearNomeArquivo(arquivo.name)}`;
      const { error } = await supabase.storage.from("tarefas-anexos").upload(caminho, arquivo);
      if (!error) {
        await supabase.from("tarefas_anexos").insert({
          tarefa_id: id,
          arquivo_path: caminho,
          arquivo_nome: arquivo.name,
          arquivo_tipo: arquivo.type,
          tamanho_bytes: arquivo.size,
          enviado_por: meuId,
        });
      }
    }
    registrarHistorico(`anexou ${arquivos.length > 1 ? `${arquivos.length} arquivos` : "um arquivo"}`);
    carregarAnexos();
    setEnviandoAnexo(false);
  }

  async function removerAnexo(anexo: Anexo) {
    if (!window.confirm(`Remover "${anexo.arquivo_nome}"?`)) return;
    const supabase = createClient();
    await supabase.storage.from("tarefas-anexos").remove([anexo.arquivo_path]);
    await supabase.from("tarefas_anexos").delete().eq("id", anexo.id);
    setAnexos((atual) => atual.filter((a) => a.id !== anexo.id));
  }

  function formatarTamanho(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function salvarCampoDireto(nomeCampo: string, valor: string | null, eventoHistorico?: string) {
    await salvarCampo({ [nomeCampo]: valor }, eventoHistorico);
  }

  async function iniciarCronometro() {
    const supabase = createClient();
    const agora = new Date().toISOString();
    await supabase.from("tarefas").update({ timer_iniciado_em: agora, timer_iniciado_por: meuId }).eq("id", id);
    setTarefa((t) => (t ? { ...t, timer_iniciado_em: agora, timer_iniciado_por: meuId } : t));
    registrarHistorico("iniciou o cronômetro");
  }

  async function pausarCronometro() {
    if (!tarefa?.timer_iniciado_em) return;
    const segundosCorridos = Math.floor((Date.now() - new Date(tarefa.timer_iniciado_em).getTime()) / 1000);
    const novoTotal = tarefa.tempo_total_segundos + segundosCorridos;
    const supabase = createClient();
    await supabase.from("tarefas").update({ tempo_total_segundos: novoTotal, timer_iniciado_em: null, timer_iniciado_por: null }).eq("id", id);
    setTarefa((t) => (t ? { ...t, tempo_total_segundos: novoTotal, timer_iniciado_em: null, timer_iniciado_por: null } : t));
    const minutos = Math.round(segundosCorridos / 60);
    registrarHistorico(`pausou o cronômetro (+${minutos < 1 ? "menos de 1" : minutos}min)`);
  }

  async function toggleResponsavel(funcionarioId: string) {
    const supabase = createClient();
    const pessoa = funcionariosComAcesso.find((f) => f.id === funcionarioId);
    const jaTem = responsaveis.some((r) => r.id === funcionarioId);
    if (jaTem) {
      setResponsaveis((atual) => atual.filter((r) => r.id !== funcionarioId));
      await supabase.from("tarefas_responsaveis").delete().eq("tarefa_id", id).eq("funcionario_id", funcionarioId);
      if (pessoa) registrarHistorico(`removeu ${pessoa.nome} dos responsáveis`);
    } else {
      if (pessoa) setResponsaveis((atual) => [...atual, pessoa]);
      await supabase.from("tarefas_responsaveis").insert({ tarefa_id: id, funcionario_id: funcionarioId });
      if (pessoa) registrarHistorico(`atribuiu ${pessoa.nome} como responsável`);
      if (pessoa?.authUserId && pessoa.authUserId !== meuId) {
        await supabase.from("notificacoes").insert({
          destinatario_id: pessoa.authUserId,
          tipo: "atribuicao_tarefa",
          titulo: `${meuNome} te atribuiu a uma tarefa`,
          descricao: tarefa?.titulo ?? null,
          link: `/tarefas/${id}`,
          autor_id: meuId,
          autor_nome: meuNome,
          autor_foto_url: meuFotoUrl,
        });
      }
    }
  }

  function nomeDoAutor(authUserId: string) {
    return authUserId === meuId ? meuNome : colegas.find((c) => c.id === authUserId)?.nome ?? "Alguém";
  }

  async function adicionarSubtarefa(paiId: string, tituloNovo?: string, ehPasta?: boolean) {
    const nomeFinal = tituloNovo ?? novaSubtarefa;
    if (!nomeFinal.trim() || !tarefa) return;
    setCriandoSubtarefa(true);
    const supabase = createClient();
    const irmaos = subtarefas.filter((s) => s.tarefa_pai_id === paiId);
    await supabase.from("tarefas").insert({
      titulo: nomeFinal.trim(),
      tarefa_pai_id: paiId,
      cliente_id: tarefa.cliente_id,
      status_id: statusList[0]?.id,
      eh_pasta: ehPasta ?? false,
      ordem: irmaos.length,
    });
    registrarHistorico(`criou ${ehPasta ? "a pasta" : "a subtarefa"} "${nomeFinal.trim()}"`);
    if (!tituloNovo) setNovaSubtarefa("");
    setCriandoSubtarefa(false);
    if (paiId !== id) setPastasAbertas((atual) => new Set(atual).add(paiId));
    carregarSubtarefas();
  }

  async function reordenarSubtarefas(paiId: string, indexAntigo: number, indexNovo: number) {
    const irmaos = subtarefas.filter((s) => s.tarefa_pai_id === paiId);
    const outros = subtarefas.filter((s) => s.tarefa_pai_id !== paiId);
    const novosIrmaos = [...irmaos];
    const [movido] = novosIrmaos.splice(indexAntigo, 1);
    novosIrmaos.splice(indexNovo, 0, movido);
    setSubtarefas([...outros, ...novosIrmaos]);
    const supabase = createClient();
    await Promise.all(novosIrmaos.map((s, i) => supabase.from("tarefas").update({ ordem: i }).eq("id", s.id)));
  }

  async function salvarCampoSubtarefa(subId: string, campo: Record<string, string | null>) {
    setSubtarefas((atual) => atual.map((s) => (s.id === subId ? { ...s, ...campo } : s)));
    const supabase = createClient();
    await supabase.from("tarefas").update(campo).eq("id", subId);
  }

  async function toggleResponsavelSubtarefa(subId: string, funcionarioId: string) {
    const supabase = createClient();
    const atuais = responsaveisPorSubtarefa[subId] ?? [];
    const jaTem = atuais.some((r) => r.id === funcionarioId);
    if (jaTem) {
      setResponsaveisPorSubtarefa((atual) => ({ ...atual, [subId]: atuais.filter((r) => r.id !== funcionarioId) }));
      await supabase.from("tarefas_responsaveis").delete().eq("tarefa_id", subId).eq("funcionario_id", funcionarioId);
    } else {
      const pessoa = funcionariosComAcesso.find((f) => f.id === funcionarioId);
      if (pessoa) setResponsaveisPorSubtarefa((atual) => ({ ...atual, [subId]: [...atuais, pessoa] }));
      await supabase.from("tarefas_responsaveis").insert({ tarefa_id: subId, funcionario_id: funcionarioId });
      if (pessoa?.authUserId) {
        await supabase.from("notificacoes").insert({
          destinatario_id: pessoa.authUserId,
          tipo: "atribuicao_tarefa",
          titulo: `${meuNome} te atribuiu a uma subtarefa`,
          descricao: subtarefas.find((s) => s.id === subId)?.titulo ?? null,
          link: `/tarefas/${subId}`,
          autor_id: meuId,
          autor_nome: meuNome,
          autor_foto_url: meuFotoUrl,
        });
      }
    }
  }

  async function enviarComentario() {
    if (!novoComentario.trim() || !meuId) return;
    setEnviandoComentario(true);
    const supabase = createClient();
    const texto = novoComentario.trim();
    const { error } = await supabase.from("tarefas_comentarios").insert({ tarefa_id: id, autor_id: meuId, texto });
    if (!error) {
      setNovoComentario("");
      const nomesColegas = colegas.map((c) => c.nome);
      const mencionados = colegas.filter((c) => texto.includes(`@${c.nome}`));
      if (mencionados.length > 0) {
        await supabase.from("notificacoes").insert(
          mencionados.map((c) => ({
            destinatario_id: funcionariosComAcesso.find((f) => f.id === c.id)?.authUserId ?? null,
            tipo: "mencao_tarefa",
            titulo: `${meuNome} te mencionou numa tarefa`,
            descricao: tarefa?.titulo ?? texto.slice(0, 120),
            link: `/tarefas/${id}`,
            autor_id: meuId,
            autor_nome: meuNome,
            autor_foto_url: meuFotoUrl,
          })).filter((n) => n.destinatario_id)
        );
      }
      void nomesColegas;
      carregarComentarios();
    }
    setEnviandoComentario(false);
  }

  function selecionarMencao(nome: string) {
    const textarea = comentarioRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart ?? novoComentario.length;
    const antes = novoComentario.slice(0, pos);
    const depois = novoComentario.slice(pos);
    const novoAntes = antes.replace(/@([a-zA-ZÀ-ÿ]*)$/, `@${nome} `);
    setNovoComentario(novoAntes + depois);
    setMencaoBusca(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = novoAntes.length;
    });
  }

  async function excluirTarefa() {
    if (!window.confirm("Mover essa tarefa (e as subtarefas dela) pra lixeira? Um administrador pode restaurar tudo em até 30 dias.")) return;
    const supabase = createClient();
    const agora = new Date().toISOString();
    const ids = [id, ...subtarefas.map((s) => s.id)];
    await supabase.from("tarefas").update({ excluido_em: agora, excluido_por: meuId }).in("id", ids);
    router.push(tarefa?.tarefa_pai_id ? `/tarefas/${tarefa.tarefa_pai_id}` : "/tarefas");
  }

  async function restaurarTarefa() {
    const supabase = createClient();
    const ids = [id, ...subtarefas.map((s) => s.id)];
    await supabase.from("tarefas").update({ excluido_em: null, excluido_por: null }).in("id", ids);
    setTarefa((t) => (t ? { ...t, excluido_em: null, excluido_por: null } : t));
  }

  async function excluirTarefaDefinitivo() {
    if (!window.confirm("Excluir essa tarefa definitivamente, sem volta nenhuma?")) return;
    const supabase = createClient();
    await supabase.from("tarefas").delete().eq("id", id);
    router.push("/configuracoes/lixeira");
  }

  const colegasParaMencao = colegas.filter((c) => mencaoBusca !== null && normalizar(c.nome).includes(normalizar(mencaoBusca)));
  const todosOsNomes = [meuNome, ...colegas.map((c) => c.nome)];
  const statusAtual = statusList.find((s) => s.id === tarefa?.status_id);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (!tarefa) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Tarefa não encontrada.</p>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-surface/30">
      <div className="px-8 py-4 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(veioDePauta ? "/inicio/pauta" : "/tarefas")}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors"
          >
            {veioDePauta ? "← Pauta" : "← Tarefas"}
          </button>
          {tituloTarefaMae && tarefa.tarefa_pai_id && (
            <>
              <span className="text-ink/20">/</span>
              <button onClick={() => router.push(`/tarefas/${tarefa.tarefa_pai_id}`)} className="text-sm font-semibold text-forest hover:text-ink truncate max-w-xs">
                {tituloTarefaMae}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Cronometro
            tempoTotalSegundos={tarefa.tempo_total_segundos}
            timerIniciadoEm={tarefa.timer_iniciado_em}
            nomeQuemIniciou={tarefa.timer_iniciado_por ? nomeDoAutor(tarefa.timer_iniciado_por) : null}
            souEuQuemIniciou={tarefa.timer_iniciado_por === meuId}
            onIniciar={iniciarCronometro}
            onPausar={pausarCronometro}
          />
          {!tarefa.excluido_em && (
            <button onClick={excluirTarefa} className="text-sm font-semibold text-red-500 hover:text-red-700">
              Excluir tarefa
            </button>
          )}
        </div>
      </div>

      {tarefa.excluido_em && (
        <div className="mx-8 mt-4 rounded-2xl bg-red-50 border-2 border-red-200 px-5 py-3.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <p className="text-sm font-bold text-red-700">
            🗑️ Excluída em {formatarQuando(tarefa.excluido_em)}
            {tarefa.excluido_por && ` por ${nomeDoAutor(tarefa.excluido_por)}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={restaurarTarefa}
              className="rounded-full bg-forest text-white px-4 py-1.5 text-xs font-semibold hover:brightness-110 transition"
            >
              Restaurar
            </button>
            <button
              onClick={excluirTarefaDefinitivo}
              className="rounded-full border-2 border-red-300 text-red-700 px-4 py-1.5 text-xs font-semibold hover:bg-red-100 transition"
            >
              Excluir de vez
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {itensNav.length > 0 && (
          <div className={`shrink-0 border-r border-black/5 bg-white/60 flex flex-col transition-all duration-200 ${railColapsado ? "w-10" : "w-64"}`}>
            <button
              onClick={alternarRail}
              className="flex items-center gap-2 px-3 py-3 text-ink/40 hover:text-ink shrink-0"
              title={railColapsado ? "Expandir lista" : "Recolher lista"}
            >
              <span className={`text-xs transition-transform ${railColapsado ? "rotate-180" : ""}`}>◀</span>
              {!railColapsado && <span className="text-[11px] font-bold uppercase tracking-wide">Subtarefas</span>}
            </button>
            {!railColapsado && (
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {tituloNav && (
                  <button
                    onClick={() => idPaiNav && idPaiNav !== id && router.push(`/tarefas/${idPaiNav}`)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold truncate mb-1 ${
                      idPaiNav === id ? "text-ink" : "text-forest hover:bg-surface"
                    }`}
                  >
                    {idPaiNav !== id && "↑ "}
                    {tituloNav}
                  </button>
                )}
                <div className="space-y-0.5">
                  {itensNav.map((item) => {
                    const st = statusList.find((s) => s.id === item.status_id);
                    const ativo = item.id === id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => !item.eh_pasta && router.push(`/tarefas/${item.id}`)}
                        disabled={item.eh_pasta}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                          ativo ? "bg-mint text-forest font-bold" : item.eh_pasta ? "text-ink/40 cursor-default" : "text-ink/70 hover:bg-surface"
                        }`}
                      >
                        {item.eh_pasta ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-violet-500">
                            <path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
                          </svg>
                        ) : (
                          <span className={`h-2 w-2 rounded-full shrink-0 ${corDoStatus(st?.cor ?? "cinza").dot}`} />
                        )}
                        <span className="text-xs truncate">{item.titulo}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">
          {tarefa.eh_modelo_projeto ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-bold uppercase tracking-wide mb-3">
              🗂️ Modelo de Projeto
            </span>
          ) : tarefa.eh_projeto ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-bold uppercase tracking-wide mb-3">
              📋 Projeto
            </span>
          ) : null}
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => {
              if (titulo.trim() && titulo.trim() !== tarefa.titulo) {
                salvarCampo({ titulo: titulo.trim() }, `renomeou para "${titulo.trim()}"`);
              }
            }}
            className="text-2xl font-extrabold text-ink w-full mb-5 outline-none focus:bg-white rounded-lg px-1 -mx-1 bg-transparent"
          />

          {tarefa.eh_projeto &&
            (() => {
              const itensDeTrabalho = subtarefas.filter((s) => !s.eh_pasta);
              const total = itensDeTrabalho.length;
              if (total === 0) return null;
              const completos = itensDeTrabalho.filter((s) => statusList.find((st) => st.id === s.status_id)?.cor === "verde").length;
              const pct = Math.round((completos / total) * 100);
              return (
                <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-ink">Progresso do projeto</span>
                    <span className="text-sm font-bold text-amber-600">{pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-forest" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-ink/40 mt-1.5">
                    {completos} de {total} subtarefas concluídas
                  </p>
                </div>
              );
            })()}

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 rounded-2xl bg-white p-3.5 shadow-sm text-sm">
            <div>
              <span className="block text-xs text-ink/50 mb-1">Status</span>
              <div className="relative">
                <button
                  onClick={() => setStatusAberto((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${corDoStatus(statusAtual?.cor ?? "cinza").cor}`}
                >
                  <span className={`h-2 w-2 rounded-full ${corDoStatus(statusAtual?.cor ?? "cinza").dot}`} />
                  {statusAtual?.nome ?? "—"}
                  <span className="text-xs opacity-60">▾</span>
                </button>
                {statusAberto && (
                  <div className="absolute z-20 mt-1 w-56 rounded-2xl bg-white border border-black/10 shadow-lg p-1.5" onMouseLeave={() => setStatusAberto(false)}>
                    {statusList.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          salvarCampo({ status_id: s.id }, `mudou o status para "${s.nome}"`);
                          setTarefa((t) => (t ? { ...t, status_id: s.id } : t));
                          setStatusAberto(false);
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-surface"
                      >
                        <span className={`h-2 w-2 rounded-full ${corDoStatus(s.cor).dot}`} />
                        {s.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Cliente</span>
              <BuscaCliente
                clientes={clientes}
                valor={clienteSelecionado}
                onSelecionar={(c) => {
                  setClienteSelecionado(c);
                  salvarCampo({ cliente_id: c?.id ?? null }, c ? `mudou o cliente para ${c.nome}` : "removeu o cliente");
                }}
              />
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Responsáveis</span>
              <div className="relative">
                <button
                  onClick={() => setSeletorResponsavelAberto((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-black/10 pl-1 pr-3 py-1 hover:bg-surface"
                >
                  {responsaveis.length > 0 ? (
                    <AvatarStack pessoas={responsaveis} tamanho={26} />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-surface flex items-center justify-center text-ink/30 text-xs">+</span>
                  )}
                  <span className="text-xs text-ink/50">{responsaveis.length > 0 ? "Editar" : "Adicionar"}</span>
                </button>
                {seletorResponsavelAberto && (
                  <div
                    className="absolute z-20 mt-1 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-3"
                    onMouseLeave={() => setSeletorResponsavelAberto(false)}
                  >
                    <div className="grid grid-cols-5 gap-2.5">
                      {funcionariosComAcesso.map((f) => {
                        const marcado = responsaveis.some((r) => r.id === f.id);
                        return (
                          <button key={f.id} onClick={() => toggleResponsavel(f.id)} className="relative" title={f.nome}>
                            <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={34} />
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
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Prioridade</span>
              <select
                value={prioridade}
                onChange={(e) => {
                  setPrioridade(e.target.value);
                  salvarCampo({ prioridade: e.target.value || null }, `mudou a prioridade para "${e.target.value || "nenhuma"}"`);
                }}
                className="input"
              >
                <option value="">Nenhuma</option>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Início</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  salvarCampo({ data_inicio: e.target.value || null }, "mudou a data de início");
                }}
                className="input"
              />
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Prazo</span>
              <input
                type="date"
                value={prazo}
                onChange={(e) => {
                  setPrazo(e.target.value);
                  salvarCampo({ prazo: e.target.value || null }, "mudou o prazo");
                }}
                className="input"
              />
            </div>
          </div>

          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-sm font-bold text-ink mb-2">Descrição</span>
            <RichTextEditor
              valorHtml={descricao}
              onChange={setDescricao}
              onSalvar={() => salvarCampoDireto("descricao", descricao || null, "atualizou a descrição")}
              placeholder="Detalhes da tarefa..."
            />
          </div>

          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-ink flex items-center gap-2">
                📎 Anexos
                {anexos.length > 0 && <span className="text-xs font-semibold text-ink/40 bg-surface rounded-full px-2 py-0.5">{anexos.length}</span>}
              </span>
              <label className="text-xs font-semibold text-forest hover:text-ink cursor-pointer">
                {enviandoAnexo ? "Enviando..." : "+ Adicionar"}
                <input type="file" multiple onChange={(e) => adicionarAnexos(e.target.files)} className="hidden" disabled={enviandoAnexo} />
              </label>
            </div>
            {anexos.length === 0 ? (
              <p className="text-xs text-ink/40">Nenhum anexo ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {anexos.map((a) => {
                  const ehImagem = a.arquivo_tipo?.startsWith("image/");
                  const ehPdf = a.arquivo_tipo === "application/pdf";
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {ehImagem ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.url} alt={a.arquivo_nome ?? "anexo"} className="h-9 w-9 rounded-lg object-cover shrink-0 border border-black/5" />
                        ) : (
                          <span className="h-9 w-9 rounded-lg bg-white border border-black/5 flex items-center justify-center text-base shrink-0">
                            {ehPdf ? "📕" : "📄"}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-ink truncate">{a.arquivo_nome ?? "arquivo"}</p>
                          {a.tamanho_bytes && <p className="text-xs text-ink/40">{formatarTamanho(a.tamanho_bytes)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Visualizar"
                          className="h-7 w-7 rounded-full flex items-center justify-center text-ink/50 hover:text-ink hover:bg-white transition-colors"
                        >
                          👁️
                        </a>
                        <a
                          href={a.url}
                          download={a.arquivo_nome ?? undefined}
                          title="Baixar"
                          className="h-7 w-7 rounded-full flex items-center justify-center text-ink/50 hover:text-ink hover:bg-white transition-colors"
                        >
                          ⬇
                        </a>
                        <button
                          onClick={() => removerAnexo(a)}
                          title="Remover"
                          className="h-7 w-7 rounded-full flex items-center justify-center text-ink/30 hover:text-red-600 hover:bg-white transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <button
              onClick={() => setSecaoSubtarefasAberta((v) => !v)}
              className="w-full flex items-center gap-2 mb-1 text-left"
            >
              <span className={`text-xs text-ink/40 transition-transform ${secaoSubtarefasAberta ? "rotate-90" : ""}`}>▸</span>
              <span className="text-sm font-bold text-ink">Subtarefas</span>
              <span className="text-xs font-semibold text-ink/40 bg-surface rounded-full px-2 py-0.5">{subtarefas.length}</span>
            </button>
            {secaoSubtarefasAberta && (
              <div className="mt-2">
                {subtarefas.length > 0 && (
                  <div className="grid grid-cols-[1fr_110px_150px_110px] gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink/40">
                    <span>Nome</span>
                    <span>Responsáveis</span>
                    <span>Prazo</span>
                    <span>Status</span>
                  </div>
                )}
                <div className="space-y-1.5 mb-2">
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e: DragEndEvent) => {
                      const { active, over } = e;
                      if (!over || active.id === over.id) return;
                      const raizes = construirArvoreSubtarefas(subtarefas, id);
                      const indexAntigo = raizes.findIndex((n) => n.id === active.id);
                      const indexNovo = raizes.findIndex((n) => n.id === over.id);
                      if (indexAntigo === -1 || indexNovo === -1) return;
                      reordenarSubtarefas(id, indexAntigo, indexNovo);
                    }}
                  >
                    <SortableContext items={construirArvoreSubtarefas(subtarefas, id).map((n) => n.id)} strategy={verticalListSortingStrategy}>
                      {construirArvoreSubtarefas(subtarefas, id).map((no) => (
                        <NoSubtarefa
                          key={no.id}
                          no={no}
                          nivel={0}
                          pastasAbertas={pastasAbertas}
                          onTogglePasta={(nid) =>
                            setPastasAbertas((atual) => {
                              const novo = new Set(atual);
                              if (novo.has(nid)) novo.delete(nid);
                              else novo.add(nid);
                              return novo;
                            })
                          }
                          statusList={statusList}
                          funcionariosComAcesso={funcionariosComAcesso}
                          responsaveisPorSubtarefa={responsaveisPorSubtarefa}
                          onAbrir={(nid) => router.push(`/tarefas/${nid}`)}
                          onSalvarNome={(nid, novoNome) => salvarCampoSubtarefa(nid, { titulo: novoNome })}
                          onSalvarPrazo={(nid, novoPrazo) => salvarCampoSubtarefa(nid, { prazo: novoPrazo || null })}
                          onSalvarStatus={(nid, novoStatusId) => salvarCampoSubtarefa(nid, { status_id: novoStatusId })}
                          onToggleResponsavel={(nid, funcionarioId) => toggleResponsavelSubtarefa(nid, funcionarioId)}
                          onAdicionarFilho={(nid, nomeNovo, ehPasta) => adicionarSubtarefa(nid, nomeNovo, ehPasta)}
                          onReordenar={reordenarSubtarefas}
                          dndSensors={dndSensors}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={novaSubtarefa}
                    onChange={(e) => setNovaSubtarefa(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarSubtarefa(id);
                      }
                    }}
                    className="input text-sm"
                    placeholder="Nome da subtarefa..."
                  />
                  <button
                    onClick={() => adicionarSubtarefa(id)}
                    disabled={criandoSubtarefa}
                    className="shrink-0 text-sm font-semibold text-forest hover:text-ink disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                  <button
                    onClick={() => adicionarSubtarefa(id, "Nova pasta", true)}
                    disabled={criandoSubtarefa}
                    className="shrink-0 text-sm font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50"
                    title="Cria uma subtarefa que pode agrupar outras dentro dela"
                  >
                    📁 Pasta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {painelRecolhido ? (
          <button
            onClick={() => setPainelRecolhido(false)}
            className="w-12 shrink-0 border-l border-black/5 bg-white flex flex-col items-center pt-4 hover:bg-surface transition-colors"
            title="Mostrar comentários"
          >
            <span className="text-ink/40 text-lg">💬</span>
          </button>
        ) : (
          <div className="w-96 shrink-0 border-l border-black/5 flex flex-col bg-white">
            <div className="px-5 py-4 border-b border-black/5 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setAbaLateral("comentarios")}
                  className={`text-sm font-bold ${abaLateral === "comentarios" ? "text-ink" : "text-ink/40"}`}
                >
                  Comentários
                </button>
                <button
                  onClick={() => setAbaLateral("historico")}
                  className={`text-sm font-bold ${abaLateral === "historico" ? "text-ink" : "text-ink/40"}`}
                >
                  Histórico
                </button>
              </div>
              <button onClick={() => setPainelRecolhido(true)} className="text-ink/30 hover:text-ink text-sm" title="Recolher">
                ▶
              </button>
            </div>

            {abaLateral === "comentarios" ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {comentarios.length === 0 ? (
                    <p className="text-sm text-ink/40">Nenhum comentário ainda.</p>
                  ) : (
                    comentarios.map((c) => {
                      const nome = nomeDoAutor(c.autor_id);
                      const fotoAutor = funcionariosComAcesso.find((f) => f.authUserId === c.autor_id)?.fotoUrl ?? null;
                      return (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <Avatar nome={nome} fotoUrl={fotoAutor} tamanho={30} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-bold text-ink">{nome}</span>
                              <span className="text-[11px] text-ink/40">{formatarQuando(c.created_at)}</span>
                            </div>
                            <p className="text-sm text-ink whitespace-pre-wrap break-words">{renderizarTexto(c.texto, todosOsNomes)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-4 border-t border-black/5 shrink-0 relative">
                  <textarea
                    ref={comentarioRef}
                    value={novoComentario}
                    onChange={(e) => {
                      const valor = e.target.value;
                      setNovoComentario(valor);
                      const pos = e.target.selectionStart ?? valor.length;
                      const antes = valor.slice(0, pos);
                      const match = antes.match(/@([a-zA-ZÀ-ÿ]*)$/);
                      setMencaoBusca(match ? match[1] : null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && mencaoBusca === null) {
                        e.preventDefault();
                        enviarComentario();
                      }
                    }}
                    rows={2}
                    placeholder="Escreva um comentário... (@ pra mencionar)"
                    className="input resize-none w-full text-sm"
                  />
                  {mencaoBusca !== null && colegasParaMencao.length > 0 && (
                    <div className="absolute z-20 bottom-20 left-4 right-4 rounded-2xl bg-white border border-black/10 shadow-lg py-1 max-h-40 overflow-y-auto">
                      {colegasParaMencao.map((c) => (
                        <button key={c.id} onClick={() => selecionarMencao(c.nome)} className="w-full text-left px-4 py-2 text-sm hover:bg-surface">
                          {c.nome}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={enviarComentario}
                    disabled={enviandoComentario || !novoComentario.trim()}
                    className="mt-2 rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
                  >
                    Comentar
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {historico.length === 0 ? (
                  <p className="text-sm text-ink/40">Nenhuma alteração registrada ainda.</p>
                ) : (
                  historico.map((h) => (
                    <div key={h.id} className="text-xs text-ink/60 border-l-2 border-black/10 pl-3 py-0.5">
                      <span className="font-semibold text-ink">{h.autor_id ? nomeDoAutor(h.autor_id) : "Alguém"}</span> {h.descricao}
                      <span className="block text-[10px] text-ink/40 mt-0.5">{formatarQuando(h.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function construirArvoreSubtarefas(lista: Subtarefa[], raizId: string): SubtarefaNode[] {
  const mapa = new Map<string, SubtarefaNode>();
  lista.forEach((s) => mapa.set(s.id, { ...s, filhos: [] }));
  const raizes: SubtarefaNode[] = [];
  lista.forEach((s) => {
    const no = mapa.get(s.id)!;
    if (s.tarefa_pai_id && s.tarefa_pai_id !== raizId && mapa.has(s.tarefa_pai_id)) {
      mapa.get(s.tarefa_pai_id)!.filhos.push(no);
    } else {
      raizes.push(no);
    }
  });
  return raizes;
}

function NoSubtarefa({
  no,
  nivel,
  pastasAbertas,
  onTogglePasta,
  statusList,
  funcionariosComAcesso,
  responsaveisPorSubtarefa,
  onAbrir,
  onSalvarNome,
  onSalvarPrazo,
  onSalvarStatus,
  onToggleResponsavel,
  onAdicionarFilho,
  onReordenar,
  dndSensors,
}: {
  no: SubtarefaNode;
  nivel: number;
  pastasAbertas: Set<string>;
  onTogglePasta: (id: string) => void;
  statusList: StatusItem[];
  funcionariosComAcesso: Responsavel[];
  responsaveisPorSubtarefa: Record<string, Responsavel[]>;
  onAbrir: (id: string) => void;
  onSalvarNome: (id: string, v: string) => void;
  onSalvarPrazo: (id: string, v: string) => void;
  onSalvarStatus: (id: string, v: string) => void;
  onToggleResponsavel: (id: string, funcionarioId: string) => void;
  onAdicionarFilho: (id: string, nome: string, ehPasta?: boolean) => void;
  onReordenar: (paiId: string, indexAntigo: number, indexNovo: number) => void;
  dndSensors: ReturnType<typeof useSensors>;
}) {
  const temFilhos = no.filhos.length > 0;
  const ehPastaVisual = no.eh_pasta || temFilhos;
  const pastaCompleta = temFilhos && no.filhos.every((f) => statusList.find((s) => s.id === f.status_id)?.cor === "verde");
  const aberto = pastasAbertas.has(no.id);
  const [criandoFilho, setCriandoFilho] = useState(false);
  const [nomeFilho, setNomeFilho] = useState("");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: no.id });
  const dragStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={{ marginLeft: nivel * 20, ...dragStyle }}>
      <div className="flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 h-6 w-4 flex items-center justify-center text-ink/25 hover:text-ink/60 cursor-grab active:cursor-grabbing touch-none"
          title="Arrastar pra reordenar"
        >
          <svg width="9" height="15" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2.5" cy="2.5" r="1.5" />
            <circle cx="7.5" cy="2.5" r="1.5" />
            <circle cx="2.5" cy="8" r="1.5" />
            <circle cx="7.5" cy="8" r="1.5" />
            <circle cx="2.5" cy="13.5" r="1.5" />
            <circle cx="7.5" cy="13.5" r="1.5" />
          </svg>
        </button>
        <button
          onClick={() => (temFilhos ? onTogglePasta(no.id) : ehPastaVisual ? setCriandoFilho(true) : onTogglePasta(no.id))}
          className={`h-5 w-5 shrink-0 rounded-md flex items-center justify-center text-ink/40 hover:bg-black/10 hover:text-ink text-[10px] ${!ehPastaVisual && "invisible"}`}
          title={temFilhos ? (aberto ? "Recolher" : "Expandir") : "Nenhuma subtarefa ainda"}
        >
          {temFilhos ? (aberto ? "▾" : "▸") : ""}
        </button>
        <div className="flex-1">
          <LinhaSubtarefaEditavel
            sub={no}
            comFilhos={ehPastaVisual}
            pastaCompleta={pastaCompleta}
            statusList={statusList}
            funcionariosComAcesso={funcionariosComAcesso}
            responsaveis={responsaveisPorSubtarefa[no.id] ?? []}
            onAbrir={() => (no.eh_pasta ? onTogglePasta(no.id) : onAbrir(no.id))}
            onSalvarNome={(v) => onSalvarNome(no.id, v)}
            onSalvarPrazo={(v) => onSalvarPrazo(no.id, v)}
            onSalvarStatus={(v) => onSalvarStatus(no.id, v)}
            onToggleResponsavel={(fid) => onToggleResponsavel(no.id, fid)}
          />
        </div>
        {ehPastaVisual && (
          <button
            onClick={() => setCriandoFilho(true)}
            className="shrink-0 h-6 w-6 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 flex items-center justify-center text-xs font-bold"
            title="Adicionar subtarefa dentro dessa pasta"
          >
            +
          </button>
        )}
      </div>
      {criandoFilho && (
        <div
          className="flex items-center gap-2 mt-1.5 p-2 rounded-xl bg-violet-50 border-2 border-violet-200"
          style={{ marginLeft: 24 }}
        >
          <input
            autoFocus
            value={nomeFilho}
            onChange={(e) => setNomeFilho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nomeFilho.trim()) {
                onAdicionarFilho(no.id, nomeFilho.trim(), false);
                setNomeFilho("");
                setCriandoFilho(false);
              }
              if (e.key === "Escape") setCriandoFilho(false);
            }}
            onBlur={() => {
              if (!nomeFilho.trim()) setCriandoFilho(false);
            }}
            className="input py-1.5 text-sm flex-1 bg-white"
            placeholder="Nome da subtarefa..."
          />
          <button
            onClick={() => {
              onAdicionarFilho(no.id, nomeFilho.trim() || "Nova subtarefa", false);
              setNomeFilho("");
              setCriandoFilho(false);
            }}
            className="shrink-0 rounded-full bg-forest text-white px-3 py-1.5 text-xs font-bold hover:brightness-110 transition"
          >
            + Subtarefa
          </button>
          <button
            onClick={() => {
              onAdicionarFilho(no.id, nomeFilho.trim() || "Nova pasta", true);
              setNomeFilho("");
              setCriandoFilho(false);
            }}
            className="shrink-0 rounded-full bg-violet-600 text-white px-3 py-1.5 text-xs font-bold hover:brightness-110 transition"
            title="Criar como pasta"
          >
            📁 Pasta
          </button>
        </div>
      )}
      {aberto && temFilhos && (
        <div className="mt-1 space-y-1">
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={(e: DragEndEvent) => {
              const { active, over } = e;
              if (!over || active.id === over.id) return;
              const indexAntigo = no.filhos.findIndex((f) => f.id === active.id);
              const indexNovo = no.filhos.findIndex((f) => f.id === over.id);
              if (indexAntigo === -1 || indexNovo === -1) return;
              onReordenar(no.id, indexAntigo, indexNovo);
            }}
          >
            <SortableContext items={no.filhos.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {no.filhos.map((filho) => (
                <NoSubtarefa
                  key={filho.id}
                  no={filho}
                  nivel={nivel + 1}
                  pastasAbertas={pastasAbertas}
                  onTogglePasta={onTogglePasta}
                  statusList={statusList}
                  funcionariosComAcesso={funcionariosComAcesso}
                  responsaveisPorSubtarefa={responsaveisPorSubtarefa}
                  onAbrir={onAbrir}
                  onSalvarNome={onSalvarNome}
                  onSalvarPrazo={onSalvarPrazo}
                  onSalvarStatus={onSalvarStatus}
                  onToggleResponsavel={onToggleResponsavel}
                  onAdicionarFilho={onAdicionarFilho}
                  onReordenar={onReordenar}
                  dndSensors={dndSensors}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function LinhaSubtarefaEditavel({
  sub,
  comFilhos,
  pastaCompleta,
  statusList,
  funcionariosComAcesso,
  responsaveis,
  onAbrir,
  onSalvarNome,
  onSalvarPrazo,
  onSalvarStatus,
  onToggleResponsavel,
}: {
  sub: Subtarefa;
  comFilhos?: boolean;
  pastaCompleta?: boolean;
  statusList: StatusItem[];
  funcionariosComAcesso: Responsavel[];
  responsaveis: Responsavel[];
  onAbrir: () => void;
  onSalvarNome: (v: string) => void;
  onSalvarPrazo: (v: string) => void;
  onSalvarStatus: (v: string) => void;
  onToggleResponsavel: (funcionarioId: string) => void;
}) {
  const [campoEditando, setCampoEditando] = useState<null | "nome" | "responsavel" | "prazo" | "status">(null);
  const [nomeTemp, setNomeTemp] = useState(sub.titulo);
  const statusSub = statusList.find((st) => st.id === sub.status_id);
  const atraso = diasAtraso(sub.prazo);

  if (sub.eh_pasta) {
    return (
      <div
        onClick={onAbrir}
        className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer transition-colors ${
          pastaCompleta ? "bg-emerald-50 hover:bg-emerald-100" : "bg-violet-50 hover:bg-violet-100"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`shrink-0 ${pastaCompleta ? "text-emerald-500" : "text-violet-500"}`}
        >
          <path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
        </svg>
        {campoEditando === "nome" ? (
          <input
            autoFocus
            value={nomeTemp}
            onChange={(e) => setNomeTemp(e.target.value)}
            onBlur={() => {
              if (nomeTemp.trim()) onSalvarNome(nomeTemp.trim());
              setCampoEditando(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onClick={(e) => e.stopPropagation()}
            className="input py-1 text-sm flex-1"
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCampoEditando("nome");
            }}
            className="text-sm font-bold text-violet-800 flex-1 text-left"
          >
            {sub.titulo}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => campoEditando === null && onAbrir()}
      className={`group/row w-full grid grid-cols-[1fr_110px_150px_110px] items-center gap-2 rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${
        pastaCompleta ? "bg-emerald-50 hover:bg-emerald-100" : "bg-surface hover:bg-surface/70"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {comFilhos ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`shrink-0 ${pastaCompleta ? "text-emerald-500" : "text-violet-500"}`}
          >
            <path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
          </svg>
        ) : (
          <span
            className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 ${corDoStatus(statusSub?.cor ?? "cinza").dot.replace("bg-", "border-")} ${
              statusSub?.cor === "verde" ? corDoStatus(statusSub.cor).dot : ""
            }`}
          />
        )}
        {campoEditando === "nome" ? (
          <input
            autoFocus
            value={nomeTemp}
            onChange={(e) => setNomeTemp(e.target.value)}
            onBlur={() => {
              if (nomeTemp.trim()) onSalvarNome(nomeTemp.trim());
              setCampoEditando(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setCampoEditando(null);
            }}
            className="input py-1 text-sm flex-1"
          />
        ) : (
          <>
            <span className="text-sm text-ink truncate flex-1">{sub.titulo}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCampoEditando("nome");
              }}
              className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs shrink-0"
              title="Editar nome"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
          </>
        )}
      </div>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {campoEditando === "responsavel" ? (
          <div className="absolute z-30 top-0 left-0 w-56 rounded-2xl bg-white border border-black/10 shadow-lg p-2.5" onMouseLeave={() => setCampoEditando(null)}>
            <div className="grid grid-cols-5 gap-2">
              {funcionariosComAcesso.map((f) => {
                const marcado = responsaveis.some((r) => r.id === f.id);
                return (
                  <button key={f.id} onClick={() => onToggleResponsavel(f.id)} className="relative" title={f.nome}>
                    <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={26} />
                    {marcado && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-forest text-white text-[8px] flex items-center justify-center ring-2 ring-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button onClick={() => setCampoEditando("responsavel")} className="flex items-center gap-1 group/resp">
            {responsaveis.length > 0 ? <AvatarStack pessoas={responsaveis} tamanho={20} /> : <span className="text-xs text-ink/30">—</span>}
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></span>
          </button>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        {campoEditando === "prazo" ? (
          <input
            autoFocus
            type="date"
            defaultValue={sub.prazo ?? ""}
            onBlur={(e) => {
              onSalvarPrazo(e.target.value);
              setCampoEditando(null);
            }}
            className="input py-1 text-xs"
          />
        ) : (
          <button onClick={() => setCampoEditando("prazo")} className="flex items-center gap-1">
            <span className={`text-xs ${atraso ? "text-red-600 font-bold" : "text-ink/50"}`}>
              {sub.prazo ? formatarDataCurta(sub.prazo) : "—"}
              {atraso && ` · ${atraso}d`}
            </span>
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></span>
          </button>
        )}
      </div>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {campoEditando === "status" ? (
          <div className="absolute z-30 top-0 left-0 w-48 rounded-2xl bg-white border border-black/10 shadow-lg p-1.5" onMouseLeave={() => setCampoEditando(null)}>
            {statusList.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSalvarStatus(s.id);
                  setCampoEditando(null);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-surface"
              >
                <span className={`h-2 w-2 rounded-full ${corDoStatus(s.cor).dot}`} />
                {s.nome}
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => setCampoEditando("status")} className="flex items-center gap-1">
            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 w-fit ${corDoStatus(statusSub?.cor ?? "cinza").cor}`}>
              {statusSub?.nome ?? "—"}
            </span>
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></span>
          </button>
        )}
      </div>
    </div>
  );
}

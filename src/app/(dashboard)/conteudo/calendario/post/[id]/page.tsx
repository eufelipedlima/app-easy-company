"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { corDoStatus } from "@/lib/status-conteudo";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BuscaCliente } from "@/components/busca-cliente";
import { Cronometro } from "@/components/cronometro";

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
  autor_id: string | null;
  texto: string;
  created_at: string;
  doCliente?: boolean;
}
interface HistoricoItem {
  id: string;
  autor_id: string | null;
  descricao: string;
  created_at: string;
}
interface Post {
  id: string;
  titulo: string | null;
  legenda: string | null;
  observacoes_internas: string | null;
  cliente_id: string;
  objetivo: string | null;
  formato: string | null;
  status_id: string;
  data_publicacao: string;
  data_inicio: string | null;
  hora_publicacao: string | null;
  post_pai_id: string | null;
  tempo_total_segundos: number;
  timer_iniciado_em: string | null;
  timer_iniciado_por: string | null;
}

interface SubConteudo {
  id: string;
  titulo: string | null;
  status_id: string;
  data_publicacao: string;
}
const OBJETIVO_CONFIG: Record<string, string> = {
  atracao: "Atração",
  educacao: "Educação",
  conversao: "Conversão",
  conexao: "Conexão",
  institucional: "Institucional",
  bastidores: "Bastidores",
};
const FORMATO_CONFIG: Record<string, string> = { estatico: "Estático", carrossel: "Carrossel", video: "Vídeo" };

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
    return <img src={fotoUrl} alt={nome} className="rounded-full object-cover shrink-0 ring-2 ring-white" style={{ height: tamanho, width: tamanho }} />;
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

function formatarDataCurta(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function renderizarTexto(texto: string, todosOsNomes: string[]) {
  if (todosOsNomes.length === 0) return texto;
  const nomesEscapados = [...todosOsNomes].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regexMencao = new RegExp(`@(${nomesEscapados.join("|")})`, "g");
  const partes = texto.split(regexMencao);
  return partes.map((p, i) =>
    todosOsNomes.includes(p) ? (
      <span key={i} className="text-forest font-semibold bg-mint rounded px-1">
        @{p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function PostDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [post, setPost] = useState<Post | null>(null);
  const [statusList, setStatusList] = useState<StatusItem[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [funcionariosComAcesso, setFuncionariosComAcesso] = useState<Responsavel[]>([]);
  const [colegas, setColegas] = useState<Opcao[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [meuNome, setMeuNome] = useState("Você");
  const [meuFotoUrl, setMeuFotoUrl] = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [seletorResponsavelAberto, setSeletorResponsavelAberto] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusAberto, setStatusAberto] = useState(false);
  const [abaLateral, setAbaLateral] = useState<"comentarios" | "historico">("comentarios");
  const [painelRecolhido, setPainelRecolhido] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Opcao | null>(null);
  const [objetivo, setObjetivo] = useState("");
  const [formato, setFormato] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataPublicacao, setDataPublicacao] = useState("");
  const [horaPublicacao, setHoraPublicacao] = useState("");

  const [tituloPostPai, setTituloPostPai] = useState<string | null>(null);
  const [subConteudos, setSubConteudos] = useState<SubConteudo[]>([]);
  const [responsaveisPorSub, setResponsaveisPorSub] = useState<Record<string, Responsavel[]>>({});
  const [novoSubConteudo, setNovoSubConteudo] = useState("");
  const [criandoSub, setCriandoSub] = useState(false);

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

    const [{ data: p }, { data: statusData }, { data: clientesData }, { data: funcData }] = await Promise.all([
      supabase.from("posts_conteudo").select("*").eq("id", id).maybeSingle(),
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

    if (p) {
      setPost(p);
      setTitulo(p.titulo ?? "");
      setObservacoes(p.observacoes_internas ?? "");
      setClienteSelecionado(listaClientes.find((c) => c.id === p.cliente_id) ?? null);
      setObjetivo(p.objetivo ?? "");
      setFormato(p.formato ?? "");
      setDataInicio(p.data_inicio ?? "");
      setDataPublicacao(p.data_publicacao ?? "");
      setHoraPublicacao(p.hora_publicacao ?? "");

      if (p.post_pai_id) {
        const { data: pai } = await supabase.from("posts_conteudo").select("titulo").eq("id", p.post_pai_id).maybeSingle();
        setTituloPostPai(pai?.titulo ?? null);
      } else {
        setTituloPostPai(null);
      }
    }
    setLoading(false);
  }, [id]);

  const carregarSubConteudos = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("posts_conteudo")
      .select("id, titulo, status_id, data_publicacao")
      .eq("post_pai_id", id)
      .order("data_publicacao");
    const lista = data ?? [];
    setSubConteudos(lista);

    const ids = lista.map((s) => s.id);
    if (ids.length > 0) {
      const { data: respData } = await supabase
        .from("posts_conteudo_responsaveis")
        .select("post_id, funcionarios ( id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
        .in("post_id", ids);
      const mapa: Record<string, Responsavel[]> = {};
      for (const r of (respData ?? []) as unknown as {
        post_id: string;
        funcionarios: { id: string; papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null } | null;
      }[]) {
        if (!r.funcionarios) continue;
        const pessoa = r.funcionarios.papeis?.pessoas;
        const resp: Responsavel = {
          id: r.funcionarios.id,
          nome: pessoa?.apelido || pessoa?.nome || "Colega",
          fotoUrl: pessoa?.foto_url ?? null,
          authUserId: null,
        };
        if (!mapa[r.post_id]) mapa[r.post_id] = [];
        mapa[r.post_id].push(resp);
      }
      setResponsaveisPorSub(mapa);
    } else {
      setResponsaveisPorSub({});
    }
  }, [id]);

  useEffect(() => {
    carregarTudo();
    carregarSubConteudos();
  }, [carregarTudo, carregarSubConteudos]);

  const carregarResponsaveis = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("posts_conteudo_responsaveis")
      .select("funcionarios ( id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) ) )")
      .eq("post_id", id);
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

  const carregarComentarios = useCallback(async () => {
    const supabase = createClient();
    const [{ data: internos }, { data: doCliente }] = await Promise.all([
      supabase.from("posts_conteudo_comentarios_internos").select("id, autor_id, texto, created_at").eq("post_id", id).order("created_at"),
      supabase.from("posts_conteudo_comentarios").select("id, texto, created_at, autor").eq("post_id", id).order("created_at"),
    ]);
    const listaInternos: Comentario[] = (internos ?? []).map((c) => ({ ...c, doCliente: false }));
    const listaCliente: Comentario[] = ((doCliente ?? []) as { id: string; texto: string; created_at: string; autor: string }[]).map((c) => ({
      id: `cliente-${c.id}`,
      autor_id: null,
      texto: c.texto,
      created_at: c.created_at,
      doCliente: c.autor === "cliente",
    }));
    const todos = [...listaInternos, ...listaCliente].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    setComentarios(todos);
  }, [id]);

  const carregarHistorico = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("posts_conteudo_historico")
      .select("id, autor_id, descricao, created_at")
      .eq("post_id", id)
      .order("created_at", { ascending: false });
    setHistorico(data ?? []);
  }, [id]);

  useEffect(() => {
    carregarResponsaveis();
    carregarComentarios();
    carregarHistorico();
  }, [carregarResponsaveis, carregarComentarios, carregarHistorico]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`post-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts_conteudo_comentarios_internos", filter: `post_id=eq.${id}` },
        () => carregarComentarios()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts_conteudo_comentarios", filter: `post_id=eq.${id}` },
        () => carregarComentarios()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, carregarComentarios]);

  async function registrarHistorico(descricaoEvento: string) {
    const supabase = createClient();
    await supabase.from("posts_conteudo_historico").insert({ post_id: id, autor_id: meuId, descricao: descricaoEvento });
    setHistorico((atual) => [
      { id: `temp-${Date.now()}`, autor_id: meuId, descricao: descricaoEvento, created_at: new Date().toISOString() },
      ...atual,
    ]);

    const destinatarios = responsaveis.filter((r) => r.authUserId && r.authUserId !== meuId).map((r) => r.authUserId!);
    if (destinatarios.length > 0) {
      await supabase.from("notificacoes").insert(
        destinatarios.map((destId) => ({
          destinatario_id: destId,
          tipo: "mudanca_conteudo",
          titulo: `${meuNome} ${descricaoEvento} num conteúdo seu`,
          descricao: post?.titulo ?? null,
          link: `/conteudo/calendario/post/${id}`,
          autor_id: meuId,
          autor_nome: meuNome,
          autor_foto_url: meuFotoUrl,
        }))
      );
    }
  }

  async function salvarCampo(campo: Record<string, string | null>, eventoHistorico?: string) {
    const supabase = createClient();
    await supabase.from("posts_conteudo").update(campo).eq("id", id);
    if (eventoHistorico) registrarHistorico(eventoHistorico);
  }

  async function iniciarCronometro() {
    const supabase = createClient();
    const agora = new Date().toISOString();
    await supabase.from("posts_conteudo").update({ timer_iniciado_em: agora, timer_iniciado_por: meuId }).eq("id", id);
    setPost((p) => (p ? { ...p, timer_iniciado_em: agora, timer_iniciado_por: meuId } : p));
    registrarHistorico("iniciou o cronômetro");
  }

  async function pausarCronometro() {
    if (!post?.timer_iniciado_em) return;
    const segundosCorridos = Math.floor((Date.now() - new Date(post.timer_iniciado_em).getTime()) / 1000);
    const novoTotal = post.tempo_total_segundos + segundosCorridos;
    const supabase = createClient();
    await supabase.from("posts_conteudo").update({ tempo_total_segundos: novoTotal, timer_iniciado_em: null, timer_iniciado_por: null }).eq("id", id);
    setPost((p) => (p ? { ...p, tempo_total_segundos: novoTotal, timer_iniciado_em: null, timer_iniciado_por: null } : p));
    const minutos = Math.round(segundosCorridos / 60);
    registrarHistorico(`pausou o cronômetro (+${minutos < 1 ? "menos de 1" : minutos}min)`);
  }

  async function toggleResponsavel(funcionarioId: string) {
    const supabase = createClient();
    const pessoa = funcionariosComAcesso.find((f) => f.id === funcionarioId);
    const jaTem = responsaveis.some((r) => r.id === funcionarioId);
    if (jaTem) {
      setResponsaveis((atual) => atual.filter((r) => r.id !== funcionarioId));
      await supabase.from("posts_conteudo_responsaveis").delete().eq("post_id", id).eq("funcionario_id", funcionarioId);
      if (pessoa) registrarHistorico(`removeu ${pessoa.nome} dos responsáveis`);
    } else {
      if (pessoa) setResponsaveis((atual) => [...atual, pessoa]);
      await supabase.from("posts_conteudo_responsaveis").insert({ post_id: id, funcionario_id: funcionarioId });
      if (pessoa) registrarHistorico(`atribuiu ${pessoa.nome} como responsável`);
      if (pessoa?.authUserId && pessoa.authUserId !== meuId) {
        await supabase.from("notificacoes").insert({
          destinatario_id: pessoa.authUserId,
          tipo: "atribuicao_conteudo",
          titulo: `${meuNome} te atribuiu a um conteúdo`,
          descricao: post?.titulo ?? null,
          link: `/conteudo/calendario/post/${id}`,
          autor_id: meuId,
          autor_nome: meuNome,
          autor_foto_url: meuFotoUrl,
        });
      }
    }
  }

  async function adicionarSubConteudo() {
    if (!novoSubConteudo.trim() || !post) return;
    setCriandoSub(true);
    const supabase = createClient();
    await supabase.from("posts_conteudo").insert({
      titulo: novoSubConteudo.trim(),
      post_pai_id: id,
      cliente_id: post.cliente_id,
      data_publicacao: post.data_publicacao,
      status_id: statusList[0]?.id,
    });
    setNovoSubConteudo("");
    setCriandoSub(false);
    carregarSubConteudos();
    registrarHistorico(`adicionou o sub-conteúdo "${novoSubConteudo.trim()}"`);
  }

  async function salvarCampoSub(subId: string, campo: Record<string, string | null>) {
    setSubConteudos((atual) => atual.map((s) => (s.id === subId ? { ...s, ...campo } : s)));
    const supabase = createClient();
    await supabase.from("posts_conteudo").update(campo).eq("id", subId);
  }

  async function toggleResponsavelSub(subId: string, funcionarioId: string) {
    const supabase = createClient();
    const atuais = responsaveisPorSub[subId] ?? [];
    const jaTem = atuais.some((r) => r.id === funcionarioId);
    if (jaTem) {
      setResponsaveisPorSub((atual) => ({ ...atual, [subId]: atuais.filter((r) => r.id !== funcionarioId) }));
      await supabase.from("posts_conteudo_responsaveis").delete().eq("post_id", subId).eq("funcionario_id", funcionarioId);
    } else {
      const pessoa = funcionariosComAcesso.find((f) => f.id === funcionarioId);
      if (pessoa) setResponsaveisPorSub((atual) => ({ ...atual, [subId]: [...atuais, pessoa] }));
      await supabase.from("posts_conteudo_responsaveis").insert({ post_id: subId, funcionario_id: funcionarioId });
      if (pessoa?.authUserId) {
        await supabase.from("notificacoes").insert({
          destinatario_id: pessoa.authUserId,
          tipo: "atribuicao_conteudo",
          titulo: `${meuNome} te atribuiu a um sub-conteúdo`,
          descricao: subConteudos.find((s) => s.id === subId)?.titulo ?? null,
          link: `/conteudo/calendario/post/${subId}`,
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

  async function enviarComentario() {
    if (!novoComentario.trim() || !meuId) return;
    setEnviandoComentario(true);
    const supabase = createClient();
    const texto = novoComentario.trim();
    const { error } = await supabase.from("posts_conteudo_comentarios_internos").insert({ post_id: id, autor_id: meuId, texto });
    if (!error) {
      setNovoComentario("");
      const mencionados = colegas.filter((c) => texto.includes(`@${c.nome}`));
      if (mencionados.length > 0) {
        await supabase.from("notificacoes").insert(
          mencionados
            .map((c) => ({
              destinatario_id: funcionariosComAcesso.find((f) => f.id === c.id)?.authUserId ?? null,
              tipo: "mencao_conteudo",
              titulo: `${meuNome} te mencionou num conteúdo`,
              descricao: post?.titulo || texto.slice(0, 120),
              link: `/conteudo/calendario/post/${id}`,
              autor_id: meuId,
              autor_nome: meuNome,
              autor_foto_url: meuFotoUrl,
            }))
            .filter((n) => n.destinatario_id)
        );
      }
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

  const colegasParaMencao = colegas.filter((c) => mencaoBusca !== null && normalizar(c.nome).includes(normalizar(mencaoBusca)));
  const todosOsNomes = [meuNome, ...colegas.map((c) => c.nome)];
  const statusAtual = statusList.find((s) => s.id === post?.status_id);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink/50">Conteúdo não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-surface/30">
      <div className="px-8 py-4 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/conteudo/calendario")}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors"
          >
            ← Calendário de Conteúdo
          </button>
          {tituloPostPai && post.post_pai_id && (
            <>
              <span className="text-ink/20">/</span>
              <button
                onClick={() => router.push(`/conteudo/calendario/post/${post.post_pai_id}`)}
                className="text-sm font-semibold text-forest hover:text-ink truncate max-w-xs"
              >
                {tituloPostPai}
              </button>
            </>
          )}
        </div>
        <Cronometro
          tempoTotalSegundos={post.tempo_total_segundos}
          timerIniciadoEm={post.timer_iniciado_em}
          nomeQuemIniciou={post.timer_iniciado_por ? nomeDoAutor(post.timer_iniciado_por) : null}
          souEuQuemIniciou={post.timer_iniciado_por === meuId}
          onIniciar={iniciarCronometro}
          onPausar={pausarCronometro}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => {
              if (titulo.trim() !== (post.titulo ?? "")) salvarCampo({ titulo: titulo.trim() || null }, `renomeou para "${titulo.trim()}"`);
            }}
            placeholder="Título do post..."
            className="text-2xl font-extrabold text-ink w-full mb-5 outline-none focus:bg-white rounded-lg px-1 -mx-1 bg-transparent"
          />

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6 rounded-2xl bg-white p-4 shadow-sm">
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
                          setPost((p) => (p ? { ...p, status_id: s.id } : p));
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
                  if (!c) return;
                  setClienteSelecionado(c);
                  salvarCampo({ cliente_id: c.id }, `mudou o cliente para ${c.nome}`);
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
              <span className="block text-xs text-ink/50 mb-1">Formato</span>
              <select
                value={formato}
                onChange={(e) => {
                  setFormato(e.target.value);
                  salvarCampo({ formato: e.target.value || null }, `mudou o formato para "${FORMATO_CONFIG[e.target.value] ?? "nenhum"}"`);
                }}
                className="input"
              >
                <option value="">Nenhum</option>
                {Object.entries(FORMATO_CONFIG).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Objetivo</span>
              <select
                value={objetivo}
                onChange={(e) => {
                  setObjetivo(e.target.value);
                  salvarCampo({ objetivo: e.target.value || null }, `mudou o objetivo para "${OBJETIVO_CONFIG[e.target.value] ?? "nenhum"}"`);
                }}
                className="input"
              >
                <option value="">Nenhum</option>
                {Object.entries(OBJETIVO_CONFIG).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs text-ink/50 mb-1">Início (produção)</span>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs text-ink/50 mb-1">Publicação</span>
                <input
                  type="date"
                  value={dataPublicacao}
                  onChange={(e) => {
                    setDataPublicacao(e.target.value);
                    salvarCampo({ data_publicacao: e.target.value }, "mudou a data de publicação");
                  }}
                  className="input"
                />
              </div>
              <div>
                <span className="block text-xs text-ink/50 mb-1">Hora</span>
                <input
                  type="time"
                  value={horaPublicacao}
                  onChange={(e) => {
                    setHoraPublicacao(e.target.value);
                    salvarCampo({ hora_publicacao: e.target.value || null }, "mudou o horário de publicação");
                  }}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-sm font-bold text-ink mb-2">Observações internas</span>
            <RichTextEditor
              valorHtml={observacoes}
              onChange={setObservacoes}
              onSalvar={() => salvarCampo({ observacoes_internas: observacoes || null }, "atualizou as observações internas")}
              placeholder="Anotações da equipe sobre esse conteúdo..."
            />
            <p className="text-xs text-ink/40 mt-2">
              A legenda que o cliente vê continua sendo editada no formulário rápido do calendário.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-sm font-bold text-ink mb-2">Sub-conteúdos</span>
            <p className="text-xs text-ink/40 mb-3">
              Use isso pra agrupar vários posts dentro de um "pacote" — por exemplo, um post "Conteúdo de Setembro" com um sub-conteúdo pra cada publicação do mês.
            </p>
            {subConteudos.length > 0 && (
              <div className="grid grid-cols-[1fr_110px_90px_110px] gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink/40">
                <span>Nome</span>
                <span>Responsáveis</span>
                <span>Data</span>
                <span>Status</span>
              </div>
            )}
            <div className="space-y-1.5 mb-2">
              {subConteudos.map((s) => (
                <LinhaSubConteudoEditavel
                  key={s.id}
                  sub={s}
                  statusList={statusList}
                  funcionariosComAcesso={funcionariosComAcesso}
                  responsaveis={responsaveisPorSub[s.id] ?? []}
                  onAbrir={() => router.push(`/conteudo/calendario/post/${s.id}`)}
                  onSalvarNome={(novoNome) => salvarCampoSub(s.id, { titulo: novoNome })}
                  onSalvarData={(novaData) => salvarCampoSub(s.id, { data_publicacao: novaData })}
                  onSalvarStatus={(novoStatusId) => salvarCampoSub(s.id, { status_id: novoStatusId })}
                  onToggleResponsavel={(funcionarioId) => toggleResponsavelSub(s.id, funcionarioId)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={novoSubConteudo}
                onChange={(e) => setNovoSubConteudo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarSubConteudo();
                  }
                }}
                className="input text-sm"
                placeholder="Nome do sub-conteúdo..."
              />
              <button
                onClick={adicionarSubConteudo}
                disabled={criandoSub}
                className="shrink-0 text-sm font-semibold text-forest hover:text-ink disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
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
                      const nome = c.doCliente ? "Cliente" : nomeDoAutor(c.autor_id!);
                      const fotoAutor = c.doCliente ? null : funcionariosComAcesso.find((f) => f.authUserId === c.autor_id)?.fotoUrl ?? null;
                      return (
                        <div key={c.id} className="flex items-start gap-2.5">
                          {c.doCliente ? (
                            <div className="h-[30px] w-[30px] rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0 ring-2 ring-white">
                              👤
                            </div>
                          ) : (
                            <Avatar nome={nome} fotoUrl={fotoAutor} tamanho={30} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className={`text-sm font-bold ${c.doCliente ? "text-amber-700" : "text-ink"}`}>{nome}</span>
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

function LinhaSubConteudoEditavel({
  sub,
  statusList,
  funcionariosComAcesso,
  responsaveis,
  onAbrir,
  onSalvarNome,
  onSalvarData,
  onSalvarStatus,
  onToggleResponsavel,
}: {
  sub: SubConteudo;
  statusList: StatusItem[];
  funcionariosComAcesso: Responsavel[];
  responsaveis: Responsavel[];
  onAbrir: () => void;
  onSalvarNome: (v: string) => void;
  onSalvarData: (v: string) => void;
  onSalvarStatus: (v: string) => void;
  onToggleResponsavel: (funcionarioId: string) => void;
}) {
  const [campoEditando, setCampoEditando] = useState<null | "nome" | "responsavel" | "data" | "status">(null);
  const [nomeTemp, setNomeTemp] = useState(sub.titulo ?? "");
  const statusSub = statusList.find((st) => st.id === sub.status_id);

  return (
    <div
      onClick={() => campoEditando === null && onAbrir()}
      className="group/row w-full grid grid-cols-[1fr_110px_90px_110px] items-center gap-2 rounded-xl bg-surface px-3 py-2.5 hover:bg-surface/70 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
        <span className={`h-2 w-2 rounded-full shrink-0 ${corDoStatus(statusSub?.cor ?? "cinza").dot}`} />
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
            <span className="text-sm text-ink truncate flex-1">{sub.titulo || "Sem título"}</span>
            <button
              onClick={() => setCampoEditando("nome")}
              className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs shrink-0"
              title="Editar nome"
            >
              ✏️
            </button>
          </>
        )}
      </div>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {campoEditando === "responsavel" ? (
          <div
            className="absolute z-30 top-0 left-0 w-56 rounded-2xl bg-white border border-black/10 shadow-lg p-2.5"
            onMouseLeave={() => setCampoEditando(null)}
          >
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
          <button onClick={() => setCampoEditando("responsavel")} className="flex items-center gap-1">
            {responsaveis.length > 0 ? <AvatarStack pessoas={responsaveis} tamanho={20} /> : <span className="text-xs text-ink/30">—</span>}
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs">✏️</span>
          </button>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        {campoEditando === "data" ? (
          <input
            autoFocus
            type="date"
            defaultValue={sub.data_publicacao}
            onBlur={(e) => {
              if (e.target.value) onSalvarData(e.target.value);
              setCampoEditando(null);
            }}
            className="input py-1 text-xs"
          />
        ) : (
          <button onClick={() => setCampoEditando("data")} className="flex items-center gap-1">
            <span className="text-xs text-ink/50">{formatarDataCurta(sub.data_publicacao)}</span>
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs">✏️</span>
          </button>
        )}
      </div>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {campoEditando === "status" ? (
          <div
            className="absolute z-30 top-0 left-0 w-48 rounded-2xl bg-white border border-black/10 shadow-lg p-1.5"
            onMouseLeave={() => setCampoEditando(null)}
          >
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
            <span className="opacity-0 group-hover/row:opacity-100 text-ink/30 hover:text-ink text-xs">✏️</span>
          </button>
        )}
      </div>
    </div>
  );
}

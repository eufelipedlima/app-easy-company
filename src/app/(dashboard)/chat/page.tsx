"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { sanearNomeArquivo } from "@/lib/nome-arquivo";
import { normalizar } from "@/lib/normalizar";

interface Canal {
  id: string;
  tipo: "dm" | "grupo" | "cliente";
  nome: string | null;
  descricao: string | null;
  cliente_id: string | null;
  criado_por: string;
}

interface CanalComInfo extends Canal {
  nomeExibicao: string;
  subtitulo: string | null;
  fotoUrl: string | null;
  ultimaMensagem: string | null;
  ultimaMensagemHora: string | null;
  naoLidas: number;
}

interface Reacao {
  id: string;
  mensagem_id: string;
  autor_id: string;
  emoji: string;
}

interface Mensagem {
  id: string;
  canal_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
  resposta_a_id: string | null;
  audio_url: string | null;
  audio_duracao: number | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  arquivo_tamanho: number | null;
}

interface Colega {
  authUserId: string;
  nome: string;
  cargo: string | null;
  fotoUrl: string | null;
}

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "🥳",
  "👍", "👏", "🙌", "🔥", "✨", "💥", "💪", "🙏", "❤️", "💛",
  "💚", "💙", "💜", "⭐", "🎉", "🎯", "📈", "✅", "❗", "❓",
];

const REACOES_RAPIDAS = ["👍", "❤️", "😂", "🎉", "✅", "👀"];

function tocarSom() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // navegador sem suporte a áudio — silencioso, sem quebrar o chat
  }
}

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarDiaSeparador(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  if (data.toDateString() === hoje.toDateString()) return "Hoje";
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
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

function Avatar({ nome, fotoUrl, tamanho = 36 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
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
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center text-xs font-bold shrink-0 ring-2 ring-white`}
      style={{ height: tamanho, width: tamanho }}
    >
      {iniciais(nome)}
    </div>
  );
}

function formatarDuracao(segundos: number) {
  const min = Math.floor(segundos / 60);
  const seg = Math.floor(segundos % 60);
  return `${min}:${String(seg).padStart(2, "0")}`;
}

function formatarTamanhoArquivo(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CardArquivoChat({
  url,
  nome,
  tipo,
  tamanho,
}: {
  url: string;
  nome: string | null;
  tipo: string | null;
  tamanho: number | null;
}) {
  const ehImagem = tipo?.startsWith("image/");

  if (ehImagem) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block max-w-xs rounded-2xl overflow-hidden border border-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={nome ?? "imagem"} className="w-full max-h-64 object-cover" />
      </a>
    );
  }

  const ehPdf = tipo === "application/pdf";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white border border-black/10 px-3 py-2.5 max-w-xs">
      <span className={`h-10 w-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0 ${ehPdf ? "bg-red-500" : "bg-ink/70"}`}>
        {ehPdf ? "PDF" : "📄"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink truncate">{nome ?? "arquivo"}</p>
        <p className="text-xs text-ink/40">{formatarTamanhoArquivo(tamanho)}</p>
      </div>
      <a
        href={url}
        download={nome ?? undefined}
        title="Baixar"
        className="h-8 w-8 rounded-full flex items-center justify-center text-ink/40 hover:text-ink hover:bg-surface transition-colors shrink-0"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>
    </div>
  );
}

function PlayerAudio({ url, duracao }: { url: string; duracao: number | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [duracaoReal, setDuracaoReal] = useState(duracao ?? 0);
  const [velocidade, setVelocidade] = useState(1);
  const VELOCIDADES = [1, 1.25, 1.5, 2];

  function alternarPlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (tocando) {
      audio.pause();
    } else {
      audio.play();
    }
  }

  function alternarVelocidade() {
    const idxAtual = VELOCIDADES.indexOf(velocidade);
    const proxima = VELOCIDADES[(idxAtual + 1) % VELOCIDADES.length];
    setVelocidade(proxima);
    if (audioRef.current) audioRef.current.playbackRate = proxima;
  }

  return (
    <div className="flex items-center gap-2.5 bg-surface rounded-full pl-1 pr-2 py-1 w-72 max-w-full">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => setTocando(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d)) setDuracaoReal(d);
        }}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (audio.duration) setProgresso(audio.currentTime / audio.duration);
        }}
        className="hidden"
      />
      <button
        onClick={alternarPlay}
        className="h-8 w-8 rounded-full bg-forest text-white flex items-center justify-center shrink-0 hover:brightness-110 transition-colors"
      >
        {tocando ? "❚❚" : "▶"}
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div className="h-full bg-forest rounded-full transition-all" style={{ width: `${progresso * 100}%` }} />
      </div>
      <span className="text-[11px] text-ink/40 shrink-0 tabular-nums">{formatarDuracao(duracaoReal)}</span>
      <button
        onClick={alternarVelocidade}
        className="shrink-0 text-[10px] font-bold text-ink/50 hover:text-ink bg-white rounded-full h-6 px-1.5 border border-black/10"
        title="Velocidade de reprodução"
      >
        {velocidade}x
      </button>
    </div>
  );
}

function renderizarMensagem(texto: string, todosOsNomes: string[]) {
  if (texto.trim() === "---") {
    return <hr className="border-t border-current/20 my-1" />;
  }
  const partesFormatadas = texto.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return partesFormatadas.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>;
    }
    if (parte.startsWith("_") && parte.endsWith("_") && parte.length > 2) {
      return <em key={i}>{parte.slice(1, -1)}</em>;
    }
    if (todosOsNomes.length === 0) return <span key={i}>{parte}</span>;
    const nomesEscapados = [...todosOsNomes]
      .sort((a, b) => b.length - a.length)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regexMencao = new RegExp(`@(${nomesEscapados.join("|")})`, "g");
    const subPartes = parte.split(regexMencao);
    return subPartes.map((sub, j) =>
      todosOsNomes.includes(sub) ? (
        <span key={`${i}-${j}`} className="text-forest font-semibold bg-mint rounded px-1">
          @{sub}
        </span>
      ) : (
        <span key={`${i}-${j}`}>{sub}</span>
      )
    );
  });
}

export default function ChatPage() {
  const [meuId, setMeuId] = useState<string | null>(null);
  const [meuNome, setMeuNome] = useState<string>("Você");
  const [souAdmin, setSouAdmin] = useState(false);
  const [meuFotoUrl, setMeuFotoUrl] = useState<string | null>(null);
  const [canais, setCanais] = useState<CanalComInfo[]>([]);
  const [canalAtivoId, setCanalAtivoId] = useState<string | null>(null);
  const [qtdParticipantesAtivo, setQtdParticipantesAtivo] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [reacoes, setReacoes] = useState<Reacao[]>([]);
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerGravacaoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [novaConversaAberta, setNovaConversaAberta] = useState(false);
  const [adicionarParticipanteAberto, setAdicionarParticipanteAberto] = useState(false);
  const [configCanalAberto, setConfigCanalAberto] = useState(false);
  const [mostrarEmoji, setMostrarEmoji] = useState(false);
  const [mencaoBusca, setMencaoBusca] = useState<string | null>(null);
  const [buscaConversa, setBuscaConversa] = useState("");
  const [filtroConversa, setFiltroConversa] = useState<"tudo" | "nao_lidas" | "canais" | "pessoas">("tudo");
  const [respondendoA, setRespondendoA] = useState<Mensagem | null>(null);
  const [mensagemComMenu, setMensagemComMenu] = useState<string | null>(null);
  const [seletorReacaoAberto, setSeletorReacaoAberto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canalAtivo = canais.find((c) => c.id === canalAtivoId) ?? null;
  const canalAtivoIdRef = useRef<string | null>(null);
  useEffect(() => {
    canalAtivoIdRef.current = canalAtivoId;
  }, [canalAtivoId]);

  const nomeDoParticipante = useCallback(
    (authUserId: string) => (authUserId === meuId ? meuNome : colegas.find((c) => c.authUserId === authUserId)?.nome ?? "Alguém"),
    [colegas, meuId, meuNome]
  );

  const cargoDoParticipante = useCallback(
    (authUserId: string) => colegas.find((c) => c.authUserId === authUserId)?.cargo ?? null,
    [colegas]
  );

  const fotoDoParticipante = useCallback(
    (authUserId: string) => (authUserId === meuId ? meuFotoUrl : colegas.find((c) => c.authUserId === authUserId)?.fotoUrl ?? null),
    [colegas, meuId, meuFotoUrl]
  );

  const carregarCanais = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setMeuId(user.id);
    const { data: perfilData } = await supabase
      .from("funcionarios")
      .select("perfis_acesso ( nome )")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const nomePerfil = (perfilData as unknown as { perfis_acesso: { nome: string } | null } | null)?.perfis_acesso?.nome;
    setSouAdmin(nomePerfil === "Administrador");

    const { data: participacoes } = await supabase
      .from("chat_participantes")
      .select("canal_id, ultima_leitura, chat_canais ( id, tipo, nome, descricao, cliente_id, criado_por )")
      .eq("auth_user_id", user.id)
      .eq("arquivado", false);

    const lista = (participacoes ?? []).map((p) => p.chat_canais).filter(Boolean) as unknown as Canal[];
    const leituraPorCanal = new Map((participacoes ?? []).map((p) => [p.canal_id, p.ultima_leitura as string]));

    const idsClientes = lista.filter((c) => c.tipo === "cliente" && c.cliente_id).map((c) => c.cliente_id!) as string[];
    let nomesClientes = new Map<string, string>();
    if (idsClientes.length > 0) {
      const { data: clientesData } = await supabase
        .from("clientes")
        .select("id, papeis ( pessoas ( nome ) )")
        .in("id", idsClientes);
      nomesClientes = new Map(
        ((clientesData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[]).map((c) => [
          c.id,
          c.papeis?.pessoas?.nome ?? "Cliente",
        ])
      );
    }

    const idsDm = lista.filter((c) => c.tipo === "dm").map((c) => c.id);
    const outroParticipantePorCanal = new Map<string, string>();
    if (idsDm.length > 0) {
      const { data: todosParticipantes } = await supabase
        .from("chat_participantes")
        .select("canal_id, auth_user_id")
        .in("canal_id", idsDm);
      for (const p of todosParticipantes ?? []) {
        if (p.auth_user_id !== user.id) outroParticipantePorCanal.set(p.canal_id, p.auth_user_id);
      }
    }

    // Nomes/apelidos/cargos de todos os funcionários com acesso
    const { data: func } = await supabase
      .from("funcionarios")
      .select("auth_user_id, cargo, cargos ( nome ), papeis ( pessoas ( nome, apelido, foto_url ) )")
      .not("auth_user_id", "is", null);
    const todosComNome = ((func ?? []) as unknown as {
      auth_user_id: string;
      cargo: string | null;
      cargos: { nome: string } | null;
      papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
    }[]).map((f) => ({
      authUserId: f.auth_user_id,
      nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega",
      cargo: f.cargos?.nome ?? f.cargo ?? null,
      fotoUrl: f.papeis?.pessoas?.foto_url ?? null,
    }));
    const listaColegas = todosComNome.filter((c) => c.authUserId !== user.id);
    setColegas(listaColegas);
    setMeuNome(todosComNome.find((c) => c.authUserId === user.id)?.nome ?? "Você");
    setMeuFotoUrl(todosComNome.find((c) => c.authUserId === user.id)?.fotoUrl ?? null);

    const canaisComInfo: CanalComInfo[] = await Promise.all(
      lista.map(async (c) => {
        const { data: ultimasMsgs } = await supabase
          .from("chat_mensagens")
          .select("texto, created_at, audio_url, arquivo_url, arquivo_nome")
          .eq("canal_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const ultima = ultimasMsgs?.[0];
        const previaUltima = ultima?.audio_url ? "🎤 Áudio" : ultima?.arquivo_url ? `📎 ${ultima.arquivo_nome ?? "Arquivo"}` : ultima?.texto ?? null;

        const minhaLeitura = leituraPorCanal.get(c.id) ?? new Date(0).toISOString();
        const { count } = await supabase
          .from("chat_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("canal_id", c.id)
          .gt("created_at", minhaLeitura)
          .neq("autor_id", user.id);

        let nomeExibicao = c.nome ?? "";
        let subtitulo: string | null = null;
        let fotoUrl: string | null = null;
        if (c.tipo === "dm") {
          const outroId = outroParticipantePorCanal.get(c.id);
          const colega = outroId ? listaColegas.find((cl) => cl.authUserId === outroId) : null;
          nomeExibicao = colega?.nome ?? "Colega";
          subtitulo = colega?.cargo ?? null;
          fotoUrl = colega?.fotoUrl ?? null;
        } else if (c.tipo === "cliente") {
          nomeExibicao = (c.cliente_id && nomesClientes.get(c.cliente_id)) || c.nome || "Cliente";
          subtitulo = c.descricao ?? null;
        } else {
          subtitulo = c.descricao ?? null;
        }

        return {
          ...c,
          nomeExibicao,
          subtitulo,
          fotoUrl,
          ultimaMensagem: previaUltima,
          ultimaMensagemHora: ultima?.created_at ?? null,
          naoLidas: count ?? 0,
        };
      })
    );

    canaisComInfo.sort((a, b) => {
      const da = a.ultimaMensagemHora ? new Date(a.ultimaMensagemHora).getTime() : 0;
      const db = b.ultimaMensagemHora ? new Date(b.ultimaMensagemHora).getTime() : 0;
      return db - da;
    });

    setCanais(canaisComInfo);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarCanais();
  }, [carregarCanais]);

  useEffect(() => {
    if (canais.length === 0 || typeof window === "undefined") return;
    const canalId = new URLSearchParams(window.location.search).get("canal");
    if (canalId && canais.some((c) => c.id === canalId)) {
      abrirCanal(canalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canais.length]);

  useEffect(() => {
    async function carregarQtdParticipantes() {
      if (!canalAtivoId || canalAtivo?.tipo === "dm") {
        setQtdParticipantesAtivo(null);
        return;
      }
      const supabase = createClient();
      const { count } = await supabase
        .from("chat_participantes")
        .select("id", { count: "exact", head: true })
        .eq("canal_id", canalAtivoId);
      setQtdParticipantesAtivo(count ?? 0);
    }
    carregarQtdParticipantes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalAtivoId, configCanalAberto, adicionarParticipanteAberto]);

  const carregarMensagens = useCallback(async (canalId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_mensagens")
      .select("id, canal_id, autor_id, texto, created_at, resposta_a_id, audio_url, audio_duracao, arquivo_url, arquivo_nome, arquivo_tipo, arquivo_tamanho")
      .eq("canal_id", canalId)
      .order("created_at", { ascending: true });
    setMensagens(data ?? []);

    const idsMensagens = (data ?? []).map((m) => m.id);
    if (idsMensagens.length > 0) {
      const { data: reacoesData } = await supabase
        .from("chat_mensagens_reacoes")
        .select("id, mensagem_id, autor_id, emoji")
        .in("mensagem_id", idsMensagens);
      setReacoes(reacoesData ?? []);
    } else {
      setReacoes([]);
    }
  }, []);

  async function abrirCanal(canalId: string) {
    setCanalAtivoId(canalId);
    setRespondendoA(null);
    await carregarMensagens(canalId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("chat_participantes")
        .update({ ultima_leitura: new Date().toISOString() })
        .eq("canal_id", canalId)
        .eq("auth_user_id", user.id);
    }
    setCanais((atual) => atual.map((c) => (c.id === canalId ? { ...c, naoLidas: 0 } : c)));
  }

  useEffect(() => {
    if (!meuId) return;
    const supabase = createClient();
    const canal = supabase
      .channel("chat-mensagens-globais")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensagens" }, (payload) => {
        const nova = payload.new as Mensagem;
        const éMinha = nova.autor_id === meuId;

        setMensagens((atual) => (nova.canal_id === canalAtivoIdRef.current ? [...atual, nova] : atual));

        setCanais((atual) => {
          const existeCanal = atual.some((c) => c.id === nova.canal_id);
          if (!existeCanal) {
            carregarCanais();
            return atual;
          }
          return atual
            .map((c) =>
              c.id === nova.canal_id
                ? {
                    ...c,
                    ultimaMensagem: nova.texto,
                    ultimaMensagemHora: nova.created_at,
                    naoLidas: !éMinha && nova.canal_id !== canalAtivoIdRef.current ? c.naoLidas + 1 : c.naoLidas,
                  }
                : c
            )
            .sort((a, b) => new Date(b.ultimaMensagemHora ?? 0).getTime() - new Date(a.ultimaMensagemHora ?? 0).getTime());
        });

        if (!éMinha) {
          tocarSom();
          if (nova.canal_id === canalAtivoIdRef.current) {
            supabase
              .from("chat_participantes")
              .update({ ultima_leitura: new Date().toISOString() })
              .eq("canal_id", nova.canal_id)
              .eq("auth_user_id", meuId);
          }
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensagens_reacoes" }, (payload) => {
        const nova = payload.new as Reacao;
        setReacoes((atual) => (atual.some((r) => r.id === nova.id) ? atual : [...atual, nova]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_mensagens_reacoes" }, (payload) => {
        const antiga = payload.old as { id: string };
        setReacoes((atual) => atual.filter((r) => r.id !== antiga.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  async function enviarMensagem(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || !canalAtivoId || !meuId) return;
    setEnviando(true);
    const supabase = createClient();
    const textoEnviado = texto.trim();
    const { error } = await supabase.from("chat_mensagens").insert({
      canal_id: canalAtivoId,
      autor_id: meuId,
      texto: textoEnviado,
      resposta_a_id: respondendoA?.id ?? null,
    });
    if (!error) {
      setTexto("");
      setRespondendoA(null);

      // Notifica quem foi @mencionado na mensagem
      const mencionados = colegas.filter((c) => textoEnviado.includes(`@${c.nome}`));
      if (mencionados.length > 0) {
        await supabase.from("notificacoes").insert(
          mencionados.map((c) => ({
            destinatario_id: c.authUserId,
            tipo: "mencao_chat",
            titulo: `${meuNome} te mencionou`,
            descricao: textoEnviado.slice(0, 120),
            link: canalAtivoId ? `/chat?canal=${canalAtivoId}` : "/chat",
            autor_id: meuId,
            autor_nome: meuNome,
            autor_foto_url: meuFotoUrl,
          }))
        );
      }
    }
    setEnviando(false);
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
      setTempoGravacao(0);
      timerGravacaoRef.current = setInterval(() => setTempoGravacao((t) => t + 1), 1000);
    } catch {
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  }

  function pararStreamGravacao() {
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    if (timerGravacaoRef.current) clearInterval(timerGravacaoRef.current);
    setGravando(false);
  }

  function cancelarGravacao() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    pararStreamGravacao();
    audioChunksRef.current = [];
  }

  async function pararEEnviarGravacao() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !canalAtivoId || !meuId) return;
    const duracaoFinal = tempoGravacao;
    recorder.onstop = async () => {
      pararStreamGravacao();
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      audioChunksRef.current = [];
      if (blob.size === 0) return;
      setEnviandoAudio(true);
      const supabase = createClient();
      const caminho = `${canalAtivoId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from("chat-audio").upload(caminho, blob);
      if (!uploadError) {
        const { data } = supabase.storage.from("chat-audio").getPublicUrl(caminho);
        await supabase.from("chat_mensagens").insert({
          canal_id: canalAtivoId,
          autor_id: meuId,
          texto: "",
          audio_url: data.publicUrl,
          audio_duracao: duracaoFinal,
          resposta_a_id: respondendoA?.id ?? null,
        });
        setRespondendoA(null);
      }
      setEnviandoAudio(false);
    };
    recorder.stop();
  }

  async function enviarArquivo(arquivo: File | null) {
    if (!arquivo || !canalAtivoId || !meuId) return;
    setEnviandoArquivo(true);
    const supabase = createClient();
    const caminho = `${canalAtivoId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${sanearNomeArquivo(arquivo.name)}`;
    const { error: uploadError } = await supabase.storage.from("chat-arquivos").upload(caminho, arquivo);
    if (!uploadError) {
      const { data } = supabase.storage.from("chat-arquivos").getPublicUrl(caminho);
      await supabase.from("chat_mensagens").insert({
        canal_id: canalAtivoId,
        autor_id: meuId,
        texto: "",
        arquivo_url: data.publicUrl,
        arquivo_nome: arquivo.name,
        arquivo_tipo: arquivo.type,
        arquivo_tamanho: arquivo.size,
        resposta_a_id: respondendoA?.id ?? null,
      });
      setRespondendoA(null);
    } else {
      alert(`Não foi possível enviar o arquivo: ${uploadError.message}`);
    }
    setEnviandoArquivo(false);
    if (inputArquivoRef.current) inputArquivoRef.current.value = "";
  }

  async function alternarReacao(mensagemId: string, emoji: string) {
    if (!meuId) return;
    const supabase = createClient();
    const existente = reacoes.find((r) => r.mensagem_id === mensagemId && r.autor_id === meuId && r.emoji === emoji);
    if (existente) {
      setReacoes((atual) => atual.filter((r) => r.id !== existente.id));
      await supabase.from("chat_mensagens_reacoes").delete().eq("id", existente.id);
    } else {
      const idTemp = `temp-${Date.now()}`;
      setReacoes((atual) => [...atual, { id: idTemp, mensagem_id: mensagemId, autor_id: meuId, emoji }]);
      const { data } = await supabase
        .from("chat_mensagens_reacoes")
        .insert({ mensagem_id: mensagemId, autor_id: meuId, emoji })
        .select("id")
        .single();
      if (data) {
        setReacoes((atual) => atual.map((r) => (r.id === idTemp ? { ...r, id: data.id } : r)));
      }
    }
    setSeletorReacaoAberto(null);
  }

  function inserirEmoji(emoji: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setTexto((t) => t + emoji);
      return;
    }
    const inicio = textarea.selectionStart ?? texto.length;
    const fim = textarea.selectionEnd ?? texto.length;
    const novoTexto = texto.slice(0, inicio) + emoji + texto.slice(fim);
    setTexto(novoTexto);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = inicio + emoji.length;
    });
  }

  function aplicarFormatacao(marcador: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const inicio = textarea.selectionStart ?? texto.length;
    const fim = textarea.selectionEnd ?? texto.length;
    const selecionado = texto.slice(inicio, fim);
    const textoFinal = selecionado || (marcador === "**" ? "negrito" : "itálico");
    const novoTexto = `${texto.slice(0, inicio)}${marcador}${textoFinal}${marcador}${texto.slice(fim)}`;
    setTexto(novoTexto);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = inicio + marcador.length;
      textarea.selectionEnd = inicio + marcador.length + textoFinal.length;
    });
  }

  function inserirDivisoria() {
    const textarea = textareaRef.current;
    const sufixo = texto && !texto.endsWith("\n") ? "\n" : "";
    const novoTexto = `${texto}${sufixo}---\n`;
    setTexto(novoTexto);
    requestAnimationFrame(() => {
      textarea?.focus();
    });
  }

  const colegasParaMencao = colegas.filter((c) => mencaoBusca !== null && normalizar(c.nome).includes(normalizar(mencaoBusca)));

  function selecionarMencao(nome: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const posicaoCursor = textarea.selectionStart ?? texto.length;
    const antesDoCursor = texto.slice(0, posicaoCursor);
    const depoisDoCursor = texto.slice(posicaoCursor);
    const novoAntes = antesDoCursor.replace(/@([a-zA-ZÀ-ÿ]*)$/, `@${nome} `);
    const novoTexto = novoAntes + depoisDoCursor;
    setTexto(novoTexto);
    setMencaoBusca(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = novoAntes.length;
    });
  }

  const totalNaoLidas = canais.reduce((s, c) => s + c.naoLidas, 0);
  const canaisFiltrados = canais
    .filter((c) => normalizar(c.nomeExibicao).includes(normalizar(buscaConversa)))
    .filter((c) => {
      if (filtroConversa === "nao_lidas") return c.naoLidas > 0;
      if (filtroConversa === "canais") return c.tipo === "grupo" || c.tipo === "cliente";
      if (filtroConversa === "pessoas") return c.tipo === "dm";
      return true;
    });
  const mensagemRespondida = respondendoA;

  return (
    <main className="h-screen flex bg-white">
      <div className="w-80 shrink-0 bg-ink text-white flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white">💬 Chat</h1>
              {totalNaoLidas > 0 && (
                <span className="rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5">{totalNaoLidas}</span>
              )}
            </div>
            {souAdmin && (
              <button
                onClick={() => setNovaConversaAberta(true)}
                title="Nova conversa"
                className="h-8 w-8 rounded-full bg-forest text-white flex items-center justify-center text-lg font-semibold hover:brightness-110 transition-colors"
              >
                +
              </button>
            )}
          </div>
          <input
            value={buscaConversa}
            onChange={(e) => setBuscaConversa(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40 text-sm py-2 px-3 outline-none focus:border-white/30 transition-colors"
          />
          <div className="flex items-center gap-1 mt-2.5 overflow-x-auto">
            {(
              [
                ["tudo", "Tudo"],
                ["nao_lidas", "Não lidas"],
                ["canais", "Canais"],
                ["pessoas", "Pessoas"],
              ] as [typeof filtroConversa, string][]
            ).map(([valor, label]) => (
              <button
                key={valor}
                onClick={() => setFiltroConversa(valor)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filtroConversa === valor ? "bg-white text-ink" : "text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <p className="p-4 text-sm text-white/40">Carregando...</p>
          ) : canaisFiltrados.length === 0 ? (
            <p className="p-4 text-sm text-white/40">
              {canais.length === 0
                ? souAdmin
                  ? "Nenhuma conversa ainda. Comece uma nova!"
                  : "Nenhum chat disponível ainda. Peça pra um administrador te adicionar a uma conversa."
                : "Nenhuma conversa encontrada."}
            </p>
          ) : (
            (() => {
              const grupos = canaisFiltrados.filter((c) => c.tipo === "grupo");
              const clientes = canaisFiltrados.filter((c) => c.tipo === "cliente");
              const pessoas = canaisFiltrados.filter((c) => c.tipo === "dm");
              const agrupar = filtroConversa === "tudo" || filtroConversa === "canais";

              const LinhaCanal = (c: CanalComInfo) => (
                <button
                  key={c.id}
                  onClick={() => abrirCanal(c.id)}
                  className={`w-full text-left mx-2 mb-0.5 px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2.5 ${
                    canalAtivoId === c.id ? "bg-white/15" : "hover:bg-white/5"
                  }`}
                  style={{ width: "calc(100% - 1rem)" }}
                >
                  {c.tipo === "dm" ? (
                    <Avatar nome={c.nomeExibicao} fotoUrl={c.fotoUrl} tamanho={32} />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-sm shrink-0">
                      {c.tipo === "cliente" ? "🏢" : "#"}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white truncate">{c.nomeExibicao}</span>
                      {c.naoLidas > 0 && (
                        <span className="shrink-0 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                          {c.naoLidas}
                        </span>
                      )}
                    </span>
                    {c.ultimaMensagem && <span className="block text-xs text-white/50 truncate mt-0.5">{c.ultimaMensagem}</span>}
                  </span>
                </button>
              );

              if (!agrupar) return canaisFiltrados.map(LinhaCanal);

              return (
                <>
                  {grupos.length > 0 && (
                    <div className="mb-1">
                      <p className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/30">Canais da Agência</p>
                      {grupos.map(LinhaCanal)}
                    </div>
                  )}
                  {clientes.length > 0 && (
                    <div className="mb-1">
                      <p className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/30">Clientes</p>
                      {clientes.map(LinhaCanal)}
                    </div>
                  )}
                  {pessoas.length > 0 && filtroConversa === "tudo" && (
                    <div className="mb-1">
                      <p className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/30">Pessoas</p>
                      {pessoas.map(LinhaCanal)}
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-surface/50">
        {!canalAtivo ? (
          <div className="flex-1 flex items-center justify-center text-sm text-ink/40">
            Escolha uma conversa ao lado, ou comece uma nova.
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-black/5 bg-card/80 backdrop-blur-sm flex items-center justify-between shadow-sm">
              <button
                onClick={() => canalAtivo.tipo !== "dm" && setConfigCanalAberto(true)}
                className="flex items-center gap-3 text-left"
              >
                {canalAtivo.tipo === "dm" ? (
                  <Avatar nome={canalAtivo.nomeExibicao} fotoUrl={canalAtivo.fotoUrl} tamanho={34} />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-surface flex items-center justify-center text-sm shrink-0">
                    {canalAtivo.tipo === "cliente" ? "🏢" : "#"}
                  </span>
                )}
                <div>
                  <p className="font-bold text-ink leading-tight">{canalAtivo.nomeExibicao}</p>
                  {canalAtivo.subtitulo && <p className="text-xs text-ink/40 truncate max-w-md">{canalAtivo.subtitulo}</p>}
                </div>
              </button>
              <div className="flex items-center gap-2">
                {canalAtivo.tipo !== "dm" && qtdParticipantesAtivo !== null && (
                  <button
                    onClick={() => setConfigCanalAberto(true)}
                    title="Ver membros do canal"
                    className="flex items-center gap-1.5 rounded-full border border-black/10 hover:bg-surface px-3 py-1.5 text-ink/60 hover:text-ink transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="text-xs font-bold">{qtdParticipantesAtivo}</span>
                  </button>
                )}
                {canalAtivo.tipo !== "dm" && (
                  <button
                    onClick={() => setAdicionarParticipanteAberto(true)}
                    className="text-xs font-semibold text-ink/50 hover:text-ink rounded-full border border-black/10 px-3 py-1.5"
                  >
                    + Adicionar participante
                  </button>
                )}
                {canalAtivo.tipo !== "dm" && (
                  <button
                    onClick={() => setConfigCanalAberto(true)}
                    className="h-8 w-8 rounded-full hover:bg-surface flex items-center justify-center text-ink/50"
                    title="Configurações do canal"
                  >
                    ⋯
                  </button>
                )}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
              {mensagens.map((m, i) => {
                const anterior = mensagens[i - 1];
                const novoDia = !anterior || formatarDiaSeparador(anterior.created_at) !== formatarDiaSeparador(m.created_at);
                const mesmoAutorSeguido = anterior && anterior.autor_id === m.autor_id && !novoDia;
                const nomeAutor = nomeDoParticipante(m.autor_id);
                const cargoAutor = m.autor_id === meuId ? null : cargoDoParticipante(m.autor_id);
                const fotoAutor = fotoDoParticipante(m.autor_id);
                const todosOsNomes = [meuNome, ...colegas.map((c) => c.nome)];
                const original = m.resposta_a_id ? mensagens.find((x) => x.id === m.resposta_a_id) : null;
                const reacoesDaMensagem = reacoes.filter((r) => r.mensagem_id === m.id);
                const reacoesAgrupadas = new Map<string, string[]>();
                for (const r of reacoesDaMensagem) {
                  reacoesAgrupadas.set(r.emoji, [...(reacoesAgrupadas.get(r.emoji) ?? []), r.autor_id]);
                }

                return (
                  <div key={m.id}>
                    {novoDia && (
                      <div className="flex items-center gap-3 my-4">
                        <span className="flex-1 h-px bg-black/10" />
                        <span className="shrink-0 text-xs font-semibold text-forest bg-mint rounded-full px-3 py-1">
                          {formatarDiaSeparador(m.created_at)}
                        </span>
                        <span className="flex-1 h-px bg-black/10" />
                      </div>
                    )}
                    <div
                      className={`group relative flex items-start gap-3 px-3 py-1 rounded-xl hover:bg-surface/60 transition-colors ${
                        mesmoAutorSeguido ? "" : "mt-3"
                      }`}
                      onMouseEnter={() => setMensagemComMenu(m.id)}
                      onMouseLeave={() => {
                        setMensagemComMenu(null);
                        setSeletorReacaoAberto(null);
                      }}
                    >
                      <div className="w-9 shrink-0">{!mesmoAutorSeguido && <Avatar nome={nomeAutor} fotoUrl={fotoAutor} />}</div>
                      <div className="flex-1 min-w-0">
                        {!mesmoAutorSeguido && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-bold text-ink">{nomeAutor}</span>
                            {cargoAutor && (
                              <span className="text-[10px] font-semibold text-forest bg-mint rounded-full px-2 py-0.5">{cargoAutor}</span>
                            )}
                            <span className="text-[11px] font-medium text-forest/70">{formatarHora(m.created_at)}</span>
                          </div>
                        )}

                        {original && (
                          <div className="mb-1 pl-2.5 border-l-2 border-forest/30 text-xs text-ink/50 flex items-center gap-1">
                            <span className="font-semibold">{nomeDoParticipante(original.autor_id)}:</span>
                            <span className="truncate">{original.texto}</span>
                          </div>
                        )}

                        {m.audio_url ? (
                          <PlayerAudio url={m.audio_url} duracao={m.audio_duracao} />
                        ) : m.arquivo_url ? (
                          <CardArquivoChat url={m.arquivo_url} nome={m.arquivo_nome} tipo={m.arquivo_tipo} tamanho={m.arquivo_tamanho} />
                        ) : (
                          <p className="text-sm text-ink whitespace-pre-wrap break-words leading-relaxed">
                            {renderizarMensagem(m.texto, todosOsNomes)}
                          </p>
                        )}

                        {reacoesAgrupadas.size > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {[...reacoesAgrupadas.entries()].map(([emoji, autores]) => (
                              <button
                                key={emoji}
                                onClick={() => alternarReacao(m.id, emoji)}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                                  autores.includes(meuId ?? "")
                                    ? "bg-mint border-forest/30 text-forest font-semibold"
                                    : "bg-surface border-black/5 text-ink/60 hover:border-black/20"
                                }`}
                              >
                                {emoji} {autores.length}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {mensagemComMenu === m.id && (
                        <div className="absolute -top-3 right-3 flex items-center gap-0.5 bg-white border border-black/10 rounded-full shadow-md px-1 py-1">
                          <div className="relative">
                            <button
                              onClick={() => setSeletorReacaoAberto(seletorReacaoAberto === m.id ? null : m.id)}
                              className="h-7 w-7 rounded-full hover:bg-surface flex items-center justify-center text-sm"
                              title="Reagir"
                            >
                              🙂
                            </button>
                            {seletorReacaoAberto === m.id && (
                              <div className="absolute z-20 top-8 right-0 bg-white border border-black/10 rounded-full shadow-lg px-2 py-1.5 flex items-center gap-1">
                                {REACOES_RAPIDAS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => alternarReacao(m.id, emoji)}
                                    className="text-base hover:scale-125 transition-transform"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setRespondendoA(m);
                              textareaRef.current?.focus();
                            }}
                            className="h-7 w-7 rounded-full hover:bg-surface flex items-center justify-center text-ink/50 text-sm"
                            title="Responder"
                          >
                            ↩
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {mensagemRespondida && (
              <div className="px-6 pt-3 flex items-center justify-between bg-card">
                <div className="flex items-center gap-2 text-xs text-ink/60 border-l-2 border-forest pl-2.5">
                  <span>
                    Respondendo <span className="font-semibold">{nomeDoParticipante(mensagemRespondida.autor_id)}</span>:{" "}
                    {mensagemRespondida.texto.slice(0, 60)}
                    {mensagemRespondida.texto.length > 60 ? "..." : ""}
                  </span>
                </div>
                <button onClick={() => setRespondendoA(null)} className="text-ink/40 hover:text-ink text-xs px-2">
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={enviarMensagem} className="p-4 border-t border-black/5 bg-card">
              {gravando ? (
                <div className="flex items-center gap-3 bg-red-50 rounded-full pl-4 pr-2 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-sm font-semibold text-red-700 tabular-nums">{formatarDuracao(tempoGravacao)}</span>
                  <span className="text-xs text-red-600/70 flex-1">Gravando áudio...</span>
                  <button
                    type="button"
                    onClick={cancelarGravacao}
                    className="h-8 w-8 rounded-full hover:bg-red-100 flex items-center justify-center text-red-600 text-sm"
                    title="Cancelar"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={pararEEnviarGravacao}
                    disabled={enviandoAudio}
                    className="h-9 w-9 rounded-full bg-forest text-white flex items-center justify-center hover:brightness-110 disabled:opacity-50"
                    title="Enviar áudio"
                  >
                    ➤
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-0.5 mb-2">
                    <button
                      type="button"
                      onClick={() => aplicarFormatacao("**")}
                      className="h-7 w-7 rounded-lg text-xs font-bold text-ink/50 hover:bg-surface hover:text-ink"
                      title="Negrito"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarFormatacao("_")}
                      className="h-7 w-7 rounded-lg text-xs italic font-bold text-ink/50 hover:bg-surface hover:text-ink"
                      title="Itálico"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={inserirDivisoria}
                      className="h-7 w-7 rounded-lg text-xs font-bold text-ink/50 hover:bg-surface hover:text-ink"
                      title="Linha divisória"
                    >
                      ―
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setMostrarEmoji((v) => !v)}
                        className="rounded-full h-10 w-10 flex items-center justify-center border border-black/10 hover:bg-surface text-lg"
                      >
                        🙂
                      </button>
                      {mostrarEmoji && (
                        <div
                          className="absolute z-20 bottom-12 left-0 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-2 grid grid-cols-8 gap-1"
                          onMouseLeave={() => setMostrarEmoji(false)}
                        >
                          {EMOJIS.map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => inserirEmoji(e)}
                              className="text-lg hover:bg-surface rounded-lg h-8 w-8 flex items-center justify-center"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      ref={inputArquivoRef}
                      type="file"
                      onChange={(e) => enviarArquivo(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => inputArquivoRef.current?.click()}
                      disabled={enviandoArquivo}
                      className="rounded-full h-10 w-10 flex items-center justify-center border border-black/10 hover:bg-surface text-ink/60 hover:text-ink shrink-0 disabled:opacity-50"
                      title="Anexar arquivo"
                    >
                      {enviandoArquivo ? (
                        <span className="text-xs">...</span>
                      ) : (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.64 17.61a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={iniciarGravacao}
                      className="rounded-full h-10 w-10 flex items-center justify-center border border-black/10 hover:bg-surface text-ink/60 hover:text-ink shrink-0"
                      title="Gravar áudio"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="2" width="6" height="12" rx="3" />
                        <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                        <line x1="8" y1="22" x2="16" y2="22" />
                      </svg>
                    </button>
                    <div className="relative flex-1">
                      <textarea
                        ref={textareaRef}
                        value={texto}
                        onChange={(e) => {
                          const valor = e.target.value;
                          setTexto(valor);
                          const posicaoCursor = e.target.selectionStart ?? valor.length;
                          const antesDoCursor = valor.slice(0, posicaoCursor);
                          const match = antesDoCursor.match(/@([a-zA-ZÀ-ÿ]*)$/);
                          setMencaoBusca(match ? match[1] : null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && mencaoBusca === null) {
                            e.preventDefault();
                            enviarMensagem(e);
                          }
                          if (e.key === "Escape") setMencaoBusca(null);
                        }}
                        rows={1}
                        placeholder="Escreva uma mensagem..."
                        className="input resize-none w-full !py-2.5"
                      />
                      {mencaoBusca !== null && colegasParaMencao.length > 0 && (
                        <div className="absolute z-20 bottom-14 left-0 w-64 rounded-2xl bg-white border border-black/10 shadow-lg py-1 max-h-48 overflow-y-auto">
                          {colegasParaMencao.map((c) => (
                            <button
                              key={c.authUserId}
                              type="button"
                              onClick={() => selecionarMencao(c.nome)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-surface"
                            >
                              {c.nome}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={enviando || !texto.trim()}
                      className="shrink-0 rounded-full bg-forest text-white px-5 h-10 text-sm font-semibold hover:brightness-110 transition-colors disabled:opacity-50"
                    >
                      Enviar
                    </button>
                  </div>
                </>
              )}
            </form>
          </>
        )}
      </div>

      {novaConversaAberta && souAdmin && (
        <NovaConversaModal
          colegas={colegas}
          onClose={() => setNovaConversaAberta(false)}
          onCriado={(canalId) => {
            setNovaConversaAberta(false);
            carregarCanais().then(() => abrirCanal(canalId));
          }}
        />
      )}

      {adicionarParticipanteAberto && canalAtivo && (
        <AdicionarParticipanteModal
          canalId={canalAtivo.id}
          colegas={colegas}
          onClose={() => setAdicionarParticipanteAberto(false)}
          onAdicionado={() => {
            setAdicionarParticipanteAberto(false);
          }}
        />
      )}

      {configCanalAberto && canalAtivo && (
        <ConfigCanalModal
          canal={canalAtivo}
          colegas={colegas}
          meuId={meuId}
          temMensagens={mensagens.length > 0}
          onClose={() => setConfigCanalAberto(false)}
          onAtualizado={() => {
            carregarCanais();
          }}
          onArquivado={() => {
            setConfigCanalAberto(false);
            setCanalAtivoId(null);
            carregarCanais();
          }}
          onExcluido={() => {
            setConfigCanalAberto(false);
            setCanalAtivoId(null);
            carregarCanais();
          }}
        />
      )}
    </main>
  );
}

function AdicionarParticipanteModal({
  canalId,
  colegas,
  onClose,
  onAdicionado,
}: {
  canalId: string;
  colegas: Colega[];
  onClose: () => void;
  onAdicionado: () => void;
}) {
  const [jaParticipam, setJaParticipam] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [adicionando, setAdicionando] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data } = await supabase.from("chat_participantes").select("auth_user_id").eq("canal_id", canalId);
      setJaParticipam((data ?? []).map((p) => p.auth_user_id));
    }
    carregar();
  }, [canalId]);

  const disponiveis = colegas.filter((c) => !jaParticipam.includes(c.authUserId) && normalizar(c.nome).includes(normalizar(busca)));

  async function adicionar(authUserId: string) {
    setAdicionando(authUserId);
    const supabase = createClient();
    await supabase.from("chat_participantes").insert({ canal_id: canalId, auth_user_id: authUserId });
    setJaParticipam((atual) => [...atual, authUserId]);
    setAdicionando(null);
    onAdicionado();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Adicionar participante</h2>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} className="input mb-3" placeholder="Buscar colega..." />
        <div className="rounded-2xl border border-black/5 overflow-hidden">
          {disponiveis.length === 0 ? (
            <p className="p-4 text-sm text-ink/50">Ninguém disponível pra adicionar.</p>
          ) : (
            disponiveis.map((c) => (
              <button
                key={c.authUserId}
                onClick={() => adicionar(c.authUserId)}
                disabled={adicionando === c.authUserId}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface border-b border-black/5 last:border-0 disabled:opacity-50"
              >
                {adicionando === c.authUserId ? "Adicionando..." : c.nome}
              </button>
            ))
          )}
        </div>
        <button onClick={onClose} className="mt-4 text-sm font-semibold text-ink/60 hover:text-ink">
          Fechar
        </button>
      </div>
    </div>
  );
}

function ConfigCanalModal({
  canal,
  colegas,
  meuId,
  temMensagens,
  onClose,
  onAtualizado,
  onArquivado,
  onExcluido,
}: {
  canal: CanalComInfo;
  colegas: Colega[];
  meuId: string | null;
  temMensagens: boolean;
  onClose: () => void;
  onAtualizado: () => void;
  onArquivado: () => void;
  onExcluido: () => void;
}) {
  const [nome, setNome] = useState(canal.nome ?? "");
  const [descricao, setDescricao] = useState(canal.descricao ?? "");
  const [membros, setMembros] = useState<{ authUserId: string; nome: string; cargo: string | null; fotoUrl: string | null }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const carregarMembros = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("chat_participantes").select("auth_user_id").eq("canal_id", canal.id);
    const ids = (data ?? []).map((p) => p.auth_user_id);
    setMembros(
      ids.map((id) => {
        if (id === meuId) return { authUserId: id, nome: "Você", cargo: null, fotoUrl: null };
        const colega = colegas.find((c) => c.authUserId === id);
        return { authUserId: id, nome: colega?.nome ?? "Alguém", cargo: colega?.cargo ?? null, fotoUrl: colega?.fotoUrl ?? null };
      })
    );
  }, [canal.id, colegas, meuId]);

  useEffect(() => {
    carregarMembros();
  }, [carregarMembros]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    const supabase = createClient();
    const payload: Record<string, string | null> = { descricao: descricao.trim() || null };
    if (canal.tipo === "grupo") payload.nome = nome.trim() || null;
    const { error } = await supabase.from("chat_canais").update(payload).eq("id", canal.id);
    setSalvando(false);
    if (error) {
      setErro(error.message);
    } else {
      setSucesso(true);
      onAtualizado();
    }
  }

  async function removerMembro(authUserId: string) {
    if (!window.confirm("Remover essa pessoa do canal?")) return;
    const supabase = createClient();
    await supabase.from("chat_participantes").delete().eq("canal_id", canal.id).eq("auth_user_id", authUserId);
    carregarMembros();
    onAtualizado();
  }

  async function arquivar() {
    if (!meuId) return;
    if (!window.confirm("Arquivar essa conversa? Ela some da sua lista, mas o histórico continua guardado.")) return;
    const supabase = createClient();
    await supabase
      .from("chat_participantes")
      .update({ arquivado: true })
      .eq("canal_id", canal.id)
      .eq("auth_user_id", meuId);
    onArquivado();
  }

  async function excluir() {
    if (!window.confirm("Excluir esse canal de vez? Essa ação não pode ser desfeita.")) return;
    const supabase = createClient();
    await supabase.from("chat_canais").delete().eq("id", canal.id);
    onExcluido();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Configurações do canal</h2>

        {canal.tipo === "grupo" && (
          <label className="block mb-3">
            <span className="block text-sm font-medium text-ink/70 mb-1">Nome do grupo</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
          </label>
        )}

        <label className="block mb-4">
          <span className="block text-sm font-medium text-ink/70 mb-1">Descrição</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input"
            rows={2}
            placeholder="Do que é esse canal..."
          />
        </label>

        {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}
        {sucesso && <p className="text-sm text-forest font-semibold mb-2">Salvo!</p>}

        <button
          onClick={salvar}
          disabled={salvando}
          className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50 mb-6"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>

        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">Membros ({membros.length})</p>
          <div className="rounded-2xl border border-black/5 overflow-hidden">
            {membros.map((m) => (
              <div key={m.authUserId} className="flex items-center justify-between px-4 py-2.5 border-b border-black/5 last:border-0">
                <div className="flex items-center gap-2">
                  <Avatar nome={m.nome} fotoUrl={m.fotoUrl} tamanho={28} />
                  <div>
                    <p className="text-sm font-semibold text-ink">{m.nome}</p>
                    {m.cargo && <p className="text-xs text-ink/40">{m.cargo}</p>}
                  </div>
                </div>
                {m.authUserId !== meuId && (
                  <button onClick={() => removerMembro(m.authUserId)} className="text-xs font-semibold text-ink/40 hover:text-red-600">
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-black/5">
          <button
            onClick={arquivar}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-600 px-4 py-2 text-sm font-bold hover:bg-red-100 transition-colors"
          >
            🗄 Arquivar conversa
          </button>
          {!temMensagens && (
            <button onClick={excluir} className="text-sm font-semibold text-red-500 hover:text-red-700 ml-auto">
              Excluir canal
            </button>
          )}
        </div>
        {temMensagens && (
          <p className="text-xs text-ink/40 mt-2">
            Esse canal já tem mensagens, então só é possível arquivar (o histórico fica guardado).
          </p>
        )}

        <button onClick={onClose} className="mt-4 text-sm font-semibold text-ink/60 hover:text-ink">
          Fechar
        </button>
      </div>
    </div>
  );
}

function NovaConversaModal({
  colegas,
  onClose,
  onCriado,
}: {
  colegas: Colega[];
  onClose: () => void;
  onCriado: (canalId: string) => void;
}) {
  const [tipo, setTipo] = useState<"dm" | "grupo" | "cliente">("dm");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [descricaoGrupo, setDescricaoGrupo] = useState("");
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (tipo !== "cliente") return;
    async function carregarClientes() {
      const supabase = createClient();
      const { data } = await supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )");
      const lista = ((data ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
        .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setClientes(lista);
    }
    carregarClientes();
  }, [tipo]);

  const colegasFiltrados = colegas.filter((c) => normalizar(c.nome).includes(normalizar(busca)));

  function alternarSelecionado(id: string) {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  async function criar() {
    setErro(null);
    if (tipo === "dm" && selecionados.length !== 1) {
      setErro("Escolha exatamente uma pessoa.");
      return;
    }
    if (tipo === "grupo" && !nomeGrupo.trim()) {
      setErro("Dê um nome ao grupo.");
      return;
    }
    if (tipo === "cliente" && !clienteId) {
      setErro("Escolha um cliente.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErro("Sessão não encontrada.");
      setSalvando(false);
      return;
    }

    if (tipo === "dm") {
      const outroId = selecionados[0];
      const { data: meusCanais } = await supabase
        .from("chat_participantes")
        .select("canal_id, chat_canais ( tipo )")
        .eq("auth_user_id", user.id);
      const idsDmExistentes = ((meusCanais ?? []) as unknown as { canal_id: string; chat_canais: { tipo: string } | null }[])
        .filter((c) => c.chat_canais?.tipo === "dm")
        .map((c) => c.canal_id);
      if (idsDmExistentes.length > 0) {
        const { data: participantesDoOutro } = await supabase
          .from("chat_participantes")
          .select("canal_id")
          .eq("auth_user_id", outroId)
          .in("canal_id", idsDmExistentes);
        if (participantesDoOutro && participantesDoOutro.length > 0) {
          onCriado(participantesDoOutro[0].canal_id);
          setSalvando(false);
          return;
        }
      }
    }

    const { data: novoCanal, error } = await supabase
      .from("chat_canais")
      .insert({
        tipo,
        nome: tipo === "grupo" ? nomeGrupo.trim() : null,
        descricao: tipo === "grupo" ? descricaoGrupo.trim() || null : null,
        cliente_id: tipo === "cliente" ? clienteId : null,
        criado_por: user.id,
      })
      .select("id")
      .single();

    if (error || !novoCanal) {
      setErro(error?.message ?? "Erro ao criar conversa.");
      setSalvando(false);
      return;
    }

    const participantes = [user.id, ...(tipo === "cliente" ? [] : selecionados)];
    await supabase.from("chat_participantes").insert(participantes.map((id) => ({ canal_id: novoCanal.id, auth_user_id: id })));

    setSalvando(false);
    onCriado(novoCanal.id);
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Nova conversa</h2>

        <div className="flex items-center gap-1 rounded-full bg-surface p-1 w-fit mb-4">
          {(["dm", "grupo", "cliente"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTipo(t);
                setSelecionados([]);
                setErro(null);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                tipo === t ? "bg-ink text-white" : "text-ink/60"
              }`}
            >
              {t === "dm" ? "Direta" : t === "grupo" ? "Grupo" : "Cliente"}
            </button>
          ))}
        </div>

        {tipo === "grupo" && (
          <>
            <label className="block mb-4">
              <span className="block text-sm font-medium text-ink/70 mb-1">Nome do grupo</span>
              <input value={nomeGrupo} onChange={(e) => setNomeGrupo(e.target.value)} className="input" placeholder="Ex: Time de Criação" />
            </label>
            <label className="block mb-4">
              <span className="block text-sm font-medium text-ink/70 mb-1">Descrição (opcional)</span>
              <textarea
                value={descricaoGrupo}
                onChange={(e) => setDescricaoGrupo(e.target.value)}
                className="input"
                rows={2}
                placeholder="Do que é esse grupo..."
              />
            </label>
          </>
        )}

        {tipo === "cliente" && (
          <label className="block mb-4">
            <span className="block text-sm font-medium text-ink/70 mb-1">Cliente</span>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input">
              <option value="">Selecione...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        {(tipo === "dm" || tipo === "grupo") && (
          <div className="mb-4">
            <span className="block text-sm font-medium text-ink/70 mb-1">
              {tipo === "dm" ? "Com quem?" : "Participantes (opcional — dá pra adicionar depois)"}
            </span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} className="input mb-2" placeholder="Buscar colega..." />
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-black/5">
              {colegasFiltrados.length === 0 ? (
                <p className="p-3 text-sm text-ink/50">Nenhum colega encontrado.</p>
              ) : (
                colegasFiltrados.map((c) => (
                  <button
                    key={c.authUserId}
                    type="button"
                    onClick={() => (tipo === "dm" ? setSelecionados([c.authUserId]) : alternarSelecionado(c.authUserId))}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface border-b border-black/5 last:border-0 flex items-center justify-between ${
                      selecionados.includes(c.authUserId) ? "bg-mint font-semibold" : ""
                    }`}
                  >
                    <span>{c.nome}</span>
                    {c.cargo && <span className="text-xs text-ink/40">{c.cargo}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={criar}
            disabled={salvando}
            className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
          >
            {salvando ? "Criando..." : "Criar conversa"}
          </button>
          <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";

interface Canal {
  id: string;
  tipo: "dm" | "grupo" | "cliente";
  nome: string | null;
  cliente_id: string | null;
  criado_por: string;
}

interface CanalComInfo extends Canal {
  nomeExibicao: string;
  ultimaMensagem: string | null;
  ultimaMensagemHora: string | null;
  naoLidas: number;
}

interface Mensagem {
  id: string;
  canal_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
}

interface Colega {
  authUserId: string;
  nome: string;
}

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "🥳",
  "👍", "👏", "🙌", "🔥", "✨", "💥", "💪", "🙏", "❤️", "💛",
  "💚", "💙", "💜", "⭐", "🎉", "🎯", "📈", "✅", "❗", "❓",
];

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

function Avatar({ nome, tamanho = 9 }: { nome: string; tamanho?: number }) {
  return (
    <div
      className={`h-${tamanho} w-${tamanho} rounded-full ${corAvatar(nome)} text-white flex items-center justify-center text-xs font-bold shrink-0`}
      style={{ height: tamanho * 4, width: tamanho * 4 }}
    >
      {iniciais(nome)}
    </div>
  );
}

// Suporta **negrito** e @Menções (reconhece só nomes de pessoas que
// realmente têm acesso ao chat, pra não grifar um "@" qualquer à toa)
function renderizarMensagem(texto: string, todosOsNomes: string[]) {
  const partesBold = texto.split(/(\*\*[^*]+\*\*)/g);
  return partesBold.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>;
    }
    if (todosOsNomes.length === 0) return parte;
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
  const [canais, setCanais] = useState<CanalComInfo[]>([]);
  const [canalAtivoId, setCanalAtivoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [novaConversaAberta, setNovaConversaAberta] = useState(false);
  const [adicionarParticipanteAberto, setAdicionarParticipanteAberto] = useState(false);
  const [mostrarEmoji, setMostrarEmoji] = useState(false);
  const [mencaoBusca, setMencaoBusca] = useState<string | null>(null);

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
      const novaPosicao = novoAntes.length;
      textarea.selectionStart = textarea.selectionEnd = novaPosicao;
    });
  }
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

    const { data: participacoes } = await supabase
      .from("chat_participantes")
      .select("canal_id, ultima_leitura, chat_canais ( id, tipo, nome, cliente_id, criado_por )")
      .eq("auth_user_id", user.id);

    const lista = (participacoes ?? [])
      .map((p) => p.chat_canais)
      .filter(Boolean) as unknown as Canal[];

    const leituraPorCanal = new Map((participacoes ?? []).map((p) => [p.canal_id, p.ultima_leitura as string]));

    // Nomes dos clientes (pra canais tipo "cliente")
    const idsClientes = lista.filter((c) => c.tipo === "cliente" && c.cliente_id).map((c) => c.cliente_id!) as string[];
    let nomesClientes = new Map<string, string>();
    if (idsClientes.length > 0) {
      const { data: clientesData } = await supabase
        .from("clientes")
        .select("id, papeis ( pessoas ( nome ) )")
        .in("id", idsClientes);
      nomesClientes = new Map(
        ((clientesData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[]).map(
          (c) => [c.id, c.papeis?.pessoas?.nome ?? "Cliente"]
        )
      );
    }

    // Pra DMs, preciso saber quem é o OUTRO participante
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

    // Nomes de todos os funcionários com acesso (usado pra DM e pra exibir autor das mensagens)
    const { data: func } = await supabase
      .from("funcionarios")
      .select("auth_user_id, papeis ( pessoas ( nome ) )")
      .not("auth_user_id", "is", null);
    const todosComNome = ((func ?? []) as unknown as { auth_user_id: string; papeis: { pessoas: { nome: string } | null } | null }[]).map(
      (f) => ({ authUserId: f.auth_user_id, nome: f.papeis?.pessoas?.nome ?? "Colega" })
    );
    const listaColegas = todosComNome.filter((c) => c.authUserId !== user.id);
    setColegas(listaColegas);
    setMeuNome(todosComNome.find((c) => c.authUserId === user.id)?.nome ?? "Você");

    // Última mensagem + contagem de não lidas por canal
    const canaisComInfo: CanalComInfo[] = await Promise.all(
      lista.map(async (c) => {
        const { data: ultimasMsgs } = await supabase
          .from("chat_mensagens")
          .select("texto, created_at")
          .eq("canal_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const ultima = ultimasMsgs?.[0];

        const minhaLeitura = leituraPorCanal.get(c.id) ?? new Date(0).toISOString();
        const { count } = await supabase
          .from("chat_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("canal_id", c.id)
          .gt("created_at", minhaLeitura)
          .neq("autor_id", user.id);

        let nomeExibicao = c.nome ?? "";
        if (c.tipo === "dm") {
          const outroId = outroParticipantePorCanal.get(c.id);
          nomeExibicao = outroId ? listaColegas.find((cl) => cl.authUserId === outroId)?.nome ?? "Colega" : "Colega";
        } else if (c.tipo === "cliente") {
          nomeExibicao = (c.cliente_id && nomesClientes.get(c.cliente_id)) || c.nome || "Cliente";
        }

        return {
          ...c,
          nomeExibicao,
          ultimaMensagem: ultima?.texto ?? null,
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

  const carregarMensagens = useCallback(async (canalId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_mensagens")
      .select("id, canal_id, autor_id, texto, created_at")
      .eq("canal_id", canalId)
      .order("created_at", { ascending: true });
    setMensagens(data ?? []);
  }, []);

  async function abrirCanal(canalId: string) {
    setCanalAtivoId(canalId);
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

  // Tempo real: qualquer mensagem nova em QUALQUER um dos meus canais —
  // toca som + atualiza contador se não for do canal aberto (ou se não for minha)
  useEffect(() => {
    if (!meuId) return;
    const supabase = createClient();
    const canal = supabase
      .channel("chat-mensagens-globais")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens" },
        (payload) => {
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
        }
      )
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
    const { error } = await supabase.from("chat_mensagens").insert({
      canal_id: canalAtivoId,
      autor_id: meuId,
      texto: texto.trim(),
    });
    if (!error) setTexto("");
    setEnviando(false);
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

  const totalNaoLidas = canais.reduce((s, c) => s + c.naoLidas, 0);

  return (
    <main className="h-screen flex">
      <div className="w-80 shrink-0 border-r border-black/5 bg-card flex flex-col">
        <div className="p-5 border-b border-black/5">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-extrabold text-ink">Chat</h1>
            {totalNaoLidas > 0 && (
              <span className="rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5">{totalNaoLidas}</span>
            )}
          </div>
          <button
            onClick={() => setNovaConversaAberta(true)}
            className="w-full mt-2 rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Nova conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-ink/50">Carregando...</p>
          ) : canais.length === 0 ? (
            <p className="p-4 text-sm text-ink/50">Nenhuma conversa ainda. Comece uma nova!</p>
          ) : (
            canais.map((c) => (
              <button
                key={c.id}
                onClick={() => abrirCanal(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-black/5 hover:bg-surface transition-colors ${
                  canalAtivoId === c.id ? "bg-surface" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink truncate flex items-center gap-1.5">
                    {c.tipo === "grupo" && "# "}
                    {c.tipo === "cliente" && "🏢 "}
                    {c.nomeExibicao}
                  </span>
                  {c.naoLidas > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                      {c.naoLidas}
                    </span>
                  )}
                </div>
                {c.ultimaMensagem && <p className="text-xs text-ink/50 truncate mt-0.5">{c.ultimaMensagem}</p>}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-surface/30">
        {!canalAtivo ? (
          <div className="flex-1 flex items-center justify-center text-sm text-ink/40">
            Escolha uma conversa ao lado, ou comece uma nova.
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-black/5 bg-card flex items-center justify-between">
              <p className="font-bold text-ink flex items-center gap-1.5">
                {canalAtivo.tipo === "grupo" && "# "}
                {canalAtivo.tipo === "cliente" && "🏢 "}
                {canalAtivo.nomeExibicao}
              </p>
              {canalAtivo.tipo !== "dm" && (
                <button
                  onClick={() => setAdicionarParticipanteAberto(true)}
                  className="text-xs font-semibold text-ink/50 hover:text-ink rounded-full border border-black/10 px-3 py-1.5"
                >
                  + Adicionar participante
                </button>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
              {mensagens.map((m, i) => {
                const anterior = mensagens[i - 1];
                const novoDia = !anterior || formatarDiaSeparador(anterior.created_at) !== formatarDiaSeparador(m.created_at);
                const mesmoAutorSeguido = anterior && anterior.autor_id === m.autor_id && !novoDia;
                const nomeAutor = nomeDoParticipante(m.autor_id);
                const todosOsNomes = [meuNome, ...colegas.map((c) => c.nome)];
                return (
                  <div key={m.id}>
                    {novoDia && (
                      <div className="flex items-center justify-center my-4">
                        <span className="text-xs font-semibold text-ink/40 bg-surface rounded-full px-3 py-1">
                          {formatarDiaSeparador(m.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex items-start gap-3 px-2 py-1 rounded-xl hover:bg-white/60 ${mesmoAutorSeguido ? "" : "mt-3"}`}>
                      <div className="w-9 shrink-0">{!mesmoAutorSeguido && <Avatar nome={nomeAutor} />}</div>
                      <div className="flex-1 min-w-0">
                        {!mesmoAutorSeguido && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-bold text-ink">{nomeAutor}</span>
                            <span className="text-[11px] text-ink/40">{formatarHora(m.created_at)}</span>
                          </div>
                        )}
                        <p className="text-sm text-ink whitespace-pre-wrap break-words leading-relaxed">
                          {renderizarMensagem(m.texto, todosOsNomes)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={enviarMensagem} className="p-4 border-t border-black/5 bg-card flex items-end gap-2">
              <div className="relative">
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
                  placeholder="Escreva uma mensagem... (** pra negrito, @ pra mencionar)"
                  className="input resize-none w-full"
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
                className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
              >
                Enviar
              </button>
            </form>
          </>
        )}
      </div>

      {novaConversaAberta && (
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

    // Pra DM, reaproveita o canal se já existir entre essas duas pessoas
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
    await supabase
      .from("chat_participantes")
      .insert(participantes.map((id) => ({ canal_id: novoCanal.id, auth_user_id: id })));

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
          <label className="block mb-4">
            <span className="block text-sm font-medium text-ink/70 mb-1">Nome do grupo</span>
            <input value={nomeGrupo} onChange={(e) => setNomeGrupo(e.target.value)} className="input" placeholder="Ex: Time de Criação" />
          </label>
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
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input mb-2"
              placeholder="Buscar colega..."
            />
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-black/5">
              {colegasFiltrados.length === 0 ? (
                <p className="p-3 text-sm text-ink/50">Nenhum colega encontrado.</p>
              ) : (
                colegasFiltrados.map((c) => (
                  <button
                    key={c.authUserId}
                    type="button"
                    onClick={() =>
                      tipo === "dm" ? setSelecionados([c.authUserId]) : alternarSelecionado(c.authUserId)
                    }
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface border-b border-black/5 last:border-0 ${
                      selecionados.includes(c.authUserId) ? "bg-mint font-semibold" : ""
                    }`}
                  >
                    {c.nome}
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

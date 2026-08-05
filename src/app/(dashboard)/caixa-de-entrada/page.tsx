"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
  autor_nome: string | null;
  autor_foto_url: string | null;
}

const ICONE_POR_TIPO: Record<string, { emoji: string; cor: string }> = {
  mencao_chat: { emoji: "💬", cor: "bg-sky-100 text-sky-700" },
  mencao_tarefa: { emoji: "💬", cor: "bg-sky-100 text-sky-700" },
  mencao_conteudo: { emoji: "💬", cor: "bg-sky-100 text-sky-700" },
  comentario_cliente: { emoji: "📢", cor: "bg-amber-100 text-amber-700" },
  atribuicao_tarefa: { emoji: "👤", cor: "bg-violet-100 text-violet-700" },
  atribuicao_conteudo: { emoji: "👤", cor: "bg-violet-100 text-violet-700" },
  mudanca_tarefa: { emoji: "✏️", cor: "bg-indigo-100 text-indigo-700" },
  mudanca_conteudo: { emoji: "✏️", cor: "bg-indigo-100 text-indigo-700" },
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

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function tituloDoGrupo(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(hoje.getDate() - 7);

  const mesmoDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (mesmoDay(data, hoje)) return "Hoje";
  if (mesmoDay(data, ontem)) return "Ontem";
  if (data > seteDiasAtras) return "Últimos 7 dias";
  return "Mais antigas";
}

export default function CaixaDeEntradaPage() {
  const router = useRouter();
  const [aba, setAba] = useState<"nao_lidas" | "lidas">("nao_lidas");
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, descricao, link, lida, created_at, autor_nome, autor_foto_url")
      .eq("destinatario_id", user.id)
      .order("created_at", { ascending: false })
      .limit(150);
    setNotificacoes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("caixa-de-entrada")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  async function abrir(n: Notificacao) {
    setNotificacoes((atual) => atual.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    const supabase = createClient();
    await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
    if (n.link) router.push(n.link);
  }

  async function marcarLidaSemAbrir(e: React.MouseEvent, n: Notificacao) {
    e.stopPropagation();
    setNotificacoes((atual) => atual.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    const supabase = createClient();
    await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
  }

  async function marcarTodasComoLidas() {
    const naoLidasIds = notificacoes.filter((n) => !n.lida).map((n) => n.id);
    if (naoLidasIds.length === 0) return;
    setNotificacoes((atual) => atual.map((x) => ({ ...x, lida: true })));
    const supabase = createClient();
    await supabase.from("notificacoes").update({ lida: true }).in("id", naoLidasIds);
  }

  const naoLidas = notificacoes.filter((n) => !n.lida);
  const lidas = notificacoes.filter((n) => n.lida);
  const listaAtual = aba === "nao_lidas" ? naoLidas : lidas;

  const grupos: { chave: string; itens: Notificacao[] }[] = [];
  for (const n of listaAtual) {
    const chave = tituloDoGrupo(n.created_at);
    const grupoExistente = grupos.find((g) => g.chave === chave);
    if (grupoExistente) grupoExistente.itens.push(n);
    else grupos.push({ chave, itens: [n] });
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Caixa de Entrada</h1>
          <p className="text-sm text-ink/60">Menções, atribuições, mudanças e aprovações de clientes, tudo num só lugar.</p>
        </div>
        {naoLidas.length > 0 && (
          <button onClick={marcarTodasComoLidas} className="text-xs font-semibold text-ink/50 hover:text-ink rounded-full border border-black/10 px-3 py-1.5">
            Marcar todas como visualizadas
          </button>
        )}
      </div>

      <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner mb-6">
        <button
          onClick={() => setAba("nao_lidas")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-all flex items-center gap-1.5 ${
            aba === "nao_lidas" ? "bg-ink text-white shadow-md" : "text-ink/50 hover:text-ink"
          }`}
        >
          Não visualizadas
          {naoLidas.length > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">{naoLidas.length}</span>
          )}
        </button>
        <button
          onClick={() => setAba("lidas")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
            aba === "lidas" ? "bg-ink text-white shadow-md" : "text-ink/50 hover:text-ink"
          }`}
        >
          Visualizadas
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : listaAtual.length === 0 ? (
        <p className="text-sm text-ink/50">{aba === "nao_lidas" ? "Tudo em dia por aqui. 🎉" : "Nada visualizado ainda."}</p>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <div key={g.chave}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2 px-1">{g.chave}</p>
              <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
                {g.itens.map((n) => {
                  const iconeInfo = ICONE_POR_TIPO[n.tipo] ?? { emoji: "🔔", cor: "bg-surface text-ink/50" };
                  return (
                    <div
                      key={n.id}
                      onClick={() => abrir(n)}
                      className={`group/row w-full flex items-center gap-3 px-5 py-3.5 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors cursor-pointer ${
                        !n.lida ? "bg-mint/15" : ""
                      }`}
                    >
                      <span className={`h-8 w-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${iconeInfo.cor}`}>
                        {iconeInfo.emoji}
                      </span>

                      {n.autor_foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.autor_foto_url} alt={n.autor_nome ?? ""} className="h-8 w-8 rounded-full object-cover shrink-0" />
                      ) : n.autor_nome ? (
                        <div className={`h-8 w-8 rounded-full ${corAvatar(n.autor_nome)} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                          {iniciais(n.autor_nome)}
                        </div>
                      ) : null}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{n.titulo}</p>
                        {n.descricao && <p className="text-xs text-ink/50 truncate mt-0.5">{n.descricao}</p>}
                      </div>

                      <span className="text-xs text-ink/40 shrink-0">{formatarHora(n.created_at)}</span>

                      {!n.lida ? (
                        <button
                          onClick={(e) => marcarLidaSemAbrir(e, n)}
                          className="shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-semibold text-ink/50 hover:bg-white hover:text-ink"
                          title="Marcar como visualizada, sem abrir"
                        >
                          ✓ Visualizar
                        </button>
                      ) : (
                        <span className="h-2 w-2 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

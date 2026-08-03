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
}

const ICONE_POR_TIPO: Record<string, string> = {
  mencao_chat: "💬",
  comentario_cliente: "📅",
};

function formatarQuando(iso: string) {
  const data = new Date(iso);
  const agora = new Date();
  const diffMin = Math.floor((agora.getTime() - data.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `${diffHoras}h`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
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
      .select("id, tipo, titulo, descricao, link, lida, created_at")
      .eq("destinatario_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
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

  async function marcarComoLida(n: Notificacao) {
    setNotificacoes((atual) => atual.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    const supabase = createClient();
    await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
    if (n.link) router.push(n.link);
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Caixa de Entrada</h1>
          <p className="text-sm text-ink/60">Menções, respostas e lembretes num só lugar.</p>
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

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : listaAtual.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">
            {aba === "nao_lidas" ? "Tudo em dia por aqui. 🎉" : "Nada visualizado ainda."}
          </p>
        ) : (
          listaAtual.map((n) => (
            <button
              key={n.id}
              onClick={() => marcarComoLida(n)}
              className={`w-full text-left flex items-start gap-3 px-5 py-4 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors ${
                !n.lida ? "bg-mint/20" : ""
              }`}
            >
              <span className="text-lg shrink-0">{ICONE_POR_TIPO[n.tipo] ?? "🔔"}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{n.titulo}</span>
                  <span className="text-xs text-ink/40 shrink-0">{formatarQuando(n.created_at)}</span>
                </span>
                {n.descricao && <span className="block text-xs text-ink/60 mt-0.5 truncate">{n.descricao}</span>}
              </span>
              {!n.lida && <span className="h-2 w-2 rounded-full bg-forest shrink-0 mt-1.5" />}
            </button>
          ))
        )}
      </div>
    </main>
  );
}

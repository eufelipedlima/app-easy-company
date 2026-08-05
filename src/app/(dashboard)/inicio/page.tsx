"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";

interface ItemAgenda {
  id: string;
  titulo: string;
  tipo: "tarefa" | "conteudo";
  clienteNome: string | null;
  statusNome: string;
  statusCor: string;
  data: string | null;
  link: string;
}

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

interface CanalChat {
  id: string;
  nome: string;
  ultimaMensagem: string | null;
  naoLidas: number;
}

const ICONE_NOTIFICACAO: Record<string, string> = {
  mencao_chat: "💬",
  mencao_tarefa: "💬",
  mencao_conteudo: "💬",
  comentario_cliente: "📅",
  atribuicao_tarefa: "👤",
  atribuicao_conteudo: "👤",
  mudanca_tarefa: "✏️",
  mudanca_conteudo: "✏️",
};

function toISODateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function InicioPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<ItemAgenda[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [canaisChat, setCanaisChat] = useState<CanalChat[]>([]);
  const [grupoAberto, setGrupoAberto] = useState<string | null>("hoje");

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

    const { data: funcionario } = await supabase
      .from("funcionarios")
      .select("id, papeis ( pessoas ( nome, apelido ) )")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const f = funcionario as unknown as { id: string; papeis: { pessoas: { nome: string; apelido: string | null } | null } | null } | null;
    setNome(f?.papeis?.pessoas?.apelido || f?.papeis?.pessoas?.nome || "");

    if (f) {
      const [{ data: tarefasResp }, { data: postsResp }] = await Promise.all([
        supabase.from("tarefas_responsaveis").select("tarefa_id").eq("funcionario_id", f.id),
        supabase.from("posts_conteudo_responsaveis").select("post_id").eq("funcionario_id", f.id),
      ]);

      const idsTarefas = (tarefasResp ?? []).map((t) => t.tarefa_id);
      const idsPosts = (postsResp ?? []).map((p) => p.post_id);

      const [{ data: tarefasData }, { data: postsData }] = await Promise.all([
        idsTarefas.length > 0
          ? supabase
              .from("tarefas")
              .select("id, titulo, prazo, status_id, clientes ( papeis ( pessoas ( nome ) ) ), status_conteudo ( nome, cor )")
              .in("id", idsTarefas)
              .eq("arquivada", false)
          : Promise.resolve({ data: [] }),
        idsPosts.length > 0
          ? supabase
              .from("posts_conteudo")
              .select("id, titulo, data_publicacao, status_id, clientes ( papeis ( pessoas ( nome ) ) ), status_conteudo ( nome, cor )")
              .in("id", idsPosts)
              .eq("arquivado", false)
          : Promise.resolve({ data: [] }),
      ]);

      const listaTarefas: ItemAgenda[] = ((tarefasData ?? []) as unknown as {
        id: string;
        titulo: string;
        prazo: string | null;
        clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
        status_conteudo: { nome: string; cor: string } | null;
      }[]).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        tipo: "tarefa",
        clienteNome: t.clientes?.papeis?.pessoas?.nome ?? null,
        statusNome: t.status_conteudo?.nome ?? "—",
        statusCor: t.status_conteudo?.cor ?? "cinza",
        data: t.prazo,
        link: `/tarefas/${t.id}`,
      }));

      const listaPosts: ItemAgenda[] = ((postsData ?? []) as unknown as {
        id: string;
        titulo: string | null;
        data_publicacao: string;
        clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
        status_conteudo: { nome: string; cor: string } | null;
      }[]).map((p) => ({
        id: p.id,
        titulo: p.titulo || "Sem título",
        tipo: "conteudo",
        clienteNome: p.clientes?.papeis?.pessoas?.nome ?? null,
        statusNome: p.status_conteudo?.nome ?? "—",
        statusCor: p.status_conteudo?.cor ?? "cinza",
        data: p.data_publicacao,
        link: `/conteudo/calendario/post/${p.id}`,
      }));

      setItens([...listaTarefas, ...listaPosts]);
    }

    const { data: notifData } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, descricao, link, lida, created_at")
      .eq("destinatario_id", user.id)
      .eq("lida", false)
      .order("created_at", { ascending: false })
      .limit(5);
    setNotificacoes(notifData ?? []);

    const { data: participacoes } = await supabase
      .from("chat_participantes")
      .select("canal_id, ultima_leitura, chat_canais ( id, tipo, nome, cliente_id )")
      .eq("auth_user_id", user.id)
      .eq("arquivado", false);

    const canaisRaw = (participacoes ?? [])
      .map((p) => ({ canal: p.chat_canais as unknown as { id: string; tipo: string; nome: string | null; cliente_id: string | null } | null, ultimaLeitura: p.ultima_leitura as string }))
      .filter((c) => c.canal);

    const canaisComInfo: CanalChat[] = await Promise.all(
      canaisRaw.map(async ({ canal, ultimaLeitura }) => {
        const c = canal!;
        const { data: ultimasMsgs } = await supabase
          .from("chat_mensagens")
          .select("texto, created_at")
          .eq("canal_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const { count } = await supabase
          .from("chat_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("canal_id", c.id)
          .gt("created_at", ultimaLeitura)
          .neq("autor_id", user.id);

        let nomeExibicao = c.nome ?? "Conversa";
        if (c.tipo === "dm") {
          const { data: outro } = await supabase
            .from("chat_participantes")
            .select("auth_user_id")
            .eq("canal_id", c.id)
            .neq("auth_user_id", user.id)
            .maybeSingle();
          if (outro) {
            const { data: fOutro } = await supabase
              .from("funcionarios")
              .select("papeis ( pessoas ( nome, apelido ) )")
              .eq("auth_user_id", outro.auth_user_id)
              .maybeSingle();
            const pessoa = (fOutro as unknown as { papeis: { pessoas: { nome: string; apelido: string | null } | null } | null } | null)?.papeis
              ?.pessoas;
            nomeExibicao = pessoa?.apelido || pessoa?.nome || "Colega";
          }
        } else if (c.tipo === "cliente" && c.cliente_id) {
          const { data: cliente } = await supabase.from("clientes").select("papeis ( pessoas ( nome ) )").eq("id", c.cliente_id).maybeSingle();
          nomeExibicao =
            (cliente as unknown as { papeis: { pessoas: { nome: string } | null } | null } | null)?.papeis?.pessoas?.nome ?? nomeExibicao;
        }

        return {
          id: c.id,
          nome: nomeExibicao,
          ultimaMensagem: ultimasMsgs?.[0]?.texto ?? null,
          naoLidas: count ?? 0,
        };
      })
    );

    canaisComInfo.sort((a, b) => b.naoLidas - a.naoLidas);
    setCanaisChat(canaisComInfo.slice(0, 5));

    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const hojeISO = toISODateLocal(new Date());
  const daqui7Dias = new Date();
  daqui7Dias.setDate(daqui7Dias.getDate() + 7);
  const daqui7ISO = toISODateLocal(daqui7Dias);

  const emAtraso = itens.filter((i) => i.data && i.data < hojeISO);
  const hoje = itens.filter((i) => i.data === hojeISO);
  const proximos = itens.filter((i) => i.data && i.data > hojeISO && i.data <= daqui7ISO);
  const semData = itens.filter((i) => !i.data);

  const agenda = itens
    .filter((i) => i.data && i.data >= hojeISO)
    .sort((a, b) => (a.data! < b.data! ? -1 : 1))
    .slice(0, 8);

  const grupos = [
    { chave: "atraso", label: "Em atraso", lista: emAtraso },
    { chave: "hoje", label: "Hoje", lista: hoje },
    { chave: "proximos", label: "Próximos 7 dias", lista: proximos },
    { chave: "semdata", label: "Sem data", lista: semData },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-extrabold text-ink mb-8">
        {saudacao()}{nome ? `, ${nome}` : ""}
      </h1>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-3xl bg-card border border-black/5 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink/50 mb-3">Minhas tarefas e conteúdos</h2>
            <div className="space-y-1">
              {grupos.map((g) => (
                <div key={g.chave}>
                  <button
                    onClick={() => setGrupoAberto(grupoAberto === g.chave ? null : g.chave)}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-xl hover:bg-surface transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span className={`text-xs transition-transform ${grupoAberto === g.chave ? "rotate-90" : ""}`}>▶</span>
                      {g.label}
                    </span>
                    <span className="text-xs font-bold text-ink/40">{g.lista.length}</span>
                  </button>
                  {grupoAberto === g.chave && (
                    <div className="pl-6 space-y-1 mb-2">
                      {g.lista.length === 0 ? (
                        <p className="text-xs text-ink/40 py-1">Nada por aqui.</p>
                      ) : (
                        g.lista.map((item) => (
                          <button
                            key={`${item.tipo}-${item.id}`}
                            onClick={() => router.push(item.link)}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-surface transition-colors text-left"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span>{item.tipo === "tarefa" ? "✔️" : "📅"}</span>
                              <span className="text-sm text-ink truncate">{item.titulo}</span>
                              {item.clienteNome && <span className="text-xs text-ink/40 shrink-0">· {item.clienteNome}</span>}
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              {item.data && <span className="text-xs text-ink/40">{formatarData(item.data)}</span>}
                              <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${corDoStatus(item.statusCor).cor}`}>
                                {item.statusNome}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl bg-card border border-black/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink/50 mb-3">Agenda — próximos dias</h2>
              {agenda.length === 0 ? (
                <p className="text-sm text-ink/40">Nada com data marcada por enquanto.</p>
              ) : (
                <div className="space-y-1">
                  {agenda.map((item) => (
                    <button
                      key={`${item.tipo}-${item.id}`}
                      onClick={() => router.push(item.link)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-surface transition-colors text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-forest w-10 shrink-0">{formatarData(item.data!)}</span>
                        <span className="text-sm text-ink truncate">{item.titulo}</span>
                      </span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${corDoStatus(item.statusCor).cor}`}>
                        {item.statusNome}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-card border border-black/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink/50">Caixa de Entrada</h2>
                <button onClick={() => router.push("/caixa-de-entrada")} className="text-xs font-semibold text-forest hover:text-ink">
                  Ver tudo →
                </button>
              </div>
              {notificacoes.length === 0 ? (
                <p className="text-sm text-ink/40">Tudo em dia. 🎉</p>
              ) : (
                <div className="space-y-1">
                  {notificacoes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => router.push(n.link || "/caixa-de-entrada")}
                      className="w-full flex items-start gap-2 px-2 py-2 rounded-xl hover:bg-surface transition-colors text-left"
                    >
                      <span className="text-base shrink-0">{ICONE_NOTIFICACAO[n.tipo] ?? "🔔"}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink truncate">{n.titulo}</span>
                        {n.descricao && <span className="block text-xs text-ink/50 truncate">{n.descricao}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-card border border-black/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink/50">Chat</h2>
                <button onClick={() => router.push("/chat")} className="text-xs font-semibold text-forest hover:text-ink">
                  Abrir chat →
                </button>
              </div>
              {canaisChat.length === 0 ? (
                <p className="text-sm text-ink/40">Nenhuma conversa ainda.</p>
              ) : (
                <div className="space-y-1">
                  {canaisChat.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => router.push("/chat")}
                      className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-surface transition-colors text-left"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink truncate">{c.nome}</span>
                        {c.ultimaMensagem && <span className="block text-xs text-ink/50 truncate">{c.ultimaMensagem}</span>}
                      </span>
                      {c.naoLidas > 0 && (
                        <span className="shrink-0 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">{c.naoLidas}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

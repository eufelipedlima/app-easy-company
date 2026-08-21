"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";
import { NumeroAnimado } from "@/components/numero-animado";

interface ItemTrabalho {
  id: string;
  titulo: string;
  tipo: "tarefa" | "conteudo";
  statusNome: string;
  statusCor: string;
  clienteNome: string | null;
  data: string | null;
  link: string;
}

interface AtividadeItem {
  id: string;
  descricao: string;
  created_at: string;
  itemTitulo: string;
  link: string;
  tipo: "tarefa" | "conteudo";
}

interface TempoPorCliente {
  clienteNome: string;
  segundos: number;
}

type Periodo = "mes" | "semana" | "tudo";

function inicioFimPeriodo(periodo: Periodo): { inicio: string | null; fim: string | null } {
  const hoje = new Date();
  if (periodo === "tudo") return { inicio: null, fim: null };
  if (periodo === "semana") {
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - hoje.getDay());
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
  }
  // mes
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

function formatarDuracao(totalSegundos: number) {
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  if (h === 0 && m === 0) return "0min";
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}
function formatarQuandoRelativo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

export default function MembroDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [cargoNome, setCargoNome] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemTrabalho[]>([]);
  const [atividade, setAtividade] = useState<AtividadeItem[]>([]);
  const [tempoPorCliente, setTempoPorCliente] = useState<TempoPorCliente[]>([]);
  const [tempoTotalGeral, setTempoTotalGeral] = useState(0);
  const [filtro, setFiltro] = useState<"abertas" | "concluidas" | "atrasadas">("abertas");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [souAdmin, setSouAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function carregarPermissao() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSouAdmin(false);
        return;
      }
      const { data: perfilData } = await supabase
        .from("funcionarios")
        .select("perfis_acesso ( nome )")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const nomePerfil = (perfilData as unknown as { perfis_acesso: { nome: string } | null } | null)?.perfis_acesso?.nome;
      setSouAdmin(nomePerfil === "Administrador");
    }
    carregarPermissao();
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const hojeISO = new Date().toISOString().slice(0, 10);

    const { data: func } = await supabase
      .from("funcionarios")
      .select("auth_user_id, papeis ( pessoas ( nome, foto_url ) ), cargos ( nome )")
      .eq("id", id)
      .maybeSingle();
    const f = func as unknown as {
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; foto_url: string | null } | null } | null;
      cargos: { nome: string } | null;
    } | null;
    setNome(f?.papeis?.pessoas?.nome ?? "—");
    setFotoUrl(f?.papeis?.pessoas?.foto_url ?? null);
    setCargoNome(f?.cargos?.nome ?? null);

    const { data: statusData } = await supabase.from("status_conteudo").select("id, nome, cor");
    const mapaStatus = new Map((statusData ?? []).map((s) => [s.id, s]));

    const [{ data: respTarefas }, { data: respPosts }] = await Promise.all([
      supabase
        .from("tarefas_responsaveis")
        .select(
          "tarefas ( id, titulo, status_id, prazo, tempo_total_segundos, arquivada, excluido_em, clientes ( papeis ( pessoas ( nome ) ) ) )"
        )
        .eq("funcionario_id", id),
      supabase
        .from("posts_conteudo_responsaveis")
        .select(
          "posts_conteudo ( id, titulo, status_id, data_publicacao, tempo_total_segundos, arquivado, excluido_em, clientes ( papeis ( pessoas ( nome ) ) ) )"
        )
        .eq("funcionario_id", id),
    ]);

    type TarefaJoin = {
      id: string;
      titulo: string;
      status_id: string;
      prazo: string | null;
      tempo_total_segundos: number;
      arquivada: boolean;
      excluido_em: string | null;
      clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
    };
    type PostJoin = {
      id: string;
      titulo: string | null;
      status_id: string;
      data_publicacao: string;
      tempo_total_segundos: number;
      arquivado: boolean;
      excluido_em: string | null;
      clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
    };

    const minhasTarefas = ((respTarefas ?? []) as unknown as { tarefas: TarefaJoin | null }[])
      .map((r) => r.tarefas)
      .filter((t): t is TarefaJoin => !!t && !t.arquivada && !t.excluido_em);
    const meusPosts = ((respPosts ?? []) as unknown as { posts_conteudo: PostJoin | null }[])
      .map((r) => r.posts_conteudo)
      .filter((p): p is PostJoin => !!p && !p.arquivado && !p.excluido_em);

    const { inicio, fim } = inicioFimPeriodo(periodo);
    const dentroDoPeriodo = (data: string | null) => {
      if (!inicio || !fim) return true;
      if (!data) return false;
      return data >= inicio && data <= fim;
    };

    const listaItens: ItemTrabalho[] = [
      ...minhasTarefas
        .filter((t) => dentroDoPeriodo(t.prazo))
        .map((t) => ({
          id: t.id,
          titulo: t.titulo,
          tipo: "tarefa" as const,
          statusNome: mapaStatus.get(t.status_id)?.nome ?? "—",
          statusCor: mapaStatus.get(t.status_id)?.cor ?? "cinza",
          clienteNome: t.clientes?.papeis?.pessoas?.nome ?? null,
          data: t.prazo,
          link: `/tarefas/${t.id}`,
        })),
      ...meusPosts
        .filter((p) => dentroDoPeriodo(p.data_publicacao))
        .map((p) => ({
          id: p.id,
          titulo: p.titulo || "Sem título",
          tipo: "conteudo" as const,
          statusNome: mapaStatus.get(p.status_id)?.nome ?? "—",
          statusCor: mapaStatus.get(p.status_id)?.cor ?? "cinza",
          clienteNome: p.clientes?.papeis?.pessoas?.nome ?? null,
          data: p.data_publicacao,
          link: `/conteudo/calendario/post/${p.id}`,
        })),
    ];
    setItens(listaItens);

    // Total geral de horas: soma direta do tempo_total_segundos de tudo que a
    // pessoa é responsável — igual à tela de visão geral da Equipe faz. Antes,
    // aqui embaixo o total vinha de tentar reconstruir o tempo lendo o texto
    // do histórico (limitado a 300 registros e só dentro do período
    // selecionado), o que dava números bem menores e inconsistentes.
    const tempoTotalReal =
      minhasTarefas.filter((t) => dentroDoPeriodo(t.prazo)).reduce((s, t) => s + (t.tempo_total_segundos ?? 0), 0) +
      meusPosts.filter((p) => dentroDoPeriodo(p.data_publicacao)).reduce((s, p) => s + (p.tempo_total_segundos ?? 0), 0);
    setTempoTotalGeral(tempoTotalReal);

    // O detalhamento "por cliente" abaixo continua respeitando o período
    // selecionado, mas agora soma o tempo_total_segundos de cada tarefa/post
    // (a mesma fonte confiável), em vez de tentar interpretar o texto do
    // histórico.
    const tempoMap = new Map<string, number>();
    for (const t of minhasTarefas.filter((t) => dentroDoPeriodo(t.prazo))) {
      const cli = t.clientes?.papeis?.pessoas?.nome ?? "Sem cliente";
      tempoMap.set(cli, (tempoMap.get(cli) ?? 0) + (t.tempo_total_segundos ?? 0));
    }
    for (const p of meusPosts.filter((p) => dentroDoPeriodo(p.data_publicacao))) {
      const cli = p.clientes?.papeis?.pessoas?.nome ?? "Sem cliente";
      tempoMap.set(cli, (tempoMap.get(cli) ?? 0) + (p.tempo_total_segundos ?? 0));
    }
    setTempoPorCliente(
      Array.from(tempoMap.entries())
        .map(([clienteNome, segundos]) => ({ clienteNome, segundos }))
        .filter((t) => t.segundos > 0)
        .sort((a, b) => b.segundos - a.segundos)
    );

    if (f?.auth_user_id) {
      let queryHistT = supabase
        .from("tarefas_historico")
        .select("id, descricao, created_at, tarefa_id, tarefas ( titulo )")
        .eq("autor_id", f.auth_user_id)
        .order("created_at", { ascending: false })
        .limit(300);
      let queryHistP = supabase
        .from("posts_conteudo_historico")
        .select("id, descricao, created_at, post_id, posts_conteudo ( titulo )")
        .eq("autor_id", f.auth_user_id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (inicio) queryHistT = queryHistT.gte("created_at", inicio);
      if (fim) queryHistT = queryHistT.lte("created_at", `${fim}T23:59:59`);
      if (inicio) queryHistP = queryHistP.gte("created_at", inicio);
      if (fim) queryHistP = queryHistP.lte("created_at", `${fim}T23:59:59`);

      const [{ data: histT }, { data: histP }] = await Promise.all([queryHistT, queryHistP]);

      type HistT = { id: string; descricao: string; created_at: string; tarefa_id: string; tarefas: { titulo: string } | null };
      type HistP = { id: string; descricao: string; created_at: string; post_id: string; posts_conteudo: { titulo: string | null } | null };
      const listaHistT = (histT ?? []) as unknown as HistT[];
      const listaHistP = (histP ?? []) as unknown as HistP[];

      const atv: AtividadeItem[] = [
        ...listaHistT.map((h) => ({
          id: h.id,
          descricao: h.descricao,
          created_at: h.created_at,
          itemTitulo: h.tarefas?.titulo ?? "Tarefa",
          link: `/tarefas/${h.tarefa_id}`,
          tipo: "tarefa" as const,
        })),
        ...listaHistP.map((h) => ({
          id: h.id,
          descricao: h.descricao,
          created_at: h.created_at,
          itemTitulo: h.posts_conteudo?.titulo || "Conteúdo",
          link: `/conteudo/calendario/post/${h.post_id}`,
          tipo: "conteudo" as const,
        })),
      ]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 15);
      setAtividade(atv);
    } else {
      setAtividade([]);
    }

    void hojeISO;
    setLoading(false);
  }, [id, periodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const hojeISO = new Date().toISOString().slice(0, 10);
  const concluidas = itens.filter((i) => corDoStatus(i.statusCor) && i.statusCor === "verde");
  const itensAbertos = itens.filter((i) => i.statusCor !== "verde");
  const atrasadas = itensAbertos.filter((i) => i.data && i.data < hojeISO);
  const tempoTotal = tempoTotalGeral;
  const maiorTempo = Math.max(...tempoPorCliente.map((t) => t.segundos), 1);

  const listaFiltrada = filtro === "concluidas" ? concluidas : filtro === "atrasadas" ? atrasadas : itensAbertos;

  if (souAdmin === false) {
    return (
      <main className="w-full px-6 sm:px-8 lg:px-10 py-16 flex flex-col items-center justify-center text-center">
        <span className="text-4xl mb-3">🔒</span>
        <h1 className="text-lg font-bold text-ink mb-1">Só administradores acessam essa página</h1>
        <p className="text-sm text-ink/50">Volte pra <a href="/inicio" className="text-forest font-semibold hover:underline">Início</a>.</p>
      </main>
    );
  }

  if (souAdmin === null) {
    return <main className="w-full px-6 sm:px-8 lg:px-10 py-10" />;
  }

  return (
    <main className="w-full px-6 sm:px-8 lg:px-10 py-10">
      <button onClick={() => router.push("/equipe")} className="text-xs font-semibold text-ink/50 hover:text-ink mb-5">
        ← Meu Time
      </button>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-4">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt={nome} className="h-20 w-20 rounded-full object-cover shadow-sm" />
              ) : (
                <div className={`h-20 w-20 rounded-full ${corAvatar(nome)} text-white flex items-center justify-center font-bold text-2xl shadow-sm`}>
                  {nome.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-extrabold text-ink">{nome}</h1>
                {cargoNome && <p className="text-sm text-ink/50">{cargoNome}</p>}
              </div>
            </div>

            <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 shrink-0">
              <button
                onClick={() => setPeriodo("semana")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  periodo === "semana" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Esta semana
              </button>
              <button
                onClick={() => setPeriodo("mes")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  periodo === "mes" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Este mês
              </button>
              <button
                onClick={() => setPeriodo("tudo")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  periodo === "tudo" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Tudo
              </button>
            </div>
          </div>

          <div className="anim-stagger grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <button
              onClick={() => setFiltro("abertas")}
              className={`rounded-2xl p-4 text-left transition-all ${filtro === "abertas" ? "bg-ink text-white" : "bg-card border border-black/5 hover:shadow-sm"}`}
            >
              <NumeroAnimado valor={itensAbertos.length} className="block text-2xl font-extrabold" />
              <p className={`text-xs font-semibold ${filtro === "abertas" ? "text-white/70" : "text-ink/50"}`}>Em aberto</p>
            </button>
            <button
              onClick={() => setFiltro("concluidas")}
              className={`rounded-2xl p-4 text-left transition-all ${filtro === "concluidas" ? "bg-emerald-600 text-white" : "bg-card border border-black/5 hover:shadow-sm"}`}
            >
              <NumeroAnimado valor={concluidas.length} className="block text-2xl font-extrabold" />
              <p className={`text-xs font-semibold ${filtro === "concluidas" ? "text-white/70" : "text-ink/50"}`}>Concluídas</p>
            </button>
            <button
              onClick={() => setFiltro("atrasadas")}
              className={`rounded-2xl p-4 text-left transition-all ${filtro === "atrasadas" ? "bg-red-600 text-white" : "bg-card border border-black/5 hover:shadow-sm"}`}
            >
              <NumeroAnimado valor={atrasadas.length} className="block text-2xl font-extrabold" />
              <p className={`text-xs font-semibold ${filtro === "atrasadas" ? "text-white/70" : "text-ink/50"}`}>Atrasadas</p>
            </button>
            <div className="rounded-2xl p-4 bg-card border border-black/5">
              <p className="text-2xl font-extrabold text-ink">{formatarDuracao(tempoTotal)}</p>
              <p className="text-xs font-semibold text-ink/50">
                Tempo {periodo === "tudo" ? "total" : periodo === "mes" ? "este mês" : "esta semana"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-3xl bg-card border border-black/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-ink">
                  {filtro === "abertas" ? "Tarefas e conteúdos em aberto" : filtro === "concluidas" ? "Concluídas" : "Atrasadas"}
                </h2>
                <span className="text-xs text-ink/40">{listaFiltrada.length}</span>
              </div>
              {listaFiltrada.length === 0 ? (
                <p className="text-xs text-ink/40 py-6 text-center">Nada por aqui. 🎉</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {listaFiltrada.map((item) => (
                    <button
                      key={`${item.tipo}-${item.id}`}
                      onClick={() => router.push(item.link)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-surface transition-colors text-left"
                    >
                      <span className="text-sm shrink-0">{item.tipo === "tarefa" ? "✔️" : "📅"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink truncate">{item.titulo}</span>
                        {item.clienteNome && <span className="block text-[11px] text-ink/40 truncate">{item.clienteNome}</span>}
                      </span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${corDoStatus(item.statusCor).cor}`}>
                        {item.statusNome}
                      </span>
                      {item.data && (
                        <span className={`text-[11px] shrink-0 ${item.data < hojeISO && filtro !== "concluidas" ? "text-red-600 font-semibold" : "text-ink/40"}`}>
                          {formatarData(item.data)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-card border border-black/5 p-5">
                <h2 className="text-sm font-bold text-ink mb-3">
                  ⏱️ Tempo por cliente {periodo !== "tudo" && <span className="text-ink/40 font-medium">· {periodo === "mes" ? "este mês" : "esta semana"}</span>}
                </h2>
                {tempoPorCliente.length === 0 ? (
                  <p className="text-xs text-ink/40">Nenhum tempo registrado ainda.</p>
                ) : (
                  <div className="space-y-2.5">
                    {tempoPorCliente.slice(0, 6).map((t) => (
                      <div key={t.clienteNome}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-ink truncate">{t.clienteNome}</span>
                          <span className="text-xs text-ink/50 shrink-0">{formatarDuracao(t.segundos)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-forest transition-all duration-700 ease-out"
                            style={{ width: `${(t.segundos / maiorTempo) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-card border border-black/5 p-5">
                <h2 className="text-sm font-bold text-ink mb-3">🕐 Atividade recente</h2>
                {atividade.length === 0 ? (
                  <p className="text-xs text-ink/40">Nada por aqui ainda.</p>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {atividade.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => router.push(a.link)}
                        className="w-full flex items-start gap-2 text-left hover:bg-surface rounded-xl px-1.5 py-1 -mx-1.5 transition-colors"
                      >
                        <span className="text-sm shrink-0 mt-0.5">{a.tipo === "tarefa" ? "✔️" : "📅"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="text-xs text-ink block truncate">{a.descricao}</span>
                          <span className="text-[11px] text-ink/40 block truncate">{a.itemTitulo}</span>
                        </span>
                        <span className="text-[10px] text-ink/30 shrink-0">{formatarQuandoRelativo(a.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";
import { NumeroAnimado } from "@/components/numero-animado";
import { rotinaAplicavelNaData } from "@/app/(dashboard)/rotinas/page";

interface ItemTrabalho {
  id: string;
  titulo: string;
  tipo: "tarefa" | "conteudo";
  statusNome: string;
  statusCor: string;
  clienteNome: string | null;
  data: string | null;
  link: string;
  segundos: number;
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
const DIAS_SEMANA_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function descreverFrequencia(r: { frequencia: string; dias_semana: number[] | null; dia_mes: number | null }): string {
  if (r.frequencia === "diaria") return "Todo dia";
  if (r.frequencia === "semanal") return (r.dias_semana ?? []).map((d) => DIAS_SEMANA_LABEL[d]).join(", ") || "Semanal";
  if (r.frequencia === "mensal") return `Todo dia ${r.dia_mes ?? "?"}`;
  return "";
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
  const [temAcesso, setTemAcesso] = useState<boolean | null>(null);
  const [aba, setAba] = useState<"geral" | "tarefas" | "tempo" | "rotina">("geral");

  // ---------------- Aba Rotina ----------------
  const [meuCargoIdMembro, setMeuCargoIdMembro] = useState<string | null>(null);
  const [dataRotina, setDataRotina] = useState(() => {
    const hj = new Date();
    hj.setHours(0, 0, 0, 0);
    return hj;
  });
  const [rotinasDoMembro, setRotinasDoMembro] = useState<
    { id: string; texto: string; grupo: string | null; frequencia: string; dias_semana: number[] | null; dia_mes: number | null; concluido: boolean }[]
  >([]);
  const [loadingRotina, setLoadingRotina] = useState(false);

  useEffect(() => {
    async function carregarPermissao() {
      const supabase = createClient();
      const { data: nivel } = await supabase.rpc("meu_nivel_acesso", { area_slug: "equipe" });
      setTemAcesso(nivel !== "nenhum");
    }
    carregarPermissao();
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const hojeISO = new Date().toISOString().slice(0, 10);

    const { data: func } = await supabase
      .from("funcionarios")
      .select("auth_user_id, cargo_id, papeis ( pessoas ( nome, foto_url ) ), cargos ( nome )")
      .eq("id", id)
      .maybeSingle();
    const f = func as unknown as {
      auth_user_id: string | null;
      cargo_id: string | null;
      papeis: { pessoas: { nome: string; foto_url: string | null } | null } | null;
      cargos: { nome: string } | null;
    } | null;
    setNome(f?.papeis?.pessoas?.nome ?? "—");
    setFotoUrl(f?.papeis?.pessoas?.foto_url ?? null);
    setCargoNome(f?.cargos?.nome ?? null);
    setMeuCargoIdMembro(f?.cargo_id ?? null);

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
          segundos: t.tempo_total_segundos ?? 0,
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
          segundos: p.tempo_total_segundos ?? 0,
        })),
    ];
    setItens(listaItens);

    // Tempo total e por cliente: soma direta do tempo_total_segundos de
    // cada tarefa/conteúdo que a pessoa é responsável, filtrado pelo
    // período selecionado. Simples e direto — sem tentar reconstruir nada
    // lendo texto do histórico.
    const tempoTotalReal =
      minhasTarefas.filter((t) => dentroDoPeriodo(t.prazo)).reduce((s, t) => s + (t.tempo_total_segundos ?? 0), 0) +
      meusPosts.filter((p) => dentroDoPeriodo(p.data_publicacao)).reduce((s, p) => s + (p.tempo_total_segundos ?? 0), 0);
    setTempoTotalGeral(tempoTotalReal);

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

  const carregarRotinaDoMembro = useCallback(async () => {
    setLoadingRotina(true);
    const supabase = createClient();
    const dataIso = dataRotina.toISOString().slice(0, 10);
    const [{ data: rotinasData }, { data: respCargoData }, { data: respFuncData }] = await Promise.all([
      supabase.from("rotinas").select("id, texto, grupo, frequencia, dias_semana, dia_mes").eq("ativo", true),
      supabase.from("rotina_responsaveis_cargo").select("rotina_id, cargo_id"),
      supabase.from("rotina_responsaveis_funcionario").select("rotina_id, funcionario_id"),
    ]);
    const dela = (rotinasData ?? [])
      .filter(
        (r) =>
          (meuCargoIdMembro && (respCargoData ?? []).some((c) => c.rotina_id === r.id && c.cargo_id === meuCargoIdMembro)) ||
          (respFuncData ?? []).some((rf) => rf.rotina_id === r.id && rf.funcionario_id === id)
      )
      .filter((r) => rotinaAplicavelNaData(r, dataRotina));

    const idsRotinas = dela.map((r) => r.id);
    const { data: execucoes } =
      idsRotinas.length > 0
        ? await supabase.from("rotina_execucoes").select("rotina_id").eq("funcionario_id", id).eq("data_referencia", dataIso).in("rotina_id", idsRotinas)
        : { data: [] };
    const feitos = new Set((execucoes ?? []).map((e) => e.rotina_id));

    setRotinasDoMembro(dela.map((r) => ({ ...r, concluido: feitos.has(r.id) })));
    setLoadingRotina(false);
  }, [id, meuCargoIdMembro, dataRotina]);

  useEffect(() => {
    if (aba === "rotina" && meuCargoIdMembro !== undefined) carregarRotinaDoMembro();
  }, [aba, carregarRotinaDoMembro, meuCargoIdMembro]);

  function mudarDiaRotina(delta: number) {
    setDataRotina((atual) => {
      const nova = new Date(atual);
      nova.setDate(nova.getDate() + delta);
      return nova;
    });
  }

  const hojeISO = new Date().toISOString().slice(0, 10);
  const concluidas = itens.filter((i) => corDoStatus(i.statusCor) && i.statusCor === "verde");
  const itensAbertos = itens.filter((i) => i.statusCor !== "verde");
  const atrasadas = itensAbertos.filter((i) => i.data && i.data < hojeISO);
  const tempoTotal = tempoTotalGeral;
  const maiorTempo = Math.max(...tempoPorCliente.map((t) => t.segundos), 1);

  const listaFiltrada = filtro === "concluidas" ? concluidas : filtro === "atrasadas" ? atrasadas : itensAbertos;

  const hojeRotinaEhHoje = (() => {
    const hj = new Date();
    hj.setHours(0, 0, 0, 0);
    return dataRotina.getTime() === hj.getTime();
  })();
  const gruposRotinaMembro: { grupo: string | null; itens: typeof rotinasDoMembro }[] = [];
  for (const r of rotinasDoMembro) {
    let bucket = gruposRotinaMembro.find((g) => g.grupo === r.grupo);
    if (!bucket) {
      bucket = { grupo: r.grupo, itens: [] };
      gruposRotinaMembro.push(bucket);
    }
    bucket.itens.push(r);
  }
  const tempoPorTarefa = [...itens].filter((i) => i.segundos > 0).sort((a, b) => b.segundos - a.segundos);

  if (temAcesso === false) {
    return (
      <main className="w-full px-6 sm:px-8 lg:px-10 py-16 flex flex-col items-center justify-center text-center">
        <span className="text-4xl mb-3">🔒</span>
        <h1 className="text-lg font-bold text-ink mb-1">Você não tem acesso a essa página</h1>
        <p className="text-sm text-ink/50">Volte pra <a href="/inicio" className="text-forest font-semibold hover:underline">Início</a>.</p>
      </main>
    );
  }

  if (temAcesso === null) {
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
          </div>

          <div className="flex items-center gap-6 border-b-2 border-black/5 mb-6">
            {[
              { chave: "geral" as const, label: "Visão geral" },
              { chave: "tarefas" as const, label: "Tarefas recentes" },
              { chave: "tempo" as const, label: "Tempo por cliente e tarefa" },
              { chave: "rotina" as const, label: "Rotina" },
            ].map((t) => (
              <button
                key={t.chave}
                onClick={() => setAba(t.chave)}
                className={`relative pb-2.5 text-sm font-bold transition-colors ${aba === t.chave ? "text-ink" : "text-ink/40 hover:text-ink/70"}`}
              >
                {t.label}
                {aba === t.chave && <span className="absolute left-0 right-0 -bottom-0.5 h-[3px] rounded-full bg-ink" />}
              </button>
            ))}
          </div>

          {aba !== "rotina" && (
            <div className="flex justify-end mb-4">
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
          )}

          {aba === "geral" && (
            <>
              <div className="anim-stagger grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="rounded-2xl p-4 bg-card border border-black/5">
                  <NumeroAnimado valor={itensAbertos.length} className="block text-2xl font-extrabold text-ink" />
                  <p className="text-xs font-semibold text-ink/50">Em aberto</p>
                </div>
                <div className="rounded-2xl p-4 bg-card border border-black/5">
                  <NumeroAnimado valor={concluidas.length} className="block text-2xl font-extrabold text-ink" />
                  <p className="text-xs font-semibold text-ink/50">Concluídas</p>
                </div>
                <div className="rounded-2xl p-4 bg-card border border-black/5">
                  <NumeroAnimado valor={atrasadas.length} className="block text-2xl font-extrabold text-ink" />
                  <p className="text-xs font-semibold text-ink/50">Atrasadas</p>
                </div>
                <div className="rounded-2xl p-4 bg-card border border-black/5">
                  <p className="text-2xl font-extrabold text-ink">{formatarDuracao(tempoTotal)}</p>
                  <p className="text-xs font-semibold text-ink/50">
                    Tempo {periodo === "tudo" ? "total" : periodo === "mes" ? "este mês" : "esta semana"}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl bg-card border border-black/5 p-5">
                <h2 className="text-sm font-bold text-ink mb-3">🕐 Atividade recente</h2>
                {atividade.length === 0 ? (
                  <p className="text-xs text-ink/40">Nada por aqui ainda.</p>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto">
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
            </>
          )}

          {aba === "tarefas" && (
            <div className="rounded-3xl bg-card border border-black/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setFiltro("abertas")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    filtro === "abertas" ? "bg-ink text-white" : "bg-surface text-ink/50 hover:text-ink"
                  }`}
                >
                  Em aberto · {itensAbertos.length}
                </button>
                <button
                  onClick={() => setFiltro("concluidas")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    filtro === "concluidas" ? "bg-emerald-600 text-white" : "bg-surface text-ink/50 hover:text-ink"
                  }`}
                >
                  Concluídas · {concluidas.length}
                </button>
                <button
                  onClick={() => setFiltro("atrasadas")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    filtro === "atrasadas" ? "bg-red-600 text-white" : "bg-surface text-ink/50 hover:text-ink"
                  }`}
                >
                  Atrasadas · {atrasadas.length}
                </button>
              </div>
              {listaFiltrada.length === 0 ? (
                <p className="text-xs text-ink/40 py-6 text-center">Nada por aqui. 🎉</p>
              ) : (
                <div className="space-y-1">
                  {listaFiltrada.map((item) => (
                    <button
                      key={`${item.tipo}-${item.id}`}
                      onClick={() => router.push(item.link)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-surface transition-colors text-left"
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
          )}

          {aba === "tempo" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-3xl bg-card border border-black/5 p-5">
                <h2 className="text-sm font-bold text-ink mb-3">⏱️ Tempo por cliente</h2>
                {tempoPorCliente.length === 0 ? (
                  <p className="text-xs text-ink/40">Nenhum tempo registrado ainda.</p>
                ) : (
                  <div className="space-y-2.5">
                    {tempoPorCliente.map((t) => (
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
                <h2 className="text-sm font-bold text-ink mb-3">📋 Tempo por tarefa</h2>
                {tempoPorTarefa.length === 0 ? (
                  <p className="text-xs text-ink/40">Nenhum tempo registrado ainda.</p>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {tempoPorTarefa.map((item) => (
                      <button
                        key={`${item.tipo}-${item.id}`}
                        onClick={() => router.push(item.link)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-surface transition-colors text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink truncate">{item.titulo}</span>
                          {item.clienteNome && <span className="block text-[11px] text-ink/40 truncate">{item.clienteNome}</span>}
                        </span>
                        <span className="text-xs font-bold text-ink/60 shrink-0">{formatarDuracao(item.segundos)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {aba === "rotina" && (
            <div>
              <div className="flex items-center justify-center gap-4 mb-6 rounded-2xl bg-card border border-black/5 py-3">
                <button onClick={() => mudarDiaRotina(-1)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-surface text-ink/50">
                  ‹
                </button>
                <div className="text-center min-w-[140px]">
                  <p className="text-sm font-bold text-ink">
                    {hojeRotinaEhHoje ? "Hoje" : dataRotina.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  </p>
                  {!hojeRotinaEhHoje && <p className="text-[11px] text-ink/40">{dataRotina.toLocaleDateString("pt-BR")}</p>}
                </div>
                <button onClick={() => mudarDiaRotina(1)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-surface text-ink/50">
                  ›
                </button>
                {!hojeRotinaEhHoje && (
                  <button
                    onClick={() => {
                      const hj = new Date();
                      hj.setHours(0, 0, 0, 0);
                      setDataRotina(hj);
                    }}
                    className="text-xs font-semibold text-forest hover:text-ink ml-2"
                  >
                    Voltar pra hoje
                  </button>
                )}
              </div>

              {loadingRotina ? (
                <p className="text-sm text-ink/50">Carregando...</p>
              ) : rotinasDoMembro.length === 0 ? (
                <div className="rounded-2xl bg-card border border-black/5 p-8 text-center">
                  <p className="text-sm text-ink/50">Nenhuma tarefa recorrente pra {hojeRotinaEhHoje ? "hoje" : "esse dia"}.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gruposRotinaMembro.map((bucket) => (
                    <div key={bucket.grupo ?? "__solto__"} className="rounded-2xl bg-card border border-black/5 p-4">
                      {bucket.grupo && <p className="text-sm font-bold text-ink mb-2">{bucket.grupo}</p>}
                      <div className="space-y-1.5">
                        {bucket.itens.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${item.concluido ? "bg-mint/40" : "bg-surface/60"}`}
                          >
                            <span className={`h-4 w-4 rounded shrink-0 flex items-center justify-center text-[10px] ${item.concluido ? "bg-forest text-white" : "border-2 border-black/15"}`}>
                              {item.concluido ? "✓" : ""}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className={`block text-sm ${item.concluido ? "text-ink/40 line-through" : "text-ink"}`}>{item.texto}</span>
                              {!bucket.grupo && <span className="block text-[10px] text-ink/30 mt-0.5">{descreverFrequencia(item)}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

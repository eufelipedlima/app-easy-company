"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";
import { IconeTarefa } from "@/components/icones-tarefa";
import { EsqueletoLinha } from "@/components/esqueleto";

interface Responsavel {
  id: string;
  nome: string;
  fotoUrl: string | null;
  authUserId: string | null;
}

interface ItemPauta {
  id: string;
  titulo: string;
  tipo: "tarefa" | "conteudo";
  statusNome: string;
  statusCor: string;
  dataExibicao: string;
  dataInicio: string | null;
  dataFim: string | null;
  link: string;
  responsavelIds: string[];
  temDescricao: boolean;
  qtdSubitens: number;
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toISODateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatarDataCurta(iso: string) {
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
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
function Avatar({ nome, fotoUrl, tamanho = 26 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome} className="rounded-full object-cover shrink-0" style={{ height: tamanho, width: tamanho }} />;
  }
  return (
    <div
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center font-bold shrink-0`}
      style={{ height: tamanho, width: tamanho, fontSize: Math.max(9, tamanho * 0.36) }}
    >
      {iniciais(nome)}
    </div>
  );
}

function AvatarStack({ pessoas, tamanho = 16 }: { pessoas: Responsavel[]; tamanho?: number }) {
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
          className="rounded-full bg-surface ring-1 ring-white text-ink/60 font-bold flex items-center justify-center shrink-0"
          style={{ height: tamanho, width: tamanho, fontSize: Math.max(7, tamanho * 0.32) }}
        >
          +{resto}
        </div>
      )}
    </div>
  );
}

export default function PautaPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"minha" | "equipe">("minha");
  const [visualizacao, setVisualizacao] = useState<"semana" | "mes">("semana");
  const [meuFuncionarioId, setMeuFuncionarioId] = useState<string | null>(null);
  const [funcionarios, setFuncionarios] = useState<Responsavel[]>([]);
  const [itens, setItens] = useState<ItemPauta[]>([]);
  const [statusList, setStatusList] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const hoje = new Date();
  const [inicioSemana, setInicioSemana] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });

  const primeiroDiaMes = new Date(ano, mes, 1);
  const ultimoDiaMes = new Date(ano, mes + 1, 0);
  const inicioGrade = new Date(primeiroDiaMes);
  inicioGrade.setDate(inicioGrade.getDate() - primeiroDiaMes.getDay());
  const fimGrade = new Date(ultimoDiaMes);
  fimGrade.setDate(fimGrade.getDate() + (6 - ultimoDiaMes.getDay()));
  const diasMes: Date[] = [];
  for (let d = new Date(inicioGrade); d <= fimGrade; d.setDate(d.getDate() + 1)) {
    diasMes.push(new Date(d));
  }

  const diasAtivos = visualizacao === "semana" ? diasSemana : diasMes;
  const inicioISO = toISODateLocal(diasAtivos[0]);
  const fimISO = toISODateLocal(diasAtivos[diasAtivos.length - 1]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: statusData }, { data: funcData }] = await Promise.all([
      supabase.from("status_conteudo").select("id, nome, cor").order("ordem"),
      supabase.from("funcionarios").select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )").not("auth_user_id", "is", null),
    ]);
    setStatusList(statusData ?? []);
    const listaFunc = ((funcData ?? []) as unknown as {
      id: string;
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
    }[])
      .map((f) => ({ id: f.id, nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega", fotoUrl: f.papeis?.pessoas?.foto_url ?? null, authUserId: f.auth_user_id }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setFuncionarios(listaFunc);
    if (user) setMeuFuncionarioId(listaFunc.find((f) => f.authUserId === user.id)?.id ?? null);

    const [{ data: tarefasData }, { data: postsData }] = await Promise.all([
      supabase
        .from("tarefas")
        .select("id, titulo, data_inicio, prazo, status_id, descricao, status_conteudo ( nome, cor )")
        .is("tarefa_pai_id", null)
        .eq("arquivada", false)
        .is("excluido_em", null),
      supabase
        .from("posts_conteudo")
        .select("id, titulo, data_inicio, data_publicacao, status_id, observacoes_internas, status_conteudo ( nome, cor )")
        .eq("arquivado", false)
        .is("excluido_em", null),
    ]);

    const tarefasNoPeriodo = ((tarefasData ?? []) as unknown as {
      id: string;
      titulo: string;
      data_inicio: string | null;
      prazo: string | null;
      descricao: string | null;
      status_conteudo: { nome: string; cor: string } | null;
    }[])
      .map((t) => ({ ...t, dataExibicao: t.data_inicio ?? t.prazo }))
      .filter((t) => t.dataExibicao && t.dataExibicao >= inicioISO && t.dataExibicao <= fimISO);

    const postsNoPeriodo = ((postsData ?? []) as unknown as {
      id: string;
      titulo: string | null;
      data_inicio: string | null;
      data_publicacao: string;
      observacoes_internas: string | null;
      status_conteudo: { nome: string; cor: string } | null;
    }[])
      .map((p) => ({ ...p, dataExibicao: p.data_inicio ?? p.data_publicacao }))
      .filter((p) => p.dataExibicao && p.dataExibicao >= inicioISO && p.dataExibicao <= fimISO);

    const idsTarefas = tarefasNoPeriodo.map((t) => t.id);
    const idsPosts = postsNoPeriodo.map((p) => p.id);

    const [{ data: respTarefas }, { data: respPosts }, { data: subtarefasData }, { data: subpostsData }] = await Promise.all([
      idsTarefas.length > 0
        ? supabase.from("tarefas_responsaveis").select("tarefa_id, funcionario_id").in("tarefa_id", idsTarefas)
        : Promise.resolve({ data: [] }),
      idsPosts.length > 0
        ? supabase.from("posts_conteudo_responsaveis").select("post_id, funcionario_id").in("post_id", idsPosts)
        : Promise.resolve({ data: [] }),
      idsTarefas.length > 0
        ? supabase.from("tarefas").select("tarefa_pai_id").in("tarefa_pai_id", idsTarefas).is("excluido_em", null)
        : Promise.resolve({ data: [] }),
      idsPosts.length > 0
        ? supabase.from("posts_conteudo").select("post_pai_id").in("post_pai_id", idsPosts).is("excluido_em", null)
        : Promise.resolve({ data: [] }),
    ]);

    const mapaRespT = new Map<string, string[]>();
    for (const r of respTarefas ?? []) {
      mapaRespT.set(r.tarefa_id, [...(mapaRespT.get(r.tarefa_id) ?? []), r.funcionario_id]);
    }
    const mapaRespP = new Map<string, string[]>();
    for (const r of respPosts ?? []) {
      mapaRespP.set(r.post_id, [...(mapaRespP.get(r.post_id) ?? []), r.funcionario_id]);
    }
    const mapaSubT = new Map<string, number>();
    for (const s of subtarefasData ?? []) {
      if (s.tarefa_pai_id) mapaSubT.set(s.tarefa_pai_id, (mapaSubT.get(s.tarefa_pai_id) ?? 0) + 1);
    }
    const mapaSubP = new Map<string, number>();
    for (const s of subpostsData ?? []) {
      if (s.post_pai_id) mapaSubP.set(s.post_pai_id, (mapaSubP.get(s.post_pai_id) ?? 0) + 1);
    }

    const itensT: ItemPauta[] = tarefasNoPeriodo.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      tipo: "tarefa",
      statusNome: t.status_conteudo?.nome ?? "—",
      statusCor: t.status_conteudo?.cor ?? "cinza",
      dataExibicao: t.dataExibicao!,
      dataInicio: t.data_inicio,
      dataFim: t.prazo,
      link: `/tarefas/${t.id}?from=pauta`,
      responsavelIds: mapaRespT.get(t.id) ?? [],
      temDescricao: !!t.descricao,
      qtdSubitens: mapaSubT.get(t.id) ?? 0,
    }));
    const itensP: ItemPauta[] = postsNoPeriodo.map((p) => ({
      id: p.id,
      titulo: p.titulo || "Sem título",
      tipo: "conteudo",
      statusNome: p.status_conteudo?.nome ?? "—",
      statusCor: p.status_conteudo?.cor ?? "cinza",
      dataExibicao: p.dataExibicao!,
      dataInicio: p.data_inicio,
      dataFim: p.data_publicacao,
      link: `/conteudo/calendario/post/${p.id}?from=pauta`,
      responsavelIds: mapaRespP.get(p.id) ?? [],
      temDescricao: !!p.observacoes_internas,
      qtdSubitens: mapaSubP.get(p.id) ?? 0,
    }));

    setItens([...itensT, ...itensP]);
    setLoading(false);
  }, [inicioISO, fimISO]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function novaTarefaNoDia(dataISO: string, funcionarioId: string | null) {
    const supabase = createClient();
    const { data: nova } = await supabase
      .from("tarefas")
      .insert({ titulo: "Nova tarefa", data_inicio: dataISO, status_id: statusList[0]?.id })
      .select("id")
      .single();
    if (nova) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("tarefas_historico").insert({ tarefa_id: nova.id, autor_id: user.id, descricao: "criou a tarefa" });
      const respId = funcionarioId ?? meuFuncionarioId;
      if (respId) await supabase.from("tarefas_responsaveis").insert({ tarefa_id: nova.id, funcionario_id: respId });
      router.push(`/tarefas/${nova.id}?from=pauta`);
    }
  }

  const itensPorPessoaEDia = new Map<string, ItemPauta[]>();
  for (const item of itens) {
    const ids = item.responsavelIds.length > 0 ? item.responsavelIds : ["_sem"];
    for (const respId of ids) {
      const chave = `${respId}|${item.dataExibicao}`;
      itensPorPessoaEDia.set(chave, [...(itensPorPessoaEDia.get(chave) ?? []), item]);
    }
  }

  // Itens com início E vencimento diferentes viram uma barra esticada pelos dias,
  // só faz sentido na visão semanal (nas células de mês não cabe isso).
  const semanaISO = diasSemana.map((d) => toISODateLocal(d));
  type Faixa = { item: ItemPauta; colStart: number; colSpan: number; lane: number };
  const idsEmFaixaSemana = new Set<string>();
  const faixasPorPessoa = new Map<string, { faixas: Faixa[]; qtdLanes: number }>();

  if (visualizacao === "semana") {
    const porPessoa = new Map<string, ItemPauta[]>();
    for (const item of itens) {
      if (!item.dataInicio || !item.dataFim || item.dataInicio === item.dataFim) continue;
      const ids = item.responsavelIds.length > 0 ? item.responsavelIds : ["_sem"];
      for (const respId of ids) {
        porPessoa.set(respId, [...(porPessoa.get(respId) ?? []), item]);
      }
    }
    for (const [respId, itensPessoa] of porPessoa) {
      const barras = itensPessoa
        .map((item) => {
          const inicioClip = item.dataInicio! < semanaISO[0] ? semanaISO[0] : item.dataInicio!;
          const fimClip = item.dataFim! > semanaISO[6] ? semanaISO[6] : item.dataFim!;
          const colStart = semanaISO.indexOf(inicioClip) + 1;
          const colFim = semanaISO.indexOf(fimClip) + 1;
          return { item, colStart, colSpan: colFim - colStart + 1 };
        })
        .filter((b) => b.colStart > 0 && b.colSpan > 0)
        .sort((a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan);

      const lanes: { fimCol: number }[] = [];
      const faixas: Faixa[] = barras.map((b) => {
        let lane = lanes.findIndex((l) => l.fimCol < b.colStart);
        if (lane === -1) {
          lane = lanes.length;
          lanes.push({ fimCol: b.colStart + b.colSpan - 1 });
        } else {
          lanes[lane].fimCol = b.colStart + b.colSpan - 1;
        }
        idsEmFaixaSemana.add(`${b.item.tipo}-${b.item.id}-${respId}`);
        return { ...b, lane };
      });
      faixasPorPessoa.set(respId, { faixas, qtdLanes: lanes.length });
    }
  }

  const funcionariosExibidos = modo === "minha" ? funcionarios.filter((f) => f.id === meuFuncionarioId) : funcionarios;
  const hojeISO = toISODateLocal(hoje);

  return (
    <main className="h-screen flex flex-col bg-surface/30 px-8 py-6">
      <div className="max-w-[1500px] mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/inicio")}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors"
            >
              ← Início
            </button>
            <h1 className="text-xl font-extrabold text-ink">📋 Pauta</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
              <button
                onClick={() => setModo("minha")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  modo === "minha" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Minha semana
              </button>
              <button
                onClick={() => setModo("equipe")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  modo === "equipe" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Toda a equipe
              </button>
            </div>

            <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
              <button
                onClick={() => setVisualizacao("semana")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  visualizacao === "semana" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setVisualizacao("mes")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  visualizacao === "mes" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Mês
              </button>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border-2 border-black/10 pl-1.5 pr-3 py-1">
              <button
                onClick={() => {
                  if (visualizacao === "semana") {
                    const d = new Date(inicioSemana);
                    d.setDate(d.getDate() - 7);
                    setInicioSemana(d);
                  } else {
                    const d = new Date(ano, mes - 1, 1);
                    setMes(d.getMonth());
                    setAno(d.getFullYear());
                  }
                }}
                className="rounded-full h-7 w-7 flex items-center justify-center hover:bg-surface text-ink font-bold"
              >
                ←
              </button>
              <button
                onClick={() => {
                  if (visualizacao === "semana") {
                    const d = new Date();
                    d.setDate(d.getDate() - d.getDay());
                    d.setHours(0, 0, 0, 0);
                    setInicioSemana(d);
                  } else {
                    setMes(hoje.getMonth());
                    setAno(hoje.getFullYear());
                  }
                }}
                className="text-xs font-bold text-ink hover:text-forest px-1"
              >
                Hoje
              </button>
              <button
                onClick={() => {
                  if (visualizacao === "semana") {
                    const d = new Date(inicioSemana);
                    d.setDate(d.getDate() + 7);
                    setInicioSemana(d);
                  } else {
                    const d = new Date(ano, mes + 1, 1);
                    setMes(d.getMonth());
                    setAno(d.getFullYear());
                  }
                }}
                className="rounded-full h-7 w-7 flex items-center justify-center hover:bg-surface text-ink font-bold"
              >
                →
              </button>
              <span className="text-sm font-bold text-ink ml-1">
                {visualizacao === "semana"
                  ? `${formatarDataCurta(inicioISO)} – ${formatarDataCurta(fimISO)}`
                  : `${MESES[mes]} ${ano}`}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white border border-black/5 p-4 space-y-2">
            <EsqueletoLinha className="h-4 w-40" />
            <EsqueletoLinha className="h-24 w-full" />
          </div>
        ) : funcionariosExibidos.length === 0 ? (
          <p className="text-sm text-ink/50">Você ainda não tem cadastro de funcionário vinculado à sua conta.</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pb-2">
            {funcionariosExibidos.map((f) => (
              <div
                key={f.id}
                className={`rounded-3xl bg-white border border-black/5 shadow-sm overflow-hidden flex flex-col ${
                  funcionariosExibidos.length === 1 ? "h-full" : "min-h-[240px]"
                }`}
              >
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-black/5 bg-surface/50 shrink-0">
                  <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={26} />
                  <p className="text-sm font-bold text-ink">{f.nome}</p>
                </div>
                {visualizacao === "semana" && (faixasPorPessoa.get(f.id)?.qtdLanes ?? 0) > 0 && (
                  <div
                    className="grid grid-cols-7 gap-y-1 px-2 pt-2 shrink-0 border-b border-black/5"
                    style={{ gridTemplateRows: `repeat(${faixasPorPessoa.get(f.id)!.qtdLanes}, minmax(22px, auto))` }}
                  >
                    {faixasPorPessoa.get(f.id)!.faixas.map((fx) => (
                      <button
                        key={`${fx.item.tipo}-${fx.item.id}`}
                        onClick={() => router.push(fx.item.link)}
                        style={{ gridColumn: `${fx.colStart} / span ${fx.colSpan}`, gridRow: fx.lane + 1 }}
                        className={`mx-0.5 mb-1 rounded-lg px-2 py-1 text-left overflow-hidden ${corDoStatus(fx.item.statusCor).cor}`}
                        title={fx.item.titulo}
                      >
                        <span className="text-[11px] font-semibold truncate flex items-center gap-1">
                          {fx.item.tipo === "tarefa" ? <IconeTarefa tamanho={11} /> : "📅"} {fx.item.titulo}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className={`grid grid-cols-7 divide-x divide-black/5 flex-1 ${funcionariosExibidos.length > 1 ? "" : ""}`}>
                  {diasAtivos.map((dia) => {
                    const iso = toISODateLocal(dia);
                    const itensCelula = (itensPorPessoaEDia.get(`${f.id}|${iso}`) ?? []).filter(
                      (it) => !(visualizacao === "semana" && idsEmFaixaSemana.has(`${it.tipo}-${it.id}-${f.id}`))
                    );
                    const doMesAtivo = visualizacao === "semana" || dia.getMonth() === mes;
                    return (
                      <div
                        key={iso}
                        className={`p-2 group/cel ${iso === hojeISO ? "bg-mint/20" : !doMesAtivo ? "bg-surface/40" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide ${
                              iso === hojeISO ? "text-forest" : doMesAtivo ? "text-ink/40" : "text-ink/20"
                            }`}
                          >
                            {visualizacao === "semana" ? `${DIAS_SEMANA[dia.getDay()].slice(0, 3)} ${dia.getDate()}` : dia.getDate()}
                          </span>
                          <button
                            onClick={() => novaTarefaNoDia(iso, f.id)}
                            className="opacity-0 group-hover/cel:opacity-100 transition-opacity text-ink/30 hover:text-ink text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                        <div className="space-y-1">
                          {itensCelula.slice(0, visualizacao === "mes" ? 3 : undefined).map((item) => {
                            const respItem = item.responsavelIds
                              .map((rid) => funcionarios.find((f) => f.id === rid))
                              .filter((f): f is Responsavel => !!f);
                            if (visualizacao === "mes") {
                              return (
                                <button
                                  key={`${item.tipo}-${item.id}`}
                                  onClick={() => router.push(item.link)}
                                  className={`w-full text-left rounded-lg px-1.5 py-1 text-[11px] font-medium truncate ${corDoStatus(item.statusCor).cor}`}
                                >
                                  <span className="inline-flex items-center gap-1">{item.tipo === "tarefa" ? <IconeTarefa tamanho={12} /> : "📅"} {item.titulo}</span>
                                </button>
                              );
                            }
                            return (
                              <button
                                key={`${item.tipo}-${item.id}`}
                                onClick={() => router.push(item.link)}
                                className={`w-full text-left rounded-lg px-2 py-1.5 ${corDoStatus(item.statusCor).cor}`}
                              >
                                <p className="text-[11px] font-semibold truncate">
                                  <span className="inline-flex items-center gap-1">{item.tipo === "tarefa" ? <IconeTarefa tamanho={12} /> : "📅"} {item.titulo}</span>
                                </p>
                                {(item.temDescricao || item.qtdSubitens > 0 || respItem.length > 0) && (
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="flex items-center gap-1.5 opacity-60 text-[10px]">
                                      {item.temDescricao && <span title="Tem descrição">☰</span>}
                                      {item.qtdSubitens > 0 && <span title="Subitens">🔗 {item.qtdSubitens}</span>}
                                    </span>
                                    <AvatarStack pessoas={respItem} tamanho={16} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          {visualizacao === "mes" && itensCelula.length > 3 && (
                            <p className="text-[10px] text-ink/40 px-1">+{itensCelula.length - 3} mais</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

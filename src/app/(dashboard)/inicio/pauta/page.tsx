"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";

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
  link: string;
  responsavelIds: string[];
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

export default function PautaPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"minha" | "equipe">("minha");
  const [meuFuncionarioId, setMeuFuncionarioId] = useState<string | null>(null);
  const [funcionarios, setFuncionarios] = useState<Responsavel[]>([]);
  const [itens, setItens] = useState<ItemPauta[]>([]);
  const [statusList, setStatusList] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [inicioSemana, setInicioSemana] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });
  const inicioISO = toISODateLocal(dias[0]);
  const fimISO = toISODateLocal(dias[6]);

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
        .select("id, titulo, data_inicio, prazo, status_id, status_conteudo ( nome, cor )")
        .is("tarefa_pai_id", null)
        .eq("arquivada", false),
      supabase
        .from("posts_conteudo")
        .select("id, titulo, data_inicio, data_publicacao, status_id, status_conteudo ( nome, cor )")
        .eq("arquivado", false),
    ]);

    const tarefasDaSemana = ((tarefasData ?? []) as unknown as {
      id: string;
      titulo: string;
      data_inicio: string | null;
      prazo: string | null;
      status_conteudo: { nome: string; cor: string } | null;
    }[])
      .map((t) => ({ ...t, dataExibicao: t.data_inicio ?? t.prazo }))
      .filter((t) => t.dataExibicao && t.dataExibicao >= inicioISO && t.dataExibicao <= fimISO);

    const postsDaSemana = ((postsData ?? []) as unknown as {
      id: string;
      titulo: string | null;
      data_inicio: string | null;
      data_publicacao: string;
      status_conteudo: { nome: string; cor: string } | null;
    }[])
      .map((p) => ({ ...p, dataExibicao: p.data_inicio ?? p.data_publicacao }))
      .filter((p) => p.dataExibicao && p.dataExibicao >= inicioISO && p.dataExibicao <= fimISO);

    const idsTarefas = tarefasDaSemana.map((t) => t.id);
    const idsPosts = postsDaSemana.map((p) => p.id);

    const [{ data: respTarefas }, { data: respPosts }] = await Promise.all([
      idsTarefas.length > 0
        ? supabase.from("tarefas_responsaveis").select("tarefa_id, funcionario_id").in("tarefa_id", idsTarefas)
        : Promise.resolve({ data: [] }),
      idsPosts.length > 0
        ? supabase.from("posts_conteudo_responsaveis").select("post_id, funcionario_id").in("post_id", idsPosts)
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

    const itensT: ItemPauta[] = tarefasDaSemana.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      tipo: "tarefa",
      statusNome: t.status_conteudo?.nome ?? "—",
      statusCor: t.status_conteudo?.cor ?? "cinza",
      dataExibicao: t.dataExibicao!,
      link: `/tarefas/${t.id}`,
      responsavelIds: mapaRespT.get(t.id) ?? [],
    }));
    const itensP: ItemPauta[] = postsDaSemana.map((p) => ({
      id: p.id,
      titulo: p.titulo || "Sem título",
      tipo: "conteudo",
      statusNome: p.status_conteudo?.nome ?? "—",
      statusCor: p.status_conteudo?.cor ?? "cinza",
      dataExibicao: p.dataExibicao!,
      link: `/conteudo/calendario/post/${p.id}`,
      responsavelIds: mapaRespP.get(p.id) ?? [],
    }));

    setItens([...itensT, ...itensP]);
    setLoading(false);
  }, [inicioISO, fimISO]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function novaTarefaNoDia(dataISO: string, funcionarioId: string | null) {
    const tituloNovo = window.prompt("Nome da tarefa:");
    if (!tituloNovo || !tituloNovo.trim()) return;
    const supabase = createClient();
    const { data: nova } = await supabase
      .from("tarefas")
      .insert({ titulo: tituloNovo.trim(), data_inicio: dataISO, status_id: statusList[0]?.id })
      .select("id")
      .single();
    if (nova) {
      const respId = funcionarioId ?? meuFuncionarioId;
      if (respId) await supabase.from("tarefas_responsaveis").insert({ tarefa_id: nova.id, funcionario_id: respId });
      carregar();
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

  const funcionariosExibidos = modo === "minha" ? funcionarios.filter((f) => f.id === meuFuncionarioId) : funcionarios;

  return (
    <main className="min-h-screen bg-surface/30 px-8 py-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <button onClick={() => router.push("/inicio")} className="text-xs font-semibold text-ink/50 hover:text-ink mb-1">
              ← Início
            </button>
            <h1 className="text-xl font-extrabold text-ink">📋 Pauta da semana</h1>
          </div>

          <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const d = new Date(inicioSemana);
                  d.setDate(d.getDate() - 7);
                  setInicioSemana(d);
                }}
                className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-surface text-ink/50"
              >
                ←
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - d.getDay());
                  d.setHours(0, 0, 0, 0);
                  setInicioSemana(d);
                }}
                className="rounded-full border-2 border-ink/15 px-3 py-1 text-xs font-semibold hover:bg-surface"
              >
                Esta semana
              </button>
              <button
                onClick={() => {
                  const d = new Date(inicioSemana);
                  d.setDate(d.getDate() + 7);
                  setInicioSemana(d);
                }}
                className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-surface text-ink/50"
              >
                →
              </button>
              <span className="text-xs text-ink/50 ml-1">
                {formatarDataCurta(inicioISO)} – {formatarDataCurta(fimISO)}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-ink/50">Carregando...</p>
        ) : funcionariosExibidos.length === 0 ? (
          <p className="text-sm text-ink/50">Você ainda não tem cadastro de funcionário vinculado à sua conta.</p>
        ) : (
          <div className="space-y-5">
            {funcionariosExibidos.map((f) => (
              <div key={f.id} className="rounded-3xl bg-white border border-black/5 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-black/5 bg-surface/50">
                  <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={26} />
                  <p className="text-sm font-bold text-ink">{f.nome}</p>
                </div>
                <div className="grid grid-cols-7 divide-x divide-black/5">
                  {dias.map((dia) => {
                    const iso = toISODateLocal(dia);
                    const itensCelula = itensPorPessoaEDia.get(`${f.id}|${iso}`) ?? [];
                    const hojeISO = toISODateLocal(new Date());
                    return (
                      <div key={iso} className={`min-h-[130px] p-2 group/cel ${iso === hojeISO ? "bg-mint/20" : ""}`}>
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${iso === hojeISO ? "text-forest" : "text-ink/40"}`}>
                            {DIAS_SEMANA[dia.getDay()].slice(0, 3)} {dia.getDate()}
                          </span>
                          <button
                            onClick={() => novaTarefaNoDia(iso, f.id)}
                            className="opacity-0 group-hover/cel:opacity-100 transition-opacity text-ink/30 hover:text-ink text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                        <div className="space-y-1">
                          {itensCelula.map((item) => (
                            <button
                              key={`${item.tipo}-${item.id}`}
                              onClick={() => router.push(item.link)}
                              className={`w-full text-left rounded-lg px-1.5 py-1 text-[11px] font-medium truncate ${corDoStatus(item.statusCor).cor}`}
                            >
                              {item.tipo === "tarefa" ? "✔️" : "📅"} {item.titulo}
                            </button>
                          ))}
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

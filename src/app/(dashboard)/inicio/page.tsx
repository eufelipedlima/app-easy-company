"use client";

import { NumeroAnimado } from "@/components/numero-animado";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";
import { IconeTarefa } from "@/components/icones-tarefa";
import { EstadoVazio } from "@/components/estado-vazio";
import { EsqueletoLinha } from "@/components/esqueleto";

interface ItemAgenda {
  id: string;
  titulo: string;
  tipo: "tarefa" | "conteudo";
  clienteNome: string | null;
  statusNome: string;
  statusCor: string;
  prioridade: string | null;
  dataInicio: string | null;
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
  autor_nome: string | null;
  autor_foto_url: string | null;
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
  comentario_cliente: "📢",
  atribuicao_tarefa: "👤",
  atribuicao_conteudo: "👤",
  mudanca_tarefa: "✏️",
  mudanca_conteudo: "✏️",
};

const FRASES = [
  ["Arrisque sempre mais do que a maioria; sonhe sempre mais alto do que os outros.", "Howard Schultz"],
  ["A melhor forma de prever o futuro é criá-lo.", "Peter Drucker"],
  ["Feito é melhor que perfeito.", "Sheryl Sandberg"],
  ["Constância vence intensidade.", "Provérbio popular"],
  ["Grandes equipes fazem grandes empresas.", "Anônimo"],
  ["Não espere por oportunidades, crie-as.", "Anônimo"],
  ["Foco é dizer não pra quase tudo.", "Steve Jobs"],
];

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
  const [totalNaoLidasCaixa, setTotalNaoLidasCaixa] = useState(0);
  const [rotinasHoje, setRotinasHoje] = useState<{ id: string; nome: string; itens: { id: string; texto: string; concluido: boolean }[] }[]>([]);
  const [meuFuncionarioId, setMeuFuncionarioId] = useState<string | null>(null);
  const [totalNaoLidasChat, setTotalNaoLidasChat] = useState(0);
  const [abaTarefas, setAbaTarefas] = useState<
    "urgentes" | "atraso" | "semana" | "hoje" | "inicia_amanha" | "inicia_hoje" | "proximas"
  >("atraso");

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
      .select("id, cargo_id, papeis ( pessoas ( nome, apelido ) )")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const f = funcionario as unknown as { id: string; cargo_id: string | null; papeis: { pessoas: { nome: string; apelido: string | null } | null } | null } | null;
    setNome(f?.papeis?.pessoas?.apelido || f?.papeis?.pessoas?.nome || "");
    setMeuFuncionarioId(f?.id ?? null);

    if (f) {
      const hojeDate = new Date();
      hojeDate.setHours(0, 0, 0, 0);
      const hojeIso = hojeDate.toISOString().slice(0, 10);
      const [{ data: rotinasData }, { data: respCargoData }, { data: respFuncData }] = await Promise.all([
        supabase.from("rotinas").select("id, texto, grupo, frequencia, dias_semana, dia_mes").eq("ativo", true),
        supabase.from("rotina_responsaveis_cargo").select("rotina_id, cargo_id"),
        supabase.from("rotina_responsaveis_funcionario").select("rotina_id, funcionario_id"),
      ]);
      const rotinaAplicavelHoje = (r: { frequencia: string; dias_semana: number[] | null; dia_mes: number | null }) => {
        if (r.frequencia === "diaria") return true;
        if (r.frequencia === "semanal") return (r.dias_semana ?? []).includes(hojeDate.getDay());
        if (r.frequencia === "mensal") {
          if (!r.dia_mes) return false;
          const ultimoDia = new Date(hojeDate.getFullYear(), hojeDate.getMonth() + 1, 0).getDate();
          const alvo = new Date(hojeDate.getFullYear(), hojeDate.getMonth(), Math.min(r.dia_mes, ultimoDia));
          const dSemana = alvo.getDay();
          if (dSemana === 0) alvo.setDate(alvo.getDate() - 2);
          else if (dSemana === 6) alvo.setDate(alvo.getDate() - 1);
          return hojeDate.getDate() === alvo.getDate();
        }
        return false;
      };
      const minhasRotinas = (rotinasData ?? [])
        .filter((r) => (f.cargo_id && (respCargoData ?? []).some((c) => c.rotina_id === r.id && c.cargo_id === f.cargo_id)) || (respFuncData ?? []).some((rf) => rf.rotina_id === r.id && rf.funcionario_id === f.id))
        .filter(rotinaAplicavelHoje);
      const idsRotinas = minhasRotinas.map((r) => r.id);
      const { data: execucoes } =
        idsRotinas.length > 0
          ? await supabase.from("rotina_execucoes").select("rotina_id").eq("funcionario_id", f.id).eq("data_referencia", hojeIso).in("rotina_id", idsRotinas)
          : { data: [] };
      const feitos = new Set((execucoes ?? []).map((e) => e.rotina_id));

      // Agrupa pelo campo "grupo" (texto livre) — quem não tem grupo vira
      // um bloco "solto" só com esse único item.
      const gruposMap = new Map<string, { id: string; nome: string; itens: { id: string; texto: string; concluido: boolean }[] }>();
      for (const r of minhasRotinas) {
        const chave = r.grupo ?? `__solto__${r.id}`;
        if (!gruposMap.has(chave)) gruposMap.set(chave, { id: chave, nome: r.grupo ?? "", itens: [] });
        gruposMap.get(chave)!.itens.push({ id: r.id, texto: r.texto, concluido: feitos.has(r.id) });
      }
      setRotinasHoje(Array.from(gruposMap.values()));
    }

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
              .select("id, titulo, prazo, data_inicio, prioridade, status_id, clientes ( papeis ( pessoas ( nome ) ) ), status_conteudo ( nome, cor )")
              .in("id", idsTarefas)
              .eq("arquivada", false)
              .is("excluido_em", null)
          : Promise.resolve({ data: [] }),
        idsPosts.length > 0
          ? supabase
              .from("posts_conteudo")
              .select("id, titulo, data_publicacao, data_inicio, status_id, clientes ( papeis ( pessoas ( nome ) ) ), status_conteudo ( nome, cor )")
              .in("id", idsPosts)
              .eq("arquivado", false)
              .is("excluido_em", null)
          : Promise.resolve({ data: [] }),
      ]);

      const listaTarefas: ItemAgenda[] = ((tarefasData ?? []) as unknown as {
        id: string;
        titulo: string;
        prazo: string | null;
        data_inicio: string | null;
        prioridade: string | null;
        clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
        status_conteudo: { nome: string; cor: string } | null;
      }[]).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        tipo: "tarefa",
        clienteNome: t.clientes?.papeis?.pessoas?.nome ?? null,
        statusNome: t.status_conteudo?.nome ?? "—",
        statusCor: t.status_conteudo?.cor ?? "cinza",
        prioridade: t.prioridade,
        dataInicio: t.data_inicio,
        data: t.prazo,
        link: `/tarefas/${t.id}`,
      }));

      const listaPosts: ItemAgenda[] = ((postsData ?? []) as unknown as {
        id: string;
        titulo: string | null;
        data_publicacao: string;
        data_inicio: string | null;
        clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
        status_conteudo: { nome: string; cor: string } | null;
      }[]).map((p) => ({
        id: p.id,
        titulo: p.titulo || "Sem título",
        tipo: "conteudo",
        clienteNome: p.clientes?.papeis?.pessoas?.nome ?? null,
        statusNome: p.status_conteudo?.nome ?? "—",
        statusCor: p.status_conteudo?.cor ?? "cinza",
        prioridade: null,
        dataInicio: p.data_inicio,
        data: p.data_publicacao,
        link: `/conteudo/calendario/post/${p.id}`,
      }));

      setItens([...listaTarefas, ...listaPosts]);
    }

    const { data: notifData } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, descricao, link, lida, created_at, autor_nome, autor_foto_url")
      .eq("destinatario_id", user.id)
      .eq("lida", false)
      .order("created_at", { ascending: false })
      .limit(5);
    setNotificacoes(notifData ?? []);
    const { count: totalNaoLidas } = await supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("destinatario_id", user.id)
      .eq("lida", false);
    setTotalNaoLidasCaixa(totalNaoLidas ?? 0);

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
    setTotalNaoLidasChat(canaisComInfo.reduce((s, c) => s + c.naoLidas, 0));

    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function toggleItemRotina(itemId: string, marcado: boolean) {
    if (!meuFuncionarioId) return;
    const supabase = createClient();
    const hojeIsoReal = new Date().toISOString().slice(0, 10);
    if (marcado) {
      await supabase.from("rotina_execucoes").insert({ rotina_id: itemId, funcionario_id: meuFuncionarioId, data_referencia: hojeIsoReal });
    } else {
      await supabase.from("rotina_execucoes").delete().eq("rotina_id", itemId).eq("funcionario_id", meuFuncionarioId).eq("data_referencia", hojeIsoReal);
    }
    setRotinasHoje((atual) => atual.map((r) => ({ ...r, itens: r.itens.map((i) => (i.id === itemId ? { ...i, concluido: marcado } : i)) })));
  }

  const hojeISO = toISODateLocal(new Date());
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaISO = toISODateLocal(amanha);
  const daqui7Dias = new Date();
  daqui7Dias.setDate(daqui7Dias.getDate() + 7);
  const daqui7ISO = toISODateLocal(daqui7Dias);

  const itensAbertos = itens.filter((i) => normalizar(i.statusCor) !== "verde");

  function normalizar(s: string) {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  const grupos = {
    urgentes: itensAbertos.filter((i) => i.prioridade === "alta"),
    atraso: itensAbertos.filter((i) => i.data && i.data < hojeISO),
    semana: itensAbertos.filter((i) => i.data && i.data > hojeISO && i.data <= daqui7ISO),
    hoje: itensAbertos.filter((i) => i.data === hojeISO),
    inicia_amanha: itensAbertos.filter((i) => i.dataInicio === amanhaISO),
    inicia_hoje: itensAbertos.filter((i) => i.dataInicio === hojeISO),
    proximas: itensAbertos
      .filter((i) => !(i.data && i.data <= hojeISO) && i.dataInicio !== amanhaISO)
      .sort((a, b) => (a.data ?? a.dataInicio ?? "9999-99-99").localeCompare(b.data ?? b.dataInicio ?? "9999-99-99")),
  };

  const ABAS_TAREFAS: { chave: keyof typeof grupos; label: string; icone: string }[] = [
    { chave: "atraso", label: "Em atraso", icone: "⏰" },
    { chave: "hoje", label: "Vencem hoje", icone: "🎯" },
    { chave: "inicia_amanha", label: "Iniciam amanhã", icone: "🌅" },
    { chave: "proximas", label: "Próximas tarefas", icone: "📋" },
    { chave: "urgentes", label: "Urgentes", icone: "🔥" },
    { chave: "semana", label: "Vencem em 7 dias", icone: "📅" },
    { chave: "inicia_hoje", label: "Iniciam hoje", icone: "▶️" },
  ];

  const listaAtiva = grupos[abaTarefas];

  const resumo = {
    total: itensAbertos.length,
    atraso: grupos.atraso.length,
    concluidos: itens.filter((i) => normalizar(i.statusCor) === "verde").length,
    semData: itensAbertos.filter((i) => !i.data).length,
    hoje: grupos.hoje.length,
  };

  const frase = FRASES[new Date().getDate() % FRASES.length];

  return (
    <main className="min-h-screen bg-gradient-to-b from-mint/20 via-white to-white px-8 py-8">
      <div className="max-w-[1400px] mx-auto anim-entrada">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
          <h1 className="text-xl font-extrabold text-ink">
            {saudacao()}
            {nome ? `, ${nome}` : ""} 👋
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/rotinas")}
              className="relative rounded-full bg-ink text-white px-4 py-2 text-xs font-bold hover:bg-forest transition-colors"
            >
              ✅ Rotinas
              {rotinasHoje.reduce((s, r) => s + r.itens.filter((i) => !i.concluido).length, 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white">
                  {rotinasHoje.reduce((s, r) => s + r.itens.filter((i) => !i.concluido).length, 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push("/inicio/pauta")}
              className="rounded-full bg-ink text-white px-4 py-2 text-xs font-bold hover:bg-forest transition-colors"
            >
              📋 Pauta
            </button>
            <button
              onClick={() => router.push("/caixa-de-entrada")}
              className="relative rounded-full bg-ink text-white px-4 py-2 text-xs font-bold hover:bg-forest transition-colors"
            >
              📥 Caixa de entrada
              {totalNaoLidasCaixa > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white">
                  {totalNaoLidasCaixa > 99 ? "99+" : totalNaoLidasCaixa}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push("/chat")}
              className="relative rounded-full bg-ink text-white px-4 py-2 text-xs font-bold hover:bg-forest transition-colors"
            >
              💬 Chat
              {totalNaoLidasChat > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white">
                  {totalNaoLidasChat > 99 ? "99+" : totalNaoLidasChat}
                </span>
              )}
            </button>
          </div>
        </div>
        <p className="text-xs text-ink/50 italic mb-6">
          &ldquo;{frase[0]}&rdquo; <span className="not-italic text-ink/30">— {frase[1]}</span>
        </p>

        {loading ? (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 space-y-3">
              <EsqueletoLinha className="h-4 w-40" />
              <div className="flex gap-2">
                <EsqueletoLinha className="h-7 w-24 rounded-full" />
                <EsqueletoLinha className="h-7 w-24 rounded-full" />
                <EsqueletoLinha className="h-7 w-24 rounded-full" />
              </div>
              <EsqueletoLinha className="h-10 w-full" />
              <EsqueletoLinha className="h-10 w-full" />
              <EsqueletoLinha className="h-10 w-5/6" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📌</span>
                  <h2 className="text-sm font-bold text-ink">Tarefas e conteúdos da agência</h2>
                </div>
                <button onClick={() => router.push("/tarefas")} className="text-xs font-semibold text-forest hover:text-ink">
                  Ver tudo →
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-5">
                {ABAS_TAREFAS.map((a) => (
                  <button
                    key={a.chave}
                    onClick={() => setAbaTarefas(a.chave)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      abaTarefas === a.chave
                        ? "bg-ink text-white shadow-md scale-105"
                        : "bg-surface text-ink/60 hover:bg-black/10"
                    }`}
                  >
                    <span>{a.icone}</span>
                    {grupos[a.chave].length} {a.label}
                  </button>
                ))}
              </div>

              {listaAtiva.length === 0 ? (
                <EstadoVazio emoji="🎉" titulo="Tudo em dia por aqui" descricao="Nenhum item nessa aba agora." />
              ) : (
                <div className="space-y-1.5">
                  {listaAtiva.map((item) => {
                    const atrasado = item.data && item.data < hojeISO;
                    return (
                      <button
                        key={`${item.tipo}-${item.id}`}
                        onClick={() => router.push(item.link)}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-colors ${
                          atrasado ? "bg-red-50 hover:bg-red-100" : "bg-surface/60 hover:bg-surface"
                        }`}
                      >
                        <span className="shrink-0">{item.tipo === "tarefa" ? <IconeTarefa /> : "📅"}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-ink truncate">{item.titulo}</span>
                          {item.clienteNome && <span className="block text-[11px] text-ink/40 truncate">{item.clienteNome}</span>}
                        </span>
                        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${corDoStatus(item.statusCor).cor}`}>
                          {item.statusNome}
                        </span>
                        {item.data && (
                          <span className={`text-xs font-semibold shrink-0 ${atrasado ? "text-red-600" : "text-ink/40"}`}>
                            {atrasado ? "Atrasada" : formatarData(item.data)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📊</span>
                <h2 className="text-sm font-bold text-ink">Resumo</h2>
              </div>
              <div className="anim-stagger grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  ["Total em aberto", resumo.total, "bg-surface text-ink", "📋"],
                  ["Vencem hoje", resumo.hoje, "bg-amber-50 text-amber-700", "🎯"],
                  ["Em atraso", resumo.atraso, "bg-red-50 text-red-700", "⏰"],
                  ["Concluídos", resumo.concluidos, "bg-emerald-50 text-emerald-700", "✅"],
                  ["Sem prazo", resumo.semData, "bg-sky-50 text-sky-700", "🗂️"],
                ].map(([label, valor, cor, icone]) => (
                  <div key={label as string} className={`rounded-xl p-3 transition-transform hover:-translate-y-0.5 ${cor}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg">{icone}</span>
                      <NumeroAnimado valor={valor as number} className="text-xl font-extrabold" />
                    </div>
                    <p className="text-[11px] font-semibold opacity-70">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-3xl bg-white border border-black/5 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📥</span>
                    <h2 className="text-sm font-bold text-ink">Caixa de Entrada</h2>
                  </div>
                  <button onClick={() => router.push("/caixa-de-entrada")} className="text-xs font-semibold text-forest hover:text-ink">
                    Ver tudo →
                  </button>
                </div>
                {notificacoes.length === 0 ? (
                  <EstadoVazio emoji="📭" titulo="Tudo em dia" descricao="Nenhuma notificação pendente." />
                ) : (
                  <div className="space-y-1">
                    {notificacoes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => router.push(n.link || "/caixa-de-entrada")}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-surface transition-colors text-left"
                      >
                        {n.autor_foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={n.autor_foto_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="h-8 w-8 rounded-xl bg-surface flex items-center justify-center text-sm shrink-0">
                            {ICONE_NOTIFICACAO[n.tipo] ?? "🔔"}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-ink truncate">{n.titulo}</span>
                          {n.descricao && <span className="block text-[11px] text-ink/50 truncate">{n.descricao}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white border border-black/5 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <h2 className="text-sm font-bold text-ink">Rotinas de hoje</h2>
                  </div>
                  <button onClick={() => router.push("/rotinas")} className="text-xs font-semibold text-forest hover:text-ink">
                    Ver tudo →
                  </button>
                </div>
                {rotinasHoje.length === 0 ? (
                  <EstadoVazio emoji="✅" titulo="Nenhuma rotina pra hoje" />
                ) : (
                  <div className="space-y-3">
                    {rotinasHoje.map((r) => (
                      <div key={r.id}>
                        {r.nome && <p className="text-xs font-bold text-ink/50 mb-1">{r.nome}</p>}
                        <div className="space-y-0.5">
                          {r.itens.map((item) => (
                            <label
                              key={item.id}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-surface transition-colors ${
                                item.concluido ? "bg-mint/40" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={item.concluido}
                                onChange={(e) => toggleItemRotina(item.id, e.target.checked)}
                                className="h-4 w-4 rounded accent-forest shrink-0"
                              />
                              <span className={`text-[13px] flex-1 truncate ${item.concluido ? "text-ink/40 line-through" : "text-ink"}`}>
                                {item.texto}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

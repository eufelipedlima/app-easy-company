"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Origem = "tarefa" | "conteudo";

interface CronometroAtivo {
  origem: Origem;
  id: string;
  titulo: string;
  tempoTotalSegundos: number;
  iniciadoEm: string;
}

function formatarDuracao(totalSegundos: number) {
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = Math.floor(totalSegundos % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BarraCronometro() {
  const router = useRouter();
  const pathname = usePathname();
  const [meuId, setMeuId] = useState<string | null>(null);
  const [ativo, setAtivo] = useState<CronometroAtivo | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [pausando, setPausando] = useState(false);
  const intervaloBuscaRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Busca a MINHA sessão de cronômetro ativa (se houver) nas tabelas por
  // pessoa — antes lia dois campos únicos na própria tarefa/post, que
  // deixaram de ser atualizados quando o cronômetro passou a funcionar
  // por pessoa (permitindo várias pessoas ao mesmo tempo na mesma
  // tarefa). Por isso essa barra tinha parado de aparecer.
  const buscarAtivo = useCallback(async (userId: string) => {
    const supabase = createClient();
    const [{ data: sessaoTarefa }, { data: sessaoPost }] = await Promise.all([
      supabase
        .from("tarefas_tempo_sessoes")
        .select("tarefa_id, iniciado_em, tarefas ( id, titulo, tempo_total_segundos )")
        .eq("funcionario_auth_id", userId)
        .not("iniciado_em", "is", null)
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("posts_conteudo_tempo_sessoes")
        .select("post_id, iniciado_em, posts_conteudo ( id, titulo, legenda, tempo_total_segundos )")
        .eq("funcionario_auth_id", userId)
        .not("iniciado_em", "is", null)
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const candidatos: CronometroAtivo[] = [];

    const t = sessaoTarefa as unknown as {
      tarefa_id: string;
      iniciado_em: string;
      tarefas: { id: string; titulo: string; tempo_total_segundos: number } | null;
    } | null;
    if (t?.iniciado_em && t.tarefas) {
      candidatos.push({
        origem: "tarefa",
        id: t.tarefas.id,
        titulo: t.tarefas.titulo || "Tarefa sem título",
        tempoTotalSegundos: t.tarefas.tempo_total_segundos ?? 0,
        iniciadoEm: t.iniciado_em,
      });
    }

    const p = sessaoPost as unknown as {
      post_id: string;
      iniciado_em: string;
      posts_conteudo: { id: string; titulo: string | null; legenda: string | null; tempo_total_segundos: number } | null;
    } | null;
    if (p?.iniciado_em && p.posts_conteudo) {
      candidatos.push({
        origem: "conteudo",
        id: p.posts_conteudo.id,
        titulo: p.posts_conteudo.titulo || p.posts_conteudo.legenda?.slice(0, 40) || "Conteúdo sem título",
        tempoTotalSegundos: p.posts_conteudo.tempo_total_segundos ?? 0,
        iniciadoEm: p.iniciado_em,
      });
    }

    candidatos.sort((a, b) => new Date(b.iniciadoEm).getTime() - new Date(a.iniciadoEm).getTime());
    setAtivo(candidatos[0] ?? null);
  }, []);

  useEffect(() => {
    async function iniciar() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setMeuId(user.id);
      buscarAtivo(user.id);
    }
    iniciar();
  }, [buscarAtivo]);

  // Reconfere sempre que troca de página — pega timers que acabaram de ser iniciados na tela que a pessoa está saindo agora
  useEffect(() => {
    if (meuId) buscarAtivo(meuId);
  }, [pathname, meuId, buscarAtivo]);

  // Reconfere periodicamente (pega timer iniciado em outra aba/dispositivo)
  useEffect(() => {
    if (!meuId) return;
    intervaloBuscaRef.current = setInterval(() => buscarAtivo(meuId), 20000);
    return () => {
      if (intervaloBuscaRef.current) clearInterval(intervaloBuscaRef.current);
    };
  }, [meuId, buscarAtivo]);

  // Relógio local, atualiza a cada segundo enquanto tem timer rodando
  useEffect(() => {
    if (!ativo) return;
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [ativo]);

  async function pausar() {
    if (!ativo || !meuId) return;
    setPausando(true);
    const supabase = createClient();

    const tabelaSessao = ativo.origem === "tarefa" ? "tarefas_tempo_sessoes" : "posts_conteudo_tempo_sessoes";
    const colunaId = ativo.origem === "tarefa" ? "tarefa_id" : "post_id";
    const tabelaItem = ativo.origem === "tarefa" ? "tarefas" : "posts_conteudo";
    const tabelaHistorico = ativo.origem === "tarefa" ? "tarefas_historico" : "posts_conteudo_historico";

    // Sempre confere o banco antes de agir, em vez de confiar só no que
    // essa barra já tinha em memória — evita perder tempo se algo mudou
    // nesse meio tempo em outra aba ou dispositivo.
    const { data: existente } = await supabase
      .from(tabelaSessao)
      .select("iniciado_em, segundos_acumulados")
      .eq(colunaId, ativo.id)
      .eq("funcionario_auth_id", meuId)
      .maybeSingle();

    if (!existente?.iniciado_em) {
      setPausando(false);
      setAtivo(null);
      return;
    }

    const segundosCorridos = Math.floor((Date.now() - new Date(existente.iniciado_em).getTime()) / 1000);
    const novoAcumuladoMeu = (existente.segundos_acumulados ?? 0) + segundosCorridos;

    const { data: itemAtual } = await supabase.from(tabelaItem).select("tempo_total_segundos").eq("id", ativo.id).maybeSingle();
    const novoTotalGeral = (itemAtual?.tempo_total_segundos ?? ativo.tempoTotalSegundos) + segundosCorridos;

    await Promise.all([
      supabase
        .from(tabelaSessao)
        .update({ iniciado_em: null, segundos_acumulados: novoAcumuladoMeu })
        .eq(colunaId, ativo.id)
        .eq("funcionario_auth_id", meuId),
      supabase.from(tabelaItem).update({ tempo_total_segundos: novoTotalGeral }).eq("id", ativo.id),
    ]);

    // Registra no histórico, igual as telas de tarefa/conteúdo já fazem —
    // sem isso, esse tempo não aparecia nem no "Horas" nem no Meu Time.
    const minutos = Math.round(segundosCorridos / 60);
    const descricao = `passou ${minutos < 1 ? "menos de 1min" : `${minutos}min`} trabalhando ${
      ativo.origem === "tarefa" ? "nessa tarefa" : "nesse conteúdo"
    }`;
    await supabase.from(tabelaHistorico).insert({ [colunaId]: ativo.id, autor_id: meuId, descricao });

    setPausando(false);
    setAtivo(null);
  }

  if (!ativo) return null;

  const rotaDoAtivo = ativo.origem === "tarefa" ? `/tarefas/${ativo.id}` : `/conteudo/calendario/post/${ativo.id}`;
  const segundosCorrendo = Math.floor((agora - new Date(ativo.iniciadoEm).getTime()) / 1000);
  const totalExibido = ativo.tempoTotalSegundos + segundosCorrendo;

  return (
    <div className="anim-entrada fixed bottom-0 inset-x-0 z-50 flex justify-center px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-red-50/95 backdrop-blur border border-red-200 shadow-lg px-4 py-2.5 max-w-full">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>

        <button onClick={() => router.push(rotaDoAtivo)} className="text-left min-w-0 group">
          <p className="text-[10px] font-bold uppercase tracking-wide text-red-500/80 leading-none mb-0.5">
            {ativo.origem === "tarefa" ? "Tarefa em andamento" : "Conteúdo em andamento"}
          </p>
          <p className="text-sm font-bold text-ink truncate group-hover:underline leading-tight max-w-[46vw] sm:max-w-xs">{ativo.titulo}</p>
        </button>

        <span className="text-sm font-extrabold text-red-600 tabular-nums shrink-0">{formatarDuracao(totalExibido)}</span>

        <button
          onClick={pausar}
          disabled={pausando}
          title="Pausar cronômetro"
          className="h-8 w-8 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 hover:brightness-110 disabled:opacity-50 transition-all"
        >
          ❚❚
        </button>

        <button
          onClick={() => router.push(rotaDoAtivo)}
          title="Voltar pra essa tarefa"
          className="h-8 w-8 rounded-full bg-white text-red-500 border border-red-200 flex items-center justify-center shrink-0 hover:bg-red-50 transition-all"
        >
          →
        </button>
      </div>
    </div>
  );
}

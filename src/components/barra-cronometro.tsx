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
  timerIniciadoEm: string;
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

  const buscarAtivo = useCallback(async (userId: string) => {
    const supabase = createClient();
    const [{ data: tarefa }, { data: post }] = await Promise.all([
      supabase
        .from("tarefas")
        .select("id, titulo, tempo_total_segundos, timer_iniciado_em")
        .eq("timer_iniciado_por", userId)
        .not("timer_iniciado_em", "is", null)
        .order("timer_iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("posts_conteudo")
        .select("id, titulo, legenda, tempo_total_segundos, timer_iniciado_em")
        .eq("timer_iniciado_por", userId)
        .not("timer_iniciado_em", "is", null)
        .order("timer_iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const candidatos: CronometroAtivo[] = [];
    if (tarefa?.timer_iniciado_em) {
      candidatos.push({
        origem: "tarefa",
        id: tarefa.id,
        titulo: tarefa.titulo || "Tarefa sem título",
        tempoTotalSegundos: tarefa.tempo_total_segundos ?? 0,
        timerIniciadoEm: tarefa.timer_iniciado_em,
      });
    }
    if (post?.timer_iniciado_em) {
      candidatos.push({
        origem: "conteudo",
        id: post.id,
        titulo: post.titulo || post.legenda?.slice(0, 40) || "Conteúdo sem título",
        tempoTotalSegundos: post.tempo_total_segundos ?? 0,
        timerIniciadoEm: post.timer_iniciado_em,
      });
    }
    candidatos.sort((a, b) => new Date(b.timerIniciadoEm).getTime() - new Date(a.timerIniciadoEm).getTime());
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
    if (!ativo) return;
    setPausando(true);
    const supabase = createClient();
    const segundosCorridos = Math.floor((Date.now() - new Date(ativo.timerIniciadoEm).getTime()) / 1000);
    const novoTotal = ativo.tempoTotalSegundos + segundosCorridos;
    const tabela = ativo.origem === "tarefa" ? "tarefas" : "posts_conteudo";
    await supabase
      .from(tabela)
      .update({ tempo_total_segundos: novoTotal, timer_iniciado_em: null, timer_iniciado_por: null })
      .eq("id", ativo.id);
    setPausando(false);
    setAtivo(null);
  }

  if (!ativo) return null;

  // Já está na própria tela da tarefa/conteúdo ativo — o cronômetro de lá já mostra tudo, não precisa duplicar aqui
  const rotaDoAtivo = ativo.origem === "tarefa" ? `/tarefas/${ativo.id}` : `/conteudo/calendario/post/${ativo.id}`;
  if (pathname === rotaDoAtivo) return null;

  const segundosCorrendo = Math.floor((agora - new Date(ativo.timerIniciadoEm).getTime()) / 1000);
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

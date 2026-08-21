"use client";

import { useState, useEffect } from "react";

export function formatarDuracao(totalSegundos: number) {
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = Math.floor(totalSegundos % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Mesma duração, mas sempre no formato "2h 56min" / "22min" / "menos de
 * 1min" — usado nas listas de resumo (não em contadores ao vivo por
 * segundo), pra não misturar "22:00" (parece relógio) com "2h 56min". */
export function formatarDuracaoLonga(totalSegundos: number) {
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return "menos de 1min";
}

export function Cronometro({
  tempoTotalSegundos,
  minhaSessaoIniciadaEm,
  outrosRodando,
  onIniciar,
  onPausar,
}: {
  /** Soma do tempo de todo mundo nessa tarefa/conteúdo, sem contar o que está rodando agora. */
  tempoTotalSegundos: number;
  /** Se eu tenho um cronômetro rodando agora, a hora que comecei. */
  minhaSessaoIniciadaEm: string | null;
  /** Nomes de outras pessoas com o cronômetro delas rodando agora (rodam em paralelo, não trava). */
  outrosRodando: string[];
  onIniciar: () => void;
  onPausar: () => void;
}) {
  const [agora, setAgora] = useState(Date.now());
  const euRodando = !!minhaSessaoIniciadaEm;
  const algueRodando = euRodando || outrosRodando.length > 0;

  useEffect(() => {
    if (!algueRodando) return;
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [algueRodando]);

  const meusSegundosCorrendo = euRodando ? Math.floor((agora - new Date(minhaSessaoIniciadaEm!).getTime()) / 1000) : 0;
  const totalExibido = tempoTotalSegundos + meusSegundosCorrendo;

  return (
    <div className={`flex items-center gap-2.5 rounded-full px-2 py-1.5 transition-colors ${euRodando ? "bg-red-50" : "bg-surface"}`}>
      {euRodando ? (
        <button
          onClick={onPausar}
          title="Pausar meu cronômetro"
          className="h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 hover:brightness-110"
        >
          ❚❚
        </button>
      ) : (
        <button
          onClick={onIniciar}
          title="Iniciar meu cronômetro"
          className="h-7 w-7 rounded-full bg-forest text-white flex items-center justify-center shrink-0 hover:brightness-110"
        >
          ▶
        </button>
      )}
      {algueRodando && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
      )}
      <span className={`text-xs font-bold tabular-nums ${euRodando ? "text-red-600" : "text-ink"}`}>{formatarDuracao(totalExibido)}</span>
      {outrosRodando.length > 0 && (
        <span className="text-[10px] text-ink/40 truncate max-w-[140px]" title={outrosRodando.join(", ")}>
          (+ {outrosRodando.join(", ")} agora)
        </span>
      )}
    </div>
  );
}

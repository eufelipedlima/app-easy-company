"use client";

import { useState, useEffect } from "react";

function formatarDuracao(totalSegundos: number) {
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = Math.floor(totalSegundos % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Cronometro({
  tempoTotalSegundos,
  timerIniciadoEm,
  nomeQuemIniciou,
  souEuQuemIniciou,
  onIniciar,
  onPausar,
}: {
  tempoTotalSegundos: number;
  timerIniciadoEm: string | null;
  nomeQuemIniciou: string | null;
  souEuQuemIniciou: boolean;
  onIniciar: () => void;
  onPausar: () => void;
}) {
  const [agora, setAgora] = useState(Date.now());
  const rodando = !!timerIniciadoEm;

  useEffect(() => {
    if (!rodando) return;
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [rodando]);

  const segundosCorrendo = rodando ? Math.floor((agora - new Date(timerIniciadoEm!).getTime()) / 1000) : 0;
  const totalExibido = tempoTotalSegundos + segundosCorrendo;

  return (
    <div className={`flex items-center gap-2.5 rounded-full px-2 py-1.5 transition-colors ${rodando ? "bg-red-50" : "bg-surface"}`}>
      {rodando ? (
        <button
          onClick={onPausar}
          disabled={!souEuQuemIniciou}
          title={souEuQuemIniciou ? "Pausar" : `Em andamento por ${nomeQuemIniciou ?? "alguém"}`}
          className="h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ❚❚
        </button>
      ) : (
        <button
          onClick={onIniciar}
          title="Iniciar cronômetro"
          className="h-7 w-7 rounded-full bg-forest text-white flex items-center justify-center shrink-0 hover:brightness-110"
        >
          ▶
        </button>
      )}
      {rodando && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
      )}
      <span className={`text-xs font-bold tabular-nums ${rodando ? "text-red-600" : "text-ink"}`}>{formatarDuracao(totalExibido)}</span>
      {rodando && !souEuQuemIniciou && nomeQuemIniciou && (
        <span className="text-[10px] text-ink/40">({nomeQuemIniciou})</span>
      )}
    </div>
  );
}

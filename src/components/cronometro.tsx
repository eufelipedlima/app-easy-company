"use client";

import { useState, useEffect } from "react";

function formatarDuracao(totalSegundos: number) {
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m}min`;
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
    <div className="flex items-center gap-2.5 rounded-full bg-surface px-2 py-1.5">
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
      <span className="text-xs font-bold text-ink tabular-nums">{formatarDuracao(totalExibido)}</span>
      {rodando && !souEuQuemIniciou && nomeQuemIniciou && (
        <span className="text-[10px] text-ink/40">({nomeQuemIniciou})</span>
      )}
    </div>
  );
}

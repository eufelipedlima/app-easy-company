"use client";

import { useState, useEffect } from "react";
import { formatarDuracao } from "./cronometro";

export interface SessaoPessoa {
  nome: string;
  segundosAcumulados: number;
  rodandoDesde: string | null;
}

export function TempoPorPessoa({ sessoes }: { sessoes: SessaoPessoa[] }) {
  const [aberto, setAberto] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const temAlguemRodando = sessoes.some((s) => s.rodandoDesde);

  useEffect(() => {
    if (!temAlguemRodando || !aberto) return;
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [temAlguemRodando, aberto]);

  function totalAtual(s: SessaoPessoa) {
    if (!s.rodandoDesde) return s.segundosAcumulados;
    return s.segundosAcumulados + Math.floor((agora - new Date(s.rodandoDesde).getTime()) / 1000);
  }

  const comTempo = sessoes.filter((s) => s.segundosAcumulados > 0 || s.rodandoDesde);
  if (comTempo.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="text-xs font-semibold text-ink/40 hover:text-ink transition-colors inline-flex items-center gap-1"
        title="Ver tempo por pessoa"
      >
        👥 Por pessoa
      </button>
      {aberto && (
        <div
          className="absolute z-20 top-6 left-0 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-3"
          onMouseLeave={() => setAberto(false)}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40 mb-2">Tempo dedicado, por pessoa</p>
          <div className="space-y-2">
            {comTempo
              .sort((a, b) => b.segundosAcumulados - a.segundosAcumulados)
              .map((s) => (
                <div key={s.nome} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-ink/80 truncate">
                    {s.rodandoDesde && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                      </span>
                    )}
                    {s.nome}
                  </span>
                  <span className="font-semibold text-ink shrink-0 ml-2">{formatarDuracao(totalAtual(s))}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

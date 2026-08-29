"use client";

/** Abas no estilo clássico (sublinhado na ativa, sobre uma linha de base
 * comum) — usado pra trocar entre Kanban/Lista/Semana/Mês em Tarefas,
 * Projetos e Conteúdo. */
export function AbasVisualizacao<T extends string>({
  abas,
  ativa,
  onMudar,
}: {
  abas: { chave: T; label: string }[];
  ativa: T;
  onMudar: (chave: T) => void;
}) {
  return (
    <div className="flex items-center gap-5 border-b-2 border-black/5 shrink-0">
      {abas.map((a) => (
        <button
          key={a.chave}
          onClick={() => onMudar(a.chave)}
          className={`relative pb-2.5 text-sm font-bold transition-colors ${
            ativa === a.chave ? "text-ink" : "text-ink/40 hover:text-ink/70"
          }`}
        >
          {a.label}
          {ativa === a.chave && <span className="absolute left-0 right-0 -bottom-0.5 h-[3px] rounded-full bg-ink" />}
        </button>
      ))}
    </div>
  );
}

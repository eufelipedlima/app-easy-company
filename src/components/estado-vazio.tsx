"use client";

export function EstadoVazio({
  emoji,
  titulo,
  descricao,
  acaoLabel,
  onAcao,
}: {
  emoji: string;
  titulo: string;
  descricao?: string;
  acaoLabel?: string;
  onAcao?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 animate-[surgir_0.4s_ease-out]">
      <div className="h-16 w-16 rounded-2xl bg-mint flex items-center justify-center text-3xl mb-4 rotate-[-4deg] shadow-sm">
        {emoji}
      </div>
      <p className="text-sm font-bold text-ink mb-1">{titulo}</p>
      {descricao && <p className="text-xs text-ink/50 max-w-xs">{descricao}</p>}
      {acaoLabel && onAcao && (
        <button
          onClick={onAcao}
          className="mt-4 rounded-full bg-ink text-white px-5 py-2 text-xs font-semibold hover:bg-forest transition-colors"
        >
          {acaoLabel}
        </button>
      )}
      <style jsx global>{`
        @keyframes surgir {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

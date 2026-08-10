"use client";

export function EsqueletoLinha({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-black/[0.06] animate-pulse ${className}`} />;
}

export function EsqueletoCard() {
  return (
    <div className="rounded-2xl bg-card border border-black/5 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-black/[0.06] animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <EsqueletoLinha className="h-3 w-2/3" />
          <EsqueletoLinha className="h-2.5 w-1/3" />
        </div>
      </div>
      <EsqueletoLinha className="h-2.5 w-full" />
      <EsqueletoLinha className="h-2.5 w-4/5" />
    </div>
  );
}

export function EsqueletoLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4 border-b border-black/5 last:border-0">
          <div className="h-9 w-9 rounded-full bg-black/[0.06] animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <EsqueletoLinha className="h-3 w-1/2" />
            <EsqueletoLinha className="h-2.5 w-1/4" />
          </div>
          <EsqueletoLinha className="h-5 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoGrade({ itens = 6 }: { itens?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: itens }).map((_, i) => (
        <EsqueletoCard key={i} />
      ))}
    </div>
  );
}

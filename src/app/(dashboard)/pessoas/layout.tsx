"use client";

export default function PessoasLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Pessoas</h1>
        <p className="text-sm text-ink/60">
          Cadastro central de clientes, funcionários e prestadores da Easy Company.
        </p>
      </div>
      {children}
    </main>
  );
}

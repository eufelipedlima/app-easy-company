"use client";

import { useState } from "react";
import { normalizar } from "@/lib/normalizar";

export interface OpcaoCliente {
  id: string;
  nome: string;
}

export function BuscaCliente({
  clientes,
  valor,
  onSelecionar,
  placeholder,
}: {
  clientes: OpcaoCliente[];
  valor: OpcaoCliente | null;
  onSelecionar: (c: OpcaoCliente | null) => void;
  placeholder?: string;
}) {
  const [busca, setBusca] = useState(valor?.nome ?? "");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const sugestoes = clientes.filter((c) => normalizar(c.nome).includes(normalizar(busca)));

  return (
    <div className="relative">
      <input
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          onSelecionar(null);
          setMostrarSugestoes(true);
        }}
        onFocus={() => setMostrarSugestoes(true)}
        className="input"
        placeholder={placeholder ?? "Digite pra buscar..."}
      />
      {mostrarSugestoes && busca && !valor && (
        <div className="absolute z-20 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
          {sugestoes.length > 0 ? (
            sugestoes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelecionar(c);
                  setBusca(c.nome);
                  setMostrarSugestoes(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
              >
                {c.nome}
              </button>
            ))
          ) : (
            <p className="px-4 py-2.5 text-sm text-ink/40">Nenhum cliente encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

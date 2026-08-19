"use client";

import { useEffect, useState, use } from "react";
import { ConteudoFormatado } from "@/components/conteudo-formatado";

interface DocPublico {
  id: string;
  titulo: string;
  descricao: string | null;
  conteudo: string | null;
  emoji: string | null;
  updated_at: string;
}

export default function DocPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [doc, setDoc] = useState<DocPublico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const res = await fetch(`/api/docs-publico/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Link não encontrado.");
      } else {
        setDoc(json.doc);
      }
      setLoading(false);
    }
    carregar();
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface/30">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (erro || !doc) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface/30">
        <div className="text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm font-semibold text-ink">{erro ?? "Link não encontrado."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface/30">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 py-12">
        <div className="rounded-3xl bg-card border border-black/5 p-8 sm:p-10">
          <span className="text-4xl block mb-3">{doc.emoji || "📄"}</span>
          <h1 className="text-3xl font-extrabold text-ink mb-2">{doc.titulo}</h1>
          {doc.descricao && <p className="text-sm text-ink/50 mb-6">{doc.descricao}</p>}
          {doc.conteudo ? (
            <ConteudoFormatado html={doc.conteudo} className="mt-6" />
          ) : (
            <p className="text-sm text-ink/40 mt-6">Esse documento ainda não tem conteúdo.</p>
          )}
        </div>
        <p className="text-center text-xs text-ink/30 mt-6">Compartilhado via Easy Company</p>
      </div>
    </main>
  );
}

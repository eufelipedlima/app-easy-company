"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BuscaCliente, type OpcaoCliente } from "@/components/busca-cliente";

interface Doc {
  id: string;
  titulo: string;
  conteudo: string | null;
  cliente_id: string | null;
  criado_por: string | null;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
}

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DocDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [clientes, setClientes] = useState<OpcaoCliente[]>([]);
  const [colegas, setColegas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<OpcaoCliente | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: d }, { data: clientesData }, { data: funcData }] = await Promise.all([
      supabase.from("docs").select("*").eq("id", id).maybeSingle(),
      supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )"),
      supabase.from("funcionarios").select("auth_user_id, papeis ( pessoas ( nome, apelido ) )").not("auth_user_id", "is", null),
    ]);

    const listaClientes = ((clientesData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
      .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setClientes(listaClientes);

    const mapaColegas: Record<string, string> = {};
    for (const f of (funcData ?? []) as unknown as { auth_user_id: string; papeis: { pessoas: { nome: string; apelido: string | null } | null } | null }[]) {
      mapaColegas[f.auth_user_id] = f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Alguém";
    }
    setColegas(mapaColegas);

    if (d) {
      setDoc(d);
      setTitulo(d.titulo);
      setConteudo(d.conteudo ?? "");
      setClienteSelecionado(d.cliente_id ? listaClientes.find((c) => c.id === d.cliente_id) ?? null : null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarCampo(campo: Record<string, string | null>) {
    setSalvando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("docs")
      .update({ ...campo, atualizado_por: user?.id ?? null })
      .eq("id", id);
    setSalvando(false);
    setDoc((atual) => (atual ? { ...atual, ...campo, updated_at: new Date().toISOString() } : atual));
  }

  async function excluirDoc() {
    if (!window.confirm(`Excluir "${doc?.titulo}"? Essa ação não pode ser desfeita.`)) return;
    const supabase = createClient();
    await supabase.from("docs").delete().eq("id", id);
    router.push("/docs");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-ink/50">Doc não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface/30">
      <div className="px-8 py-4 flex items-center justify-between bg-white">
        <button
          onClick={() => router.push("/docs")}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors"
        >
          ← Docs
        </button>
        <div className="flex items-center gap-3">
          {salvando && <span className="text-xs text-ink/40">Salvando...</span>}
          <button onClick={excluirDoc} className="text-sm font-semibold text-red-500 hover:text-red-700">
            Excluir
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => {
            if (titulo.trim() && titulo.trim() !== doc.titulo) salvarCampo({ titulo: titulo.trim() });
          }}
          className="text-3xl font-extrabold text-ink w-full mb-3 outline-none focus:bg-white rounded-lg px-1 -mx-1 bg-transparent"
        />

        <div className="flex items-center gap-4 mb-6">
          <div className="w-64">
            <BuscaCliente
              clientes={clientes}
              valor={clienteSelecionado}
              onSelecionar={(c) => {
                setClienteSelecionado(c);
                salvarCampo({ cliente_id: c?.id ?? null });
              }}
              placeholder="Digite pra buscar (deixe em branco = interno)..."
            />
          </div>
          <p className="text-xs text-ink/40">
            Atualizado em {formatarQuando(doc.updated_at)}
            {doc.atualizado_por && colegas[doc.atualizado_por] && ` por ${colegas[doc.atualizado_por]}`}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <RichTextEditor
            valorHtml={conteudo}
            onChange={setConteudo}
            onSalvar={() => salvarCampo({ conteudo: conteudo || null })}
            placeholder="Escreva aqui... anotações de reunião, links importantes, entregáveis, inspirações..."
          />
        </div>
      </div>
    </main>
  );
}

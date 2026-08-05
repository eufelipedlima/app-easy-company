"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { BuscaCliente, type OpcaoCliente } from "@/components/busca-cliente";

interface Doc {
  id: string;
  titulo: string;
  cliente_id: string | null;
  updated_at: string;
  clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
}

function formatarQuando(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DocsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [clientes, setClientes] = useState<OpcaoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [clienteFiltroId, setClienteFiltroId] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("docs")
      .select("id, titulo, cliente_id, updated_at, clientes ( papeis ( pessoas ( nome ) ) )")
      .order("updated_at", { ascending: false });
    if (clienteFiltroId === "internos") query = query.is("cliente_id", null);
    else if (clienteFiltroId) query = query.eq("cliente_id", clienteFiltroId);
    const { data } = await query;
    setDocs((data as unknown as Doc[]) ?? []);
    setLoading(false);
  }, [clienteFiltroId]);

  useEffect(() => {
    async function carregarClientes() {
      const supabase = createClient();
      const { data } = await supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )");
      const lista = ((data ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
        .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setClientes(lista);
    }
    carregarClientes();
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarDoc() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("docs")
      .insert({
        titulo: "Documento sem título",
        cliente_id: clienteFiltroId && clienteFiltroId !== "internos" ? clienteFiltroId : null,
        criado_por: user?.id ?? null,
        atualizado_por: user?.id ?? null,
      })
      .select("id")
      .single();
    if (!error && data) router.push(`/docs/${data.id}`);
  }

  const docsFiltrados = docs.filter((d) => normalizar(d.titulo).includes(normalizar(busca)));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Docs</h1>
          <p className="text-sm text-ink/60">Documentos, anotações e links importantes — por cliente ou internos.</p>
        </div>
        <button
          onClick={() => setNovoAberto(true)}
          className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors shrink-0"
        >
          + Novo doc
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título..."
          className="input py-2 !w-64"
        />
        <select value={clienteFiltroId} onChange={(e) => setClienteFiltroId(e.target.value)} className="input py-2 !w-auto">
          <option value="">Todos os clientes</option>
          <option value="internos">Internos (sem cliente)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : docsFiltrados.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum doc encontrado.</p>
      ) : (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
          {docsFiltrados.map((d) => (
            <button
              key={d.id}
              onClick={() => router.push(`/docs/${d.id}`)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">📄</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink truncate">{d.titulo}</span>
                  <span className="block text-xs text-ink/40 truncate">
                    {d.clientes?.papeis?.pessoas?.nome ?? "Interno"}
                  </span>
                </span>
              </span>
              <span className="text-xs text-ink/40 shrink-0">{formatarQuando(d.updated_at)}</span>
            </button>
          ))}
        </div>
      )}

      {novoAberto && (
        <NovoDocModal
          clientes={clientes}
          clienteFixoId={clienteFiltroId && clienteFiltroId !== "internos" ? clienteFiltroId : null}
          onClose={() => setNovoAberto(false)}
          onCriado={(id) => router.push(`/docs/${id}`)}
        />
      )}
    </main>
  );
}

function NovoDocModal({
  clientes,
  clienteFixoId,
  onClose,
  onCriado,
}: {
  clientes: OpcaoCliente[];
  clienteFixoId: string | null;
  onClose: () => void;
  onCriado: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<OpcaoCliente | null>(
    clienteFixoId ? clientes.find((c) => c.id === clienteFixoId) ?? null : null
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro("Dê um título pro doc.");
      return;
    }
    setSaving(true);
    setErro(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("docs")
      .insert({
        titulo: titulo.trim(),
        cliente_id: clienteSelecionado?.id ?? null,
        criado_por: user?.id ?? null,
        atualizado_por: user?.id ?? null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      setErro(error?.message ?? "Erro ao criar doc.");
      return;
    }
    onCriado(data.id);
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Novo doc</h2>
        <form onSubmit={criar} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Título *</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" autoFocus required />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Cliente</span>
            <BuscaCliente
              clientes={clientes}
              valor={clienteSelecionado}
              onSelecionar={setClienteSelecionado}
              placeholder="Digite pra buscar (deixe em branco = interno)..."
            />
          </label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {saving ? "Criando..." : "Criar e abrir"}
            </button>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

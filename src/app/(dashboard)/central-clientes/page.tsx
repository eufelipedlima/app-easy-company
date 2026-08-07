"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";

interface ClienteResumo {
  id: string;
  nome: string;
  fotoUrl: string | null;
  segmento: string | null;
}

const CORES_AVATAR = [
  "bg-red-400", "bg-orange-400", "bg-amber-500", "bg-lime-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
];
function corAvatar(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % CORES_AVATAR.length;
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}

export default function CentralClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [souAdmin, setSouAdmin] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("clientes")
      .select("id, papeis ( pessoas ( nome, foto_url, segmentos ( nome ) ) )")
      .eq("ativo_central_clientes", true);
    const lista = ((data ?? []) as unknown as {
      id: string;
      papeis: { pessoas: { nome: string; foto_url: string | null; segmentos: { nome: string } | null } | null } | null;
    }[])
      .map((c) => ({
        id: c.id,
        nome: c.papeis?.pessoas?.nome ?? "—",
        fotoUrl: c.papeis?.pessoas?.foto_url ?? null,
        segmento: c.papeis?.pessoas?.segmentos?.nome ?? null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setClientes(lista);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function carregarPermissao() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfilData } = await supabase
        .from("funcionarios")
        .select("perfis_acesso ( nome )")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const nomePerfil = (perfilData as unknown as { perfis_acesso: { nome: string } | null } | null)?.perfis_acesso?.nome;
      setSouAdmin(nomePerfil === "Administrador");
    }
    carregarPermissao();
    carregar();
  }, [carregar]);

  const filtrados = clientes.filter((c) => normalizar(c.nome).includes(normalizar(busca)));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink mb-1">Central de Clientes</h1>
          <p className="text-sm text-ink/60">Tarefas, conteúdo, chat e docs de cada cliente, tudo num só lugar.</p>
        </div>
        {souAdmin && (
          <button
            onClick={() => setModalAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors shrink-0"
          >
            + Adicionar cliente
          </button>
        )}
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cliente..."
        className="input py-2.5 !w-72 mb-6"
      />

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum cliente encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtrados.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/central-clientes/${c.id}`)}
              className="flex items-center gap-3 rounded-2xl bg-card border border-black/5 p-4 hover:shadow-md hover:border-forest/20 transition-all text-left"
            >
              {c.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.fotoUrl} alt={c.nome} className="h-11 w-11 rounded-full object-cover shrink-0" />
              ) : (
                <div className={`h-11 w-11 rounded-full ${corAvatar(c.nome)} text-white flex items-center justify-center font-bold shrink-0`}>
                  {c.nome.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink truncate">{c.nome}</p>
                {c.segmento && <p className="text-xs text-ink/50 truncate">{c.segmento}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {modalAberto && (
        <AdicionarClienteModal
          jaAtivosIds={clientes.map((c) => c.id)}
          onClose={() => setModalAberto(false)}
          onAdicionado={(id) => {
            setModalAberto(false);
            router.push(`/central-clientes/${id}`);
          }}
        />
      )}
    </main>
  );
}

function AdicionarClienteModal({
  jaAtivosIds,
  onClose,
  onAdicionado,
}: {
  jaAtivosIds: string[];
  onClose: () => void;
  onAdicionado: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<{ id: string; nome: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data } = await supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )");
      const lista = ((data ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
        .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
        .filter((c) => !jaAtivosIds.includes(c.id))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setOpcoes(lista);
    }
    carregar();
  }, [jaAtivosIds]);

  const sugestoes = opcoes.filter((o) => normalizar(o.nome).includes(normalizar(busca)));

  async function adicionar(clienteId: string) {
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("clientes").update({ ativo_central_clientes: true }).eq("id", clienteId);
    setSalvando(false);
    onAdicionado(clienteId);
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-1">Adicionar cliente à Central</h2>
        <p className="text-xs text-ink/50 mb-4">
          Pra clientes sem contrato ainda (projetos internos, parcerias, etc.) — não mexe em nada do financeiro.
        </p>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente..."
          className="input mb-3"
          autoFocus
        />
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {sugestoes.length === 0 ? (
            <p className="text-xs text-ink/40 px-1">Nenhum cliente encontrado (ou todos já estão na Central).</p>
          ) : (
            sugestoes.map((o) => (
              <button
                key={o.id}
                onClick={() => adicionar(o.id)}
                disabled={salvando}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-surface transition-colors disabled:opacity-50"
              >
                {o.nome}
              </button>
            ))
          )}
        </div>
        <button onClick={onClose} className="text-sm font-semibold text-ink/60 hover:text-ink mt-4">
          Cancelar
        </button>
      </div>
    </div>
  );
}

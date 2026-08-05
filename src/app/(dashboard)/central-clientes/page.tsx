"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data: contratosAtivos } = await supabase.from("contratos").select("cliente_id").eq("status", "ativo");
      const idsAtivos = new Set((contratosAtivos ?? []).map((c) => c.cliente_id));

      const { data } = await supabase
        .from("clientes")
        .select("id, papeis ( pessoas ( nome, foto_url, segmentos ( nome ) ) )");
      const lista = ((data ?? []) as unknown as {
        id: string;
        papeis: { pessoas: { nome: string; foto_url: string | null; segmentos: { nome: string } | null } | null } | null;
      }[])
        .filter((c) => idsAtivos.has(c.id))
        .map((c) => ({
          id: c.id,
          nome: c.papeis?.pessoas?.nome ?? "—",
          fotoUrl: c.papeis?.pessoas?.foto_url ?? null,
          segmento: c.papeis?.pessoas?.segmentos?.nome ?? null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setClientes(lista);
      setLoading(false);
    }
    carregar();
  }, []);

  const filtrados = clientes.filter((c) => normalizar(c.nome).includes(normalizar(busca)));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Central de Clientes</h1>
        <p className="text-sm text-ink/60">Tarefas, conteúdo, chat e docs de cada cliente, tudo num só lugar.</p>
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
    </main>
  );
}

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { EstadoVazio } from "@/components/estado-vazio";
import { EsqueletoGrade } from "@/components/esqueleto";
import { NumeroAnimado } from "@/components/numero-animado";
import { Users2, ListChecks, MessageCircle, FileText } from "lucide-react";

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

const GRID_COLS = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export default function CentralClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [contagemTarefas, setContagemTarefas] = useState<Record<string, number>>({});
  const [contagemConversas, setContagemConversas] = useState<Record<string, number>>({});
  const [contagemDocs, setContagemDocs] = useState<Record<string, number>>({});
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

    if (lista.length > 0) {
      const idsClientes = lista.map((c) => c.id);
      const [{ data: tarefasData }, { data: docsData }, { data: canaisData }] = await Promise.all([
        supabase.from("tarefas").select("cliente_id").in("cliente_id", idsClientes).is("excluido_em", null),
        supabase.from("docs").select("cliente_id").in("cliente_id", idsClientes).is("excluido_em", null),
        supabase.from("chat_canais").select("id, cliente_id").in("cliente_id", idsClientes),
      ]);

      const mapaTarefas: Record<string, number> = {};
      for (const t of tarefasData ?? []) {
        if (t.cliente_id) mapaTarefas[t.cliente_id] = (mapaTarefas[t.cliente_id] ?? 0) + 1;
      }
      setContagemTarefas(mapaTarefas);

      const mapaDocs: Record<string, number> = {};
      for (const d of docsData ?? []) {
        if (d.cliente_id) mapaDocs[d.cliente_id] = (mapaDocs[d.cliente_id] ?? 0) + 1;
      }
      setContagemDocs(mapaDocs);

      const canalParaCliente: Record<string, string> = {};
      const canalIds: string[] = [];
      for (const c of canaisData ?? []) {
        if (c.cliente_id) {
          canalParaCliente[c.id] = c.cliente_id;
          canalIds.push(c.id);
        }
      }
      if (canalIds.length > 0) {
        const { data: mensagensData } = await supabase.from("chat_mensagens").select("canal_id").in("canal_id", canalIds);
        const mapaConversas: Record<string, number> = {};
        for (const m of mensagensData ?? []) {
          const clienteId = canalParaCliente[m.canal_id];
          if (clienteId) mapaConversas[clienteId] = (mapaConversas[clienteId] ?? 0) + 1;
        }
        setContagemConversas(mapaConversas);
      }
    }
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

  const totais = useMemo(
    () => ({
      tarefas: Object.values(contagemTarefas).reduce((a, b) => a + b, 0),
      conversas: Object.values(contagemConversas).reduce((a, b) => a + b, 0),
      docs: Object.values(contagemDocs).reduce((a, b) => a + b, 0),
    }),
    [contagemTarefas, contagemConversas, contagemDocs]
  );

  return (
    <main className="w-full px-6 sm:px-8 lg:px-12 py-10">
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
        <EsqueletoGrade itens={10} colsClassName={GRID_COLS} />
      ) : filtrados.length === 0 ? (
        <EstadoVazio emoji="🔍" titulo="Nenhum cliente encontrado" descricao="Tenta buscar por outro nome." />
      ) : (
        <div className={`anim-stagger grid ${GRID_COLS} gap-4`}>
          {filtrados.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/central-clientes/${c.id}`)}
              className="group flex flex-col text-left rounded-2xl bg-card border border-black/5 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                {c.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.fotoUrl} alt={c.nome} className="h-14 w-14 rounded-2xl object-cover shadow-sm shrink-0" />
                ) : (
                  <div
                    className={`h-14 w-14 rounded-2xl ${corAvatar(c.nome)} text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0`}
                  >
                    {c.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-mint text-forest px-2.5 py-1 text-[10px] font-bold shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-forest" /> Ativo
                </span>
              </div>

              <p className="text-sm font-extrabold text-ink truncate group-hover:text-forest transition-colors">{c.nome}</p>
              {c.segmento && (
                <span className="inline-block w-fit max-w-full mt-1.5 rounded-full bg-surface text-ink/50 px-2.5 py-1 text-[11px] font-semibold truncate">
                  {c.segmento}
                </span>
              )}

              <div className="mt-auto pt-3 flex items-center gap-3 border-t border-black/5 text-[11px] font-semibold text-ink/45">
                <span className="flex items-center gap-1" title="Tarefas">
                  <ListChecks size={13} /> {contagemTarefas[c.id] ?? 0}
                </span>
                <span className="flex items-center gap-1" title="Conversas">
                  <MessageCircle size={13} /> {contagemConversas[c.id] ?? 0}
                </span>
                <span className="flex items-center gap-1" title="Documentos">
                  <FileText size={13} /> {contagemDocs[c.id] ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && filtrados.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-mint text-forest flex items-center justify-center shrink-0">
              <Users2 size={16} />
            </div>
            <div>
              <NumeroAnimado valor={clientes.length} className="block text-lg font-extrabold text-ink leading-tight" />
              <p className="text-[11px] text-ink/50">Clientes ativos</p>
            </div>
          </div>
          <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-mint text-forest flex items-center justify-center shrink-0">
              <ListChecks size={16} />
            </div>
            <div>
              <NumeroAnimado valor={totais.tarefas} className="block text-lg font-extrabold text-ink leading-tight" />
              <p className="text-[11px] text-ink/50">Tarefas no total</p>
            </div>
          </div>
          <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-mint text-forest flex items-center justify-center shrink-0">
              <MessageCircle size={16} />
            </div>
            <div>
              <NumeroAnimado valor={totais.conversas} className="block text-lg font-extrabold text-ink leading-tight" />
              <p className="text-[11px] text-ink/50">Mensagens no total</p>
            </div>
          </div>
          <div className="rounded-2xl bg-card border border-black/5 p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-mint text-forest flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div>
              <NumeroAnimado valor={totais.docs} className="block text-lg font-extrabold text-ink leading-tight" />
              <p className="text-[11px] text-ink/50">Documentos</p>
            </div>
          </div>
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

  async function adicionar(clienteId: string, nomeCliente: string) {
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("clientes").update({ ativo_central_clientes: true }).eq("id", clienteId);

    // Garante um canal de chat pro cliente, sem duplicar se ele já tiver um (ex.: foi recriado antes)
    const { data: canalExistente } = await supabase
      .from("chat_canais")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("tipo", "cliente")
      .maybeSingle();

    if (!canalExistente) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: novoCanal } = await supabase
        .from("chat_canais")
        .insert({
          tipo: "cliente",
          nome: nomeCliente,
          cliente_id: clienteId,
          criado_por: user?.id ?? null,
        })
        .select("id")
        .single();
      if (novoCanal && user?.id) {
        await supabase.from("chat_participantes").insert({ canal_id: novoCanal.id, auth_user_id: user.id });
      }
    }

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
                onClick={() => adicionar(o.id, o.nome)}
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

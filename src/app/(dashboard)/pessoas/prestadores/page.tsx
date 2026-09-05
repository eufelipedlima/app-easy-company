"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";
import { PessoaForm } from "@/components/pessoa-form";
import { useTabelaConfig, LINHAS_POR_PAGINA_OPCOES, type ColunaDef } from "@/lib/use-tabela-config";

interface Prestador {
  id: string;
  tipo_servico: string | null;
  observacoes: string | null;
  papeis: { pessoas: { nome: string; whatsapp: string | null; email: string | null; pix: string | null } | null } | null;
}

interface PessoaOpcao {
  id: string;
  nome: string;
  tipo_pessoa: "PF" | "PJ";
}

const COLUNAS_DISPONIVEIS: ColunaDef[] = [
  { key: "nome", label: "Nome" },
  { key: "tipo_servico", label: "Tipo de serviço" },
  { key: "contato", label: "Contato" },
  { key: "pix", label: "PIX" },
];

const CORES_AVATAR = [
  "bg-red-400", "bg-orange-400", "bg-amber-500", "bg-lime-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
];
function corAvatarPessoa(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % CORES_AVATAR.length;
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}
function iniciaisPessoa(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

function renderCelulaPrestador(key: string, p: Prestador) {
  switch (key) {
    case "nome": {
      const nome = p.papeis?.pessoas?.nome ?? "—";
      return (
        <span className="flex items-center gap-2.5 min-w-0">
          <span
            className={`h-7 w-7 rounded-full ${corAvatarPessoa(nome)} text-white flex items-center justify-center text-[11px] font-bold shrink-0`}
          >
            {iniciaisPessoa(nome)}
          </span>
          <span className="font-semibold text-ink truncate">{nome}</span>
        </span>
      );
    }
    case "tipo_servico":
      return <span className="text-ink/70">{p.tipo_servico ?? "—"}</span>;
    case "contato":
      return (
        <span className="text-ink/70">
          {p.papeis?.pessoas?.whatsapp && <span className="block">{p.papeis.pessoas.whatsapp}</span>}
          {p.papeis?.pessoas?.email && <span className="block text-xs text-ink/50">{p.papeis.pessoas.email}</span>}
        </span>
      );
    case "pix":
      return <span className="text-ink/70">{p.papeis?.pessoas?.pix ?? "—"}</span>;
    default:
      return null;
  }
}

export default function PrestadoresPage() {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<Prestador | null>(null);
  const [buscaLista, setBuscaLista] = useState("");

  const {
    colunas,
    painelColunasAberto,
    setPainelColunasAberto,
    linhasPorPagina,
    paginaAtual,
    setPaginaAtual,
    alternarVisibilidade,
    moverColuna,
    mudarLinhasPorPagina,
  } = useTabelaConfig("prestadores", COLUNAS_DISPONIVEIS);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("prestadores")
      .select("id, tipo_servico, observacoes, papeis ( pessoas ( nome, whatsapp, email, pix ) )")
      .eq("ativo", true)
      .order("created_at", { ascending: false });
    setPrestadores((data as unknown as Prestador[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("prestadores").update({ ativo: false }).eq("id", id);
    carregar();
  }

  const prestadoresFiltrados = prestadores.filter((p) => {
    const termo = normalizar(buscaLista);
    if (!termo) return true;
    return (
      normalizar(p.papeis?.pessoas?.nome ?? "").includes(termo) ||
      normalizar(p.tipo_servico ?? "").includes(termo)
    );
  });

  useEffect(() => {
    setPaginaAtual(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaLista]);

  const totalPaginas = Math.max(Math.ceil(prestadoresFiltrados.length / linhasPorPagina), 1);
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const paginados = prestadoresFiltrados.slice((paginaSegura - 1) * linhasPorPagina, paginaSegura * linhasPorPagina);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35 text-base pointer-events-none">🔍</span>
          <input
            value={buscaLista}
            onChange={(e) => setBuscaLista(e.target.value)}
            placeholder="Buscar prestador ou tipo de serviço..."
            style={{ paddingLeft: "2.5rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
            className="input w-72"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setPainelColunasAberto((v) => !v)}
              className="rounded-xl border-2 border-ink/15 text-ink px-4 py-2.5 text-sm font-bold hover:bg-surface transition-colors"
            >
              ⚙ Colunas
            </button>
          {painelColunasAberto && (
            <div
              className="absolute right-0 z-10 mt-2 w-64 rounded-2xl bg-white border border-black/10 shadow-lg p-2"
              onMouseLeave={() => setPainelColunasAberto(false)}
            >
              {colunas.map((c, i) => {
                const def = COLUNAS_DISPONIVEIS.find((d) => d.key === c.key);
                if (!def) return null;
                return (
                  <div key={c.key} className="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-surface rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={c.visivel}
                        onChange={() => alternarVisibilidade(c.key)}
                        className="h-3.5 w-3.5 rounded accent-forest"
                      />
                      <span className={c.visivel ? "text-ink" : "text-ink/40"}>{def.label}</span>
                    </label>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moverColuna(c.key, -1)}
                        disabled={i === 0}
                        className="text-ink/40 hover:text-ink disabled:opacity-20 px-1"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moverColuna(c.key, 1)}
                        disabled={i === colunas.length - 1}
                        className="text-ink/40 hover:text-ink disabled:opacity-20 px-1"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                );
              })}
              <label className="flex items-center justify-between gap-2 px-2 py-2 mt-1 border-t border-black/5 text-sm">
                <span className="text-ink/70">Linhas por página</span>
                <select
                  value={linhasPorPagina}
                  onChange={(e) => mudarLinhasPorPagina(Number(e.target.value))}
                  className="input py-1 text-xs w-20"
                >
                  {LINHAS_POR_PAGINA_OPCOES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        {!painelAberto && !editando && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-xl bg-forest text-white px-5 py-2.5 text-sm font-semibold hover:bg-ink transition-colors"
          >
            + Novo prestador
          </button>
        )}
        </div>
      </div>

      {(painelAberto || editando) && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => {
            setPainelAberto(false);
            setEditando(null);
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-card p-7 shadow-2xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">{editando ? "Editar prestador" : "Cadastrar prestador de serviço"}</h2>
            <PrestadorForm
              prestadorEditando={editando}
              onSaved={() => {
                setPainelAberto(false);
                setEditando(null);
                carregar();
              }}
              onCancel={() => {
                setPainelAberto(false);
                setEditando(null);
              }}
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : prestadoresFiltrados.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhum prestador encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-mint/50 border-b-2 border-mint">
                {colunas
                  .filter((c) => c.visivel)
                  .map((c) => (
                    <th key={c.key} className="px-4 py-4 font-bold text-forest text-xs uppercase tracking-wide">
                      {COLUNAS_DISPONIVEIS.find((d) => d.key === c.key)?.label}
                    </th>
                  ))}
                <th className="px-4 py-4 font-bold text-forest text-xs uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
                  {colunas
                    .filter((c) => c.visivel)
                    .map((c, i) => (
                      <td key={c.key} className={`px-4 py-3 ${i === 0 ? "relative" : ""}`}>
                        {i === 0 && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-forest" />}
                        <span className={i === 0 ? "pl-2.5 block" : undefined}>{renderCelulaPrestador(c.key, p)}</span>
                      </td>
                    ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditando(p);
                          setPainelAberto(false);
                        }}
                        title="Editar"
                        className="h-8 w-8 rounded-lg flex items-center justify-center bg-forest text-white hover:bg-ink transition-colors"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => remover(p.id)}
                        title="Desativar"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-ink/40 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        🗄
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {prestadoresFiltrados.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-ink/50">
          <div className="flex items-center gap-4">
            <p>
              Mostrando {(paginaSegura - 1) * linhasPorPagina + 1}–
              {Math.min(paginaSegura * linhasPorPagina, prestadoresFiltrados.length)} de {prestadoresFiltrados.length}
            </p>
            <label className="flex items-center gap-2 text-xs">
              Linhas
              <select
                value={linhasPorPagina}
                onChange={(e) => mudarLinhasPorPagina(Number(e.target.value))}
                className="input py-1 text-xs w-16"
              >
                {LINHAS_POR_PAGINA_OPCOES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))}
              disabled={paginaSegura === 1}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="mx-1 h-7 min-w-7 px-2 rounded-lg border-2 border-forest bg-mint text-forest flex items-center justify-center text-xs font-bold">
              {paginaSegura}
            </span>
            <span className="text-xs text-ink/40">de {totalPaginas}</span>
            <button
              onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))}
              disabled={paginaSegura === totalPaginas}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrestadorForm({
  prestadorEditando,
  onSaved,
  onCancel,
}: {
  prestadorEditando?: Prestador | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editando = !!prestadorEditando;
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [busca, setBusca] = useState(prestadorEditando?.papeis?.pessoas?.nome ?? "");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoPessoa, setCadastrandoPessoa] = useState(false);
  const [tipoServico, setTipoServico] = useState(prestadorEditando?.tipo_servico ?? "");
  const [observacoes, setObservacoes] = useState(prestadorEditando?.observacoes ?? "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarPessoas() {
      const supabase = createClient();
      const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
      setPessoas(data ?? []);
    }
    carregarPessoas();
  }, []);

  const sugestoes = pessoas.filter((p) => normalizar(p.nome).includes(normalizar(busca)));

  async function garantirPrestadorPapelId(pessoaId: string): Promise<string> {
    const supabase = createClient();
    const { data: existente } = await supabase
      .from("papeis")
      .select("id")
      .eq("pessoa_id", pessoaId)
      .eq("papel", "prestador")
      .maybeSingle();
    if (existente?.id) return existente.id;

    const { data: novo, error } = await supabase
      .from("papeis")
      .insert({ pessoa_id: pessoaId, papel: "prestador" })
      .select("id")
      .single();
    if (error) throw error;
    return novo.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editando && !pessoaSelecionada) {
      setErro("Selecione a pessoa.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      if (editando && prestadorEditando) {
        const { error } = await supabase
          .from("prestadores")
          .update({ tipo_servico: tipoServico || null, observacoes: observacoes || null })
          .eq("id", prestadorEditando.id);
        if (error) throw error;
      } else {
        const papelId = await garantirPrestadorPapelId(pessoaSelecionada!.id);
        const { error } = await supabase.from("prestadores").insert({
          papel_id: papelId,
          tipo_servico: tipoServico || null,
          observacoes: observacoes || null,
        });
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (cadastrandoPessoa) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setCadastrandoPessoa(false)}
          className="text-sm font-semibold text-ink/50 hover:text-ink mb-4"
        >
          ← Voltar
        </button>
        <PessoaForm
          nomeInicial={busca}
          onCancel={() => setCadastrandoPessoa(false)}
          onSaved={async (pessoa) => {
            const supabase = createClient();
            const { data } = await supabase.from("pessoas").select("id, nome, tipo_pessoa").order("nome");
            setPessoas(data ?? []);
            setPessoaSelecionada(data?.find((p) => p.id === pessoa.id) ?? { id: pessoa.id, nome: pessoa.nome, tipo_pessoa: "PF" });
            setBusca(pessoa.nome);
            setCadastrandoPessoa(false);
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="relative">
        <span className="block text-sm font-semibold text-ink/70 mb-1">
          Pessoa<span className="text-forest"> *</span>
        </span>
        <input
          disabled={editando}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPessoaSelecionada(null);
            setMostrarSugestoes(true);
          }}
          onFocus={() => !editando && setMostrarSugestoes(true)}
          className="input disabled:opacity-60"
          placeholder="Digite o nome..."
        />
        {!editando && mostrarSugestoes && busca && !pessoaSelecionada && (
          <div className="absolute z-10 mt-1 w-full rounded-xl bg-white border border-black/10 shadow-lg max-h-56 overflow-auto">
            {sugestoes.length > 0 ? (
              sugestoes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPessoaSelecionada(p);
                    setBusca(p.nome);
                    setMostrarSugestoes(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface"
                >
                  {p.nome}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => setCadastrandoPessoa(true)}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-forest hover:bg-surface"
              >
                + Cadastrar &ldquo;{busca}&rdquo; como nova pessoa
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-semibold text-ink/70 mb-1">Tipo de serviço</span>
          <input
            value={tipoServico}
            onChange={(e) => setTipoServico(e.target.value)}
            className="input"
            placeholder="Ex: Design, Copywriting..."
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-semibold text-ink/70 mb-1">Observações</span>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className="input"
          rows={3}
        />
      </label>

      <p className="text-xs text-ink/40">
        Não tem salário fixo — os pagamentos são lançados individualmente em Financeiro &gt;
        Lançamentos, selecionando essa pessoa.
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar prestador"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink/60 hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}

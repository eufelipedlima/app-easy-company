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

function renderCelulaPrestador(key: string, p: Prestador) {
  switch (key) {
    case "nome":
      return <span className="font-semibold text-ink">{p.papeis?.pessoas?.nome ?? "—"}</span>;
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

  const totalPaginas = Math.max(Math.ceil(prestadores.length / linhasPorPagina), 1);
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const paginados = prestadores.slice((paginaSegura - 1) * linhasPorPagina, paginaSegura * linhasPorPagina);

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-6">
        <div className="relative">
          <button
            onClick={() => setPainelColunasAberto((v) => !v)}
            className="rounded-full border-2 border-ink/15 text-ink px-4 py-2.5 text-sm font-bold hover:bg-surface transition-colors"
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
        {!painelAberto && (
          <button
            onClick={() => setPainelAberto(true)}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            + Novo prestador
          </button>
        )}
      </div>

      {painelAberto && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setPainelAberto(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">Cadastrar prestador de serviço</h2>
            <PrestadorForm
              onSaved={() => {
                setPainelAberto(false);
                carregar();
              }}
              onCancel={() => setPainelAberto(false)}
            />
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : prestadores.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhum prestador cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                {colunas
                  .filter((c) => c.visivel)
                  .map((c) => (
                    <th key={c.key} className="px-4 py-3 font-medium">
                      {COLUNAS_DISPONIVEIS.find((d) => d.key === c.key)?.label}
                    </th>
                  ))}
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-surface/60">
                  {colunas
                    .filter((c) => c.visivel)
                    .map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {renderCelulaPrestador(c.key, p)}
                      </td>
                    ))}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => remover(p.id)}
                      className="text-xs font-semibold text-ink/40 hover:text-red-600"
                    >
                      Desativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {prestadores.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-ink/50">
          <div className="flex items-center gap-4">
            <p>
              Mostrando {(paginaSegura - 1) * linhasPorPagina + 1}–
              {Math.min(paginaSegura * linhasPorPagina, prestadores.length)} de {prestadores.length}
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
              className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="px-2 text-xs">
              Página {paginaSegura} de {totalPaginas}
            </span>
            <button
              onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))}
              disabled={paginaSegura === totalPaginas}
              className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrestadorForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [busca, setBusca] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastrandoPessoa, setCadastrandoPessoa] = useState(false);
  const [tipoServico, setTipoServico] = useState("");
  const [observacoes, setObservacoes] = useState("");
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
    if (!pessoaSelecionada) {
      setErro("Selecione a pessoa.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const supabase = createClient();
      const papelId = await garantirPrestadorPapelId(pessoaSelecionada.id);
      const { error } = await supabase.from("prestadores").insert({
        papel_id: papelId,
        tipo_servico: tipoServico || null,
        observacoes: observacoes || null,
      });
      if (error) throw error;
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
        <span className="block text-sm font-medium text-ink/70 mb-1">
          Pessoa<span className="text-forest"> *</span>
        </span>
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPessoaSelecionada(null);
            setMostrarSugestoes(true);
          }}
          onFocus={() => setMostrarSugestoes(true)}
          className="input"
          placeholder="Digite o nome..."
        />
        {mostrarSugestoes && busca && !pessoaSelecionada && (
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
          <span className="block text-sm font-medium text-ink/70 mb-1">Tipo de serviço</span>
          <input
            value={tipoServico}
            onChange={(e) => setTipoServico(e.target.value)}
            className="input"
            placeholder="Ex: Design, Copywriting..."
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-ink/70 mb-1">Observações</span>
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

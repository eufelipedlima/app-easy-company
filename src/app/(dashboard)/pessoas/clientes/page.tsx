"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";
import { useTabelaConfig, LINHAS_POR_PAGINA_OPCOES, type ColunaDef } from "@/lib/use-tabela-config";

interface Pessoa {
  id: string;
  tipo_pessoa: "PF" | "PJ";
  nome: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  documento: string;
  data_nascimento: string | null;
  email: string | null;
  whatsapp: string | null;
  pix: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  segmento_id: string | null;
  origem_id: string | null;
  observacao_origem: string | null;
  created_at: string;
  segmentos: { nome: string } | null;
  origens: { nome: string } | null;
  papeis: { papel: string }[];
}

type FiltroPapel = "todos" | "cliente" | "funcionario" | "prestador" | "sem_papel";

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

const COLUNAS_DISPONIVEIS: ColunaDef[] = [
  { key: "nome", label: "Nome" },
  { key: "tipo", label: "Tipo" },
  { key: "documento", label: "Documento" },
  { key: "segmento", label: "Segmento" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
];

function renderCelulaPessoa(key: string, p: Pessoa) {
  switch (key) {
    case "nome":
      return (
        <span className="font-semibold text-ink">
          {p.nome}
          {p.razao_social && <span className="block text-xs font-normal text-ink/50">{p.razao_social}</span>}
        </span>
      );
    case "tipo":
      return (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            p.tipo_pessoa === "PJ" ? "bg-mint text-forest" : "bg-surface text-ink/70"
          }`}
        >
          {p.tipo_pessoa}
        </span>
      );
    case "documento":
      return <span className="text-ink/70">{p.documento}</span>;
    case "segmento":
      return <span className="text-ink/70">{p.segmentos?.nome ?? "—"}</span>;
    case "whatsapp":
      return <span className="text-ink/70">{p.whatsapp ?? "—"}</span>;
    case "email":
      return <span className="text-ink/70">{p.email ?? "—"}</span>;
    default:
      return null;
  }
}

export default function PessoasPage() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState<Pessoa | null>(null);
  const [detalhe, setDetalhe] = useState<Pessoa | null>(null);
  const [responsavelDetalhe, setResponsavelDetalhe] = useState<{
    nome_completo: string;
    cpf: string;
    email: string | null;
    whatsapp: string | null;
  } | null>(null);

  useEffect(() => {
    if (!detalhe || detalhe.tipo_pessoa !== "PJ") {
      setResponsavelDetalhe(null);
      return;
    }
    async function carregarResponsavel() {
      const supabase = createClient();
      const { data } = await supabase
        .from("responsaveis")
        .select("nome_completo, cpf, email, whatsapp")
        .eq("pessoa_id", detalhe!.id)
        .maybeSingle();
      setResponsavelDetalhe(data ?? null);
    }
    carregarResponsavel();
  }, [detalhe]);
  const [filtroPapel, setFiltroPapel] = useState<FiltroPapel>("todos");

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
  } = useTabelaConfig("pessoas", COLUNAS_DISPONIVEIS);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("pessoas")
      .select(
        "id, tipo_pessoa, nome, razao_social, nome_fantasia, documento, data_nascimento, email, whatsapp, pix, rua, numero, complemento, bairro, cidade, cep, segmento_id, origem_id, observacao_origem, created_at, segmentos ( nome ), origens ( nome ), papeis ( papel )"
      )
      .order("created_at", { ascending: false });
    setPessoas((data as unknown as Pessoa[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pessoasFiltradas = pessoas.filter((p) => {
    if (filtroPapel === "todos") return true;
    if (filtroPapel === "sem_papel") return p.papeis.length === 0;
    return p.papeis.some((papel) => papel.papel === filtroPapel);
  });

  const totalPaginas = Math.max(Math.ceil(pessoasFiltradas.length / linhasPorPagina), 1);
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const paginados = pessoasFiltradas.slice((paginaSegura - 1) * linhasPorPagina, paginaSegura * linhasPorPagina);

  useEffect(() => {
    setPaginaAtual(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroPapel]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-inner">
          {(["todos", "cliente", "funcionario", "prestador", "sem_papel"] as FiltroPapel[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltroPapel(f)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                filtroPapel === f ? "bg-ink text-white shadow-md scale-105" : "text-ink/50 hover:text-ink hover:bg-white/60"
              }`}
            >
              {f === "todos"
                ? "Todos"
                : f === "cliente"
                ? "Clientes"
                : f === "funcionario"
                ? "Funcionários"
                : f === "prestador"
                ? "Prestadores"
                : "Sem papel"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
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
          {!painelAberto && !editando && (
            <button
              onClick={() => setPainelAberto(true)}
              className="rounded-full bg-ink text-white px-5 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
            >
              + Nova pessoa
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
            className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">
              {editando ? "Editar pessoa" : "Cadastrar pessoa"}
            </h2>
            <PessoaForm
              pessoaEditando={editando}
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

      <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink/50">Carregando...</p>
        ) : pessoasFiltradas.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">
            Nenhuma pessoa encontrada com esse filtro.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-black/5">
                {colunas
                  .filter((c) => c.visivel)
                  .map((c) => (
                    <th key={c.key} className="px-3 py-3 font-medium">
                      {COLUNAS_DISPONIVEIS.find((d) => d.key === c.key)?.label}
                    </th>
                  ))}
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setDetalhe(p)}
                  className="border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
                >
                  {colunas
                    .filter((c) => c.visivel)
                    .map((c) => (
                      <td key={c.key} className="px-3 py-3">
                        {renderCelulaPessoa(c.key, p)}
                      </td>
                    ))}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditando(p);
                        setPainelAberto(false);
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-bold bg-forest text-white hover:bg-ink transition-colors shadow-sm"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pessoasFiltradas.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-ink/50">
          <div className="flex items-center gap-4">
            <p>
              Mostrando {(paginaSegura - 1) * linhasPorPagina + 1}–
              {Math.min(paginaSegura * linhasPorPagina, pessoasFiltradas.length)} de {pessoasFiltradas.length}
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

      {detalhe && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-mint flex items-center justify-center text-forest font-bold text-sm">
                  {detalhe.nome.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-ink leading-tight">{detalhe.nome}</p>
                  {detalhe.razao_social && (
                    <p className="text-xs text-ink/50">{detalhe.razao_social}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    detalhe.tipo_pessoa === "PJ" ? "bg-mint text-forest" : "bg-black/5 text-ink/60"
                  }`}
                >
                  {detalhe.tipo_pessoa}
                </span>
                <button onClick={() => setDetalhe(null)} className="text-ink/40 hover:text-ink text-lg leading-none">
                  ✕
                </button>
              </div>
            </div>

            <SecaoDetalhe titulo="Dados">
              <DetalheLinha label="Documento" valor={detalhe.documento} />
              {detalhe.tipo_pessoa === "PF" && (
                <DetalheLinha label="Data de nascimento" valor={formatarData(detalhe.data_nascimento)} />
              )}
              {detalhe.tipo_pessoa === "PF" && detalhe.nome_fantasia && (
                <DetalheLinha label="Nome fantasia" valor={detalhe.nome_fantasia} />
              )}
              {detalhe.tipo_pessoa === "PJ" && (
                <DetalheLinha label="Segmento" valor={detalhe.segmentos?.nome ?? "—"} />
              )}
              <DetalheLinha label="Origem" valor={detalhe.origens?.nome ?? "—"} />
              {detalhe.observacao_origem && (
                <DetalheLinha label="Observação da origem" valor={detalhe.observacao_origem} />
              )}
            </SecaoDetalhe>

            {detalhe.tipo_pessoa === "PJ" && responsavelDetalhe && (
              <SecaoDetalhe titulo="Responsável pela empresa">
                <DetalheLinha label="Nome completo" valor={responsavelDetalhe.nome_completo} />
                <DetalheLinha label="CPF" valor={responsavelDetalhe.cpf} />
                <DetalheLinha label="E-mail" valor={responsavelDetalhe.email ?? "—"} />
                <DetalheLinha label="WhatsApp" valor={responsavelDetalhe.whatsapp ?? "—"} />
              </SecaoDetalhe>
            )}

            <SecaoDetalhe titulo="Contato">
              <DetalheLinha label="WhatsApp" valor={detalhe.whatsapp ?? "—"} />
              <DetalheLinha label="Chave PIX" valor={detalhe.pix ?? "—"} />
              <DetalheLinha label="E-mail" valor={detalhe.email ?? "—"} />
            </SecaoDetalhe>

            <SecaoDetalhe titulo="Endereço">
              <DetalheLinha
                label="Rua"
                valor={detalhe.rua ? `${detalhe.rua}, ${detalhe.numero ?? "s/n"}` : "—"}
              />
              {detalhe.complemento && <DetalheLinha label="Complemento" valor={detalhe.complemento} />}
              <DetalheLinha label="Bairro" valor={detalhe.bairro ?? "—"} />
              <DetalheLinha label="Cidade" valor={detalhe.cidade ?? "—"} />
              <DetalheLinha label="CEP" valor={detalhe.cep ?? "—"} />
            </SecaoDetalhe>

            <button
              onClick={() => {
                setEditando(detalhe);
                setDetalhe(null);
                setPainelAberto(false);
              }}
              className="w-full rounded-full bg-forest text-white px-5 py-2.5 text-sm font-bold hover:bg-ink transition-colors mt-2"
            >
              Editar pessoa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SecaoDetalhe({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink/40 mb-2">{titulo}</p>
      <div className="rounded-2xl bg-card p-4 shadow-sm space-y-2.5">{children}</div>
    </div>
  );
}

function DetalheLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-ink/50">{label}</dt>
      <dd className="font-semibold text-ink text-right">{valor}</dd>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PessoaForm } from "@/components/pessoa-form";
import { useTabelaConfig, LINHAS_POR_PAGINA_OPCOES, type ColunaDef } from "@/lib/use-tabela-config";
import { normalizar } from "@/lib/normalizar";

interface Pessoa {
  id: string;
  tipo_pessoa: "PF" | "PJ";
  nome: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  documento: string | null;
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

// Cadastrar a pessoa não basta — ela só conta como "cliente" de verdade (e só aí
// consegue entrar na Central de Clientes) quando também tem um papel "cliente" e
// uma linha na tabela clientes vinculada a esse papel. Isso normalmente é criado
// na hora de fechar um contrato — aqui garantimos que quem é cadastrado direto
// pela aba Clientes já saia com os dois, sem precisar passar por um contrato antes.
async function garantirPapelCliente(pessoaId: string) {
  const supabase = createClient();
  const { data: papelExistente } = await supabase
    .from("papeis")
    .select("id")
    .eq("pessoa_id", pessoaId)
    .eq("papel", "cliente")
    .maybeSingle();

  let papelId = papelExistente?.id as string | undefined;
  if (!papelId) {
    const { data: novoPapel, error } = await supabase
      .from("papeis")
      .insert({ pessoa_id: pessoaId, papel: "cliente" })
      .select("id")
      .single();
    if (error || !novoPapel) return;
    papelId = novoPapel.id;
  }

  const { data: clienteExistente } = await supabase.from("clientes").select("id").eq("papel_id", papelId).maybeSingle();
  if (!clienteExistente) {
    await supabase.from("clientes").insert({ papel_id: papelId });
  }
}

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

function renderCelulaPessoa(key: string, p: Pessoa) {
  switch (key) {
    case "nome":
      return (
        <span className="flex items-center gap-2.5 min-w-0">
          <span
            className={`h-7 w-7 rounded-full ${corAvatarPessoa(p.nome)} text-white flex items-center justify-center text-[11px] font-bold shrink-0`}
          >
            {iniciaisPessoa(p.nome)}
          </span>
          <span className="font-semibold text-ink truncate">
            {p.nome}
            {p.razao_social && <span className="block text-xs font-normal text-ink/50">{p.razao_social}</span>}
          </span>
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
      return <span className="text-ink/70">{p.documento ?? "—"}</span>;
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

  const [linkCalendarioToken, setLinkCalendarioToken] = useState<string | null>(null);

  useEffect(() => {
    if (!detalhe || !detalhe.papeis?.some((p) => p.papel === "cliente")) {
      setLinkCalendarioToken(null);
      return;
    }
    async function carregarLinkCalendario() {
      const supabase = createClient();
      const { data: papel } = await supabase
        .from("papeis")
        .select("id")
        .eq("pessoa_id", detalhe!.id)
        .eq("papel", "cliente")
        .maybeSingle();
      if (!papel) return;
      const { data: cliente } = await supabase
        .from("clientes")
        .select("link_publico_token")
        .eq("papel_id", papel.id)
        .maybeSingle();
      setLinkCalendarioToken(cliente?.link_publico_token ?? null);
    }
    carregarLinkCalendario();
  }, [detalhe]);
  const [filtroPapel, setFiltroPapel] = useState<FiltroPapel>("todos");
  const [buscaTexto, setBuscaTexto] = useState("");

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
    if (filtroPapel === "todos") {
      // segue pro filtro de texto abaixo
    } else if (filtroPapel === "sem_papel") {
      if (p.papeis.length !== 0) return false;
    } else if (!p.papeis.some((papel) => papel.papel === filtroPapel)) {
      return false;
    }
    if (!buscaTexto.trim()) return true;
    const alvo = normalizar(
      [p.nome, p.razao_social, p.nome_fantasia, p.documento, p.email, p.whatsapp].filter(Boolean).join(" ")
    );
    return alvo.includes(normalizar(buscaTexto));
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
        <div className="flex items-center gap-2">
          {(["todos", "cliente", "funcionario", "prestador", "sem_papel"] as FiltroPapel[]).map((f) => {
            const qtd =
              f === "todos"
                ? pessoas.length
                : f === "sem_papel"
                ? pessoas.filter((p) => p.papeis.length === 0).length
                : pessoas.filter((p) => p.papeis.some((papel) => papel.papel === f)).length;
            const ativo = filtroPapel === f;
            const cor =
              f === "cliente" ? "bg-forest" : f === "funcionario" ? "bg-sky-500" : f === "prestador" ? "bg-amber-500" : f === "sem_papel" ? "bg-ink/30" : "bg-ink/50";
            return (
              <button
                key={f}
                onClick={() => setFiltroPapel(f)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
                  ativo ? "border-forest bg-mint text-forest" : "border-black/10 text-ink/60 hover:bg-surface"
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${cor}`} />
                {f === "todos"
                  ? "Todos"
                  : f === "cliente"
                  ? "Clientes"
                  : f === "funcionario"
                  ? "Funcionários"
                  : f === "prestador"
                  ? "Prestadores"
                  : "Sem papel"}
                <span className={`text-xs font-bold ${ativo ? "text-forest" : "text-ink/35"}`}>{qtd}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35 text-base pointer-events-none">🔍</span>
            <input
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              placeholder="Buscar por nome, documento, e-mail..."
              style={{ paddingLeft: "2.5rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
              className="input w-72"
            />
          </div>
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
            className="w-full max-w-4xl rounded-2xl bg-card p-7 shadow-2xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-5">
              {editando ? "Editar pessoa" : "Cadastrar pessoa"}
            </h2>
            <PessoaForm
              pessoaEditando={editando}
              onSaved={async (pessoa) => {
                await garantirPapelCliente(pessoa.id);
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
        ) : pessoasFiltradas.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">
            Nenhuma pessoa encontrada com esse filtro.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-mint/50 border-b-2 border-mint">
                {colunas
                  .filter((c) => c.visivel)
                  .map((c) => (
                    <th key={c.key} className="px-3 py-4 font-bold text-forest text-xs uppercase tracking-wide">
                      {COLUNAS_DISPONIVEIS.find((d) => d.key === c.key)?.label}
                    </th>
                  ))}
                <th className="px-3 py-4 font-bold text-forest text-xs uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setDetalhe(p)}
                  className="relative border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer"
                >
                  {colunas
                    .filter((c) => c.visivel)
                    .map((c, i) => (
                      <td key={c.key} className={`px-3 py-3 ${i === 0 ? "relative" : ""}`}>
                        {i === 0 && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-forest" />}
                        <span className={i === 0 ? "pl-2.5 block" : undefined}>{renderCelulaPessoa(c.key, p)}</span>
                      </td>
                    ))}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
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

      {detalhe && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
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

            <div className="columns-1 lg:columns-2 gap-4">
              <SecaoDetalhe titulo="Dados">
                <DetalheLinha label="Documento" valor={detalhe.documento ?? "—"} />
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

              {linkCalendarioToken && (
                <div className="rounded-2xl bg-card p-4 mb-4 shadow-sm break-inside-avoid">
                  <p className="text-xs text-ink/50 mb-1">Link do calendário de conteúdo (compartilhe com o cliente)</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/calendario/${linkCalendarioToken}`}
                      className="input text-xs"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `${window.location.origin}/calendario/${linkCalendarioToken}`
                        )
                      }
                      className="shrink-0 rounded-full bg-forest text-white px-3 py-1.5 text-xs font-bold hover:bg-ink transition-colors"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

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
            </div>

            <button
              onClick={() => {
                setEditando(detalhe);
                setDetalhe(null);
                setPainelAberto(false);
              }}
              className="w-full rounded-xl bg-forest text-white px-5 py-2.5 text-sm font-bold hover:bg-ink transition-colors mt-2"
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
    <div className="mb-4 break-inside-avoid">
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

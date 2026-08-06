"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizar } from "@/lib/normalizar";

interface Usuario {
  id: string;
  nome: string;
  fotoUrl: string | null;
  emailAcesso: string | null;
  cargoNome: string | null;
  perfilNome: string | null;
}

interface FuncionarioSemAcesso {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  cargoNome: string | null;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("funcionarios")
      .select("id, email_acesso, papeis ( pessoas ( nome, foto_url ) ), cargos ( nome ), perfis_acesso ( nome )")
      .eq("tem_acesso_sistema", true);
    const lista = ((data ?? []) as unknown as {
      id: string;
      email_acesso: string | null;
      papeis: { pessoas: { nome: string; foto_url: string | null } | null } | null;
      cargos: { nome: string } | null;
      perfis_acesso: { nome: string } | null;
    }[])
      .map((f) => ({
        id: f.id,
        nome: f.papeis?.pessoas?.nome ?? "—",
        fotoUrl: f.papeis?.pessoas?.foto_url ?? null,
        emailAcesso: f.email_acesso,
        cargoNome: f.cargos?.nome ?? null,
        perfilNome: f.perfis_acesso?.nome ?? null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setUsuarios(lista);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink/60">Quem tem login pra entrar no sistema, e com qual perfil de permissão.</p>
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors shrink-0"
        >
          + Novo usuário
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : usuarios.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum usuário com acesso ainda.</p>
      ) : (
        <div className="rounded-3xl bg-card border border-black/5 overflow-hidden">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-4 border-b border-black/5 last:border-0">
              {u.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.fotoUrl} alt={u.nome} className="h-9 w-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-ink/10 text-ink flex items-center justify-center text-xs font-bold shrink-0">
                  {u.nome.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{u.nome}</p>
                <p className="text-xs text-ink/40 truncate">
                  {u.emailAcesso ?? "—"}
                  {u.cargoNome && ` · ${u.cargoNome}`}
                </p>
              </div>
              {u.perfilNome && (
                <span className="rounded-full bg-surface text-ink/60 px-3 py-1 text-xs font-semibold shrink-0">{u.perfilNome}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <NovoUsuarioModal
          onClose={() => setModalAberto(false)}
          onCriado={() => {
            setModalAberto(false);
            carregar();
          }}
        />
      )}
    </section>
  );
}

function NovoUsuarioModal({ onClose, onCriado }: { onClose: () => void; onCriado: () => void }) {
  const [modo, setModo] = useState<"vincular" | "novo">("vincular");
  const [funcionariosSemAcesso, setFuncionariosSemAcesso] = useState<FuncionarioSemAcesso[]>([]);
  const [buscaFuncionario, setBuscaFuncionario] = useState("");
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<FuncionarioSemAcesso | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargos, setCargos] = useState<{ id: string; nome: string }[]>([]);
  const [cargoId, setCargoId] = useState("");
  const [perfisAcesso, setPerfisAcesso] = useState<{ id: string; nome: string }[]>([]);
  const [perfilId, setPerfilId] = useState("");
  const [formaAcesso, setFormaAcesso] = useState<"convite" | "senha">("convite");
  const [senhaTemporaria, setSenhaTemporaria] = useState(() => Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10));
  const [senhaCriada, setSenhaCriada] = useState<{ email: string; senha: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const [{ data: funcData }, { data: cargosData }, { data: perfisData }] = await Promise.all([
        supabase
          .from("funcionarios")
          .select("id, email_acesso, papeis ( pessoas ( nome, email, whatsapp ) ), cargos ( nome )")
          .eq("tem_acesso_sistema", false),
        supabase.from("cargos").select("id, nome").order("nome"),
        supabase.from("perfis_acesso").select("id, nome").order("ordem"),
      ]);
      setFuncionariosSemAcesso(
        ((funcData ?? []) as unknown as {
          id: string;
          papeis: { pessoas: { nome: string; email: string | null; whatsapp: string | null } | null } | null;
          cargos: { nome: string } | null;
        }[]).map((f) => ({
          id: f.id,
          nome: f.papeis?.pessoas?.nome ?? "—",
          email: f.papeis?.pessoas?.email ?? null,
          whatsapp: f.papeis?.pessoas?.whatsapp ?? null,
          cargoNome: f.cargos?.nome ?? null,
        }))
      );
      setCargos(cargosData ?? []);
      setPerfisAcesso(perfisData ?? []);
    }
    carregar();
  }, []);

  const sugestoes = funcionariosSemAcesso.filter((f) => normalizar(f.nome).includes(normalizar(buscaFuncionario)));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    let funcionarioId: string | null = null;
    let emailFinal = "";

    if (modo === "vincular") {
      if (!funcionarioSelecionado) {
        setErro("Escolhe um funcionário pra vincular.");
        return;
      }
      funcionarioId = funcionarioSelecionado.id;
      emailFinal = funcionarioSelecionado.email ?? "";
      if (!emailFinal) {
        setErro("Esse funcionário não tem e-mail cadastrado — edite o cadastro dele em Pessoas antes de convidar.");
        return;
      }
    } else {
      if (!nome.trim() || !email.trim()) {
        setErro("Preenche pelo menos nome e e-mail.");
        return;
      }
      emailFinal = email.trim();
    }

    setSaving(true);
    try {
      const supabase = createClient();

      if (modo === "novo") {
        const { data: pessoa, error: erroPessoa } = await supabase
          .from("pessoas")
          .insert({ tipo_pessoa: "PF", nome: nome.trim(), email: email.trim() || null, whatsapp: telefone.trim() || null })
          .select("id")
          .single();
        if (erroPessoa || !pessoa) throw new Error(erroPessoa?.message ?? "Erro ao criar pessoa.");

        const { data: papel, error: erroPapel } = await supabase
          .from("papeis")
          .insert({ pessoa_id: pessoa.id, papel: "funcionario" })
          .select("id")
          .single();
        if (erroPapel || !papel) throw new Error(erroPapel?.message ?? "Erro ao criar papel.");

        const { data: funcionario, error: erroFunc } = await supabase
          .from("funcionarios")
          .insert({
            papel_id: papel.id,
            cargo_id: cargoId || null,
            tipo_contrato: "CLT",
            salario: 0,
            data_admissao: new Date().toISOString().slice(0, 10),
          })
          .select("id")
          .single();
        if (erroFunc || !funcionario) throw new Error(erroFunc?.message ?? "Erro ao criar funcionário.");
        funcionarioId = funcionario.id;
      }

      const res = await fetch("/api/usuarios/convidar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailFinal,
          funcionarioId,
          perfilAcessoId: perfilId || null,
          senhaTemporaria: formaAcesso === "senha" ? senhaTemporaria : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar o convite.");
      if (formaAcesso === "senha") {
        setSenhaCriada({ email: emailFinal, senha: senhaTemporaria });
      } else {
        onCriado();
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar usuário.");
    } finally {
      setSaving(false);
    }
  }

  if (senhaCriada) {
    return (
      <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onCriado}>
        <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-ink mb-2">✅ Usuário criado</h2>
          <p className="text-sm text-ink/60 mb-4">
            Passa esses dados pra pessoa (WhatsApp, por exemplo) — ela consegue trocar a senha depois em &quot;Meu perfil&quot;.
          </p>
          <div className="rounded-2xl bg-surface p-4 space-y-2 mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40">E-mail</p>
              <p className="text-sm font-semibold text-ink">{senhaCriada.email}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40">Senha temporária</p>
              <p className="text-sm font-semibold text-ink font-mono">{senhaCriada.senha}</p>
            </div>
          </div>
          <button
            onClick={onCriado}
            className="w-full rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-4">Novo usuário</h2>

        <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 mb-4">
          <button
            type="button"
            onClick={() => setModo("vincular")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${modo === "vincular" ? "bg-ink text-white" : "text-ink/50"}`}
          >
            Vincular a funcionário
          </button>
          <button
            type="button"
            onClick={() => setModo("novo")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${modo === "novo" ? "bg-ink text-white" : "text-ink/50"}`}
          >
            Criar pessoa nova
          </button>
        </div>

        <form onSubmit={salvar} className="space-y-4">
          {modo === "vincular" ? (
            <label className="block relative">
              <span className="block text-sm font-medium text-ink/70 mb-1">Funcionário *</span>
              <input
                value={funcionarioSelecionado ? funcionarioSelecionado.nome : buscaFuncionario}
                onChange={(e) => {
                  setBuscaFuncionario(e.target.value);
                  setFuncionarioSelecionado(null);
                  setBuscaAberta(true);
                }}
                onFocus={() => setBuscaAberta(true)}
                className="input"
                placeholder="Digite pra buscar..."
              />
              {buscaAberta && buscaFuncionario && !funcionarioSelecionado && (
                <div className="absolute z-10 top-full left-0 w-full mt-1 rounded-2xl bg-white border border-black/10 shadow-lg py-1 max-h-48 overflow-y-auto">
                  {sugestoes.length === 0 ? (
                    <p className="px-4 py-2 text-xs text-ink/40">Nenhum funcionário sem acesso encontrado com esse nome.</p>
                  ) : (
                    sugestoes.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setFuncionarioSelecionado(f);
                          setBuscaAberta(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-surface"
                      >
                        {f.nome}
                        {f.cargoNome && <span className="text-ink/40"> · {f.cargoNome}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
              {funcionarioSelecionado && (
                <div className="mt-2 rounded-xl bg-surface px-3 py-2 text-xs text-ink/60">
                  {funcionarioSelecionado.email || <span className="text-red-500">sem e-mail cadastrado</span>}
                  {funcionarioSelecionado.whatsapp && ` · ${funcionarioSelecionado.whatsapp}`}
                </div>
              )}
            </label>
          ) : (
            <>
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">Nome *</span>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" autoFocus />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">E-mail *</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">Telefone</span>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-ink/70 mb-1">Cargo</span>
                <select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className="input">
                  <option value="">Sem cargo</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <div>
            <span className="block text-sm font-medium text-ink/70 mb-1">Como a pessoa vai acessar?</span>
            <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 w-full">
              <button
                type="button"
                onClick={() => setFormaAcesso("convite")}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  formaAcesso === "convite" ? "bg-ink text-white" : "text-ink/50"
                }`}
              >
                Convite por e-mail
              </button>
              <button
                type="button"
                onClick={() => setFormaAcesso("senha")}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  formaAcesso === "senha" ? "bg-ink text-white" : "text-ink/50"
                }`}
              >
                Senha temporária
              </button>
            </div>
            {formaAcesso === "convite" ? (
              <p className="text-xs text-ink/40 mt-1.5">A pessoa recebe um e-mail pra criar a própria senha.</p>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <input value={senhaTemporaria} onChange={(e) => setSenhaTemporaria(e.target.value)} className="input text-sm font-mono" />
                <button
                  type="button"
                  onClick={() => setSenhaTemporaria(Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10))}
                  className="shrink-0 text-xs font-semibold text-forest hover:text-ink"
                >
                  🔄 Gerar
                </button>
              </div>
            )}
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Perfil de acesso</span>
            <select value={perfilId} onChange={(e) => setPerfilId(e.target.value)} className="input">
              <option value="">Sem perfil definido</option>
              {perfisAcesso.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
            >
              {saving ? "Criando..." : formaAcesso === "senha" ? "Criar usuário" : "Criar e enviar convite"}
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

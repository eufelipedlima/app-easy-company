"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TipoPessoa = "PF" | "PJ";

const CEP_MASK = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const CPF_MASK = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
const CNPJ_MASK = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

interface Segmento {
  id: string;
  nome: string;
}

interface PessoaEditando {
  id: string;
  tipo_pessoa: TipoPessoa;
  nome: string;
  razao_social: string | null;
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
}

interface Props {
  onSaved?: (pessoa: { id: string; nome: string }) => void;
  onCancel?: () => void;
  /** Título inicial pré-preenchido, útil quando vem de "cadastrar novo cliente" no meio de outro formulário */
  nomeInicial?: string;
  /** Quando presente, o formulário edita essa pessoa em vez de criar uma nova */
  pessoaEditando?: PessoaEditando | null;
}

export function PessoaForm({ onSaved, onCancel, nomeInicial, pessoaEditando }: Props) {
  const editando = !!pessoaEditando;

  const [tipo, setTipo] = useState<TipoPessoa>(pessoaEditando?.tipo_pessoa ?? "PF");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState(pessoaEditando?.nome ?? nomeInicial ?? "");
  const [razaoSocial, setRazaoSocial] = useState(pessoaEditando?.razao_social ?? "");
  const [documento, setDocumento] = useState(pessoaEditando?.documento ?? "");
  const [dataNascimento, setDataNascimento] = useState(pessoaEditando?.data_nascimento ?? "");
  const [email, setEmail] = useState(pessoaEditando?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(pessoaEditando?.whatsapp ?? "");
  const [pix, setPix] = useState(pessoaEditando?.pix ?? "");
  const [rua, setRua] = useState(pessoaEditando?.rua ?? "");
  const [numero, setNumero] = useState(pessoaEditando?.numero ?? "");
  const [complemento, setComplemento] = useState(pessoaEditando?.complemento ?? "");
  const [bairro, setBairro] = useState(pessoaEditando?.bairro ?? "");
  const [cidade, setCidade] = useState(pessoaEditando?.cidade ?? "");
  const [cep, setCep] = useState(pessoaEditando?.cep ?? "");

  const [temResponsavel, setTemResponsavel] = useState(false);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [respWhatsapp, setRespWhatsapp] = useState("");

  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [segmentoId, setSegmentoId] = useState(pessoaEditando?.segmento_id ?? "");
  const [novoSegmento, setNovoSegmento] = useState(false);
  const [nomeNovoSegmento, setNomeNovoSegmento] = useState("");

  const [origens, setOrigens] = useState<Segmento[]>([]);
  const [origemId, setOrigemId] = useState(pessoaEditando?.origem_id ?? "");
  const [novaOrigem, setNovaOrigem] = useState(false);
  const [nomeNovaOrigem, setNomeNovaOrigem] = useState("");

  useEffect(() => {
    async function carregarSegmentos() {
      const supabase = createClient();
      const { data } = await supabase.from("segmentos").select("id, nome").order("nome");
      setSegmentos(data ?? []);
    }
    carregarSegmentos();

    async function carregarOrigens() {
      const supabase = createClient();
      const { data } = await supabase.from("origens").select("id, nome").order("nome");
      setOrigens(data ?? []);
    }
    carregarOrigens();

    async function carregarResponsavel() {
      if (!pessoaEditando) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("responsaveis")
        .select("id, nome_completo, cpf, email, whatsapp")
        .eq("pessoa_id", pessoaEditando.id)
        .maybeSingle();
      if (data) {
        setTemResponsavel(true);
        setResponsavelId(data.id);
        setRespNome(data.nome_completo);
        setRespCpf(data.cpf);
        setRespEmail(data.email ?? "");
        setRespWhatsapp(data.whatsapp ?? "");
      }
    }
    carregarResponsavel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);

    const supabase = createClient();

    let segmentoFinalId: string | null = segmentoId || null;

    if (tipo === "PJ" && novoSegmento && nomeNovoSegmento.trim()) {
      const { data: seg, error: segError } = await supabase
        .from("segmentos")
        .insert({ nome: nomeNovoSegmento.trim() })
        .select("id")
        .single();
      if (segError) {
        setErro(segError.message);
        setSaving(false);
        return;
      }
      segmentoFinalId = seg.id;
    }

    let origemFinalId: string | null = origemId || null;

    if (novaOrigem && nomeNovaOrigem.trim()) {
      const { data: org, error: orgError } = await supabase
        .from("origens")
        .insert({ nome: nomeNovaOrigem.trim() })
        .select("id")
        .single();
      if (orgError) {
        setErro(orgError.message);
        setSaving(false);
        return;
      }
      origemFinalId = org.id;
    }

    const dadosPessoa = {
      tipo_pessoa: tipo,
      nome,
      razao_social: tipo === "PJ" ? razaoSocial : null,
      documento,
      data_nascimento: tipo === "PF" ? dataNascimento || null : null,
      email: email || null,
      whatsapp: whatsapp || null,
      pix: pix || null,
      rua: rua || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      cep: cep || null,
      segmento_id: tipo === "PJ" ? segmentoFinalId : null,
      origem_id: origemFinalId,
    };

    let pessoaId: string;
    let pessoaNome: string;

    if (editando && pessoaEditando) {
      const { error: pessoaError } = await supabase
        .from("pessoas")
        .update(dadosPessoa)
        .eq("id", pessoaEditando.id);

      if (pessoaError) {
        setErro(pessoaError.message);
        setSaving(false);
        return;
      }
      pessoaId = pessoaEditando.id;
      pessoaNome = nome;
    } else {
      const { data: pessoa, error: pessoaError } = await supabase
        .from("pessoas")
        .insert(dadosPessoa)
        .select()
        .single();

      if (pessoaError) {
        setErro(pessoaError.message);
        setSaving(false);
        return;
      }
      pessoaId = pessoa.id;
      pessoaNome = pessoa.nome;
    }

    if (tipo === "PJ" && temResponsavel && respNome && respCpf) {
      const dadosResponsavel = {
        pessoa_id: pessoaId,
        nome_completo: respNome,
        cpf: respCpf,
        email: respEmail || null,
        whatsapp: respWhatsapp || null,
      };

      const { error: respError } = responsavelId
        ? await supabase.from("responsaveis").update(dadosResponsavel).eq("id", responsavelId)
        : await supabase.from("responsaveis").insert(dadosResponsavel);

      if (respError) {
        setErro(respError.message);
        setSaving(false);
        return;
      }
    } else if (editando && responsavelId && (!temResponsavel || tipo === "PF")) {
      await supabase.from("responsaveis").delete().eq("id", responsavelId);
    }

    setSaving(false);
    onSaved?.({ id: pessoaId, nome: pessoaNome });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 rounded-full bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setTipo("PF")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "PF" ? "bg-ink text-white" : "text-ink/60"
          }`}
        >
          Pessoa física
        </button>
        <button
          type="button"
          onClick={() => setTipo("PJ")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            tipo === "PJ" ? "bg-ink text-white" : "text-ink/60"
          }`}
        >
          Pessoa jurídica
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label={tipo === "PF" ? "Nome completo" : "Nome fantasia"} required>
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input"
            placeholder={tipo === "PF" ? "Nome completo" : "Nome fantasia"}
          />
        </Campo>

        {tipo === "PJ" && (
          <Campo label="Razão social" required>
            <input
              required
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              className="input"
              placeholder="Razão social"
            />
          </Campo>
        )}

        <Campo label={tipo === "PF" ? "CPF" : "CNPJ"} required>
          <input
            required
            value={documento}
            onChange={(e) =>
              setDocumento(tipo === "PF" ? CPF_MASK(e.target.value) : CNPJ_MASK(e.target.value))
            }
            className="input"
            placeholder={tipo === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
          />
        </Campo>

        {tipo === "PF" && (
          <Campo label="Data de nascimento">
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="input"
            />
          </Campo>
        )}

        {tipo === "PJ" && (
          <Campo label="Segmento">
            {!novoSegmento ? (
              <div className="flex gap-2">
                <select
                  value={segmentoId}
                  onChange={(e) => setSegmentoId(e.target.value)}
                  className="input"
                >
                  <option value="">Selecione...</option>
                  {segmentos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNovoSegmento(true)}
                  className="shrink-0 text-xs font-semibold text-forest whitespace-nowrap"
                >
                  + Novo
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={nomeNovoSegmento}
                  onChange={(e) => setNomeNovoSegmento(e.target.value)}
                  className="input"
                  placeholder="Nome do novo segmento"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNovoSegmento(false);
                    setNomeNovoSegmento("");
                  }}
                  className="shrink-0 text-xs font-semibold text-ink/50 whitespace-nowrap"
                >
                  Cancelar
                </button>
              </div>
            )}
          </Campo>
        )}

        <Campo label="Origem">
          {!novaOrigem ? (
            <div className="flex gap-2">
              <select
                value={origemId}
                onChange={(e) => setOrigemId(e.target.value)}
                className="input"
              >
                <option value="">Selecione...</option>
                {origens.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNovaOrigem(true)}
                className="shrink-0 text-xs font-semibold text-forest whitespace-nowrap"
              >
                + Nova
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                value={nomeNovaOrigem}
                onChange={(e) => setNomeNovaOrigem(e.target.value)}
                className="input"
                placeholder="Nome da nova origem"
              />
              <button
                type="button"
                onClick={() => {
                  setNovaOrigem(false);
                  setNomeNovaOrigem("");
                }}
                className="shrink-0 text-xs font-semibold text-ink/50 whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          )}
          <span className="block text-xs text-ink/40 mt-1">Como essa pessoa chegou até a agência.</span>
        </Campo>

        <Campo label="E-mail">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="nome@email.com"
          />
        </Campo>

        <Campo label="WhatsApp">
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="input"
            placeholder="(00) 00000-0000"
          />
        </Campo>

        <Campo label="Chave PIX">
          <input
            value={pix}
            onChange={(e) => setPix(e.target.value)}
            className="input"
            placeholder="CPF, e-mail, telefone ou aleatória"
          />
        </Campo>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink/70 mb-3">Endereço</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Rua">
            <input value={rua} onChange={(e) => setRua(e.target.value)} className="input" />
          </Campo>
          <Campo label="Número">
            <input value={numero} onChange={(e) => setNumero(e.target.value)} className="input" />
          </Campo>
          <Campo label="Complemento">
            <input
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              className="input"
            />
          </Campo>
          <Campo label="Bairro">
            <input value={bairro} onChange={(e) => setBairro(e.target.value)} className="input" />
          </Campo>
          <Campo label="Cidade">
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} className="input" />
          </Campo>
          <Campo label="CEP">
            <input
              value={cep}
              onChange={(e) => setCep(CEP_MASK(e.target.value))}
              className="input"
              placeholder="00000-000"
            />
          </Campo>
        </div>
      </div>

      {tipo === "PJ" && (
        <div className="rounded-2xl bg-surface p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={temResponsavel}
              onChange={(e) => setTemResponsavel(e.target.checked)}
              className="h-4 w-4 rounded accent-forest"
            />
            Adicionar responsável pela empresa (opcional)
          </label>

          {temResponsavel && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Campo label="Nome completo">
                <input
                  value={respNome}
                  onChange={(e) => setRespNome(e.target.value)}
                  className="input"
                />
              </Campo>
              <Campo label="CPF">
                <input
                  value={respCpf}
                  onChange={(e) => setRespCpf(CPF_MASK(e.target.value))}
                  className="input"
                  placeholder="000.000.000-00"
                />
              </Campo>
              <Campo label="E-mail">
                <input
                  type="email"
                  value={respEmail}
                  onChange={(e) => setRespEmail(e.target.value)}
                  className="input"
                />
              </Campo>
              <Campo label="WhatsApp">
                <input
                  value={respWhatsapp}
                  onChange={(e) => setRespWhatsapp(e.target.value)}
                  className="input"
                />
              </Campo>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Salvando..." : editando ? "Salvar alterações" : "Salvar pessoa"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-ink/60 hover:text-ink"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink/70 mb-1">
        {label}
        {required && <span className="text-forest"> *</span>}
      </span>
      {children}
    </label>
  );
}

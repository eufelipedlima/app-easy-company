"use client";

import { useState } from "react";
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

interface Props {
  onSaved?: () => void;
  onCancel?: () => void;
}

export function PessoaForm({ onSaved, onCancel }: Props) {
  const [tipo, setTipo] = useState<TipoPessoa>("PF");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [documento, setDocumento] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [cep, setCep] = useState("");

  const [temResponsavel, setTemResponsavel] = useState(false);
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [respWhatsapp, setRespWhatsapp] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);

    const supabase = createClient();

    const { data: pessoa, error: pessoaError } = await supabase
      .from("pessoas")
      .insert({
        tipo_pessoa: tipo,
        nome,
        razao_social: tipo === "PJ" ? razaoSocial : null,
        documento,
        data_nascimento: tipo === "PF" ? dataNascimento || null : null,
        email: email || null,
        whatsapp: whatsapp || null,
        rua: rua || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        cep: cep || null,
      })
      .select()
      .single();

    if (pessoaError) {
      setErro(pessoaError.message);
      setSaving(false);
      return;
    }

    if (tipo === "PJ" && temResponsavel && respNome && respCpf) {
      const { error: respError } = await supabase.from("responsaveis").insert({
        pessoa_id: pessoa.id,
        nome_completo: respNome,
        cpf: respCpf,
        email: respEmail || null,
        whatsapp: respWhatsapp || null,
      });

      if (respError) {
        setErro(respError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Toggle PF/PJ */}
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
          {saving ? "Salvando..." : "Salvar pessoa"}
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

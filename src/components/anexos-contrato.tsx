"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { sanearNomeArquivo } from "@/lib/nome-arquivo";

export interface AnexoContratoItem {
  id: string;
  arquivo_path: string;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  tamanho_bytes: number | null;
}

function formatarTamanho(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconePorNome(nome: string | null) {
  const ext = (nome ?? "").split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📕";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext ?? "")) return "🖼️";
  if (["doc", "docx"].includes(ext ?? "")) return "📝";
  if (["xls", "xlsx"].includes(ext ?? "")) return "📊";
  return "📄";
}

/** Selecionar anexos no formulário de criar/editar contrato — mostra os
 * que já estão salvos (com botão de remover imediato) e os que ainda
 * vão ser enviados quando o contrato for salvo. */
export function SeletorAnexosContrato({
  anexosExistentes,
  onRemoverExistente,
  arquivosNovos,
  onArquivosNovosChange,
}: {
  anexosExistentes: AnexoContratoItem[];
  onRemoverExistente: (anexo: AnexoContratoItem) => void;
  arquivosNovos: File[];
  onArquivosNovosChange: (arquivos: File[]) => void;
}) {
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function adicionar(lista: FileList | null) {
    if (!lista) return;
    onArquivosNovosChange([...arquivosNovos, ...Array.from(lista)]);
  }

  return (
    <div>
      {(anexosExistentes.length > 0 || arquivosNovos.length > 0) && (
        <div className="space-y-1.5 mb-2">
          {anexosExistentes.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
              <span className="flex items-center gap-2 min-w-0 text-sm">
                <span>{iconePorNome(a.arquivo_nome)}</span>
                <span className="truncate text-ink">{a.arquivo_nome ?? "arquivo"}</span>
                {a.tamanho_bytes && <span className="text-xs text-ink/40 shrink-0">{formatarTamanho(a.tamanho_bytes)}</span>}
              </span>
              <button
                type="button"
                onClick={() => onRemoverExistente(a)}
                className="text-ink/30 hover:text-red-600 text-sm shrink-0"
                title="Remover anexo"
              >
                ✕
              </button>
            </div>
          ))}
          {arquivosNovos.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-mint/40 px-3 py-2">
              <span className="flex items-center gap-2 min-w-0 text-sm">
                <span>{iconePorNome(f.name)}</span>
                <span className="truncate text-ink">{f.name}</span>
                <span className="text-xs text-forest font-semibold shrink-0">novo</span>
              </span>
              <button
                type="button"
                onClick={() => onArquivosNovosChange(arquivosNovos.filter((_, idx) => idx !== i))}
                className="text-ink/30 hover:text-red-600 text-sm shrink-0"
                title="Remover"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          adicionar(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed px-4 py-4 text-center cursor-pointer transition-colors ${
          arrastando ? "border-forest bg-mint/30" : "border-black/15 hover:border-black/25 hover:bg-surface"
        }`}
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => adicionar(e.target.files)} />
        <p className="text-sm text-ink/50">📎 Arraste arquivos aqui ou clique pra selecionar</p>
        <p className="text-xs text-ink/35 mt-0.5">Contrato assinado, aditivos, cancelamento — pode escolher vários de uma vez.</p>
      </div>
    </div>
  );
}

/** Lista somente-leitura dos anexos de um contrato, usada na tela de
 * detalhe — cada um com um link de download assinado. */
export function ListaAnexosContrato({ contratoId }: { contratoId: string }) {
  const [anexos, setAnexos] = useState<AnexoContratoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("contratos_anexos")
        .select("id, arquivo_path, arquivo_nome, arquivo_tipo, tamanho_bytes")
        .eq("contrato_id", contratoId)
        .order("created_at");
      if (!cancelado) {
        setAnexos(data ?? []);
        setLoading(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [contratoId]);

  if (loading) return <p className="text-sm text-ink/40">Carregando anexos...</p>;
  if (anexos.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {anexos.map((a) => (
        <button
          key={a.id}
          onClick={async () => {
            const supabase = createClient();
            const { data } = await supabase.storage.from("contratos").createSignedUrl(a.arquivo_path, 60);
            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
          }}
          className="w-full flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-left hover:bg-black/5 transition-colors"
        >
          <span className="text-base">{iconePorNome(a.arquivo_nome)}</span>
          <span className="flex-1 min-w-0 truncate text-sm font-semibold text-ink">{a.arquivo_nome ?? "arquivo"}</span>
          {a.tamanho_bytes && <span className="text-xs text-ink/40 shrink-0">{formatarTamanho(a.tamanho_bytes)}</span>}
          <span className="text-xs font-semibold text-forest shrink-0">Abrir ↗</span>
        </button>
      ))}
    </div>
  );
}

/** Sobe os arquivos novos pro storage + tabela contratos_anexos. Chamar
 * depois que o contrato já tiver um id (criado ou editando). */
export async function subirAnexosContrato(contratoId: string, arquivos: File[], enviadoPor: string | null) {
  if (arquivos.length === 0) return;
  const supabase = createClient();
  for (const arquivo of arquivos) {
    const path = `${contratoId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${sanearNomeArquivo(arquivo.name)}`;
    const { error } = await supabase.storage.from("contratos").upload(path, arquivo);
    if (!error) {
      await supabase.from("contratos_anexos").insert({
        contrato_id: contratoId,
        arquivo_path: path,
        arquivo_nome: arquivo.name,
        arquivo_tipo: arquivo.type,
        tamanho_bytes: arquivo.size,
        enviado_por: enviadoPor,
      });
    }
  }
}

/** Remove um anexo já salvo (storage + linha da tabela). */
export async function removerAnexoContrato(anexo: AnexoContratoItem) {
  const supabase = createClient();
  await supabase.storage.from("contratos").remove([anexo.arquivo_path]);
  await supabase.from("contratos_anexos").delete().eq("id", anexo.id);
}

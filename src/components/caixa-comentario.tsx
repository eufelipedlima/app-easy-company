"use client";

import { useState, useRef } from "react";
import { Paperclip, Mic, Square, X, FileText, Image as ImageIcon, Music, Send } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";

export interface AnexoPendente {
  chave: string;
  arquivo: File;
  previewUrl: string | null;
}

function iconePorTipo(tipo: string) {
  if (tipo.startsWith("image/")) return <ImageIcon size={14} />;
  if (tipo.startsWith("audio/")) return <Music size={14} />;
  return <FileText size={14} />;
}

/** Caixa de comentário completa: texto formatado (negrito, listas, @menção,
 * #referência — o mesmo editor das descrições), anexar arquivo/foto, e
 * gravar um áudio direto do microfone. Usada em Tarefas e Conteúdo. */
export function CaixaComentario({
  valorHtml,
  onChangeHtml,
  onEnviar,
  enviando,
  placeholder,
  mencionaveis,
  referenciaveis,
}: {
  valorHtml: string;
  onChangeHtml: (html: string) => void;
  onEnviar: (anexos: File[]) => void;
  enviando: boolean;
  placeholder?: string;
  mencionaveis?: { id: string; nome: string; fotoUrl?: string | null }[];
  referenciaveis?: { id: string; titulo: string; tipo: "tarefa" | "conteudo"; clienteNome?: string | null }[];
}) {
  const [anexosPendentes, setAnexosPendentes] = useState<AnexoPendente[]>([]);
  const [gravando, setGravando] = useState(false);
  const [segundosGravacao, setSegundosGravacao] = useState(0);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksGravacaoRef = useRef<Blob[]>([]);
  const cronometroGravacaoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function adicionarArquivos(arquivos: FileList | null) {
    if (!arquivos) return;
    const novos: AnexoPendente[] = Array.from(arquivos).map((arquivo) => ({
      chave: `${Date.now()}-${Math.random()}`,
      arquivo,
      previewUrl: arquivo.type.startsWith("image/") ? URL.createObjectURL(arquivo) : null,
    }));
    setAnexosPendentes((atual) => [...atual, ...novos]);
  }

  function removerPendente(chave: string) {
    setAnexosPendentes((atual) => atual.filter((a) => a.chave !== chave));
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksGravacaoRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksGravacaoRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksGravacaoRef.current, { type: "audio/webm" });
        const arquivo = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        setAnexosPendentes((atual) => [...atual, { chave: `${Date.now()}-${Math.random()}`, arquivo, previewUrl: null }]);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
      setSegundosGravacao(0);
      cronometroGravacaoRef.current = setInterval(() => setSegundosGravacao((s) => s + 1), 1000);
    } catch {
      window.alert("Não deu pra acessar o microfone — confere se o navegador tem permissão.");
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    setGravando(false);
    if (cronometroGravacaoRef.current) clearInterval(cronometroGravacaoRef.current);
  }

  function aoEnviar() {
    if (enviando) return;
    onEnviar(anexosPendentes.map((a) => a.arquivo));
    anexosPendentes.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setAnexosPendentes([]);
  }

  const temConteudo = valorHtml.replace(/<[^>]*>/g, "").trim().length > 0 || anexosPendentes.length > 0;

  return (
    <div className="rounded-2xl border border-black/10 bg-white overflow-hidden focus-within:border-forest/40 transition-colors">
      <RichTextEditor
        valorHtml={valorHtml}
        onChange={onChangeHtml}
        placeholder={placeholder ?? "Escreva um comentário... (@ pra mencionar, # pra referenciar)"}
        mencionaveis={mencionaveis}
        referenciaveis={referenciaveis}
        aoPressionarEnter={aoEnviar}
      />

      {anexosPendentes.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {anexosPendentes.map((a) => (
            <div key={a.chave} className="relative flex items-center gap-1.5 rounded-xl bg-surface px-2 py-1.5 text-xs">
              {a.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.previewUrl} alt={a.arquivo.name} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <span className="text-ink/50">{iconePorTipo(a.arquivo.type)}</span>
              )}
              <span className="max-w-[100px] truncate text-ink/70">{a.arquivo.name}</span>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => removerPendente(a.chave)} className="text-ink/30 hover:text-red-600 shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-1.5">
        <input
          ref={inputArquivoRef}
          type="file"
          multiple
          onChange={(e) => {
            adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => inputArquivoRef.current?.click()}
          title="Anexar arquivo ou imagem"
          className="h-8 w-8 rounded-full flex items-center justify-center text-ink/40 hover:text-ink hover:bg-surface transition-colors shrink-0"
        >
          <Paperclip size={16} />
        </button>

        {gravando ? (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={pararGravacao}
            className="flex items-center gap-1.5 rounded-full bg-red-50 text-red-600 px-3 py-1.5 text-xs font-bold shrink-0"
          >
            <Square size={12} fill="currentColor" />
            {String(Math.floor(segundosGravacao / 60)).padStart(2, "0")}:{String(segundosGravacao % 60).padStart(2, "0")}
          </button>
        ) : (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={iniciarGravacao}
            title="Gravar um áudio"
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink/40 hover:text-ink hover:bg-surface transition-colors shrink-0"
          >
            <Mic size={16} />
          </button>
        )}

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={aoEnviar}
          disabled={enviando || !temConteudo}
          className="ml-auto rounded-full bg-forest text-white h-8 w-8 flex items-center justify-center hover:brightness-110 transition disabled:opacity-30 shrink-0"
          title="Enviar comentário (Enter)"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

interface AnexoComentario {
  id: string;
  arquivo_path: string;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
}

/** Mostra os anexos de um comentário já enviado — imagem em miniatura
 * (clicável pra abrir grande), áudio com player nativo, outros arquivos
 * como link de download. */
export function AnexosComentario({ anexos, bucket }: { anexos: AnexoComentario[]; bucket: string }) {
  const [imagemAberta, setImagemAberta] = useState<string | null>(null);
  if (anexos.length === 0) return null;

  function urlPublica(path: string) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {anexos.map((a) => {
        const url = urlPublica(a.arquivo_path);
        const tipo = a.arquivo_tipo ?? "";
        if (tipo.startsWith("image/")) {
          return (
            <button key={a.id} onClick={() => setImagemAberta(url)} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={a.arquivo_nome ?? ""} className="h-20 w-20 rounded-xl object-cover border border-black/5 hover:opacity-90 transition-opacity" />
            </button>
          );
        }
        if (tipo.startsWith("audio/")) {
          return (
            <audio key={a.id} controls src={url} className="h-9 max-w-[220px]">
              Seu navegador não suporta áudio.
            </audio>
          );
        }
        return (
          <a
            key={a.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-surface px-2.5 py-1.5 text-xs text-ink/70 hover:bg-black/5 transition-colors"
          >
            <FileText size={13} />
            <span className="max-w-[140px] truncate">{a.arquivo_nome ?? "Arquivo"}</span>
          </a>
        );
      })}

      {imagemAberta && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setImagemAberta(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagemAberta} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

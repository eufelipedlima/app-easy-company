"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const ALTURA_COLAPSADA = 130;

export function RichTextEditor({
  valorHtml,
  onChange,
  onSalvar,
  placeholder,
  semCaixa,
}: {
  valorHtml: string;
  onChange: (html: string) => void;
  onSalvar?: () => void;
  placeholder?: string;
  semCaixa?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [recolhido, setRecolhido] = useState(false);
  const [transborda, setTransborda] = useState(false);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const montadoRef = useRef(false);
  const selecaoSalvaRef = useRef<Range | null>(null);

  useEffect(() => {
    if (!montadoRef.current && editorRef.current) {
      editorRef.current.innerHTML = valorHtml || "";
      montadoRef.current = true;
      setTransborda(editorRef.current.scrollHeight > ALTURA_COLAPSADA + 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function salvarSelecao() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) selecaoSalvaRef.current = sel.getRangeAt(0);
  }

  function restaurarSelecao() {
    const sel = window.getSelection();
    if (sel && selecaoSalvaRef.current) {
      sel.removeAllRanges();
      sel.addRange(selecaoSalvaRef.current);
    }
  }

  function exec(comando: string, valor?: string) {
    editorRef.current?.focus();
    document.execCommand(comando, false, valor);
    handleInput();
  }

  function handleInput() {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
    setTransborda(editorRef.current.scrollHeight > ALTURA_COLAPSADA + 20);
  }

  function inserirLink() {
    restaurarSelecao();
    const url = window.prompt("Link (com https://):");
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, url);
    // marca os links recém-criados pra abrir em nova aba
    editorRef.current?.querySelectorAll("a:not([target])").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    handleInput();
  }

  async function selecionarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setEnviandoImagem(true);
    const supabase = createClient();
    const extensao = arquivo.name.split(".").pop();
    const caminho = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;
    const { error } = await supabase.storage.from("docs-anexos").upload(caminho, arquivo);
    if (!error) {
      const { data } = supabase.storage.from("docs-anexos").getPublicUrl(caminho);
      restaurarSelecao();
      editorRef.current?.focus();
      document.execCommand("insertImage", false, data.publicUrl);
      handleInput();
    }
    setEnviandoImagem(false);
  }

  const botao = "h-7 min-w-7 px-2 rounded-lg text-xs font-bold text-ink/60 hover:bg-surface transition-colors";

  return (
    <div>
      <div className="flex items-center gap-0.5 mb-2 rounded-full bg-surface w-fit p-1 flex-wrap">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className={botao} title="Negrito">
          B
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className={`${botao} italic`} title="Itálico">
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("underline")}
          className={`${botao} underline`}
          title="Sublinhado"
        >
          U
        </button>
        <span className="w-px h-4 bg-black/10 mx-0.5" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("formatBlock", "H2")}
          className={botao}
          title="Título"
        >
          Título
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("formatBlock", "H3")}
          className={botao}
          title="Subtítulo"
        >
          Subtítulo
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("formatBlock", "P")}
          className={botao}
          title="Texto normal"
        >
          Normal
        </button>
        <span className="w-px h-4 bg-black/10 mx-0.5" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertHorizontalRule")}
          className={botao}
          title="Linha divisória"
        >
          ―
        </button>
        <button type="button" onMouseDown={salvarSelecao} onClick={inserirLink} className={botao} title="Inserir link">
          🔗
        </button>
        <button
          type="button"
          onMouseDown={salvarSelecao}
          onClick={() => inputArquivoRef.current?.click()}
          disabled={enviandoImagem}
          className={botao}
          title="Inserir imagem"
        >
          {enviandoImagem ? "..." : "🖼️"}
        </button>
        <input ref={inputArquivoRef} type="file" accept="image/*" onChange={selecionarImagem} className="hidden" />
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={onSalvar}
        className={`rich-text-editor resize-none overflow-hidden ${semCaixa ? "rich-text-editor--livre" : "input"}`}
        style={recolhido && transborda ? { maxHeight: ALTURA_COLAPSADA, overflow: "hidden" } : undefined}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      {transborda && (
        <button onClick={() => setRecolhido((v) => !v)} className="mt-1 text-xs font-semibold text-ink/50 hover:text-ink flex items-center gap-1">
          {recolhido ? "▼ Expandir" : "▲ Recolher"}
        </button>
      )}

      <style jsx global>{`
        .rich-text-editor {
          min-height: 60px;
        }
        .rich-text-editor:empty:before {
          content: attr(data-placeholder);
          color: rgba(2, 23, 11, 0.35);
        }
        .rich-text-editor h2 {
          font-size: 1.4rem;
          font-weight: 800;
          margin: 0.5em 0 0.25em;
        }
        .rich-text-editor h3 {
          font-size: 1.05rem;
          font-weight: 800;
          margin: 0.4em 0 0.2em;
        }
        .rich-text-editor hr {
          border: none;
          border-top: 1px solid rgba(2, 23, 11, 0.1);
          margin: 0.6em 0;
        }
        .rich-text-editor p {
          margin: 0.2em 0;
        }
        .rich-text-editor a {
          color: #143421;
          font-weight: 600;
          text-decoration: underline;
        }
        .rich-text-editor:focus {
          outline: none;
        }
        .rich-text-editor--livre {
          border: 1px solid rgba(2, 23, 11, 0.08);
          background: rgba(2, 23, 11, 0.015);
          border-radius: 1rem;
          padding: 1.25rem 1.5rem;
          font-size: 0.95rem;
          line-height: 1.7;
          min-height: 60vh;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .rich-text-editor--livre:hover {
          border-color: rgba(2, 23, 11, 0.14);
        }
        .rich-text-editor--livre:focus {
          border-color: #143421;
          background: #ffffff;
        }
        .rich-text-editor img {
          max-width: 100%;
          border-radius: 0.75rem;
          margin: 0.5em 0;
        }
      `}</style>
    </div>
  );
}

export function renderizarHtmlSeguro(html: string) {
  return { __html: html };
}

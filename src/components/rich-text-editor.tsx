"use client";

import { useRef, useState, useEffect } from "react";

const ALTURA_COLAPSADA = 130;

export function RichTextEditor({
  valorHtml,
  onChange,
  onSalvar,
  placeholder,
}: {
  valorHtml: string;
  onChange: (html: string) => void;
  onSalvar?: () => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [recolhido, setRecolhido] = useState(false);
  const [transborda, setTransborda] = useState(false);
  const montadoRef = useRef(false);

  useEffect(() => {
    if (!montadoRef.current && editorRef.current) {
      editorRef.current.innerHTML = valorHtml || "";
      montadoRef.current = true;
      setTransborda(editorRef.current.scrollHeight > ALTURA_COLAPSADA + 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(comando: string, valor?: string) {
    document.execCommand(comando, false, valor);
    editorRef.current?.focus();
    handleInput();
  }

  function handleInput() {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
    setTransborda(editorRef.current.scrollHeight > ALTURA_COLAPSADA + 20);
  }

  const botao = "h-7 min-w-7 px-2 rounded-lg text-xs font-bold text-ink/60 hover:bg-surface transition-colors";

  return (
    <div>
      <div className="flex items-center gap-0.5 mb-2 rounded-full bg-surface w-fit p-1">
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
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("formatBlock", "H3")}
          className={botao}
          title="Título"
        >
          Título
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
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertHorizontalRule")}
          className={botao}
          title="Linha divisória"
        >
          ―
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={onSalvar}
        className="rich-text-editor input resize-none overflow-hidden"
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
      `}</style>
    </div>
  );
}

export function renderizarHtmlSeguro(html: string) {
  return { __html: html };
}

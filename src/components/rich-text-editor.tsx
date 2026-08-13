"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const ALTURA_COLAPSADA = 130;

const REGEX_URL = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

function escaparHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textoParaHtmlComLinks(texto: string) {
  const partes = texto.split(REGEX_URL);
  const html = partes
    .map((parte) => {
      const ehUrl = /^https?:\/\//i.test(parte) || /^www\./i.test(parte);
      if (ehUrl) {
        const href = parte.toLowerCase().startsWith("www.") ? `https://${parte}` : parte;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escaparHtml(parte)}</a>`;
      }
      return escaparHtml(parte).replace(/\n/g, "<br>");
    })
    .join("");
  return html;
}

// Ao colar de outro app (ClickUp, Notion, Google Docs, Word...), preserva a
// formatação básica que o nosso editor já entende — título, negrito, listas,
// citação, cor — e descarta o resto (fontes estranhas, classes, ids, script).
const TAGS_PERMITIDAS = new Set([
  "P", "BR", "H1", "H2", "H3", "H4", "H5", "H6", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "A", "SPAN", "DIV", "HR",
]);

function mapearTag(tag: string) {
  if (tag === "H1") return "H2";
  if (tag === "H4" || tag === "H5" || tag === "H6") return "H3";
  if (tag === "DIV") return "P";
  if (tag === "STRIKE") return "S";
  return tag;
}

function estiloPermitido(el: HTMLElement) {
  const partes: string[] = [];
  if (el.style.color) partes.push(`color:${el.style.color}`);
  if (el.style.backgroundColor) partes.push(`background-color:${el.style.backgroundColor}`);
  return partes.join(";");
}

function limparNoColado(no: ChildNode): Node | null {
  if (no.nodeType === Node.TEXT_NODE) return no.cloneNode();
  if (no.nodeType !== Node.ELEMENT_NODE) return null;
  const el = no as HTMLElement;
  const tagOriginal = el.tagName;

  if (tagOriginal === "SCRIPT" || tagOriginal === "STYLE" || tagOriginal === "META" || tagOriginal === "LINK") return null;

  if (!TAGS_PERMITIDAS.has(tagOriginal)) {
    // tag que não reconhecemos (ex: <font>, spans de exportação do Word) — mantém só o conteúdo de dentro
    const frag = document.createDocumentFragment();
    el.childNodes.forEach((filho) => {
      const limpo = limparNoColado(filho);
      if (limpo) frag.appendChild(limpo);
    });
    return frag;
  }

  const tagFinal = mapearTag(tagOriginal);
  const novoEl = document.createElement(tagFinal);

  if (tagFinal === "A") {
    const href = el.getAttribute("href");
    if (href) {
      novoEl.setAttribute("href", href);
      novoEl.setAttribute("target", "_blank");
      novoEl.setAttribute("rel", "noopener noreferrer");
    }
  }
  if (tagFinal === "SPAN") {
    const estilo = estiloPermitido(el);
    if (estilo) novoEl.setAttribute("style", estilo);
  }
  if (tagFinal === "UL" && /checklist|checkbox|todo/i.test(el.className || "")) {
    novoEl.classList.add("checklist");
  }
  if (tagFinal === "LI") {
    const feito = el.getAttribute("data-checked") ?? el.getAttribute("data-done");
    if (feito === "true") novoEl.setAttribute("data-done", "true");
  }

  el.childNodes.forEach((filho) => {
    const limpo = limparNoColado(filho);
    if (limpo) novoEl.appendChild(limpo);
  });

  if (tagFinal === "SPAN" && !novoEl.getAttribute("style") && novoEl.textContent === "") return null;
  return novoEl;
}

function sanearHtmlColado(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const container = document.createElement("div");
  doc.body.childNodes.forEach((no) => {
    const limpo = limparNoColado(no);
    if (limpo) container.appendChild(limpo);
  });
  return container.innerHTML;
}

const CORES_TEXTO = [
  { nome: "Padrão", valor: "" },
  { nome: "Vermelho", valor: "#e03131" },
  { nome: "Laranja", valor: "#f08c00" },
  { nome: "Verde", valor: "#2f9e44" },
  { nome: "Azul", valor: "#1971c2" },
  { nome: "Roxo", valor: "#7048e8" },
  { nome: "Cinza", valor: "#868e96" },
];

const CORES_FUNDO = [
  { nome: "Sem cor", valor: "" },
  { nome: "Amarelo", valor: "#fff3bf" },
  { nome: "Verde", valor: "#d3f9d8" },
  { nome: "Azul", valor: "#d0ebff" },
  { nome: "Rosa", valor: "#ffe3e3" },
  { nome: "Roxo", valor: "#eee0ff" },
  { nome: "Cinza", valor: "#eceef0" },
];

type ComandoItem = {
  id: string;
  icone: string;
  label: string;
  descricao: string;
  palavras: string[];
  executar: () => void;
};

type EstadoMenu = {
  textNode: Text;
  inicio: number;
  fim: number;
  query: string;
  top: number;
  left: number;
};

export function RichTextEditor({
  valorHtml,
  onChange,
  onSalvar,
  placeholder,
  semCaixa,
  mencionaveis,
}: {
  valorHtml: string;
  onChange: (html: string) => void;
  onSalvar?: () => void;
  placeholder?: string;
  semCaixa?: boolean;
  mencionaveis?: { id: string; nome: string }[];
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [recolhido, setRecolhido] = useState(false);
  const [transborda, setTransborda] = useState(false);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [popoverAberto, setPopoverAberto] = useState<"texto" | "fundo" | null>(null);
  const [toolbarAberta, setToolbarAberta] = useState(false);
  const [menu, setMenu] = useState<EstadoMenu | null>(null);
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const [menuMencao, setMenuMencao] = useState<EstadoMenu | null>(null);
  const [indiceMencaoSelecionada, setIndiceMencaoSelecionada] = useState(0);
  const montadoRef = useRef(false);
  const selecaoSalvaRef = useRef<Range | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!montadoRef.current && editorRef.current) {
      editorRef.current.innerHTML = valorHtml || "";
      montadoRef.current = true;
      setTransborda(editorRef.current.scrollHeight > ALTURA_COLAPSADA + 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      // navegador não suporta, segue com o padrão
    }
  }, []);

  useEffect(() => {
    if (!popoverAberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverAberto(null);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [popoverAberto]);

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

  function fecharMenu() {
    setMenu(null);
    setIndiceSelecionado(0);
  }

  function fecharMenuMencao() {
    setMenuMencao(null);
    setIndiceMencaoSelecionada(0);
  }

  function verificarMencao() {
    if (!mencionaveis || mencionaveis.length === 0) {
      fecharMenuMencao();
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      fecharMenuMencao();
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !editorRef.current?.contains(node)) {
      fecharMenuMencao();
      return;
    }
    const texto = node.textContent || "";
    const offset = range.startOffset;
    const antes = texto.slice(0, offset);
    const match = antes.match(/(?:^|\s)@(\w{0,24})$/);
    if (!match) {
      fecharMenuMencao();
      return;
    }
    const query = match[1];
    const inicioArroba = offset - query.length - 1;

    const rangePos = document.createRange();
    rangePos.setStart(node, inicioArroba);
    rangePos.setEnd(node, offset);
    const rect = rangePos.getBoundingClientRect();
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) return;

    setMenuMencao({
      textNode: node as Text,
      inicio: inicioArroba,
      fim: offset,
      query,
      top: rect.bottom - wrapperRect.top + 6,
      left: Math.min(rect.left - wrapperRect.left, wrapperRect.width - 232),
    });
    setIndiceMencaoSelecionada(0);
  }

  function selecionarMencao(pessoa: { id: string; nome: string }) {
    if (!menuMencao) return;
    const range = document.createRange();
    range.setStart(menuMencao.textNode, menuMencao.inicio);
    range.setEnd(menuMencao.textNode, menuMencao.fim);
    range.deleteContents();
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    fecharMenuMencao();
    editorRef.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<span class="mencao" data-mencao-id="${pessoa.id}">@${escaparHtml(pessoa.nome)}</span>&nbsp;`
    );
    handleInput();
  }

  function verificarComandoBarra() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      fecharMenu();
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !editorRef.current?.contains(node)) {
      fecharMenu();
      return;
    }
    const texto = node.textContent || "";
    const offset = range.startOffset;
    const antes = texto.slice(0, offset);
    const match = antes.match(/(?:^|\s)\/(\w{0,24})$/);
    if (!match) {
      fecharMenu();
      return;
    }
    const query = match[1];
    const inicioSlash = offset - query.length - 1;

    const rangePos = document.createRange();
    rangePos.setStart(node, inicioSlash);
    rangePos.setEnd(node, offset);
    const rect = rangePos.getBoundingClientRect();
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) return;

    setMenu({
      textNode: node as Text,
      inicio: inicioSlash,
      fim: offset,
      query,
      top: rect.bottom - wrapperRect.top + 6,
      left: Math.min(rect.left - wrapperRect.left, wrapperRect.width - 232),
    });
    setIndiceSelecionado(0);
  }

  function handleInput() {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
    setTransborda(editorRef.current.scrollHeight > ALTURA_COLAPSADA + 20);
    verificarComandoBarra();
    verificarMencao();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const html = e.clipboardData.getData("text/html");
    const texto = e.clipboardData.getData("text/plain");
    if (!html && !texto) return; // deixa o comportamento padrão (ex.: colar imagem)
    e.preventDefault();
    editorRef.current?.focus();
    const htmlFinal = html.trim() ? sanearHtmlColado(html) : textoParaHtmlComLinks(texto);
    document.execCommand("insertHTML", false, htmlFinal);
    handleInput();
  }

  function inserirLink() {
    restaurarSelecao();
    const url = window.prompt("Link (com https://):");
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, url);
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

  function toggleChecklist() {
    editorRef.current?.focus();
    restaurarSelecao();
    document.execCommand("insertUnorderedList", false);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
      while (node && node !== editorRef.current) {
        if (node instanceof HTMLUListElement) {
          node.classList.add("checklist");
          Array.from(node.children).forEach((li) => {
            if (!(li as HTMLElement).hasAttribute("data-done")) {
              (li as HTMLElement).setAttribute("data-done", "false");
            }
          });
          break;
        }
        node = node.parentNode;
      }
    }
    handleInput();
  }

  function aplicarCorTexto(cor: string) {
    editorRef.current?.focus();
    restaurarSelecao();
    document.execCommand("foreColor", false, cor || "#02170b");
    setPopoverAberto(null);
    handleInput();
  }

  function aplicarCorFundo(cor: string) {
    editorRef.current?.focus();
    restaurarSelecao();
    document.execCommand("hiliteColor", false, cor || "transparent");
    setPopoverAberto(null);
    handleInput();
  }

  function handleClickEditor(e: React.MouseEvent<HTMLDivElement>) {
    const alvoLink = (e.target as HTMLElement).closest("a");
    if (alvoLink) {
      e.preventDefault();
      window.open(alvoLink.getAttribute("href") ?? "#", "_blank", "noopener,noreferrer");
      return;
    }
    const li = (e.target as HTMLElement).closest("ul.checklist > li") as HTMLElement | null;
    if (li) {
      const rect = li.getBoundingClientRect();
      if (e.clientX - rect.left < 28) {
        e.preventDefault();
        const feito = li.getAttribute("data-done") === "true";
        li.setAttribute("data-done", feito ? "false" : "true");
        handleInput();
      }
    }
  }

  const itensComando: ComandoItem[] = useMemo(
    () => [
      { id: "titulo", icone: "H1", label: "Título", descricao: "Título grande de seção", palavras: ["titulo", "h1", "h2"], executar: () => exec("formatBlock", "H2") },
      { id: "subtitulo", icone: "H2", label: "Subtítulo", descricao: "Título menor", palavras: ["subtitulo", "h3"], executar: () => exec("formatBlock", "H3") },
      { id: "texto", icone: "P", label: "Texto normal", descricao: "Parágrafo comum", palavras: ["texto", "normal", "paragrafo"], executar: () => exec("formatBlock", "P") },
      { id: "marcadores", icone: "•", label: "Lista com marcadores", descricao: "Lista simples com bolinhas", palavras: ["lista", "marcadores", "bullet"], executar: () => exec("insertUnorderedList") },
      { id: "numerada", icone: "1.", label: "Lista numerada", descricao: "Lista em ordem", palavras: ["lista", "numerada", "numero", "ordenada"], executar: () => exec("insertOrderedList") },
      { id: "checklist", icone: "☑", label: "Checklist", descricao: "Lista de tarefas marcável", palavras: ["checklist", "check", "tarefa", "todo"], executar: () => toggleChecklist() },
      { id: "citacao", icone: "❝", label: "Citação", descricao: "Bloco de citação com destaque", palavras: ["citacao", "quote"], executar: () => exec("formatBlock", "BLOCKQUOTE") },
      { id: "codigo", icone: "</>", label: "Bloco de código", descricao: "Texto em fonte monoespaçada", palavras: ["codigo", "code"], executar: () => exec("formatBlock", "PRE") },
      { id: "divisoria", icone: "―", label: "Linha divisória", descricao: "Separa seções do texto", palavras: ["divisoria", "linha", "separador"], executar: () => exec("insertHorizontalRule") },
      { id: "link", icone: "🔗", label: "Link", descricao: "Inserir um link", palavras: ["link", "url"], executar: () => inserirLink() },
      { id: "imagem", icone: "🖼️", label: "Imagem", descricao: "Enviar uma imagem", palavras: ["imagem", "foto", "upload"], executar: () => inputArquivoRef.current?.click() },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const itensFiltrados = useMemo(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    if (!q) return itensComando;
    return itensComando.filter((i) => i.label.toLowerCase().includes(q) || i.palavras.some((p) => p.startsWith(q)));
  }, [menu, itensComando]);

  const pessoasFiltradas = useMemo(() => {
    if (!menuMencao || !mencionaveis) return [];
    const q = menuMencao.query.toLowerCase();
    if (!q) return mencionaveis;
    return mencionaveis.filter((p) => p.nome.toLowerCase().includes(q));
  }, [menuMencao, mencionaveis]);

  function executarComando(item: ComandoItem) {
    if (!menu) return;
    const range = document.createRange();
    range.setStart(menu.textNode, menu.inicio);
    range.setEnd(menu.textNode, menu.fim);
    range.deleteContents();
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    salvarSelecao();
    fecharMenu();
    editorRef.current?.focus();
    item.executar();
  }

  function handleKeyDownEditor(e: React.KeyboardEvent<HTMLDivElement>) {
    if (menuMencao) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndiceMencaoSelecionada((i) => Math.min(i + 1, Math.max(pessoasFiltradas.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndiceMencaoSelecionada((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        if (pessoasFiltradas[indiceMencaoSelecionada]) {
          e.preventDefault();
          selecionarMencao(pessoasFiltradas[indiceMencaoSelecionada]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        fecharMenuMencao();
      }
      return;
    }
    if (!menu) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceSelecionado((i) => Math.min(i + 1, Math.max(itensFiltrados.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceSelecionado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (itensFiltrados[indiceSelecionado]) {
        e.preventDefault();
        executarComando(itensFiltrados[indiceSelecionado]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      fecharMenu();
    }
  }

  const botao = "h-7 min-w-7 px-2 rounded-lg text-xs font-bold text-ink/60 hover:bg-white transition-colors";
  const divisor = <span className="w-px h-4 bg-black/10 mx-0.5" />;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setToolbarAberta((v) => !v)}
          className="h-7 px-2.5 rounded-lg text-xs font-semibold bg-surface text-ink/60 hover:text-ink hover:bg-surface/80 transition-colors inline-flex items-center gap-1"
          title="Mostrar/ocultar opções de formatação"
        >
          Aa Formatar
          <span className={`text-[10px] transition-transform duration-150 ${toolbarAberta ? "rotate-180" : ""}`}>▾</span>
        </button>
        <span className="text-[11px] text-ink/35">
          ou digite <kbd className="px-1 py-0.5 rounded bg-surface font-mono text-[10px]">/</kbd> no texto pra ver as opções
        </span>
      </div>

      <div
        className={`transition-all duration-200 ease-out ${
          toolbarAberta ? "max-h-[500px] opacity-100 mb-2 overflow-visible" : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <div className="flex items-center gap-0.5 rounded-full bg-surface w-fit p-1 flex-wrap">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className={botao} title="Negrito">
            B
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className={`${botao} italic`} title="Itálico">
            I
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className={`${botao} underline`} title="Sublinhado">
            U
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("strikeThrough")} className={`${botao} line-through`} title="Tachado">
            S
          </button>
          {divisor}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "H2")} className={botao} title="Título">
            Título
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "H3")} className={botao} title="Subtítulo">
            Subtítulo
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "P")} className={botao} title="Texto normal">
            Normal
          </button>
          {divisor}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className={botao} title="Lista com marcadores">
            • Lista
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")} className={botao} title="Lista numerada">
            1. Lista
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={toggleChecklist} className={botao} title="Checklist">
            ☑ Check
          </button>
          {divisor}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "BLOCKQUOTE")} className={botao} title="Citação">
            ❝ Citação
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "PRE")} className={botao} title="Bloco de código">
            {"</>"}
          </button>
          {divisor}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                salvarSelecao();
              }}
              onClick={() => setPopoverAberto((v) => (v === "texto" ? null : "texto"))}
              className={botao}
              title="Cor do texto"
            >
              Cor
            </button>
            {popoverAberto === "texto" && (
              <div ref={popoverRef} className="absolute z-20 top-9 left-0 bg-white rounded-xl shadow-lg border border-black/10 p-2 flex gap-1.5">
                {CORES_TEXTO.map((c) => (
                  <button
                    key={c.valor || "padrao"}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => aplicarCorTexto(c.valor)}
                    title={c.nome}
                    className="w-6 h-6 rounded-full border border-black/10 flex items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: c.valor || "#ffffff", color: c.valor ? "#fff" : "#02170b" }}
                  >
                    {!c.valor && "A"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                salvarSelecao();
              }}
              onClick={() => setPopoverAberto((v) => (v === "fundo" ? null : "fundo"))}
              className={botao}
              title="Cor de fundo"
            >
              Fundo
            </button>
            {popoverAberto === "fundo" && (
              <div ref={popoverRef} className="absolute z-20 top-9 left-0 bg-white rounded-xl shadow-lg border border-black/10 p-2 flex gap-1.5">
                {CORES_FUNDO.map((c) => (
                  <button
                    key={c.valor || "sem-cor"}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => aplicarCorFundo(c.valor)}
                    title={c.nome}
                    className="w-6 h-6 rounded-full border border-black/15 flex items-center justify-center text-[10px] font-bold text-ink/40"
                    style={{ backgroundColor: c.valor || "#ffffff" }}
                  >
                    {!c.valor && "✕"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {divisor}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertHorizontalRule")} className={botao} title="Linha divisória">
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
        </div>
      </div>
      <input ref={inputArquivoRef} type="file" accept="image/*" onChange={selecionarImagem} className="hidden" />

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onBlur={() => {
          onSalvar?.();
          fecharMenu();
        }}
        onKeyDown={handleKeyDownEditor}
        onClick={handleClickEditor}
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

      {menu && (
        <div
          style={{ top: menu.top, left: Math.max(menu.left, 0) }}
          className="absolute z-30 w-60 bg-white rounded-xl shadow-lg border border-black/10 py-1.5 max-h-72 overflow-y-auto"
        >
          {itensFiltrados.length === 0 && <div className="px-3 py-2 text-xs text-ink/40">Nada encontrado</div>}
          {itensFiltrados.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIndiceSelecionado(i)}
              onClick={() => executarComando(item)}
              className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2.5 transition-colors ${
                i === indiceSelecionado ? "bg-surface" : "hover:bg-surface/60"
              }`}
            >
              <span className="w-7 h-7 shrink-0 rounded-lg bg-surface flex items-center justify-center text-[11px] font-bold text-ink/60">
                {item.icone}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink leading-tight">{item.label}</span>
                <span className="block text-[11px] text-ink/40 leading-tight">{item.descricao}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {menuMencao && (
        <div
          style={{ top: menuMencao.top, left: Math.max(menuMencao.left, 0) }}
          className="absolute z-30 w-56 bg-white rounded-xl shadow-lg border border-black/10 py-1.5 max-h-72 overflow-y-auto"
        >
          {pessoasFiltradas.length === 0 && <div className="px-3 py-2 text-xs text-ink/40">Ninguém encontrado</div>}
          {pessoasFiltradas.map((pessoa, i) => (
            <button
              key={pessoa.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIndiceMencaoSelecionada(i)}
              onClick={() => selecionarMencao(pessoa)}
              className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2.5 transition-colors ${
                i === indiceMencaoSelecionada ? "bg-surface" : "hover:bg-surface/60"
              }`}
            >
              <span className="w-7 h-7 shrink-0 rounded-full bg-mint text-forest flex items-center justify-center text-[11px] font-bold">
                {pessoa.nome.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-ink truncate">{pessoa.nome}</span>
            </button>
          ))}
        </div>
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
        .rich-text-editor .mencao {
          color: var(--ec-forest, #143421);
          background: var(--ec-mint, #e4ffef);
          font-weight: 600;
          border-radius: 0.25rem;
          padding: 0.05rem 0.3rem;
        }
        .rich-text-editor a {
          color: #2563eb;
          font-weight: 500;
          text-decoration: underline;
          cursor: pointer;
        }
        .rich-text-editor a:hover {
          color: #1d4ed8;
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
        .rich-text-editor ul:not(.checklist) {
          list-style: disc;
          padding-left: 1.4em;
          margin: 0.3em 0;
        }
        .rich-text-editor ol {
          list-style: decimal;
          padding-left: 1.4em;
          margin: 0.3em 0;
        }
        .rich-text-editor ul:not(.checklist) li,
        .rich-text-editor ol li {
          margin: 0.15em 0;
        }
        .rich-text-editor blockquote {
          border-left: 3px solid #143421;
          padding: 0.15em 0 0.15em 1em;
          margin: 0.5em 0;
          color: rgba(2, 23, 11, 0.7);
          font-style: italic;
        }
        .rich-text-editor pre {
          background: rgba(2, 23, 11, 0.06);
          border-radius: 0.6rem;
          padding: 0.75em 1em;
          margin: 0.5em 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.85em;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .rich-text-editor ul.checklist {
          list-style: none;
          padding-left: 0;
          margin: 0.3em 0;
        }
        .rich-text-editor ul.checklist li {
          position: relative;
          padding-left: 1.75rem;
          margin: 0.25em 0;
        }
        .rich-text-editor ul.checklist li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.15em;
          width: 1.05rem;
          height: 1.05rem;
          border-radius: 0.3rem;
          border: 1.5px solid rgba(2, 23, 11, 0.3);
          background: #fff;
          cursor: pointer;
        }
        .rich-text-editor ul.checklist li[data-done="true"] {
          color: rgba(2, 23, 11, 0.4);
          text-decoration: line-through;
        }
        .rich-text-editor ul.checklist li[data-done="true"]::before {
          content: "✓";
          background: #143421;
          border-color: #143421;
          color: #fff;
          font-size: 0.75rem;
          line-height: 1rem;
          text-align: center;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}

export function renderizarHtmlSeguro(html: string) {
  return { __html: html };
}

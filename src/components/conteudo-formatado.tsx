"use client";

export function ConteudoFormatado({ html, className = "" }: { html: string; className?: string }) {
  return (
    <>
      <div className={`conteudo-formatado ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
      <style jsx global>{`
        .conteudo-formatado {
          font-size: 0.95rem;
          line-height: 1.75;
          color: var(--ec-ink);
        }
        .conteudo-formatado h2 {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0.9em 0 0.35em;
        }
        .conteudo-formatado h3 {
          font-size: 1.1rem;
          font-weight: 800;
          margin: 0.8em 0 0.3em;
        }
        .conteudo-formatado p {
          margin: 0.5em 0;
        }
        .conteudo-formatado hr {
          border: none;
          border-top: 1px solid rgba(2, 23, 11, 0.1);
          margin: 1.2em 0;
        }
        .conteudo-formatado .mencao {
          color: var(--ec-forest, #143421);
          background: var(--ec-mint, #e4ffef);
          font-weight: 600;
          border-radius: 0.25rem;
          padding: 0.05rem 0.3rem;
        }
        .conteudo-formatado a {
          color: #2563eb;
          font-weight: 500;
          text-decoration: underline;
        }
        .conteudo-formatado a:hover {
          color: #1d4ed8;
        }
        .conteudo-formatado img {
          max-width: 100%;
          border-radius: 0.75rem;
          margin: 0.6em 0;
        }
        .conteudo-formatado ul:not(.checklist) {
          list-style: disc;
          padding-left: 1.4em;
          margin: 0.5em 0;
        }
        .conteudo-formatado ol {
          list-style: decimal;
          padding-left: 1.4em;
          margin: 0.5em 0;
        }
        .conteudo-formatado ul:not(.checklist) li,
        .conteudo-formatado ol li {
          margin: 0.2em 0;
        }
        .conteudo-formatado blockquote {
          border-left: 3px solid #143421;
          padding: 0.15em 0 0.15em 1em;
          margin: 0.7em 0;
          color: rgba(2, 23, 11, 0.7);
          font-style: italic;
        }
        .conteudo-formatado pre {
          background: rgba(2, 23, 11, 0.06);
          border-radius: 0.6rem;
          padding: 0.75em 1em;
          margin: 0.7em 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.85em;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .conteudo-formatado ul.checklist {
          list-style: none;
          padding-left: 0;
          margin: 0.5em 0;
        }
        .conteudo-formatado ul.checklist li {
          position: relative;
          padding-left: 1.75rem;
          margin: 0.3em 0;
        }
        .conteudo-formatado ul.checklist li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.15em;
          width: 1.05rem;
          height: 1.05rem;
          border-radius: 0.3rem;
          border: 1.5px solid rgba(2, 23, 11, 0.3);
          background: #fff;
        }
        .conteudo-formatado ul.checklist li[data-done="true"] {
          color: rgba(2, 23, 11, 0.4);
          text-decoration: line-through;
        }
        .conteudo-formatado ul.checklist li[data-done="true"]::before {
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
    </>
  );
}

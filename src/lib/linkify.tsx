import type { ReactNode } from "react";

const REGEX_URL_SPLIT = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

/**
 * Recebe um texto puro e devolve nós React com qualquer URL (http://, https:// ou www.)
 * transformada em link clicável, azul, abrindo em nova aba. Uso:
 *   <p>{comLinks(comentario.texto, "comentario-3")}</p>
 */
export function comLinks(texto: string, keyPrefix: string | number = ""): ReactNode[] {
  if (!texto) return [texto];
  const partes = texto.split(REGEX_URL_SPLIT).filter((p) => p !== "");
  return partes.map((parte, i) => {
    const ehUrl = /^https?:\/\//i.test(parte) || /^www\./i.test(parte);
    if (ehUrl) {
      const href = parte.toLowerCase().startsWith("www.") ? `https://${parte}` : parte;
      return (
        <a
          key={`${keyPrefix}-link-${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline decoration-blue-600/40 hover:text-blue-700 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {parte}
        </a>
      );
    }
    return <span key={`${keyPrefix}-txt-${i}`}>{parte}</span>;
  });
}

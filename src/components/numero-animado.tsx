"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima um número subindo do zero (ou do valor anterior) até o valor atual.
 * Uso:
 *   <NumeroAnimado valor={1284} />
 *   <NumeroAnimado valor={saldo} formatar={(v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
 */
export function NumeroAnimado({
  valor,
  formatar,
  duracaoMs = 700,
  className,
}: {
  valor: number;
  formatar?: (v: number) => string;
  duracaoMs?: number;
  className?: string;
}) {
  const [exibido, setExibido] = useState(0);
  const valorAnteriorRef = useRef(0);
  const primeiraVezRef = useRef(true);

  useEffect(() => {
    if (!Number.isFinite(valor)) return;
    const de = primeiraVezRef.current ? 0 : valorAnteriorRef.current;
    const para = valor;
    primeiraVezRef.current = false;

    if (de === para) {
      setExibido(para);
      return;
    }

    const inicio = performance.now();
    let quadro: number;

    function passo(agora: number) {
      const progresso = Math.min((agora - inicio) / duracaoMs, 1);
      const facilitado = 1 - Math.pow(1 - progresso, 3); // ease-out cúbico
      setExibido(de + (para - de) * facilitado);
      if (progresso < 1) {
        quadro = requestAnimationFrame(passo);
      } else {
        valorAnteriorRef.current = para;
      }
    }
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, duracaoMs]);

  const textoFinal = formatar ? formatar(exibido) : Math.round(exibido).toLocaleString("pt-BR");

  return <span className={className}>{textoFinal}</span>;
}

import { PALETA_CORES } from "@/lib/status-conteudo";

// Mesma paleta pastel usada nos status — reaproveitada aqui pra dar uma cor
// consistente a cada cliente (o mesmo nome sempre cai na mesma cor), sem
// precisar cadastrar cor nenhuma: é calculada a partir do próprio nome.
const CHAVES_CORES = Object.keys(PALETA_CORES).filter((c) => c !== "cinza");

export function corDoCliente(nome: string | null | undefined) {
  if (!nome) return PALETA_CORES.cinza;
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % CHAVES_CORES.length;
  const chave = CHAVES_CORES[Math.abs(hash) % CHAVES_CORES.length];
  return PALETA_CORES[chave];
}

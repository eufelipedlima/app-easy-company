// Normaliza texto pra busca sem acento: tira acentuação e deixa minúsculo.
// Usado em todos os campos de busca/autocomplete do sistema, pra "trafego"
// encontrar "Tráfego" e por aí vai.
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

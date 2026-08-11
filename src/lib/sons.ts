"use client";

// Sons de notificação gerados na hora (sem precisar de arquivo de áudio),
// usando a Web Audio API. Cada tipo tem um timbre diferente pra dar pra
// diferenciar de ouvido: caixa de entrada, mensagem privada e grupo/canal.

let contextoAudio: AudioContext | null = null;
function obterContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClasse = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClasse) return null;
  if (!contextoAudio) contextoAudio = new AudioContextClasse();
  return contextoAudio;
}

function tocarNota(freq: number, inicioSeg: number, duracaoSeg: number, volume: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const inicio = ctx.currentTime + inicioSeg;
  gain.gain.setValueAtTime(0, inicio);
  gain.gain.linearRampToValueAtTime(volume, inicio + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, inicio + duracaoSeg);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracaoSeg + 0.02);
}

export function tocarSomCaixaEntrada() {
  const ctx = obterContexto();
  if (!ctx) return;
  tocarNota(740, 0, 0.12, 0.12, ctx);
  tocarNota(988, 0.09, 0.16, 0.12, ctx);
}

export function tocarSomMensagemPrivada() {
  const ctx = obterContexto();
  if (!ctx) return;
  tocarNota(880, 0, 0.14, 0.13, ctx);
}

export function tocarSomMensagemGrupo() {
  const ctx = obterContexto();
  if (!ctx) return;
  tocarNota(523, 0, 0.1, 0.11, ctx);
  tocarNota(392, 0.08, 0.14, 0.11, ctx);
}

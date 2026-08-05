"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ConfigCalendarioConteudoPage() {
  const [mostrarSubconteudos, setMostrarSubconteudos] = useState(true);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data } = await supabase.from("configuracoes_conteudo").select("mostrar_subconteudos_no_calendario").eq("id", true).maybeSingle();
      setMostrarSubconteudos(data?.mostrar_subconteudos_no_calendario ?? true);
      setLoading(false);
    }
    carregar();
  }, []);

  async function alternar() {
    const novoValor = !mostrarSubconteudos;
    setSalvando(true);
    setMostrarSubconteudos(novoValor);
    const supabase = createClient();
    await supabase.from("configuracoes_conteudo").update({ mostrar_subconteudos_no_calendario: novoValor }).eq("id", true);
    setSalvando(false);
  }

  return (
    <section>
      <p className="text-xs text-ink/50 bg-surface rounded-full px-4 py-2 inline-flex items-center gap-1.5 w-fit mb-6">
        💡 Essas opções valem pra todo mundo que usa o sistema, não só pra você.
      </p>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : (
        <div className="rounded-3xl bg-card border border-black/5 p-5">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm font-bold text-ink">Mostrar sub-conteúdos no Calendário e Kanban</span>
              <span className="block text-xs text-ink/50 mt-0.5">
                Quando desligado, os sub-conteúdos só aparecem dentro da página do post "pai" — não no quadro principal.
              </span>
            </span>
            <button
              onClick={alternar}
              disabled={salvando}
              className={`shrink-0 relative h-7 w-12 rounded-full transition-colors ${mostrarSubconteudos ? "bg-forest" : "bg-black/15"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                  mostrarSubconteudos ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>
      )}
    </section>
  );
}

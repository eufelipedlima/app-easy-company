"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CompletarPerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: funcionario } = await supabase
        .from("funcionarios")
        .select("id, perfil_completo, papeis ( pessoa_id, pessoas ( id, nome, apelido, foto_url ) )")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const f = funcionario as unknown as {
        id: string;
        perfil_completo: boolean;
        papeis: { pessoa_id: string; pessoas: { id: string; nome: string; apelido: string | null; foto_url: string | null } | null } | null;
      } | null;

      if (!f) {
        router.replace("/inicio");
        return;
      }
      if (f.perfil_completo) {
        router.replace("/inicio");
        return;
      }

      setFuncionarioId(f.id);
      setPessoaId(f.papeis?.pessoas?.id ?? null);
      setNome(f.papeis?.pessoas?.nome ?? "");
      setApelido(f.papeis?.pessoas?.apelido ?? "");
      setFotoUrl(f.papeis?.pessoas?.foto_url ?? null);
      setLoading(false);
    }
    carregar();
  }, [router]);

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !pessoaId) return;
    setEnviandoFoto(true);
    setErro(null);
    const supabase = createClient();
    const extensao = arquivo.name.split(".").pop();
    const caminho = `${pessoaId}-${Date.now()}.${extensao}`;
    const { error: erroUpload } = await supabase.storage.from("perfis").upload(caminho, arquivo, { upsert: true });
    if (erroUpload) {
      setErro(erroUpload.message);
      setEnviandoFoto(false);
      return;
    }
    const { data } = supabase.storage.from("perfis").getPublicUrl(caminho);
    await supabase.from("pessoas").update({ foto_url: data.publicUrl }).eq("id", pessoaId);
    setFotoUrl(data.publicUrl);
    setEnviandoFoto(false);
  }

  async function finalizar(e: React.FormEvent) {
    e.preventDefault();
    if (!apelido.trim()) {
      setErro("Como você quer ser chamado?");
      return;
    }
    if (!fotoUrl) {
      setErro("Sobe uma foto de perfil pra continuar.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();

    if (novaSenha.trim()) {
      if (novaSenha.trim().length < 6) {
        setErro("A senha precisa ter pelo menos 6 caracteres.");
        setSalvando(false);
        return;
      }
      const { error: erroSenha } = await supabase.auth.updateUser({ password: novaSenha.trim() });
      if (erroSenha) {
        setErro(erroSenha.message);
        setSalvando(false);
        return;
      }
    }

    if (pessoaId) await supabase.from("pessoas").update({ apelido: apelido.trim() }).eq("id", pessoaId);
    if (funcionarioId) await supabase.from("funcionarios").update({ perfil_completo: true }).eq("id", funcionarioId);

    router.replace("/inicio");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface/40">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-mint/30 via-white to-white px-6">
      <div className="w-full max-w-md rounded-3xl bg-white border border-black/5 shadow-xl p-8">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Bem-vindo(a), {nome.split(" ")[0]}! 👋</h1>
        <p className="text-sm text-ink/50 mb-6">Só mais um passinho antes de começar — finaliza seu cadastro.</p>

        <form onSubmit={finalizar} className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              className="relative h-24 w-24 rounded-full overflow-hidden bg-surface border-2 border-dashed border-black/15 flex items-center justify-center hover:border-forest transition-colors"
            >
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="Sua foto" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl text-ink/20">📷</span>
              )}
              {enviandoFoto && <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">...</span>}
            </button>
            <input ref={inputFotoRef} type="file" accept="image/*" onChange={enviarFoto} className="hidden" />
            <button type="button" onClick={() => inputFotoRef.current?.click()} className="text-xs font-semibold text-forest hover:text-ink">
              {fotoUrl ? "Trocar foto" : "Adicionar foto de perfil *"}
            </button>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Como você quer ser chamado(a)? *</span>
            <input value={apelido} onChange={(e) => setApelido(e.target.value)} className="input" placeholder="Ex: Fred" autoFocus />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-ink/70 mb-1">Defina uma senha nova (opcional)</span>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="input"
              placeholder="Deixe em branco pra manter a atual"
            />
          </label>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-full bg-ink text-white px-6 py-3 text-sm font-bold hover:bg-forest transition-colors disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Concluir e entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

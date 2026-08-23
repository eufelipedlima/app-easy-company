"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CORES_AVATAR = [
  "bg-red-400", "bg-orange-400", "bg-amber-500", "bg-lime-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
];
function corAvatar(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % CORES_AVATAR.length;
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function MeuPerfilPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-6 py-10" />}>
      <MeuPerfilConteudo />
    </Suspense>
  );
}

function MeuPerfilConteudo() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [cargo, setCargo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [senhaAberta, setSenhaAberta] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [sucessoSenha, setSucessoSenha] = useState(false);

  const [conexaoGoogle, setConexaoGoogle] = useState<
    { googleEmail: string | null; escolhaPendente: boolean; ultimaSincronizacao: string | null } | null | undefined
  >(undefined);
  const [conectandoGoogle, setConectandoGoogle] = useState(false);
  const [mensagemGoogle, setMensagemGoogle] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSincronizacao, setResultadoSincronizacao] = useState<string | null>(null);

  const [escolhendoAgenda, setEscolhendoAgenda] = useState(false);
  const [carregandoAgendas, setCarregandoAgendas] = useState(false);
  const [agendasGoogle, setAgendasGoogle] = useState<{ id: string; nome: string; principal: boolean }[]>([]);
  const [modoAgenda, setModoAgenda] = useState<"nova" | "existente">("nova");
  const [nomeAgendaNova, setNomeAgendaNova] = useState("");
  const [agendaEscolhidaId, setAgendaEscolhidaId] = useState("");
  const [salvandoEscolhaAgenda, setSalvandoEscolhaAgenda] = useState(false);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");

      const { data: funcData } = await supabase
        .from("funcionarios")
        .select("id, cargo, cargo_id, cargos ( nome ), papeis ( pessoa_id, pessoas ( id, nome, apelido, whatsapp, foto_url ) )")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const funcionario = funcData as unknown as {
        id: string;
        cargo: string | null;
        cargos: { nome: string } | null;
        papeis: {
          pessoa_id: string;
          pessoas: { id: string; nome: string; apelido: string | null; whatsapp: string | null; foto_url: string | null } | null;
        } | null;
      } | null;

      setCargo(funcionario?.cargos?.nome ?? funcionario?.cargo ?? null);
      setPessoaId(funcionario?.papeis?.pessoas?.id ?? null);
      setFuncionarioId(funcionario?.id ?? null);
      setNome(funcionario?.papeis?.pessoas?.nome ?? "");
      setApelido(funcionario?.papeis?.pessoas?.apelido ?? "");
      setWhatsapp(funcionario?.papeis?.pessoas?.whatsapp ?? null);
      setFotoUrl(funcionario?.papeis?.pessoas?.foto_url ?? null);

      if (funcionario?.id) {
        const { data: conexao } = await supabase
          .from("funcionarios_google_calendar")
          .select("google_email, escolha_pendente, ultima_sincronizacao")
          .eq("funcionario_id", funcionario.id)
          .maybeSingle();
        setConexaoGoogle(
          conexao
            ? { googleEmail: conexao.google_email, escolhaPendente: conexao.escolha_pendente, ultimaSincronizacao: conexao.ultima_sincronizacao }
            : null
        );
      } else {
        setConexaoGoogle(null);
      }

      setLoading(false);
    }
    carregar();
  }, []);

  useEffect(() => {
    const status = searchParams.get("google");
    if (!status) return;
    if (status === "escolher_agenda") {
      setEscolhendoAgenda(true);
      carregarAgendasGoogle();
      router.replace("/perfil");
      return;
    }
    const mensagens: Record<string, string> = {
      conectado: "Google Calendar conectado!",
      cancelado: "Conexão cancelada.",
      erro: "Não deu pra conectar com o Google. Tenta de novo.",
      erro_calendario: "Conectou, mas não deu pra criar o calendário no Google. Tenta de novo.",
      sem_refresh_token: "O Google não devolveu a permissão esperada. Tenta desconectar e conectar de novo.",
      nao_configurado: "A integração com Google ainda não foi configurada no sistema.",
      sem_funcionario: "Sua conta ainda não está vinculada a um cadastro de Funcionário.",
    };
    setMensagemGoogle(mensagens[status] ?? null);
    router.replace("/perfil");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function carregarAgendasGoogle() {
    setCarregandoAgendas(true);
    try {
      const resp = await fetch("/api/google/calendarios");
      const data = await resp.json();
      setAgendasGoogle(data.calendarios ?? []);
    } finally {
      setCarregandoAgendas(false);
    }
  }

  async function confirmarEscolhaAgenda() {
    setSalvandoEscolhaAgenda(true);
    const resp = await fetch("/api/google/finalizar-conexao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        modoAgenda === "nova" ? { modo: "nova", nomeAgendaNova: nomeAgendaNova || undefined } : { modo: "existente", calendarId: agendaEscolhidaId }
      ),
    });
    setSalvandoEscolhaAgenda(false);
    if (!resp.ok) {
      const data = await resp.json();
      setMensagemGoogle(data.error ?? "Não deu pra concluir a conexão.");
      return;
    }
    setEscolhendoAgenda(false);
    setMensagemGoogle("Google Calendar conectado! Sua agenda já vai começar a se atualizar sozinha em alguns minutos.");
    // recarrega o status da conexão
    const supabase = createClient();
    if (funcionarioId) {
      const { data: conexao } = await supabase
        .from("funcionarios_google_calendar")
        .select("google_email, escolha_pendente, ultima_sincronizacao")
        .eq("funcionario_id", funcionarioId)
        .maybeSingle();
      setConexaoGoogle(
        conexao
          ? { googleEmail: conexao.google_email, escolhaPendente: conexao.escolha_pendente, ultimaSincronizacao: conexao.ultima_sincronizacao }
          : null
      );
    }
  }

  async function sincronizarAgora() {
    setSincronizando(true);
    setResultadoSincronizacao(null);
    const resp = await fetch("/api/google/sincronizar", { method: "POST" });
    const data = await resp.json();
    setSincronizando(false);
    if (!resp.ok) {
      setResultadoSincronizacao(data.error ?? "Não deu pra sincronizar.");
      return;
    }
    setResultadoSincronizacao(
      `Pronto: ${data.criados ?? 0} criado(s), ${data.atualizados ?? 0} atualizado(s), ${data.removidos ?? 0} removido(s).`
    );
    setConexaoGoogle((atual) => (atual ? { ...atual, ultimaSincronizacao: new Date().toISOString() } : atual));
  }

  async function desconectarGoogle() {
    if (!window.confirm("Desconectar sua conta do Google? O calendário de pauta continua existindo na sua agenda, só para de ser atualizado.")) return;
    setConectandoGoogle(true);
    await fetch("/api/google/desconectar", { method: "POST" });
    setConexaoGoogle(null);
    setConectandoGoogle(false);
  }

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

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pessoaId) return;
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    const supabase = createClient();
    const { error } = await supabase.from("pessoas").update({ apelido: apelido.trim() || null }).eq("id", pessoaId);
    setSalvando(false);
    if (error) {
      setErro(error.message);
    } else {
      setSucesso(true);
    }
  }

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha(null);
    setSucessoSenha(false);
    if (novaSenha.length < 6) {
      setErroSenha("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErroSenha("As senhas não coincidem.");
      return;
    }
    setSalvandoSenha(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSalvandoSenha(false);
    if (error) {
      setErroSenha(error.message);
    } else {
      setSucessoSenha(true);
      setNovaSenha("");
      setConfirmarSenha("");
    }
  }

  const nomeExibicao = apelido || nome;

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-6 py-10">
        <p className="text-sm text-ink/50">Carregando...</p>
      </main>
    );
  }

  if (!pessoaId) {
    return (
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="text-2xl font-extrabold text-ink mb-2">Meu perfil</h1>
        <p className="text-sm text-ink/60">
          Você ainda não tem um cadastro de Funcionário vinculado à sua conta. Peça pra alguém com
          acesso de Administrador te cadastrar em Pessoas → Funcionários.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-2xl font-extrabold text-ink mb-1">Meu perfil</h1>
      <p className="text-sm text-ink/60 mb-8">Como você aparece pro resto da equipe no Chat e nas tarefas.</p>

      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt={nomeExibicao} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className={`h-20 w-20 rounded-full ${corAvatar(nomeExibicao || "?")} text-white flex items-center justify-center text-xl font-bold`}>
              {iniciais(nomeExibicao || "?")}
            </div>
          )}
        </div>
        <div>
          <input ref={inputFotoRef} type="file" accept="image/*" onChange={enviarFoto} className="hidden" />
          <button
            onClick={() => inputFotoRef.current?.click()}
            disabled={enviandoFoto}
            className="rounded-full border-2 border-black/10 px-4 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            {enviandoFoto ? "Enviando..." : "Trocar foto"}
          </button>
        </div>
      </div>

      <form onSubmit={salvar} className="space-y-4">
        <div className="rounded-2xl bg-card border border-black/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink/50">Nome completo</span>
            <span className="text-sm font-semibold text-ink">{nome}</span>
          </div>
          {cargo && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink/50">Cargo</span>
              <span className="text-sm font-semibold text-ink">{cargo}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink/50">E-mail de login</span>
            <span className="text-sm font-semibold text-ink">{email}</span>
          </div>
          {whatsapp && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink/50">Telefone</span>
              <span className="text-sm font-semibold text-ink">{whatsapp}</span>
            </div>
          )}
          <p className="text-xs text-ink/40 pt-1 border-t border-black/5">
            Nome, cargo, e-mail e telefone são editados em Pessoas → Funcionários.
          </p>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-ink/70 mb-1">Como você quer ser chamado?</span>
          <input
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            className="input"
            placeholder={nome || "Ex: Felipe, Bia..."}
          />
          <span className="block text-xs text-ink/40 mt-1">
            Esse é o nome que aparece no Chat e nas tarefas. Deixe em branco pra usar seu nome completo.
          </span>
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {sucesso && <p className="text-sm text-forest font-semibold">Salvo!</p>}

        <button
          type="submit"
          disabled={salvando}
          className="rounded-full bg-ink text-white px-6 py-2.5 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-black/5">
        <p className="text-sm font-bold text-ink mb-1">Google Calendar</p>
        <p className="text-xs text-ink/50 mb-3">
          Conecte sua conta Google pra ver suas tarefas e conteúdos com prazo direto na sua agenda.
        </p>
        {mensagemGoogle && <p className="text-xs font-semibold text-ink/70 bg-surface rounded-xl px-3 py-2 mb-3">{mensagemGoogle}</p>}

        {escolhendoAgenda ? (
          <div className="rounded-2xl bg-card border border-black/5 p-4 space-y-3">
            <p className="text-sm font-bold text-ink">Onde você quer ver suas tarefas?</p>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="radio" checked={modoAgenda === "nova"} onChange={() => setModoAgenda("nova")} className="mt-1 accent-forest" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">Criar uma agenda nova, só pra isso</span>
                {modoAgenda === "nova" && (
                  <input
                    value={nomeAgendaNova}
                    onChange={(e) => setNomeAgendaNova(e.target.value)}
                    placeholder="Nome da agenda (opcional)"
                    className="input text-sm mt-1.5"
                  />
                )}
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="radio" checked={modoAgenda === "existente"} onChange={() => setModoAgenda("existente")} className="mt-1 accent-forest" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">Usar uma agenda que eu já tenho</span>
                {modoAgenda === "existente" &&
                  (carregandoAgendas ? (
                    <p className="text-xs text-ink/40 mt-1.5">Carregando suas agendas...</p>
                  ) : (
                    <select value={agendaEscolhidaId} onChange={(e) => setAgendaEscolhidaId(e.target.value)} className="input text-sm mt-1.5">
                      <option value="">Selecione...</option>
                      {agendasGoogle.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome}
                          {a.principal ? " (principal)" : ""}
                        </option>
                      ))}
                    </select>
                  ))}
              </span>
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={confirmarEscolhaAgenda}
                disabled={salvandoEscolhaAgenda || (modoAgenda === "existente" && !agendaEscolhidaId)}
                className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
              >
                {salvandoEscolhaAgenda ? "Confirmando..." : "Confirmar"}
              </button>
              <button onClick={() => setEscolhendoAgenda(false)} className="text-sm font-semibold text-ink/50 hover:text-ink">
                Cancelar
              </button>
            </div>
          </div>
        ) : conexaoGoogle === undefined ? (
          <p className="text-xs text-ink/40">Carregando...</p>
        ) : conexaoGoogle ? (
          <div className="rounded-2xl bg-card border border-black/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">✓ Conectado</p>
                {conexaoGoogle.googleEmail && <p className="text-xs text-ink/50">{conexaoGoogle.googleEmail}</p>}
              </div>
              <button
                onClick={desconectarGoogle}
                disabled={conectandoGoogle}
                className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                {conectandoGoogle ? "Desconectando..." : "Desconectar"}
              </button>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5">
              <p className="text-[11px] text-ink/40">
                {conexaoGoogle.ultimaSincronizacao
                  ? `Última sincronização: ${new Date(conexaoGoogle.ultimaSincronizacao).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                  : "Ainda não sincronizou — roda sozinho a cada 30min, ou clique para sincronizar agora."}
              </p>
              <button
                onClick={sincronizarAgora}
                disabled={sincronizando}
                className="text-xs font-semibold text-forest hover:underline disabled:opacity-50 shrink-0 ml-2"
              >
                {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
              </button>
            </div>
            {resultadoSincronizacao && <p className="text-[11px] text-ink/50 mt-1.5">{resultadoSincronizacao}</p>}
          </div>
        ) : funcionarioId ? (
          <a
            href="/api/google/connect"
            className="inline-flex items-center gap-2 rounded-full border-2 border-black/10 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            Conectar Google Calendar
          </a>
        ) : (
          <p className="text-xs text-ink/40">
            Você precisa ter um cadastro de Funcionário vinculado antes de conectar o Google Calendar.
          </p>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-black/5">
        {!senhaAberta ? (
          <button onClick={() => setSenhaAberta(true)} className="text-sm font-semibold text-ink/60 hover:text-ink">
            Alterar senha
          </button>
        ) : (
          <form onSubmit={alterarSenha} className="space-y-3">
            <p className="text-sm font-bold text-ink">Alterar senha</p>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="input"
              placeholder="Nova senha (mín. 6 caracteres)"
            />
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="input"
              placeholder="Confirmar nova senha"
            />
            {erroSenha && <p className="text-sm text-red-600">{erroSenha}</p>}
            {sucessoSenha && <p className="text-sm text-forest font-semibold">Senha alterada!</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={salvandoSenha}
                className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
              >
                {salvandoSenha ? "Salvando..." : "Salvar nova senha"}
              </button>
              <button type="button" onClick={() => setSenhaAberta(false)} className="text-sm font-semibold text-ink/60 hover:text-ink">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

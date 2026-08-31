"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { corDoStatus } from "@/lib/status-conteudo";
import { corDoCliente } from "@/lib/cor-cliente";
import { IconeTarefa } from "@/components/icones-tarefa";
import { ListTree } from "lucide-react";
import { BuscaCliente } from "@/components/busca-cliente";
import { EsqueletoLinha } from "@/components/esqueleto";

interface Responsavel {
  id: string;
  nome: string;
  fotoUrl: string | null;
  authUserId: string | null;
}

interface Opcao {
  id: string;
  nome: string;
}

interface ItemPauta {
  id: string;
  titulo: string;
  tipo: "tarefa";
  statusNome: string;
  statusCor: string;
  dataExibicao: string;
  dataInicio: string | null;
  dataFim: string | null;
  link: string;
  responsavelIds: string[];
  temDescricao: boolean;
  qtdSubitens: number;
  clienteNome: string | null;
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toISODateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatarDataCurta(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function diffDias(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T00:00:00");
  const b = new Date(isoB + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function somarDias(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISODateLocal(d);
}

interface EstadoArraste {
  itemId: string;
  modo: "mover" | "inicio" | "fim";
  diaAncora: string;
  inicioOriginal: string;
  fimOriginal: string;
}

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
function Avatar({ nome, fotoUrl, tamanho = 26 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome} className="rounded-full object-cover shrink-0" style={{ height: tamanho, width: tamanho }} />;
  }
  return (
    <div
      className={`rounded-full ${corAvatar(nome)} text-white flex items-center justify-center font-bold shrink-0`}
      style={{ height: tamanho, width: tamanho, fontSize: Math.max(9, tamanho * 0.36) }}
    >
      {iniciais(nome)}
    </div>
  );
}

function AvatarStack({ pessoas, tamanho = 16 }: { pessoas: Responsavel[]; tamanho?: number }) {
  if (pessoas.length === 0) return null;
  const visiveis = pessoas.slice(0, 3);
  const resto = pessoas.length - visiveis.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visiveis.map((p) => (
        <Avatar key={p.id} nome={p.nome} fotoUrl={p.fotoUrl} tamanho={tamanho} />
      ))}
      {resto > 0 && (
        <div
          className="rounded-full bg-surface ring-1 ring-white text-ink/60 font-bold flex items-center justify-center shrink-0"
          style={{ height: tamanho, width: tamanho, fontSize: Math.max(7, tamanho * 0.32) }}
        >
          +{resto}
        </div>
      )}
    </div>
  );
}

function BlocoSemanaPessoa({
  dias,
  pessoaId,
  visualizacao,
  mes,
  hojeISO,
  calcularFaixas,
  itensPorPessoaEDia,
  idsEmFaixa,
  funcionarios,
  onAbrirItem,
  onNovaTarefa,
  onIniciarArraste,
  itemArrastandoId,
  diaAlvoArraste,
}: {
  dias: Date[];
  pessoaId: string;
  visualizacao: "semana" | "mes";
  mes: number;
  hojeISO: string;
  calcularFaixas: (dias: Date[], pessoaId: string) => { faixas: { item: ItemPauta; colStart: number; colSpan: number; lane: number }[]; qtdLanes: number };
  itensPorPessoaEDia: Map<string, ItemPauta[]>;
  idsEmFaixa: Set<string>;
  funcionarios: Responsavel[];
  onAbrirItem: (link: string) => void;
  onNovaTarefa: (dataISO: string, pessoaId: string) => void;
  onIniciarArraste: (e: React.MouseEvent, item: ItemPauta, modo: "mover" | "inicio" | "fim") => void;
  itemArrastandoId: string | null;
  diaAlvoArraste: string | null;
}) {
  function toISO(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const { faixas, qtdLanes } = calcularFaixas(dias, pessoaId);
  const linhasGrid = `auto ${qtdLanes > 0 ? `repeat(${qtdLanes}, auto) ` : ""}minmax(0, 1fr)`;
  const compacto = visualizacao === "mes";
  const diasISO = dias.map(toISO);

  return (
    <div className="grid grid-cols-7" style={{ gridTemplateRows: linhasGrid }} data-semana-grid data-dias={JSON.stringify(diasISO)}>
      {dias.map((dia, i) => {
        const iso = toISO(dia);
        const doMesAtivo = visualizacao === "semana" || dia.getMonth() === mes;
        const ehAlvo = diaAlvoArraste === iso;
        const corFundo = ehAlvo ? "bg-forest/10" : iso === hojeISO ? "bg-mint/20" : !doMesAtivo ? "bg-surface/40" : "";
        return (
          <div
            key={`cab-${iso}`}
            style={{ gridColumn: i + 1, gridRow: 1 }}
            className={`p-2 pb-1.5 group/cel transition-colors ${corFundo} ${i > 0 ? "border-l border-black/5" : ""} ${
              ehAlvo ? "ring-2 ring-inset ring-forest/40" : ""
            }`}
          >
            <div className="flex items-center justify-between px-0.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide ${
                  iso === hojeISO ? "text-forest" : doMesAtivo ? "text-ink/40" : "text-ink/20"
                }`}
              >
                {visualizacao === "semana" ? `${DIAS_SEMANA[dia.getDay()].slice(0, 3)} ${dia.getDate()}` : dia.getDate()}
              </span>
              <button
                onClick={() => onNovaTarefa(iso, pessoaId)}
                className="opacity-0 group-hover/cel:opacity-100 transition-opacity text-ink/30 hover:text-ink text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      {qtdLanes > 0 &&
        faixas.map((fx) => {
          const respItem = fx.item.responsavelIds
            .map((rid) => funcionarios.find((fu) => fu.id === rid))
            .filter((fu): fu is Responsavel => !!fu);
          const arrastandoEsse = itemArrastandoId === fx.item.id;
          if (compacto) {
            return (
              <div
                key={`${fx.item.tipo}-${fx.item.id}`}
                onClick={() => onAbrirItem(fx.item.link)}
                onMouseDown={(e) => onIniciarArraste(e, fx.item, "mover")}
                style={{ gridColumn: `${fx.colStart} / span ${fx.colSpan}`, gridRow: fx.lane + 2 }}
                className={`relative mx-0.5 mb-1 rounded-lg px-1.5 py-1 text-left text-[11px] font-medium truncate overflow-hidden cursor-grab active:cursor-grabbing select-none ${corDoStatus(
                  fx.item.statusCor
                ).cor} ${arrastandoEsse ? "opacity-40" : ""}`}
              >
                <span
                  onMouseDown={(e) => onIniciarArraste(e, fx.item, "inicio")}
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/10"
                />
                <span className="inline-flex items-center gap-1">
                  <IconeTarefa tamanho={12} /> {fx.item.titulo}
                </span>
                <span
                  onMouseDown={(e) => onIniciarArraste(e, fx.item, "fim")}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/10"
                />
              </div>
            );
          }
          return (
            <div
              key={`${fx.item.tipo}-${fx.item.id}`}
              onClick={() => onAbrirItem(fx.item.link)}
              onMouseDown={(e) => onIniciarArraste(e, fx.item, "mover")}
              style={{ gridColumn: `${fx.colStart} / span ${fx.colSpan}`, gridRow: fx.lane + 2 }}
              className={`relative mx-2 mb-1.5 rounded-lg px-2 py-1.5 overflow-hidden cursor-grab active:cursor-grabbing select-none ${corDoStatus(
                fx.item.statusCor
              ).cor} ${arrastandoEsse ? "opacity-40" : ""}`}
            >
              <span
                onMouseDown={(e) => onIniciarArraste(e, fx.item, "inicio")}
                title="Arrastar pra mudar a data de início"
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/15 rounded-l-lg"
              />
              <p className="text-xs font-bold truncate">
                <span className="inline-flex items-center gap-1">
                  <IconeTarefa tamanho={12} /> {fx.item.titulo}
                </span>
              </p>
              {fx.item.clienteNome ? (
                <span
                  className={`inline-block max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold mt-0.5 ${corDoCliente(fx.item.clienteNome).cor}`}
                >
                  {fx.item.clienteNome}
                </span>
              ) : (
                <p className="text-[10px] opacity-40 italic truncate mt-0.5">Tarefa interna</p>
              )}
              {(fx.item.temDescricao || fx.item.qtdSubitens > 0 || respItem.length > 0) && (
                <div className="flex items-center justify-between mt-1">
                  <span className="flex items-center gap-1.5 opacity-60 text-[10px]">
                    {fx.item.temDescricao && <span title="Tem descrição">☰</span>}
                    {fx.item.qtdSubitens > 0 && (
                      <span title="Tem subtarefas" className="inline-flex items-center gap-0.5">
                        <ListTree size={11} /> {fx.item.qtdSubitens}
                      </span>
                    )}
                  </span>
                  <AvatarStack pessoas={respItem} tamanho={16} />
                </div>
              )}
              <span
                onMouseDown={(e) => onIniciarArraste(e, fx.item, "fim")}
                title="Arrastar pra mudar o prazo"
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/15 rounded-r-lg"
              />
            </div>
          );
        })}

      {dias.map((dia, i) => {
        const iso = toISO(dia);
        const itensCelula = (itensPorPessoaEDia.get(`${pessoaId}|${iso}`) ?? []).filter(
          (it) => !idsEmFaixa.has(`${it.tipo}-${it.id}-${pessoaId}`)
        );
        const doMesAtivo = visualizacao === "semana" || dia.getMonth() === mes;
        const ehAlvo = diaAlvoArraste === iso;
        const corFundo = ehAlvo ? "bg-forest/10" : iso === hojeISO ? "bg-mint/20" : !doMesAtivo ? "bg-surface/40" : "";
        return (
          <div
            key={`itens-${iso}`}
            style={{ gridColumn: i + 1, gridRow: qtdLanes + 2 }}
            className={`p-2 pt-0.5 transition-colors ${corFundo} ${i > 0 ? "border-l border-black/5" : ""} ${
              ehAlvo ? "ring-2 ring-inset ring-forest/40" : ""
            }`}
          >
            <div className="space-y-1">
              {itensCelula.slice(0, compacto ? 3 : undefined).map((item) => {
                const respItem = item.responsavelIds
                  .map((rid) => funcionarios.find((fu) => fu.id === rid))
                  .filter((fu): fu is Responsavel => !!fu);
                const arrastandoEsse = itemArrastandoId === item.id;
                if (compacto) {
                  return (
                    <div
                      key={`${item.tipo}-${item.id}`}
                      onClick={() => onAbrirItem(item.link)}
                      onMouseDown={(e) => onIniciarArraste(e, item, "mover")}
                      className={`w-full text-left rounded-lg px-1.5 py-1 text-[11px] font-medium truncate cursor-grab active:cursor-grabbing select-none ${corDoStatus(
                        item.statusCor
                      ).cor} ${arrastandoEsse ? "opacity-40" : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <IconeTarefa tamanho={12} /> {item.titulo}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={`${item.tipo}-${item.id}`}
                    onClick={() => onAbrirItem(item.link)}
                    onMouseDown={(e) => onIniciarArraste(e, item, "mover")}
                    className={`w-full text-left rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing select-none ${corDoStatus(item.statusCor).cor} ${
                      arrastandoEsse ? "opacity-40" : ""
                    }`}
                  >
                    <p className="text-xs font-bold truncate">
                      <span className="inline-flex items-center gap-1">
                        <IconeTarefa tamanho={12} /> {item.titulo}
                      </span>
                    </p>
                    {item.clienteNome ? (
                      <span
                        className={`inline-block max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold mt-0.5 ${corDoCliente(item.clienteNome).cor}`}
                      >
                        {item.clienteNome}
                      </span>
                    ) : (
                      <p className="text-[10px] opacity-40 italic truncate mt-0.5">Tarefa interna</p>
                    )}
                    {(item.temDescricao || item.qtdSubitens > 0 || respItem.length > 0) && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="flex items-center gap-1.5 opacity-60 text-[10px]">
                          {item.temDescricao && <span title="Tem descrição">☰</span>}
                          {item.qtdSubitens > 0 && (
                            <span title="Tem subtarefas" className="inline-flex items-center gap-0.5">
                              <ListTree size={11} /> {item.qtdSubitens}
                            </span>
                          )}
                        </span>
                        <AvatarStack pessoas={respItem} tamanho={16} />
                      </div>
                    )}
                  </div>
                );
              })}
              {compacto && itensCelula.length > 3 && <p className="text-[10px] text-ink/40 px-1">+{itensCelula.length - 3} mais</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PautaPage() {
  const router = useRouter();
  const [modo, setModoState] = useState<"minha" | "equipe">("minha");
  function setModo(novo: "minha" | "equipe") {
    setModoState(novo);
    if (typeof window !== "undefined") localStorage.setItem("pauta-modo", novo);
  }
  useEffect(() => {
    const salvo = typeof window !== "undefined" ? localStorage.getItem("pauta-modo") : null;
    if (salvo === "minha" || salvo === "equipe") setModoState(salvo);
  }, []);
  const [visualizacao, setVisualizacao] = useState<"semana" | "mes">("semana");
  const [meuFuncionarioId, setMeuFuncionarioId] = useState<string | null>(null);
  const [funcionarios, setFuncionarios] = useState<Responsavel[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [novaTarefaPendente, setNovaTarefaPendente] = useState<{ dataISO: string; funcionarioId: string | null } | null>(null);
  const [itens, setItens] = useState<ItemPauta[]>([]);
  const [statusList, setStatusList] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------- Arrastar tarefas na pauta (mover / redimensionar) ----------------
  const [arraste, setArraste] = useState<EstadoArraste | null>(null);
  const [diaAlvo, setDiaAlvo] = useState<string | null>(null);
  const diaAlvoRef = useRef<string | null>(null);
  const movimentoRef = useRef(false);
  const suprimirCliqueRef = useRef(false);

  function iniciarArraste(e: React.MouseEvent, item: ItemPauta, modo: "mover" | "inicio" | "fim") {
    e.preventDefault();
    e.stopPropagation();
    const inicioOriginal = item.dataInicio ?? item.dataFim ?? item.dataExibicao;
    const fimOriginal = item.dataFim ?? item.dataInicio ?? item.dataExibicao;
    setArraste({ itemId: item.id, modo, diaAncora: inicioOriginal, inicioOriginal, fimOriginal });
  }

  const confirmarArraste = useCallback(
    async (a: EstadoArraste, diaFinal: string) => {
      let novoInicio = a.inicioOriginal;
      let novoFim = a.fimOriginal;
      if (a.modo === "mover") {
        const delta = diffDias(a.diaAncora, diaFinal);
        novoInicio = somarDias(a.inicioOriginal, delta);
        novoFim = somarDias(a.fimOriginal, delta);
      } else if (a.modo === "inicio") {
        novoInicio = diaFinal > a.fimOriginal ? a.fimOriginal : diaFinal;
      } else {
        novoFim = diaFinal < a.inicioOriginal ? a.inicioOriginal : diaFinal;
      }
      if (novoInicio === a.inicioOriginal && novoFim === a.fimOriginal) return;

      setItens((atual) =>
        atual.map((it) => (it.id === a.itemId ? { ...it, dataInicio: novoInicio, dataFim: novoFim, dataExibicao: novoInicio } : it))
      );

      const supabase = createClient();
      await supabase.from("tarefas").update({ data_inicio: novoInicio, prazo: novoFim }).eq("id", a.itemId);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const descricao =
          a.modo === "mover"
            ? `moveu a tarefa para ${formatarDataCurta(novoInicio)}${novoInicio !== novoFim ? ` – ${formatarDataCurta(novoFim)}` : ""}`
            : a.modo === "inicio"
            ? `mudou a data de início para ${formatarDataCurta(novoInicio)}`
            : `mudou o prazo para ${formatarDataCurta(novoFim)}`;
        await supabase.from("tarefas_historico").insert({ tarefa_id: a.itemId, autor_id: user.id, descricao });
      }
    },
    []
  );

  useEffect(() => {
    if (!arraste) return;
    function onMove(e: MouseEvent) {
      movimentoRef.current = true;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const grid = (el as HTMLElement | null)?.closest("[data-semana-grid]") as HTMLElement | null;
      if (!grid) return;
      const dias: string[] = JSON.parse(grid.dataset.dias || "[]");
      const rect = grid.getBoundingClientRect();
      const idx = Math.min(6, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * 7)));
      diaAlvoRef.current = dias[idx] ?? null;
      setDiaAlvo(dias[idx] ?? null);
    }
    function onUp() {
      if (movimentoRef.current && diaAlvoRef.current && arraste) {
        confirmarArraste(arraste, diaAlvoRef.current);
        suprimirCliqueRef.current = true;
        setTimeout(() => {
          suprimirCliqueRef.current = false;
        }, 80);
      }
      setArraste(null);
      setDiaAlvo(null);
      diaAlvoRef.current = null;
      movimentoRef.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [arraste, confirmarArraste]);

  const hoje = new Date();
  const [inicioSemana, setInicioSemana] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });

  const primeiroDiaMes = new Date(ano, mes, 1);
  const ultimoDiaMes = new Date(ano, mes + 1, 0);
  const inicioGrade = new Date(primeiroDiaMes);
  inicioGrade.setDate(inicioGrade.getDate() - primeiroDiaMes.getDay());
  const fimGrade = new Date(ultimoDiaMes);
  fimGrade.setDate(fimGrade.getDate() + (6 - ultimoDiaMes.getDay()));
  const diasMes: Date[] = [];
  for (let d = new Date(inicioGrade); d <= fimGrade; d.setDate(d.getDate() + 1)) {
    diasMes.push(new Date(d));
  }

  const diasAtivos = visualizacao === "semana" ? diasSemana : diasMes;
  const inicioISO = toISODateLocal(diasAtivos[0]);
  const fimISO = toISODateLocal(diasAtivos[diasAtivos.length - 1]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: statusData }, { data: funcData }, { data: clientesAtivosData }] = await Promise.all([
      supabase.from("status_conteudo").select("id, nome, cor").order("ordem"),
      supabase.from("funcionarios").select("id, auth_user_id, papeis ( pessoas ( nome, apelido, foto_url ) )").not("auth_user_id", "is", null),
      supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )").eq("ativo_central_clientes", true),
    ]);
    setStatusList(statusData ?? []);
    setClientes(
      ((clientesAtivosData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[])
        .map((c) => ({ id: c.id, nome: c.papeis?.pessoas?.nome ?? "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome))
    );
    const listaFunc = ((funcData ?? []) as unknown as {
      id: string;
      auth_user_id: string | null;
      papeis: { pessoas: { nome: string; apelido: string | null; foto_url: string | null } | null } | null;
    }[])
      .map((f) => ({ id: f.id, nome: f.papeis?.pessoas?.apelido || f.papeis?.pessoas?.nome || "Colega", fotoUrl: f.papeis?.pessoas?.foto_url ?? null, authUserId: f.auth_user_id }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setFuncionarios(listaFunc);
    if (user) setMeuFuncionarioId(listaFunc.find((f) => f.authUserId === user.id)?.id ?? null);

    const [{ data: tarefasData }] = await Promise.all([
      supabase
        .from("tarefas")
        .select("id, titulo, data_inicio, prazo, status_id, descricao, cliente_id, status_conteudo ( nome, cor )")
        .is("tarefa_pai_id", null)
        .eq("arquivada", false)
        .is("excluido_em", null),
    ]);

    const tarefasNoPeriodo = ((tarefasData ?? []) as unknown as {
      id: string;
      titulo: string;
      data_inicio: string | null;
      prazo: string | null;
      descricao: string | null;
      cliente_id: string | null;
      status_conteudo: { nome: string; cor: string } | null;
    }[])
      .map((t) => ({ ...t, dataExibicao: t.data_inicio ?? t.prazo }))
      .filter((t) => {
        // Uma tarefa aparece na pauta se o período dela (início até prazo) cruzar
        // com o período visível — não só quando ela COMEÇA dentro dele. Isso é o
        // que fazia uma tarefa que começou numa semana e termina na seguinte
        // sumir da pauta assim que a gente virava a semana.
        const inicio = t.data_inicio ?? t.prazo;
        const fim = t.prazo ?? t.data_inicio;
        return inicio && fim && inicio <= fimISO && fim >= inicioISO;
      });

    const idsTarefas = tarefasNoPeriodo.map((t) => t.id);
    const idsClientes = [...new Set(tarefasNoPeriodo.map((t) => t.cliente_id).filter((id): id is string => !!id))];

    const [{ data: respTarefas }, { data: subtarefasData }, { data: clientesData }] = await Promise.all([
      idsTarefas.length > 0
        ? supabase.from("tarefas_responsaveis").select("tarefa_id, funcionario_id").in("tarefa_id", idsTarefas)
        : Promise.resolve({ data: [] }),
      idsTarefas.length > 0
        ? supabase.from("tarefas").select("tarefa_pai_id").in("tarefa_pai_id", idsTarefas).is("excluido_em", null)
        : Promise.resolve({ data: [] }),
      idsClientes.length > 0
        ? supabase.from("clientes").select("id, papeis ( pessoas ( nome ) )").in("id", idsClientes)
        : Promise.resolve({ data: [] }),
    ]);

    const mapaRespT = new Map<string, string[]>();
    for (const r of respTarefas ?? []) {
      mapaRespT.set(r.tarefa_id, [...(mapaRespT.get(r.tarefa_id) ?? []), r.funcionario_id]);
    }
    const mapaSubT = new Map<string, number>();
    for (const s of subtarefasData ?? []) {
      if (s.tarefa_pai_id) mapaSubT.set(s.tarefa_pai_id, (mapaSubT.get(s.tarefa_pai_id) ?? 0) + 1);
    }
    const mapaClienteNome = new Map<string, string>();
    for (const c of (clientesData ?? []) as unknown as { id: string; papeis: { pessoas: { nome: string } | null } | null }[]) {
      if (c.papeis?.pessoas?.nome) mapaClienteNome.set(c.id, c.papeis.pessoas.nome);
    }

    const itensT: ItemPauta[] = tarefasNoPeriodo.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      tipo: "tarefa",
      statusNome: t.status_conteudo?.nome ?? "—",
      statusCor: t.status_conteudo?.cor ?? "cinza",
      dataExibicao: t.dataExibicao!,
      dataInicio: t.data_inicio,
      dataFim: t.prazo,
      link: `/tarefas/${t.id}?from=pauta`,
      responsavelIds: mapaRespT.get(t.id) ?? [],
      temDescricao: !!t.descricao,
      qtdSubitens: mapaSubT.get(t.id) ?? 0,
      clienteNome: t.cliente_id ? mapaClienteNome.get(t.cliente_id) ?? null : null,
    }));

    setItens(itensT);
    setLoading(false);
  }, [inicioISO, fimISO]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function novaTarefaNoDia(dataISO: string, funcionarioId: string | null, clienteId: string | null) {
    const supabase = createClient();
    const { data: nova } = await supabase
      .from("tarefas")
      .insert({ titulo: "Nova tarefa", data_inicio: dataISO, status_id: statusList[0]?.id, cliente_id: clienteId })
      .select("id")
      .single();
    if (nova) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("tarefas_historico").insert({ tarefa_id: nova.id, autor_id: user.id, descricao: "criou a tarefa" });
      const respId = funcionarioId ?? meuFuncionarioId;
      if (respId) await supabase.from("tarefas_responsaveis").insert({ tarefa_id: nova.id, funcionario_id: respId });
      router.push(`/tarefas/${nova.id}?from=pauta`);
    }
  }

  const itensPorPessoaEDia = new Map<string, ItemPauta[]>();
  for (const item of itens) {
    const ids = item.responsavelIds.length > 0 ? item.responsavelIds : ["_sem"];
    for (const respId of ids) {
      const chave = `${respId}|${item.dataExibicao}`;
      itensPorPessoaEDia.set(chave, [...(itensPorPessoaEDia.get(chave) ?? []), item]);
    }
    // versão mesclada de "toda a equipe" — o item aparece uma vez só no dia,
    // mesmo que tenha vários responsáveis (o avatar de cada um já aparece no card)
    const chaveTodos = `_todos|${item.dataExibicao}`;
    itensPorPessoaEDia.set(chaveTodos, [...(itensPorPessoaEDia.get(chaveTodos) ?? []), item]);
  }

  // Itens com início E vencimento diferentes viram uma barra esticada pelos dias —
  // funciona tanto numa semana isolada quanto em cada semana do mês (o mês é só
  // várias semanas empilhadas, cada uma calcula as barras dela mesma).
  type Faixa = { item: ItemPauta; colStart: number; colSpan: number; lane: number };

  const itensMultiDiaPorPessoa = new Map<string, ItemPauta[]>();
  for (const item of itens) {
    if (!item.dataInicio || !item.dataFim || item.dataInicio === item.dataFim) continue;
    const ids = item.responsavelIds.length > 0 ? item.responsavelIds : ["_sem"];
    for (const respId of ids) {
      itensMultiDiaPorPessoa.set(respId, [...(itensMultiDiaPorPessoa.get(respId) ?? []), item]);
    }
    itensMultiDiaPorPessoa.set("_todos", [...(itensMultiDiaPorPessoa.get("_todos") ?? []), item]);
  }

  const idsEmFaixa = new Set<string>();

  function calcularFaixasSemana(diasDaSemana: Date[], respId: string): { faixas: Faixa[]; qtdLanes: number } {
    const semanaISO = diasDaSemana.map((d) => toISODateLocal(d));
    const itensPessoa = itensMultiDiaPorPessoa.get(respId) ?? [];
    const barras = itensPessoa
      .filter((item) => item.dataInicio! <= semanaISO[6] && item.dataFim! >= semanaISO[0])
      .map((item) => {
        const inicioClip = item.dataInicio! < semanaISO[0] ? semanaISO[0] : item.dataInicio!;
        const fimClip = item.dataFim! > semanaISO[6] ? semanaISO[6] : item.dataFim!;
        const colStart = semanaISO.indexOf(inicioClip) + 1;
        const colFim = semanaISO.indexOf(fimClip) + 1;
        return { item, colStart, colSpan: colFim - colStart + 1 };
      })
      .filter((b) => b.colStart > 0 && b.colSpan > 0)
      .sort((a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan);

    const lanes: { fimCol: number }[] = [];
    const faixas: Faixa[] = barras.map((b) => {
      let lane = lanes.findIndex((l) => l.fimCol < b.colStart);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push({ fimCol: b.colStart + b.colSpan - 1 });
      } else {
        lanes[lane].fimCol = b.colStart + b.colSpan - 1;
      }
      idsEmFaixa.add(`${b.item.tipo}-${b.item.id}-${respId}`);
      return { ...b, lane };
    });
    return { faixas, qtdLanes: lanes.length };
  }

  // Pré-calcula pra marcar quais itens já viram barra (precisa rodar antes da
  // renderização pra saber o que excluir das células de dia único).
  const semanasMes: Date[][] = [];
  for (let i = 0; i < diasMes.length; i += 7) semanasMes.push(diasMes.slice(i, i + 7));
  const blocosDeSemana = visualizacao === "semana" ? [diasSemana] : semanasMes;
  for (const respId of itensMultiDiaPorPessoa.keys()) {
    for (const semana of blocosDeSemana) calcularFaixasSemana(semana, respId);
  }

  const funcionariosExibidos: Responsavel[] =
    modo === "minha"
      ? funcionarios.filter((f) => f.id === meuFuncionarioId)
      : [{ id: "_todos", nome: "Toda a equipe", fotoUrl: null, authUserId: null }];
  const hojeISO = toISODateLocal(hoje);

  return (
    <main className="h-screen flex flex-col bg-surface/30 px-8 py-6">
      <div className="max-w-[1500px] mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/inicio")}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-forest transition-colors"
            >
              ← Início
            </button>
            <h1 className="text-xl font-extrabold text-ink">📋 Pauta</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
              <button
                onClick={() => setModo("minha")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  modo === "minha" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Minha semana
              </button>
              <button
                onClick={() => setModo("equipe")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  modo === "equipe" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Toda a equipe
              </button>
            </div>

            <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1">
              <button
                onClick={() => setVisualizacao("semana")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  visualizacao === "semana" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setVisualizacao("mes")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  visualizacao === "mes" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Mês
              </button>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border-2 border-black/10 pl-1.5 pr-3 py-1">
              <button
                onClick={() => {
                  if (visualizacao === "semana") {
                    const d = new Date(inicioSemana);
                    d.setDate(d.getDate() - 7);
                    setInicioSemana(d);
                  } else {
                    const d = new Date(ano, mes - 1, 1);
                    setMes(d.getMonth());
                    setAno(d.getFullYear());
                  }
                }}
                className="rounded-full h-7 w-7 flex items-center justify-center hover:bg-surface text-ink font-bold"
              >
                ←
              </button>
              <button
                onClick={() => {
                  if (visualizacao === "semana") {
                    const d = new Date();
                    d.setDate(d.getDate() - d.getDay());
                    d.setHours(0, 0, 0, 0);
                    setInicioSemana(d);
                  } else {
                    setMes(hoje.getMonth());
                    setAno(hoje.getFullYear());
                  }
                }}
                className="text-xs font-bold text-ink hover:text-forest px-1"
              >
                Hoje
              </button>
              <button
                onClick={() => {
                  if (visualizacao === "semana") {
                    const d = new Date(inicioSemana);
                    d.setDate(d.getDate() + 7);
                    setInicioSemana(d);
                  } else {
                    const d = new Date(ano, mes + 1, 1);
                    setMes(d.getMonth());
                    setAno(d.getFullYear());
                  }
                }}
                className="rounded-full h-7 w-7 flex items-center justify-center hover:bg-surface text-ink font-bold"
              >
                →
              </button>
              <span className="text-sm font-bold text-ink ml-1">
                {visualizacao === "semana"
                  ? `${formatarDataCurta(inicioISO)} – ${formatarDataCurta(fimISO)}`
                  : `${MESES[mes]} ${ano}`}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white border border-black/5 p-4 space-y-2">
            <EsqueletoLinha className="h-4 w-40" />
            <EsqueletoLinha className="h-24 w-full" />
          </div>
        ) : funcionariosExibidos.length === 0 ? (
          <p className="text-sm text-ink/50">Você ainda não tem cadastro de funcionário vinculado à sua conta.</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pb-2">
            {funcionariosExibidos.map((f) => (
              <div
                key={f.id}
                className={`rounded-3xl bg-white border border-black/5 shadow-sm overflow-hidden flex flex-col ${
                  funcionariosExibidos.length === 1 ? "h-full" : "min-h-[240px]"
                }`}
              >
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-black/5 bg-surface/50 shrink-0">
                  {f.id === "_todos" ? (
                    <span className="h-[26px] w-[26px] rounded-full bg-forest text-white flex items-center justify-center shrink-0 text-xs">👥</span>
                  ) : (
                    <Avatar nome={f.nome} fotoUrl={f.fotoUrl} tamanho={26} />
                  )}
                  <p className="text-sm font-bold text-ink">{f.nome}</p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-black/5">
                  {blocosDeSemana.map((diasDaSemana, idxSemana) => {
                    return (
                      <BlocoSemanaPessoa
                        key={idxSemana}
                        dias={diasDaSemana}
                        pessoaId={f.id}
                        visualizacao={visualizacao}
                        mes={mes}
                        hojeISO={hojeISO}
                        calcularFaixas={calcularFaixasSemana}
                        itensPorPessoaEDia={itensPorPessoaEDia}
                        idsEmFaixa={idsEmFaixa}
                        funcionarios={funcionarios}
                        onAbrirItem={(link) => {
                          if (suprimirCliqueRef.current) return;
                          router.push(link);
                        }}
                        onNovaTarefa={(dataISO, pessoaId) => setNovaTarefaPendente({ dataISO, funcionarioId: pessoaId === "_todos" ? null : pessoaId })}
                        onIniciarArraste={iniciarArraste}
                        itemArrastandoId={arraste?.itemId ?? null}
                        diaAlvoArraste={diaAlvo}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {novaTarefaPendente && (
        <ModalNovaTarefaRapida
          clientes={clientes}
          onClose={() => setNovaTarefaPendente(null)}
          onEscolher={(clienteId) => {
            novaTarefaNoDia(novaTarefaPendente.dataISO, novaTarefaPendente.funcionarioId, clienteId);
            setNovaTarefaPendente(null);
          }}
        />
      )}
    </main>
  );
}

function ModalNovaTarefaRapida({
  clientes,
  onClose,
  onEscolher,
}: {
  clientes: Opcao[];
  onClose: () => void;
  onEscolher: (clienteId: string | null) => void;
}) {
  const [clienteSelecionado, setClienteSelecionado] = useState<Opcao | null>(null);

  return (
    <div className="fixed inset-0 z-30 bg-ink/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink mb-1">Nova tarefa</h2>
        <p className="text-sm text-ink/50 mb-4">De qual cliente é essa tarefa?</p>
        <BuscaCliente clientes={clientes} valor={clienteSelecionado} onSelecionar={setClienteSelecionado} placeholder="Digite pra buscar..." />
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={() => onEscolher(clienteSelecionado?.id ?? null)}
            disabled={!clienteSelecionado}
            className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-40"
          >
            Criar tarefa
          </button>
          <button onClick={() => onEscolher(null)} className="text-sm font-semibold text-ink/50 hover:text-ink">
            É interna (sem cliente)
          </button>
          <button onClick={onClose} className="text-sm font-semibold text-ink/40 hover:text-ink ml-auto">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

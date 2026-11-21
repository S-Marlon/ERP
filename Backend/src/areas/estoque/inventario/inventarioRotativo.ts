// Inventário rotativo: o sistema escolhe os itens do dia (pedido de conferência, sinal de problema, nunca contado, curva
// ABC vencida), sempre de uma área só da loja (áreas montadas pelas categorias), imprime a folha com o saldo à vista e o
// conferente assina; no lançamento a contagem é comparada com o saldo NA HORA em que contou (descontando o que vendeu ou
// entrou depois). Divergência grande pede a senha de autorização. Regras puras, sem banco, com teste.

export class ErroInventario extends Error {
  constructor(message: string, public status = 400, public detalhes?: unknown) { super(message); }
}

export interface ConfigInventario {
  itensPorDia: number;
  /** Diferença (R$, pelo custo) acima disso pede senha. */
  limiteDivergenciaValor: number;
  /** Ou diferença acima deste % do saldo (com valor de pelo menos 20% do limite em R$). */
  limiteDivergenciaPct: number;
  diasCurvaA: number; diasCurvaB: number; diasCurvaC: number;
}
export const CONFIG_PADRAO: ConfigInventario = {
  itensPorDia: 20, limiteDivergenciaValor: 50, limiteDivergenciaPct: 0.2, diasCurvaA: 30, diasCurvaB: 90, diasCurvaC: 180,
};

export const validarConfig = (c: any): ConfigInventario => {
  const inteiro = (v: unknown, min: number, max: number, nome: string) => {
    const n = Math.floor(Number(v));
    if (!(n >= min && n <= max)) throw new ErroInventario(`${nome}: de ${min} a ${max}.`);
    return n;
  };
  const valor = Number(c?.limiteDivergenciaValor);
  if (!(valor >= 0 && valor <= 100000)) throw new ErroInventario('Limite em R$ inválido.');
  const pct = Number(c?.limiteDivergenciaPct);
  if (!(pct >= 0 && pct <= 1)) throw new ErroInventario('Limite em % inválido (0 a 100%).');
  return {
    itensPorDia: inteiro(c?.itensPorDia, 1, 200, 'Itens por lista'),
    limiteDivergenciaValor: Math.round(valor * 100) / 100, limiteDivergenciaPct: Math.round(pct * 10000) / 10000,
    diasCurvaA: inteiro(c?.diasCurvaA, 1, 730, 'Dias da curva A'), diasCurvaB: inteiro(c?.diasCurvaB, 1, 730, 'Dias da curva B'),
    diasCurvaC: inteiro(c?.diasCurvaC, 1, 730, 'Dias da curva C'),
  };
};

/** Área da categoria: a dela ou a da categoria de cima mais próxima que tiver área. */
export const areaDaCategoria = (categoriaId: number | null, pais: Map<number, number | null>, mapa: Map<number, number>): number | null => {
  const vistos = new Set<number>();
  let atual = categoriaId;
  while (atual !== null && atual !== undefined && !vistos.has(atual)) {
    if (mapa.has(atual)) return mapa.get(atual)!;
    vistos.add(atual);
    atual = pais.get(atual) ?? null;
  }
  return null;
};

/** Categoria do topo (para agrupar o que não tem área sem misturar a loja). */
export const categoriaDoTopo = (categoriaId: number | null, pais: Map<number, number | null>): number | null => {
  const vistos = new Set<number>();
  let atual = categoriaId;
  while (atual !== null && atual !== undefined && !vistos.has(atual)) {
    vistos.add(atual);
    const pai = pais.get(atual) ?? null;
    if (pai === null) return atual;
    atual = pai;
  }
  return categoriaId;
};

export type Curva = 'A' | 'B' | 'C';  // classe de venda (Estoque › Curva ABC)

export const diasEntre = (de: string, ate: string) =>
  Math.round((new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / 86400000);

export type Motivo = 'PEDIDO' | 'PROBLEMA' | 'NUNCA_CONTADO' | 'CURVA_A' | 'CURVA_B' | 'CURVA_C';

export interface Candidato {
  idItem: number; grupo: string; nome: string; categoria: string | null; curva: Curva;
  saldo: number; custoMedio: number; custoGerencial: number; ultimoCusto: number;
  ultimaContagem: string | null; pedidaEm: string | null; pedidoMotivo: string | null;
}
export interface Selecao { motivo: Motivo; detalhe: string | null; peso: number }

/** Por que o item deve ser conferido hoje (null = não está na hora). Quanto maior o peso, antes entra. */
export const motivoDoItem = (c: Candidato, hoje: string, cfg: ConfigInventario): Selecao | null => {
  if (c.pedidaEm) return { motivo: 'PEDIDO', detalhe: c.pedidoMotivo || 'conferência pedida', peso: 1000 + diasEntre(c.pedidaEm, hoje) };
  if (c.saldo < 0) return { motivo: 'PROBLEMA', detalhe: `saldo negativo (${c.saldo})`, peso: 800 };
  const referencia = c.custoGerencial > 0 ? c.custoGerencial : c.custoMedio;
  if (c.ultimoCusto > 0 && referencia > 0) {
    const vezes = Math.max(c.ultimoCusto / referencia, referencia / c.ultimoCusto);
    if (vezes > 3 && (!c.ultimaContagem || c.ultimaContagem < hoje)) {
      return { motivo: 'PROBLEMA', detalhe: `último custo ${vezes.toFixed(0)}x fora do custo do item (conversão?)`, peso: 700 };
    }
  }
  const pesoCurva = { A: 3, B: 2, C: 1 }[c.curva];
  if (!c.ultimaContagem) return { motivo: 'NUNCA_CONTADO', detalhe: `curva ${c.curva}`, peso: 100 * pesoCurva };
  const prazo = { A: cfg.diasCurvaA, B: cfg.diasCurvaB, C: cfg.diasCurvaC }[c.curva];
  const passados = diasEntre(c.ultimaContagem, hoje);
  if (passados >= prazo) return { motivo: `CURVA_${c.curva}` as Motivo, detalhe: `contado há ${passados} dias`, peso: 50 * pesoCurva + Math.min(49, passados - prazo) };
  return null;
};

/**
 * Lista do dia: um grupo só (área da loja). Sem grupo escolhido, vai o que tem o item mais urgente (empate: o que tem
 * mais itens devidos). Dentro da lista: os mais urgentes até o limite, depois em ordem de categoria e nome (percurso).
 */
export const escolherLista = (
  candidatos: Array<Candidato & Selecao>, limite: number, grupo?: string | null,
): { grupo: string | null; itens: Array<Candidato & Selecao> } => {
  const porGrupo = new Map<string, Array<Candidato & Selecao>>();
  for (const c of candidatos) {
    if (!porGrupo.has(c.grupo)) porGrupo.set(c.grupo, []);
    porGrupo.get(c.grupo)!.push(c);
  }
  let escolhido = grupo ?? null;
  if (!escolhido) {
    const ranking = [...porGrupo.entries()].map(([g, l]) => ({ g, max: Math.max(...l.map(x => x.peso)), n: l.length }))
      .sort((a, b) => b.max - a.max || b.n - a.n || a.g.localeCompare(b.g));
    escolhido = ranking[0]?.g ?? null;
  }
  const lista = [...(escolhido ? porGrupo.get(escolhido) || [] : [])]
    .sort((a, b) => b.peso - a.peso || a.idItem - b.idItem).slice(0, Math.max(1, limite))
    .sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || a.nome.localeCompare(b.nome));
  return { grupo: lista.length ? escolhido : null, itens: lista };
};

/** Saldo na hora da contagem: o de agora menos o que entrou e mais o que saiu depois dela. */
export const saldoNaHora = (saldoAgora: number, liquidoDepois: number) => Math.round((saldoAgora - liquidoDepois) * 10000) / 10000;

/** Diferença da contagem e se pede senha: acima do limite em R$, ou acima do % com valor de pelo menos 20% do limite. */
export const avaliarDivergencia = (contado: number, saldoNaContagem: number, custoUnitario: number, cfg: ConfigInventario) => {
  const diferenca = Math.round((contado - saldoNaContagem) * 10000) / 10000;
  const valor = Math.round(Math.abs(diferenca) * Math.max(0, custoUnitario) * 100) / 100;
  const pct = saldoNaContagem > 0 ? Math.abs(diferenca) / saldoNaContagem : diferenca !== 0 ? 1 : 0;
  const exigeSenha = diferenca !== 0 && (valor > cfg.limiteDivergenciaValor || (pct > cfg.limiteDivergenciaPct && valor > cfg.limiteDivergenciaValor * 0.2));
  return { diferenca, valor, pct, exigeSenha };
};

export const ROTULO_MOTIVO: Record<Motivo, string> = {
  PEDIDO: 'Pedido de conferência', PROBLEMA: 'Sinal de problema', NUNCA_CONTADO: 'Nunca contado',
  CURVA_A: 'Curva A', CURVA_B: 'Curva B', CURVA_C: 'Curva C',
};

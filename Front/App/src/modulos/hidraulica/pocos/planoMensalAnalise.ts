// Plano mensal › "Análise por cliente": o plano de cada cliente (o sugerido dele, ou um plano escolhido para todos), e o
// que a carteira daria por mês se todos assinassem — receita, lucro esperado e a faixa (pessimista a otimista), quantos
// em cada nível de risco e quantos com a distância estimada (sem GPS). Puro, com teste.
import type { ClienteAnalisado, PlanoSimulado } from './obrasApi';

export type EscolhaPlano = 'SUGERIDO' | string;
export interface LinhaAnalise { cliente: ClienteAnalisado; plano: PlanoSimulado | null }

const r2 = (v: number) => Math.round(v * 100) / 100;

/** O plano de cada cliente: o sugerido (sem sugerido viável, o mais barato) ou o escolhido pelo nome. */
export const planoDoCliente = (c: ClienteAnalisado, escolha: EscolhaPlano): PlanoSimulado | null => {
  if (escolha !== 'SUGERIDO') return c.planos.find(p => p.nome === escolha) || null;
  return c.planos.find(p => p.nome === c.sugerido) || [...c.planos].sort((a, b) => a.preco.precoMensal - b.preco.precoMensal)[0] || null;
};

export const analisarCarteira = (clientes: ClienteAnalisado[], escolha: EscolhaPlano) => {
  const linhas: LinhaAnalise[] = clientes.map(cliente => ({ cliente, plano: planoDoCliente(cliente, escolha) }));
  const com = linhas.filter(l => l.plano) as Array<{ cliente: ClienteAnalisado; plano: PlanoSimulado }>;
  const soma = (f: (p: PlanoSimulado) => number) => r2(com.reduce((s, l) => s + f(l.plano), 0));
  const receita = soma(p => p.risco.preco);
  const lucro = soma(p => p.risco.esperado.lucroMensal);
  return {
    linhas,
    totais: {
      clientes: com.length, receita, lucro,
      pessimista: soma(p => p.risco.pessimista.lucroMensal), otimista: soma(p => p.risco.otimista.lucroMensal),
      margem: receita > 0 ? Math.round((lucro / receita) * 1000) / 1000 : null,
      alto: com.filter(l => l.plano.risco.nivel === 'ALTO').length, medio: com.filter(l => l.plano.risco.nivel === 'MEDIO').length,
      baixo: com.filter(l => l.plano.risco.nivel === 'BAIXO').length,
      semGps: com.filter(l => l.cliente.kmOrigem === 'MEDIA').length,
      /** Lucro esperado sem os de risco alto (o que dá para contar com mais segurança). */
      lucroSemAlto: r2(com.filter(l => l.plano.risco.nivel !== 'ALTO').reduce((s, l) => s + l.plano.risco.esperado.lucroMensal, 0)),
    },
  };
};

/**
 * Planejamento da carteira: a meta (assinantes e receita, o ticket médio que ela pede), a capacidade da equipe (idas
 * esperadas por mês × serviços por semana) e a equipe dedicada — o que sobra para pagar a mão de obra (lucro esperado
 * + a mão de obra já no custo) contra o custo de uma equipe só para os planos, e quantos assinantes ela pede.
 */
export const planejamentoCarteira = (
  linhas: LinhaAnalise[],
  c: { metaAssinantes: number; metaReceita: number; capacidadeSemana: number; custoEquipeDedicada: number },
) => {
  const com = linhas.filter(l => l.plano) as Array<{ cliente: ClienteAnalisado; plano: PlanoSimulado }>;
  const n = com.length;
  const receita = r2(com.reduce((s, l) => s + l.plano.risco.preco, 0));
  const atendimentosMes = r2(com.reduce((s, l) => s + l.plano.preco.atendimentosAno, 0) / 12);
  const capacidadeMes = r2((c.capacidadeSemana * 52) / 12);
  // com equipe própria, a mão de obra deixa de ser custo de cada plano: o que sobra para ela é o lucro + a mão de obra
  const paraEquipe = r2(com.reduce((s, l) => s + l.plano.risco.esperado.lucroMensal + l.plano.preco.maoDeObraMensal, 0));
  const porAssinante = n ? paraEquipe / n : 0;
  return {
    meta: {
      assinantes: c.metaAssinantes, receita: c.metaReceita,
      ticketPedido: c.metaAssinantes > 0 ? r2(c.metaReceita / c.metaAssinantes) : null,
      ticketMedio: n ? r2(receita / n) : null,
      /** Com o ticket médio de hoje, quantos assinantes a meta de receita pede. */
      assinantesParaReceita: n && receita > 0 ? Math.ceil(c.metaReceita / (receita / n)) : null,
    },
    capacidade: { atendimentosMes, capacidadeMes, uso: capacidadeMes > 0 ? Math.round((atendimentosMes / capacidadeMes) * 1000) / 1000 : null },
    equipe: {
      custo: c.custoEquipeDedicada, paraEquipe,
      cobre: c.custoEquipeDedicada > 0 ? paraEquipe >= c.custoEquipeDedicada : null,
      assinantesNecessarios: c.custoEquipeDedicada > 0 && porAssinante > 0 ? Math.ceil(c.custoEquipeDedicada / porAssinante) : null,
    },
  };
};

/** Fatias do preço mensal no visor dos custos: cada tipo de custo, os impostos/taxas e o lucro (cor e rótulo fixos). */
export const FATIAS: Record<string, { rotulo: string; cor: string }> = {
  PREVENTIVA: { rotulo: 'Preventivas', cor: '#4096ff' }, CHAMADOS: { rotulo: 'Chamados', cor: '#fa8c16' }, LIMPEZA: { rotulo: 'Limpeza', cor: '#13c2c2' },
  MONITORAMENTO: { rotulo: 'Monitoramento', cor: '#722ed1' }, BOMBA: { rotulo: 'Bomba (reserva)', cor: '#eb2f96' }, MATERIAL: { rotulo: 'Material (desconto)', cor: '#a0d911' },
  DEDUCOES: { rotulo: 'Impostos e taxas', cor: '#bfbfbf' }, LUCRO: { rotulo: 'Lucro', cor: '#52c41a' },
};

/**
 * Para onde vai o preço mensal de um plano: os custos por tipo (por mês), os impostos/taxas sobre o preço e o lucro;
 * cada fatia em % do preço. Com prejuízo, o lucro sai negativo e a soma dos custos passa do preço (excesso).
 */
export const composicaoDoPreco = (preco: number, custos: Array<{ tipo: string; anual: number }>, deducoesPct: number) => {
  const porTipo = new Map<string, number>();
  for (const l of custos) porTipo.set(l.tipo, (porTipo.get(l.tipo) || 0) + l.anual / 12);
  const deducoes = r2(preco * deducoesPct);
  const custoMes = r2([...porTipo.values()].reduce((s, v) => s + v, 0));
  const lucro = r2(preco - deducoes - custoMes);
  const fatias = [...Object.keys(FATIAS).filter(t => porTipo.has(t)).map(t => ({ tipo: t, valor: r2(porTipo.get(t)!) })), { tipo: 'DEDUCOES', valor: deducoes },
    ...(lucro > 0 ? [{ tipo: 'LUCRO', valor: lucro }] : [])].filter(f => f.valor > 0);
  const base = Math.max(preco, custoMes + deducoes) || 1;
  return {
    fatias: fatias.map(f => ({ ...f, pct: Math.round((f.valor / base) * 1000) / 10, ...FATIAS[f.tipo] })),
    custoMes, deducoes, lucro, excesso: lucro < 0 ? r2(-lucro) : 0,
  };
};

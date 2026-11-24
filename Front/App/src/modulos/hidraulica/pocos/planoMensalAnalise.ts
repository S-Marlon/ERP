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

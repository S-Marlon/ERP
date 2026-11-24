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

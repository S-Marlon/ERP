// Obras de poços › resultado e painel (etapa 8): regras puras. Tudo do próprio módulo (fora do Resultado do mês da
// loja): o lucro de cada obra (contrato + adicionais aprovados − materiais), os alertas de obra parada ou atrasada e o
// recebido mês a mês.

const c = (v: number) => Math.round((Number(v) || 0) * 100);
const r = (v: number) => v / 100;

export interface ObraParaLucro { total: number; recebido: number; custoMateriais: number; materiaisConferidos: boolean; linhasMateriais: number }

/**
 * Lucro da obra: o total cobrado (contrato + adicionais aprovados) menos o custo dos materiais. O custo usa o usado de
 * cada linha e, onde ainda não foi conferido, o previsto (por isso "estimado" enquanto faltar conferir).
 */
export const lucroDaObra = (o: ObraParaLucro) => {
  const lucro = c(o.total) - c(o.custoMateriais);
  return {
    total: r(c(o.total)), recebido: r(c(o.recebido)), aReceber: r(c(o.total) - c(o.recebido)), custo: r(c(o.custoMateriais)), lucro: r(lucro),
    margem: c(o.total) > 0 ? Math.round((lucro / c(o.total)) * 1000) / 10 : null,
    custoEstimado: o.linhasMateriais > 0 && !o.materiaisConferidos, semMateriais: o.linhasMateriais === 0,
  };
};

export interface ObraParaAlerta {
  idObra: number; titulo: string; situacao: string; criadaEm: string; dataPrevisao: string | null; dataInicio: string | null;
  semParcela: number; aReceber: number;
}
export interface AlertaObra { idObra: number; titulo: string; tipo: 'ORCAMENTO_PARADO' | 'INICIO_ATRASADO' | 'EXECUCAO_LONGA' | 'SALDO_NAO_LANCADO'; texto: string }

const dias = (de: string, hoje: string) => Math.round((new Date(`${hoje}T12:00:00`).getTime() - new Date(`${de.slice(0, 10)}T12:00:00`).getTime()) / 86400000);
const br = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const LIMITES = { orcamentoDias: 30, execucaoDias: 15 };

/**
 * Alertas: orçamento sem resposta há mais de 30 dias; início previsto que passou sem a obra começar; obra em execução
 * há mais de 15 dias; obra concluída com parte do valor ainda sem parcela lançada (o saldo não foi cobrado).
 */
export const alertasDaObra = (o: ObraParaAlerta, hoje: string): AlertaObra[] => {
  const a: AlertaObra[] = [];
  const base = { idObra: o.idObra, titulo: o.titulo };
  if (o.situacao === 'ORCAMENTO' && dias(o.criadaEm, hoje) > LIMITES.orcamentoDias) {
    a.push({ ...base, tipo: 'ORCAMENTO_PARADO', texto: `Orçamento sem resposta há ${dias(o.criadaEm, hoje)} dias.` });
  }
  if ((o.situacao === 'ORCAMENTO' || o.situacao === 'AGUARDANDO_SINAL') && o.dataPrevisao && o.dataPrevisao < hoje) {
    a.push({ ...base, tipo: 'INICIO_ATRASADO', texto: `Início previsto para ${br(o.dataPrevisao)} e a obra não começou${o.situacao === 'AGUARDANDO_SINAL' ? ' (aguardando sinal)' : ''}.` });
  }
  if (o.situacao === 'EM_EXECUCAO' && o.dataInicio && dias(o.dataInicio, hoje) > LIMITES.execucaoDias) {
    a.push({ ...base, tipo: 'EXECUCAO_LONGA', texto: `Em execução há ${dias(o.dataInicio, hoje)} dias.` });
  }
  if (o.situacao === 'CONCLUIDA' && c(o.semParcela) > 0) {
    a.push({ ...base, tipo: 'SALDO_NAO_LANCADO', texto: `Concluída com R$ ${r(c(o.semParcela)).toFixed(2).replace('.', ',')} sem parcela lançada.` });
  }
  return a;
};

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Os últimos `n` meses até o mês de `hoje` (chave AAAA-MM), com o recebido e o faturado (obras concluídas) de cada um. */
export const serieMensal = (hoje: string, n: number, recebido: { mes: string; valor: number }[], faturado: { mes: string; valor: number }[]) => {
  const [a, m] = hoje.split('-').map(Number);
  const soma = (lista: { mes: string; valor: number }[], chave: string) => r(lista.filter(x => x.mes === chave).reduce((s, x) => s + c(x.valor), 0));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(a, m - 1 - (n - 1 - i), 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { chave, rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, recebido: soma(recebido, chave), faturado: soma(faturado, chave) };
  });
};

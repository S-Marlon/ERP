import { alertasDaLinha, LinhaParaAuditoria, mediana } from './auditoriaEntrada';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(`auditoriaEntrada: ${msg}`); };
const base: LinhaParaAuditoria = {
  custoEntrada: 10, custosAnteriores: [], custoGerencial: null, outrosItensMesmoCodigo: [], gtinLinha: null, gtinsDoItem: [],
};
const codigos = (l: Partial<LinhaParaAuditoria>) => alertasDaLinha({ ...base, ...l }).map(a => a.codigo).join(',');

export const runAuditoriaEntradaTests = () => {
  assert(mediana([3, 1, 2]) === 2 && mediana([1, 2, 3, 4]) === 2.5 && mediana([]) === null && mediana([0, -1]) === null, 'mediana');

  assert(codigos({}) === '', 'sem referência, sem alerta');
  assert(codigos({ custosAnteriores: [9, 10, 11] }) === '', 'custo em linha com as compras');
  // Caixa com 12 lançada como unidade: custo 12x maior
  const caixa = alertasDaLinha({ ...base, custoEntrada: 120, custosAnteriores: [10, 10.5] });
  assert(caixa[0]?.codigo === 'CUSTO_DESTOA' && caixa[0].mensagem.includes('acima'), 'custo muito acima');
  assert(codigos({ custoEntrada: 1, custosAnteriores: [10] }) === 'CUSTO_DESTOA', 'custo muito abaixo (fator a mais)');
  assert(codigos({ custoEntrada: 15.9, custosAnteriores: [10] }) === '', 'até 59% acima não alerta');
  // Sem compras anteriores, usa o custo do cadastro
  const gerencial = alertasDaLinha({ ...base, custoEntrada: 50, custoGerencial: 10 });
  assert(gerencial[0]?.mensagem.includes('custo do cadastro'), 'referência pelo custo gerencial');
  assert(codigos({ custoEntrada: null, custosAnteriores: [10] }) === '', 'sem custo de entrada, sem alerta');

  assert(codigos({ outrosItensMesmoCodigo: ['GRX-1'] }) === 'CODIGO_EM_OUTRO_ITEM', 'código em outro item');
  assert(codigos({ gtinLinha: '7891000100103', gtinsDoItem: ['7891000100200'] }) === 'GTIN_DIVERGENTE', 'GTIN divergente');
  assert(codigos({ gtinLinha: '7891000100103', gtinsDoItem: ['7891000100103'] }) === '', 'GTIN igual');
  assert(codigos({ gtinLinha: '7891000100103', gtinsDoItem: [] }) === '', 'item sem GTIN não alerta');
};

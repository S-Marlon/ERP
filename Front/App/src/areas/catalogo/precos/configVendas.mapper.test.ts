import { configParaEstado, estadoParaPayload, sincronizarRascunho } from './configVendas.mapper';
import type { ConfigVendasApi } from './configVendas.api';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runConfigVendasMapperTests = (): void => {
  const config: ConfigVendasApi = {
    item: { id_item: 1, sku: 'CORDA-10', nome: 'Corda 10mm', tipo_recurso: 'PRODUTO', sigla_base: 'MT', descricao_base: 'Metro' },
    custos: { defasado: false, custoGerencial: 0.15, custoMedio: 0.15, ultimoCusto: 0.15, variacaoUltimoPct: 0, variacaoMedioPct: 0, quantidadeAtual: 300 },
    unidades: [
      { sigla: 'MT', descricao: 'Metro', fator: 1, is_base: true, configurada: true, nome_exibicao: 'Metro', gtin: null, permite_venda: true, permite_atacado: true, markup_varejo: 2.2, padrao_pdv: true },
      { sigla: 'RL', descricao: 'Rolo', fator: 150, is_base: false, configurada: false, nome_exibicao: null, gtin: null, permite_venda: true, permite_atacado: false, markup_varejo: null, padrao_pdv: false },
    ],
    faixas: [
      { sigla: 'MT', tipo_faixa: 'VAREJO', ordem: 1, quantidade_minima: 0, quantidade_maxima: 3, markup: 2.2, preco_unitario: 0.33 },
      { sigla: 'MT', tipo_faixa: 'ATACADO', ordem: 2, quantidade_minima: 4, quantidade_maxima: null, markup: 1.8, preco_unitario: 0.27 },
    ],
  };

  const estado = configParaEstado(config);
  assert(estado.custo === 0.15 && estado.units.length === 2, 'Estado deveria trazer custo gerencial e as 2 unidades.');
  assert(estado.tiers.filter(t => t.unitKey === 'MT').length === 2, 'MT deveria manter suas 2 faixas.');
  const rl = estado.tiers.find(t => t.unitKey === 'RL');
  assert(!!rl && rl.unitPrice === 40.5 && rl.maxQuantity === 'INF', 'Unidade sem faixa deveria ganhar varejo padrão (0,15 x 150 x 1,8).');

  const payload = estadoParaPayload(estado.units, estado.tiers, estado.custo);
  assert(payload.unidades.find(u => u.sigla === 'MT')?.is_base === true, 'MT deveria continuar como base.');
  const atacado = payload.faixas.find(f => f.sigla === 'MT' && f.ordem === 2);
  assert(!!atacado && atacado.tipo_faixa === 'ATACADO' && atacado.quantidade_maxima === null, 'Faixa sem limite deveria ir como null.');
  assert(payload.faixas.filter(f => f.sigla === 'RL').length === 1, 'RL deveria sair com a faixa de varejo criada.');

  // Rascunho: NF em CX a R$ 100, 1 CX = 50 UN -> base UN custa R$ 2
  const r1 = sincronizarRascunho([], [], { unidadeBase: 'un', unidadeCompra: 'CX', fatorCompra: 50, custoUnidadeCompra: 100 });
  assert(r1.custo === 2, 'Custo por unidade base deveria ser custo da NF / fator.');
  assert(r1.units.length === 2 && r1.units[0].unitKey === 'UN' && r1.units[0].isBase, 'Rascunho deveria ter UN (base) e CX.');
  assert(r1.units.find(u => u.unitKey === 'CX')?.conversionFactor === 50, 'CX deveria ter fator 50.');
  assert(r1.tiers.find(t => t.unitKey === 'UN')?.unitPrice === 3.6, 'Varejo UN deveria ser 2 x 1 x 1,8.');

  // Mudando o fator para 100: custo base cai para 1 e os preços acompanham, mantendo o markup editado
  const editado = r1.tiers.map(t => (t.unitKey === 'UN' ? { ...t, markupOrDiscount: 2 } : t));
  const r2 = sincronizarRascunho(r1.units, editado, { unidadeBase: 'UN', unidadeCompra: 'CX', fatorCompra: 100, custoUnidadeCompra: 100 });
  assert(r2.tiers.find(t => t.unitKey === 'UN')?.unitPrice === 2, 'Preço deveria acompanhar o novo custo mantendo o markup 2.');
  assert(r2.units.find(u => u.unitKey === 'CX')?.conversionFactor === 100, 'Fator da unidade da NF deveria ser atualizado.');

  // NF na mesma unidade da base: só a base
  const r3 = sincronizarRascunho([], [], { unidadeBase: 'PC', unidadeCompra: 'PC', fatorCompra: 1, custoUnidadeCompra: 8 });
  assert(r3.units.length === 1 && r3.units[0].isBase && r3.custo === 8, 'NF na unidade base deveria gerar só a base.');

  // Digitação da base letra a letra: "U" some quando vira "UN"
  const parcial = sincronizarRascunho([], [], { unidadeBase: 'U', unidadeCompra: 'CX', fatorCompra: 10, custoUnidadeCompra: 10 });
  const completo = sincronizarRascunho(parcial.units, parcial.tiers, { unidadeBase: 'UN', unidadeCompra: 'CX', fatorCompra: 10, custoUnidadeCompra: 10 });
  assert(completo.units.map(u => u.unitKey).sort().join() === 'CX,UN', 'Unidade automática antiga deveria ser removida.');
  assert(!completo.tiers.some(t => t.unitKey === 'U'), 'Faixas da unidade removida deveriam sair junto.');
};

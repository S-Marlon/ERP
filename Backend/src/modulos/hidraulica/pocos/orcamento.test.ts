import assert from 'assert';
import { novoAditivo, resumoDosItens, validarItens } from './orcamento';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('orçamento de poço: itens', () => {
  const itens = validarItens([
    { grupo: 'perfuracao', descricao: ' Perfuração 6" ', quantidade: '50', unidade: 'M', valorUnitario: '180' },
    { grupo: 'PERFURACAO', descricao: 'Metro excedente', quantidade: 1, unidade: 'm', valorUnitario: 200, opcional: true },
    { grupo: 'REVESTIMENTO', descricao: 'Revestimento geomecânico 6"', quantidade: 48, unidade: 'm', valorUnitario: 95.333 },
    { grupo: 'BOMBA', descricao: 'Bomba submersa 1 cv', quantidade: 1, unidade: 'un', valorUnitario: 2450 },
  ]);
  assert.deepStrictEqual(itens[0], { grupo: 'PERFURACAO', descricao: 'Perfuração 6"', quantidade: 50, unidade: 'm', valorUnitario: 180, valorTotal: 9000, opcional: false, incluso: false });
  assert.strictEqual(itens[2].valorTotal, 4575.98);                                  // 48 × 95,333 = 4.575,984 → 4.575,98
  assert.deepStrictEqual(resumoDosItens(itens), { total: 16025.98, opcionais: 200, metrosPrevistos: 50, valorMetro: 180, valorMetroExcedente: 200 });
  assert.deepStrictEqual(resumoDosItens(itens.filter(i => !i.opcional)).valorMetroExcedente, 180);   // sem item de excedente: o próprio metro
  assert.throws(() => validarItens([{ descricao: '', valorUnitario: 1 }]), /Item 1: descreva/);
  assert.throws(() => validarItens([{ descricao: 'x', quantidade: 0 }]), /quantidade/);
  assert.throws(() => validarItens([{ descricao: 'x', unidade: 'cx' }]), /unidade/);
  assert.throws(() => validarItens('x'), /inválidos/);
});

teste('orçamento de poço: faixas de perfuração e itens inclusos (modelo da empresa)', () => {
  const itens = validarItens([
    { grupo: 'SERVICO', descricao: 'Transporte dos equipamentos', quantidade: 1, unidade: 'vb', valorUnitario: 0, incluso: true },
    { grupo: 'SERVICO', descricao: 'Gerador de energia (se necessário)', quantidade: 1, unidade: 'vb', valorUnitario: 320, opcional: true },
    { grupo: 'PERFURACAO', descricao: 'Diâm. 6" sedimento superficial (0 a 10 m)', quantidade: 10, unidade: 'm', valorUnitario: 300 },
    { grupo: 'PERFURACAO', descricao: 'Diâm. 6" sedimento (10 a 30 m)', quantidade: 20, unidade: 'm', valorUnitario: 290 },
    { grupo: 'PERFURACAO', descricao: 'Diâm. 6" rocha sã (30 a 40 m)', quantidade: 10, unidade: 'm', valorUnitario: 280 },
    { grupo: 'PERFURACAO', descricao: 'Diâm. 6" rocha consolidada (40 a 60 m)', quantidade: 20, unidade: 'm', valorUnitario: 270 },
    { grupo: 'REVESTIMENTO', descricao: 'Tubo liso 5"', quantidade: 6, unidade: 'un', valorUnitario: 260, incluso: true },
    { grupo: 'BOMBA', descricao: 'Bomba submersa', quantidade: 1, unidade: 'un', valorUnitario: 1800, incluso: true, opcional: true },
    { grupo: 'PERFURACAO', descricao: 'Metro excedente', quantidade: 1, unidade: 'm', valorUnitario: 280, opcional: true },
  ]);
  // o total é só a perfuração (R$ 17.000,00, como no orçamento modelo); incluso e "se necessário" não somam
  const r = resumoDosItens(itens);
  assert.deepStrictEqual([r.total, r.metrosPrevistos, r.valorMetro, r.valorMetroExcedente], [17000, 60, 270, 280]);
  assert.strictEqual(itens[6].incluso, true);
  assert.strictEqual(itens[7].incluso, false);   // "se necessário" ganha de incluso
});

teste('orçamento de poço: termo aditivo', () => {
  const adic = [
    { idAdicional: 1, situacao: 'APROVADO', valor: 2160, idAditivo: 9 },        // já em aditivo
    { idAdicional: 2, situacao: 'APROVADO', valor: 300.1, idAditivo: null },
    { idAdicional: 3, situacao: 'APROVADO', valor: 0.2, idAditivo: null },
    { idAdicional: 4, situacao: 'PENDENTE', valor: 99, idAditivo: null },
  ];
  assert.deepStrictEqual(novoAditivo(adic, null, [1]), { numero: 2, ids: [2, 3], valor: 300.3 });
  assert.deepStrictEqual(novoAditivo(adic, [3], []), { numero: 1, ids: [3], valor: 0.2 });
  assert.throws(() => novoAditivo(adic, [1], []), /outro aditivo/);
  assert.throws(() => novoAditivo(adic, [4], []), /outro aditivo/);
  assert.throws(() => novoAditivo(adic.slice(0, 1), null, []), /Não há adicional/);
});

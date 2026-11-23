import assert from 'assert';
import { adicionalDoMaterial, resumoMateriais, totalLinha, validarLinha, validarMaterial } from './materiais';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('materiais de poço: cadastro', () => {
  assert.deepStrictEqual(validarMaterial({ nome: ' Cabo PP  3x4 ', categoria: 'cabo', unidade: 'M', custo: '8,5' }),
    { nome: 'Cabo PP 3x4', categoria: 'CABO', unidade: 'm', custo: 8.5, precoVenda: null, observacao: null, ativo: 1,
      diametro: null, comprimentoM: null, marca: null, classe: null, cor: null });
  const t = validarMaterial({ nome: 'Tubo 5" Asperbras', categoria: 'TUBO', diametro: ' 5" ', comprimentoM: '6', marca: 'Asperbras', classe: 'PN80', cor: '#2F54EB' });
  assert.deepStrictEqual([t.diametro, t.comprimentoM, t.marca, t.classe, t.cor], ['5"', 6, 'Asperbras', 'PN80', '#2f54eb']);
  assert.throws(() => validarMaterial({ nome: 'X', cor: 'azul' }), /Cor/);
  assert.throws(() => validarMaterial({ nome: 'X', comprimentoM: 500 }), /100 m/);
  assert.strictEqual(validarMaterial({ nome: 'Bomba', ativo: false }).ativo, 0);
  assert.throws(() => validarMaterial({}), /nome/);
  assert.throws(() => validarMaterial({ nome: 'X', categoria: 'PNEU' }), /Categoria/);
  assert.throws(() => validarMaterial({ nome: 'X', unidade: 'cx' }), /Unidade/);
  assert.throws(() => validarMaterial({ nome: 'X', custo: -1 }), /Custo/);
});

teste('materiais de poço: linha da obra', () => {
  assert.deepStrictEqual(validarLinha({ idMaterial: 3, qtdPrevista: '20' }),
    { idMaterial: 3, descricao: null, unidade: null, qtdPrevista: 20, qtdUsada: null, custoUnitario: null, observacao: null });
  assert.deepStrictEqual(validarLinha({ descricao: 'Abraçadeira', unidade: 'un', qtdPrevista: 4, qtdUsada: 0, custoUnitario: 2 }).qtdUsada, 0);
  assert.throws(() => validarLinha({ qtdPrevista: 1 }), /Escolha o material/);
});

teste('materiais de poço: previsto × real', () => {
  assert.strictEqual(totalLinha(3, 3.333), 10);          // 3 × 3,333 = 9,999 → 10,00 (o custo não é cortado antes)
  assert.strictEqual(totalLinha(12.5, 7.8125), 97.66);   // 97,65625
  assert.strictEqual(totalLinha(null, 10), null);
  const linhas = [
    { qtdPrevista: 20, qtdUsada: 22, custoUnitario: 95 },      // tubo: previsto 1900, real 2090
    { qtdPrevista: 100, qtdUsada: null, custoUnitario: 8.5 },  // cabo ainda não conferido: previsto 850
  ];
  assert.deepStrictEqual(resumoMateriais(linhas), { linhas: 2, conferidas: 1, custoPrevisto: 2750, custoReal: 2090, completo: false, diferenca: null });
  linhas[1].qtdUsada = 90;
  assert.deepStrictEqual(resumoMateriais(linhas), { linhas: 2, conferidas: 2, custoPrevisto: 2750, custoReal: 2855, completo: true, diferenca: 105 });
  assert.deepStrictEqual(resumoMateriais([]), { linhas: 0, conferidas: 0, custoPrevisto: 0, custoReal: 0, completo: false, diferenca: 0 });
});

teste('materiais de poço: cobrar à parte vira adicional', () => {
  assert.deepStrictEqual(adicionalDoMaterial({ descricao: 'Cabo PP 3x4', unidade: 'm', qtdPrevista: 100, qtdUsada: 90.5 }, 12),
    { tipo: 'MATERIAL', descricao: 'Cabo PP 3x4 (90,5 m)', quantidade: 90.5, valorUnitario: 12 });
  assert.strictEqual(adicionalDoMaterial({ descricao: 'Bomba', unidade: 'un', qtdPrevista: 1, qtdUsada: null }, 1800).quantidade, 1);
  assert.throws(() => adicionalDoMaterial({ descricao: 'Bomba', unidade: 'un', qtdPrevista: 1, qtdUsada: null }, null), /preço/);
  assert.throws(() => adicionalDoMaterial({ descricao: 'Bomba', unidade: 'un', qtdPrevista: 0, qtdUsada: null }, 10), /quantidade/);
});

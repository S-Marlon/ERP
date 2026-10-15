import assert from 'assert';
import { camposDesconhecidos, descricaoDoItem, temCampos } from './descricaoModelo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const det = { titulo: 'Abraçadeira de nylon', familia: 'ABRAÇADEIRA', atributosErp: [{ id: 1, nome: 'Tamanho' }, { id: 2, nome: 'Cor' }] };
const item = { nome: 'Abraçadeira 3.6x100', marca: 'Acme', sku: 'ABR-3.6-100', valoresErp: { 1: '100 mm', 2: 'Preta' } };

teste('descrição por item: igual à do servidor', () => {
  const modelo = 'Abraçadeira {Cor}, {Tamanho} de comprimento.\n\nMarca {marca} · SKU {sku}.\nAplicação: {Aplicacao}.';
  assert.strictEqual(descricaoDoItem(modelo, item, det), 'Abraçadeira Preta, 100 mm de comprimento.\n\nMarca Acme · SKU ABR-3.6-100.\nAplicação:.');
  assert.strictEqual(descricaoDoItem('Texto igual para todos.', item, det), 'Texto igual para todos.');
  assert.strictEqual(descricaoDoItem('Marca {marca}', { ...item, marca: 'Sem marca' }, det), 'Marca');
});

teste('descrição por item: campos desconhecidos e se tem campo', () => {
  assert.deepStrictEqual(camposDesconhecidos('{Cor} {aplicacao} {SKU} {Aplicacao}', det), ['aplicacao', 'Aplicacao']);
  assert.ok(temCampos('a {Cor} b') && !temCampos('sem campo'));
});

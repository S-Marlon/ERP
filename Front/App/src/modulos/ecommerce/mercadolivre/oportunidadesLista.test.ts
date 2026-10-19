import assert from 'assert';
import type { Oportunidade } from './mercadoLivreApi';
import { contarOportunidades, passaNaOportunidade } from './oportunidadesLista';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const op = (o: Partial<Oportunidade>): Oportunidade => ({
  idItem: 1, sku: '6902-ZZ', nome: 'Rolamento 6902 ZZ', fotoUrl: null, marca: 'NTN', preco: 20, estoque: 3, fotos: 1, pesoKg: 0.1, medidas: true,
  gtin: true, vendidos90: 0, idFamilia: 1, familia: 'Rolamentos 69xx', familiaNoMl: null, faltas: [], situacao: 'PRONTO', ...o,
});
const f = (x: Partial<Parameters<typeof passaNaOportunidade>[1]>) => ({ filtro: 'todos' as const, somenteEstoque: true, busca: '', ...x });

teste('oportunidades: filtros', () => {
  assert.ok(passaNaOportunidade(op({}), f({})));
  assert.ok(!passaNaOportunidade(op({ estoque: 0 }), f({})));
  assert.ok(passaNaOportunidade(op({ estoque: 0 }), f({ somenteEstoque: false })));
  assert.ok(!passaNaOportunidade(op({}), f({ filtro: 'balcao' })));
  assert.ok(passaNaOportunidade(op({ vendidos90: 2 }), f({ filtro: 'balcao' })));
  assert.ok(!passaNaOportunidade(op({ situacao: 'QUASE' }), f({ filtro: 'prontos' })));
  assert.ok(passaNaOportunidade(op({ familiaNoMl: { idAnuncio: 5, titulo: 'x' } }), f({ filtro: 'familia' })));
  // busca sem acento, por partes e na família/marca
  assert.ok(passaNaOportunidade(op({ nome: 'Rolamento Cônico' }), f({ busca: 'conico rol' })));
  assert.ok(passaNaOportunidade(op({}), f({ busca: '69xx ntn' })));
  assert.ok(!passaNaOportunidade(op({}), f({ busca: '6203' })));
});

teste('oportunidades: contagens', () => {
  const lista = [
    op({ vendidos90: 3 }),
    op({ estoque: 0, vendidos90: 9 }),
    op({ situacao: 'FALTA', faltas: [{ texto: 'sem foto', nivel: 'erro' }], pesoKg: null }),
  ];
  assert.deepStrictEqual(contarOportunidades(lista, true), { todos: 2, balcao: 1, prontos: 1, familia: 0, semFoto: 1, semPeso: 1 });
  assert.strictEqual(contarOportunidades(lista, false).balcao, 2);
});

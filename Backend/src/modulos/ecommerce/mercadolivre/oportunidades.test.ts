import assert from 'assert';
import { Candidato, compararCandidatos, faltasDoCandidato, situacaoDoCandidato } from './oportunidades';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const base: Candidato = { preco: 30, estoque: 5, fotos: 2, fotoFamilia: false, pesoKg: 0.2, medidas: true, gtin: true, motivosCadastro: [], vendidos90: 0 };
const com = (c: Partial<Candidato>) => { const x = { ...base, ...c }; return { ...x, situacao: situacaoDoCandidato(faltasDoCandidato(x)) }; };

teste('oportunidades: o que falta e a situação', () => {
  assert.strictEqual(com({}).situacao, 'PRONTO');
  assert.strictEqual(com({ gtin: false }).situacao, 'PRONTO');                    // sem GTIN publica como "produto sem código"
  assert.strictEqual(com({ fotos: 0, fotoFamilia: true }).situacao, 'PRONTO');    // vai a foto da família
  assert.strictEqual(com({ fotos: 0 }).situacao, 'FALTA');
  assert.strictEqual(com({ preco: 0 }).situacao, 'FALTA');
  assert.strictEqual(com({ pesoKg: null }).situacao, 'QUASE');
  assert.strictEqual(com({ estoque: 0 }).situacao, 'QUASE');
  assert.strictEqual(com({ motivosCadastro: ['atributo "Medida" sem valor'] }).situacao, 'QUASE');
  assert.deepStrictEqual(faltasDoCandidato({ ...base, fotos: 0, gtin: false }).map(f => f.nivel), ['erro', 'info']);
});

teste('oportunidades: ordem da lista', () => {
  const lista = [
    com({ estoque: 0, vendidos90: 99 }),            // sem estoque vai por último, mesmo vendendo
    com({ fotos: 0, vendidos90: 50 }),              // vende mais: sobe mesmo faltando foto
    com({ vendidos90: 3, fotos: 0 }),
    com({ vendidos90: 3 }),                         // empate nas vendas: o pronto antes
    com({ vendidos90: 0, estoque: 20 }),
    com({ vendidos90: 0 }),                         // empate nas vendas e na situação: maior valor em estoque antes
  ].sort(compararCandidatos);
  assert.deepStrictEqual(lista.map(c => [c.vendidos90, c.estoque, c.situacao]), [
    [50, 5, 'FALTA'], [3, 5, 'PRONTO'], [3, 5, 'FALTA'], [0, 20, 'PRONTO'], [0, 5, 'PRONTO'], [99, 0, 'QUASE'],
  ]);
});

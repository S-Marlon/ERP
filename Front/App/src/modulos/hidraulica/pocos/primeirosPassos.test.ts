import assert from 'assert';
import { EstadoInicial, faltaComecar, primeirosPassos } from './primeirosPassos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const vazio: EstadoInicial = {
  empresaNome: null, empresaTelefone: null, logo: null, responsavelTecnico: null, foroCidade: null,
  equipe: 0, equipamentos: 0, materiais: 17, clientes: 0, obras: 0,
};

teste('primeiros passos do módulo', () => {
  const p = primeirosPassos(vazio);
  assert.deepStrictEqual(p.filter(x => x.feito).map(x => x.chave), ['MATERIAIS']);
  assert.strictEqual(faltaComecar(p), true);
  // empresa só conta com nome, telefone e logo
  assert.strictEqual(primeirosPassos({ ...vazio, empresaNome: 'Poços X', empresaTelefone: '1' }).find(x => x.chave === 'EMPRESA')!.feito, false);
  const tudo = primeirosPassos({
    empresaNome: 'Poços X', empresaTelefone: '1', logo: '/uploads/l.png', responsavelTecnico: 'Eng. Y', foroCidade: 'Z',
    equipe: 2, equipamentos: 1, materiais: 17, clientes: 1, obras: 1,
  });
  assert.strictEqual(faltaComecar(tudo), false);
});

import assert from 'assert';
import { bloqueadoPeloMl, ehModeracao, infracaoMaisRecente, textoModeracao } from './moderacao';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('moderação: quando o anúncio está parado pelo ML', () => {
  assert.strictEqual(bloqueadoPeloMl('under_review', ['forbidden']), true);    // o 6902-ZZ (categoria incorreta)
  assert.strictEqual(bloqueadoPeloMl('closed', ['forbidden']), true);
  assert.strictEqual(bloqueadoPeloMl('active', []), false);
  assert.strictEqual(bloqueadoPeloMl('paused', ['out_of_stock']), false);
  assert.strictEqual(bloqueadoPeloMl('closed', ['deleted', 'paused_by_seller']), false);   // excluído pelo vendedor
});

teste('moderação: texto com motivo, o que fazer e categorias (infração real do 6902-ZZ)', () => {
  const inf = {
    date_created: '2026-10-16T13:44:04.545-0400', reason: 'Estava em uma categoria incorreta.', remedy: '',
    suggested: { categories: [
      { id: 'MLB63829', path: 'Acessórios para Veículos > Peças de Carros e Caminhonetes > Suspensão e Direção > Rolamentos' },
      { id: 'MLB456038', path: 'Acessórios para Veículos > Peças de Motos e Quadriciclos > Chassis > Rolamentos de Rodas' },
      { id: 'MLB456192', path: 'x' }, { id: 'MLB457706', path: 'y' },
    ] },
  };
  const t = textoModeracao(inf, 'under_review');
  assert.ok(t.startsWith('Moderação do ML (16/10): Estava em uma categoria incorreta.'));
  assert.ok(t.includes('Categorias sugeridas:') && t.includes('(MLB63829)') && !t.includes('MLB457706'));
  assert.ok(!t.includes('O que fazer'));
  assert.ok(ehModeracao(t));
  assert.strictEqual(textoModeracao(null, 'under_review'), 'Moderação do ML: anúncio em revisão.');
  assert.ok(textoModeracao({ reason: 'x'.repeat(600) }, null).length <= 500);
  assert.strictEqual(ehModeracao('Pausado por prejuízo. ...'), false);
  assert.strictEqual(infracaoMaisRecente([{ date_created: '2026-10-01', reason: 'a' }, { date_created: '2026-10-16', reason: 'b' }])!.reason, 'b');
});

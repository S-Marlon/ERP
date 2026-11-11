import assert from 'assert';
import { parteDaSituacao, proximoPasso } from './proximoPasso';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('parte que a obra abre', () => {
  assert.deepStrictEqual(
    (['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA'] as const).map(parteDaSituacao),
    ['ORCAMENTO', 'COBRANCA', 'RELATORIO', 'PROCESSO', 'RELATORIO'],
  );
});

teste('próximo passo da obra', () => {
  // sem pendência: o passo da situação
  assert.strictEqual(proximoPasso('AGUARDANDO_SINAL', []).destino, 'COBRANCA');
  assert.strictEqual(proximoPasso('CONCLUIDA', []).destino, null);
  // pendência grave passa na frente
  const p = proximoPasso('EM_EXECUCAO', [{ texto: 'Em execução há 20 dias', gravidade: 'MEDIA', acao: 'DADOS_OBRA' }]);
  assert.deepStrictEqual([p.texto, p.destino, p.botao], ['Em execução há 20 dias', 'DADOS_OBRA', 'Dados da obra']);
  // pendência leve não tira o passo normal antes de concluir, mas é o passo depois de concluída
  assert.strictEqual(proximoPasso('ORCAMENTO', [{ texto: 'Foto de antes', gravidade: 'BAIXA', acao: 'PROCESSO' }]).destino, 'ORCAMENTO');
  assert.strictEqual(proximoPasso('CONCLUIDA', [{ texto: 'R$ 10,00 a receber', gravidade: 'BAIXA', acao: 'COBRANCA' }]).destino, 'COBRANCA');
  assert.strictEqual(proximoPasso('CANCELADA', [{ texto: 'x', gravidade: 'ALTA', acao: 'COBRANCA' }]).destino, null);
});

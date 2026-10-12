import assert from 'assert';
import { assinaturaKit, calcularKit, chaveLinhaKit, escolhasPadrao, OpcaoKit, PosicaoKit } from './kitPdv';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const op = (idItem: number, preco: number, saldo: number, extra: Partial<OpcaoKit> = {}): OpcaoKit =>
  ({ idItem, sku: `S${idItem}`, nome: `Item ${idItem}`, grade: '', unidade: 'UN', preco, saldo, servico: false, podeVenderSemEstoque: false, ...extra });

const posicoes: PosicaoKit[] = [
  { slot: 1, quantidadePadrao: 1, permiteTrocar: true, permiteAlterarQtd: false, familia: 'Bombas', padrao: op(10, 900, 5), opcoes: [op(10, 900, 5), op(11, 1200, 2)] },
  { slot: 2, quantidadePadrao: 50, permiteTrocar: true, permiteAlterarQtd: true, familia: 'Fios', padrao: op(20, 3.5, 500), opcoes: [op(20, 3.5, 500), op(21, 5.25, 200)] },
  { slot: 3, quantidadePadrao: 1, permiteTrocar: false, permiteAlterarQtd: false, familia: '', padrao: op(30, 50, 0, { servico: true }), opcoes: [op(30, 50, 0, { servico: true })] },
];

teste('padrão: sem diferença', () => {
  const r = calcularKit(posicoes, escolhasPadrao(posicoes));
  assert.deepStrictEqual(r, { ajuste: 0, estoque: 5, resumo: '', alterado: false });
});

teste('troca e quantidade: mesma conta do servidor', () => {
  const r = calcularKit(posicoes, [{ slot: 1, idItem: 11, quantidade: 1 }, { slot: 2, idItem: 21, quantidade: 80 }]);
  assert.strictEqual(r.ajuste, 545);
  assert.strictEqual(r.estoque, 2); // bomba 2 CV: 2; fio 4 mm: 200/80 = 2
  assert.strictEqual(r.resumo, 'S11; S21 x80');
  assert.strictEqual(calcularKit(posicoes, [{ slot: 2, idItem: 20, quantidade: 30 }]).ajuste, -70);
});

teste('assinatura e chave independem da ordem', () => {
  const a = [{ slot: 1, idItem: 11, quantidade: 1 }, { slot: 2, idItem: 21, quantidade: 80 }];
  const b = [a[1], a[0]];
  assert.strictEqual(assinaturaKit(a), assinaturaKit(b));
  assert.strictEqual(assinaturaKit(a), '1:11:1|2:21:80');
  assert.strictEqual(chaveLinhaKit(7, a), 'kit:7:1:11:1|2:21:80');
});

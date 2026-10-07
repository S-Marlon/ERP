import { planejarCorrecao, posicaoAtualDaLinha, MovimentoDaLinha } from './correcaoEntrada';
import { calcularCustoMedioEstorno } from './penteFino';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(`correcaoEntrada: ${msg}`); };
const perto = (a: number, b: number) => Math.abs(a - b) < 0.0001;

export const runCorrecaoEntradaTests = () => {
  // Custo médio no estorno: 10 un a R$5 + 10 un a R$15 (média 10); estornar as de R$15 volta a R$5
  assert(perto(calcularCustoMedioEstorno(20, 10, 10, 15), 5), 'estorno tira o custo da entrada');
  assert(calcularCustoMedioEstorno(10, 10, 10, 10) === 10, 'saldo zerado mantém o custo');
  assert(calcularCustoMedioEstorno(20, 1, 10, 50) === 1, 'conta negativa mantém o custo');

  // Linha: 30 CX entraram como 30 UN no item 7 (fator 1 errado), 20 venda + 10 almoxarifado, custo R$12/CX
  const movs: MovimentoDaLinha[] = [
    { idItem: 7, deposito: 'VENDA', tipo: 'ENTRADA', quantidade: 20, quantidadeDocumento: 20, custoTotal: 240 },
    { idItem: 7, deposito: 'ALMOXARIFADO', tipo: 'ENTRADA', quantidade: 10, quantidadeDocumento: 10, custoTotal: 120 },
  ];
  const atual = posicaoAtualDaLinha(movs);
  assert(atual.length === 2 && atual[0].custoUnitario === 12, 'posição atual da linha');

  // Mesmo item, fator certo 12: entra 240 UN venda + 120 almox a R$1/UN
  const fator = planejarCorrecao(atual, { idItem: 7, tipoRecurso: 'PRODUTO' }, 12, 12);
  const venda = fator.entradas.find(e => e.deposito === 'VENDA');
  assert(venda?.quantidade === 240 && venda.custoUnitario === 1 && venda.quantidadeDocumento === 20, 'conversão corrigida');
  assert(fator.estornos.length === 2, 'estorna o que entrou');

  // Outro item, de consumo: tudo vai para o almoxarifado
  const consumo = planejarCorrecao(atual, { idItem: 9, tipoRecurso: 'CONSUMO' }, 1, 12);
  assert(consumo.entradas.length === 1 && consumo.entradas[0].deposito === 'ALMOXARIFADO' && consumo.entradas[0].quantidade === 30, 'consumo inteiro no almoxarifado');

  // Depois de uma correção, a linha está no item 9: estorno do 7 + entrada no 9 se anulam no 7
  const depois = posicaoAtualDaLinha([
    ...movs,
    { idItem: 7, deposito: 'VENDA', tipo: 'SAIDA', quantidade: 20, quantidadeDocumento: 20, custoTotal: 240 },
    { idItem: 7, deposito: 'ALMOXARIFADO', tipo: 'SAIDA', quantidade: 10, quantidadeDocumento: 10, custoTotal: 120 },
    { idItem: 9, deposito: 'VENDA', tipo: 'ENTRADA', quantidade: 360, quantidadeDocumento: 30, custoTotal: 360 },
  ]);
  assert(depois.length === 1 && depois[0].idItem === 9 && depois[0].quantidadeDocumento === 30 && depois[0].custoUnitario === 1, 'segunda correção parte da posição atual');

  let erro = '';
  try { planejarCorrecao(atual, { idItem: 7, tipoRecurso: 'PRODUTO' }, 0, 12); } catch (e: any) { erro = e.message; }
  assert(erro.includes('Fator'), 'fator zero recusado');
};

import assert from 'assert';
import { analisarCarteira, planoDoCliente } from './planoMensalAnalise';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const plano = (nome: string, preco: number, esp: number, pess: number, otim: number, nivel: 'BAIXO' | 'MEDIO' | 'ALTO') => ({
  idNivel: null, nome, combinado: null,
  preco: { precoMensal: preco } as any,
  risco: { preco, esperado: { lucroMensal: esp }, pessimista: { lucroMensal: pess }, otimista: { lucroMensal: otim }, nivel } as any,
});
const cliente = (id: number, sugerido: string | null, kmOrigem: 'GPS' | 'MEDIA', planos: any[]) => ({
  idCliente: id, nome: `C${id}`, pocos: 1, profundidadeM: 80, potenciaCv: 1.5, latitude: null, longitude: null, km: 60, kmOrigem, sugerido, planos,
});

const clientes = [
  cliente(1, 'Completo', 'GPS', [plano('Essencial', 60, 15, 3, 19, 'BAIXO'), plano('Completo', 160, 40.37, -28, 64.27, 'MEDIO')]),
  cliente(2, null, 'MEDIA', [plano('Essencial', 70, -2, -10, 5, 'ALTO'), plano('Completo', 150, 10, -40, 30, 'ALTO')]),
];

teste('análise do plano: o plano de cada cliente', () => {
  assert.strictEqual(planoDoCliente(clientes[0], 'SUGERIDO')!.nome, 'Completo');
  assert.strictEqual(planoDoCliente(clientes[1], 'SUGERIDO')!.nome, 'Essencial');   // sem sugerido viável: o mais barato
  assert.strictEqual(planoDoCliente(clientes[1], 'Completo')!.preco.precoMensal, 150);
  assert.strictEqual(planoDoCliente(clientes[1], 'Monitorado'), null);
});

teste('análise do plano: totais da carteira e faixa', () => {
  const a = analisarCarteira(clientes, 'SUGERIDO');
  assert.deepStrictEqual(a.totais, {
    clientes: 2, receita: 230, lucro: 38.37, pessimista: -38, otimista: 69.27, margem: 0.167, alto: 1, medio: 1, baixo: 0, semGps: 1, lucroSemAlto: 40.37,
  });
  const todosEssencial = analisarCarteira(clientes, 'Essencial');
  assert.deepStrictEqual([todosEssencial.totais.receita, todosEssencial.totais.lucro, todosEssencial.totais.baixo], [130, 13, 1]);
});

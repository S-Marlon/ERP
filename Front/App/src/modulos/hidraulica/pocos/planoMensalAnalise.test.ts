import assert from 'assert';
import { analisarCarteira, composicaoDoPreco, planejamentoCarteira, planoDoCliente } from './planoMensalAnalise';

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

teste('análise do plano: meta, capacidade e equipe dedicada', () => {
  const comMao = (p: any, mao: number, atend: number) => ({ ...p, preco: { ...p.preco, maoDeObraMensal: mao, atendimentosAno: atend } });
  const cl = [
    { ...clientes[0], planos: [comMao(clientes[0].planos[1], 45, 3)] },
    { ...clientes[1], planos: [comMao(clientes[1].planos[0], 10, 2)] },
  ];
  const { linhas } = analisarCarteira(cl, 'SUGERIDO');
  const p = planejamentoCarteira(linhas, { metaAssinantes: 15, metaReceita: 5000, capacidadeSemana: 3, custoEquipeDedicada: 1000 });
  // ticket de hoje (160 + 70) ÷ 2 = 115; a meta pede 333,33 por assinante, ou 44 assinantes com o ticket de hoje
  assert.deepStrictEqual(p.meta, { assinantes: 15, receita: 5000, ticketPedido: 333.33, ticketMedio: 115, assinantesParaReceita: 44 });
  // idas: (3 + 2) ÷ 12 = 0,42 por mês; capacidade 3 × 52 ÷ 12 = 13
  assert.deepStrictEqual(p.capacidade, { atendimentosMes: 0.42, capacidadeMes: 13, uso: 0.032 });
  // para a equipe: (40,37 + 45) + (−2 + 10) = 93,37 → R$ 1.000 pede 22 assinantes (46,69 cada)
  assert.deepStrictEqual(p.equipe, { custo: 1000, paraEquipe: 93.37, cobre: false, assinantesNecessarios: 22 });
});

teste('análise do plano: composição do preço no visor', () => {
  // plano de R$ 300: preventivas 460/ano, chamados 608/ano, bomba 187,50/ano; 12% de impostos/taxas
  const c = composicaoDoPreco(300, [{ tipo: 'PREVENTIVA', anual: 460 }, { tipo: 'CHAMADOS', anual: 608 }, { tipo: 'BOMBA', anual: 187.5 }], 0.12);
  assert.deepStrictEqual(c.fatias.map(f => [f.tipo, f.valor, f.pct]), [
    ['PREVENTIVA', 38.33, 12.8], ['CHAMADOS', 50.67, 16.9], ['BOMBA', 15.63, 5.2], ['DEDUCOES', 36, 12], ['LUCRO', 159.37, 53.1],
  ]);
  assert.deepStrictEqual([c.custoMes, c.lucro, c.excesso], [104.63, 159.37, 0]);
  // prejuízo: custos + impostos passam do preço → sem fatia de lucro, mostra o excesso (50,67 ÷ 56,67 = 89,4%)
  const p = composicaoDoPreco(50, [{ tipo: 'CHAMADOS', anual: 608 }], 0.12);
  assert.deepStrictEqual([p.fatias.map(f => f.tipo), p.lucro, p.excesso, p.fatias[0].pct], [['CHAMADOS', 'DEDUCOES'], -6.67, 6.67, 89.4]);
});

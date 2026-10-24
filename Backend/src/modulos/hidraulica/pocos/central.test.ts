import assert from 'assert';
import { ClienteParaPlano, completudeCliente, completudePoco, ContratoParaCentral, estimativaPlano, faseDoContrato, pendenciasDoContrato, propensaoPlano } from './central';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const hoje = '2026-10-24';
const contrato = (x: Partial<ContratoParaCentral>): ContratoParaCentral => ({
  situacao: 'ORCAMENTO', servicos: ['PERFURACAO'], criadaEm: '2026-10-20 09:00:00', dataPrevisao: null, dataInicio: null, dataTermino: null,
  valorContratado: 18000, garantiaMeses: 12, total: 18000, parcelado: 0, recebido: 0, vencido: 0, temPoco: true, pocoComGps: true, pocoComProfundidade: true,
  pocoComVazao: true, clienteComTelefone: true, materiaisLinhas: 3, materiaisSemConferir: 0, etapasProcesso: [], ...x,
});
const textos = (c: ContratoParaCentral) => pendenciasDoContrato(c, hoje).map(p => `${p.gravidade}:${p.texto}`);

teste('central de poços: fases e pendências do contrato', () => {
  assert.deepStrictEqual(['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA'].map(faseDoContrato), ['NEGOCIACAO', 'SINAL', 'EXECUCAO', 'FECHAMENTO', null]);
  assert.deepStrictEqual(textos(contrato({ valorContratado: null, criadaEm: '2026-09-01 10:00:00', etapasProcesso: [{ titulo: 'Orçamento enviado', estado: 'ATRASADO' }] })),
    ['ALTA:Orçamento sem valor', 'ALTA:Orçamento sem resposta há 53 dias', 'ALTA:Orçamento enviado']);
  assert.deepStrictEqual(textos(contrato({ situacao: 'AGUARDANDO_SINAL', dataPrevisao: '2026-10-20' })),
    ['ALTA:Início previsto para 20/10 passou', 'MEDIA:Aguardando o sinal para começar']);
  // concluída: saldo sem parcela, vencido, materiais sem conferir, poço sem GPS e vazão
  assert.deepStrictEqual(textos(contrato({ situacao: 'CONCLUIDA', dataTermino: '2026-10-10', total: 20250, parcelado: 15000, recebido: 5000, vencido: 2000,
    materiaisSemConferir: 2, pocoComGps: false, pocoComVazao: false })), [
    'ALTA:R$ 5.250,00 sem parcela lançada', 'ALTA:R$ 2.000,00 vencido', 'MEDIA:2 material(is) sem conferir o usado', 'MEDIA:Poço sem GPS (fica fora do mapa)',
    'BAIXA:R$ 8.000,00 a receber (em dia)', 'BAIXA:Poço sem vazão',
  ]);
  // concluída e tudo certo: sai da lista
  assert.deepStrictEqual(textos(contrato({ situacao: 'CONCLUIDA', total: 18000, parcelado: 18000, recebido: 18000 })), []);
  assert.deepStrictEqual(textos(contrato({ situacao: 'CONCLUIDA', servicos: ['LIMPEZA'], parcelado: 18000, recebido: 18000, temPoco: false })), ['MEDIA:Obra sem poço ligado']);
});

teste('central de poços: informações a completar', () => {
  assert.deepStrictEqual(completudeCliente({ telefone: '11999990000', documento: null, endereco: null, cidade: 'Itupeva' }), { pct: 50, faltando: ['endereço', 'CPF/CNPJ'] });
  assert.deepStrictEqual(completudePoco({ latitude: -23, profundidadeM: 120, vazaoLh: null, nivelEstaticoM: 18, diametro: '6"', dataPerfuracao: null, idProprietario: 3, perfuradoPor: 'DESCONHECIDO' }),
    { pct: 86, faltando: ['vazão'] });                                       // data da perfuração não é cobrada de poço de origem desconhecida
});

const cliente = (x: Partial<ClienteParaPlano>): ClienteParaPlano => ({
  pocos: 1, pocosNossos: 1, idadeMaisVelhoAnos: 4, profundidadeMaxM: 130, obrasConcluidas: 2, obrasManutencao: 1, valorGasto: 25000, mesesDesdeUltimaObra: 14,
  mesesDesdeUltimaManutencao: 14, garantiaVencida: true, garantiaVencendoMeses: null, avaliou: true, temIot: false, temPlanoManutencao: false,
  parcelasVencidas: 0, temTelefone: true, obraAberta: false, ...x,
});

teste('central de poços: chance de assinar o plano mensal', () => {
  const alto = propensaoPlano(cliente({}));
  assert.deepStrictEqual([alto.pontos, alto.faixa], [85, 'ALTA']);        // 20 + 15 + 15 + 10 + 5 + 10 + 10
  assert.ok(alto.motivos.some(m => m.texto === 'Garantia já venceu (fica sem cobertura)'));
  const devedor = propensaoPlano(cliente({ parcelasVencidas: 2, avaliou: false, obrasConcluidas: 1 }));
  assert.deepStrictEqual([devedor.pontos, devedor.faixa], [40, 'MEDIA']);   // 20 + 15 + 15 + 10 + 5 − 25
  const semPoco = propensaoPlano(cliente({ pocos: 0, pocosNossos: 0, idadeMaisVelhoAnos: null, profundidadeMaxM: null, obrasManutencao: 0, garantiaVencida: false, avaliou: false, obrasConcluidas: 0 }));
  assert.deepStrictEqual([semPoco.pontos, semPoco.faixa], [0, 'BAIXA']);
  assert.strictEqual(propensaoPlano(cliente({ temTelefone: false })).pontos, 70);
});

teste('central de poços: estimativa do valor mensal', () => {
  // poço de 130 m: 2 visitas/ano × R$ 800 ÷ 12 × 1,15 = 153,33 → R$ 155
  assert.deepStrictEqual(estimativaPlano({ pocos: 1, profundidadeMaxM: 130, temIot: false }, 800, 600),
    { valorMensal: 155, minimo: 125, maximo: 185, base: '2 visita(s)/ano × 1 poço(s) × R$ 800,00 (média do que ele já pagou) ÷ 12 + 15%' });
  // poço raso, sem histórico: 1 visita × média da empresa (600) ÷ 12 × 1,15 = 57,50 → 60; com IoT + 40 = 97,50 → 100 (de 5 em 5, o meio sobe)
  assert.strictEqual(estimativaPlano({ pocos: 1, profundidadeMaxM: 60, temIot: false }, null, 600).valorMensal, 60);
  assert.strictEqual(estimativaPlano({ pocos: 1, profundidadeMaxM: 60, temIot: true }, null, 600).valorMensal, 100);
  assert.ok(estimativaPlano({ pocos: 0, profundidadeMaxM: null, temIot: false }, null, null).base.includes('valor padrão'));
});

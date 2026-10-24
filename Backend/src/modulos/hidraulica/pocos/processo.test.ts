import assert from 'assert';
import {
  CONFIG_PADRAO, checklistDaObra, estadoDoPrazo, indicadores, linkWhatsapp, MSG_AVALIACAO_PADRAO, preencherMensagem, resumoDoChecklist, situacaoDoLead,
  somarMinutosUteis, validarConfig, validarLead,
} from './processo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('processo de poços: prazo de resposta em horário comercial', () => {
  // 2026-10-23 é sexta; 24 sábado; 25 domingo; 26 segunda
  assert.strictEqual(somarMinutosUteis('2026-10-23 10:15:00', 60), '2026-10-23 11:15:00');      // dentro do horário
  assert.strictEqual(somarMinutosUteis('2026-10-23 17:30:00', 60), '2026-10-24 08:30:00');      // 30 min sexta + 30 min sábado
  assert.strictEqual(somarMinutosUteis('2026-10-23 20:00:00', 60), '2026-10-24 09:00:00');      // à noite: conta do sábado
  assert.strictEqual(somarMinutosUteis('2026-10-24 11:40:00', 60), '2026-10-26 08:40:00');      // sábado fecha 12h; domingo não conta
  assert.strictEqual(somarMinutosUteis('2026-10-25 09:00:00', 60), '2026-10-26 09:00:00');      // domingo
  assert.strictEqual(somarMinutosUteis('2026-10-24 10:00:00', 60, { abre: '08:00', fecha: '18:00', sabadoFecha: null }), '2026-10-26 09:00:00');   // sem sábado
  assert.strictEqual(somarMinutosUteis('2026-10-23 06:00:00', 60), '2026-10-23 09:00:00');      // antes de abrir
  assert.deepStrictEqual([estadoDoPrazo('2026-10-23 11:15:00', '2026-10-23 11:00:00', '2026-10-23 12:00:00'),
    estadoDoPrazo('2026-10-23 11:15:00', '2026-10-23 11:30:00', '2026-10-23 12:00:00'), estadoDoPrazo('2026-10-23 11:15:00', null, '2026-10-23 11:00:00'),
    estadoDoPrazo('2026-10-23 11:15:00', null, '2026-10-23 12:00:00')], ['NO_PRAZO', 'FORA_DO_PRAZO', 'CORRENDO', 'ATRASADO']);
});

teste('processo de poços: lead e situação', () => {
  const agora = '2026-10-23 10:00:00';
  const l = validarLead({ nome: ' José ', telefone: '(11) 99876-5432', origem: 'indicacao', indicadoPor: 'Seu Antônio', recebidoEm: '2026-10-23T09:12' }, agora);
  assert.deepStrictEqual([l.nome, l.telefone, l.origem, l.indicadoPor, l.recebidoEm], ['José', '11998765432', 'INDICACAO', 'Seu Antônio', '2026-10-23 09:12:00']);
  assert.strictEqual(validarLead({ nome: 'Ana', origem: 'GOOGLE', indicadoPor: 'x' }, agora).indicadoPor, null);   // só indicação guarda quem indicou
  assert.strictEqual(validarLead({ nome: 'Ana' }, agora).recebidoEm, agora);
  assert.throws(() => validarLead({ nome: 'Ana', origem: 'TV' }, agora), /Origem/);
  assert.throws(() => validarLead({ nome: 'Ana', recebidoEm: '2026-10-23 11:00' }, agora), /futuro/);
  assert.throws(() => validarLead({}, agora), /nome/);
  assert.deepStrictEqual([situacaoDoLead('EM_CONTATO', 'ORCAMENTO', true), situacaoDoLead('EM_CONTATO', 'EM_EXECUCAO', true),
    situacaoDoLead('PERDIDO', 'CONCLUIDA', true), situacaoDoLead('NOVO', null, false)], ['ORCAMENTO_ENVIADO', 'CONVERTIDO', 'PERDIDO', 'NOVO']);
});

teste('processo de poços: configuração', () => {
  const c = validarConfig({ empresaNome: 'Poços Silva', empresaWhatsapp: '(11) 9 9999-0000', linkAvaliacao: 'https://g.page/r/abc/review', horaAbre: '07:30', sabadoFecha: '' });
  assert.deepStrictEqual([c.empresaWhatsapp, c.horaAbre, c.horaFecha, c.sabadoFecha, c.respostaLeadMin, c.revisaoMeses], ['11999990000', '07:30', '18:00', null, 60, 11]);
  assert.throws(() => validarConfig({ linkAvaliacao: 'g.page/x' }), /http/);
  assert.throws(() => validarConfig({ horaAbre: '18:00', horaFecha: '08:00' }), /depois/);
  assert.throws(() => validarConfig({ revisaoMeses: 0 }), /1 a 60/);
});

const obra = (x: object) => ({ situacao: 'ORCAMENTO', criadaEm: '2026-10-01 09:00:00', dataInicio: null, dataTermino: null, servicos: ['PERFURACAO'], ...x });
const estados = (itens: ReturnType<typeof checklistDaObra>) => Object.fromEntries(itens.map(i => [i.etapa, i.estado]));

teste('processo de poços: checklist do orçamento', () => {
  // visita feita dia 2 às 10h: orçamento até dia 3 às 10h
  const ev = [{ etapa: 'VISITA', situacao: 'FEITO' as const, feitoEm: '2026-10-02 10:00:00', observacao: null }];
  const antes = checklistDaObra(obra({}), ev, {}, CONFIG_PADRAO, '2026-10-02 18:00:00');
  assert.deepStrictEqual([estados(antes).VISITA, estados(antes).ORCAMENTO_ENVIADO, estados(antes).FOTOS_ANTES, estados(antes).LAUDO_ENTREGUE],
    ['FEITO', 'PENDENTE', 'AINDA_NAO', 'AINDA_NAO']);
  assert.strictEqual(antes.find(i => i.etapa === 'ORCAMENTO_ENVIADO')!.prazo, '2026-10-03 10:00:00');
  assert.strictEqual(estados(checklistDaObra(obra({}), ev, {}, CONFIG_PADRAO, '2026-10-03 11:00:00')).ORCAMENTO_ENVIADO, 'ATRASADO');
  const enviado = checklistDaObra(obra({}), [...ev, { etapa: 'ORCAMENTO_ENVIADO', situacao: 'FEITO' as const, feitoEm: '2026-10-02 16:00:00', observacao: null }], {}, CONFIG_PADRAO, '2026-10-05 08:00:00');
  assert.deepStrictEqual([estados(enviado).ORCAMENTO_ENVIADO, enviado.find(i => i.etapa === 'ORCAMENTO_ENVIADO')!.noPrazo], ['FEITO', true]);
  assert.deepStrictEqual(checklistDaObra(obra({ situacao: 'CANCELADA' }), [], {}, CONFIG_PADRAO, '2026-10-05 08:00:00'), []);
});

teste('processo de poços: checklist da obra, entrega e pós-venda', () => {
  const ev = [{ etapa: 'VISITA', situacao: 'FEITO' as const, feitoEm: '2026-10-02 10:00:00', observacao: null },
    { etapa: 'ORCAMENTO_ENVIADO', situacao: 'FEITO' as const, feitoEm: '2026-10-02 16:00:00', observacao: null }];
  const exec = estados(checklistDaObra(obra({ situacao: 'EM_EXECUCAO', dataInicio: '2026-10-10' }), ev, {}, CONFIG_PADRAO, '2026-10-11 08:00:00'));
  assert.deepStrictEqual([exec.FOTOS_ANTES, exec.FOTOS_DURANTE, exec.LAUDO_ENTREGUE, exec.CONTRATO_ASSINADO], ['PENDENTE', 'AINDA_NAO', 'AINDA_NAO', 'ATRASADO']);   // começou sem contrato
  assert.strictEqual(estados(checklistDaObra(obra({}), ev, {}, CONFIG_PADRAO, '2026-10-11 08:00:00')).CONTRATO_ASSINADO, 'AINDA_NAO');   // ainda orçamento
  const fim = { situacao: 'CONCLUIDA', dataInicio: '2026-10-10', dataTermino: '2026-10-12' };
  const conc = checklistDaObra(obra(fim), ev, { ANTES: 3, DURANTE: 2 }, CONFIG_PADRAO, '2026-10-13 09:00:00');
  assert.deepStrictEqual([estados(conc).FOTOS_ANTES, estados(conc).FOTOS_DEPOIS, estados(conc).LAUDO_ENTREGUE, estados(conc).AVALIACAO_PEDIDA, estados(conc).AVALIACAO_RECEBIDA],
    ['FEITO', 'PENDENTE', 'PENDENTE', 'AINDA_NAO', 'OPCIONAL']);
  assert.strictEqual(conc.find(i => i.etapa === 'FOTOS_ANTES')!.titulo, 'Fotos de antes (3)');
  // 7 dias depois (dia 18 em diante) vale pedir avaliação; laudo passou de 3 dias: atrasado; adesivo marcado "não se aplica"
  const depois = estados(checklistDaObra(obra(fim), [...ev, { etapa: 'ADESIVO_QUADRO', situacao: 'NAO_SE_APLICA' as const, feitoEm: '2026-10-12 17:00:00', observacao: 'sem quadro' }],
    { ANTES: 1, DURANTE: 1, DEPOIS: 1 }, CONFIG_PADRAO, '2026-10-18 10:00:00'));
  assert.deepStrictEqual([depois.LAUDO_ENTREGUE, depois.ADESIVO_QUADRO, depois.AVALIACAO_PEDIDA, depois.REVISAO_LEMBRADA], ['ATRASADO', 'NAO_SE_APLICA', 'PENDENTE', 'AINDA_NAO']);
  // revisão aos 11 meses (12/09/2027)
  const rev = checklistDaObra(obra(fim), ev, {}, CONFIG_PADRAO, '2027-09-12 08:00:00');
  assert.deepStrictEqual([estados(rev).REVISAO_LEMBRADA, rev.find(i => i.etapa === 'REVISAO_LEMBRADA')!.prazo], ['PENDENTE', '2027-09-27 23:59:59']);
  assert.deepStrictEqual(resumoDoChecklist(conc), { pendentes: 3, atrasadas: 1, feitas: 4, emDia: false });   // fotos de depois, laudo e adesivo; contrato atrasado
});

teste('processo de poços: WhatsApp e mensagens', () => {
  assert.strictEqual(linkWhatsapp('(11) 99876-5432', 'Olá!'), 'https://wa.me/5511998765432?text=Ol%C3%A1!');
  assert.strictEqual(linkWhatsapp('5511998765432'), 'https://wa.me/5511998765432');
  assert.strictEqual(linkWhatsapp('123'), null);
  assert.strictEqual(preencherMensagem('Olá, {cliente}! {empresa} {nada}.', { cliente: 'José', empresa: 'Poços Silva' }), 'Olá, José! Poços Silva .');
  assert.ok(preencherMensagem(MSG_AVALIACAO_PADRAO, { cliente: 'José', empresa: 'X', link: 'https://g' }).endsWith('https://g'));
});

teste('processo de poços: indicadores', () => {
  const agora = '2026-10-23 12:00:00';
  const r = indicadores([
    { origem: 'GOOGLE', recebidoEm: '2026-10-20 09:00:00', prazo: '2026-10-20 10:00:00', respondidoEm: '2026-10-20 09:20:00', situacao: 'CONVERTIDO', valorFechado: 18000 },
    { origem: 'GOOGLE', recebidoEm: '2026-10-21 09:00:00', prazo: '2026-10-21 10:00:00', respondidoEm: '2026-10-21 11:00:00', situacao: 'PERDIDO', valorFechado: null },
    { origem: 'INDICACAO', recebidoEm: '2026-10-22 09:00:00', prazo: '2026-10-22 10:00:00', respondidoEm: null, situacao: 'NOVO', valorFechado: null },
    { origem: 'PLACA', recebidoEm: '2026-10-23 11:30:00', prazo: '2026-10-23 12:30:00', respondidoEm: null, situacao: 'NOVO', valorFechado: null },   // ainda no prazo: não conta
  ], agora, [{ noPrazo: true }, { noPrazo: false }, { noPrazo: true }], [
    { fotosCompletas: true, avaliacaoPedida: true, avaliacaoRecebida: true }, { fotosCompletas: false, avaliacaoPedida: true, avaliacaoRecebida: false },
  ]);
  assert.deepStrictEqual([r.leads, r.respostaNoPrazo, r.respostaMedidos, r.orcamentoNoPrazo, r.fotosCompletas, r.avaliacoesPedidas, r.avaliacoesRecebidas],
    [4, 33.3, 3, 66.7, 50, 2, 1]);
  assert.deepStrictEqual(r.porOrigem[0], { origem: 'GOOGLE', leads: 2, convertidos: 1, perdidos: 1, conversao: 50, valorFechado: 18000 });
});

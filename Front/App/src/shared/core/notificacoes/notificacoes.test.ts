import { marcarComoLidas, montarNotificacoes, naoLidas, DadosNotificacao } from './notificacoes';
import { CONFIG_PADRAO, cnpjValido, formatarCnpj, mesclarConfiguracoes } from '../configuracoes/configuracoes';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`notificacoes: ${msg}`); };
const dados: DadosNotificacao = {
  notasEmConferencia: 3, notasProntas: 1, abaixoMinimo: 5, estoqueNegativo: 0,
  pimCriticos: 48, semPreco: 48, custoDefasado: null, duplicados: 2,
};

export const runNotificacoesTests = () => {
  const lista = montarNotificacoes(dados, CONFIG_PADRAO.notificacoes);
  ok(lista.map(n => n.id).join(',') === 'PIM_CRITICOS,NOTAS_EM_CONFERENCIA,ABAIXO_MINIMO,SEM_PRECO,DUPLICADOS', 'ordem por nível e zeros/nulos ignorados');
  ok(lista[1].nivel === 'atencao' && lista[1].descricao.includes('1 pronta'), 'nota pronta vira atenção');
  ok(montarNotificacoes({ ...dados, notasProntas: 0 }, CONFIG_PADRAO.notificacoes).find(n => n.id === 'NOTAS_EM_CONFERENCIA')?.nivel === 'info', 'sem prontas é informativo');
  ok(lista[0].titulo === '48 itens fora do PDV ou sem preço' && montarNotificacoes({ ...dados, duplicados: 1 }, CONFIG_PADRAO.notificacoes).some(n => n.titulo === '1 suspeita de item duplicado'), 'singular/plural');

  const semPim = { ...CONFIG_PADRAO.notificacoes, ativas: { ...CONFIG_PADRAO.notificacoes.ativas, PIM_CRITICOS: false } };
  ok(!montarNotificacoes(dados, semPim).some(n => n.id === 'PIM_CRITICOS'), 'tipo desligado não aparece');

  // Lidas: some até a quantidade mudar
  const lidas = marcarComoLidas(lista, {});
  ok(naoLidas(lista, lidas).length === 0, 'todas lidas');
  const mudou = montarNotificacoes({ ...dados, abaixoMinimo: 6 }, CONFIG_PADRAO.notificacoes);
  ok(naoLidas(mudou, lidas).map(n => n.id).join() === 'ABAIXO_MINIMO', 'quantidade nova volta a notificar');

  // Configurações
  const m = mesclarConfiguracoes({ perfil: { nome: 'Marlon' }, notificacoes: { ativas: { DUPLICADOS: false }, intervaloMinutos: -1 } });
  ok(m.perfil.nome === 'Marlon' && m.perfil.cargo === CONFIG_PADRAO.perfil.cargo, 'perfil mescla com o padrão');
  ok(m.notificacoes.ativas.DUPLICADOS === false && m.notificacoes.ativas.SEM_PRECO === true && m.notificacoes.intervaloMinutos === 5, 'notificações mesclam e intervalo inválido volta ao padrão');
  ok(mesclarConfiguracoes('lixo').preferencias.itensPorPagina === 50, 'valor inválido vira padrão');
  ok(cnpjValido('11.444.777/0001-61') && !cnpjValido('11.444.777/0001-62') && !cnpjValido('11111111111111'), 'CNPJ');
  ok(formatarCnpj('11444777000161') === '11.444.777/0001-61', 'formata CNPJ');
};

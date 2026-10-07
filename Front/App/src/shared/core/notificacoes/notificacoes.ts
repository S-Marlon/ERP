// Notificações do sistema calculadas a partir dos dados (não há tabela de notificações):
// cada tipo vira um aviso com quantidade e atalho para a tela que resolve. Regras puras.
import type { PreferenciasNotificacao, TipoNotificacao } from '../configuracoes/configuracoes';

export type NivelNotificacao = 'critico' | 'atencao' | 'info';

export interface Notificacao {
  id: TipoNotificacao;
  nivel: NivelNotificacao;
  titulo: string;
  descricao: string;
  rota: string;
  quantidade: number;
}

/** Números de cada fonte (null = não foi possível consultar). */
export interface DadosNotificacao {
  notasEmConferencia: number | null;
  notasProntas: number | null;
  abaixoMinimo: number | null;
  estoqueNegativo: number | null;
  pimCriticos: number | null;
  semPreco: number | null;
  custoDefasado: number | null;
  duplicados: number | null;
}

export const TIPOS_NOTIFICACAO: Record<TipoNotificacao, { rotulo: string; descricao: string }> = {
  NOTAS_EM_CONFERENCIA: { rotulo: 'Notas em conferência', descricao: 'Notas de entrada aguardando conferência ou aprovação' },
  ABAIXO_MINIMO: { rotulo: 'Estoque abaixo do mínimo', descricao: 'Itens do depósito Venda abaixo do estoque mínimo' },
  ESTOQUE_NEGATIVO: { rotulo: 'Estoque negativo', descricao: 'Itens com saldo negativo (venda sem estoque ou ajuste pendente)' },
  PIM_CRITICOS: { rotulo: 'Pendências críticas do PIM', descricao: 'Itens fora do PDV ou sem preço por cadastro incompleto' },
  SEM_PRECO: { rotulo: 'Itens sem preço', descricao: 'Itens de venda sem preço de varejo' },
  CUSTO_DEFASADO: { rotulo: 'Custo defasado', descricao: 'Custo de entrada diferente do custo usado no preço' },
  DUPLICADOS: { rotulo: 'Itens duplicados', descricao: 'Suspeitas de itens cadastrados em duplicidade' },
};

const mais = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export const montarNotificacoes = (d: DadosNotificacao, prefs: PreferenciasNotificacao): Notificacao[] => {
  const lista: Notificacao[] = [];
  const ativa = (t: TipoNotificacao) => prefs.ativas[t] !== false;
  const add = (id: TipoNotificacao, qtd: number | null, nivel: NivelNotificacao, titulo: string, descricao: string, rota: string) => {
    if (ativa(id) && qtd !== null && qtd > 0) lista.push({ id, nivel, titulo, descricao, rota, quantidade: qtd });
  };

  add('ESTOQUE_NEGATIVO', d.estoqueNegativo, 'critico', mais(d.estoqueNegativo || 0, 'item com estoque negativo', 'itens com estoque negativo'),
    'Venda sem saldo ou ajuste pendente: confira na consulta de saldo.', '/estoque/consulta');
  add('PIM_CRITICOS', d.pimCriticos, 'critico', mais(d.pimCriticos || 0, 'item fora do PDV ou sem preço', 'itens fora do PDV ou sem preço'),
    'Cadastro incompleto: obrigatórios vazios, família não ativa ou sem preço.', '/catalogo/pendencias');
  add('NOTAS_EM_CONFERENCIA', d.notasEmConferencia, d.notasProntas ? 'atencao' : 'info',
    mais(d.notasEmConferencia || 0, 'nota em conferência', 'notas em conferência'),
    d.notasProntas ? `${mais(d.notasProntas, 'pronta', 'prontas')} para aprovar a entrada.` : 'Aguardando conferência dos itens.', '/compras/notas');
  add('ABAIXO_MINIMO', d.abaixoMinimo, 'atencao', mais(d.abaixoMinimo || 0, 'item abaixo do mínimo', 'itens abaixo do mínimo'),
    'Veja o que repor no painel de Compras.', '/compras');
  add('CUSTO_DEFASADO', d.custoDefasado, 'atencao', mais(d.custoDefasado || 0, 'item com custo defasado', 'itens com custo defasado'),
    'O custo de entrada mudou: decida se atualiza o preço.', '/catalogo/preco');
  add('SEM_PRECO', d.semPreco, 'info', mais(d.semPreco || 0, 'item sem preço', 'itens sem preço'),
    'Itens de venda sem preço de varejo configurado.', '/catalogo/preco');
  add('DUPLICADOS', d.duplicados, 'info', mais(d.duplicados || 0, 'suspeita de item duplicado', 'suspeitas de itens duplicados'),
    'Confira e una ou separe por família.', '/catalogo/duplicados');

  const peso: Record<NivelNotificacao, number> = { critico: 0, atencao: 1, info: 2 };
  return lista.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
};

/**
 * Lida = já vista com a mesma quantidade. Se a quantidade mudar, volta a contar como nova.
 * `lidas` guarda { tipo: quantidade vista }.
 */
export const naoLidas = (lista: Notificacao[], lidas: Record<string, number>) =>
  lista.filter(n => lidas[n.id] !== n.quantidade);

export const marcarComoLidas = (lista: Notificacao[], lidas: Record<string, number>): Record<string, number> => {
  const proximo = { ...lidas };
  for (const n of lista) proximo[n.id] = n.quantidade;
  return proximo;
};

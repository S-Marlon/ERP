// Obra aberta: qual parte mostrar primeiro e qual é o próximo passo (a pendência mais grave da Central ou, sem
// pendência, o passo normal da situação). Regras puras, com teste.
import type { AcaoPendencia, Gravidade, SituacaoObra } from './obrasApi';
import type { ParteObra } from './navPocos';

/** Onde a obra abre quando ninguém pediu uma parte: onde está o trabalho da situação. */
export const parteDaSituacao = (s: SituacaoObra): ParteObra =>
  s === 'ORCAMENTO' ? 'ORCAMENTO' : s === 'AGUARDANDO_SINAL' ? 'COBRANCA' : s === 'CONCLUIDA' ? 'PROCESSO' : 'RELATORIO';

/** Para onde leva o botão do passo: uma parte da obra, a edição dos dados, a ficha do poço ou do cliente. */
export type DestinoPasso = AcaoPendencia | 'ORCAMENTO' | 'RELATORIO';

export interface PassoObra { texto: string; destino: DestinoPasso | null; botao: string | null }

const PASSO_DA_SITUACAO: Record<SituacaoObra, PassoObra> = {
  ORCAMENTO: { texto: 'Mandar o orçamento e, aprovado, registrar o contrato assinado e passar para "Aguardar o sinal".', destino: 'ORCAMENTO', botao: 'Orçamento e contrato' },
  AGUARDANDO_SINAL: { texto: 'Receber o sinal para liberar o início da obra.', destino: 'COBRANCA', botao: 'Sinal e cobrança' },
  EM_EXECUCAO: { texto: 'Preencher o relatório técnico e lançar os materiais usados; terminado, "Concluir a obra".', destino: 'RELATORIO', botao: 'Relatório técnico' },
  CONCLUIDA: { texto: 'Obra fechada: nada faltando.', destino: null, botao: null },
  CANCELADA: { texto: 'Obra cancelada.', destino: null, botao: null },
};

const BOTAO: Record<AcaoPendencia, string> = {
  PROCESSO: 'Processo e fotos', COBRANCA: 'Sinal e cobrança', MATERIAIS: 'Materiais', DADOS_OBRA: 'Dados da obra', POCO: 'Ficha do poço', CLIENTE: 'Ficha do cliente',
};

/** O próximo passo: a pendência mais grave (a lista já vem ordenada) ou o passo normal da situação. */
export const proximoPasso = (situacao: SituacaoObra, pendencias: { texto: string; gravidade: Gravidade; acao: AcaoPendencia }[]): PassoObra => {
  if (situacao === 'CANCELADA') return PASSO_DA_SITUACAO.CANCELADA;
  const p = pendencias[0];
  if (p && (p.gravidade !== 'BAIXA' || situacao === 'CONCLUIDA')) return { texto: p.texto, destino: p.acao, botao: BOTAO[p.acao] };
  return PASSO_DA_SITUACAO[situacao];
};

export const rotuloDestino = (d: AcaoPendencia) => BOTAO[d];

// Atendimento › Configuração: as seções da tela (uma por vez, com o menu ao lado) e o que falta em cada uma.
// Regras puras, com teste.
import type { ConfigProcesso } from './obrasApi';

export type SecaoConfig = 'EMPRESA' | 'ORCAMENTO' | 'CONTRATO' | 'POSVENDA' | 'HORARIO' | 'TELAS';

export const SECOES_CONFIG: { id: SecaoConfig; titulo: string; descricao: string }[] = [
  { id: 'EMPRESA', titulo: 'Empresa', descricao: 'Logo e dados que saem no cabeçalho do orçamento, do contrato, do laudo e do adesivo.' },
  { id: 'ORCAMENTO', titulo: 'Orçamento e garantia', descricao: 'O que já vem preenchido em todo orçamento novo.' },
  { id: 'CONTRATO', titulo: 'Contrato', descricao: 'Foro, responsável técnico e os modelos do contrato e do termo aditivo.' },
  { id: 'POSVENDA', titulo: 'Pós-venda', descricao: 'Pedido de avaliação no Google e lembrete de revisão, enviados pelo WhatsApp.' },
  { id: 'HORARIO', titulo: 'Horário e prazos', descricao: 'Horário comercial e os prazos de resposta (contam só dentro do horário).' },
  { id: 'TELAS', titulo: 'Telas do módulo', descricao: 'Ligue só o que vocês usam; desligar não apaga nada.' },
];

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

/** O que ainda falta preencher na seção (aparece no menu e no topo da seção). */
export const faltasDaSecao = (s: SecaoConfig, c: Partial<ConfigProcesso>): string[] => {
  const faltas: [boolean, string][] =
    s === 'EMPRESA' ? [[vazio(c.empresaNome), 'nome'], [vazio(c.empresaTelefone), 'telefone'], [vazio(c.logo), 'logo'], [vazio(c.empresaDocumento), 'CNPJ/CPF']]
    : s === 'CONTRATO' ? [[vazio(c.foroCidade), 'foro'], [vazio(c.responsavelTecnico), 'responsável técnico'], [vazio(c.empresaRepresentante), 'representante legal']]
    : s === 'POSVENDA' ? [[vazio(c.linkAvaliacao), 'link de avaliação do Google']]
    : [];
  return faltas.filter(([f]) => f).map(([, t]) => t);
};

/** A seção pedida por outra tela ("CONFIG:CONTRATO"); sem seção ou desconhecida = Empresa. */
export const secaoDoPedido = (subvista: string | undefined): SecaoConfig => {
  const s = String(subvista || '').split(':')[1] as SecaoConfig;
  return SECOES_CONFIG.some(x => x.id === s) ? s : 'EMPRESA';
};

/** Quantas cláusulas o modelo tem (linhas que começam com "CLÁUSULA"). */
export const contarClausulas = (modelo: string) => modelo.split(/\r?\n/).filter(l => /^\s*CL[ÁA]USULA\b/i.test(l)).length;

/** Alguma coisa mudou desde o último salvar (o logo novo conta). */
export const temAlteracao = (salva: ConfigProcesso | null, atual: ConfigProcesso | null, logoNovo: string | null) =>
  !!logoNovo || (!!salva && !!atual && JSON.stringify(salva) !== JSON.stringify(atual));

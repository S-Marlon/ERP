// Seções do módulo Obras de poços: cada uma é um item do grupo "Poços artesianos" na barra lateral e um endereço
// (/modulos/hidraulica/pocos/<secao>). A seção diz a aba interna (navPocos) e, nas de Obras, a vista.
import type { VistaObras } from './navPocos';

export interface SecaoPocos { secao: string; titulo: string; aba: string; vista?: VistaObras }

export const SECOES_POCOS: SecaoPocos[] = [
  { secao: '', titulo: 'Central', aba: 'central' },
  { secao: 'atendimento', titulo: 'Atendimento e pós-venda', aba: 'atendimento' },
  { secao: 'obras', titulo: 'Obras e orçamentos', aba: 'obras', vista: 'OBRAS' },
  { secao: 'clientes', titulo: 'Clientes de poço', aba: 'obras', vista: 'CLIENTES' },
  { secao: 'pocos', titulo: 'Poços', aba: 'obras', vista: 'POCOS' },
  { secao: 'receber', titulo: 'A receber', aba: 'obras', vista: 'RECEBER' },
  { secao: 'materiais', titulo: 'Materiais', aba: 'obras', vista: 'MATERIAIS' },
  { secao: 'agenda', titulo: 'Agenda', aba: 'agenda' },
  { secao: 'manutencao', titulo: 'Manutenção', aba: 'manutencao' },
  { secao: 'monitoramento', titulo: 'Monitoramento (IoT)', aba: 'iot' },
  { secao: 'mapa', titulo: 'Mapa', aba: 'mapa' },
  { secao: 'resultado', titulo: 'Resultado', aba: 'resultado' },
  { secao: 'relatorio', titulo: 'Relatório avulso', aba: 'relatorio' },
];

/** Seção do endereço (desconhecida ou vazia = Central). */
export const secaoDoEndereco = (secao: string | undefined) => SECOES_POCOS.find(s => s.secao === (secao || '')) || SECOES_POCOS[0];

/** Seção de uma aba/vista interna (para o endereço acompanhar "abrir obra", "ver no mapa"...). */
export const secaoDaAba = (aba: string, vista?: VistaObras) =>
  SECOES_POCOS.find(s => s.aba === aba && (!s.vista || !vista || s.vista === vista)) || SECOES_POCOS[0];

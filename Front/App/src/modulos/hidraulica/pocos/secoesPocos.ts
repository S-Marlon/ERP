// Seções do módulo Obras de poços: cada uma tem endereço (/modulos/hidraulica/pocos/<secao>) e diz a aba interna
// (navPocos) e, nas de Obras, a vista. A barra lateral mostra só os grupos (um item por grupo); as outras seções do
// grupo aparecem como abas no topo da tela e também marcam o item do grupo na barra lateral.
import type { VistaObras } from './navPocos';

export type GrupoPocos = 'central' | 'atendimento' | 'obras' | 'clientes' | 'agenda' | 'mais';
export interface SecaoPocos { secao: string; titulo: string; aba: string; grupo: GrupoPocos; vista?: VistaObras; descricao?: string; subvista?: string }

export const BASE_POCOS = '/modulos/hidraulica/pocos';

export const SECOES_POCOS: SecaoPocos[] = [
  { secao: '', titulo: 'Central', aba: 'central', grupo: 'central' },
  { secao: 'atendimento', titulo: 'Atendimento e pós-venda', aba: 'atendimento', grupo: 'atendimento' },
  { secao: 'obras', titulo: 'Obras e orçamentos', aba: 'obras', vista: 'OBRAS', grupo: 'obras' },
  { secao: 'receber', titulo: 'A receber', aba: 'obras', vista: 'RECEBER', grupo: 'obras' },
  { secao: 'materiais', titulo: 'Materiais', aba: 'obras', vista: 'MATERIAIS', grupo: 'obras' },
  { secao: 'clientes', titulo: 'Clientes de poço', aba: 'obras', vista: 'CLIENTES', grupo: 'clientes' },
  { secao: 'pocos', titulo: 'Poços', aba: 'obras', vista: 'POCOS', grupo: 'clientes' },
  { secao: 'agenda', titulo: 'Agenda', aba: 'agenda', grupo: 'agenda' },
  { secao: 'ferramentas', titulo: 'Mais ferramentas', aba: 'ferramentas', grupo: 'mais' },
  { secao: 'documentos', titulo: 'Documentos', aba: 'documentos', grupo: 'mais',
    descricao: 'Tudo o que se imprime: kit de visita (em branco ou preenchido), documentos de uma obra e o relatório técnico avulso.' },
  { secao: 'manutencao', titulo: 'Manutenção', aba: 'manutencao', grupo: 'mais', descricao: 'Planos de manutenção, revisões a oferecer e garantias vencendo.' },
  { secao: 'resultado', titulo: 'Resultado', aba: 'resultado', grupo: 'mais', descricao: 'Recebido, faturado, lucro das obras e alertas.' },
  { secao: 'mapa', titulo: 'Mapa', aba: 'mapa', grupo: 'mais', descricao: 'Poços dos clientes e a base regional (profundidade e vazão da região).' },
  { secao: 'monitoramento', titulo: 'Monitoramento (IoT)', aba: 'iot', grupo: 'mais', descricao: 'Aparelhos nos poços, leituras, alertas e comandos.' },
];

/** Grupos da barra lateral, na ordem. O primeiro item do grupo é a tela que o grupo abre. */
export const GRUPOS_POCOS: Array<{ grupo: GrupoPocos; titulo: string }> = [
  { grupo: 'central', titulo: 'Central' },
  { grupo: 'atendimento', titulo: 'Atendimento e pós-venda' },
  { grupo: 'obras', titulo: 'Obras e orçamentos' },
  { grupo: 'clientes', titulo: 'Clientes e poços' },
  { grupo: 'agenda', titulo: 'Agenda' },
  { grupo: 'mais', titulo: 'Mais ferramentas' },
];

export const enderecoDaSecao = (s: Pick<SecaoPocos, 'secao'>) => (s.secao ? `${BASE_POCOS}/${s.secao}` : BASE_POCOS);
export const secoesDoGrupo = (g: GrupoPocos) => SECOES_POCOS.filter(s => s.grupo === g);

/** Itens da barra lateral: um por grupo, abrindo a primeira seção; as outras seções marcam o mesmo item. */
export const itensMenuPocos = () => GRUPOS_POCOS.map(g => {
  const [primeira, ...outras] = secoesDoGrupo(g.grupo);
  return { key: enderecoDaSecao(primeira), label: g.titulo, tambem: outras.map(enderecoDaSecao) };
});

/** Endereços antigos que viraram uma aba de outra seção (o Kit de visita e o Relatório avulso agora são abas de Documentos). */
const ENDERECOS_ANTIGOS: Record<string, { secao: string; subvista: string }> = {
  'kit-visita': { secao: 'documentos', subvista: 'KIT' }, relatorio: { secao: 'documentos', subvista: 'RELATORIO' },
};

/** Seção do endereço (desconhecida ou vazia = Central). Endereço antigo devolve a seção nova com a aba (subvista). */
export const secaoDoEndereco = (secao: string | undefined): SecaoPocos => {
  const antigo = ENDERECOS_ANTIGOS[secao || ''];
  if (antigo) return { ...SECOES_POCOS.find(s => s.secao === antigo.secao)!, subvista: antigo.subvista };
  return SECOES_POCOS.find(s => s.secao === (secao || '')) || SECOES_POCOS[0];
};

/** Seção de uma aba/vista interna (para o endereço acompanhar "abrir obra", "ver no mapa"...). */
export const secaoDaAba = (aba: string, vista?: VistaObras) =>
  SECOES_POCOS.find(s => s.aba === aba && (!s.vista || !vista || s.vista === vista)) || SECOES_POCOS[0];

/** Um degrau da trilha do topo ("Central › Mais ferramentas › Mapa"): o título e a seção que ele abre. */
export interface DegrauTrilha { titulo: string; secao: string }

/**
 * Trilha fixa da seção (sem as sub-telas, que cada tela acrescenta): a Central é a raiz; as ferramentas de "Mais
 * ferramentas" ficam abaixo da tela de ferramentas (que é a lista delas); as outras seções ficam direto abaixo da Central
 * (as irmãs do mesmo grupo aparecem como abas, não como degraus).
 */
export const trilhaDaSecao = (s: Pick<SecaoPocos, 'secao' | 'titulo' | 'grupo'>): DegrauTrilha[] => {
  const raiz: DegrauTrilha = { titulo: 'Central', secao: '' };
  if (!s.secao) return [raiz];
  const meio = s.grupo === 'mais' && s.secao !== 'ferramentas' ? [{ titulo: 'Mais ferramentas', secao: 'ferramentas' }] : [];
  return [raiz, ...meio, { titulo: s.titulo, secao: s.secao }];
};

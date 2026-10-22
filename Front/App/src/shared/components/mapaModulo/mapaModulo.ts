// Mapa de um módulo que abre por etapas (ex.: Gestor de frotas, Obras de poços): as funcionalidades, em que etapa cada
// uma entra, o que vai fazer e com que parte do ERP se liga. A tela mostra tudo desde o começo; cada funcionalidade abre
// quando a etapa dela fica pronta.

export type SituacaoFuncionalidade = 'PLANEJADA' | 'EM_CONSTRUCAO' | 'PRONTA';

export interface Funcionalidade {
  chave: string;
  titulo: string;
  etapa: number;
  situacao: SituacaoFuncionalidade;
  resumo: string;
  oQueFaz: string[];
  dados: string[];        // o que se guarda (campos principais)
  ligaCom: string[];      // partes do ERP que conversam com ela
}

/** Etapas em ordem com a situação de cada uma (a etapa fica pronta quando todas as funcionalidades dela ficam). */
export const etapasDoPlano = (lista: Funcionalidade[]) =>
  [...new Set(lista.map(f => f.etapa))].sort((a, b) => a - b).map(etapa => {
    const da = lista.filter(f => f.etapa === etapa);
    const situacao: SituacaoFuncionalidade = da.every(f => f.situacao === 'PRONTA') ? 'PRONTA'
      : da.some(f => f.situacao !== 'PLANEJADA') ? 'EM_CONSTRUCAO' : 'PLANEJADA';
    return { etapa, titulos: da.map(f => f.titulo), situacao };
  });

/** A etapa em que estamos: a primeira que não está pronta (null = tudo pronto). */
export const etapaAtual = (lista: Funcionalidade[]) => etapasDoPlano(lista).find(e => e.situacao !== 'PRONTA')?.etapa ?? null;

/** Confere o mapa: chave única e toda funcionalidade com resumo e o que faz (para o teste de cada módulo). */
export const mapaConsistente = (lista: Funcionalidade[]) => {
  const chaves = lista.map(f => f.chave);
  return new Set(chaves).size === chaves.length && lista.every(f => f.resumo && f.oQueFaz.length > 0);
};

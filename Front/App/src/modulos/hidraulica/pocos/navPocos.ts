// Navegação dentro do módulo Obras de poços: "ver no mapa" a partir da obra, do poço ou do cliente, e "abrir obra" /
// "ficha do poço" a partir do mapa. Estado compartilhado entre as abas (useSyncExternalStore).
import { useEffect, useRef, useSyncExternalStore } from 'react';

export type ParteObra = 'RELATORIO' | 'ORCAMENTO' | 'PROCESSO' | 'COBRANCA' | 'MATERIAIS' | 'CUSTOS';
export type VistaObras = 'OBRAS' | 'POCOS' | 'CLIENTES' | 'RECEBER' | 'MATERIAIS';
export interface NavPocos {
  aba: string;
  /** Contador que muda a cada pedido (para a aba reagir mesmo se o pedido repetir). */
  pedido: number;
  vista?: VistaObras;
  abrirObra?: number;
  /** Parte da obra aberta: o relatório técnico (padrão), a cobrança ou os materiais. */
  parteObra?: ParteObra;
  abrirPoco?: number;
  abrirCliente?: number;
  /** Foco do mapa: o ponto (e o poço destacado) ou todos os poços de um cliente. */
  foco?: { latitude: number; longitude: number; idPoco?: number } | null;
  /** Abrir a agenda já com um compromisso novo para esta obra. */
  agendarObra?: number;
  focoCliente?: number | null;
  /** Parte da tela que abre (ex.: Atendimento › Configuração, Agenda › Equipe). */
  subvista?: string;
}

let estado: NavPocos = { aba: 'central', pedido: 0 };
const ouvintes = new Set<() => void>();

export const navPocos = {
  get: () => estado,
  ir: (n: Omit<NavPocos, 'pedido'>) => { estado = { ...n, pedido: estado.pedido + 1 }; ouvintes.forEach(f => f()); },
  /** A aba escolhida à mão (sem pedido de foco nem de abrir nada). */
  trocarAba: (aba: string) => { if (aba !== estado.aba || Object.keys(estado).length > 2) { estado = { aba, pedido: estado.pedido }; ouvintes.forEach(f => f()); } },
  assinar: (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
};

export const useNavPocos = () => useSyncExternalStore(navPocos.assinar, navPocos.get);

export const verNoMapa = (latitude: number, longitude: number, idPoco?: number) => navPocos.ir({ aba: 'mapa', foco: { latitude, longitude, idPoco } });
export const verClienteNoMapa = (idCliente: number) => navPocos.ir({ aba: 'mapa', focoCliente: idCliente });
export const abrirObra = (idObra: number, parteObra?: ParteObra) => navPocos.ir({ aba: 'obras', vista: 'OBRAS', abrirObra: idObra, parteObra });
export const abrirPoco = (idPoco: number) => navPocos.ir({ aba: 'obras', vista: 'POCOS', abrirPoco: idPoco });
export const agendarObra = (idObra: number) => navPocos.ir({ aba: 'agenda', agendarObra: idObra });
export const abrirCliente = (idCliente: number) => navPocos.ir({ aba: 'obras', vista: 'CLIENTES', abrirCliente: idCliente });

// Fichas que abrem por cima de qualquer tela do módulo (busca geral, mapa, ficha do cliente): a do poço e a do cliente.
export type FichaAberta = { tipo: 'POCO' | 'CLIENTE'; id: number; aba?: string } | null;
let ficha: FichaAberta = null;
const ouvintesFicha = new Set<() => void>();
export const fichasPocos = {
  get: () => ficha,
  abrir: (f: FichaAberta) => { ficha = f; ouvintesFicha.forEach(x => x()); },
  assinar: (f: () => void) => { ouvintesFicha.add(f); return () => { ouvintesFicha.delete(f); }; },
};
export const useFichaPocos = () => useSyncExternalStore(fichasPocos.assinar, fichasPocos.get);
export const abrirFichaPoco = (idPoco: number, aba?: 'CONTRATOS' | 'DADOS' | 'ESTRUTURA' | 'BOMBA' | 'HISTORICO') => fichasPocos.abrir({ tipo: 'POCO', id: idPoco, aba });
export const abrirFichaCliente = (idCliente: number) => fichasPocos.abrir({ tipo: 'CLIENTE', id: idCliente });
/** Documentos de uma obra (Documentos › aba da obra, já com a obra escolhida). */
export const documentosDaObra = (idObra: number) => navPocos.ir({ aba: 'documentos', subvista: 'OBRA', abrirObra: idObra });

// Sub-telas abertas dentro de uma seção (obra aberta, Configuração do atendimento, Equipe da agenda...): entram na trilha
// do topo depois da seção. Cada tela registra o seu nível enquanto está aberta e diz como fechá-lo (voltar ao nível de cima).
export interface NivelPocos { id: number; profundidade: number; titulo: string; fechar: () => void }
let niveis: NivelPocos[] = [];
let proximoNivel = 1;
const ouvintesNivel = new Set<() => void>();
const avisarNiveis = () => ouvintesNivel.forEach(f => f());
export const niveisPocos = {
  get: () => niveis,
  assinar: (f: () => void) => { ouvintesNivel.add(f); return () => { ouvintesNivel.delete(f); }; },
};
export const useNiveisPocos = () => useSyncExternalStore(niveisPocos.assinar, niveisPocos.get);

/**
 * Registra uma sub-tela na trilha enquanto `titulo` não for null. `profundidade` ordena (1 = logo abaixo da seção);
 * `fechar` volta para o nível de cima (ex.: fechar a obra e voltar para a lista).
 */
export const useNivelPocos = (titulo: string | null, fechar: () => void, profundidade = 1) => {
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  const idRef = useRef(0);
  useEffect(() => {
    if (titulo === null) return;
    const id = idRef.current || (idRef.current = proximoNivel++);
    niveis = [...niveis.filter(n => n.id !== id), { id, profundidade, titulo, fechar: () => fecharRef.current() }]
      .sort((a, b) => a.profundidade - b.profundidade || a.id - b.id);
    avisarNiveis();
    return () => { niveis = niveis.filter(n => n.id !== id); avisarNiveis(); };
  }, [titulo, profundidade]);
};

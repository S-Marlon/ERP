// Navegação dentro do módulo Obras de poços: "ver no mapa" a partir da obra, do poço ou do cliente, e "abrir obra" /
// "ficha do poço" a partir do mapa. Estado compartilhado entre as abas (useSyncExternalStore).
import { useSyncExternalStore } from 'react';

export type ParteObra = 'RELATORIO' | 'COBRANCA' | 'MATERIAIS';
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
  focoCliente?: number | null;
}

let estado: NavPocos = { aba: 'obras', pedido: 0 };
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
export const abrirCliente = (idCliente: number) => navPocos.ir({ aba: 'obras', vista: 'CLIENTES', abrirCliente: idCliente });

// Telas do módulo que só aparecem quando ligadas em Atendimento › Configuração (Monitoramento e Mapa). Lido uma vez da
// configuração e atualizado quando ela é salva; estado compartilhado com useSyncExternalStore.
import { useEffect, useSyncExternalStore } from 'react';
import { processoApi } from './obrasApi';

export interface RecursosPocos { usaMonitoramento: boolean; usaMapa: boolean; carregado: boolean }

let estado: RecursosPocos = { usaMonitoramento: false, usaMapa: false, carregado: false };
let pedido: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

export const recursosPocos = {
  get: () => estado,
  definir: (r: Pick<RecursosPocos, 'usaMonitoramento' | 'usaMapa'>) => {
    estado = { usaMonitoramento: r.usaMonitoramento, usaMapa: r.usaMapa, carregado: true };
    ouvintes.forEach(f => f());
  },
  carregar: () => {
    pedido ??= processoApi.config().then(c => recursosPocos.definir(c)).catch(() => { pedido = null; });
    return pedido;
  },
  assinar: (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
};

export const useRecursosPocos = () => {
  useEffect(() => { recursosPocos.carregar(); }, []);
  return useSyncExternalStore(recursosPocos.assinar, recursosPocos.get);
};

/** A seção aparece? Monitoramento e Mapa dependem da configuração; o resto sempre aparece. */
export const secaoLigada = (secao: string, r: Pick<RecursosPocos, 'usaMonitoramento' | 'usaMapa'>) =>
  secao === 'monitoramento' ? r.usaMonitoramento : secao === 'mapa' ? r.usaMapa : true;

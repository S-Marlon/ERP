// Estado do caixa compartilhado entre o cabeçalho do PDV (fora da página) e a tela de venda.
import { useSyncExternalStore } from 'react';
import { Caixa, caixaApi, ResumoCaixa } from './caixaApi';

export type PainelCaixa = null | 'abrir' | 'resumo' | 'SANGRIA' | 'SUPRIMENTO' | 'fechar';

interface EstadoCaixa {
  carregado: boolean;
  carregando: boolean;
  caixa: Caixa | null;
  resumo: ResumoCaixa | null;
  erro: string | null;
  painel: PainelCaixa;
}

let estado: EstadoCaixa = { carregado: false, carregando: false, caixa: null, resumo: null, erro: null, painel: null };
const ouvintes = new Set<() => void>();

const definir = (parcial: Partial<EstadoCaixa>) => {
  estado = { ...estado, ...parcial };
  ouvintes.forEach(o => o());
};

export const caixaStore = {
  async recarregar() {
    definir({ carregando: true });
    try {
      const r = await caixaApi.atual();
      definir({ caixa: r.caixa, resumo: r.resumo ?? null, erro: null, carregado: true });
    } catch (e) {
      definir({ erro: e instanceof Error ? e.message : 'Erro ao carregar o caixa.', carregado: true });
    } finally {
      definir({ carregando: false });
    }
  },
  mostrar(painel: PainelCaixa) { definir({ painel }); },
  aplicar(caixa: Caixa | null, resumo: ResumoCaixa | null) { definir({ caixa, resumo, erro: null, carregado: true }); },
};

export const useCaixa = () => useSyncExternalStore(
  (ouvinte) => { ouvintes.add(ouvinte); return () => { ouvintes.delete(ouvinte); }; },
  () => estado,
);

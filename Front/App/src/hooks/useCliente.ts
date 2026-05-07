/**
 * HOOK: useCliente
 * Gerenciamento de estado do cliente com useReducer pattern
 */

import { useReducer, useCallback, useState } from 'react';
import { clienteService } from '../services/clienteService';
import type { Cliente, ClienteFormData, ResumoVendas } from '../types/cliente.types';

// ======================================================================
// TIPOS
// ======================================================================

interface ClienteState {
  cliente: Cliente | null;
  loading: boolean;
  error: string | null;
  isDirty: boolean;
}

type ClienteAction =
  | { type: 'SET_CLIENTE'; payload: Cliente }
  | { type: 'UPDATE_CLIENTE'; payload: Partial<Cliente> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'MARK_DIRTY' }
  | { type: 'CLEAR_DIRTY' }
  | { type: 'RESET' };

// ======================================================================
// REDUCER
// ======================================================================

const initialState: ClienteState = {
  cliente: null,
  loading: false,
  error: null,
  isDirty: false,
};

function clienteReducer(state: ClienteState, action: ClienteAction): ClienteState {
  switch (action.type) {
    case 'SET_CLIENTE':
      return {
        ...state,
        cliente: action.payload,
        isDirty: false,
        error: null,
      };

    case 'UPDATE_CLIENTE':
      return {
        ...state,
        cliente: state.cliente
          ? { ...state.cliente, ...action.payload }
          : null,
        isDirty: true,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'MARK_DIRTY':
      return {
        ...state,
        isDirty: true,
      };

    case 'CLEAR_DIRTY':
      return {
        ...state,
        isDirty: false,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ======================================================================
// HOOK
// ======================================================================

export interface UseClienteReturn {
  state: ClienteState;
  cliente: Cliente | null;
  loading: boolean;
  error: string | null;
  isDirty: boolean;
  carregarCliente: (id: number) => Promise<void>;
  atualizarCliente: (dados: Partial<Cliente>) => void;
  salvarCliente: (dados: ClienteFormData) => Promise<Cliente | null>;
  novoCliente: () => void;
  limparErro: () => void;
  carregarVendas: () => Promise<ResumoVendas | null>;
}

export function useCliente(): UseClienteReturn {
  const [state, dispatch] = useReducer(clienteReducer, initialState);
  const [resumoVendas, setResumoVendas] = useState<ResumoVendas | null>(null);

  // ====================================================================
  // MÉTODOS
  // ====================================================================

  const carregarCliente = useCallback(async (id: number) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const cliente = await clienteService.obter(id);
      dispatch({ type: 'SET_CLIENTE', payload: cliente });
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar cliente';
      dispatch({ type: 'SET_ERROR', payload: mensagem });
    }
  }, []);

  const atualizarCliente = useCallback((dados: Partial<Cliente>) => {
    dispatch({ type: 'UPDATE_CLIENTE', payload: dados });
  }, []);

  const salvarCliente = useCallback(
    async (dados: ClienteFormData): Promise<Cliente | null> => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });

        let cliente: Cliente;

        if (state.cliente?.id_cliente) {
          // Atualizar cliente existente
          cliente = await clienteService.atualizar(state.cliente.id_cliente, dados);
        } else {
          // Criar novo cliente
          cliente = await clienteService.criar(dados);
        }

        dispatch({ type: 'SET_CLIENTE', payload: cliente });
        return cliente;
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : 'Erro ao salvar cliente';
        dispatch({ type: 'SET_ERROR', payload: mensagem });
        return null;
      }
    },
    [state.cliente?.id_cliente]
  );

  const novoCliente = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const limparErro = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const carregarVendas = useCallback(async (): Promise<ResumoVendas | null> => {
    try {
      if (!state.cliente?.id_cliente) return null;

      const vendas = await clienteService.obterVendas(state.cliente.id_cliente);

      if (vendas.length === 0) {
        return {
          total_vendas: 0,
          valor_total: 0,
          ticket_medio: 0,
          ultima_venda: new Date(),
        };
      }

      const valorTotal = vendas.reduce((acc, v) => acc + v.valor_total, 0);
      const ultimaVenda = new Date(
        Math.max(...vendas.map(v => new Date(v.data).getTime()))
      );

      const resumo: ResumoVendas = {
        total_vendas: vendas.length,
        valor_total: valorTotal,
        ticket_medio: valorTotal / vendas.length,
        ultima_venda: ultimaVenda,
      };

      setResumoVendas(resumo);
      return resumo;
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
      return null;
    }
  }, [state.cliente?.id_cliente]);

  // ====================================================================
  // RETORNO
  // ====================================================================

  return {
    state,
    cliente: state.cliente,
    loading: state.loading,
    error: state.error,
    isDirty: state.isDirty,
    carregarCliente,
    atualizarCliente,
    salvarCliente,
    novoCliente,
    limparErro,
    carregarVendas,
  };
}

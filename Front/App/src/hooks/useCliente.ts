/**
 * HOOK: useCliente
 * Gerenciamento completo do módulo de clientes
 * Arquitetura preparada para mock/API real
 */

import {
  useReducer,
  useCallback,
  useState,
} from 'react';

import { clienteService } from '../services/clienteService';

import type {
  Cliente,
  ClienteFormData,
  ResumoVendas,
} from '../types/cliente.types';

// ======================================================================
// TIPOS
// ======================================================================

interface ClienteState {
  clientes: Cliente[];
  cliente: Cliente | null;

  loading: boolean;
  error: string | null;

  isDirty: boolean;
}

type ClienteAction =
  | {
      type: 'SET_CLIENTES';
      payload: Cliente[];
    }

  | {
      type: 'SET_CLIENTE';
      payload: Cliente;
    }

  | {
      type: 'UPDATE_CLIENTE';
      payload: Partial<Cliente>;
    }

  | {
      type: 'SET_LOADING';
      payload: boolean;
    }

  | {
      type: 'SET_ERROR';
      payload: string | null;
    }

  | {
      type: 'MARK_DIRTY';
    }

  | {
      type: 'CLEAR_DIRTY';
    }

  | {
      type: 'RESET';
    };

// ======================================================================
// INITIAL STATE
// ======================================================================

const initialState: ClienteState = {
  clientes: [],
  cliente: null,

  loading: false,
  error: null,

  isDirty: false,
};

// ======================================================================
// REDUCER
// ======================================================================

function clienteReducer(
  state: ClienteState,
  action: ClienteAction
): ClienteState {
  switch (action.type) {
    case 'SET_CLIENTES':
      return {
        ...state,
        clientes: action.payload,
      };

    case 'SET_CLIENTE':
      return {
        ...state,
        cliente: action.payload,

        loading: false,
        error: null,

        isDirty: false,
      };

    case 'UPDATE_CLIENTE':
      return {
        ...state,

        cliente: state.cliente
          ? {
              ...state.cliente,
              ...action.payload,
            }
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
      return {
        ...state,
        cliente: null,
        isDirty: false,
      };

    default:
      return state;
  }
}

// ======================================================================
// RETURN TYPE
// ======================================================================

export interface UseClienteReturn {
  state: ClienteState;

  clientes: Cliente[];
  cliente: Cliente | null;

  loading: boolean;
  error: string | null;
  isDirty: boolean;

  carregarClientes: () => Promise<void>;

  carregarCliente: (
    id: number
  ) => Promise<void>;

  atualizarCliente: (
    dados: Partial<Cliente>
  ) => void;

  salvarCliente: (
    dados: ClienteFormData
  ) => Promise<Cliente | null>;

  novoCliente: () => void;

  limparErro: () => void;

  carregarVendas: () => Promise<ResumoVendas | null>;
}

// ======================================================================
// HOOK
// ======================================================================

export function useCliente(): UseClienteReturn {
  const [state, dispatch] = useReducer(
    clienteReducer,
    initialState
  );

  const [resumoVendas, setResumoVendas] =
    useState<ResumoVendas | null>(null);

  // ====================================================================
  // LISTAR CLIENTES
  // ====================================================================

  const carregarClientes = useCallback(
    async () => {
      try {
        dispatch({
          type: 'SET_LOADING',
          payload: true,
        });

        dispatch({
          type: 'SET_ERROR',
          payload: null,
        });

        const clientes =
          await clienteService.listar();

        dispatch({
          type: 'SET_CLIENTES',
          payload: clientes,
        });
      } catch (error) {
        const mensagem =
          error instanceof Error
            ? error.message
            : 'Erro ao carregar clientes';

        dispatch({
          type: 'SET_ERROR',
          payload: mensagem,
        });
      } finally {
        dispatch({
          type: 'SET_LOADING',
          payload: false,
        });
      }
    },
    []
  );

  // ====================================================================
  // CARREGAR CLIENTE
  // ====================================================================

  const carregarCliente = useCallback(
    async (id: number) => {
      try {
        dispatch({
          type: 'SET_LOADING',
          payload: true,
        });

        dispatch({
          type: 'SET_ERROR',
          payload: null,
        });

        const cliente =
          await clienteService.obter(id);

        dispatch({
          type: 'SET_CLIENTE',
          payload: cliente,
        });
      } catch (error) {
        const mensagem =
          error instanceof Error
            ? error.message
            : 'Erro ao carregar cliente';

        dispatch({
          type: 'SET_ERROR',
          payload: mensagem,
        });
      } finally {
        dispatch({
          type: 'SET_LOADING',
          payload: false,
        });
      }
    },
    []
  );

  // ====================================================================
  // ATUALIZAR CLIENTE LOCAL
  // ====================================================================

  const atualizarCliente = useCallback(
    (dados: Partial<Cliente>) => {
      dispatch({
        type: 'UPDATE_CLIENTE',
        payload: dados,
      });
    },
    []
  );

  // ====================================================================
  // SALVAR CLIENTE
  // ====================================================================

  const salvarCliente = useCallback(
    async (
      dados: ClienteFormData
    ): Promise<Cliente | null> => {
      try {
        dispatch({
          type: 'SET_LOADING',
          payload: true,
        });

        dispatch({
          type: 'SET_ERROR',
          payload: null,
        });

        let cliente: Cliente;

        // EDITAR

        if (state.cliente?.id_cliente) {
          cliente =
            await clienteService.atualizar(
              state.cliente.id_cliente,
              dados
            );
        }

        // NOVO

        else {
          cliente =
            await clienteService.criar(dados);
        }

        // Atualiza cliente atual

        dispatch({
          type: 'SET_CLIENTE',
          payload: cliente,
        });

        // Atualiza sidebar/lista

        const clientesAtualizados =
          await clienteService.listar();

        dispatch({
          type: 'SET_CLIENTES',
          payload: clientesAtualizados,
        });

        return cliente;
      } catch (error) {
        const mensagem =
          error instanceof Error
            ? error.message
            : 'Erro ao salvar cliente';

        dispatch({
          type: 'SET_ERROR',
          payload: mensagem,
        });

        return null;
      } finally {
        dispatch({
          type: 'SET_LOADING',
          payload: false,
        });
      }
    },
    [state.cliente]
  );

  // ====================================================================
  // NOVO CLIENTE
  // ====================================================================

  const novoCliente = useCallback(() => {
    dispatch({
      type: 'RESET',
    });
  }, []);

  // ====================================================================
  // LIMPAR ERRO
  // ====================================================================

  const limparErro = useCallback(() => {
    dispatch({
      type: 'SET_ERROR',
      payload: null,
    });
  }, []);

  // ====================================================================
  // RESUMO VENDAS
  // ====================================================================

  const carregarVendas = useCallback(
    async (): Promise<ResumoVendas | null> => {
      try {
        if (!state.cliente?.id_cliente) {
          return null;
        }

        // Chama o serviço para obter o resumo de vendas diretamente
        return await clienteService.obterResumoVendas(state.cliente.id_cliente);
      } catch (error) {
        console.error(
          'Erro ao carregar vendas:',
          error
        );

        return null;
      }
    },
    [state.cliente]
  );

  // ====================================================================
  // RETURN
  // ====================================================================

  return {
    state,

    clientes: state.clientes,
    cliente: state.cliente,

    loading: state.loading,
    error: state.error,

    isDirty: state.isDirty,

    carregarClientes,
    carregarCliente,

    atualizarCliente,
    salvarCliente,

    novoCliente,
    limparErro,

    carregarVendas,
  };
}
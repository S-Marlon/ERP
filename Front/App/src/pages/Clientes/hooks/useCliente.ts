/**
 * HOOK useCliente
 * Gerencia estado centralizado do cliente com useReducer
 * Padrão: Alinhado com useOrderService do PDV
 */

import { useReducer, useCallback, useMemo } from 'react';
import { clienteService } from '../services/clienteService';
import type {
  Cliente,
  ClienteUpdate,
  ClienteContato,
  ClienteContatoInput,
  ClienteEmail,
  ClienteEmailInput,
  ClientePrecoEspecial,
  ClientePrecoEspecialInput,
  ContaReceber,
  Venda,
  ResumoFinanceiro,
  ResumoVendas,
  ClienteState,
  ClienteAction,
} from '../types/cliente.types';

/**
 * Reducer para gerenciar estado do cliente
 */
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
      if (!state.cliente) return state;
      return {
        ...state,
        cliente: { ...state.cliente, ...action.payload },
        isDirty: true,
      };

    case 'SET_CONTATOS':
      return { ...state, contatos: action.payload, error: null };

    case 'ADD_CONTATO':
      return {
        ...state,
        contatos: [...state.contatos, action.payload],
        isDirty: true,
      };

    case 'REMOVE_CONTATO':
      return {
        ...state,
        contatos: state.contatos.filter((c) => c.id_contato !== action.payload),
        isDirty: true,
      };

    case 'UPDATE_CONTATO':
      return {
        ...state,
        contatos: state.contatos.map((c) =>
          c.id_contato === action.payload.id_contato ? action.payload : c
        ),
        isDirty: true,
      };

    case 'SET_EMAILS':
      return { ...state, emails: action.payload, error: null };

    case 'ADD_EMAIL':
      return {
        ...state,
        emails: [...state.emails, action.payload],
        isDirty: true,
      };

    case 'REMOVE_EMAIL':
      return {
        ...state,
        emails: state.emails.filter((e) => e.id_email !== action.payload),
        isDirty: true,
      };

    case 'UPDATE_EMAIL':
      return {
        ...state,
        emails: state.emails.map((e) =>
          e.id_email === action.payload.id_email ? action.payload : e
        ),
        isDirty: true,
      };

    case 'SET_PRECOS_ESPECIAIS':
      return { ...state, precosEspeciais: action.payload, error: null };

    case 'ADD_PRECO_ESPECIAL':
      return {
        ...state,
        precosEspeciais: [...state.precosEspeciais, action.payload],
        isDirty: true,
      };

    case 'REMOVE_PRECO_ESPECIAL':
      return {
        ...state,
        precosEspeciais: state.precosEspeciais.filter((p) => p.id_regra !== action.payload),
        isDirty: true,
      };

    case 'UPDATE_PRECO_ESPECIAL':
      return {
        ...state,
        precosEspeciais: state.precosEspeciais.map((p) =>
          p.id_regra === action.payload.id_regra ? action.payload : p
        ),
        isDirty: true,
      };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'MARK_DIRTY':
      return { ...state, isDirty: true };

    case 'MARK_SAVED':
      return { ...state, isDirty: false, savedAt: new Date(), error: null };

    case 'RESET':
      return {
        cliente: null,
        contatos: [],
        emails: [],
        precosEspeciais: [],
        loading: false,
        error: null,
        isDirty: false,
      };

    default:
      return state;
  }
}

/**
 * Estado inicial
 */
const INITIAL_STATE: ClienteState = {
  cliente: null,
  contatos: [],
  emails: [],
  precosEspeciais: [],
  loading: false,
  error: null,
  isDirty: false,
};

/**
 * Tipo de retorno do hook
 */
export interface UseClienteReturn {
  // State
  state: ClienteState;
  cliente: Cliente | null;
  contatos: ClienteContato[];
  emails: ClienteEmail[];
  precosEspeciais: ClientePrecoEspecial[];
  loading: boolean;
  error: string | null;
  isDirty: boolean;

  // Cliente
  carregarCliente: (id: number) => Promise<void>;
  atualizarCliente: (dados: ClienteUpdate) => void;
  salvarCliente: () => Promise<Cliente | null>;
  novoCliente: () => void;
  limparErro: () => void;

  // Contatos
  adicionarContato: (contato: ClienteContatoInput) => Promise<void>;
  atualizarContato: (id_contato: number, dados: Partial<ClienteContatoInput>) => Promise<void>;
  removerContato: (id_contato: number) => Promise<void>;

  // Emails
  adicionarEmail: (email: ClienteEmailInput) => Promise<void>;
  atualizarEmail: (id_email: number, dados: Partial<ClienteEmailInput>) => Promise<void>;
  removerEmail: (id_email: number) => Promise<void>;

  // Preços Especiais
  adicionarPrecoEspecial: (preco: ClientePrecoEspecialInput) => Promise<void>;
  atualizarPrecoEspecial: (
    id_regra: number,
    dados: Partial<ClientePrecoEspecialInput>
  ) => Promise<void>;
  removerPrecoEspecial: (id_regra: number) => Promise<void>;

  // Financeiro
  carregarFinanceiro: () => Promise<ResumoFinanceiro | null>;
  carregarVendas: () => Promise<ResumoVendas | null>;

  // Reset
  resetar: () => void;
}

/**
 * Hook principal para gerenciar cliente
 */
export const useCliente = (): UseClienteReturn => {
  const [state, dispatch] = useReducer(clienteReducer, INITIAL_STATE);

  // =========================================================================
  // CLIENTE
  // =========================================================================

  const carregarCliente = useCallback(async (id: number) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const cliente = await clienteService.obter(id);
      dispatch({ type: 'SET_CLIENTE', payload: cliente });

      // Carregar relacionados
      const [contatos, emails, precos] = await Promise.all([
        clienteService.obterContatos(id),
        clienteService.obterEmails(id),
        clienteService.obterPrecosEspeciais(id),
      ]);

      dispatch({ type: 'SET_CONTATOS', payload: contatos });
      dispatch({ type: 'SET_EMAILS', payload: emails });
      dispatch({ type: 'SET_PRECOS_ESPECIAIS', payload: precos });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Erro ao carregar cliente',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const atualizarCliente = useCallback((dados: ClienteUpdate) => {
    dispatch({ type: 'UPDATE_CLIENTE', payload: dados });
  }, []);

  const salvarCliente = useCallback(async (): Promise<Cliente | null> => {
    if (!state.cliente) {
      dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
      return null;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const resultado = await clienteService.atualizar(
        state.cliente.id_cliente,
        state.cliente as ClienteUpdate
      );
      dispatch({ type: 'SET_CLIENTE', payload: resultado });
      dispatch({ type: 'MARK_SAVED' });
      return resultado;
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Erro ao salvar cliente',
      });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.cliente]);

  const novoCliente = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const limparErro = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // =========================================================================
  // CONTATOS
  // =========================================================================

  const adicionarContato = useCallback(
    async (contato: ClienteContatoInput) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        const resultado = await clienteService.adicionarContato(state.cliente.id_cliente, contato);
        dispatch({ type: 'ADD_CONTATO', payload: resultado });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao adicionar contato',
        });
      }
    },
    [state.cliente]
  );

  const atualizarContato = useCallback(
    async (id_contato: number, dados: Partial<ClienteContatoInput>) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        const resultado = await clienteService.atualizarContato(
          state.cliente.id_cliente,
          id_contato,
          dados
        );
        dispatch({ type: 'UPDATE_CONTATO', payload: resultado });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao atualizar contato',
        });
      }
    },
    [state.cliente]
  );

  const removerContato = useCallback(
    async (id_contato: number) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        await clienteService.removerContato(state.cliente.id_cliente, id_contato);
        dispatch({ type: 'REMOVE_CONTATO', payload: id_contato });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao remover contato',
        });
      }
    },
    [state.cliente]
  );

  // =========================================================================
  // EMAILS
  // =========================================================================

  const adicionarEmail = useCallback(
    async (email: ClienteEmailInput) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        const resultado = await clienteService.adicionarEmail(state.cliente.id_cliente, email);
        dispatch({ type: 'ADD_EMAIL', payload: resultado });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao adicionar email',
        });
      }
    },
    [state.cliente]
  );

  const atualizarEmail = useCallback(
    async (id_email: number, dados: Partial<ClienteEmailInput>) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        const resultado = await clienteService.atualizarEmail(
          state.cliente.id_cliente,
          id_email,
          dados
        );
        dispatch({ type: 'UPDATE_EMAIL', payload: resultado });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao atualizar email',
        });
      }
    },
    [state.cliente]
  );

  const removerEmail = useCallback(
    async (id_email: number) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        await clienteService.removerEmail(state.cliente.id_cliente, id_email);
        dispatch({ type: 'REMOVE_EMAIL', payload: id_email });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao remover email',
        });
      }
    },
    [state.cliente]
  );

  // =========================================================================
  // PREÇOS ESPECIAIS
  // =========================================================================

  const adicionarPrecoEspecial = useCallback(
    async (preco: ClientePrecoEspecialInput) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        const resultado = await clienteService.adicionarPrecoEspecial(
          state.cliente.id_cliente,
          preco
        );
        dispatch({ type: 'ADD_PRECO_ESPECIAL', payload: resultado });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao adicionar preço especial',
        });
      }
    },
    [state.cliente]
  );

  const atualizarPrecoEspecial = useCallback(
    async (id_regra: number, dados: Partial<ClientePrecoEspecialInput>) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        const resultado = await clienteService.atualizarPrecoEspecial(
          state.cliente.id_cliente,
          id_regra,
          dados
        );
        dispatch({ type: 'UPDATE_PRECO_ESPECIAL', payload: resultado });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao atualizar preço especial',
        });
      }
    },
    [state.cliente]
  );

  const removerPrecoEspecial = useCallback(
    async (id_regra: number) => {
      if (!state.cliente) {
        dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
        return;
      }

      try {
        await clienteService.removerPrecoEspecial(state.cliente.id_cliente, id_regra);
        dispatch({ type: 'REMOVE_PRECO_ESPECIAL', payload: id_regra });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          payload: err instanceof Error ? err.message : 'Erro ao remover preço especial',
        });
      }
    },
    [state.cliente]
  );

  // =========================================================================
  // FINANCEIRO E HISTÓRICO
  // =========================================================================

  const carregarFinanceiro = useCallback(async (): Promise<ResumoFinanceiro | null> => {
    if (!state.cliente) {
      dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
      return null;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const resultado = await clienteService.obterFinanceiro(state.cliente.id_cliente);
      return resultado;
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Erro ao carregar financeiro',
      });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.cliente]);

  const carregarVendas = useCallback(async (): Promise<ResumoVendas | null> => {
    if (!state.cliente) {
      dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
      return null;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const resultado = await clienteService.obterResumoVendas(state.cliente.id_cliente);
      return resultado;
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Erro ao carregar vendas',
      });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.cliente]);

  // =========================================================================
  // RESET
  // =========================================================================

  const resetar = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // =========================================================================
  // RETORNO
  // =========================================================================

  return useMemo(
    () => ({
      // State
      state,
      cliente: state.cliente,
      contatos: state.contatos,
      emails: state.emails,
      precosEspeciais: state.precosEspeciais,
      loading: state.loading,
      error: state.error,
      isDirty: state.isDirty,

      // Cliente
      carregarCliente,
      atualizarCliente,
      salvarCliente,
      novoCliente,
      limparErro,

      // Contatos
      adicionarContato,
      atualizarContato,
      removerContato,

      // Emails
      adicionarEmail,
      atualizarEmail,
      removerEmail,

      // Preços Especiais
      adicionarPrecoEspecial,
      atualizarPrecoEspecial,
      removerPrecoEspecial,

      // Financeiro
      carregarFinanceiro,
      carregarVendas,

      // Reset
      resetar,
    }),
    [
      state,
      carregarCliente,
      atualizarCliente,
      salvarCliente,
      novoCliente,
      limparErro,
      adicionarContato,
      atualizarContato,
      removerContato,
      adicionarEmail,
      atualizarEmail,
      removerEmail,
      adicionarPrecoEspecial,
      atualizarPrecoEspecial,
      removerPrecoEspecial,
      carregarFinanceiro,
      carregarVendas,
      resetar,
    ]
  );
};

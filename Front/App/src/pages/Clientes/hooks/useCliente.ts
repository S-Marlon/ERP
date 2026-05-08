/**
 * HOOK useCliente
 * Gerencia estado centralizado do cliente com useReducer
 * Padrão: Alinhado com useOrderService do PDV
 */

import { useReducer, useCallback, useMemo } from 'react';
// Modo mock: dados em memória para testes locais
import { useRef } from 'react';
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
  const [state, dispatch] = useReducer(clienteReducer, INITIAL_STATE);

  // MOCK: lista de clientes em memória
  const clientesMock = useRef<Cliente[]>([
    {
      id_cliente: 1,
      nome_razao: 'Cliente Exemplo A',
      cpf_cnpj: '123.456.789-00',
      tipo_cliente: 'CONSUMIDOR',
      endereco: 'Rua das Flores, 123',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
      limite_credito: 1000,
      dia_vencimento: 10,
      status_credito: 'LIBERADO',
      status_cliente: 'ATIVO',
      saldo_devedor_atual: 0,
      observacoes: 'Cliente de teste',
      criado_em: new Date(),
    },
    {
      id_cliente: 2,
      nome_razao: 'Cliente Exemplo B',
      cpf_cnpj: '98.765.432/0001-11',
      tipo_cliente: 'SERRALHERIA',
      endereco: 'Av. Brasil, 456',
      bairro: 'Jardins',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      cep: '20000-000',
      limite_credito: 500,
      dia_vencimento: 5,
      status_credito: 'ANALISE',
      status_cliente: 'ATIVO',
      saldo_devedor_atual: 120,
      observacoes: '',
      criado_em: new Date(),
    },
    {
      id_cliente: 3,
      nome_razao: 'Loja Demo',
      cpf_cnpj: '111.222.333-44',
      tipo_cliente: 'OFICINA',
      endereco: 'Rua Teste, 789',
      bairro: 'Industrial',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      cep: '30000-000',
      limite_credito: 0,
      dia_vencimento: 20,
      status_credito: 'BLOQUEADO',
      status_cliente: 'BLOQUEADO',
      saldo_devedor_atual: 300,
      observacoes: 'Bloqueado por atraso',
      criado_em: new Date(),
    },
  ]);

  // MOCK: contatos, emails, preços especiais em memória
  const contatosMock = useRef<Record<number, ClienteContato[]>>({
    1: [
      { id_contato: 1, id_cliente: 1, tipo: 'CELULAR', numero: '(11) 99999-0001', nome_referencia: 'João' },
    ],
    2: [
      { id_contato: 2, id_cliente: 2, tipo: 'FIXO', numero: '(21) 2222-3333', nome_referencia: 'Maria' },
    ],
    3: [],
  });
  const emailsMock = useRef<Record<number, ClienteEmail[]>>({
    1: [
      { id_email: 1, id_cliente: 1, email: 'exemploA@email.com', tipo: 'PESSOAL' },
    ],
    2: [],
    3: [],
  });
  const precosMock = useRef<Record<number, ClientePrecoEspecial[]>>({
    1: [],
    2: [],
    3: [],
  });

  // =========================================================================
  // CLIENTE
  // =========================================================================

  // Carrega cliente do mock
  const carregarCliente = useCallback(async (id: number) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const cliente = clientesMock.current.find((c) => c.id_cliente === id) || null;
      dispatch({ type: 'SET_CLIENTE', payload: cliente });
      dispatch({ type: 'SET_CONTATOS', payload: contatosMock.current[id] || [] });
      dispatch({ type: 'SET_EMAILS', payload: emailsMock.current[id] || [] });
      dispatch({ type: 'SET_PRECOS_ESPECIAIS', payload: precosMock.current[id] || [] });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Erro ao carregar cliente (mock)' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const atualizarCliente = useCallback((dados: ClienteUpdate) => {
    dispatch({ type: 'UPDATE_CLIENTE', payload: dados });
  }, []);

  // Salva cliente no mock
  const salvarCliente = useCallback(async (): Promise<Cliente | null> => {
    if (!state.cliente) {
      dispatch({ type: 'SET_ERROR', payload: 'Nenhum cliente carregado' });
      return null;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      let cliente = state.cliente;
      if (cliente.id_cliente) {
        // Atualiza existente
        const idx = clientesMock.current.findIndex((c) => c.id_cliente === cliente.id_cliente);
        if (idx !== -1) clientesMock.current[idx] = { ...cliente };
      } else {
        // Cria novo
        const novoId = Math.max(...clientesMock.current.map((c) => c.id_cliente), 0) + 1;
        cliente = { ...cliente, id_cliente: novoId, criado_em: new Date() } as Cliente;
        clientesMock.current.push(cliente);
      }
      dispatch({ type: 'SET_CLIENTE', payload: cliente });
      dispatch({ type: 'MARK_SAVED' });
      return cliente;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Erro ao salvar cliente (mock)' });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.cliente]);

  // Novo cliente mock
  const novoCliente = useCallback(() => {
    dispatch({ type: 'SET_CLIENTE', payload: {
      id_cliente: 0,
      nome_razao: '',
      cpf_cnpj: '',
      tipo_cliente: 'CONSUMIDOR',
      endereco: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      limite_credito: 0,
      dia_vencimento: 1,
      status_credito: 'LIBERADO',
      status_cliente: 'ATIVO',
      saldo_devedor_atual: 0,
      observacoes: '',
      criado_em: new Date(),
    } });
    dispatch({ type: 'SET_CONTATOS', payload: [] });
    dispatch({ type: 'SET_EMAILS', payload: [] });
    dispatch({ type: 'SET_PRECOS_ESPECIAIS', payload: [] });
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

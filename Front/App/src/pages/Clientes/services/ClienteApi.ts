import type { ClienteEntity } from '../types/cliente.entity'; // Dica: mude o nome desse arquivo para pessoa.entity futuramente
import type { ClienteAggregate } from '../types/cliente.aggregate';

/*
|--------------------------------------------------------------------------
| BASE URL (Atualizado para o modelo generalizado de pessoas)
|--------------------------------------------------------------------------
*/
const API_BASE_URL = 'http://localhost:3001/api/pessoas';

/*
|--------------------------------------------------------------------------
| PESSOAS / CLIENTES (LISTA)
|--------------------------------------------------------------------------
*/
export const getClientes = async (): Promise<ClienteEntity[]> => {
  const response = await fetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error(`Erro ao buscar pessoas (${response.status})`);
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| PESSOA POR ID (COMPLETO)
|--------------------------------------------------------------------------
*/
export const getClienteById = async (
  id_pessoa: number
): Promise<ClienteAggregate> => {
  const response = await fetch(`${API_BASE_URL}/${id_pessoa}`);

  if (!response.ok) {
    throw new Error(`Erro ao buscar dados da pessoa (${response.status})`);
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| PREÇOS ESPECIAIS
|--------------------------------------------------------------------------
*/
export interface ClientePrecoEspecialEntity {
  id: number;
  id_pessoa: number; // Atualizado de id_cliente
  id_produto: number;
  tipo_desconto: 'VALOR_FIXO' | 'PERCENTUAL';
  valor: number;
  preco_final?: number;
  percentual_desconto?: number;
  ativo: boolean;
  data_inicio?: string;
  data_fim?: string;
}

export const getPrecosEspeciais = async (
  id_pessoa: number
): Promise<ClientePrecoEspecialEntity[]> => {
  const response = await fetch(
    `${API_BASE_URL}/${id_pessoa}/precos-especiais`
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao buscar preços especiais (${response.status})`
    );
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| ABA GERAL (DTO LIMPO)
|--------------------------------------------------------------------------
*/
export interface ClienteGeralDTO {
  nome_razao: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  telefone_principal?: string;
  whatsapp?: string;
  segmento?: string;
  status?: string; // Atualizado: era status_cliente
  endereco?: {
    logradouro?: string;
    cidade?: string;
    estado?: string;
  };
}

export const getClienteGeral = async (
  id_pessoa: number
): Promise<ClienteGeralDTO> => {
  const response = await fetch(
    `${API_BASE_URL}/${id_pessoa}/geral`
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao carregar dados gerais (${response.status})`
    );
  }

  return response.json();
};

export const updateClienteGeral = async (
  id_pessoa: number,
  dados: ClienteGeralDTO
): Promise<ClienteAggregate> => {
  const response = await fetch(
    `${API_BASE_URL}/${id_pessoa}/geral`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dados),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao salvar dados gerais (${response.status})`
    );
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| VENDAS
|--------------------------------------------------------------------------
*/
export interface VendaDTO {
  id_venda: number;
  data: string;
  valor_total: number;
  metodo_pagamento: string;
}

export const getVendasCliente = async (
  id_pessoa: number
): Promise<VendaDTO[]> => {
  const response = await fetch(
    `${API_BASE_URL}/${id_pessoa}/vendas`
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao buscar vendas (${response.status})`
    );
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| HISTÓRICO (TIMELINE CRM)
|--------------------------------------------------------------------------
*/
export interface ClienteEventoDTO {
  id: number;
  id_pessoa: number; // Atualizado de id_cliente

  tipo: string;
  origem?: string;

  referencia_tipo?: string;
  referencia_id?: number;

  valor?: number;
  payload?: Record<string, any>;
  data_evento: string;
}

export interface HistoricoResponseDTO {
  data: ClienteEventoDTO[];
  total: number;
  page: number;
  limit: number;
}

export const getHistoricoCliente = async (
  id_pessoa: number,
  page = 1,
  limit = 50
): Promise<HistoricoResponseDTO> => {
  // Trava de segurança no front-end para impedir requisições inválidas de gerarem "undefined" na URL
  if (!id_pessoa || String(id_pessoa) === 'undefined') {
    return { data: [], total: 0, page, limit };
  }

  const response = await fetch(
    `${API_BASE_URL}/${id_pessoa}/historico?page=${page}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao buscar histórico (${response.status})`
    );
  }

  return response.json();
};
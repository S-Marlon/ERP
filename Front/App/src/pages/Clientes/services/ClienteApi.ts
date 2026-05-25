// // frontend/src/api/clienteApi.ts

// import { Cliente } from '../types/cliente.types';

// const API_BASE_URL =
//   'http://localhost:3001/api/clientes';

// /*
// |--------------------------------------------------------------------------
// | CLIENTES
// |--------------------------------------------------------------------------
// */

// export const getClientes = async (): Promise<
//   Cliente[]
// > => {
//   try {
//     const response = await fetch(
//       API_BASE_URL
//     );

//     if (!response.ok) {
//       throw new Error(
//         `Erro ao buscar clientes (${response.status})`
//       );
//     }

//     return await response.json();
//   } catch (error) {
//     console.error(
//       'Erro ao carregar clientes:',
//       error
//     );

//     throw error;
//   }
// };

// export const getClienteById = async (
//   id: number
// ): Promise<Cliente> => {
//   try {
//     const response = await fetch(
//       `${API_BASE_URL}/${id}`
//     );

//     if (!response.ok) {
//       throw new Error(
//         `Erro ao buscar cliente (${response.status})`
//       );
//     }

//     return await response.json();
//   } catch (error) {
//     console.error(
//       `Erro ao buscar cliente ${id}:`,
//       error
//     );

//     throw error;
//   }
// };

// /*
// |--------------------------------------------------------------------------
// | PREÇOS ESPECIAIS
// |--------------------------------------------------------------------------
// */

// export const getPrecosEspeciais = async (
//   id: number
// ): Promise<any[]> => {
//   try {
//     const response = await fetch(
//       `${API_BASE_URL}/${id}/precos-especiais`
//     );

//     if (!response.ok) {
//       throw new Error(
//         `Erro ao buscar preços especiais (${response.status})`
//       );
//     }

//     return await response.json();
//   } catch (error) {
//     console.error(
//       `Erro ao buscar preços especiais do cliente ${id}:`,
//       error
//     );

//     throw error;
//   }
// };

// /*
// |--------------------------------------------------------------------------
// | ABA GERAL
// |--------------------------------------------------------------------------
// */

// export const getClienteGeral = async (
//   idCliente: number
// ): Promise<any> => {
//   try {
//     const response = await fetch(
//       `${API_BASE_URL}/${idCliente}/geral`
//     );

//     if (!response.ok) {
//       throw new Error(
//         `Erro ao carregar dados gerais do cliente (${response.status})`
//       );
//     }

//     return await response.json();
//   } catch (error) {
//     console.error(
//       `Erro ao buscar aba geral do cliente ${idCliente}:`,
//       error
//     );

//     throw error;
//   }
// };

// export const updateClienteGeral = async (
//   idCliente: number,
//   dados: any
// ): Promise<any> => {
//   try {
//     const response = await fetch(
//       `${API_BASE_URL}/${idCliente}/geral`,
//       {
//         method: 'PUT',

//         headers: {
//           'Content-Type':
//             'application/json',
//         },

//         body: JSON.stringify(dados),
//       }
//     );

//     if (!response.ok) {
//       throw new Error(
//         `Erro ao salvar dados gerais do cliente (${response.status})`
//       );
//     }

//     return await response.json();
//   } catch (error) {
//     console.error(
//       `Erro ao atualizar aba geral do cliente ${idCliente}:`,
//       error
//     );

//     throw error;
//   }
// };

// /*
// |--------------------------------------------------------------------------
// | HISTÓRICO DE VENDAS
// |--------------------------------------------------------------------------
// */

// export const getVendasCliente = async (
//   id: number
// ): Promise<any[]> => {
//   try {
//     const response = await fetch(
//       `${API_BASE_URL}/${id}/vendas`
//     );

//     if (!response.ok) {
//       throw new Error(
//         `Erro ao buscar vendas (${response.status})`
//       );
//     }

//     return await response.json();
//   } catch (error) {
//     console.error(
//       `Erro ao buscar vendas do cliente ${id}:`,
//       error
//     );

//     throw error;
//   }
// };

// /*
// |--------------------------------------------------------------------------
// | HISTÓRICO UNIFICADO (TIMELINE CRM)
// |--------------------------------------------------------------------------
// */

// export const getHistoricoCliente = async (
//   id: number,
//   page = 1,
//   limit = 50
// ): Promise<any> => {
//   try {
//     const response = await fetch(
//       `${API_BASE_URL}/${id}/historico?page=${page}&limit=${limit}`
//     );

//     if (!response.ok) {
//       throw new Error(
//         `Erro ao buscar histórico (${response.status})`
//       );
//     }

//     return await response.json();
//   } catch (error) {
//     console.error(
//       `Erro ao buscar histórico do cliente ${id}:`,
//       error
//     );

//     throw error;
//   }
// };

// frontend/src/api/clienteApi.ts

import type { ClienteEntity } from '../types/cliente.entity';
import type { ClienteAggregate } from '../types/cliente.aggregate';

/*
|--------------------------------------------------------------------------
| BASE URL
|--------------------------------------------------------------------------
*/

const API_BASE_URL = 'http://localhost:3001/api/clientes';

/*
|--------------------------------------------------------------------------
| CLIENTES (LISTA - ENTITY)
|--------------------------------------------------------------------------
| Retorna dados simples da tabela clientes
*/

export const getClientes = async (): Promise<ClienteEntity[]> => {
  const response = await fetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error(`Erro ao buscar clientes (${response.status})`);
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| CLIENTE POR ID (AGGREGATE)
|--------------------------------------------------------------------------
| Retorna cliente completo (CRM + financeiro + contatos + emails etc)
*/

export const getClienteById = async (
  id: number
): Promise<ClienteAggregate> => {
  const response = await fetch(`${API_BASE_URL}/${id}`);

  if (!response.ok) {
    throw new Error(`Erro ao buscar cliente (${response.status})`);
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
  id_cliente: number;
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
  id: number
): Promise<ClientePrecoEspecialEntity[]> => {
  const response = await fetch(
    `${API_BASE_URL}/${id}/precos-especiais`
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

  status_cliente?: string;

  endereco?: {
    logradouro?: string;
    cidade?: string;
    estado?: string;
  };
}

export const getClienteGeral = async (
  idCliente: number
): Promise<ClienteGeralDTO> => {
  const response = await fetch(
    `${API_BASE_URL}/${idCliente}/geral`
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao carregar dados gerais do cliente (${response.status})`
    );
  }

  return response.json();
};

export const updateClienteGeral = async (
  idCliente: number,
  dados: ClienteGeralDTO
): Promise<ClienteAggregate> => {
  const response = await fetch(
    `${API_BASE_URL}/${idCliente}/geral`,
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
      `Erro ao salvar dados gerais do cliente (${response.status})`
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
  id: number
): Promise<VendaDTO[]> => {
  const response = await fetch(
    `${API_BASE_URL}/${id}/vendas`
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
  id_cliente: number;

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
  id: number,
  page = 1,
  limit = 50
): Promise<HistoricoResponseDTO> => {
  const response = await fetch(
    `${API_BASE_URL}/${id}/historico?page=${page}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao buscar histórico (${response.status})`
    );
  }

  return response.json();
};
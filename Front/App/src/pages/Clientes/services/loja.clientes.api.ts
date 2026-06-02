/*
|--------------------------------------------------------------------------
| LOJA API BASE
|--------------------------------------------------------------------------
*/

const LOJA_API = 'http://localhost:3001/api/loja';

/*
|--------------------------------------------------------------------------
| TIPOS - HISTÓRICO DO CLIENTE (LOJA)
|--------------------------------------------------------------------------
*/

export interface LojaClienteHistoricoReferenciaDTO {
  tipo?: string;
  id?: number;
}

export interface LojaClienteHistoricoMetadata {
  [key: string]: any;
}

export interface LojaClienteHistoricoDTO {
  id: number;
  id_cliente: number;

  tipo: string;
  origem?: string;
  canal?: string;

  referencia?: LojaClienteHistoricoReferenciaDTO;

  titulo: string;
  descricao?: string;

  valor?: number;

  metadata?: LojaClienteHistoricoMetadata;

  criado_por?: number;

  created_at: string;
  updated_at?: string;
}

/*
|--------------------------------------------------------------------------
| HISTÓRICO DO CLIENTE (LOJA)
|--------------------------------------------------------------------------
| Timeline comercial do cliente (vendas, atendimento, pagamentos etc)
|--------------------------------------------------------------------------
*/

export const getHistoricoCliente = async (
  id: number,
  page = 1,
  limit = 50
): Promise<LojaClienteHistoricoDTO[]> => {
  const res = await fetch(
    `${LOJA_API}/${id}/historico?page=${page}&limit=${limit}`
  );

  if (!res.ok) {
    throw new Error(
      `Erro ao buscar histórico do cliente ${id} (${res.status})`
    );
  }

  return res.json();
};
import type { Familia, FamiliaAttribute } from '../types';

/*
|--------------------------------------------------------------------------
| BASE URL (Módulo de Famílias / Stock Entry)
|--------------------------------------------------------------------------
*/
const API_BASE_URL = 'http://localhost:3001/api/catalogo/cadastros/familias';/*
|--------------------------------------------------------------------------
| FAMÍLIAS (LISTA)
|--------------------------------------------------------------------------
*/
export const getFamilias = async (): Promise<Familia[]> => {
  const response = await fetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error(`Erro ao buscar famílias (${response.status})`);
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| FAMÍLIA POR ID
|--------------------------------------------------------------------------
*/
export const getFamiliaById = async (
  id_familia: string
): Promise<Familia> => {
  const response = await fetch(`${API_BASE_URL}/${id_familia}`);

  if (!response.ok) {
    throw new Error(`Erro ao buscar dados da família (${response.status})`);
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| CRIAR FAMÍLIA
|--------------------------------------------------------------------------
*/
export const createFamilia = async (
  dados: Partial<Familia>
): Promise<Familia> => {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dados),
  });

  if (!response.ok) {
    throw new Error(`Erro ao criar família (${response.status})`);
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| ATUALIZAR FAMÍLIA
|--------------------------------------------------------------------------
*/
export const updateFamilia = async (
  id_familia: string,
  dados: Partial<Familia>
): Promise<Familia> => {
  const response = await fetch(`${API_BASE_URL}/${id_familia}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dados),
  });

  if (!response.ok) {
    throw new Error(`Erro ao atualizar família (${response.status})`);
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| EXCLUIR FAMÍLIA
|--------------------------------------------------------------------------
*/
export const deleteFamilia = async (
  id_familia: string
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/${id_familia}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Erro ao excluir família (${response.status})`);
  }
};
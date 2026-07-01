import { Categoria } from './CategoryManager.types';

// Altere de '/api' para '/api/estoque' para casar com o app.use do seu server.ts
const API_BASE_URL = 'http://localhost:3001/api/estoque';

// --- INTERFACES ---

export interface CreateCategoryPayload {
  nome: string;
  id_categoria_pai: string | null;
  percentual_margem_sugerida: number | null;
  modo_exibicao: 'grade' | 'lista' | 'carrossel';
  descricao?: string;
}

export interface UpdateCategoryPayload {
  nome?: string; 
  id_categoria_pai?: string | null;
  ativa?: boolean;
  ordem?: number;
  percentual_margem_sugerida?: number | null;
  modo_exibicao?: 'grade' | 'lista' | 'carrossel';
  descricao?: string;
  atributos_heranca?: unknown[]; 
  seo?: { metaTitle?: string; metaDescription?: string; tags?: string };
  integracoes?: { erpId?: string; vtexId?: string; mercadolivreId?: string };
  assets?: { iconeUrl?: string; bannerUrl?: string };
}

export interface GenericAPIResponse {
  success: boolean;
  message: string;
  id_categoria?: string;
}

// Helper para centralizar os headers padrões
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// Helper para tratar respostas e erros de forma padronizada
const handleResponse = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Tenta buscar 'error' ou 'message' do backend antes do fallback
    throw new Error(errorData.error || errorData.message || defaultError);
  }
  return response.json();
};

// ==========================================
// MÓDULO DE CATEGORIAS GLOBAL (CRUD)
// ==========================================

// 🔄 [READ] Buscar todas as categorias higienizadas
export const getCategories = async (tenantId: number = 1): Promise<Categoria[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/categorias?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const categorias = await handleResponse<Categoria[]>(response, 'Erro ao carregar a malha de categorias do servidor.');

  // INTERCEPTADOR/HIGIENIZADOR: Garante que os nós internos existam mesmo se a API mandar {} ou null
  return categorias.map((cat: any) => ({
    ...cat,
    id_categoria: String(cat.id_categoria), // Garante tipo string para ids vindos como int do MySQL
    id_categoria_pai: cat.id_categoria_pai ? String(cat.id_categoria_pai) : null,
    atributos_heranca: Array.isArray(cat.atributos_heranca) ? cat.atributos_heranca : [],
    seo: {
      tags: cat.seo?.tags || '',
      metaTitle: cat.seo?.metaTitle || '',
      metaDescription: cat.seo?.metaDescription || '',
      ...cat.seo 
    },
    integracoes: {
      erpId: cat.integracoes?.erpId || '',
      vtexId: cat.integracoes?.vtexId || '',
      mercadolivreId: cat.integracoes?.mercadolivreId || '',
      ...cat.integracoes 
    }
  }));
};

// 🟢 [CREATE] Criar uma nova categoria
export const createCategory = async (data: CreateCategoryPayload, tenantId: number = 1): Promise<GenericAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/categorias`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      tenant_id: tenantId,
      ...data
    }),
  });

  return handleResponse<GenericAPIResponse>(response, 'Erro ao criar nova categoria no servidor.');
};

// 🟡 [UPDATE] Atualizar os dados de uma categoria existente
export const updateCategory = async (idCategoria: string, data: UpdateCategoryPayload, tenantId: number = 1): Promise<GenericAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/categorias/${idCategoria}?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data),
  });

  return handleResponse<GenericAPIResponse>(response, 'Erro ao atualizar dados da categoria no servidor.');
};

// 🗑️ [DELETE] 🟢 ADICIONADO: Remover categoria física do banco de dados
export const deleteCategory = async (idCategoria: string, tenantId: number = 1): Promise<GenericAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/categorias/${idCategoria}?tenant_id=${tenantId}`, {
    method: 'DELETE',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<GenericAPIResponse>(response, 'Erro ao excluir a categoria selecionada do servidor.');
};

// 🔀 [PATCH] Atualizar ordenação via drag-and-drop ou restruturação em massa
export const updateCategoriesOrder = async (orderMap: { id: string; ordem: number }[], tenantId: number = 1): Promise<GenericAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/categorias/reordenar`, {
    method: 'PATCH',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      tenant_id: tenantId,
      ordenacao: orderMap
    }),
  });

  return handleResponse<GenericAPIResponse>(response, 'Erro ao salvar a nova ordenação das categorias.');
};
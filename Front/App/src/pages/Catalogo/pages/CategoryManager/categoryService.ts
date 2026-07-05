const API_BASE_URL = 'http://localhost:3001/api/catalogo'; // Ajuste conforme necessário

// ----------------------
// 🧬 INTERFACES ALINHADAS (Front & Banco)
// ----------------------

export interface AtributoHerdavel {
  id: string;
  nome: string;
  tipoDado: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
  sufixo?: string;
  obrigatorio: boolean;
  herdar: boolean;
  ordem: number;
  exemplos?: string;
}

export interface CreateCategoryPayload {
  nome: string;
  parentId: string | null; // Alinhado com o padrão camelCase do Front
  percentualMargemSugerida: number | null;
  modoExibicao: 'grade' | 'lista' | 'carrossel';
  descricao?: string;
  atributosHeranca?: AtributoHerdavel[];
}

export interface UpdateCategoryPayload {
  nome?: string;
  parentId?: string | null;
  ativa?: boolean;
  percentualMargemSugerida?: number | null;
  modoExibicao?: 'grade' | 'lista' | 'carrossel';
  descricao?: string | null;
  atributosHeranca?: AtributoHerdavel[]; // Adicionado para permitir alteração no PUT
}

export interface Categoria {
  id: string;
  tenant_id: number;
  parentId: string | null; // Padronizado camelCase
  nome: string;
  slug: string;
  ativa: boolean;
  ordem: number;
  percentualMargemSugerida: number | null;
  modoExibicao: string;
  descricao: string;
  atributosHeranca: AtributoHerdavel[]; // 🧬 Agora mapeado corretamente na tipagem!
  seo?: any;
  integracoes?: any;
  assets?: any;
}

// ----------------------
// HELPERS
// ----------------------

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

const handleResponse = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || fallback);
  }
  return response.json();
};

// ----------------------
// API CATEGORIAS
// ----------------------

/**
 * 🔄 [READ] Listar Categorias do Tenant
 */
export const getCategories = async (tenantId = 1): Promise<Categoria[]> => {
  const res = await fetch(
    `${API_BASE_URL}/cadastros/categorias?tenant_id=${tenantId}`
  );
  const data = await handleResponse<any[]>(res, 'Erro ao buscar categorias');
  return data.map(mapBackendToCategoria);
};

/**
 * 🟢 [CREATE] Criar uma nova categoria
 */
export const createCategory = async (
  data: CreateCategoryPayload,
  tenantId = 1
): Promise<{ success: boolean; id: string }> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/categorias`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      tenant_id: tenantId,
      ...mapPayloadToBackend(data as any), // Usa o mapeador também no Create para manter consistência
    }),
  });

  return handleResponse(res, 'Erro ao criar categoria');
};

/**
 * 🟡 [UPDATE] Atualizar categoria de forma parcial
 */
export const updateCategory = async (
  id: string,
  data: UpdateCategoryPayload,
  tenantId = 1
): Promise<{ success: boolean }> => {
  const res = await fetch(
    `${API_BASE_URL}/cadastros/categorias/${id}?tenant_id=${tenantId}`,
    {
      method: 'PUT',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(mapPayloadToBackend(data)),
    }
  );

  return handleResponse(res, 'Erro ao atualizar categoria');
};

/**
 * 🗑️ [DELETE] Excluir categoria
 */
export const deleteCategory = async (id: string, tenantId = 1): Promise<{ success: boolean }> => {
  const res = await fetch(
    `${API_BASE_URL}/cadastros/categorias/${id}?tenant_id=${tenantId}`,
    {
      method: 'DELETE',
    }
  );

  return handleResponse(res, 'Erro ao deletar categoria');
};

/**
 * 🔀 [PATCH] Reordenar Categorias em Lote
 */
export const updateCategoriesOrder = async (
  order: { id: string; ordem: number }[],
  tenantId = 1
): Promise<{ success: boolean }> => {
  const res = await fetch(
    `${API_BASE_URL}/cadastros/categorias/reordenar`,
    {
      method: 'PATCH',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        tenant_id: tenantId,
        ordenacao: order,
      }),
    }
  );

  return handleResponse(res, 'Erro ao reordenar categorias');
};

// ----------------------
// MAPPERS (Transformadores de Dados)
// ----------------------

export const mapBackendToCategoria = (backendData: any): Categoria => ({
  id: String(backendData.id),
  tenant_id: Number(backendData.tenant_id),
  nome: backendData.nome,
  slug: backendData.slug,
  descricao: backendData.descricao || '',
  parentId: backendData.categoria_pai_id ? String(backendData.categoria_pai_id) : null,
  ativa: Boolean(backendData.ativa),
  percentualMargemSugerida: backendData.margem_sugerida !== null ? Number(backendData.margem_sugerida) : null,
  modoExibicao: backendData.modo_exibicao || 'grade',
  ordem: Number(backendData.ordem || 0),
  
  atributosHeranca: Array.isArray(backendData.atributosHeranca)
    ? backendData.atributosHeranca
    : [],

  seo: backendData.seo ? (typeof backendData.seo === 'string' ? JSON.parse(backendData.seo) : backendData.seo) : {},
  integracoes: backendData.integracoes ? (typeof backendData.integracoes === 'string' ? JSON.parse(backendData.integracoes) : backendData.integracoes) : {},
  assets: backendData.assets ? (typeof backendData.assets === 'string' ? JSON.parse(backendData.assets) : backendData.assets) : {},
});

export const mapPayloadToBackend = (data: UpdateCategoryPayload) => {
  const payload: any = {
    nome: data.nome,
    categoria_pai_id: data.parentId,
    ativa: data.ativa,
    margem_sugerida: data.percentualMargemSugerida,
    modo_exibicao: data.modoExibicao,
    descricao: data.descricao,
  };

  if (data.atributosHeranca !== undefined) {
    payload.atributos_vinculados = data.atributosHeranca
      // 🛡️ Filtro Rigoroso: Só envia se tiver ID real e numérico selecionado no Select da linha
      .filter(attr => attr.id && !String(attr.id).startsWith('h-') && attr.id !== 'null' && attr.id !== 'undefined')
      .map(attr => ({
        atributo_id: Number(attr.id), // Casa perfeitamente com o seu backend original
        obrigatorio: attr.obrigatorio ? 1 : 0,
        herdar: attr.herdar ? 1 : 0,
        ordem: attr.ordem || 0
      }));
  }

  return payload;
};

/**
 * 🌐 Buscar todos os Atributos Globais do Tenant (Para popular o Select da tela)
 */
export const getAtributosGlobais = async (tenantId = 1): Promise<{ id: string; nome: string; tipo: string }[]> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/atributos-globais?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error('Erro ao buscar atributos globais');
  return res.json();
};
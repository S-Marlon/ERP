import { 
  Categoria, 
  CreateCategoryPayload, 
  UpdateCategoryPayload, 
  CreateAtributoRapidoPayload, 
  AtributoGlobalResponse 
} from './CategoryManager.types';

const API_BASE_URL = 'http://localhost:3001/api/catalogo';

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
// MAPPERS (Transformadores de Dados)
// ----------------------

export const mapBackendToCategoria = (backendData: any): Categoria => ({
  id: String(backendData.id),
  tenantId: Number(backendData.tenant_id),
  nome: backendData.nome,
  slug: backendData.slug,
  descricao: backendData.descricao || '',
  parentId: backendData.categoria_pai_id ? String(backendData.categoria_pai_id) : null,
  ativa: Boolean(backendData.ativa),
  percentualMargemSugerida: backendData.margem_sugerida !== null ? Number(backendData.margem_sugerida) : null,
  modoExibicao: backendData.modo_exibicao || 'grade',
  ordem: Number(backendData.ordem || 0),
  atributosHeranca: Array.isArray(backendData.atributosHeranca) 
    ? backendData.atributosHeranca.map((attr: any) => ({
        id: String(attr.id || attr.atributo_id),
        nome: attr.nome,
        tipoDado: attr.tipoDado || attr.tipo_dado || 'texto',
        sufixo: attr.sufixo,
        escopoComercial: attr.escopoComercial || attr.escopo_comercial || 'ficha',
        obrigatorio: Boolean(attr.obrigatorio),
        pesquisavel: Boolean(attr.pesquisavel),
        ordem: Number(attr.ordem || 0),
        herdar: attr.herdar !== false,
        bloqueado: Boolean(attr.bloqueado),
        retransmitir: attr.retransmitir !== false,
        sobrescreve: Boolean(attr.sobrescreve),
        exemplos: attr.exemplos || ''
      }))
    : [],
  seo: backendData.seo ? (typeof backendData.seo === 'string' ? JSON.parse(backendData.seo) : backendData.seo) : {},
  integracoes: backendData.integracoes ? (typeof backendData.integracoes === 'string' ? JSON.parse(backendData.integracoes) : backendData.integracoes) : {},
});

export const mapPayloadToBackend = (data: UpdateCategoryPayload) => {
  const payload: any = {
    nome: data.nome,
    categoria_pai_id: data.parentId,
    ativa: data.ativa,
    margem_sugerida: data.percentualMargemSugerida,
    modo_exibicao: data.modoExibicao,
    descricao: data.descricao,
    seo: data.seo ? JSON.stringify(data.seo) : undefined,
    integracoes: data.integracoes ? JSON.stringify(data.integracoes) : undefined,
  };

  if (data.atributosHeranca !== undefined) {
    payload.atributos_vinculados = data.atributosHeranca
      .filter(attr => attr.id && !String(attr.id).startsWith('h-') && attr.id !== 'null')
      .map(attr => ({
        atributo_id: Number(attr.id),
        escopo_comercial: attr.escopoComercial || 'ficha',
        obrigatorio: attr.obrigatorio ? 1 : 0,
        pesquisavel: attr.pesquisavel ? 1 : 0,
        herdar: attr.herdar ? 1 : 0,
        ordem: attr.ordem || 0,
        bloqueado: attr.bloqueado ? 1 : 0,
        retransmitir: attr.retransmitir !== false ? 1 : 0,
        sobrescreve: attr.sobrescreve ? 1 : 0,
        exemplos: attr.exemplos || ''
      }));
  }

  return payload;
};

// ----------------------
// API CATEGORIAS / ATRIBUTOS
// ----------------------

/**
 * ✨ [CREATE] Cadastro Rápido de Atributo Global Core direto do Formulário Express
 */
export const createAtributoRapido = async (
  payload: CreateAtributoRapidoPayload,
  tenantId = 1
): Promise<{ success: boolean; id: string }> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/atributos-globais/rapido`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      tenant_id: tenantId,
      ...payload,
    }),
  });

  return handleResponse(res, 'Erro ao realizar cadastro rápido do atributo');
};

/**
 * 🌐 Buscar todos os Atributos Globais do Tenant
 */
export const getAtributosGlobais = async (tenantId = 1): Promise<AtributoGlobalResponse[]> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/atributos-globais?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error('Erro ao buscar atributos globais');
  return res.json();
};

/**
 * 🔄 [READ] Listar Categorias do Tenant
 */
export const getCategories = async (tenantId = 1): Promise<Categoria[]> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/categorias?tenant_id=${tenantId}`);
  const data = await handleResponse<any[]>(res, 'Erro ao buscar categorias');
  return data.map(mapBackendToCategoria);
};

/**
 * 🟢 [CREATE] Criar uma nova categoria
 */
export const createCategory = async (data: CreateCategoryPayload, tenantId = 1): Promise<{ success: boolean; id: string }> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/categorias`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      tenant_id: tenantId,
      ...mapPayloadToBackend(data),
    }),
  });

  return handleResponse(res, 'Erro ao criar categoria');
};

/**
 * 🟡 [UPDATE] Atualizar categoria de forma parcial
 */
export const updateCategory = async (id: string, data: UpdateCategoryPayload, tenantId = 1): Promise<{ success: boolean }> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/categorias/${id}?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(mapPayloadToBackend(data)),
  });

  return handleResponse(res, 'Erro ao atualizar categoria');
};

/**
 * 🗑️ [DELETE] Excluir categoria
 */
export const deleteCategory = async (id: string, tenantId = 1): Promise<{ success: boolean }> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/categorias/${id}?tenant_id=${tenantId}`, {
    method: 'DELETE',
  });

  return handleResponse(res, 'Erro ao deletar categoria');
};

/**
 * 🔀 [PATCH] Reordenar Categorias em Lote
 */
export const updateCategoriesOrder = async (order: { id: string; ordem: number }[], tenantId = 1): Promise<{ success: boolean }> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/categorias/reordenar`, {
    method: 'PATCH',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      tenant_id: tenantId,
      ordenacao: order,
    }),
  });

  return handleResponse(res, 'Erro ao reordenar categorias');
};

export interface GrupoAtributo {
  id: number;
  nome: string;
  descricao?: string;
}

/**
 * 📦 Buscar os Grupos de Atributos (Ex: Características Elétricas, Dimensões...)
 */
export const getGruposAtributos = async (tenantId = 1): Promise<GrupoAtributo[]> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/atributos-grupos?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error('Erro ao buscar grupos de atributos');
  return res.json();
};

export interface UnidadeMedida {
  id: number;
  nome: string;
  simbolo: string;
}

/**
 * 📏 Buscar as Unidades de Medida cadastradas (Ex: V, BAR, mm...)
 */
export const getUnidadesMedida = async (tenantId = 1): Promise<UnidadeMedida[]> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/unidades-medida?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error('Erro ao buscar unidades de medida');
  return res.json();
};
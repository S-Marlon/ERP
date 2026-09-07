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
// TIPOS (TYPES)
// ----------------------

export interface Marca {
  id: string;
  tenantId: number;
  codigo: string | null;
  nome: string;
  slug: string;
  site: string | null;
  logoUrl: string | null;
  descricao: string | null;
  status: 'Ativo' | 'Inativo';
  criadoEm: string;
  alteradoEm: string;
  qtdProdutos?: number;
}

export interface CreateMarcaPayload {
  codigo?: string | null;
  nome: string;
  slug?: string | null;
  site?: string | null;
  logoUrl?: string | null;
  descricao?: string | null;
  status?: 'Ativo' | 'Inativo';
}

// ----------------------
// MAPPERS (Transformadores de Dados)
// ----------------------

export const mapBackendToMarca = (backendData: any): Marca => ({
  id: String(backendData.id),
  tenantId: Number(backendData.tenant_id),
  codigo: backendData.codigo || null,
  nome: backendData.nome,
  slug: backendData.slug,
  site: backendData.site || null,
  logoUrl: backendData.logo_url || null,
  descricao: backendData.descricao || null,
  status: backendData.status || 'Ativo',
  criadoEm: backendData.criado_em,
  alteradoEm: backendData.alterado_em,
  qtdProdutos: backendData.qtd_produtos !== undefined ? Number(backendData.qtd_produtos) : undefined,
});

export const mapPayloadToBackendMarca = (data: CreateMarcaPayload) => ({
  codigo: data.codigo || null,
  nome: data.nome,
  slug: data.slug || null,
  site: data.site || null,
  logo_url: data.logoUrl || null,
  descricao: data.descricao || null,
  status: data.status || 'Ativo',
});

// ----------------------
// API MARCAS COMERCIAIS
// ----------------------

/**
 * 🌐 [READ] Buscar todas as Marcas do Tenant (Com filtros opcionais de busca e status)
 */
export const getMarcas = async (tenantId = 1, search = '', status = ''): Promise<Marca[]> => {
  let url = `${API_BASE_URL}/cadastros/marcas?tenant_id=${tenantId}`;
  
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  if (status) {
    url += `&status=${encodeURIComponent(status)}`;
  }

  const res = await fetch(url);
  const data = await handleResponse<any[]>(res, 'Erro ao buscar marcas comerciais');
  return data.map(mapBackendToMarca);
};

/**
 * 🟢 [CREATE] Cadastrar uma nova Marca Comercial
 */
export const createMarca = async (
  data: CreateMarcaPayload, 
  tenantId = 1
): Promise<{ success: boolean; id_marca: string; message: string }> => {
  const res = await fetch(`${API_BASE_URL}/cadastros/marcas`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      tenant_id: tenantId,
      ...mapPayloadToBackendMarca(data),
    }),
  });

  return handleResponse(res, 'Erro ao cadastrar marca comercial');
};
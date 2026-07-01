import { Grupo, AtributoConfig } from './CatalogManager.types';

const API_BASE_URL = 'http://localhost:3001/api/estoque';

export interface CreateGroupPayload {
  nome: string;
  categoriaPai: string;
  descricao?: string;
  unidadeMedidaBase: string;
  templateNome: string;
  separadorSku?: string;
  cor?: string;
  imagem?: string; // Atualizado
  atributos?: AtributoConfig[];
}

export interface UpdateGroupPayload {
  nome?: string;
  categoriaPai?: string;
  descricao?: string;
  status?: 'ativo' | 'inativo';
  unidadeMedidaBase?: string;
  templateNome?: string;
  separadorSku?: string;
  cor?: string;
  imagem?: string; // Atualizado
  atributos?: AtributoConfig[];
}

export interface GenericGroupAPIResponse {
  success: boolean;
  message: string;
  id_grupo?: string;
}

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

const handleResponse = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || defaultError);
  }
  return response.json();
};

export const getGroups = async (tenantId: number = 1): Promise<Grupo[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/grupos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const grupos = await handleResponse<Grupo[]>(response, 'Erro ao carregar os grupos.');

  return grupos.map((grupo: any) => ({
    ...grupo,
    id: String(grupo.id || grupo.id_grupo),
    nome: grupo.nome || 'Grupo Sem Nome',
    categoriaPai: grupo.categoriaPai || '',
    descricao: grupo.descricao || '',
    status: grupo.status || 'ativo',
    separadorSku: grupo.separadorSku || '-',
    unidadeMedidaBase: grupo.unidadeMedidaBase || 'PC',
    templateNome: grupo.templateNome || '{GRUPO}',
    cor: grupo.cor || '#0050b3',
    imagem: grupo.imagem || grupo.imagem_capa || '', // Higieniza o nome do campo vindo do banco
    
    atributos: Array.isArray(grupo.atributos) 
      ? grupo.atributos.map((attr: any) => ({
          id: String(attr.id || attr.id_atributo),
          nome: attr.nome || '',
          tipoDado: attr.tipoDado || attr.tipo_dado || 'texto',
          separadorSufixo: attr.separadorSufixo || attr.separador_sufixo || 'nenhum', // Nova propriedade mapeada
          sufixo: attr.sufixo || '',
          obrigatorio: Boolean(attr.obrigatorio),
          geraVariacao: Boolean(attr.geraVariacao || attr.gera_variacao),
          compoeSku: Boolean(attr.compoeSku || attr.compoe_sku),
          ordemSku: Number(attr.ordemSku || attr.ordem_sku || 0),
          exemplos: attr.exemplos || ''
        }))
      : []
  }));
};

export const createGroup = async (data: CreateGroupPayload, tenantId: number = 1): Promise<GenericGroupAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/grupos`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ tenant_id: tenantId, ...data }),
  });
  return handleResponse<GenericGroupAPIResponse>(response, 'Erro ao criar novo grupo.');
};

export const updateGroup = async (idGrupo: string, data: UpdateGroupPayload, tenantId: number = 1): Promise<GenericGroupAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/grupos/${idGrupo}?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data),
  });
  return handleResponse<GenericGroupAPIResponse>(response, 'Erro ao atualizar dados do grupo.');
};

export const deleteGroup = async (idGrupo: string, tenantId: number = 1): Promise<GenericGroupAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/grupos/${idGrupo}?tenant_id=${tenantId}`, {
    method: 'DELETE',
    headers: DEFAULT_HEADERS,
  });
  return handleResponse<GenericGroupAPIResponse>(response, 'Erro ao excluir o grupo selecionado.');
};
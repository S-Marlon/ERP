// ==========================================
// FAMILY MANAGER - SERVIÇO DE API
// ==========================================

import { 
  Grupo, 
  AtributoConfig, 
  CategoriaAPIResponse, 
  CreateFamiliaPayload, 
  UpdateFamiliaPayload, 
  GenericFamiliaAPIResponse,
  ItemAssociado 
} from './CatalogManager.types';

const API_BASE_URL = 'http://localhost:3001/api/catalogo';
const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

const handleResponse = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || defaultError);
  }
  return response.json();
};

export const getCategorias = async (tenantId: number = 1): Promise<CategoriaAPIResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/categorias?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const dados = await handleResponse<any[]>(response, 'Erro ao carregar as categorias.');

  return dados.map((cat: any): CategoriaAPIResponse => ({
    id: String(cat.id),
    nome: cat.nome || 'Categoria Sem Nome',
    paiId: cat.categoria_pai_id ? String(cat.categoria_pai_id) : null
  }));
};

/**
 * 🔄 GET Famílias / Grupos de Produtos com Atributos (Integração Total com BD)
 */
export const getGroups = async (tenantId: number = 1): Promise<Grupo[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const familias = await handleResponse<any[]>(response, 'Erro ao carregar as famílias/grupos.');

  return familias.map((fam: any): Grupo => ({
    id: String(fam.id),
    nome: fam.nome || 'Família Sem Nome',
    // Mapeamento correto vindo do controller
    categoriaPai: fam.categoriaPai ? String(fam.categoriaPai) : '',
    categoriaPaiNome: fam.categoriaPaiNome || '', 
    descricao: fam.descricao || '',
    status: String(fam.status).toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO',
    
    // Todos os campos operacionais 100% integrados
    unidadeMedidaBase: fam.unidadeMedidaBase || 'PC',
    tipoItem: fam.tipoItem || 'PA', 
    ncmPadrao: fam.ncmPadrao || '',
    cestPadrao: fam.cestPadrao || '',
    siglaSku: fam.siglaSku || '',
    separadorSku: fam.separadorSku || '-',
    templateSku: fam.templateSku || '{SIGLA}{SEPARADOR}{VARIACAO}',
    templateNomeComercial: fam.templateNomeComercial || '{FAMILIA}',
    descricaoComercialPadrao: fam.descricaoComercialPadrao || '',
    observacoesPadrao: fam.observacoesPadrao || '',
    cor: fam.cor || '#0050b3',
    imagem: fam.imagem || '',
    
    // Mapeamento correto dos atributos vinculados (Herança + Locais)
    atributos: Array.isArray(fam.atributos) 
      ? fam.atributos.map((attr: any): AtributoConfig => ({
          id: String(attr.id),
          nome: attr.nome || '',
          codigo: attr.codigo || '',
          classificacao: attr.classificacao || 'ficha', 
          tipoDado: attr.tipoDado || 'texto',
          opcoesValidas: Array.isArray(attr.opcoes) ? attr.opcoes : (Array.isArray(attr.opcoesValidas) ? attr.opcoesValidas : []),
          separadorSufixo: attr.separadorSufixo || 'nenhum',
          sufixo: attr.sufixo || '',
          obrigatorio: Boolean(attr.obrigatorio),
          geraVariacao: Boolean(attr.geraVariacao),
          compoeSku: Boolean(attr.compoeSku),
          ordemSku: Number(attr.ordemSku || 0),
          exemplos: attr.exemplos || '',
          valorHerdadoDoGrupo: Boolean(attr.valorHerdadoDoGrupo),
          valorPadraoGrupo: attr.valorPadraoGrupo || '',
          pesquisavel: Boolean(attr.pesquisavel),
          bloqueado: Boolean(attr.bloqueado),
          retransmitir: Boolean(attr.retransmitir),
          estaSendoUtilizado: Boolean(attr.estaSendoUtilizado),
          origem: attr.origem || 'locais'
        }))
      : []
  }));
};

// Aliases para chamadas de Família
export const getFamilias = getGroups;

export const createFamilia = async (data: CreateFamiliaPayload, tenantId: number = 1): Promise<GenericFamiliaAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data),
  });
  return handleResponse<GenericFamiliaAPIResponse>(response, 'Erro ao criar família.');
};

export const updateFamilia = async (
  idFamilia: string, 
  data: UpdateFamiliaPayload, 
  tenantId: number = 1
): Promise<GenericFamiliaAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias/${idFamilia}?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data),
  });
  return handleResponse<GenericFamiliaAPIResponse>(response, 'Erro ao atualizar família.');
};

export const deleteFamilia = async (idFamilia: string, tenantId: number = 1): Promise<GenericFamiliaAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias/${idFamilia}?tenant_id=${tenantId}`, {
    method: 'DELETE',
    headers: DEFAULT_HEADERS,
  });
  return handleResponse<GenericFamiliaAPIResponse>(response, 'Erro ao excluir família.');
};

// Aliases para compatibilidade legada do Front-end
export const createGroup = createFamilia;
export const updateGroup = updateFamilia;
export const deleteGroup = deleteFamilia;

export const getAtributosDaCategoria = async (idCategoria: string, tenantId: number = 1): Promise<any[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/categorias/${idCategoria}/atributos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });
  return handleResponse<any[]>(response, 'Erro ao carregar atributos da categoria.');
};

export const getAtributosGlobais = async (tenantId: number = 1): Promise<AtributoConfig[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/atributos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const dados = await handleResponse<any[]>(response, 'Erro ao carregar pool de atributos.');

  return dados.map((attr: any): AtributoConfig => ({
    id: String(attr.id),
    nome: attr.nome || '',
    codigo: attr.codigo || '',
    classificacao: attr.classificacao || 'ficha',
    tipoDado: attr.tipoDado || 'texto',
    opcoesValidas: Array.isArray(attr.opcoes) ? attr.opcoes : [],
    separadorSufixo: 'nenhum',
    sufixo: attr.sufixo || '',
    obrigatorio: Boolean(attr.obrigatorio),
    geraVariacao: false,
    compoeSku: false,
    ordemSku: 0,
    exemplos: '',
    valorHerdadoDoGrupo: false,
    origem: 'global'
  }));
};

export const getItensDoGrupo = async (grupoId: string, tenantId: number = 1): Promise<ItemAssociado[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias/${grupoId}/itens?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });
  return handleResponse<ItemAssociado[]>(response, 'Erro ao carregar itens associados.');
};
import { 
  Grupo, 
  AtributoConfig, 
  CategoriaAPIResponse, 
  CreateGroupPayload, 
  UpdateGroupPayload, 
  GenericGroupAPIResponse 
} from './CatalogManager.types';

// Centralizado para facilitar manutenção
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

export const getGroups = async (tenantId: number = 1): Promise<Grupo[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/grupos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const familias = await handleResponse<any[]>(response, 'Erro ao carregar os grupos.');

  return familias.map((fam: any): Grupo => ({
    id: String(fam.id),
    nome: fam.nome || 'Família Sem Nome',
    // Mapeia `categoria_id` vindo do DB para a propriedade `categoriaPai` do Front
    categoriaPai: fam.categoria_id ? String(fam.categoria_id) : '',
    categoriaPaiNome: fam.categoria_pai_nome || fam.categoriaPaiNome || '', 
    descricao: fam.descricao || '',
    // Alinhado ao enum rígido em caixa alta do banco de dados
    status: fam.status === 'INATIVO' ? 'INATIVO' : 'ATIVO',
    unidadeMedidaBase: fam.unidade_base || fam.unidadeMedidaBase || 'PC',
    separadorSku: fam.separador_sku || fam.separadorSku || '-',
    cor: fam.cor || '#0050b3',
    imagem: fam.imagem || '',
    
    // Tratando propriedades lógicas do Frontend para compatibilidade com a UI
    tipoItem: fam.tipoItem || 'PA', 
    ncmPadrao: fam.ncmPadrao || '',
    cestPadrao: fam.cestPadrao || '',
    siglaSku: fam.siglaSku || '',
    templateSku: fam.templateSku || '{SIGLA}{SEPARADOR}{VARIAÇÃO}',
    templateNomeComercial: fam.template_nome || fam.templateNomeComercial || '{GRUPO}',
    descricaoComercialPadrao: fam.descricaoComercialPadrao || '',
    observacoesPadrao: fam.observacoesPadrao || '',
    
    // Varre e formata a lista de atributos vinculados (core_entidades / JSON)
    atributos: Array.isArray(fam.atributos) 
      ? fam.atributos.map((attr: any): AtributoConfig => ({
          id: String(attr.id),
          nome: attr.nome || '',
          codigo: attr.codigo || '',
          classificacao: attr.classificacao || attr.escopo_comercial || 'ficha', 
          tipoDado: attr.tipoDado || attr.tipo || 'texto',
          opcoesValidas: Array.isArray(attr.opcoesValidas) ? attr.opcoesValidas : [],
          separadorSufixo: attr.separadorSufixo || 'nenhum',
          sufixo: attr.sufixo || '',
          obrigatorio: Boolean(attr.obrigatorio),
          geraVariacao: Boolean(attr.geraVariacao),
          compoeSku: Boolean(attr.compoeSku),
          ordemSku: Number(attr.ordemSku || attr.ordem || 0),
          exemplos: attr.exemplos || '',
          valorHerdadoDoGrupo: Boolean(attr.valorHerdadoDoGrupo || attr.herdar),
          valorPadraoGrupo: attr.valorPadraoGrupo || '',
          estaSendoUtilizado: Boolean(attr.estaSendoUtilizado),
          origem: attr.origem || 'customizado'
        }))
      : []
  }));
};

export const createGroup = async (data: CreateGroupPayload, tenantId: number = 1): Promise<GenericGroupAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/grupos?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data),
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

export const getAtributosDaCategoria = async (idCategoria: string, tenantId: number = 1): Promise<any[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/categorias/${idCategoria}/atributos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });
  return handleResponse<any[]>(response, 'Erro ao carregar os atributos da categoria.');
};

export const getAtributosGlobais = async (tenantId: number = 1): Promise<AtributoConfig[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/atributos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const dados = await handleResponse<any[]>(response, 'Erro ao carregar o pool de atributos.');

  return dados.map((attr: any): AtributoConfig => ({
    id: String(attr.id),
    nome: attr.nome || '',
    codigo: attr.codigo || '',
    classificacao: attr.classificacao || 'ficha',
    tipoDado: attr.tipoDado || 'texto',
    opcoesValidas: Array.isArray(attr.opcoesValidas) ? attr.opcoesValidas : [],
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
import { Grupo, AtributoConfig } from './CatalogManager.types';

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

  return dados.map((cat: any) => ({
    id: String(cat.id),
    nome: cat.nome || 'Categoria Sem Nome',
    paiId: cat.categoria_pai_id ? String(cat.categoria_pai_id) : null
  }));
};

export const getGroups = async (tenantId: number = 1): Promise<Grupo[]> => {
  // Bate na rota mapeada para o backend de famílias
  const response = await fetch(`${API_BASE_URL}/cadastros/grupos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const familias = await handleResponse<any[]>(response, 'Erro ao carregar os grupos.');

  return familias.map((fam: any): Grupo => ({
    id: String(fam.id),
    nome: fam.nome || 'Família Sem Nome',
    categoriaPai: fam.categoriaPai ? String(fam.categoriaPai) : '',
    categoriaPaiNome: fam.categoriaPaiNome || '', 
    descricao: fam.descricao || '',
    status: fam.status === 'inativo' ? 'inativo' : 'ativo',
    unidadeMedidaBase: fam.unidadeMedidaBase || 'PC',
    separadorSku: fam.separadorSku || '-',
    cor: fam.cor || '#0050b3',
    imagem: fam.imagem || '',
    
    // Tratando propriedades antigas que não existem no banco para não quebrar o Front
    tipoItem: 'MR', 
    ncmPadrao: '',
    cestPadrao: '',
    siglaSku: '',
    templateSku: '{SIGLA}{SEPARADOR}{VARIAÇÃO}',
    templateNomeComercial: fam.templateNome || '{GRUPO}',
    descricaoComercialPadrao: '',
    observacoesPadrao: '',
    
    atributos: Array.isArray(fam.atributos) 
      ? fam.atributos.map((attr: any): AtributoConfig => ({
          id: String(attr.id),
          nome: attr.nome || '',
          classificacao: attr.classificacao || 'ficha', // Alinhado com 'dna' | 'grade' | 'ficha' do banco
          tipoDado: attr.tipoDado || 'texto',
          opcoesValidas: Array.isArray(attr.opcoesValidas) ? attr.opcoesValidas : [],
          separadorSufixo: attr.separadorSufixo || 'nenhum',
          sufixo: attr.sufixo || '',
          obrigatorio: Boolean(attr.obrigatorio),
          geraVariacao: Boolean(attr.geraVariacao),
          compoeSku: Boolean(attr.compoeSku),
          ordemSku: Number(attr.ordemSku || 0),
          exemplos: '',
          valorHerdadoDoGrupo: Boolean(attr.valorHerdadoDoGrupo),
          valorPadraoGrupo: '',
          estaSendoUtilizado: false,
          origem: 'customizado',
          tipo: 'livre'
        }))
      : []
  }));
};

export const createGroup = async (data: CreateGroupPayload, tenantId: number = 1): Promise<GenericGroupAPIResponse> => {
  // Ajustado: Passando o tenant_id na URL para bater com o req.query.tenant_id do back
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
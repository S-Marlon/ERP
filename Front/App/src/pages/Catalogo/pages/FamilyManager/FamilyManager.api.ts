// ==========================================
// FAMILY MANAGER - SERVIÇO DE API (REVISADO)
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
    paiId: (cat.categoria_pai_id || cat.categoriaPaiId) ? String(cat.categoria_pai_id || cat.categoriaPaiId) : null
  }));
};

/**
 * 🔄 GET Famílias de Produtos com Atributos (Integração Total com BD)
 */
export const getFamilies = async (tenantId: number = 1): Promise<Grupo[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const familias = await handleResponse<any[]>(response, 'Erro ao carregar as famílias.');

  return familias.map((fam: any): Grupo => ({
    id: String(fam.id),
    nome: fam.nome || 'Família Sem Nome',
    categoriaPai: fam.categoriaPai ? String(fam.categoriaPai) : (fam.categoria_id ? String(fam.categoria_id) : ''),
    categoriaPaiNome: fam.categoriaPaiNome || fam.categoria_pai_nome || '', 
    descricao: fam.descricao || '',
    status: String(fam.status || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO',

    unidadeMedidaBase: fam.unidadeMedidaBase || fam.unidade_base || 'PC',
    tipoItem: fam.tipoItem || fam.tipo_item || 'PA', 
    ncmPadrao: fam.ncmPadrao || fam.ncm_padrao || '',
    cestPadrao: fam.cestPadrao || fam.cest_padrao || '',
    siglaSku: fam.siglaSku || fam.sigla_sku || '',
    separadorSku: fam.separadorSku || fam.separador_sku || '-',
    templateSku: fam.templateSku || fam.template_sku || '{SIGLA}{S}{VARIACAO}',
    templateNomeComercial: fam.templateNomeComercial || fam.template_nome || '{FAMILIA}',
    descricaoComercialPadrao: fam.descricaoComercialPadrao || fam.descricao_comercial_padrao || '',
    observacoesPadrao: fam.observacoesPadrao || fam.observacoes_padrao || '',
    cor: fam.cor || '#0050b3',
    imagem: fam.imagem || '',
    
    // Suporte a marca e comportamento com fallbacks
    idMarca: fam.idMarca || fam.id_marca || '',
    marcaComportamento: fam.marcaComportamento || fam.comportamento_marca || fam.comportamentoMarca || 'ficha',

    atributos: Array.isArray(fam.atributos) 
      ? fam.atributos.map((attr: any): AtributoConfig => ({
          id: String(attr.id),
          nome: attr.nome || '',
          codigo: attr.codigo || '',
          classificacao: attr.classificacao || 'ficha', 
          tipoDado: attr.tipoDado || attr.tipo_dado || 'texto',
          opcoesValidas: Array.isArray(attr.opcoes) ? attr.opcoes : (Array.isArray(attr.opcoesValidas) ? attr.opcoesValidas : []),
          separadorSufixo: attr.separadorSufixo || attr.separador_sufixo || 'nenhum',
          sufixo: attr.sufixo || '',
          obrigatorio: Boolean(attr.obrigatorio),
          geraVariacao: Boolean(attr.geraVariacao ?? attr.gera_variacao),
          compoeSku: Boolean(attr.compoeSku ?? attr.compoe_sku),
          ordemSku: Number(attr.ordemSku || attr.ordem_sku || 0),
          exemplos: attr.exemplos || '',
          valorHerdadoDaFamilia: Boolean(attr.valorHerdadoDaFamilia ?? attr.valorHerdadoDoGrupo ?? attr.valor_herdado),
          valorPadraoFamilia: attr.valorPadraoFamilia || attr.valorPadraoGrupo || attr.valor_padrao || '',
          pesquisavel: Boolean(attr.pesquisavel),
          bloqueado: Boolean(attr.bloqueado),
          retransmitir: Boolean(attr.retransmitir),
          estaSendoUtilizado: Boolean(attr.estaSendoUtilizado ?? attr.esta_sendo_utilizado),
          origem: attr.origem || 'locais'
        }))
      : []
  }));
};

export const getGroups = getFamilies;

// ==========================================
// FUNÇÕES DE ESCRITA (CREATE, UPDATE, DELETE)
// ==========================================

export const createFamilia = async (
  arg1: CreateFamiliaPayload | number, 
  arg2: number | CreateFamiliaPayload = 1
): Promise<GenericFamiliaAPIResponse> => {
  let data: CreateFamiliaPayload;
  let tenantId: number;

  if (typeof arg1 === 'number') {
    tenantId = arg1;
    data = arg2 as CreateFamiliaPayload;
  } else {
    data = arg1;
    tenantId = typeof arg2 === 'number' ? arg2 : 1;
  }

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

// Aliases globais em inglês e português para compatibilidade total
export const createFamily = createFamilia;
export const updateFamily = updateFamilia;
export const deleteFamily = deleteFamilia;

export const createGroup = createFamilia;
export const updateGroup = updateFamilia;
export const deleteGroup = deleteFamilia;

// ==========================================
// ATRIBUTOS E PRODUTOS
// ==========================================

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
    tipoDado: attr.tipoDado || attr.tipo_dado || 'texto',
    opcoesValidas: Array.isArray(attr.opcoes) ? attr.opcoes : [],
    separadorSufixo: 'nenhum',
    sufixo: attr.sufixo || '',
    obrigatorio: Boolean(attr.obrigatorio),
    geraVariacao: false,
    compoeSku: false,
    ordemSku: 0,
    exemplos: '',
    valorHerdadoDaFamilia: false,
    valorPadraoFamilia: '',
    origem: 'global'
  }));
};

export const getItensDaFamilia = async (familiaId: string, tenantId: number = 1): Promise<ItemAssociado[]> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias/${familiaId}/produtos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const dados = await handleResponse<any[]>(response, 'Erro ao carregar itens associados.');

  return dados.map((item: any): ItemAssociado => {
    const idItem = String(item.id ?? item.idItem ?? item.id_item ?? '');
    const nomeProduto = item.nomeComercial || item.nome_comercial || item.nomeItem || item.nomeItemGlobal || item.nome || 'Produto Sem Nome';
    const skuProduto = item.skuCustomizado || item.sku_customizado || item.skuGlobal || item.sku || '';

    return {
      id: idItem,
      idItem: idItem,
      sku: skuProduto,
      nome: nomeProduto,
      nomeItem: nomeProduto,
      valoresAtributos: item.valoresAtributos || item.valores_atributos || {},
      tipoRecurso: item.tipoRecurso || item.tipo_recurso || 'PRODUTO',
      status: item.statusItem || item.status_item || 'ATIVO',
      precoVenda: Number(item.precoVenda || item.preco_venda || 0),
      custoGerencial: Number(item.custoGerencial || item.custo_gerencial || 0),
      margemLucro: Number(item.margemLucro || item.margem_lucro || 0),
      exibirNoPdv: Boolean(item.exibirNoPdv ?? item.exibir_no_pdv),
      podeVenderSemEstoque: Boolean(item.podeVenderSemEstoque ?? item.pode_vender_sem_estoque),
      descricaoComercial: item.descricaoComercial || item.descricao_comercial || ''
    };
  });
};

export const getItensDoGrupo = getItensDaFamilia;

export const getDiagnosticoFormalizacao = async (familiaId: string, tenantId: number = 1): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias/${familiaId}/formalizacao?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });
  return handleResponse<any>(response, 'Erro ao diagnosticar a formalização da família.');
};

export const formalizarItensDaFamilia = async (
  familiaId: string,
  itens: Array<{ idItem: string | number; atributos: Record<string, any> }>,
  tenantId: number = 1
): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/cadastros/familias/${familiaId}/formalizacao?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ itens }),
  });
  return handleResponse<any>(response, 'Erro ao formalizar os itens da família.');
};
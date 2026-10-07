// ==========================================
// CATALOG SKU - SERVIÇO DE API DE PRODUTOS
// ==========================================
import { API_URL } from '../../../../shared/api/config';

import { 
  ItemParentType, 
  SkuChildType, 
  CreateProdutoPayload, 
  UpdateProdutoPayload, 
  GenericProductAPIResponse 
} from './CatalogSku.types';

const API_BASE_URL = `${API_URL}/api/catalogo`;
const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Tratador genérico de respostas HTTP da API
 */
const handleResponse = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String(errorData.error ?? errorData.message ?? defaultError));
  }
  return response.json() as Promise<T>;
};

/**
 * 🔄 GET /produtos
 * Busca a lista completa de produtos mapeando a junção de `itens_core` e `comercial_produtos_dados`
 */
export const getProdutos = async (tenantId: number = 1): Promise<ItemParentType[]> => {
  const response = await fetch(`${API_BASE_URL}/produtos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const dados = (await handleResponse<Record<string, unknown>[]>(response, 'Erro ao carregar o catálogo de produtos.'));

  return dados.map((item: Record<string, unknown>): ItemParentType => {
    const idItem = toNumber(item.id_item ?? item.id, 0);
    const tenantIdResolved = toNumber(item.tenant_id ?? tenantId, tenantId);
    const itemStatus = String(item.status ?? 'ATIVO').toUpperCase();
    const nomeItem = String(item.nome_item ?? item.name ?? item.nome ?? 'Produto sem Nome');
    const categoriaNome = String(item.categoria ?? item.category ?? item.nome_familia ?? '');
    const variacao = String(item.descricao_variacao ?? item.variacao ?? 'Único');
    const marca = String(item.marca ?? item.brand ?? 'Própria');
    const estoque = toNumber(item.estoque ?? item.currentStock ?? 0, 0);
    const precoVenda = toNumber(item.preco_venda ?? item.salePrice ?? 0, 0);

    const skusMapeados: SkuChildType[] = [{
      key: `${idItem}-0`,
      id_item: idItem,
      sku: String(item.sku ?? ''),
      variacao,
      marca,
      estoque,
      preco_venda: precoVenda,
      custo_gerencial: toNumber(item.custo_gerencial ?? 0, 0),
      status: estoque === 0 ? 'Esgotado' : (itemStatus === 'INATIVO' ? 'INATIVO' : 'ATIVO'),
      imagem_url: typeof item.imagem_url === 'string' ? item.imagem_url : null,
      publicavel: item.publicavel !== false,
      motivos_publicacao: Array.isArray(item.motivos_publicacao) ? item.motivos_publicacao as string[] : [],
    }];

    return {
      key: String(idItem),
      id_item: idItem,
      tenant_id: tenantIdResolved,
      sku: String(item.sku ?? ''),
      nome_item: nomeItem,
      tipo_recurso: String(item.tipo_recurso ?? 'PRODUTO'),
      status: itemStatus === 'INATIVO' ? 'INATIVO' : 'ATIVO',
      categoria_id: item.categoria_id ? toNumber(item.categoria_id, 0) || null : null,
      categoria: categoriaNome || null,
      familia: item.familia || item.nome_familia || null,
      familia_id: item.familia_id ? toNumber(item.familia_id, 0) || null : null,
      id_marca: item.id_marca ? toNumber(item.id_marca, 0) || null : null,
      skus: skusMapeados,
    };
  });
};

/**
 * 🔄 PUT /produtos/:id_item
 * Atualiza um produto existente no catálogo (suporta envio de null para limpar campos como familia_id)
 */
export const updateProduto = async (
  idItem: number | string, 
  payload: UpdateProdutoPayload, 
  tenantId: number = 1
): Promise<GenericProductAPIResponse> => {
  const url = `${API_BASE_URL}/produtos/${idItem}?tenant_id=${tenantId}`;
  
  const bodyData = {
    tenant_id: tenantId,
    ...payload
  };

  console.log("📤 [API REQUEST] URL:", url);
  console.log("📤 [API REQUEST] Body enviado:", bodyData);

  const response = await fetch(url, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("❌ [API ERROR 400 DETALHADO]:", errorData);
    throw new Error(String(errorData.error ?? errorData.message ?? 'Erro ao atualizar produto.'));
  }

  return response.json();
};


/**
 * 📄 GET /produtos/:id_item/detalhe
 * Ficha completa do item (core, comercial, logística, fiscal, estoque, GTINs e fornecedores)
 */
export interface ProdutoDetalhe {
  item: {
    id_item: number;
    sku_core: string;
    nome_core: string;
    tipo_recurso: string;
    status: string;
    descricao_variacao: string | null;
    peso_liquido: number | null;
    peso_bruto: number | null;
    unidade_sigla: string | null;
    unidade_descricao: string | null;
    sku_customizado: string | null;
    nome_comercial: string | null;
    descricao_comercial: string | null;
    categoria_id: number | null;
    familia_id: number | null;
    id_marca: number | null;
    custo_gerencial: number | null;
    preco_venda: number | null;
    margem_lucro: number | null;
    exibir_no_pdv: boolean;
    pode_vender_sem_estoque: boolean;
    altura_cm: number | null;
    largura_cm: number | null;
    comprimento_cm: number | null;
    ncm: string | null;
    cest: string | null;
    origem_mercadoria: number | null;
    cfop_padrao: string | null;
    quantidade_atual: number;
    custo_medio: number | null;
    ultimo_custo: number | null;
  };
  movimentos: Array<{
    id_movimento: number;
    tipo_movimento: string;
    origem: string;
    documento_origem: string | null;
    quantidade: number;
    quantidade_documento: number | null;
    unidade_documento: string | null;
    fator_conversao: number;
    custo_unitario: number;
    saldo_posterior: number;
    observacao: string | null;
    created_at: string;
  }>;
  gtins: Array<{ sigla: string; gtin: string; nome_exibicao: string | null }>;
  anexos: AnexoItem[];
  // Gatekeeper: se o item pode ir para o PDV/canais e, se não, por quê
  publicacao: { publicavel: boolean; motivos: string[] };
  fornecedores: Array<{
    id_fornecedor: number;
    nome: string | null;
    cnpj: string | null;
    codigo_produto_fornecedor: string | null;
    unidade_compra: string | null;
    fator_compra: number;
    preco_ultima_compra: number | null;
    padrao: boolean;
  }>;
}

/**
 * Ficha técnica do item: atributos da categoria + família com os valores do item
 */
export interface AtributoFicha {
  atributoId: number;
  nome: string;
  codigo: string | null;
  tipo: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data' | string;
  papel: 'dna' | 'grade' | 'ficha' | string;
  obrigatorio: boolean;
  origem: 'categoria' | 'familia';
  valorFixo: string | null;
  valor: string | null;
  opcoes: string[];
}

export interface FichaTecnica {
  familia: { id: number; nome: string; status: string } | null;
  categoria: { id: number; nome: string } | null;
  atributos: AtributoFicha[];
  estaticos: Array<{ atributoId: number; nome: string; codigo: string | null; tipo: string; valor: string | null }>;
}

export const getFichaTecnica = async (idItem: number, tenantId: number = 1): Promise<FichaTecnica> =>
  handleResponse<FichaTecnica>(
    await fetch(`${API_BASE_URL}/produtos/${idItem}/ficha-tecnica?tenant_id=${tenantId}`, { headers: DEFAULT_HEADERS }),
    'Erro ao carregar a ficha técnica.'
  );

// valores: { [atributoId]: valor } — null/vazio remove o valor do item
export const salvarFichaTecnica = async (idItem: number, valores: Record<number, unknown>, tenantId: number = 1): Promise<FichaTecnica> =>
  handleResponse<FichaTecnica>(
    await fetch(`${API_BASE_URL}/produtos/${idItem}/ficha-tecnica?tenant_id=${tenantId}`, {
      method: 'PUT', headers: DEFAULT_HEADERS, body: JSON.stringify({ valores }),
    }),
    'Erro ao salvar a ficha técnica.'
  );

export type TipoAnexo ='IMAGEM_PRINCIPAL' | 'FOTO_GALERIA' | 'MANUAL_TECNICO' | 'CERTIFICADO' | 'FISPQ';

export interface AnexoItem {
  id_anexo: number;
  tipo_anexo: TipoAnexo;
  nome_arquivo: string;
  url_anexo: string;
  ordem: number;
}

// Anexos guardam só o link do arquivo hospedado (o serviço de upload virá depois, gravando a mesma URL)
export const adicionarAnexo = async (idItem: number, url: string, tipo: TipoAnexo, nome?: string, tenantId: number = 1) =>
  handleResponse<GenericProductAPIResponse>(
    await fetch(`${API_BASE_URL}/produtos/${idItem}/anexos?tenant_id=${tenantId}`, {
      method: 'POST', headers: DEFAULT_HEADERS, body: JSON.stringify({ url, tipo, nome }),
    }),
    'Erro ao adicionar o anexo.'
  );

export const removerAnexo = async (idItem: number, idAnexo: number, tenantId: number = 1) =>
  handleResponse<GenericProductAPIResponse>(
    await fetch(`${API_BASE_URL}/produtos/${idItem}/anexos/${idAnexo}?tenant_id=${tenantId}`, { method: 'DELETE', headers: DEFAULT_HEADERS }),
    'Erro ao remover o anexo.'
  );

export const definirImagemPrincipal = async (idItem: number, idAnexo: number, tenantId: number = 1) =>
  handleResponse<GenericProductAPIResponse>(
    await fetch(`${API_BASE_URL}/produtos/${idItem}/anexos/${idAnexo}/principal?tenant_id=${tenantId}`, { method: 'PUT', headers: DEFAULT_HEADERS }),
    'Erro ao definir a imagem principal.'
  );

export const getProdutoDetalhe = async (idItem: number, tenantId: number = 1): Promise<ProdutoDetalhe> => {
  const response = await fetch(`${API_BASE_URL}/produtos/${idItem}/detalhe?tenant_id=${tenantId}`, { headers: DEFAULT_HEADERS });
  const dados = await handleResponse<Partial<ProdutoDetalhe>>(response, 'Erro ao carregar a ficha do produto.');
  if (!dados.item) throw new Error('A ficha do produto veio incompleta do servidor.');
  // Listas sempre presentes: tolera backend desatualizado ou item sem dados em alguma seção
  return {
    item: dados.item,
    movimentos: Array.isArray(dados.movimentos) ? dados.movimentos : [],
    gtins: Array.isArray(dados.gtins) ? dados.gtins : [],
    fornecedores: Array.isArray(dados.fornecedores) ? dados.fornecedores : [],
    anexos: Array.isArray(dados.anexos) ? dados.anexos : [],
    publicacao: dados.publicacao ?? { publicavel: true, motivos: [] },
  };
};

export interface OpcaoCadastro {
  value: number;
  label: string;
}

/**
 * Listas usadas nos selects da ficha (marcas, categorias e famílias)
 */
export const getListasCadastro = async (tenantId: number = 1) => {
  const buscar = async (caminho: string) => {
    const response = await fetch(`${API_BASE_URL}/${caminho}?tenant_id=${tenantId}`, { headers: DEFAULT_HEADERS });
    return handleResponse<Record<string, unknown>[]>(response, `Erro ao carregar ${caminho}.`);
  };
  const [marcas, categorias, familias] = await Promise.all([
    buscar('marcas'),
    buscar('cadastros/categorias'),
    buscar('cadastros/familias'),
  ]);
  const opcoes = (lista: Record<string, unknown>[]): OpcaoCadastro[] =>
    lista
      .map(r => ({ value: toNumber(r.id, 0), label: String(r.nome ?? '') }))
      .filter(o => o.value > 0 && o.label);
  return { marcas: opcoes(marcas), categorias: opcoes(categorias), familias: opcoes(familias) };
};

/**
 * 🧬 GET /produtos/:id_item/atributos
 * Busca os atributos comerciais de um produto específico separados por Ficha, DNA e Grade
 */
export const getAtributosProduto = async (idItem: number | string, tenantId: number = 1) => {
  const response = await fetch(`${API_BASE_URL}/produtos/${idItem}/atributos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<any>(response, 'Erro ao carregar os atributos do produto.');
};




/**
 * 🔄 POST /produtos/lote
 * Grava em lote a fila/rascunho de novos produtos criados
 */
export const saveProdutosLote = async (
  produtos: CreateProdutoPayload[], 
  tenantId: number = 1
): Promise<GenericProductAPIResponse> => {
  const payload = { 
    tenant_id: tenantId, 
    produtos
  };
  
  console.log('📤 [saveProdutosLote] Enviando payload para /produtos/lote:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(`${API_BASE_URL}/produtos/lote?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload),
  });

  return handleResponse<GenericProductAPIResponse>(response, 'Erro ao salvar o lote de produtos.');
};
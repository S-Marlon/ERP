import { API_URL } from '../../../shared/api/config';
import type { AtributoFicha } from '../../Catalogo/pages/CatalogSkus/CatalogSku.service';
const API_BASE_URL = `${API_URL}/api`; // Mudado para a raiz da API para facilitar o roteamento

// --- INTERFACES DE SOLICITAÇÃO E RESPOSTA ---

export interface FornecedorQueryResponse {
    exists: boolean;
    supplier?: {
        id: number;
        name: string;
        fantasyName: string;
    };
}

export interface ProcessarItemXMLPayload {
    tenant_id: number;
    lote_importacao_id?: number;
    chave_acesso?: string;
    numero_nf?: string;
    cnpj_fornecedor?: string;
    xml_conteudo?: string;       // <-- NOVO: XML em texto bruto
    dados_nota_fiscal?: object;  // <-- NOVO: JSON do cabeçalho/emitente/totais
    cProd: string;
    cEAN?: string | null;
    xProd?: string | null;
    ncm?: string | null;
    cest?: string | null;
    uCom?: string | null;
    quantidade: number;
    preco_custo_unitario: number;
}

export interface ProcessarItemXMLResponse {
    success: boolean;
    lote_importacao_id: number;
    message: string;
}

// ==========================================
// MÓDULO DE FORNECEDORES
// ==========================================

export const checkSupplier = async (cnpj: string, tenantId: number) => {
    const response = await fetch(`${API_BASE_URL}/parceiros/fornecedores/verificar?tenant_id=${tenantId}&cnpj=${cnpj}`);
    const contentType = response.headers.get("content-type");
    
    if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Erro na API (${response.status}): Rota de verificação de fornecedores não encontrada.`);
    }

    return await response.json();
};

export const createSupplier = async (supplierData: { cnpj: string; name: string; fantasyName: string }, tenantId: number = 1): Promise<any> => {
    // CORRIGIDO: Usando a URL correta a partir da base /api
    const response = await fetch(`${API_BASE_URL}/parceiros/fornecedores`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tenant_id: tenantId,
            cnpj: supplierData.cnpj.replace(/\D/g, ''),
            nome_razao: supplierData.name,
            nome_fantasia: supplierData.fantasyName
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro interno no servidor de cadastro.');
    }

    return response.json();
};

// ==========================================
// MÓDULO DE ITENS / XML & LOTES (Staging)
// ==========================================

/**
 * 3. PROCESSA E SALVA ITEM DO XML NA STAGING (Com suporte a XML Bruto e Lote)
 */
/**
 * BUSCA ITENS DO CATÁLOGO (itens_core) para vincular a um item da NF-e
 */
export interface ItemCatalogoBusca {
    id: number;
    sku: string;
    name: string;
    variacao: string;
    marca: string;
    category: string;
    unitOfMeasure: string;
    status: string;
    tipoRecurso: string;
}

export const buscarItensCatalogo = async (
    termo: string,
    tenantId: number = 1,
    signal?: AbortSignal
): Promise<ItemCatalogoBusca[]> => {
    const response = await fetch(
        `${API_BASE_URL}/catalogo/produtos/search?tenant_id=${tenantId}&term=${encodeURIComponent(termo)}`,
        { signal }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao buscar itens do catálogo.');
    }

    return response.json();
};

export const processItemXML = async (data: ProcessarItemXMLPayload): Promise<ProcessarItemXMLResponse> => {
    const response = await fetch(`${API_BASE_URL}/compras/staging/processar-item`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao processar item do XML no servidor.');
    }

    return response.json();
};

/**
 * 4. SINCRONIZAÇÃO EM LOTE DE ITENS DA NF-E (Envia o XML e todos os produtos de uma vez)
 */
export const sincronizarLoteXMLCompleto = async (payloadData: any) => {
    const response = await fetch(`${API_BASE_URL}/compras/lotes/sincronizar-xml`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadData),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao sincronizar lote completo da NF-e.');
    }

    return response.json();
};

/**
 * RECONHECIMENTO AUTOMÁTICO: item do catálogo sugerido por código do fornecedor (notas anteriores) ou GTIN
 */
// 404 numa rota nova quase sempre é o backend rodando uma versão antiga (ts-node não recarrega sozinho)
const MSG_ROTA_NOVA = 'O servidor não conhece esta função ainda: reinicie o backend (npm start) e tente de novo.';

/**
 * ATRIBUTOS QUE UM ITEM NOVO TERÁ pela família (que traz a categoria) ou só pela categoria
 */
export const getAtributosParaItem = async (
    familiaId: number | null,
    categoriaId: number | null,
    tenantId: number = 1
): Promise<{ familia: { id: number; nome: string; status: string } | null; categoria: { id: number; nome: string } | null; atributos: AtributoFicha[] }> => {
    const qs = new URLSearchParams({ tenant_id: String(tenantId) });
    if (familiaId) qs.set('familia_id', String(familiaId));
    if (categoriaId) qs.set('categoria_id', String(categoriaId));
    const response = await fetch(`${API_BASE_URL}/catalogo/atributos-para-item?${qs}`);
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error(MSG_ROTA_NOVA);
    if (!response.ok) throw new Error(data.error || 'Erro ao carregar os atributos da família/categoria.');
    return data;
};

/**
 * FAMÍLIA/CATEGORIA ATUAIS dos itens já cadastrados vinculados na nota
 */
export const buscarClassificacaoItens = async (
    ids: number[],
    tenantId: number = 1
): Promise<Record<string, { familia: { id: number; nome: string; status: string } | null; categoria: { id: number; nome: string } | null }>> => {
    if (ids.length === 0) return {};
    const response = await fetch(`${API_BASE_URL}/compras/classificacao-itens?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error(MSG_ROTA_NOVA);
    if (!response.ok) throw new Error(data.error || 'Erro ao carregar a classificação dos itens.');
    return data.itens || {};
};

/**
 * PENTE-FINO DO LOTE (bloqueios e avisos antes da entrada no estoque) e APROVAÇÃO (entrada definitiva)
 */
export interface VerificacaoLote { codigo: string; mensagem: string; itens?: string[] }
export interface AnaliseLote {
    aprovavel: boolean;
    bloqueios: VerificacaoLote[];
    avisos: VerificacaoLote[];
    resumo: { totalItens: number; conferidos: number; novos: number; vinculados: number; valorItens: number; valorNota: number };
}

export const analisarLoteStaging = async (loteId: number, tenantId: number = 1): Promise<AnaliseLote> => {
    const response = await fetch(`${API_BASE_URL}/compras/lotes/${loteId}/analise?tenant_id=${tenantId}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Erro ao analisar o lote.');
    return data.analise;
};

export const aprovarLoteStaging = async (loteId: number, tenantId: number = 1): Promise<{ message: string; analise?: AnaliseLote }> => {
    const response = await fetch(`${API_BASE_URL}/compras/lotes/${loteId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        const erro: any = new Error(data.error || 'Erro ao aprovar o lote.');
        erro.analise = data.analise;
        throw erro;
    }
    return data;
};

export const sugerirVinculos = async (
    cnpj: string,
    itens: Array<{ chave: string; codigo?: string; ean?: string }>,
    tenantId: number = 1
): Promise<{ fornecedorCadastrado: boolean; sugestoes: Record<string, any> }> => {
    if (itens.length === 0) return { fornecedorCadastrado: false, sugestoes: {} };
    const response = await fetch(`${API_BASE_URL}/compras/sugestoes-vinculo?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj, itens }),
    });
    if (!response.ok) throw new Error('Erro ao buscar sugestões de vínculo.');
    return response.json();
};

/**
 * ESTADO SALVO DE UM LOTE (para retomar a conferência): por id do lote ou pela chave de acesso da NF
 */
export const buscarEstadoLote = async (
    alvo: { loteId: number } | { chave: string },
    tenantId: number = 1
): Promise<{ lote: { id: number; status: string; chave_acesso: string; xml_conteudo: string | null; frete_adicional: unknown } | null; itens: any[] }> => {
    const caminho = 'loteId' in alvo
        ? `lotes/${alvo.loteId}/estado`
        : `lotes/chave/${encodeURIComponent(alvo.chave)}/estado`;
    const response = await fetch(`${API_BASE_URL}/compras/${caminho}?tenant_id=${tenantId}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao buscar o estado salvo do lote.');
    }

    return response.json();
};

/**
 * 5. BUSCA OS DADOS DE UM LOTE NA STAGING E SEUS ITENS
 */
export const getLoteStaging = async (loteId: number, tenantId: number = 1) => {
    const response = await fetch(`${API_BASE_URL}/compras/staging/lote/${loteId}?tenant_id=${tenantId}`);
    
    if (!response.ok) {
        throw new Error('Erro ao carregar dados do lote de staging.');
    }

    return response.json();
};

/**
 * 6. CONFIRMA O ESTOQUE E FINALIZA O LOTE (Baixa definitiva no ERP)
 */
export const confirmarEstoqueLoteAPI = async (payloadFinal: {
    lote_importacao_id: number;
    tenant_id: number;
    chave_acesso: string;
    resumo_conferencia: object;
    frete_adicional: object;
    itens: Array<any>;
}) => {
    const response = await fetch(`${API_BASE_URL}/compras/staging/confirmar-estoque`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadFinal),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao confirmar entrada no estoque oficial.');
    }

    return response.json();
};
// ---------------------------------------------------------------------------------------------
// Dicionário de unidades de entrada (sigla da NF -> unidade interna, geral ou por fornecedor)
// ---------------------------------------------------------------------------------------------
export interface UnidadeCadastro { id: number; sigla: string; descricao: string }
export interface ResolucaoUnidade { siglaNota: string; siglaInterna: string | null; origem: 'fornecedor' | 'cadastro' | 'geral' | null }
export interface EquivalenciaUnidade {
    id: number; siglaEntrada: string; idFornecedor: number | null; fornecedor: string | null;
    siglaInterna: string; descricaoInterna: string;
}

const lerJsonUnidades = async <T,>(response: Response, erro: string): Promise<T> => {
    const dados = await response.json().catch(() => ({}));
    if (response.status === 404 && !dados.error) throw new Error('Rota não encontrada: reinicie o backend.');
    if (!response.ok) throw new Error(dados.error || erro);
    return dados as T;
};

export const resolverUnidadesEntrada = async (cnpj: string, siglas: string[], tenantId = 1) =>
    lerJsonUnidades<{ idFornecedor: number | null; unidades: UnidadeCadastro[]; resolucoes: Record<string, ResolucaoUnidade> }>(
        await fetch(`${API_BASE_URL}/compras/unidades-entrada?tenant_id=${tenantId}&cnpj=${encodeURIComponent(cnpj)}&siglas=${encodeURIComponent(siglas.join(','))}`),
        'Erro ao consultar as unidades da nota.'
    );

export const listarEquivalenciasUnidade = async (tenantId = 1) =>
    lerJsonUnidades<{ equivalencias: EquivalenciaUnidade[]; unidades: UnidadeCadastro[] }>(
        await fetch(`${API_BASE_URL}/compras/unidades-equivalencias?tenant_id=${tenantId}`),
        'Erro ao carregar o dicionário de unidades.'
    );

export const salvarEquivalenciaUnidade = async (dados: {
    siglaEntrada: string; siglaInterna: string; descricaoInterna?: string;
    escopo: 'fornecedor' | 'geral'; cnpj?: string; idFornecedor?: number | null;
}, tenantId = 1) =>
    lerJsonUnidades<{ success: boolean }>(
        await fetch(`${API_BASE_URL}/compras/unidades-equivalencias?tenant_id=${tenantId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
        }),
        'Erro ao salvar a equivalência de unidade.'
    );

export const excluirEquivalenciaUnidade = async (id: number, tenantId = 1) =>
    lerJsonUnidades<{ success: boolean }>(
        await fetch(`${API_BASE_URL}/compras/unidades-equivalencias/${id}?tenant_id=${tenantId}`, { method: 'DELETE' }),
        'Erro ao excluir a equivalência de unidade.'
    );

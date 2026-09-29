const API_BASE_URL = 'http://localhost:3001/api'; // Mudado para a raiz da API para facilitar o roteamento

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
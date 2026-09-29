const API_BASE_URL = 'http://localhost:3001/api/parceiros/fornecedores'; // Base para fornecedores

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
    id_fornecedor: number;
    cProd: string;
    cEAN?: string | null;
    xProd?: string | null;
}

export interface ProcessarItemXMLResponse {
    status: 'VINCULO_DIRETO_ENCONTRADO' | 'VINCULO_EAN_RESOLVIDO' | 'PRODUTO_INEDITO';
    message: string;
    id_item?: number;
    proximo_passo: string;
    dados_sugeridos?: {
        cProd: string;
        cEAN: string | null;
        xProd: string | null;
    };
}

// ==========================================
// MÓDULO DE FORNECEDORES
// ==========================================

/**
 * 🟢 BUSCAR TODOS OS FORNECEDORES (Adicionado para corrigir o erro)
 */
export const getFornecedores = async (tenantId: number = 1): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}?tenant_id=${tenantId}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao buscar lista de fornecedores.');
    }

    return await response.json();
};

/**
 * 1. CHECA SE O FORNECEDOR EXISTE (Apenas consulta)
 */
export const checkSupplier = async (cnpj: string, tenantId: number) => {
    const response = await fetch(`${API_BASE_URL}/verificar?tenant_id=${tenantId}&cnpj=${cnpj}`);

    const contentType = response.headers.get("content-type");
    
    if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Erro na API (${response.status}): Rota de verificação de fornecedores não encontrada.`);
    }

    return await response.json();
};

/**
 * 2. CADASTRA O FORNECEDOR
 */
export const createSupplier = async (supplierData: { cnpj: string; name: string; fantasyName: string }, tenantId: number = 1): Promise<any> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tenant_id: tenantId,
            cnpj: supplierData.cnpj.replace(/\D/g, ''),
            razao_social: supplierData.name,
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
// -- MÓDULO DE ITENS / XML (Passo 2)
// ==========================================

export const processItemXML = async (data: ProcessarItemXMLPayload): Promise<ProcessarItemXMLResponse> => {
    const response = await fetch('http://localhost:3001/api/compras/itens/processar-xml', {
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
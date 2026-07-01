const API_BASE_URL = 'http://localhost:3001/api'; // Ajuste para a URL do seu backend

// --- INTERFACES DE SOLICITAÇÃO E RESPOSTA ---

// Interface para quando o back-end encontrar o fornecedor
export interface FornecedorQueryResponse {
    exists: boolean;
    supplier?: {
        id: number;
        name: string;
        fantasyName: string;
    };
}

// 🟢 Novas interfaces para o processamento de itens do XML (Passo 2)
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
// MÓDULO DE FORNECEDORES (Passo 1)
// ==========================================

/**
 * 1. CHECA SE O FORNECEDOR EXISTE (Apenas consulta)
 * Envia o CNPJ para o back-end verificar se já está no banco de dados.
 */
export const checkSupplier = async (cnpj: string, tenantId: number = 1): Promise<FornecedorQueryResponse> => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    const response = await fetch(`${API_BASE_URL}/compras/fornecedores/verificar?tenant_id=${tenantId}&cnpj=${cnpjLimpo}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao verificar fornecedor no servidor.');
    }

    return response.json(); // Retorna { exists: true, supplier: {...} } OU { exists: false }
};

/**
 * 2. CADASTRA O FORNECEDOR (Chamado apenas de dentro do seu modal)
 * Executado quando o usuário clica no botão "Salvar Fornecedor" do modal que se abriu.
 */
export const createSupplier = async (supplierData: { cnpj: string; name: string; fantasyName: string }, tenantId: number = 1): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/compras/fornecedores`, {
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
// MÓDULO DE ITENS / XML (Passo 2)
// ==========================================

/**
 * 🟢 3. PROCESSA UM ITEM DO XML (Loop dos Itens)
 * Executa a verificação de baixo para cima (Código do Fornecedor -> EAN) 
 * e cria novos vínculos de forma resiliente mantendo o histórico se necessário.
 */
export const processItemXML = async (data: ProcessarItemXMLPayload): Promise<ProcessarItemXMLResponse> => {
    const response = await fetch(`${API_BASE_URL}/compras/itens/processar-xml`, {
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
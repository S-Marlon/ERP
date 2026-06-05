const API_BASE_URL = 'http://localhost:3001/api'; // Ajuste para a URL do seu backend

// Interface para quando o back-end encontrar o fornecedor
export interface FornecedorQueryResponse {
    exists: boolean;
    supplier?: {
        id: number;
        name: string;
        fantasyName: string;
    };
}

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
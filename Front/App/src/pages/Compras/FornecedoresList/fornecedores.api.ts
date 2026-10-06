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
export interface FornecedorLista {
    id_pessoa: number; status: 'ATIVO' | 'INATIVO'; razao_social: string; nome_fantasia: string | null; cnpj: string;
    inscricao_estadual: string | null; email: string; telefone: string;
    enderecos: Array<{ cidade: string | null; estado: string | null; principal: number | boolean }>;
}

export const getFornecedores = async (tenantId: number = 1): Promise<FornecedorLista[]> => {
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
export const createSupplier = async (
    supplierData: {
        cnpj: string; name: string; fantasyName: string;
        // Dados do XML (opcionais): IE, telefone e endereço
        stateRegistration?: string; phone?: string; email?: string;
        endereco?: { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; cep?: string };
    },
    tenantId: number = 1
): Promise<{ success: boolean; message: string; id_pessoa: number; criado: boolean }> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tenant_id: tenantId,
            cnpj: supplierData.cnpj.replace(/\D/g, ''),
            razao_social: supplierData.name,
            nome_fantasia: supplierData.fantasyName,
            inscricao_estadual: supplierData.stateRegistration || null,
            telefone: supplierData.phone || null,
            email: supplierData.email || null,
            enderecos: supplierData.endereco?.logradouro || supplierData.endereco?.cidade ? [supplierData.endereco] : [],
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) throw new Error('Rota de cadastro de fornecedor não encontrada: reinicie o backend (npm start).');
        throw new Error(errorData.details ? `${errorData.error} (${errorData.details})` : (errorData.error || 'Erro interno no servidor de cadastro.'));
    }

    return response.json();
};

// Detalhe do fornecedor (cadastro + notas de entrada, contas a pagar e produtos vinculados) e edição
export interface EnderecoFornecedor { logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; estado: string; cep: string }
export interface FornecedorDetalhe {
    idPessoa: number; status: 'ATIVO' | 'INATIVO'; observacoes: string | null; criadoEm: string | null;
    razaoSocial: string; nomeFantasia: string | null; cnpj: string; inscricaoEstadual: string | null; inscricaoMunicipal: string | null;
    email: string | null; telefone: string | null; whatsapp: boolean; nomeContato: string | null; endereco: EnderecoFornecedor | null;
    resumo: { qtdNotas: number; totalComprado: number; ultimaCompra: string | null; aPagar: number; vencido: number };
    notas: Array<{ idLote: number; numero: string | null; serie: string | null; emissao: string | null; status: string; financeiro: string | null; valor: number }>;
    titulos: Array<{ idTitulo: number; documento: string | null; parcela: number; totalParcelas: number; vencimento: string; valor: number; status: string; pagoEm: string | null; vencido: boolean; numeroNf: string | null }>;
    produtos: Array<{ idItem: number; sku: string; nome: string; codigoFornecedor: string | null; unidadeCompra: string | null; fatorCompra: number | null; precoUltimaCompra: number | null; vinculadoEm: string | null }>;
}
export type FornecedorEdicao = Pick<FornecedorDetalhe, 'razaoSocial' | 'nomeFantasia' | 'inscricaoEstadual' | 'inscricaoMunicipal' | 'status' | 'observacoes' | 'email' | 'telefone' | 'whatsapp' | 'nomeContato'> & { endereco: Partial<EnderecoFornecedor> | null };

export const getFornecedor = async (id: number, tenantId: number = 1): Promise<FornecedorDetalhe> => {
    const response = await fetch(`${API_BASE_URL}/${id}?tenant_id=${tenantId}`);
    const dados = await response.json().catch(() => ({}));
    if (response.status === 404 && !dados.error) throw new Error('Rota não encontrada: reinicie o backend.');
    if (!response.ok) throw new Error(dados.error || 'Erro ao carregar o fornecedor.');
    return dados;
};

export const updateFornecedor = async (id: number, dados: FornecedorEdicao, tenantId: number = 1): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...dados }),
    });
    const r = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(r.error || 'Erro ao salvar o fornecedor.');
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
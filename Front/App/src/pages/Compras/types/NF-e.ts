// types/NF-e.ts

export interface ProdutoNF {
    // --- IDENTIFICAÇÃO E RASTREABILIDADE ---
    nItem?: number;          // nItem (Número sequencial do item na NF-e)
    sku: string;             // cProd (Seu SKU ou do fornecedor)
    gtin?: string;            // cEAN (Obrigatório: EAN-13 ou "SEM GTIN")
    descricao: string;       // xProd
    ncm: string;             // NCM (8 dígitos)
    cest?: string;           // CEST (Obrigatório se houver Substituição Tributária)
    cfop: string;            // CFOP (Define a operação: venda, devolução, etc)
    unidadeMedida: string;   // uCom (UN, KG, PC, MT)

    // --- QUANTIDADES E VALORES UNITÁRIOS ---
    quantidade: number;      // qCom
    valorUnitario: number;   // vUnCom

    // --- COMPONENTES DO VALOR TOTAL ---
    valorProdutos: number;      // vProd
    valorDesconto: number;      // vDesc
    valorOutrasDespesas: number;// vOutro
    valorFrete: number;         // vFrete

    // --- TRIBUTAÇÃO ---
    valorIcms?: number;          // vICMS
    valorIpi?: number;           // vIPI
    valorIcmsST?: number;        // vICMSST
    valorPis?: number;           // vPIS
    valorCofins?: number;        // vCOFINS
    valorIBS?: number;          // Reforma 2026: estadual/municipal
    valorCBS?: number;          // Reforma 2026: federal
    valorImpostoSeletivo?: number; // Se aplicável ao item

    // --- RESULTADOS CALCULADOS ---
    valorTotalItem: number;     // vNF
    valorCustoReal: number;     // (vProd + vIPI + vICMSST + vOutro + vFrete - vDesc) / qtd

    // --- METADADOS ---
    origem: string;             // 0: Nacional, 1: Importada ou "2"
    valorTotalTributos: number; // vTotTrib (Lei do imposto)

    // --- CAMPOS OPCIONAIS DO XML ---
    valorII?: number;           // Imposto de importação
    valorISSQN?: number;        // ISSQN (serviços)
    cProdANP?: string;          // Combustíveis
    xPed?: string;              // Número do pedido
    nItemPed?: string;          // Item do pedido
}

// --- SUB-INTERFACES AUXILIARES ---

export interface TransportadoraNF {
    cnpjCpf?: string;  // CNPJ ou CPF da transportadora
    nome?: string;     // xNome (Razão Social)
    ie?: string;       // Inscrição Estadual
    endereco?: string; // xEnder
    municipio?: string;// xMun
    uf?: string;       // UF
}

export interface VolumesNF {
    quantidade?: number;   // qVol (Para conferência física)
    especie?: string;      // esp (Ex: "CAIXA", "PALLET")
    pesoLiquido?: number;  // pesoL
    pesoBruto?: number;    // pesoB (Para conferência física)
}

export interface FreteNF {
    modalidade: string;             // modFrete (0=CIF, 1=FOB, 9=Sem Frete, etc)
    transportadora?: TransportadoraNF;
    volumes?: VolumesNF;
}

// --- INTERFACE PRINCIPAL DA NOTA FISCAL ---

export interface NfeDataFromXML {
    chaveAcesso: string;        // chNFe (44 dígitos)
    numero: string;             // nNF
    serie: string;              // Série
    dataEmissao: string;        // dhEmi (ISO 8601)
    tipoOperacao: '0' | '1';    // 0: Entrada, 1: Saída
    situacao?: string;          // Autorizada / Cancelada

    emitente: {
        cnpj: string;
        nome: string;
        nomeFantasia?: string;
        uf: string;
        ie: string;
        logradouro?: string;
        numeroEnd?: string;
        bairro?: string;
        municipio?: string;
        cep?: string;        
        fone?: string;       
        crt?: '1' | '2' | '3'; 
    };

    destinatario: {
        cnpjCpf: string;
        nome: string;
        uf: string;
    };

    // 🚚 Dados Consolidados de Logística e Frete
    frete: FreteNF;

    // --- TOTAIS DA NOTA ---
    valorTotalProdutos: number; // vProd
    valorTotalFrete: number;    // vFrete
    valorTotalSeguro?: number;   // vSeg
    valorTotalIpi: number;      // vIPI
    valorOutrasDespesas: number;// vOutro
    valorTotalDesconto?: number; // vDesc
    valorTotalNf: number;       // vNF

    // --- TOTAIS DE TRIBUTOS ---
    valorTotalIcms?: number;     // vICMS
    valorTotalIcmsST?: number;   // vICMSST
    valorTotalIBS?: number;     // Reforma 2026
    valorTotalCBS?: number;     // Reforma 2026
    valorTotalTributos?: number; // vTotTrib
    valorTotalPIS?: number;      // vPIS
    valorTotalCOFINS?: number;   // vCOFINS

    xmlBruto: string;           // XML original
    produtos: ProdutoNF[];      // Lista de produtos
}
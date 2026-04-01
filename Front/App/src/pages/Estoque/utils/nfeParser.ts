// utils/nfeParser.ts

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface ProdutoNF {
    // --- IDENTIFICAÇÃO E RASTREABILIDADE ---
    sku: string;             // cProd (Seu SKU ou do fornecedor)
    gtin: string;            // cEAN (Obrigatório: EAN-13 ou "SEM GTIN")
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
    valorIcms: number;          // vICMS
    valorIpi: number;           // vIPI
    valorIcmsST: number;        // vICMSST
    valorPis: number;           // vPIS
    valorCofins: number;        // vCOFINS
    valorIBS?: number;          // Reforma 2026: estadual/municipal
    valorCBS?: number;          // Reforma 2026: federal
    valorImpostoSeletivo?: number; // Se aplicável ao item

    // --- RESULTADOS CALCULADOS ---
    valorTotalItem: number;     // vNF
    valorCustoReal: number;     // (vProd + vIPI + vICMSST + vOutro + vFrete - vDesc) / qtd

    // --- METADADOS ---
    origem: number;             // 0: Nacional, 1: Importada
    valorTotalTributos: number; // vTotTrib (Lei do imposto)

    // --- CAMPOS OPCIONAIS DO XML ---
    valorII?: number;           // Imposto de importação
    valorISSQN?: number;        // ISSQN (serviços)
    cProdANP?: string;          // Combustíveis
    xPed?: string;              // Número do pedido
    nItemPed?: string;          // Item do pedido
}

// --- INTERFACE DA NOTA FISCAL ---

export interface NfeDataFromXML {
    chaveAcesso: string;        // chNFe (44 dígitos)
    numero: string;             // nNF
    serie: string;              // Série
    dataEmissao: string;        // dhEmi (ISO 8601)
    tipoOperacao: '0' | '1';    // 0: Entrada, 1: Saída

    emitente: {
        cnpj: string;
        nome: string;
        nomeFantasia?: string;
        uf: string;
        ie: string;
    };
    destinatario: {
        cnpjCpf: string;
        nome: string;
        uf: string;
    };

    valorTotalProdutos: number; // vProd
    valorTotalFrete: number;    // vFrete
    valorTotalSeguro: number;   // vSeg
    valorTotalIpi: number;      // vIPI
    valorOutrasDespesas: number;// vOutro
    valorTotalDesconto: number; // vDesc
    valorTotalNf: number;       // vNF

    valorTotalIcms: number;     // vICMS
    valorTotalIcmsST: number;   // vICMSST
    valorTotalIBS?: number;     // Reforma 2026
    valorTotalCBS?: number;     // Reforma 2026
    valorTotalTributos: number; // vTotTrib
    valorTotalPIS: number;      // vPIS
    valorTotalCOFINS: number;   // vCOFINS

    xmlBruto: string;           // XML original
    produtos: ProdutoNF[];      // Lista de produtos
}

// =========================
// INTERFACES COMPLETAS DO BANCO
// =========================

export interface ProdutoCompleto extends ProdutoNF {
    codigoInterno?: string;        // Código interno do ERP
    codigoBarras?: string;         // Código de barras principal
    imagemUrl?: string;            // URL principal da imagem
    imagens?: string[];            // Array de imagens
    tipoProduto?: 'COMERCIAL' | 'GENERICO' | 'KIT' | 'SERVICO';
    unidadesPorPacote?: number;
    peso?: number;
    comprimento?: number;
    altura?: number;
    largura?: number;
    idMarca?: number;
    idCategoria?: number;
    seoTitle?: string;
    descriptionHtml?: string;
    syncEcommerce?: boolean;
    precoCustoNovo?: number;
    estoqueAtual?: number;
    estoqueMinimo?: number;
    precoVenda?: number;
    precoPromocional?: number;
    fornecedorPrincipal?: string;
}

export interface ProdutoComFornecedor extends ProdutoCompleto {
    idFornecedor?: number;
    skuFornecedor?: string;
    eanFornecedor?: string;
    descricaoFornecedor?: string;
    fatorConversao?: number;
    ultimoCusto?: number;
    fornecedores?: ProdutoComFornecedor[]; // Para múltiplos fornecedores
}

// =========================
// Utils
// =========================

const getTagValue = (parent: Element | undefined, tagName: string): string => {
    if (!parent) return '0.00';

    let element = parent.getElementsByTagNameNS(NFE_NS, tagName)[0];
    if (!element) {
        element = parent.getElementsByTagName(tagName)[0];
    }

    return element?.textContent || '0.00';
};

// =========================
// Parser Principal
// =========================

export const parseNfeXmlToData = (xmlString: string): NfeDataFromXML => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('XML da NF-e malformado.');
    }

    const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0];
    if (!infNFe) {
        throw new Error('Tag <infNFe> não encontrada.');
    }

    const ide = infNFe.getElementsByTagNameNS(NFE_NS, 'ide')[0];
    const emit = infNFe.getElementsByTagNameNS(NFE_NS, 'emit')[0];
    const dest = infNFe.getElementsByTagNameNS(NFE_NS, 'dest')[0];
    const totalICMS = infNFe
        .getElementsByTagNameNS(NFE_NS, 'total')[0]
        ?.getElementsByTagNameNS(NFE_NS, 'ICMSTot')[0];

    // =========================
    // Produtos
    // =========================

    const detElements = infNFe.getElementsByTagNameNS(NFE_NS, 'det');

    const produtos: ProdutoNF[] = Array.from(detElements).map(det => {
        const prod = det.getElementsByTagNameNS(NFE_NS, 'prod')[0];
        const imposto = det.getElementsByTagNameNS(NFE_NS, 'imposto')[0];

        if (!prod || !imposto) {
            throw new Error('Produto ou imposto não encontrado em <det>.');
        }

        // --- ICMS ---
        let valorIcms = 0;
        let valorIcmsST = 0;

        const icmsNode = imposto
            .getElementsByTagNameNS(NFE_NS, 'ICMS')[0]
            ?.firstElementChild as Element | undefined;

        if (icmsNode) {
            valorIcms = parseFloat(getTagValue(icmsNode, 'vICMS'));
            valorIcmsST = parseFloat(getTagValue(icmsNode, 'vICMSST'));
        }

        // --- IPI ---
        const ipiNode = imposto
            .getElementsByTagNameNS(NFE_NS, 'IPI')[0]
            ?.getElementsByTagNameNS(NFE_NS, 'IPITrib')[0];

        const valorIpi = ipiNode ? parseFloat(getTagValue(ipiNode, 'vIPI')) : 0;


        // --- PIS / COFINS com fallback de segurança ---
    const pisNode = imposto.getElementsByTagNameNS(NFE_NS, 'PIS')[0];
    const pisSubNode = pisNode?.querySelector('PISAliq, PISOutr, PISNT, PISSN') as Element | undefined;
    const valorPis = parseFloat(getTagValue(pisSubNode, 'vPIS'));

    const cofinsNode = imposto.getElementsByTagNameNS(NFE_NS, 'COFINS')[0];
    const cofinsSubNode = cofinsNode?.querySelector('COFINSAliq, COFINSOutr, COFINSNT, COFINSSN') as Element | undefined;
    const valorCofins = parseFloat(getTagValue(cofinsSubNode, 'vCOFINS'));

        // --- Reforma Tributária ---
        const valorIBS = parseFloat(getTagValue(imposto, 'vIBS'));
        const valorCBS = parseFloat(getTagValue(imposto, 'vCBS'));

        // --- Valores base ---
        const valorProdutos = parseFloat(getTagValue(prod, 'vProd'));
        const valorDesconto = parseFloat(getTagValue(prod, 'vDesc'));
        const valorOutrasDespesas = parseFloat(getTagValue(prod, 'vOutro'));
        const valorFrete = parseFloat(getTagValue(prod, 'vFrete'));
        const quantidade = parseFloat(getTagValue(prod, 'qCom'));

        const custoTotalItem =
            valorProdutos +
            valorIpi +
            valorIcmsST +
            valorOutrasDespesas +
            valorFrete -
            valorDesconto;

        const valorCustoReal =
            quantidade > 0 ? custoTotalItem / quantidade : 0;

        const valorTotalItem = custoTotalItem;

        const origem = icmsNode
            ? parseInt(getTagValue(icmsNode, 'orig') || '0')
            : 0;

        const gtinRaw = getTagValue(prod, 'cEAN');
        const gtin = gtinRaw === 'SEM GTIN' ? '' : gtinRaw;

        // const chNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'chNFe')[0]?.textContent || 
        //       infNFe.getAttribute('Id')?.replace('NFe', '') || '';

        return {
            sku: getTagValue(prod, 'cProd'),
            gtin,
            descricao: getTagValue(prod, 'xProd'),
            ncm: getTagValue(prod, 'NCM'),
            cest:
                getTagValue(prod, 'CEST') === '0.00'
                    ? undefined
                    : getTagValue(prod, 'CEST'),
            cfop: getTagValue(prod, 'CFOP'),
            unidadeMedida: getTagValue(prod, 'uCom'),

            quantidade,
            valorUnitario: parseFloat(getTagValue(prod, 'vUnCom')),

            valorProdutos,
            valorDesconto,
            valorOutrasDespesas,
            valorFrete,

            valorIcms,
            valorIpi,
            valorIcmsST,
            valorPis,
            valorCofins,

            valorIBS: valorIBS > 0 ? valorIBS : undefined,
            valorCBS: valorCBS > 0 ? valorCBS : undefined,

            valorTotalItem,
            valorCustoReal,

            origem,
            valorTotalTributos: parseFloat(getTagValue(imposto, 'vTotTrib'))
        };
    });

    // =========================
    // Retorno Final
    // =========================

    const razaoSocial = getTagValue(emit, 'xNome');
    const nomeFantasiaRaw = getTagValue(emit, 'xFant');

    return {
        chaveAcesso: xmlDoc.getElementsByTagNameNS(NFE_NS, 'chNFe')[0]?.textContent || 
                 infNFe.getAttribute('Id')?.replace('NFe', '') || '',
    
    numero: getTagValue(ide, 'nNF'),
        serie: getTagValue(ide, 'serie'),
        dataEmissao: getTagValue(ide, 'dhEmi'),
        tipoOperacao: getTagValue(ide, 'tpNF') as '0' | '1',

        emitente: {
            cnpj: getTagValue(emit, 'CNPJ'),
            nome: razaoSocial,
            nomeFantasia:
                nomeFantasiaRaw && nomeFantasiaRaw !== '0.00'
                    ? nomeFantasiaRaw
                    : razaoSocial,
            uf: getTagValue(
                emit.getElementsByTagNameNS(NFE_NS, 'enderEmit')[0],
                'UF'
            ),
            ie: getTagValue(emit, 'IE')
        },

        destinatario: {
            cnpjCpf:
                getTagValue(dest, 'CNPJ') || getTagValue(dest, 'CPF'),
            nome: getTagValue(dest, 'xNome'),
            uf: getTagValue(
                dest.getElementsByTagNameNS(NFE_NS, 'enderDest')[0],
                'UF'
            )
        },

        valorTotalProdutos: parseFloat(getTagValue(totalICMS, 'vProd')),
        valorTotalFrete: parseFloat(getTagValue(totalICMS, 'vFrete')),
        valorTotalSeguro: parseFloat(getTagValue(totalICMS, 'vSeg')),
        valorTotalIpi: parseFloat(getTagValue(totalICMS, 'vIPI')),
        valorOutrasDespesas: parseFloat(getTagValue(totalICMS, 'vOutro')),
        valorTotalDesconto: parseFloat(getTagValue(totalICMS, 'vDesc')),
        valorTotalNf: parseFloat(getTagValue(totalICMS, 'vNF')),

        valorTotalIcms: parseFloat(getTagValue(totalICMS, 'vICMS')),
        valorTotalIcmsST: parseFloat(getTagValue(totalICMS, 'vICMSST')),
        valorTotalTributos: parseFloat(getTagValue(totalICMS, 'vTotTrib')),
        valorTotalPIS: parseFloat(getTagValue(totalICMS, 'vPIS')),     // Adicionado
    valorTotalCOFINS: parseFloat(getTagValue(totalICMS, 'vCOFINS')), // Adicionado

        xmlBruto: xmlString,
        produtos
    };
};
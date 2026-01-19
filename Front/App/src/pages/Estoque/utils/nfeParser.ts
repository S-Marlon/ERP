// utils/nfeParser.ts

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

// --- Interfaces ---
export interface ProdutoNF {
    // --- IDENTIFICAÇÃO E RASTREABILIDADE ---
    codigo: string;             // cProd (Seu SKU ou do fornecedor)
    gtin: string;               // cEAN (Obrigatório: EAN-13 ou "SEM GTIN")
    descricao: string;          // xProd
    ncm: string;                // NCM (8 dígitos)
    cest?: string;              // CEST (Obrigatório se houver Substituição Tributária)
    cfop: string;               // CFOP (Define a operação: venda, devolução, etc)
    unidadeMedida: string;      // uCom (UN, KG, PC, MT)
    
    // --- QUANTIDADES E VALORES UNITÁRIOS ---
    quantidade: number;         // qCom (Usar number para cálculos precisos)
    valorUnitario: number;      // vUnCom (Valor do item antes de impostos/frete)
    
    // --- COMPONENTES DO VALOR TOTAL (Para chegar no Custo Real) ---
    valorProdutos: number;      // vProd (Qtd * Valor Unitário)
    valorDesconto: number;      // vDesc
    valorOutrasDespesas: number;// vOutro (Seguro, taxas extras)
    valorFrete: number;         // vFrete (Rateado para o item)
    
    // --- TRIBUTAÇÃO TRADICIONAL ---
    valorIcms: number;          // vICMS
    valorIpi: number;           // vIPI
    valorIcmsST: number;        // vICMSST (Fundamental para quem revende)
    
    // --- REFORMA TRIBUTÁRIA (Essencial em 2026) ---
    valorIBS?: number;          // Imposto sobre Bens e Serviços (Estadual/Municipal)
    valorCBS?: number;          // Contribuição sobre Bens e Serviços (Federal)
    valorImpostoSeletivo?: number; // "Imposto do Pecado" (se aplicável ao item)

    // --- RESULTADOS CALCULADOS ---
    valorTotalItem: number;     // vNF (Valor final que o item soma no total da nota)
    valorCustoReal: number;     // Cálculo: (vProd + vIPI + vICMSST + vOutro + vFrete - vDesc) / Qtd
    
    // --- METADADOS ---
    origem: number;             // Origem da mercadoria (0: Nacional, 1: Importada, etc)
    valorTotalTributos: number; // vTotTrib (Lei do Imposto na Nota)

}

export interface NfeDataFromXML {
    // --- IDENTIFICAÇÃO DA NOTA ---
    chaveAcesso: string;        // chNFe (44 dígitos)
    numero: string;             // nNF
    serie: string;              // ✨ ADICIONADO: Importante para unicidade
    dataEmissao: string;        // dhEmi (ISO 8601)
    tipoOperacao: '0' | '1';    // ✨ 0: Entrada, 1: Saída

    // --- ENVOLVIDOS ---
    emitente: {
        cnpj: string;
        nome: string;           // xNome
        nomeFantasia?: string;  // xFant
        uf: string;
        ie: string;             // ✨ Inscrição Estadual (Essencial para crédito de imposto)
    };
    destinatario: {
        cnpjCpf: string;
        nome: string;
        uf: string;             // ✨ ADICIONADO: Para calcular diferencial de alíquota
    };

    // --- TOTAIS FINANCEIROS (Valores em number para cálculos) ---
    valorTotalProdutos: number; // vProd (Soma bruta dos itens)
    valorTotalFrete: number;    // vFrete
    valorTotalSeguro: number;   // vSeg
    valorTotalIpi: number;      // vIPI
    valorOutrasDespesas: number;// vOutro
    valorTotalDesconto: number; // vDesc
    valorTotalNf: number;       // vNF (Valor final do boleto/pagamento)

    // --- TOTAIS TRIBUTÁRIOS (Transição 2026) ---
    valorTotalIcms: number;     // vICMS
    valorTotalIcmsST: number;   // vICMSST
    valorTotalIBS?: number;     // ✨ Novo: Imposto sobre Bens e Serviços
    valorTotalCBS?: number;     // ✨ Novo: Contribuição sobre Bens e Serviços
    valorTotalTributos: number; // vTotTrib (Lei do Imposto na Nota)

    // --- CONTEÚDO ---
    xmlBruto: string;           // String original para auditoria ou reprocessamento
    produtos: ProdutoNF[];      // Lista usando a interface anterior
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

        return {
            codigo: getTagValue(prod, 'cProd'),
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
        chaveAcesso: infNFe.getAttribute('Id')?.replace('NFe', '') || '',
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

        xmlBruto: xmlString,
        produtos
    };
};
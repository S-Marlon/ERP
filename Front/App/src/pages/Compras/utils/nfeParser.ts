// utils/nfeParser.ts

import { NfeDataFromXML, ProdutoNF } from "../types/NF-e";

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';


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

        // 🔴 CAPTURA DO NÚMERO DO ITEM (<det nItem="X">)
        const nItemAttr = det.getAttribute('nItem');
        const nItem = nItemAttr ? parseInt(nItemAttr, 10) : undefined;

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
    ? getTagValue(icmsNode, 'orig') || '0'
    : '0';

        const gtinRaw = getTagValue(prod, 'cEAN');
        const gtin = gtinRaw === 'SEM GTIN' ? '' : gtinRaw;

        return {
            nItem, // 🔴 Propriedade adicionada ao retorno do mapeamento do produto
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

            origem, // string ('0', '1', '2', etc.)
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
        valorTotalPIS: parseFloat(getTagValue(totalICMS, 'vPIS')),
        valorTotalCOFINS: parseFloat(getTagValue(totalICMS, 'vCOFINS')),

        xmlBruto: xmlString,
        produtos
    };
};
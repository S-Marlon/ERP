// utils/nfeParser.ts

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

// --- Interfaces ---
export interface Produto {
    codigo: string;
    descricao: string;
    quantidade: string;
    unidadeMedida: string;      // ✨ ADICIONADO: uCom
    valorUnitario: string;
    valorTotal: string; 
    valorIcms: string;
    valorIpi: string;
    valorTotalTributos: string;
}

export interface NfeDataFromXML { 
    chaveAcesso: string;
    numero: string;
    dataEmissao: string;
    emitente: {
        cnpj: string;
        nome: string;
        uf: string;
    };
    destinatario: {
        cnpjCpf: string;
        nome: string;
    };
    valorTotal: string;
    valorTotalFrete: string;
    valorTotalIpi: string;
    valorOutrasDespesas: string;
    valorTotalTributos: string;
    xmlBruto: string;
    produtos: Produto[];
}

const getTagValue = (parent: Element, tagName: string): string => {
    let element = parent.getElementsByTagNameNS(NFE_NS, tagName)[0];
    if (!element) {
         element = parent.getElementsByTagName(tagName)[0];
    }
    return element ? element.textContent || '0.00' : '0.00'; 
};

/**
 * Faz o parse do XML da NF-e para um objeto estruturado.
 */
export const parseNfeXmlToData = (xmlString: string): NfeDataFromXML | null => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        const parserErrors = xmlDoc.getElementsByTagName('parsererror');
        if (parserErrors.length > 0) {
            throw new Error(`XML Malformado.`);
        }

        const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0];
        if (!infNFe) throw new Error('Tag <infNFe> não encontrada.');

        const ide = infNFe.getElementsByTagNameNS(NFE_NS, 'ide')[0];
        const emit = infNFe.getElementsByTagNameNS(NFE_NS, 'emit')[0];
        const dest = infNFe.getElementsByTagNameNS(NFE_NS, 'dest')[0];
        const totalICMS = infNFe.getElementsByTagNameNS(NFE_NS, 'total')[0]?.getElementsByTagNameNS(NFE_NS, 'ICMSTot')[0];

        const chaveAcesso = infNFe.getAttribute('Id')?.replace('NFe', '') || 'N/A';
        
        // --- 1. Extração de Produtos ---
        const detElements = infNFe.getElementsByTagNameNS(NFE_NS, 'det');
        const produtos: Produto[] = Array.from(detElements)
            .map(det => {
                const prod = det.getElementsByTagNameNS(NFE_NS, 'prod')[0];
                const imposto = det.getElementsByTagNameNS(NFE_NS, 'imposto')[0];
                
                if (!prod) return null;

                // Lógica para ICMS (pode estar em diferentes tags: ICMS00, ICMS40, etc)
                let vICMS = '0.00';
                const icmsNode = imposto?.getElementsByTagNameNS(NFE_NS, 'ICMS')[0];
                if (icmsNode && icmsNode.firstElementChild) {
                    vICMS = getTagValue(icmsNode.firstElementChild, 'vICMS');
                }
                
                const vIPI = getTagValue(imposto?.getElementsByTagNameNS(NFE_NS, 'IPI')[0]?.getElementsByTagNameNS(NFE_NS, 'IPITrib')[0] || imposto, 'vIPI');
                const vTotTribItem = getTagValue(imposto, 'vTotTrib');

                return {
                    codigo: getTagValue(prod, 'cProd'),
                    descricao: getTagValue(prod, 'xProd'),
                    quantidade: getTagValue(prod, 'qCom'),
                    unidadeMedida: getTagValue(prod, 'uCom'), // ✨ CAPTURANDO A UNIDADE (uCom)
                    valorUnitario: getTagValue(prod, 'vUnCom'),
                    valorTotal: getTagValue(prod, 'vProd'), 
                    valorIcms: vICMS,
                    valorIpi: vIPI,
                    valorTotalTributos: vTotTribItem,
                };
            })
            .filter((p): p is Produto => p !== null);

        // --- 2. Extração de Totais ---
        return {
            chaveAcesso: chaveAcesso,
            numero: getTagValue(ide, 'nNF'),
            dataEmissao: getTagValue(ide, 'dhEmi').substring(0, 10),
            emitente: {
                cnpj: getTagValue(emit, 'CNPJ'),
                nome: getTagValue(emit, 'xNome'),
                uf: getTagValue(emit.getElementsByTagNameNS(NFE_NS, 'enderEmit')[0], 'UF'),
            },
            destinatario: {
                cnpjCpf: getTagValue(dest, 'CNPJ') || getTagValue(dest, 'CPF'),
                nome: getTagValue(dest, 'xNome'),
            },
            valorTotal: getTagValue(totalICMS, 'vNF'),
            valorTotalFrete: getTagValue(totalICMS, 'vFrete'), 
            valorTotalIpi: getTagValue(totalICMS, 'vIPI'),
            valorOutrasDespesas: getTagValue(totalICMS, 'vOutro'), 
            valorTotalTributos: getTagValue(totalICMS, 'vTotTrib'),
            xmlBruto: xmlString,
            produtos: produtos,
        };

    } catch (e) {
        console.error('Erro no parser da NFe:', e);
        throw e;
    }
};
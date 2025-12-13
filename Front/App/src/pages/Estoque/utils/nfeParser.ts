// utils/nfeParser.ts
// Este é o conteúdo ajustado do seu antigo NFeReader.tsx

// Ajuste o namespace para o padrão NF-e (xmlns)
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

// --- Interfaces ---
export interface Produto {
    codigo: string;
    descricao: string;
    quantidade: string;
    valorUnitario: string;
    valorTotal: string; 

    // 🚨 NOVOS CAMPOS POR ITEM
    valorIcms: string;        // vICMS
    valorIpi: string;         // vIPI
    valorTotalTributos: string; // vTotTrib (se disponível na tag <imposto>)
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
    valorTotal: string;          // vNF
    valorTotalFrete: string;     // vFrete
    valorTotalIpi: string;       // vIPI (total)
    valorOutrasDespesas: string; // vOutro

    // 🚨 NOVO TOTAL: Total de tributos da nota
    valorTotalTributos: string; // vTotTrib (total)
    
    produtos: Produto[];
}

// Função auxiliar para obter valor de uma tag com namespace
const getTagValue = (parent: Element, tagName: string): string => {
    let element = parent.getElementsByTagNameNS(NFE_NS, tagName)[0];
    
    if (!element) {
         element = parent.getElementsByTagName(tagName)[0];
    }
    
    // Retorna '0.00' por padrão se a tag não for encontrada.
    return element ? element.textContent || '0.00' : '0.00'; 
};

// **Função Corrigida e Aprimorada**
export const parseNfeXmlToData = (xmlString: string): NfeDataFromXML | null => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        const parserErrors = xmlDoc.getElementsByTagName('parsererror');
        if (parserErrors.length > 0) {
            const errorText = parserErrors[0].textContent;
            throw new Error(`XML Malformado. Detalhe: ${errorText}`);
        }

        const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0];
        if (!infNFe) throw new Error('Tag <infNFe> não encontrada.');

        const ide = infNFe.getElementsByTagNameNS(NFE_NS, 'ide')[0];
        const emit = infNFe.getElementsByTagNameNS(NFE_NS, 'emit')[0];
        const dest = infNFe.getElementsByTagNameNS(NFE_NS, 'dest')[0];
        const totalICMS = infNFe.getElementsByTagNameNS(NFE_NS, 'total')[0]?.getElementsByTagNameNS(NFE_NS, 'ICMSTot')[0];
        const totalTributos = infNFe.getElementsByTagNameNS(NFE_NS, 'total')[0]?.getElementsByTagNameNS(NFE_NS, 'ICMSTot')[0]; // Usa o mesmo bloco de totais

        const chaveAcesso = infNFe.getAttribute('Id')?.replace('NFe', '') || 'N/A';
        
        // --- 1. Extração de Produtos (Com ICMS/IPI/TotTrib por item) ---
        const detElements = infNFe.getElementsByTagNameNS(NFE_NS, 'det');
        const produtos: Produto[] = Array.from(detElements)
            .map(det => {
                const prod = det.getElementsByTagNameNS(NFE_NS, 'prod')[0];
                const imposto = det.getElementsByTagNameNS(NFE_NS, 'imposto')[0];
                
                if (!prod) return null;

                // Extrai valores de impostos
                let vICMS = '0.00';
                const icmsNode = imposto?.getElementsByTagNameNS(NFE_NS, 'ICMS')[0]?.children;
                // Procura a tag vICMS dentro de qualquer tag filha de ICMS (e.g., ICMS00, ICMS40, etc.)
                if (icmsNode) {
                    for (let i = 0; i < icmsNode.length; i++) {
                        const vIcmsElement = icmsNode[i].getElementsByTagNameNS(NFE_NS, 'vICMS')[0];
                        if (vIcmsElement) {
                            vICMS = vIcmsElement.textContent || '0.00';
                            break; 
                        }
                    }
                }
                
                const vIPI = getTagValue(imposto?.getElementsByTagNameNS(NFE_NS, 'IPI')[0]?.getElementsByTagNameNS(NFE_NS, 'IPITrib')[0] || imposto, 'vIPI');
                const vTotTribItem = getTagValue(imposto, 'vTotTrib'); // Valor total aproximado dos tributos do item (Lei da Transparência)

                
                return {
                    codigo: getTagValue(prod, 'cProd'),
                    descricao: getTagValue(prod, 'xProd'),
                    quantidade: getTagValue(prod, 'qCom'),
                    valorUnitario: getTagValue(prod, 'vUnCom'),
                    valorTotal: getTagValue(prod, 'vProd'), 

                    // 🚨 NOVOS VALORES FISCAIS DO ITEM
                    valorIcms: vICMS,
                    valorIpi: vIPI,
                    valorTotalTributos: vTotTribItem,
                } as Produto;
            })
            .filter((p): p is Produto => p !== null);

        // --- 2. Extração de Totais (vFrete, vIPI Total, vOutro, vTotTrib Total) ---
        const vNF = totalICMS ? getTagValue(totalICMS, 'vNF') : '0.00';
        const vFrete = totalICMS ? getTagValue(totalICMS, 'vFrete') : '0.00';
        const vIPI = totalICMS ? getTagValue(totalICMS, 'vIPI') : '0.00';
        const vOutro = totalICMS ? getTagValue(totalICMS, 'vOutro') : '0.00'; 
        const vTotTribTotal = totalTributos ? getTagValue(totalTributos, 'vTotTrib') : '0.00'; // Total de tributos da nota (Lei da Transparência)

        // --- 3. Retorno ---
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
            valorTotal: vNF,
            valorTotalFrete: vFrete, 
            valorTotalIpi: vIPI,
            valorOutrasDespesas: vOutro, 
            valorTotalTributos: vTotTribTotal, // Total geral de tributos
            produtos: produtos,
        } as NfeDataFromXML;

    } catch (e) {
        console.error('Erro no parser da NFe:', e);
        throw new Error(`Falha ao ler o XML da NF-e: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
    }
};
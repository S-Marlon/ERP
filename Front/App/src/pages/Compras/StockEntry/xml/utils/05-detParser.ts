// 05-detParser.ts

import { parseImpostosItem, ImpostosItemData } from './impostos'; // 👈 Importando o maestro de impostos modular

export const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

// Reexportando ou mantendo compatibilidade com a tipagem unificada de impostos
export type ImpostoItemData = ImpostosItemData;

export interface ProdData {
    nItem: string;
    cProd: string;
    cEAN: string;
    xProd: string;
    NCM: string;
    CEST?: string;
    CFOP: string;
    uCom: string;
    qCom: string;
    vUnCom: string;
    vProd: string;
    cEANTrib: string;
    uTrib: string;
    qTrib: string;
    vUnTrib: string;
    indTot: string;
    vFrete?: string;
    vSeg?: string;
    vDesc?: string;
    vOutro?: string;
    infAdProd?: string;
}

export interface ItemNFeData {
    nItem: string;
    prod: ProdData;
    imposto: ImpostosItemData | null;
    vItem?: string; // Valor total do item considerando acréscimos/impostos na tag <vItem>
}

export const parseProdutosNFe = (xmlString: string): ItemNFeData[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('O arquivo XML está malformado ou corrompido.');
    }

    const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0] || xmlDoc.getElementsByTagName('infNFe')[0];
    if (!infNFe) {
        throw new Error('Elemento obrigatório <infNFe> não encontrado.');
    }

 const getTagValue = (parent: Element | Document, tagName: string): string => {
        const el = parent.getElementsByTagNameNS(NFE_NS, tagName)[0] 
              || parent.getElementsByTagName(tagName)[0]
              || Array.from(parent.getElementsByTagName('*')).find(child => child.localName.toLowerCase() === tagName.toLowerCase());
        return el ? el.textContent?.trim() || '' : '';
    };

    const detElements = infNFe.getElementsByTagNameNS(NFE_NS, 'det').length > 0
        ? infNFe.getElementsByTagNameNS(NFE_NS, 'det')
        : infNFe.getElementsByTagName('det');

    const itens: ItemNFeData[] = [];

    for (let i = 0; i < detElements.length; i++) {
        const detEl = detElements[i];
        const nItem = detEl.getAttribute('nItem') || getTagValue(detEl, 'nItem') || String(i + 1);

        const prodEl = detEl.getElementsByTagNameNS(NFE_NS, 'prod')[0] || detEl.getElementsByTagName('prod')[0];
        const impostoEl = detEl.getElementsByTagNameNS(NFE_NS, 'imposto')[0] || detEl.getElementsByTagName('imposto')[0];
        const vItemTag = getTagValue(detEl, 'vItem');

        if (prodEl) {
            const prod: ProdData = {
                nItem,
                cProd: getTagValue(prodEl, 'cProd'),
                cEAN: getTagValue(prodEl, 'cEAN'),
                xProd: getTagValue(prodEl, 'xProd'),
                NCM: getTagValue(prodEl, 'NCM'),
                CEST: getTagValue(prodEl, 'CEST') || undefined,
                CFOP: getTagValue(prodEl, 'CFOP'),
                uCom: getTagValue(prodEl, 'uCom'),
                qCom: getTagValue(prodEl, 'qCom'),
                vUnCom: getTagValue(prodEl, 'vUnCom'),
                vProd: getTagValue(prodEl, 'vProd'),
                cEANTrib: getTagValue(prodEl, 'cEANTrib'),
                uTrib: getTagValue(prodEl, 'uTrib'),
                qTrib: getTagValue(prodEl, 'qTrib'),
                vUnTrib: getTagValue(prodEl, 'vUnTrib'),
                indTot: getTagValue(prodEl, 'indTot'),
                vFrete: getTagValue(prodEl, 'vFrete') || undefined,
                vSeg: getTagValue(prodEl, 'vSeg') || undefined,
                vDesc: getTagValue(prodEl, 'vDesc') || undefined,
                vOutro: getTagValue(prodEl, 'vOutro') || undefined,
                infAdProd: getTagValue(detEl, 'infAdProd') || undefined,
            };

            // Utilizando o maestro modular de impostos que criamos na pasta /impostos
            const imposto = parseImpostosItem(impostoEl);

            itens.push({
                nItem,
                prod,
                imposto,
                vItem: vItemTag || undefined,
            });
        }
    }

    return itens;
};
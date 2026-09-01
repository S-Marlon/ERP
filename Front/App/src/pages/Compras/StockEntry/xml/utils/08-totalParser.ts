// 08-totalParser.ts

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface ICMSTotData {
  vBC: string;
  vICMS: string;
  vICMSDesonerado: string;
  vFCP: string;
  vBCST: string;
  vST: string;
  vICMSST: string; // Adicionado aqui
  vFCPST: string;
  vFCPSTRet: string;
  vProd: string;
  vFrete: string;
  vSeg: string;
  vDesc: string;
  vII: string;
  vIPI: string;
  vIPIDevol: string;
  vPIS: string;
  vCOFINS: string;
  vOutro: string;
  vNF: string;
}

export interface TotalNFeData {
  icmsTot: ICMSTotData | null;
}

export const parseTotalNFe = (xmlString: string): TotalNFeData | null => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('O arquivo XML está malformado ou corrompido.');
  }

  const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0] || xmlDoc.getElementsByTagName('infNFe')[0];
  if (!infNFe) return null;

  const getTagValue = (parent: Element, tagName: string): string => {
    const el = parent.getElementsByTagNameNS(NFE_NS, tagName)[0] || parent.getElementsByTagName(tagName)[0];
    return el ? el.textContent?.trim() || '' : '';
  };

  const totalEl = infNFe.getElementsByTagNameNS(NFE_NS, 'total')[0] || infNFe.getElementsByTagName('total')[0];
  if (!totalEl) return null;

  const icmsTotEl = totalEl.getElementsByTagNameNS(NFE_NS, 'ICMSTot')[0] || totalEl.getElementsByTagName('ICMSTot')[0];
  let icmsTot: ICMSTotData | null = null;

  if (icmsTotEl) {
    const vSTVal = getTagValue(icmsTotEl, 'vST');

    // Fallback opcional: se vST vier vazio nos totais, podemos somar de todos os <det>
    let calculatedVICMSST = vSTVal;
    if (!vSTVal || parseFloat(vSTVal) === 0) {
      const dets = infNFe.getElementsByTagNameNS(NFE_NS, 'det') || infNFe.getElementsByTagName('det');
      let sumST = 0;
      for (let i = 0; i < dets.length; i++) {
        const det = dets[i];
        // Procura vICMSST ou vST dentro das tags de ICMS do item
        const vICMSSTItem = getTagValue(det, 'vICMSST') || getTagValue(det, 'vST');
        if (vICMSSTItem) {
          sumST += parseFloat(vICMSSTItem) || 0;
        }
      }
      if (sumST > 0) {
        calculatedVICMSST = sumST.toFixed(2);
      }
    }

    icmsTot = {
      vBC: getTagValue(icmsTotEl, 'vBC'),
      vICMS: getTagValue(icmsTotEl, 'vICMS'),
      vICMSDesonerado: getTagValue(icmsTotEl, 'vICMSDesonerado'),
      vFCP: getTagValue(icmsTotEl, 'vFCP'),
      vBCST: getTagValue(icmsTotEl, 'vBCST'),
      vST: vSTVal,
      vICMSST: calculatedVICMSST, // Preenche o vICMSST unificado
      vFCPST: getTagValue(icmsTotEl, 'vFCPST'),
      vFCPSTRet: getTagValue(icmsTotEl, 'vFCPSTRet'),
      vProd: getTagValue(icmsTotEl, 'vProd'),
      vFrete: getTagValue(icmsTotEl, 'vFrete'),
      vSeg: getTagValue(icmsTotEl, 'vSeg'),
      vDesc: getTagValue(icmsTotEl, 'vDesc'),
      vII: getTagValue(icmsTotEl, 'vII'),
      vIPI: getTagValue(icmsTotEl, 'vIPI'),
      vIPIDevol: getTagValue(icmsTotEl, 'vIPIDevol'),
      vPIS: getTagValue(icmsTotEl, 'vPIS'),
      vCOFINS: getTagValue(icmsTotEl, 'vCOFINS'),
      vOutro: getTagValue(icmsTotEl, 'vOutro'),
      vNF: getTagValue(icmsTotEl, 'vNF'),
    };
  }

  return { icmsTot };
};
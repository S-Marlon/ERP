// /cobrPagParser.ts

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface DupData {
  nDup: string;
  dVenc: string;
  vDup: string;
}

export interface FatData {
  nFat: string;
  vOrig: string;
  vDesc: string;
  vLiq: string;
}

export interface DetPagData {
  tPag: string;  // 01=Dinheiro, 03=Cartão de Crédito, 04=Cartão de Débito, 17=PIX, 15=Boleto, etc.
  vPag: string;
  // Dados de cartão (se houver)
  tpIntegra?: string;
  CNPJ?: string;
  tBand?: string;
  cAut?: string;
}

export interface CobrPagNFeData {
  fat: FatData | null;
  dup: DupData[];
  detPag: DetPagData[];
  vTroco?: string;
}

// Tradutor auxiliar para a forma de pagamento (tPag)
export function getTPagDescricao(tPag: string): string {
  switch (tPag) {
    case '01': return 'Dinheiro';
    case '02': return 'Cheque';
    case '03': return 'Cartão de Crédito';
    case '04': return 'Cartão de Débito';
    case '05': return 'Crédito Loja';
    case '10': return 'Vale Alimentação';
    case '11': return 'Vale Refeição';
    case '12': return 'Vale Presente';
    case '13': return 'Vale Combustível';
    case '15': return 'Boleto Bancário';
    case '16': return 'Depósito Bancário';
    case '17': return 'PIX';
    case '18': return 'Transferência Bancária / Carteira Digital';
    case '19': return 'Programa de Fidelidade / Cashback';
    case '90': return 'Sem Pagamento';
    case '99': return 'Outros';
    default: return `Outro (${tPag})`;
  }
}

export const parseCobrPagNFe = (xmlString: string): CobrPagNFeData | null => {
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

  // 1. Bloco de Cobrança (<cobr>) -> Fatura e Duplicatas
  const cobrEl = infNFe.getElementsByTagNameNS(NFE_NS, 'cobr')[0] || infNFe.getElementsByTagName('cobr')[0];
  let fat: FatData | null = null;
  const dup: DupData[] = [];

  if (cobrEl) {
    const fatEl = cobrEl.getElementsByTagNameNS(NFE_NS, 'fat')[0] || cobrEl.getElementsByTagName('fat')[0];
    if (fatEl) {
      fat = {
        nFat: getTagValue(fatEl, 'nFat'),
        vOrig: getTagValue(fatEl, 'vOrig'),
        vDesc: getTagValue(fatEl, 'vDesc'),
        vLiq: getTagValue(fatEl, 'vLiq'),
      };
    }

    const dupElements = cobrEl.getElementsByTagNameNS(NFE_NS, 'dup').length > 0
      ? cobrEl.getElementsByTagNameNS(NFE_NS, 'dup')
      : cobrEl.getElementsByTagName('dup');

    for (let i = 0; i < dupElements.length; i++) {
      const dEl = dupElements[i];
      dup.push({
        nDup: getTagValue(dEl, 'nDup'),
        dVenc: getTagValue(dEl, 'dVenc'),
        vDup: getTagValue(dEl, 'vDup'),
      });
    }
  }

  // 2. Bloco de Pagamento (<pag>) -> Formas de Pagamento e Troco
  const pagEl = infNFe.getElementsByTagNameNS(NFE_NS, 'pag')[0] || infNFe.getElementsByTagName('pag')[0];
  const detPag: DetPagData[] = [];
  let vTroco = '';

  if (pagEl) {
    const detPagElements = pagEl.getElementsByTagNameNS(NFE_NS, 'detPag').length > 0
      ? pagEl.getElementsByTagNameNS(NFE_NS, 'detPag')
      : pagEl.getElementsByTagName('detPag');

    for (let i = 0; i < detPagElements.length; i++) {
      const dpEl = detPagElements[i];
      detPag.push({
        tPag: getTagValue(dpEl, 'tPag'),
        vPag: getTagValue(dpEl, 'vPag'),
        tpIntegra: getTagValue(dpEl, 'tpIntegra') || undefined,
        CNPJ: getTagValue(dpEl, 'CNPJ') || undefined,
        tBand: getTagValue(dpEl, 'tBand') || undefined,
        cAut: getTagValue(dpEl, 'cAut') || undefined,
      });
    }

    vTroco = getTagValue(pagEl, 'vTroco');
  }

  if (!cobrEl && !pagEl) return null;

  return {
    fat,
    dup,
    detPag,
    vTroco: vTroco || undefined,
  };
};
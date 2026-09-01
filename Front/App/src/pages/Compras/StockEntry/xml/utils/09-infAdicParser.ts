// 09-infAdicParser.ts

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface ObsContData {
  xCampo: string;
  xTexto: string;
}

export interface ObsFiscoData {
  xCampo: string;
  xTexto: string;
}

export interface InfIntermedData {
  CNPJ: string;
  idCadIntTrib: string;
}

export interface InfAdicNFeData {
  infCpl?: string;     // Informações complementares de interesse do contribuinte
  infAdFisco?: string; // Informações de interesse do Fisco
  obsCont: ObsContData[];
  obsFisco: ObsFiscoData[];
  infIntermed: InfIntermedData | null;
}

export const parseInfAdicNFe = (xmlString: string): InfAdicNFeData | null => {
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

  const infAdicEl = infNFe.getElementsByTagNameNS(NFE_NS, 'infAdic')[0] || infNFe.getElementsByTagName('infAdic')[0];
  if (!infAdicEl) return null;

  const infCpl = getTagValue(infAdicEl, 'infCpl');
  const infAdFisco = getTagValue(infAdicEl, 'infAdFisco');

  // Obs Contribuinte
  const obsContElements = infAdicEl.getElementsByTagNameNS(NFE_NS, 'obsCont').length > 0
    ? infAdicEl.getElementsByTagNameNS(NFE_NS, 'obsCont')
    : infAdicEl.getElementsByTagName('obsCont');

  const obsCont: ObsContData[] = [];
  for (let i = 0; i < obsContElements.length; i++) {
    const el = obsContElements[i];
    obsCont.push({
      xCampo: el.getAttribute('xCampo') || '',
      xTexto: getTagValue(el, 'xTexto'),
    });
  }

  // Obs Fisco
  const obsFiscoElements = infAdicEl.getElementsByTagNameNS(NFE_NS, 'obsFisco').length > 0
    ? infAdicEl.getElementsByTagNameNS(NFE_NS, 'obsFisco')
    : infAdicEl.getElementsByTagName('obsFisco');

  const obsFisco: ObsFiscoData[] = [];
  for (let i = 0; i < obsFiscoElements.length; i++) {
    const el = obsFiscoElements[i];
    obsFisco.push({
      xCampo: el.getAttribute('xCampo') || '',
      xTexto: getTagValue(el, 'xTexto'),
    });
  }

  // Intermediador da transação (Marketplace)
  const infIntermedEl = infNFe.getElementsByTagNameNS(NFE_NS, 'infIntermed')[0] || infNFe.getElementsByTagName('infIntermed')[0];
  let infIntermed: InfIntermedData | null = null;
  if (infIntermedEl) {
    infIntermed = {
      CNPJ: getTagValue(infIntermedEl, 'CNPJ'),
      idCadIntTrib: getTagValue(infIntermedEl, 'idCadIntTrib'),
    };
  }

  return {
    infCpl: infCpl || undefined,
    infAdFisco: infAdFisco || undefined,
    obsCont,
    obsFisco,
    infIntermed,
  };
};
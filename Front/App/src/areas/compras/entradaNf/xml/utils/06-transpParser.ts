const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface TransportaData {
  cnpjOrCpf: string;
  xNome: string;
  ie: string;
  xEnder: string;
  xMun: string;
  uf: string;
}

export interface ReboqueData {
  placa: string;
  uf: string;
  rntc: string;
}

export interface RetTranspData {
  vServ: string;
  vBCRet: string;
  pICMSRet: string;
  vICMSRet: string;
  cMunFG: string;
  cfop: string;
}

export interface VolumeData {
  qVol: string;
  esp: string;
  marca: string;
  nVol: string;
  pesoL: string;
  pesoB: string;
  lacres: string[];
}

export interface TranspNFeData {
  modFrete: string;
  transporta: TransportaData | null;
  veicTransp: {
    placa: string;
    uf: string;
    rntc: string;
  } | null;
  reboque: ReboqueData[];
  retTransp: RetTranspData | null;
  vol: VolumeData[];
}

export const parseTranspNFe = (xmlString: string): TranspNFeData | null => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('O arquivo XML está malformado ou corrompido.');
  }

  const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0] || xmlDoc.getElementsByTagName('infNFe')[0];
  if (!infNFe) return null;

  const transpEl = infNFe.getElementsByTagNameNS(NFE_NS, 'transp')[0] || infNFe.getElementsByTagName('transp')[0];
  if (!transpEl) return null;

  const getTagValue = (parent: Element, tagName: string): string => {
    const elNS = parent.getElementsByTagNameNS(NFE_NS, tagName)[0];
    if (elNS) return elNS.textContent?.trim() || '';

    const elTag = parent.getElementsByTagName(tagName)[0];
    if (elTag) return elTag.textContent?.trim() || '';

    const allElements = parent.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const item = allElements[i];
      if (item.nodeName === tagName || item.nodeName.endsWith(':' + tagName)) {
        return item.textContent?.trim() || '';
      }
    }

    return '';
  };

  // 1. Modalidade do Frete
  const modFrete = getTagValue(transpEl, 'modFrete');

  // 2. Transportador
  const transportaEl = transpEl.getElementsByTagNameNS(NFE_NS, 'transporta')[0] || transpEl.getElementsByTagName('transporta')[0];
  let transporta: TransportaData | null = null;
  if (transportaEl) {
    const cnpj = getTagValue(transportaEl, 'CNPJ');
    const cpf = getTagValue(transportaEl, 'CPF');
    transporta = {
      cnpjOrCpf: cnpj || cpf,
      xNome: getTagValue(transportaEl, 'xNome'),
      ie: getTagValue(transportaEl, 'IE'),
      xEnder: getTagValue(transportaEl, 'xEnder'),
      xMun: getTagValue(transportaEl, 'xMun'),
      uf: getTagValue(transportaEl, 'UF'),
    };
  }

  // 3. Veículo de Transporte
  const veicEl = transpEl.getElementsByTagNameNS(NFE_NS, 'veicTransp')[0] || transpEl.getElementsByTagName('veicTransp')[0];
  let veicTransp = null;
  if (veicEl) {
    veicTransp = {
      placa: getTagValue(veicEl, 'placa'),
      uf: getTagValue(veicEl, 'UF'),
      rntc: getTagValue(veicEl, 'RNTC'),
    };
  }

  // 4. Reboques (Ocorrência 0-5)
  const reboqueElements = transpEl.getElementsByTagNameNS(NFE_NS, 'reboque').length > 0
    ? transpEl.getElementsByTagNameNS(NFE_NS, 'reboque')
    : transpEl.getElementsByTagName('reboque');

  const reboque: ReboqueData[] = [];
  for (let i = 0; i < reboqueElements.length; i++) {
    const rEl = reboqueElements[i];
    reboque.push({
      placa: getTagValue(rEl, 'placa'),
      uf: getTagValue(rEl, 'UF'),
      rntc: getTagValue(rEl, 'RNTC'),
    });
  }

  // 5. Retenção do ICMS do Transporte (<retTransp>)
  const retTranspEl = transpEl.getElementsByTagNameNS(NFE_NS, 'retTransp')[0] || transpEl.getElementsByTagName('retTransp')[0];
  let retTransp: RetTranspData | null = null;
  if (retTranspEl) {
    retTransp = {
      vServ: getTagValue(retTranspEl, 'vServ'),
      vBCRet: getTagValue(retTranspEl, 'vBCRet'),
      pICMSRet: getTagValue(retTranspEl, 'pICMSRet'),
      vICMSRet: getTagValue(retTranspEl, 'vICMSRet'),
      cMunFG: getTagValue(retTranspEl, 'cMunFG'),
      cfop: getTagValue(retTranspEl, 'CFOP'),
    };
  }

  // 6. Volumes e Lacres
  const volElements = transpEl.getElementsByTagNameNS(NFE_NS, 'vol').length > 0
    ? transpEl.getElementsByTagNameNS(NFE_NS, 'vol')
    : transpEl.getElementsByTagName('vol');

  const vol: VolumeData[] = [];
  for (let i = 0; i < volElements.length; i++) {
    const vEl = volElements[i];
    
    // Extração dos lacres do volume atual
    const lacreElements = vEl.getElementsByTagNameNS(NFE_NS, 'nLacre').length > 0
      ? vEl.getElementsByTagNameNS(NFE_NS, 'nLacre')
      : vEl.getElementsByTagName('nLacre');
    
    const lacres: string[] = [];
    for (let j = 0; j < lacreElements.length; j++) {
      const lacreText = lacreElements[j].textContent?.trim();
      if (lacreText) lacres.push(lacreText);
    }

    vol.push({
      qVol: getTagValue(vEl, 'qVol'),
      esp: getTagValue(vEl, 'esp'),
      marca: getTagValue(vEl, 'marca'),
      nVol: getTagValue(vEl, 'nVol'),
      pesoL: getTagValue(vEl, 'pesoL'),
      pesoB: getTagValue(vEl, 'pesoB'),
      lacres,
    });
  }

  return {
    modFrete,
    transporta,
    veicTransp,
    reboque,
    retTransp,
    vol,
  };
};
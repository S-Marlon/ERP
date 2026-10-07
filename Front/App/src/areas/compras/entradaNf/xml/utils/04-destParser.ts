// /04-destParser.ts

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface EnderDestData {
  xLgr: string;
  nro: string;
  xCpl: string;
  xBairro: string;
  cMun: string;
  xMun: string;
  uf: string;
  cep: string;
  cPais: string;
  xPais: string;
  fone: string;
}

export interface DestNFeData {
  cnpjOrCpfOrEstrangeiro: string; // CNPJ, CPF ou idEstrangeiro
  xNome: string;
  indIEDest: string;              // 1=Contribuinte ICMS, 2=Contribuinte isento, 9=Não contribuinte
  ie: string;
  isuf: string;                   // Inscrição SUFRAMA (Opcional)
  im: string;                     // Inscrição Municipal (Opcional)
  email: string;
  enderDest: EnderDestData;
}

export interface LocalRetiradaEntregaData {
  cnpjOrCpf: string;
  xLgr: string;
  nro: string;
  xCpl: string;
  xBairro: string;
  cMun: string;
  xMun: string;
  uf: string;
  cep: string;
  cPais: string;
  xPais: string;
  fone: string;
  email: string;
}

export interface AutXMLData {
  cnpjOrCpf: string;
}

export interface CompleteDestAndLocationsData {
  dest: DestNFeData | null;
  retirada: LocalRetiradaEntregaData | null;
  entrega: LocalRetiradaEntregaData | null;
  autXML: AutXMLData[];
}

export const parseDestAndLocations = (xmlString: string): CompleteDestAndLocationsData => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('O arquivo XML está malformado ou corrompido.');
  }

  const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0] || xmlDoc.getElementsByTagName('infNFe')[0];
  if (!infNFe) {
    throw new Error('Elemento obrigatório <infNFe> não encontrado.');
  }

  const getTagValue = (parent: Element, tagName: string): string => {
    const el = parent.getElementsByTagNameNS(NFE_NS, tagName)[0] || parent.getElementsByTagName(tagName)[0];
    return el ? el.textContent?.trim() || '' : '';
  };

  const getAddressHelper = (parentEl: Element | null): EnderDestData => {
    const emptyAddr: EnderDestData = {
      xLgr: '', nro: '', xCpl: '', xBairro: '', cMun: '', xMun: '', uf: '', cep: '', cPais: '', xPais: '', fone: ''
    };
    if (!parentEl) return emptyAddr;

    return {
      xLgr: getTagValue(parentEl, 'xLgr'),
      nro: getTagValue(parentEl, 'nro'),
      xCpl: getTagValue(parentEl, 'xCpl'),
      xBairro: getTagValue(parentEl, 'xBairro'),
      cMun: getTagValue(parentEl, 'cMun'),
      xMun: getTagValue(parentEl, 'xMun'),
      uf: getTagValue(parentEl, 'UF'),
      cep: getTagValue(parentEl, 'CEP'),
      cPais: getTagValue(parentEl, 'cPais'),
      xPais: getTagValue(parentEl, 'xPais'),
      fone: getTagValue(parentEl, 'fone'),
    };
  };

  const getLocationHelper = (parent: Element, tagName: string): LocalRetiradaEntregaData | null => {
    const locEl = parent.getElementsByTagNameNS(NFE_NS, tagName)[0] || parent.getElementsByTagName(tagName)[0];
    if (!locEl) return null;

    const cnpj = getTagValue(locEl, 'CNPJ');
    const cpf = getTagValue(locEl, 'CPF');

    return {
      cnpjOrCpf: cnpj || cpf,
      xLgr: getTagValue(locEl, 'xLgr'),
      nro: getTagValue(locEl, 'nro'),
      xCpl: getTagValue(locEl, 'xCpl'),
      xBairro: getTagValue(locEl, 'xBairro'),
      cMun: getTagValue(locEl, 'cMun'),
      xMun: getTagValue(locEl, 'xMun'),
      uf: getTagValue(locEl, 'UF'),
      cep: getTagValue(locEl, 'CEP'),
      cPais: getTagValue(locEl, 'cPais'),
      xPais: getTagValue(locEl, 'xPais'),
      fone: getTagValue(locEl, 'fone'),
      email: getTagValue(locEl, 'email'),
    };
  };

  // 1. Destinatário (Pode ser opcional em notas de exportação ou consumidor específico, por isso tratamos com segurança)
  const destEl = infNFe.getElementsByTagNameNS(NFE_NS, 'dest')[0] || infNFe.getElementsByTagName('dest')[0];
  let dest: DestNFeData | null = null;

  if (destEl) {
    const cnpj = getTagValue(destEl, 'CNPJ');
    const cpf = getTagValue(destEl, 'CPF');
    const idEstrangeiro = getTagValue(destEl, 'idEstrangeiro');
    const enderDestEl = destEl.getElementsByTagNameNS(NFE_NS, 'enderDest')[0] || destEl.getElementsByTagName('enderDest')[0];

    dest = {
      cnpjOrCpfOrEstrangeiro: cnpj || cpf || idEstrangeiro,
      xNome: getTagValue(destEl, 'xNome'),
      indIEDest: getTagValue(destEl, 'indIEDest'),
      ie: getTagValue(destEl, 'IE'),
      isuf: getTagValue(destEl, 'ISUF'),
      im: getTagValue(destEl, 'IM'),
      email: getTagValue(destEl, 'email'),
      enderDest: getAddressHelper(enderDestEl || null),
    };
  }

  // 2. Local de Retirada
  const retirada = getLocationHelper(infNFe, 'retirada');

  // 3. Local de Entrega
  const entrega = getLocationHelper(infNFe, 'entrega');

  // 4. Pessoas Autorizadas a acessar o XML (<autXML>)
  const autXMLElements = infNFe.getElementsByTagNameNS(NFE_NS, 'autXML').length > 0 
    ? infNFe.getElementsByTagNameNS(NFE_NS, 'autXML') 
    : infNFe.getElementsByTagName('autXML');
  
  const autXML: AutXMLData[] = [];
  for (let i = 0; i < autXMLElements.length; i++) {
    const el = autXMLElements[i];
    const cnpj = getTagValue(el, 'CNPJ');
    const cpf = getTagValue(el, 'CPF');
    if (cnpj || cpf) {
      autXML.push({ cnpjOrCpf: cnpj || cpf });
    }
  }

  return {
    dest,
    retirada,
    entrega,
    autXML,
  };
};
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface EnderEmitData {
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

export interface AvulsaNFeData {
  cnpj: string;
  uf: string;
  dEmi: string;
  dPag: string;
  fone: string;
  matr: string;
  nDAR: string;
  repEmi: string;
  vDAR: number;
  xAgente: string;
  xOrgao: string;
}

export interface EmitNFeData {
  cnpjOrCpf: string; // CNPJ ou CPF do emitente
  xNome: string;     // Razão Social ou Nome
  xFant: string;     // Nome Fantasia (Opcional)
  enderEmit: EnderEmitData;
  ie: string;        // Inscrição Estadual
  iest: string;      // Inscrição Estadual do Substituto Tributário (Opcional)
  im: string;        // Inscrição Municipal (Opcional)
  crt: string;       // Código de Regime Tributário (1=Simples Nacional, 3=Regime Normal, etc.)
  cnae: string;      // CNAE Fiscal do emitente (Opcional)
  iSufEmit: string;  // Inscrição SUFRAMA do emitente (Opcional)
  avulsa?: AvulsaNFeData; // Dados da NF-e Avulsa (Opcional)
}

export const parseEmitNFe = (xmlString: string): EmitNFeData => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('O arquivo XML está malformado ou corrompido.');
  }

  const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0] || xmlDoc.getElementsByTagName('infNFe')[0];
  if (!infNFe) {
    throw new Error('Elemento obrigatório <infNFe> não encontrado.');
  }

  const emit = infNFe.getElementsByTagNameNS(NFE_NS, 'emit')[0] || infNFe.getElementsByTagName('emit')[0];
  if (!emit) {
    throw new Error('Elemento obrigatório <emit> não encontrado para o Step 3.');
  }

  const getTagValue = (parent: Element, tagName: string): string => {
    const el = parent.getElementsByTagNameNS(NFE_NS, tagName)[0] || parent.getElementsByTagName(tagName)[0];
    return el ? el.textContent?.trim() || '' : '';
  };

  // CNPJ ou CPF (Emitente pode ser PJ ou PF)
  const cnpj = getTagValue(emit, 'CNPJ');
  const cpf = getTagValue(emit, 'CPF');

  // Endereço do Emitente
  const enderEmitEl = emit.getElementsByTagNameNS(NFE_NS, 'enderEmit')[0] || emit.getElementsByTagName('enderEmit')[0];
  const enderEmit: EnderEmitData = {
    xLgr: enderEmitEl ? getTagValue(enderEmitEl, 'xLgr') : '',
    nro: enderEmitEl ? getTagValue(enderEmitEl, 'nro') : '',
    xCpl: enderEmitEl ? getTagValue(enderEmitEl, 'xCpl') : '',
    xBairro: enderEmitEl ? getTagValue(enderEmitEl, 'xBairro') : '',
    cMun: enderEmitEl ? getTagValue(enderEmitEl, 'cMun') : '',
    xMun: enderEmitEl ? getTagValue(enderEmitEl, 'xMun') : '',
    uf: enderEmitEl ? getTagValue(enderEmitEl, 'UF') : '',
    cep: enderEmitEl ? getTagValue(enderEmitEl, 'CEP') : '',
    cPais: enderEmitEl ? getTagValue(enderEmitEl, 'cPais') : '',
    xPais: enderEmitEl ? getTagValue(enderEmitEl, 'xPais') : '',
    fone: enderEmitEl ? getTagValue(enderEmitEl, 'fone') : '',
  };

  // Bloco Opcional de NF-e Avulsa (<avulsa>)
  const avulsaEl = infNFe.getElementsByTagNameNS(NFE_NS, 'avulsa')[0] || infNFe.getElementsByTagName('avulsa')[0];
  let avulsaData: AvulsaNFeData | undefined = undefined;

  if (avulsaEl) {
    const vDARStr = getTagValue(avulsaEl, 'vDAR');
    avulsaData = {
      cnpj: getTagValue(avulsaEl, 'CNPJ'),
      uf: getTagValue(avulsaEl, 'UF'),
      dEmi: getTagValue(avulsaEl, 'dEmi'),
      dPag: getTagValue(avulsaEl, 'dPag'),
      fone: getTagValue(avulsaEl, 'fone'),
      matr: getTagValue(avulsaEl, 'matr'),
      nDAR: getTagValue(avulsaEl, 'nDAR'),
      repEmi: getTagValue(avulsaEl, 'repEmi'),
      vDAR: vDARStr ? parseFloat(vDARStr) : 0,
      xAgente: getTagValue(avulsaEl, 'xAgente'),
      xOrgao: getTagValue(avulsaEl, 'xOrgao'),
    };
  }

  return {
    cnpjOrCpf: cnpj || cpf,
    xNome: getTagValue(emit, 'xNome'),
    xFant: getTagValue(emit, 'xFant'),
    enderEmit,
    ie: getTagValue(emit, 'IE'),
    iest: getTagValue(emit, 'IEST'),
    im: getTagValue(emit, 'IM'),
    crt: getTagValue(emit, 'CRT'),
    cnae: getTagValue(emit, 'CNAE'),
    iSufEmit: getTagValue(emit, 'ISUFEmit'),
    avulsa: avulsaData,
  };
};
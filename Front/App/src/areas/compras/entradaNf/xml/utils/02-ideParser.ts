const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface IdeNFeData {
  cUF: string;
  cNF: string;
  natOp: string;
  mod: string;
  serie: string;
  nNF: string;
  dhEmi: string;
  tpNF: string;
  idDest: string;
  cMunFG: string;
  tpImp: string;
  tpEmis: string;
  cDV: string;
  tpAmb: string;
  finNFe: string;
  indFinal: string;
  indPres: string;
  procEmi: string;
  verProc: string;
}

export const parseIdeNFe = (xmlString: string): IdeNFeData => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('O arquivo XML está malformado ou corrompido.');
  }

  // Localiza o bloco infNFe (reaproveitando o contexto da NF-e)
  const infNFe = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0] || xmlDoc.getElementsByTagName('infNFe')[0];
  if (!infNFe) {
    throw new Error('Elemento obrigatório <infNFe> não encontrado.');
  }

  // Localiza especificamente o bloco <ide>
  const ide = infNFe.getElementsByTagNameNS(NFE_NS, 'ide')[0] || infNFe.getElementsByTagName('ide')[0];
  if (!ide) {
    throw new Error('Elemento obrigatório <ide> não encontrado dentro de infNFe.');
  }

  // Função auxiliar para extrair texto de forma segura considerando namespaces
  const getTagValue = (tagName: string): string => {
    const el = ide.getElementsByTagNameNS(NFE_NS, tagName)[0] || ide.getElementsByTagName(tagName)[0];
    return el ? el.textContent?.trim() || '' : '';
  };

  return {
    cUF: getTagValue('cUF'),
    cNF: getTagValue('cNF'),
    natOp: getTagValue('natOp'),
    mod: getTagValue('mod'),
    serie: getTagValue('serie'),
    nNF: getTagValue('nNF'),
    dhEmi: getTagValue('dhEmi'),
    tpNF: getTagValue('tpNF'),
    idDest: getTagValue('idDest'),
    cMunFG: getTagValue('cMunFG'),
    tpImp: getTagValue('tpImp'),
    tpEmis: getTagValue('tpEmis'),
    cDV: getTagValue('cDV'),
    tpAmb: getTagValue('tpAmb'),
    finNFe: getTagValue('finNFe'),
    indFinal: getTagValue('indFinal'),
    indPres: getTagValue('indPres'),
    procEmi: getTagValue('procEmi'),
    verProc: getTagValue('verProc'),
  };
};
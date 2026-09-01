// utils/envelopeParser.ts

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface EnvelopeNFeData {
  versaoNfeProc: string;
  versaoInfNfe: string;
  chaveAcesso: string;
  possuiProtocolo: boolean;
  xmlBruto: string;
}

export const parseEnvelopeNFe = (xmlString: string): EnvelopeNFeData => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('O arquivo XML está malformado ou corrompido.');
  }

  // 1. Validação e extração do nfeProc (Raiz do documento processado com autorização)
  const nfeProc = xmlDoc.getElementsByTagNameNS(NFE_NS, 'nfeProc')[0] || xmlDoc.getElementsByTagName('nfeProc')[0];
  
  if (!nfeProc) {
    throw new Error('Elemento obrigatório <nfeProc> não encontrado. O XML pode não ser uma NF-e/NFC-e autorizada.');
  }
  const versaoNfeProc = nfeProc.getAttribute('versao') || '';

  // 2. Validação e extração do NFe e infNFe
  const nfe = nfeProc.getElementsByTagNameNS(NFE_NS, 'NFe')[0] || nfeProc.getElementsByTagName('NFe')[0];
  if (!nfe) {
    throw new Error('Elemento obrigatório <NFe> não encontrado dentro de nfeProc.');
  }

  const infNFe = nfe.getElementsByTagNameNS(NFE_NS, 'infNFe')[0] || nfe.getElementsByTagName('infNFe')[0];
  if (!infNFe) {
    throw new Error('Elemento obrigatório <infNFe> não encontrado.');
  }

  const versaoInfNfe = infNFe.getAttribute('versao') || '';
  
  // 3. Extração do atributo Id (Chave de Acesso com prefixo 'NFe')
  const idAttr = infNFe.getAttribute('Id') || '';
  const chaveAcesso = idAttr.replace('NFe', '').trim();

  if (!chaveAcesso || chaveAcesso.length !== 44) {
    throw new Error(`A Chave de Acesso (<infNFe Id="...">) é inválida ou obrigatória. Encontrada: "${idAttr}"`);
  }

  // Validação de protocolo de autorização (protNFe)
  const protNFe = nfeProc.getElementsByTagNameNS(NFE_NS, 'protNFe')[0] || nfeProc.getElementsByTagName('protNFe')[0];

  return {
    versaoNfeProc,
    versaoInfNfe,
    chaveAcesso,
    possuiProtocolo: !!protNFe,
    xmlBruto: xmlString
  };
};
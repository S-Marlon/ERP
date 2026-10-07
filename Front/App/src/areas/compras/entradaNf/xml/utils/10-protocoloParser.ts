// Protocolo de autorização da NF-e (<protNFe><infProt>) e tradução dos códigos do <ide>.
// O protocolo mostra a situação no momento da autorização; cancelamento posterior só aparece consultando a SEFAZ.
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export interface ProtocoloNFeData {
  tpAmb: string;
  cStat: string;
  xMotivo: string;
  nProt: string;
  dhRecbto: string;
}

export const parseProtocoloNFe = (xmlString: string): ProtocoloNFeData | null => {
  const xmlDoc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const infProt = xmlDoc.getElementsByTagNameNS(NFE_NS, 'infProt')[0] || xmlDoc.getElementsByTagName('infProt')[0];
  if (!infProt) return null;
  const tag = (nome: string) => {
    const el = infProt.getElementsByTagNameNS(NFE_NS, nome)[0] || infProt.getElementsByTagName(nome)[0];
    return el?.textContent?.trim() || '';
  };
  return { tpAmb: tag('tpAmb'), cStat: tag('cStat'), xMotivo: tag('xMotivo'), nProt: tag('nProt'), dhRecbto: tag('dhRecbto') };
};

export type SituacaoNFe = 'AUTORIZADA' | 'SEM_PROTOCOLO' | 'NAO_AUTORIZADA';

/** Situação pela leitura do XML: 100/150 = autorizada; sem protocolo = XML sem autorização; outro cStat = denegada/rejeitada. */
export const situacaoDoProtocolo = (p: ProtocoloNFeData | null | undefined): SituacaoNFe => {
  if (!p || !p.cStat) return 'SEM_PROTOCOLO';
  return p.cStat === '100' || p.cStat === '150' ? 'AUTORIZADA' : 'NAO_AUTORIZADA';
};

const traduzir = (mapa: Record<string, string>) => (codigo?: string) =>
  codigo ? (mapa[codigo] ? `${codigo} - ${mapa[codigo]}` : codigo) : '-';

export const traduzirModelo = traduzir({ '55': 'NF-e', '65': 'NFC-e' });
export const traduzirTipoEmissao = traduzir({
  '1': 'Emissão normal',
  '2': 'Contingência FS-IA',
  '3': 'Contingência SCAN',
  '4': 'Contingência EPEC',
  '5': 'Contingência FS-DA',
  '6': 'Contingência SVC-AN',
  '7': 'Contingência SVC-RS',
  '9': 'Contingência off-line NFC-e',
});
export const traduzirProcessoEmissao = traduzir({
  '0': 'Aplicativo do contribuinte',
  '1': 'Avulsa pelo Fisco',
  '2': 'Avulsa pelo contribuinte no site do Fisco',
  '3': 'Aplicativo fornecido pelo Fisco',
});
export const traduzirAmbiente = traduzir({ '1': 'Produção', '2': 'Homologação (sem valor fiscal)' });

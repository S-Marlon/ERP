import { situacaoDoProtocolo, traduzirModelo, traduzirProcessoEmissao, traduzirTipoEmissao } from './10-protocoloParser';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`protocolo: ${msg}`); };
const p = (cStat: string) => ({ tpAmb: '1', cStat, xMotivo: '', nProt: '1', dhRecbto: '' });

export const runProtocoloTests = () => {
  ok(situacaoDoProtocolo(null) === 'SEM_PROTOCOLO', 'sem protNFe');
  ok(situacaoDoProtocolo(p('')) === 'SEM_PROTOCOLO', 'protocolo sem cStat');
  ok(situacaoDoProtocolo(p('100')) === 'AUTORIZADA' && situacaoDoProtocolo(p('150')) === 'AUTORIZADA', 'autorizada (100 e 150)');
  ok(situacaoDoProtocolo(p('110')) === 'NAO_AUTORIZADA' && situacaoDoProtocolo(p('302')) === 'NAO_AUTORIZADA', 'denegada');
  ok(traduzirModelo('55') === '55 - NF-e' && traduzirModelo('65') === '65 - NFC-e' && traduzirModelo('') === '-', 'modelo');
  ok(traduzirTipoEmissao('1') === '1 - Emissão normal' && traduzirTipoEmissao('8') === '8', 'tipo de emissão (código desconhecido mostra o código)');
  ok(traduzirProcessoEmissao('0') === '0 - Aplicativo do contribuinte', 'processo de emissão');
};

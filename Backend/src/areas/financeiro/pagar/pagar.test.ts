import { cobrancaDoXml, situacaoCobranca, validarParcelas } from './pagar';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const falha = (fn: () => unknown, msg: string) => { try { fn(); } catch { return; } throw new Error(msg); };

const xml = `<nfeProc><NFe><infNFe><cobr>
  <fat><nFat>001234</nFat><vOrig>300.00</vOrig><vDesc>0.00</vDesc><vLiq>300.00</vLiq></fat>
  <dup><nDup>001</nDup><dVenc>2026-11-05</dVenc><vDup>150.00</vDup></dup>
  <dup><nDup>002</nDup><dVenc>2026-12-05</dVenc><vDup>150.00</vDup></dup>
</cobr><pag><detPag><tPag>15</tPag></detPag></pag></infNFe></NFe></nfeProc>`;

const c = cobrancaDoXml(xml);
assert(c.fatura?.numero === '001234' && c.fatura.valorLiquido === 300, `fatura ${JSON.stringify(c.fatura)}`);
assert(c.duplicatas.length === 2 && c.duplicatas[1].vencimento === '2026-12-05' && c.duplicatas[0].numero === '001', `dups ${JSON.stringify(c.duplicatas)}`);
assert(cobrancaDoXml('<nfe><det/></nfe>').duplicatas.length === 0 && cobrancaDoXml(null).fatura === null, 'sem cobrança');
assert(cobrancaDoXml('<nfe:cobr><nfe:dup><nfe:nDup>1</nfe:nDup><nfe:dVenc>2026-11-01</nfe:dVenc><nfe:vDup>10</nfe:vDup></nfe:dup></nfe:cobr>').duplicatas[0].valor === 10, 'com prefixo');

const s = situacaoCobranca(c, { qtd: 0, total: 0 }, { situacao: null, observacao: null });
assert(s.duplicatas === 2 && s.totalDuplicatas === 300 && !s.dispensado, 'situação pendente');
assert(situacaoCobranca(c, { qtd: 0, total: 0 }, { situacao: 'DISPENSADO', observacao: 'paga à vista' }).motivoDispensa === 'paga à vista', 'dispensa');

const p = validarParcelas([{ numero: '001', vencimento: '2026-11-05', valor: '150', codigoBarras: '34191.79001 01043.510047 91020.150008 1 96610000015000' }]);
assert(p[0].valor === 150 && p[0].forma === 'BOLETO' && p[0].codigoBarras?.length === 47, `parcela ${JSON.stringify(p)}`);
falha(() => validarParcelas([]), 'vazio');
falha(() => validarParcelas([{ vencimento: '2026-02-30', valor: 10 }]), 'data inexistente');
falha(() => validarParcelas([{ vencimento: '2026-11-05', valor: 0 }]), 'valor zero');
falha(() => validarParcelas([{ vencimento: '2026-11-05', valor: 10, codigoBarras: '123' }]), 'linha digitável curta');
falha(() => validarParcelas([{ vencimento: '2026-11-05', valor: 10, forma: 'CHEQUE' }]), 'forma inválida');

console.log('pagar: ok');

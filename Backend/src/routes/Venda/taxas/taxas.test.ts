import { acrescimoParcelamento, ajusteDaForma, calcularTaxas, ConfigTaxas, descontoEfetivoPct, fatorTaxa, liquidoParaRegra, taxaPara, validarTaxas } from './taxas';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

const cfg: ConfigTaxas = {
  taxas: [
    { forma: 'DEBITO', parcelasDe: 1, parcelasAte: 1, percentual: 2.5, fixa: 0 },
    { forma: 'CREDITO', parcelasDe: 1, parcelasAte: 1, percentual: 5, fixa: 0 },
    { forma: 'CREDITO', parcelasDe: 2, parcelasAte: 6, percentual: 7, fixa: 0 },
    { forma: 'CREDITO', parcelasDe: 7, parcelasAte: 12, percentual: 9.5, fixa: 0 },
    { forma: 'PIX', parcelasDe: 1, parcelasAte: 1, percentual: 0, fixa: 0 },
  ],
  formaReferencia: 'CREDITO', parcelasReferencia: 1, parcelasSemJuros: 3, descontoFormaAutomatico: true,
};

// Exemplo combinado: preço para receber 100 com 5% = 105,26 (dividir, não somar)
assert(perto(100 * fatorTaxa(5), 105.26), `fator ${100 * fatorTaxa(5)}`);
assert(fatorTaxa(0) === 1, 'sem taxa');

assert(taxaPara(cfg.taxas, 'credito', 4).percentual === 7 && taxaPara(cfg.taxas, 'CREDITO', 12).percentual === 9.5, 'faixa de parcelas');
assert(taxaPara(cfg.taxas, 'DINHEIRO').percentual === 0, 'sem cadastro = 0');

// Débito permite 2,56% de desconto; PIX 5%; crédito 1x nada; 12x pede acréscimo
assert(perto(ajusteDaForma(cfg, 'DEBITO'), -2.564, 0.001), `débito ${ajusteDaForma(cfg, 'DEBITO')}`);
assert(perto(ajusteDaForma(cfg, 'PIX'), -5), `pix ${ajusteDaForma(cfg, 'PIX')}`);
assert(ajusteDaForma(cfg, 'CREDITO', 1) === 0, 'crédito referência');
assert(ajusteDaForma(cfg, 'CREDITO', 12) > 0, 'crédito 12x acréscimo');

// Acréscimo só acima do sem juros (3x)
assert(acrescimoParcelamento(cfg, 'CREDITO', 3, 100) === 0, '3x sem juros');
const acr = acrescimoParcelamento(cfg, 'CREDITO', 12, 100);
assert(perto(acr, 4.97), `acréscimo 12x ${acr}`); // 100 x 0,95/0,905 - 100
assert(acrescimoParcelamento(cfg, 'DEBITO', 12, 100) === 0, 'só crédito');

// Taxas por pagamento, sem o troco
const t = calcularTaxas(cfg, [
  { forma: 'DINHEIRO', valor: 50, parcelas: 1, troco: 10 },
  { forma: 'CREDITO', valor: 100, parcelas: 1, troco: 0 },
]);
assert(t.totalTaxas === 5 && t.totalLiquido === 135, `taxas ${t.totalTaxas} líquido ${t.totalLiquido}`);

// Desconto efetivo: PIX a 95% da tabela = sem perda; débito a 97,44% = sem perda; PIX a 90% = 5,26% efetivo
assert(descontoEfetivoPct(cfg, 100, 95) === 0, 'pix com 5% de desconto');
assert(descontoEfetivoPct(cfg, 100, calcularTaxas(cfg, [{ forma: 'DEBITO', valor: 97.44, parcelas: 1, troco: 0 }]).totalLiquido) <= 0.01, 'débito com 2,56%');
assert(perto(descontoEfetivoPct(cfg, 100, 90), 5.26), `pix 10% -> ${descontoEfetivoPct(cfg, 100, 90)}`);
// Crédito 12x sem acréscimo: o líquido cai, conta como desconto
assert(descontoEfetivoPct(cfg, 100, calcularTaxas(cfg, [{ forma: 'CREDITO', valor: 100, parcelas: 12, troco: 0 }]).totalLiquido) > 4, '12x sem acréscimo vira desconto');
// Com o acréscimo, não
assert(descontoEfetivoPct(cfg, 100, calcularTaxas(cfg, [{ forma: 'CREDITO', valor: 100 + acr, parcelas: 12, troco: 0 }]).totalLiquido) <= 0.01, '12x com acréscimo ok');

// Crédito até o sem juros (3x): a loja absorve, conta como referência; 4x não
assert(descontoEfetivoPct(cfg, 100, liquidoParaRegra(cfg, [{ forma: 'CREDITO', valor: 100, parcelas: 3, troco: 0 }])) === 0, '3x sem juros absorvido');
assert(descontoEfetivoPct(cfg, 100, liquidoParaRegra(cfg, [{ forma: 'CREDITO', valor: 100, parcelas: 4, troco: 0 }])) > 2, '4x conta');
assert(descontoEfetivoPct(cfg, 100, liquidoParaRegra(cfg, [{ forma: 'PIX', valor: 95, parcelas: 1, troco: 0 }])) === 0, 'pix pela regra');

// Validação
const falha = (fn: () => unknown, msg: string) => { try { fn(); } catch { return; } throw new Error(msg); };
validarTaxas(cfg.taxas);
falha(() => validarTaxas([{ forma: 'CREDITO', parcelasDe: 1, parcelasAte: 3, percentual: 5, fixa: 0 }, { forma: 'CREDITO', parcelasDe: 3, parcelasAte: 6, percentual: 7, fixa: 0 }]), 'sobreposição');
falha(() => validarTaxas([{ forma: 'BOLETO', parcelasDe: 1, parcelasAte: 1, percentual: 1, fixa: 0 }]), 'forma inválida');
falha(() => validarTaxas([{ forma: 'PIX', parcelasDe: 1, parcelasAte: 1, percentual: 60, fixa: 0 }]), 'taxa alta');

console.log('taxas: ok');

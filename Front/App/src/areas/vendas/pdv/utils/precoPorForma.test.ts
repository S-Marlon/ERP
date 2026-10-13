import assert from 'assert';
import { maxParcelasCredito, precosPorForma } from './precoPorForma';
import type { ConfigTaxas } from '../../taxas/taxasVenda';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

// Preço embute crédito 1x (5%); PIX 0%, débito 2%, crédito 2-6x 8%, 7-12x 12%; 3x sem juros
const cfg: ConfigTaxas = {
  taxas: [
    { forma: 'PIX', parcelasDe: 1, parcelasAte: 1, percentual: 0, fixa: 0 },
    { forma: 'DEBITO', parcelasDe: 1, parcelasAte: 1, percentual: 2, fixa: 0 },
    { forma: 'CREDITO', parcelasDe: 1, parcelasAte: 1, percentual: 5, fixa: 0 },
    { forma: 'CREDITO', parcelasDe: 2, parcelasAte: 6, percentual: 8, fixa: 0 },
    { forma: 'CREDITO', parcelasDe: 7, parcelasAte: 12, percentual: 12, fixa: 0 },
  ],
  formaReferencia: 'CREDITO', parcelasReferencia: 1, parcelasSemJuros: 3, descontoFormaAutomatico: true, taxaReferencia: 5, ajustes: [],
};

teste('preço à vista e no débito com o desconto da forma', () => {
  const r = precosPorForma(cfg, 100)!;
  const pix = r.aVista.find(o => o.forma === 'PIX')!;
  assert.strictEqual(pix.pct, 5);          // 1 - 0,95/1 = 5%
  assert.strictEqual(pix.valor, 95);
  const deb = r.aVista.find(o => o.forma === 'DEBITO')!;
  assert.strictEqual(deb.pct, 3.06);       // (0,95/0,98 - 1) = -3,06%
  assert.strictEqual(deb.valor, 96.94);
});

teste('crédito sem juros e com juros', () => {
  const r = precosPorForma(cfg, 100)!;
  assert.deepStrictEqual(r.semJuros, { parcelas: 3, valor: 100, parcela: 33.33, acrescimoPct: 0 });
  assert.strictEqual(r.comJuros.length, 9); // 4x..12x
  const x6 = r.comJuros.find(p => p.parcelas === 6)!;
  assert.strictEqual(x6.valor, 103.26);    // 0,95/0,92 - 1 = 3,26%
  assert.strictEqual(x6.parcela, 17.21);
  const x12 = r.comJuros.find(p => p.parcelas === 12)!;
  assert.strictEqual(x12.valor, 107.95);
  assert.strictEqual(maxParcelasCredito(cfg), 12);
});

teste('sem desconto automático e sem total', () => {
  assert.strictEqual(precosPorForma({ ...cfg, descontoFormaAutomatico: false }, 100)!.aVista.length, 0);
  assert.strictEqual(precosPorForma(cfg, 0), null);
  assert.strictEqual(precosPorForma(null, 100), null);
});

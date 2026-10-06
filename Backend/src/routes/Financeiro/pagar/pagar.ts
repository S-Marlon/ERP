// Contas a pagar: regras puras (sem banco). Duplicatas do grupo <cobr> do XML da nota de entrada e
// validação das parcelas lançadas a partir delas.

export class ErroPagar extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface Duplicata { numero: string | null; vencimento: string | null; valor: number }
export interface CobrancaXml {
  fatura: { numero: string | null; valorOriginal: number; desconto: number; valorLiquido: number } | null;
  duplicatas: Duplicata[];
}

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// Conteúdo de uma tag simples (aceita prefixo de namespace, ex.: <nfe:dup>)
const tag = (bloco: string, nome: string): string | null => {
  const m = new RegExp(`<(?:\\w+:)?${nome}>([^<]*)</(?:\\w+:)?${nome}>`).exec(bloco);
  return m ? m[1].trim() : null;
};
const blocos = (xml: string, nome: string): string[] =>
  [...xml.matchAll(new RegExp(`<(?:\\w+:)?${nome}>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, 'g'))].map(m => m[1]);

/** Fatura e duplicatas do grupo <cobr> do XML (vazio quando a nota não tem cobrança). */
export const cobrancaDoXml = (xml: string | null | undefined): CobrancaXml => {
  const cobr = blocos(String(xml || ''), 'cobr')[0];
  if (!cobr) return { fatura: null, duplicatas: [] };
  const fat = blocos(cobr, 'fat')[0];
  return {
    fatura: fat ? {
      numero: tag(fat, 'nFat'),
      valorOriginal: Number(tag(fat, 'vOrig')) || 0,
      desconto: Number(tag(fat, 'vDesc')) || 0,
      valorLiquido: Number(tag(fat, 'vLiq')) || 0,
    } : null,
    duplicatas: blocos(cobr, 'dup').map(d => ({
      numero: tag(d, 'nDup'),
      vencimento: /^\d{4}-\d{2}-\d{2}/.test(tag(d, 'dVenc') || '') ? String(tag(d, 'dVenc')).slice(0, 10) : null,
      valor: r2(Number(tag(d, 'vDup')) || 0),
    })),
  };
};

/** Situação da cobrança da nota: o que o XML pede e o que já foi lançado (base do bloqueio da aprovação). */
export interface SituacaoCobranca {
  duplicatas: number; totalDuplicatas: number; titulos: number; totalTitulos: number; dispensado: boolean; motivoDispensa: string | null;
}
export const situacaoCobranca = (cobranca: CobrancaXml, titulos: { qtd: number; total: number }, lote: { situacao: string | null; observacao: string | null }): SituacaoCobranca => ({
  duplicatas: cobranca.duplicatas.length,
  totalDuplicatas: r2(cobranca.duplicatas.reduce((a, d) => a + d.valor, 0)),
  titulos: titulos.qtd,
  totalTitulos: r2(titulos.total),
  dispensado: lote.situacao === 'DISPENSADO',
  motivoDispensa: lote.situacao === 'DISPENSADO' ? lote.observacao : null,
});

export const FORMAS_PAGAMENTO = ['BOLETO', 'PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO'];

export interface ParcelaLancamento { numero: string | null; vencimento: string; valor: number; codigoBarras: string | null; forma: string }

const dataValida = (v: unknown) => {
  const s = String(v || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
};

/** Confere as parcelas digitadas/ajustadas antes de lançar. */
export const validarParcelas = (entrada: unknown): ParcelaLancamento[] => {
  const lista = Array.isArray(entrada) ? entrada : [];
  if (!lista.length) throw new ErroPagar('Informe ao menos uma parcela.');
  return lista.map((p: any, i) => {
    const vencimento = dataValida(p?.vencimento);
    if (!vencimento) throw new ErroPagar(`Parcela ${i + 1}: vencimento inválido.`);
    const valor = r2(Number(p?.valor));
    if (!(valor > 0)) throw new ErroPagar(`Parcela ${i + 1}: valor deve ser maior que zero.`);
    const forma = String(p?.forma || 'BOLETO').toUpperCase();
    if (!FORMAS_PAGAMENTO.includes(forma)) throw new ErroPagar(`Parcela ${i + 1}: forma de pagamento inválida.`);
    const codigoBarras = String(p?.codigoBarras || '').replace(/[^\d]/g, '') || null;
    if (codigoBarras && codigoBarras.length !== 44 && codigoBarras.length !== 47 && codigoBarras.length !== 48) {
      throw new ErroPagar(`Parcela ${i + 1}: linha digitável deve ter 47 ou 48 dígitos (ou 44 do código de barras).`);
    }
    return { numero: String(p?.numero || '').trim().slice(0, 60) || null, vencimento, valor, codigoBarras, forma };
  });
};

export const dataValidaPagamento = dataValida;

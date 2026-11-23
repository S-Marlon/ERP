// Números no jeito brasileiro para os campos do sistema (dinheiro, quantidade, percentual): vírgula decimal, ponto de
// milhar, e a leitura aceita o que o operador digitar ou colar ("1,5", "1.5", "1.234,56", "R$ 10,00", "15%").
// Datas: dia/mês/ano, aceitando digitar sem as barras. Puro, com teste.

/**
 * Texto digitado → número em texto com ponto ("1234.56"), que é o que o InputNumber do antd espera do parser.
 * Vírgula e ponto valem como decimal ("1,5" = "1.5"). Milhar só quando não tem como ser decimal: ponto junto com
 * vírgula ("1.234,56") ou vários pontos ("1.234.567"). Um ponto sozinho é sempre decimal ("1.500" = 1,5).
 */
export const lerNumeroBr = (texto: unknown): string => {
  let t = String(texto ?? '').replace(/[^\d,.-]/g, '');
  const negativo = t.startsWith('-');
  t = t.replace(/-/g, '');
  if (t.includes(',')) {
    t = t.replace(/\./g, '');
    const i = t.lastIndexOf(',');
    t = t.slice(0, i).replace(/,/g, '') + '.' + t.slice(i + 1);
  } else {
    const partes = t.split('.');
    if (partes.length > 2) {
      t = partes.join('');
    }
  }
  if (t === '.') t = '';
  return (negativo ? '-' : '') + t;
};

/** Número → "1.234,56" (casas fixas) ou, com `casasMax`, sem zeros à direita ("2", "1,5", "0,125"). */
export const formatarNumeroBr = (v: unknown, casas = 2, opcoes: { milhar?: boolean; casasMax?: boolean } = {}) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: opcoes.casasMax ? 0 : casas, maximumFractionDigits: casas, useGrouping: opcoes.milhar ?? true,
  });
};

export const formatarDinheiro = (v: unknown, casas = 2) => (v === null || v === undefined || v === '' ? '' : `R$ ${formatarNumeroBr(v, casas)}`);
export const formatarQuantidade = (v: unknown, casas = 3) => formatarNumeroBr(v, casas, { casasMax: true });
export const formatarPercentual = (v: unknown, casas = 2) => (v === null || v === undefined || v === '' ? '' : `${formatarNumeroBr(v, casas, { casasMax: true })}%`);

// ---------------------------------------------------------------- datas
/** Formatos do DatePicker: o primeiro é o que aparece; os outros deixam digitar "01022026" ou "01/02/26". */
export const FORMATOS_DATA = ['DD/MM/YYYY', 'DDMMYYYY', 'DD/MM/YY', 'DDMMYY', 'D/M/YYYY'];
export const FORMATOS_DATA_HORA = ['DD/MM/YYYY HH:mm', 'DDMMYYYY HHmm'];

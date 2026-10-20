// Contas da loja (água, luz, aluguel, seguro, salário...): validação da conta avulsa (com ou sem parcelas) e da conta
// fixa. Regras puras; quem recebe é um fornecedor cadastrado ou só um nome (favorecido).
import { dataValidaPagamento as dataValida, ErroPagar, FORMAS_PAGAMENTO } from './pagar';
import { Periodicidade, PERIODICIDADES, vencimentosMensais } from './recorrencia';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null;
const MAX_PARCELAS = 60;

const quemRecebe = (b: any) => {
  const idFornecedor = Number(b?.idFornecedor) > 0 ? Number(b.idFornecedor) : null;
  const favorecido = texto(b?.favorecido, 100);
  if (!idFornecedor && !favorecido) throw new ErroPagar('Informe quem recebe (fornecedor ou o nome, ex.: Copel).');
  return { idFornecedor, favorecido };
};
const formaDe = (v: unknown, padrao = 'BOLETO') => {
  const forma = String(v || padrao).toUpperCase();
  if (!FORMAS_PAGAMENTO.includes(forma)) throw new ErroPagar('Forma de pagamento inválida.');
  return forma;
};
const linhaDigitavel = (v: unknown) => {
  const c = String(v || '').replace(/[^\d]/g, '') || null;
  if (c && ![44, 47, 48].includes(c.length)) throw new ErroPagar('Linha digitável deve ter 47 ou 48 dígitos (ou 44 do código de barras).');
  return c;
};

export interface ContaAvulsa {
  descricao: string; idCategoria: number | null; idFornecedor: number | null; favorecido: string | null; forma: string;
  codigoBarras: string | null; numeroDocumento: string | null; estimado: boolean;
  parcelas: { parcela: number; vencimento: string; valor: number }[];
}

/** Conta avulsa: uma ou n parcelas mensais do mesmo valor a partir do primeiro vencimento (ex.: seguro em 10x). */
export const validarContaAvulsa = (b: any): ContaAvulsa => {
  const descricao = texto(b?.descricao, 150);
  if (!descricao) throw new ErroPagar('Informe a descrição da conta (ex.: Energia elétrica - outubro).');
  const vencimento = dataValida(b?.vencimento);
  if (!vencimento) throw new ErroPagar('Vencimento inválido.');
  const valor = r2(Number(b?.valor));
  if (!(valor > 0)) throw new ErroPagar('O valor deve ser maior que zero.');
  const n = Math.floor(Number(b?.parcelas) || 1);
  if (n < 1 || n > MAX_PARCELAS) throw new ErroPagar(`Parcelas: de 1 a ${MAX_PARCELAS}.`);
  return {
    descricao, idCategoria: Number(b?.idCategoria) > 0 ? Number(b.idCategoria) : null, ...quemRecebe(b),
    forma: formaDe(b?.forma), codigoBarras: n === 1 ? linhaDigitavel(b?.codigoBarras) : null,
    numeroDocumento: texto(b?.numeroDocumento, 60), estimado: Boolean(b?.estimado),
    parcelas: vencimentosMensais(vencimento, n).map((v, k) => ({ parcela: k + 1, vencimento: v, valor })),
  };
};

export interface ContaFixa {
  descricao: string; idCategoria: number | null; idFornecedor: number | null; favorecido: string | null; valor: number;
  valorVariavel: boolean; diaVencimento: number; periodicidade: Periodicidade; inicio: string; fim: string | null;
  forma: string; observacao: string | null;
}

/** Conta fixa: o início e o fim valem pelo mês (vão como dia 1). */
export const validarContaFixa = (b: any): ContaFixa => {
  const descricao = texto(b?.descricao, 150);
  if (!descricao) throw new ErroPagar('Informe a descrição (ex.: Aluguel da loja).');
  const valor = r2(Number(b?.valor));
  if (!(valor > 0)) throw new ErroPagar(b?.valorVariavel ? 'Informe uma estimativa do valor (dá para confirmar a cada mês).' : 'O valor deve ser maior que zero.');
  const dia = Math.floor(Number(b?.diaVencimento));
  if (!(dia >= 1 && dia <= 31)) throw new ErroPagar('Dia do vencimento: de 1 a 31.');
  const periodicidade = String(b?.periodicidade || 'MENSAL').toUpperCase() as Periodicidade;
  if (!(periodicidade in PERIODICIDADES)) throw new ErroPagar('Periodicidade inválida.');
  const mes = (v: unknown) => { const d = dataValida(`${String(v || '').slice(0, 7)}-01`); return d; };
  const inicio = mes(b?.inicio);
  if (!inicio) throw new ErroPagar('Informe o mês da primeira conta.');
  const fim = b?.fim ? mes(b.fim) : null;
  if (b?.fim && !fim) throw new ErroPagar('Mês final inválido.');
  if (fim && fim < inicio) throw new ErroPagar('O mês final é antes do primeiro.');
  return {
    descricao, idCategoria: Number(b?.idCategoria) > 0 ? Number(b.idCategoria) : null, ...quemRecebe(b), valor,
    valorVariavel: Boolean(b?.valorVariavel), diaVencimento: dia, periodicidade, inicio, fim, forma: formaDe(b?.forma),
    observacao: texto(b?.observacao, 255),
  };
};

// Regras de desconto e margem da venda (sem banco): desconto acima do limite e venda abaixo do custo
// exigem autorização (senha + nome + motivo); com a política BLOQUEAR, abaixo do custo não vende.
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export const POLITICAS_ABAIXO_CUSTO = ['PERMITIR', 'AVISAR', 'BLOQUEAR'] as const;
export type PoliticaAbaixoCusto = typeof POLITICAS_ABAIXO_CUSTO[number];

export interface RegrasVenda {
  descontoMaxPercentual: number;
  politicaAbaixoCusto: PoliticaAbaixoCusto;
  senhaHash: string | null;
}

export const REGRAS_PADRAO: RegrasVenda = { descontoMaxPercentual: 5, politicaAbaixoCusto: 'AVISAR', senhaHash: null };

export interface LinhaAvaliada {
  idItem: number;
  nome: string;
  totalItem: number;     // valor final da linha (após descontos)
  custoTotal: number;    // custo da linha (custo base x quantidade na base)
}

export interface ResultadoRegras {
  percentualDesconto: number;
  excedeDesconto: boolean;
  abaixoCusto: Array<{ idItem: number; nome: string; totalItem: number; custoTotal: number }>;
  motivos: string[];         // o que exige autorização
  exigeAutorizacao: boolean;
  bloqueio: string | null;   // venda não pode ser feita
}

const c = (v: number) => Math.round((Number(v) || 0) * 100);

export const avaliarRegras = (
  totalBruto: number,
  totalDesconto: number,
  linhas: LinhaAvaliada[],
  regras: RegrasVenda
): ResultadoRegras => {
  const percentualDesconto = c(totalBruto) > 0 ? Number(((c(totalDesconto) / c(totalBruto)) * 100).toFixed(2)) : 0;
  const excedeDesconto = percentualDesconto > Number(regras.descontoMaxPercentual) + 1e-9;

  // Abaixo do custo: só itens com custo conhecido (custo zero = sem informação, não bloqueia)
  const abaixoCusto = regras.politicaAbaixoCusto === 'PERMITIR'
    ? []
    : linhas.filter(l => c(l.custoTotal) > 0 && c(l.totalItem) < c(l.custoTotal))
      .map(l => ({ idItem: l.idItem, nome: l.nome, totalItem: l.totalItem, custoTotal: Number(l.custoTotal.toFixed(2)) }));

  const motivos: string[] = [];
  if (excedeDesconto) motivos.push(`Desconto de ${percentualDesconto.toFixed(2)}% passa do limite de ${Number(regras.descontoMaxPercentual).toFixed(2)}%.`);
  let bloqueio: string | null = null;
  if (abaixoCusto.length > 0) {
    const lista = abaixoCusto.map(a => `${a.nome} (R$ ${a.totalItem.toFixed(2)} < custo R$ ${a.custoTotal.toFixed(2)})`).join('; ');
    if (regras.politicaAbaixoCusto === 'BLOQUEAR') bloqueio = `Venda abaixo do custo não é permitida: ${lista}.`;
    else motivos.push(`Abaixo do custo: ${lista}.`);
  }
  return { percentualDesconto, excedeDesconto, abaixoCusto, motivos, exigeAutorizacao: motivos.length > 0 && !bloqueio, bloqueio };
};

// Senha de autorização: scrypt com sal ("scrypt$sal$hash", hex)
export const gerarHashSenha = (senha: string): string => {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${scryptSync(senha, sal, 32).toString('hex')}`;
};

export const conferirSenha = (senha: string, hash: string | null): boolean => {
  if (!hash || !senha) return false;
  const [tipo, salHex, hashHex] = hash.split('$');
  if (tipo !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const obtido = scryptSync(senha, Buffer.from(salHex, 'hex'), esperado.length);
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
};

export const validarNovaSenha = (senha: string): string | null =>
  String(senha || '').length < 4 ? 'A senha de autorização precisa ter pelo menos 4 caracteres.' : null;

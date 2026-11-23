// CNPJ: só dígitos no banco, dígitos verificadores conferidos, e a estrutura do número: os 8 primeiros (raiz) são a
// EMPRESA; os 4 seguintes, o ESTABELECIMENTO (0001 costuma ser a matriz; os outros, filiais). Filiais da mesma empresa
// são cadastros separados (nota, IE e boleto são por estabelecimento), mas na compra contam como um fornecedor só.
// Puro, com teste.

/** CNPJ fictício da entrada sem nota (compra avulsa): aceito no cadastro, nunca agrupado. */
export const CNPJ_COMPRA_AVULSA = '00000000000000';

export const limparCnpj = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** Dígitos verificadores do CNPJ (módulo 11). Repetido (11111111111111) é inválido. */
export const cnpjValido = (v: unknown) => {
  const c = limparCnpj(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base: string) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const d of base) { soma += Number(d) * peso; peso = peso === 2 ? 9 : peso - 1; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13]);
};

/** Raiz (empresa): os 8 primeiros dígitos; null se não for um CNPJ de 14 dígitos ou for o da compra avulsa. */
export const raizCnpj = (v: unknown) => {
  const c = limparCnpj(v);
  return c.length === 14 && c !== CNPJ_COMPRA_AVULSA ? c.slice(0, 8) : null;
};

/** "Matriz" (0001) ou "Filial 0009". */
export const estabelecimentoCnpj = (v: unknown) => {
  const c = limparCnpj(v);
  if (c.length !== 14 || c === CNPJ_COMPRA_AVULSA) return null;
  const ordem = c.slice(8, 12);
  return ordem === '0001' ? 'Matriz' : `Filial ${ordem}`;
};

export const formatarCnpj = (v: unknown) => {
  const c = limparCnpj(v);
  return c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : String(v ?? '');
};

/**
 * Agrupa estabelecimentos da mesma empresa (mesma raiz): só grupos com 2+. Nome da empresa = o menor nome do grupo
 * (as razões sociais das filiais costumam ser variações do mesmo nome).
 */
export const agruparPorRaiz = <T extends { cnpj: string | null; nome: string }>(lista: T[]) => {
  const grupos = new Map<string, T[]>();
  for (const x of lista) {
    const r = raizCnpj(x.cnpj);
    if (!r) continue;
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r)!.push(x);
  }
  return [...grupos.entries()].filter(([, l]) => l.length > 1).map(([raiz, l]) => ({
    raiz, nome: [...l].map(x => x.nome).sort((a, b) => a.length - b.length || a.localeCompare(b))[0], estabelecimentos: l,
  }));
};

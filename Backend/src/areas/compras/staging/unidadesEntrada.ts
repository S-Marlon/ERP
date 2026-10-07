// Unidades de entrada (UOM da NF): traduz a sigla que vem na nota (uCom) para a unidade interna.
// Ordem: 1) regra deste fornecedor  2) sigla igual a uma unidade do cadastro  3) regra geral.
// A regra do fornecedor vem primeiro porque é a mais específica (ex.: para um fornecedor "M" é milheiro).
// O dicionário só guarda SINÔNIMOS (M = MT); embalagem que depende do produto (1 CX = 50 UN) continua
// na conversão de cada item.

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

export type OrigemUnidade = 'fornecedor' | 'cadastro' | 'geral';

export interface RegraUnidade {
  idFornecedor: number | null;
  siglaEntrada: string;
  siglaInterna: string;
}

export interface ResolucaoUnidade {
  siglaNota: string;
  siglaInterna: string | null; // null = não reconhecida (precisa definir na conferência)
  origem: OrigemUnidade | null;
}

export type ResolvedorUnidade = (sigla: string | null | undefined) => ResolucaoUnidade;

export const normalizarSigla = (sigla: unknown): string => String(sigla ?? '').trim().toUpperCase();

export const criarResolvedor = (siglasCadastro: string[], regras: RegraUnidade[], idFornecedor: number | null): ResolvedorUnidade => {
  const cadastro = new Set(siglasCadastro.map(normalizarSigla));
  const doFornecedor = new Map<string, string>();
  const gerais = new Map<string, string>();
  for (const r of regras) {
    const chave = normalizarSigla(r.siglaEntrada);
    if (r.idFornecedor === null) gerais.set(chave, normalizarSigla(r.siglaInterna));
    else if (idFornecedor !== null && Number(r.idFornecedor) === Number(idFornecedor)) doFornecedor.set(chave, normalizarSigla(r.siglaInterna));
  }
  return (sigla) => {
    const s = normalizarSigla(sigla);
    if (!s) return { siglaNota: s, siglaInterna: null, origem: null };
    if (doFornecedor.has(s)) return { siglaNota: s, siglaInterna: doFornecedor.get(s)!, origem: 'fornecedor' };
    if (cadastro.has(s)) return { siglaNota: s, siglaInterna: s, origem: 'cadastro' };
    if (gerais.has(s)) return { siglaNota: s, siglaInterna: gerais.get(s)!, origem: 'geral' };
    return { siglaNota: s, siglaInterna: null, origem: null };
  };
};

// Sigla interna (ou a própria sigla, se não reconhecida)
export const canonizar = (resolver: ResolvedorUnidade | undefined) => (sigla: string | null | undefined): string => {
  const s = normalizarSigla(sigla);
  if (!resolver || !s) return s;
  return resolver(s).siglaInterna ?? s;
};

export const carregarResolvedor = async (conn: Conn, tenant: number, idFornecedor: number | null): Promise<ResolvedorUnidade> => {
  const [unidades] = await conn.execute(
    `SELECT sigla FROM itens_unidades_medida WHERE tenant_id = ? AND ativa = 1`, [tenant]
  );
  const [regras] = await conn.execute(
    `SELECT e.id_fornecedor, e.sigla_entrada, u.sigla AS sigla_interna
     FROM itens_unidades_equivalencias e
     INNER JOIN itens_unidades_medida u ON u.id_unidade = e.id_unidade
     WHERE e.tenant_id = ? AND (e.id_fornecedor IS NULL OR e.id_fornecedor = ?)`,
    [tenant, idFornecedor ?? 0]
  );
  return criarResolvedor(
    (unidades as any[]).map(u => String(u.sigla)),
    (regras as any[]).map(r => ({ idFornecedor: r.id_fornecedor === null ? null : Number(r.id_fornecedor), siglaEntrada: r.sigla_entrada, siglaInterna: r.sigla_interna })),
    idFornecedor
  );
};

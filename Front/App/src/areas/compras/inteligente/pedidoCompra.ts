// Contas e exportação do pedido em montagem (iguais às do servidor).

export interface LinhaPedido {
  codigoFornecedor: string | null;
  nome: string;
  quantidade: number;
  unidadeCompra: string;
  precoCompra: number;
}

const arred2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const qtdTexto = (v: number) => String(Math.round(v * 10000) / 10000).replace('.', ',');

export const totalPedido = (linhas: Array<{ quantidade: number; precoCompra: number }>) =>
  arred2(linhas.reduce((a, l) => a + arred2(l.quantidade * l.precoCompra), 0));

/** Situação frente ao pedido mínimo: quanto falta e o percentual atingido. */
export const situacaoMinimo = (total: number, minimo: number) => ({
  falta: arred2(Math.max(0, minimo - total)),
  percentual: minimo > 0 ? Math.min(100, Math.round((total / minimo) * 100)) : 100,
  atinge: !(minimo > 0) || total >= minimo - 0.004,
});

/** Texto para o fornecedor (WhatsApp/e-mail): só código e quantidade. */
export const textoPedido = (fornecedor: string, linhas: LinhaPedido[], observacao = '') => {
  const itens = linhas.filter(l => l.quantidade > 0);
  return [
    `Olá, ${fornecedor}! Por favor, orçamento dos itens abaixo:`,
    '',
    ...itens.map(l => `${l.codigoFornecedor || `(sem código) ${l.nome}`} - ${qtdTexto(l.quantidade)} ${l.unidadeCompra}`.trim()),
    '',
    `${itens.length} item(ns).${observacao ? ` ${observacao}` : ''}`,
  ].join('\n');
};

/** CSV (Excel em português: ponto e vírgula) com código, quantidade e unidade. */
export const csvPedido = (linhas: LinhaPedido[]) => {
  const esc = (t: string) => (/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  return ['codigo;quantidade;unidade;descricao',
    ...linhas.filter(l => l.quantidade > 0).map(l => [esc(l.codigoFornecedor || ''), qtdTexto(l.quantidade), esc(l.unidadeCompra), esc(l.nome)].join(';')),
  ].join('\r\n');
};

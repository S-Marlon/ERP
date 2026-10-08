// Exclusão de itens (ex.: itens de teste): só apaga quem não tem histórico. Regras puras.
// Histórico = nota de entrada, movimento/saldo de estoque, venda/orçamento/devolução, OS, composição, unificação, correção.

export interface UsoDoItem {
  notasEntrada: number;      // linhas de NF na conferência/staging e itens de nota de compra
  movimentos: number;        // estoque_movimentos
  saldo: number;             // soma do saldo (qualquer depósito)
  vendas: number;            // vendas, orçamentos e suspensas
  devolucoes: number;
  ordensServico: number;     // módulo hidráulica (montagens)
  composicoes: number;       // é componente de um kit
  unificacoes: number;
  correcoes: number;         // correções de entrada que apontam para o item
}

export const USO_VAZIO: UsoDoItem = {
  notasEntrada: 0, movimentos: 0, saldo: 0, vendas: 0, devolucoes: 0, ordensServico: 0, composicoes: 0, unificacoes: 0, correcoes: 0,
};

/** Por que o item não pode ser apagado (vazio = pode). */
export const motivosBloqueio = (u: UsoDoItem): string[] => {
  const m: string[] = [];
  if (u.notasEntrada > 0) m.push(`tem nota de entrada (${u.notasEntrada})`);
  if (u.movimentos > 0) m.push(`tem movimento de estoque (${u.movimentos})`);
  if (Math.abs(u.saldo) >= 0.0001) m.push(`tem saldo em estoque (${Number(u.saldo.toFixed(4))})`);
  if (u.vendas > 0) m.push(`está em venda/orçamento (${u.vendas})`);
  if (u.devolucoes > 0) m.push(`tem devolução (${u.devolucoes})`);
  if (u.ordensServico > 0) m.push(`está em OS de montagem (${u.ordensServico})`);
  if (u.composicoes > 0) m.push('é componente de um kit');
  if (u.unificacoes > 0) m.push('está numa unificação de itens');
  if (u.correcoes > 0) m.push('está numa correção de entrada');
  return m;
};

/** Ids válidos e sem repetição (até 500). */
export const lerIds = (bruto: unknown): number[] => {
  const lista = Array.isArray(bruto) ? bruto : String(bruto ?? '').split(',');
  return [...new Set(lista.map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 500);
};

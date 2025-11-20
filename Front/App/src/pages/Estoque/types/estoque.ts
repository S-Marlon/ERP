// src/types/estoque.ts (Adicionando o tipo de movimento)

export type TipoMovimento = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

export interface Produto {
  id: number;
  nome: string;
  sku: string;
  quantidadeAtual: number;
  // ... outras propriedades
}

export interface MovimentacaoFormData {
  produtoId: number | null;
  tipoMovimento: TipoMovimento | '';
  quantidade: number | '';
  motivo: string;
}
export type ItemType = 'Produto' | 'Servico';

export interface ItemOrdem {
  id: string;
  tipoItem: ItemType;
  produtoId?: string;
  servicoId?: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface OrdemVenda {
  id: string;
  clienteId?: string;
  items: ItemOrdem[]; // UNICO campo para itens
  total: number;
  status: 'Pendente' | 'Concluido' | 'Cancelado' | 'Em Andamento';
  criadoEm?: string;
  observacoes?: string;
}
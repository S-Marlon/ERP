// src/types/dashboard.ts
export interface DashboardStats {
  totalProdutos: number;
  valorTotalEstoque: number;
  produtosEmAlerta: number;
  giroVendasTop3: { nome: string; vendas: number }[];
  estoqueParadoCount: number;
  variacaoCusto: number; // Porcentagem
}
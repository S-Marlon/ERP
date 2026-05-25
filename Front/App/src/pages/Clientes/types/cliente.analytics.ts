export interface ClienteAnalytics {
  ticket_medio?: number;

  total_gasto?: number;

  total_compras?: number;

  frequencia_compra_dias?: number;

  sensibilidade_preco?: SensibilidadePreco;

  risco_inadimplencia?: number;

  probabilidade_churn?: number;

  valor_lifetime_estimado?: number;
}
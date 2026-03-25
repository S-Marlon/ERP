export default interface VendaPayload {
  data: Date;
  clienteId?: number; // Se tiver ID de cliente
  clienteNome: string;
  
  // Totais para conferência rápida
  totalBruto: number;      // Soma dos itens sem desconto
  totalDesconto: number;   // Valor total de desconto dado
  totalLiquido: number;    // O que o cliente realmente pagou
  totalCusto: number;      // Soma do preço de custo dos itens (essencial para lucro)
  lucroNominal: number;    // Liquido - Custo
  percentualLucro: number; // (Lucro / Liquido) * 100

  // Detalhes dos Itens (O snapshot)
  itens: {
    productId: number;
    nome: string;
    quantidade: number;
    precoVenda: number;     // Preço praticado na hora
    precoCusto: number;     // Preço de custo na hora (fundamental!)
    subtotal: number;
    lucroUnitario: number;
  }[];

  // Pagamentos
  pagamentos: {
    metodo: string;
    valor: number;
    parcelas: number;
  }[];
}
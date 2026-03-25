const apiBase = 'http://localhost:3001/api';

export interface SaleItemPayload {
    productId: number;
    nome: string;
    quantidade: number;
    precoVenda: number;
    precoCusto: number; // Snapshot do custo no momento da venda
    subtotal: number;
    lucroUnitario: number;
}

export interface SalePayload {
    data: string;
    clienteNome: string;
    totalBruto: number;
    totalDesconto: number;
    totalLiquido: number;
    totalCusto: number;
    lucroNominal: number;
    percentualLucro: number;
    itens: SaleItemPayload[];
    pagamentos: {
        metodo: string;
        valor: number;
        parcelas: number;
    }[];
}

export const salesService = {
    /**
     * Registra a venda no banco de dados
     */
    async saveVenda(venda: SalePayload): Promise<{ success: boolean; id?: number }> {
        try {
            const response = await fetch(`${apiBase}/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(venda),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Erro ao registrar venda no servidor.');
            }

            return await response.json();
        } catch (error) {
            console.error("Erro no salesService:", error);
            throw error;
        }
    }
};
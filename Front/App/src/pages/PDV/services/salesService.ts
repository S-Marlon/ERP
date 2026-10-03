import { operadorAtual } from '../caixa/caixaApi';

const apiBase = 'http://localhost:3001/api/vendas/pdv';

// Venda no modelo novo: o backend recalcula o preço de tabela, baixa o estoque e valida os pagamentos
export type FormaPagamentoPdv = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'PRAZO' | 'TRANSFERENCIA';

export interface VendaPdvItemPayload {
    idItem: number;
    quantidade: number;
    idUnidade?: number | null;
    precoUnitario?: number;   // preço praticado (com desconto individual)
}

export interface VendaPdvPayload {
    clienteNome?: string;
    idCliente?: number | null;
    observacao?: string;
    descontoGeral?: number;
    itens: VendaPdvItemPayload[];
    pagamentos: { forma: FormaPagamentoPdv; valor: number; parcelas?: number; intervaloDias?: number; primeiroVencimento?: string }[];
}

export interface VendaPdvResposta {
    success: boolean;
    idVenda: number;
    totalBruto: number;
    totalDesconto: number;
    totalLiquido: number;
    troco: number;
    // Venda a prazo: parcelas geradas em contas a receber
    parcelas?: { parcela: number; totalParcelas: number; vencimento: string; valor: number }[];
}

export interface VendaResumo {
    idVenda: number;
    status: 'CONCLUIDA' | 'CANCELADA';
    clienteNome: string;
    operador?: string | null;
    idCaixa?: number | null;
    totalBruto: number;
    totalDesconto: number;
    totalLiquido: number;
    totalCusto: number;
    qtdItens: number;
    formas: string[];
    criadoEm: string;
    canceladoEm?: string | null;
    motivoCancelamento?: string | null;
}

const lerErro = async (response: Response, padrao: string) => {
    const data = await response.json().catch(() => ({}));
    return new Error(data.error || data.message || padrao);
};

export const salesService = {
    async saveVenda(venda: VendaPdvPayload): Promise<VendaPdvResposta> {
        const response = await fetch(`${apiBase}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...venda, operador: operadorAtual() }),
        });
        if (!response.ok) throw await lerErro(response, 'Erro ao registrar venda no servidor.');
        return response.json();
    },

    async listarVendas(data?: string): Promise<VendaResumo[]> {
        const response = await fetch(`${apiBase}/vendas${data ? `?data=${data}` : ''}`);
        if (!response.ok) throw await lerErro(response, 'Erro ao listar vendas.');
        return response.json();
    },

    async cancelarVenda(idVenda: number, motivo: string): Promise<{ success: boolean }> {
        const response = await fetch(`${apiBase}/vendas/${idVenda}/cancelar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo, operador: operadorAtual() }),
        });
        if (!response.ok) throw await lerErro(response, 'Erro ao cancelar a venda.');
        return response.json();
    },
};

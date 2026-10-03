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

// Erro do servidor com o código de negócio (ex.: AUTORIZACAO_NECESSARIA, CAIXA_FECHADO) em `detalhes`
export class ErroVendaPdv extends Error {
    constructor(message: string, public status: number, public detalhes?: { codigo?: string; motivos?: string[]; temSenha?: boolean; senhaIncorreta?: boolean }) {
        super(message);
    }
}

const lerErro = async (response: Response, padrao: string) => {
    const data = await response.json().catch(() => ({}));
    return new ErroVendaPdv(data.error || data.message || padrao, response.status, data.detalhes);
};

export interface AutorizacaoVenda { senha: string; nome: string; motivo: string }

export const salesService = {
    async saveVenda(venda: VendaPdvPayload, autorizacao?: AutorizacaoVenda): Promise<VendaPdvResposta> {
        const response = await fetch(`${apiBase}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...venda, operador: operadorAtual(), ...(autorizacao ? { autorizacao } : {}) }),
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

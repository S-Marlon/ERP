import { API_URL } from '../../../../shared/api/config';
import { operadorAtual } from '../../caixa/caixaApi';

const apiBase = `${API_URL}/api/vendas/pdv`;

// Venda no modelo novo: o backend recalcula o preço de tabela, baixa o estoque e valida os pagamentos
export type FormaPagamentoPdv = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'PRAZO' | 'TRANSFERENCIA' | 'ADIANTAMENTO';

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
    // Crédito parcelado acima do sem juros: diferença de taxa repassada ao cliente
    acrescimoGeral?: number;
    // Venda gerada de um orçamento (manterPrecoOrcamento: preços do orçamento, se ainda válido)
    idOrcamento?: number;
    manterPrecoOrcamento?: boolean;
    itens: VendaPdvItemPayload[];
    pagamentos: { forma: FormaPagamentoPdv; valor: number; parcelas?: number; intervaloDias?: number; primeiroVencimento?: string; idAdiantamento?: number }[];
}

export interface VendaPdvResposta {
    success: boolean;
    idVenda: number;
    totalBruto: number;
    totalDesconto: number;
    totalLiquido: number;
    totalTaxas?: number;
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
    totalDevolvido?: number;
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

// ---------------------------------------------------------------------------------------------
// Devolução parcial/total e troca
// ---------------------------------------------------------------------------------------------
export type ReembolsoDevolucao = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'CREDITO_LOJA' | 'ABATER_PRAZO';

export interface DadosDevolucao {
    idVenda: number; status: string; idCliente: number | null; cliente: string; total: number; totalDevolvido: number; criadoEm: string;
    saldoPrazo: number;
    itens: Array<{ idVendaItem: number; idItem: number; nome: string; sku: string; unidade: string; quantidade: number; devolvido: number; restante: number; valorUnitarioPago: number; total: number; servico: boolean }>;
    devolucoes: Array<{ idDevolucao: number; reembolso: string; valor: number; motivo: string; operador: string; criadoEm: string }>;
}

export const devolucoesService = {
    async dados(idVenda: number): Promise<DadosDevolucao> {
        const r = await fetch(`${apiBase}/vendas/${idVenda}/devolucao`);
        if (!r.ok) throw await lerErro(r, 'Erro ao carregar a venda.');
        return r.json();
    },
    async registrar(idVenda: number, dados: { itens: Array<{ idVendaItem: number; quantidade: number; voltaEstoque: boolean }>; reembolso: ReembolsoDevolucao; motivo: string }) {
        const r = await fetch(`${apiBase}/vendas/${idVenda}/devolucoes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, operador: operadorAtual() }),
        });
        if (!r.ok) throw await lerErro(r, 'Erro ao registrar a devolução.');
        return r.json() as Promise<{ idDevolucao: number; valor: number; idAdiantamento: number | null }>;
    },
    async detalhe(idDevolucao: number): Promise<{ idDevolucao: number; idVenda: number; idCliente: number | null; cliente: string; valor: number; idAdiantamento: number | null }> {
        const r = await fetch(`${apiBase}/devolucoes/${idDevolucao}`);
        if (!r.ok) throw await lerErro(r, 'Erro ao carregar a devolução.');
        return r.json();
    },
};

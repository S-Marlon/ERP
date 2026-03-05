// src/services/DashboardApi.ts
const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api';

export interface DashboardStats {
    totalProdutos: number;
    valorTotalEstoque: number;
    produtosEmAlerta: number;
    giroVendas: number;
    variacaoCusto: number;
    categoriaTopABC: string;
    estoqueParado: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${apiBase}/dashboard/stats`);

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao carregar dados do dashboard');
    }

    return res.json();
}
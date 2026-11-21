// Curva ABC: API e tipos. Backend em areas/estoque/curvaAbc (GET /api/estoque/curva-abc?dias=90).
import { API_URL } from '../../../shared/api/config';
import type { ClasseExibida, ItemClassificado } from './curvaAbc';

export interface ItemCurvaTela extends ItemClassificado {
  sku: string; nome: string; unidade: string | null; categoria: string | null; categoriaTopoNome: string | null;
}
export interface RespostaCurva { dias: number; historicoDesde: string | null; diasDeHistorico: number; itens: ItemCurvaTela[] }

export const curvaAbcApi = {
  carregar: async (dias: number): Promise<RespostaCurva> => {
    const r = await fetch(`${API_URL}/api/estoque/curva-abc?dias=${dias}`);
    const d = await r.json().catch(() => ({}));
    if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
    if (!r.ok) throw new Error(d.error || 'Erro ao calcular a curva ABC.');
    return d;
  },
};

export const COR_CLASSE: Record<ClasseExibida, string> = { A: '#389e0d', B: '#d48806', C: '#8c8c8c', P: '#cf1322', N: '#1677ff', '-': '#bfbfbf' };
export const ROTULO_CLASSE: Record<ClasseExibida, string> = {
  A: 'A', B: 'B', C: 'C', P: 'Parado', N: 'Novo', '-': 'Sem giro',
};
export const AJUDA_CLASSE: Record<ClasseExibida, string> = {
  A: '80% do valor: poucos itens que mais pesam',
  B: 'Os próximos 15% do valor',
  C: 'Os últimos 5%: muitos itens, pouco peso',
  P: 'Tem estoque e não vendeu no período: dinheiro parado',
  N: 'Entrou há pouco (depois que o ERP já vendia): ainda sem histórico',
  '-': 'Sem venda e sem estoque',
};
export const AJUDA_XYZ: Record<string, string> = {
  X: 'Vende quase toda semana', Y: 'Vende de vez em quando', Z: 'Vendeu numa semana só (pedido pontual)',
};

/** CSV (separado por ;) para abrir no Excel. */
export const csvCurva = (itens: ItemCurvaTela[], classe: (i: ItemCurvaTela) => string) => {
  const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
  const linhas = [
    ['Código', 'Item', 'Categoria', 'Classe', 'Venda', 'Lucro', 'Estoque', 'XYZ', 'Classe na categoria', 'Receita', 'Lucro R$', 'Margem %',
      'Qtd vendida', 'Nº vendas', 'Estoque qtd', 'Estoque R$', 'Cobertura (dias)', 'Última venda', 'Recomendação'],
    ...itens.map(i => [i.sku, i.nome, i.categoria || '', classe(i), i.venda || '', i.lucroClasse || '', i.estoqueClasse || '', i.xyz || '', i.vendaNaCategoria || '',
      num(i.receita), num(i.lucro), num(i.margem !== null ? Math.round(i.margem * 1000) / 10 : null), num(i.quantidade), String(i.vendas), num(i.estoque),
      num(i.valorEstoque), num(i.coberturaDias), i.ultimaVenda || '', i.recomendacao || '']),
  ];
  return '﻿' + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
};

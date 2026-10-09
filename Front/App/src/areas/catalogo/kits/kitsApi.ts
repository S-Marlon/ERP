// Kits de venda: cadastro, custo, estoque possível e relatório (backend: /api/catalogo/kits).
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/catalogo/kits`;

export interface ComponenteKit {
  idItem: number;
  quantidade: number;
  nome: string;
  sku: string;
  unidade: string;
  saldo: number;
  custoUnitario: number;
  custoTotal: number;
  servico: boolean;
  inativo: boolean;
}

export interface Kit {
  idItem: number;
  sku: string;
  nome: string;
  status: string;
  categoriaId: number | null;
  categoria: string;
  precoCadastro: number;
  precoPdv: number;
  temFaixas: boolean;
  custo: number;
  custoGravado: number;
  lucro: number;
  margemPct: number;
  estoquePossivel: number | null;
  limitante: string | null;
  componentes: ComponenteKit[];
  vendidos: number;
  faturamento: number;
  vendas: number;
  ultimaVenda: string | null;
}

export interface RelatorioKits {
  dias: number;
  kits: Array<{
    idItem: number; sku: string; nome: string; vendidos: number; vendas: number; faturamento: number;
    custo: number; lucroEstimado: number; estoquePossivel: number | null; ultimaVenda: string | null;
  }>;
  componentes: Array<{
    idItem: number; nome: string; sku: string; unidade: string; saldo: number; custo: number;
    consumido: number; vendas: number; consumoMensal: number; diasCobertura: number | null;
    kits: string[]; travaKits: string[];
  }>;
}

export interface SalvarKit {
  nome?: string;
  sku?: string;
  precoVenda?: number | null;
  componentes?: Array<{ idItem: number; quantidade: number }>;
}

/** Item que pode entrar no kit (busca do PDV). Saldo e custo na unidade base. */
export interface ItemParaKit {
  idItem: number;
  sku: string;
  nome: string;
  unidade: string;
  saldo: number;
  custoUnitario: number;
  servico: boolean;
  ehKit: boolean;
}

const ler = async (r: Response, padrao: string) => {
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d;
};

export const listarKits = async (dias = 90): Promise<Kit[]> =>
  ler(await fetch(`${API}?tenant_id=1&dias=${dias}`), 'Erro ao listar os kits.');

export const relatorioKits = async (dias = 90): Promise<RelatorioKits> =>
  ler(await fetch(`${API}/relatorio?tenant_id=1&dias=${dias}`), 'Erro ao montar o relatório de kits.');

export const criarKit = async (dados: SalvarKit): Promise<Kit> =>
  ler(await fetch(`${API}?tenant_id=1`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }), 'Erro ao criar o kit.');

export const atualizarKit = async (idItem: number, dados: SalvarKit): Promise<Kit> =>
  ler(await fetch(`${API}/${idItem}?tenant_id=1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }), 'Erro ao salvar o kit.');

export const desfazerKit = async (idItem: number) =>
  ler(await fetch(`${API}/${idItem}?tenant_id=1`, { method: 'DELETE' }), 'Erro ao desfazer o kit.');

export const atualizarCustosKits = async (): Promise<{ kits: number; alterados: number }> =>
  ler(await fetch(`${API}/atualizar-custos?tenant_id=1`, { method: 'POST' }), 'Erro ao atualizar os custos.');

export const buscarItensParaKit = async (texto: string): Promise<ItemParaKit[]> => {
  const q = new URLSearchParams({ query: texto, limit: '30', incluirNaoPublicaveis: 'true', status: 'Ativo' });
  const d = await ler(await fetch(`${API_URL}/api/vendas/pdv/itens?${q}`), 'Erro ao buscar os itens.');
  return (d.data || []).map((p: any) => {
    const fator = Number(p.fatorConversao) || 1;
    return {
      idItem: Number(p.id),
      sku: p.sku || '',
      nome: p.name || '',
      unidade: p.unidadeBase || p.unitOfMeasure || '',
      saldo: Number(p.estoqueBase) || 0,
      custoUnitario: Math.round(((Number(p.costPrice) || 0) / fator) * 10000) / 10000,
      servico: p.tipoRecurso === 'SERVICO',
      ehKit: Boolean(p.ehKit),
    };
  });
};

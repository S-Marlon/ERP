// API do configurador de vendas (unidades de venda, faixas de preço e custo gerencial)
import { API_URL } from '../../../shared/api/config';
const API_BASE_URL = `${API_URL}/api/catalogo`;

export interface UnidadeVendaApi {
  sigla: string;
  descricao: string | null;
  fator: number;
  is_base: boolean;
  configurada: boolean;
  nome_exibicao: string | null;
  gtin: string | null;
  permite_venda: boolean;
  permite_atacado: boolean;
  markup_varejo: number | null;
  padrao_pdv: boolean;
}

export interface FaixaPrecoApi {
  sigla: string;
  tipo_faixa: 'VAREJO' | 'ATACADO';
  ordem: number;
  quantidade_minima: number;
  quantidade_maxima: number | null;
  markup: number;
  preco_unitario: number;
  // Taxa da maquininha com que o preço foi calculado (null = preço anterior a esse registro)
  taxa_embutida?: number | null;
}

export interface CustosApi {
  defasado: boolean;
  custoGerencial: number | null;
  custoMedio: number | null;
  ultimoCusto: number | null;
  variacaoUltimoPct: number | null;
  variacaoMedioPct: number | null;
  quantidadeAtual: number;
}

export interface ConfigVendasApi {
  item: { id_item: number; sku: string; nome: string; tipo_recurso: string; sigla_base: string | null; descricao_base: string | null };
  custos: CustosApi;
  unidades: UnidadeVendaApi[];
  faixas: FaixaPrecoApi[];
}

export interface SalvarConfigPayload {
  custo_gerencial: number;
  unidades: Array<{
    sigla: string;
    descricao: string;
    fator: number;
    is_base: boolean;
    nome_exibicao: string | null;
    gtin: string | null;
    permite_venda: boolean;
    permite_atacado: boolean;
    markup_varejo: number;
    padrao_pdv: boolean;
  }>;
  faixas: Array<Omit<FaixaPrecoApi, 'tipo_faixa'> & { tipo_faixa: 'VAREJO' | 'ATACADO' }>;
}

export interface ItemBusca {
  id: number;
  sku: string;
  name: string;
  unitOfMeasure: string;
}

const tratar = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || 'Erro na comunicação com o servidor.');
  }
  return data;
};

export const buscarItens = async (termo: string, tenantId = 1, signal?: AbortSignal): Promise<ItemBusca[]> => {
  const response = await fetch(
    `${API_BASE_URL}/produtos/search?tenant_id=${tenantId}&term=${encodeURIComponent(termo)}`,
    { signal }
  );
  return tratar(response);
};

export const carregarConfigVendas = async (idItem: number, tenantId = 1): Promise<ConfigVendasApi> =>
  tratar(await fetch(`${API_BASE_URL}/itens/${idItem}/config-vendas?tenant_id=${tenantId}`));

export const salvarConfigVendas = async (idItem: number, payload: SalvarConfigPayload, tenantId = 1): Promise<ConfigVendasApi> =>
  tratar(await fetch(`${API_BASE_URL}/itens/${idItem}/config-vendas?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));

export const atualizarCustoGerencial = async (idItem: number, custo: number, tenantId = 1): Promise<ConfigVendasApi & { message: string }> =>
  tratar(await fetch(`${API_BASE_URL}/itens/${idItem}/custo-gerencial?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custo_gerencial: custo }),
  }));

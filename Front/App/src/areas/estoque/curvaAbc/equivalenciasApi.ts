// Marcas e equivalentes: API e tipos. Backend em areas/estoque/curvaAbc/equivalencias.controller.ts.
import { API_URL } from '../../../shared/api/config';
import { operadorAtual } from '../../vendas/caixa/caixaApi';

export type Papel = 'VENDE' | 'TRAVA' | 'OK';
export type DecisaoCompra = 'PREFERIDO' | 'NAO_RECOMPRAR' | null;

export interface ItemGrupo {
  idItem: number; sku: string; nome: string; marca: string | null; familia: string | null; categoria: string | null;
  quantidade: number; receita: number; vendas: number; estoque: number; valorEstoque: number; custoUnitario: number; precoVenda: number;
  partVendas: number; partEstoque: number; giro: number | null; papel: Papel; precoEscoar: number | null; precoEscoarNoMinimo: boolean;
  decisaoCompra: DecisaoCompra; decisaoMotivo: string | null; decisaoEm: string | null; decisaoPor: string | null;
}
export interface AlertaGrupo { trava: string; partEstoque: number; partVendas: number; preferida: string }
export interface GrupoEquivalente {
  chave: string; titulo: string; categoria: string | null; valores: Array<{ atributo: string; valor: string }>;
  itens: ItemGrupo[]; quantidadeVendida: number; estoque: number; vendas: number; confianca: 'BAIXA' | 'MEDIA' | 'ALTA';
  alerta: string | null; alertas: AlertaGrupo[]; valorTravado: number; vencedor: { idItem: number; nome: string; marca: string } | null; conflito: boolean;
}
export interface RelatorioEquivalencias {
  dias: number; diasDeHistorico: number; margemMinima: number; grupos: GrupoEquivalente[];
  demanda: Array<{ atributo: string; valor: string; categoria: string | null; quantidade: number; receita: number; estoque: number; itens: number; marcas: string[] }>;
  marcas: Array<{ marca: string; itens: number; quantidade: number; receita: number; estoque: number; valorEstoque: number; giro: number | null }>;
  atributos: Array<{ id: number; nome: string; tipo: string; define: boolean; itens: number; exemplos: string }>;
  pendencias: Array<{ idItem: number; sku: string; nome: string; categoria: string | null; falta: string }>;
  itensSemMarca: number;
}

const pedir = async <T,>(url: string, init?: RequestInit, erro = 'Erro nos equivalentes.'): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
  if (!r.ok) throw new Error(d.error || erro);
  return d as T;
};
const enviar = (corpo: unknown) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object), operador: operadorAtual() }) });

export interface SugestaoMarca { idItem: number; sku: string; nome: string; categoria: string | null; marca: string; marcaNova: boolean }

export const equivalenciasApi = {
  sugestoesMarca: () => pedir<{ sugestoes: SugestaoMarca[]; semMarca: number }>(`${API_URL}/api/catalogo/marcas/sugestoes`),
  aplicarMarcas: (itens: Array<{ idItem: number; marca: string }>) => pedir<{ atribuidas: number; criadas: string[] }>(`${API_URL}/api/catalogo/marcas/sugestoes/aplicar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }),
  }, 'Erro ao aplicar as marcas.'),
  carregar: (dias: number) => pedir<RelatorioEquivalencias>(`${API_URL}/api/estoque/equivalencias?dias=${dias}`),
  marcarAtributo: (id: number, define: boolean) => pedir(`${API_URL}/api/estoque/equivalencias/atributos/${id}`, enviar({ define }), 'Erro ao salvar o atributo.'),
  decisao: (idItem: number, decisao: DecisaoCompra, motivo?: string) =>
    pedir(`${API_URL}/api/estoque/itens/${idItem}/decisao-compra`, enviar({ decisao, motivo }), 'Erro ao gravar a decisão.'),
};

export const PAPEL: Record<Papel, { rotulo: string; cor: string; ajuda: string }> = {
  VENDE: { rotulo: 'Vende', cor: 'green', ajuda: 'O que mais vende no grupo: preferir nas compras' },
  TRAVA: { rotulo: 'Trava', cor: 'red', ajuda: 'Metade ou mais do estoque do grupo e pouca venda: não recomprar e escoar' },
  OK: { rotulo: '—', cor: 'default', ajuda: 'Sem destaque' },
};
export const CONFIANCA: Record<GrupoEquivalente['confianca'], { rotulo: string; cor: string; ajuda: string }> = {
  BAIXA: { rotulo: 'sinal fraco', cor: 'default', ajuda: 'Menos de 5 vendas no grupo: confirme com a sua experiência' },
  MEDIA: { rotulo: 'sinal médio', cor: 'gold', ajuda: 'Entre 5 e 14 vendas no grupo' },
  ALTA: { rotulo: 'sinal forte', cor: 'green', ajuda: '15 vendas ou mais no grupo' },
};

// Inventário rotativo: API, tipos e a folha de conferência impressa. Backend em areas/estoque/inventario.
import { API_URL } from '../../../shared/api/config';
import { operadorAtual } from '../../vendas/caixa/caixaApi';
import { lerConfiguracoes } from '../../../shared/core/configuracoes/configuracoes';

const API = `${API_URL}/api/estoque/inventario`;

export interface ConfigInventario {
  itensPorDia: number; limiteDivergenciaValor: number; limiteDivergenciaPct: number; diasCurvaA: number; diasCurvaB: number; diasCurvaC: number;
}
export interface AreaInventario { id: number; nome: string; ordem: number; contar: boolean; categorias: number[] }
export interface GrupoDevido { grupo: string; nome: string; idArea: number | null; devidos: number; pedidos: number; problemas: number; urgencia: number }
export interface PainelInventario {
  config: ConfigInventario; areas: AreaInventario[]; categorias: Array<{ id: number; nome: string; pai: number | null }>; grupos: GrupoDevido[];
  abertas: Array<{ id: number; area: string; criada: string; itens: number; operador: string }>;
  pedidos: Array<{ idItem: number; nome: string; sku: string; motivo: string | null; pedida: string }>;
  indicadores: { listas: number; contados: number; certos: number; valorAjustado: number; saldoAjustado: number };
}
export interface ItemLista {
  idItem: number; sku: string; nome: string; unidade: string | null; categoria: string | null; localizacao: string | null; motivo: string; detalheMotivo: string | null;
  saldoImpresso: number; saldoAtual: number; custo: number; contado: number | null; saldoNaContagem: number | null; diferenca: number | null; situacao: string;
}
export interface ListaInventario {
  id: number; status: string; area: string; criada: string; contado: string | null; conferente: string | null; autorizadoPor: string | null; operador: string; itens: ItemLista[];
}
export interface ListaHistorico {
  id: number; status: string; conferente: string | null; area: string; contado: string | null; criada: string; autorizadoPor: string | null;
  itens: number; certos: number; ajustados: number; saldoAjustado: number;
}

export class ErroInventario extends Error {
  constructor(message: string, public detalhes?: any) { super(message); }
}
const pedir = async <T,>(url: string, init?: RequestInit, erro = 'Erro no inventário.'): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
  if (!r.ok) throw new ErroInventario(d.error || erro, d.detalhes);
  return d as T;
};
const enviar = (metodo: string, corpo: unknown = {}) => ({
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object), operador: operadorAtual() }),
});

export const inventarioApi = {
  painel: () => pedir<PainelInventario>(API, undefined, 'Erro ao carregar o inventário.'),
  gerar: (grupo?: string | null) => pedir<{ id: number; grupo: string; itens: number }>(`${API}/listas`, enviar('POST', { grupo: grupo || undefined }), 'Erro ao gerar a lista.'),
  historico: () => pedir<ListaHistorico[]>(`${API}/listas`, undefined, 'Erro ao listar.'),
  lista: (id: number) => pedir<ListaInventario>(`${API}/listas/${id}`, undefined, 'Erro ao abrir a lista.'),
  lancar: (id: number, d: { conferente: string; contadoEm: string; itens: Array<{ idItem: number; contado: number | null }>; autorizacao?: { senha: string; nome: string } }) =>
    pedir<{ contados: number; ajustados: number; naoContados: number }>(`${API}/listas/${id}/lancar`, enviar('POST', d), 'Erro ao lançar.'),
  cancelar: (id: number) => pedir(`${API}/listas/${id}/cancelar`, enviar('POST'), 'Erro ao cancelar.'),
  pedirConferencia: (idItem: number, motivo: string) => pedir(`${API}/pedidos`, enviar('POST', { idItem, motivo }), 'Erro ao pedir a conferência.'),
  retirarPedido: (idItem: number) => pedir(`${API}/pedidos/${idItem}`, { method: 'DELETE' }, 'Erro ao retirar.'),
  salvarConfig: (c: ConfigInventario) => pedir(`${API}/config`, enviar('PUT', c), 'Erro ao salvar.'),
  criarArea: (a: Omit<AreaInventario, 'id'>) => pedir<{ id: number }>(`${API}/areas`, enviar('POST', a), 'Erro ao criar a área.'),
  salvarArea: (a: AreaInventario) => pedir(`${API}/areas/${a.id}`, enviar('PUT', a), 'Erro ao salvar a área.'),
  excluirArea: (id: number) => pedir(`${API}/areas/${id}`, { method: 'DELETE' }, 'Erro ao excluir a área.'),
};

export const ROTULO_MOTIVO: Record<string, string> = {
  PEDIDO: 'Pedido', PROBLEMA: 'Problema', NUNCA_CONTADO: 'Nunca contado', CURVA_A: 'Curva A', CURVA_B: 'Curva B', CURVA_C: 'Curva C',
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dataHora = (s: string) => `${s.slice(0, 10).split('-').reverse().join('/')} ${s.slice(11, 16)}`;

/** Folha de conferência: saldo do sistema à vista; o conferente escreve a contagem só onde tiver diferença e assina. */
export const htmlFolha = (l: ListaInventario) => {
  const e = lerConfiguracoes().empresa;
  const empresa = e.nomeFantasia || e.razaoSocial || '';
  return `<html><head><meta charset="utf-8"><title>Inventário ${l.id}</title><style>
    @page { size: A4; margin: 11mm; } body { font-family: Arial, sans-serif; font-size: 11.5px; color: #111; }
    .topo { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; }
    h1 { font-size: 17px; margin: 0; } .sub { color: #444; margin-top: 2px; }
    .num { font-size: 22px; font-weight: bold; text-align: right; } .num small { display: block; font-size: 10px; font-weight: normal; color: #555; }
    .inst { margin: 8px 0; padding: 6px 8px; background: #f2f2f2; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; } th { text-align: left; border-bottom: 1.5px solid #111; font-size: 10.5px; padding: 5px 4px; }
    td { border-bottom: 1px solid #bbb; padding: 7px 4px; vertical-align: top; } .r { text-align: right; } .c { text-align: center; }
    .caixa { border: 1px solid #555; height: 20px; width: 70px; display: inline-block; } .cat { font-size: 9.5px; color: #666; }
    .mot { font-size: 9.5px; color: #a33; } .ass { display: flex; gap: 24px; margin-top: 26px; } .ass div { flex: 1; border-top: 1px solid #111; padding-top: 4px; font-size: 10.5px; }
  </style></head><body>
    <div class="topo"><div><h1>Inventário rotativo · ${esc(l.area)}</h1><div class="sub">${esc([empresa, `emitida em ${dataHora(l.criada)}`, `${l.itens.length} itens`].filter(Boolean).join(' · '))}</div></div>
      <div class="num">Lista Nº ${l.id}<small>lançar com este número</small></div></div>
    <div class="inst">Conte cada item. Se a quantidade bater com o <b>sistema</b>, marque ✓. Se não bater, escreva a quantidade contada. Anote a hora em que contou.</div>
    <table><thead><tr><th style="width:24px">#</th><th style="width:90px">Código</th><th>Produto</th><th style="width:34px">Un</th><th class="r" style="width:64px">Sistema</th>
      <th class="c" style="width:28px">✓</th><th class="c" style="width:86px">Contado</th></tr></thead><tbody>
      ${l.itens.map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.sku)}</td><td>${esc(i.nome)}<div class="cat">${esc([i.categoria, i.localizacao].filter(Boolean).join(' · '))}</div>
        ${i.motivo === 'PEDIDO' || i.motivo === 'PROBLEMA' ? `<div class="mot">${esc(i.detalheMotivo || '')}</div>` : ''}</td>
        <td>${esc(i.unidade || '')}</td><td class="r"><b>${qtd(i.saldoImpresso)}</b></td><td class="c"><span class="caixa" style="width:18px"></span></td>
        <td class="c"><span class="caixa"></span></td></tr>`).join('')}
    </tbody></table>
    <div class="ass"><div>Conferente (nome)</div><div>Assinatura</div><div style="flex:.7">Data e hora da contagem</div></div>
  </body></html>`;
};

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

/** Folha de conferência: saldo do sistema à vista; o conferente marca ✓ ou escreve a contagem, anota a hora e assina. */
export const htmlFolha = (l: ListaInventario) => {
  const e = lerConfiguracoes().empresa;
  const empresa = e.nomeFantasia || e.razaoSocial || '';
  const especiais = l.itens.filter(i => i.motivo === 'PEDIDO' || i.motivo === 'PROBLEMA').length;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Inventário · lista ${l.id}</title><style>
    @page { size: A4; margin: 10mm 10mm 12mm; }
    * { box-sizing: border-box; } table, td, th { font-size: inherit; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; }
    .cab { display: grid; grid-template-columns: 1fr auto; border: 1.2px solid #1a1a1a; }
    .cab .tit { padding: 6px 9px; } .cab h1 { font-size: 13.5px; margin: 0; letter-spacing: .2px; }
    .cab .emp { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 1px; }
    .cab .num { background: #1a1a1a; color: #fff; padding: 5px 12px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
    .cab .num b { font-size: 18px; line-height: 1; } .cab .num span { font-size: 8px; text-transform: uppercase; letter-spacing: .8px; opacity: .8; }
    .info { display: grid; grid-template-columns: repeat(4, 1fr); border: 1.2px solid #1a1a1a; border-top: 0; }
    .info div { padding: 3px 9px; border-right: 1px solid #ccc; } .info div:last-child { border-right: 0; }
    .info label { display: block; font-size: 7.5px; text-transform: uppercase; letter-spacing: .6px; color: #666; }
    .info .campo { height: 15px; }
    .inst { font-size: 8.8px; color: #444; margin: 5px 1px 4px; }
    table { width: 100%; border-collapse: collapse; } thead { display: table-header-group; } tr { page-break-inside: avoid; }
    th { font-size: 7.8px; text-transform: uppercase; letter-spacing: .5px; color: #fff; background: #1a1a1a; padding: 3.5px 5px; text-align: left; font-weight: 600; }
    td { padding: 3px 5px; border-bottom: 1px solid #ddd; vertical-align: middle; line-height: 1.25; }
    tbody tr:nth-child(even) td { background: #f6f6f6; }
    .n { color: #888; width: 18px; } .cod { width: 62px; font-family: Consolas, monospace; font-size: 9.3px; }
    .nome { font-weight: 600; } .cat { color: #777; font-size: 8px; font-weight: 400; }
    .mot { display: inline-block; font-size: 7.5px; font-weight: 600; color: #b42318; border: 1px solid #f2b8b5; background: #fef3f2; border-radius: 2px; padding: 0 3px; margin-left: 3px; }
    .det { color: #b42318; font-size: 8px; }
    .un { width: 28px; color: #555; } .sis { width: 52px; text-align: right; font-weight: 700; font-size: 10.5px; }
    .ok { width: 26px; text-align: center; } .cont { width: 74px; } .obs { width: 120px; }
    .bx { display: inline-block; width: 13px; height: 13px; border: 1.1px solid #333; border-radius: 2px; vertical-align: middle; }
    .ln { display: block; height: 15px; border-bottom: 1px solid #555; }
    .ass { display: grid; grid-template-columns: 1.2fr 1.2fr .8fr; gap: 0; margin-top: 10px; border: 1.2px solid #1a1a1a; page-break-inside: avoid; }
    .ass div { padding: 18px 9px 4px; border-right: 1px solid #ccc; font-size: 7.5px; text-transform: uppercase; letter-spacing: .6px; color: #666; }
    .ass div:last-child { border-right: 0; } .ass div::before { content: ''; display: block; border-bottom: 1px solid #555; margin-bottom: 3px; }
    .rodape { margin-top: 5px; font-size: 7.5px; color: #888; display: flex; justify-content: space-between; }
  </style></head><body>
    <div class="cab">
      <div class="tit">${empresa ? `<div class="emp">${esc(empresa)}</div>` : ''}<h1>Inventário rotativo · ${esc(l.area)}</h1></div>
      <div class="num"><span>Lista</span><b>${l.id}</b></div>
    </div>
    <div class="info">
      <div><label>Emitida</label>${dataHora(l.criada)}</div>
      <div><label>Itens</label>${l.itens.length}${especiais ? ` · ${especiais} com atenção` : ''}</div>
      <div><label>Início da contagem</label><div class="campo"></div></div>
      <div><label>Fim da contagem</label><div class="campo"></div></div>
    </div>
    <div class="inst">Conte cada item. Bateu com o <b>sistema</b>: marque ✓. Não bateu: escreva a quantidade contada. Itens marcados em vermelho pedem atenção.</div>
    <table><thead><tr><th>#</th><th>Código</th><th>Produto</th><th>Un</th><th style="text-align:right">Sistema</th><th style="text-align:center">✓</th><th>Contado</th><th>Obs.</th></tr></thead><tbody>
      ${l.itens.map((i, k) => `<tr><td class="n">${k + 1}</td><td class="cod">${esc(i.sku)}</td>
        <td><span class="nome">${esc(i.nome)}</span>${i.motivo === 'PEDIDO' || i.motivo === 'PROBLEMA' ? `<span class="mot">${i.motivo === 'PEDIDO' ? 'CONFERIR' : 'ATENÇÃO'}</span>` : ''}
          ${i.localizacao ? ` <span class="cat">· ${esc(i.localizacao)}</span>` : ''}
          ${(i.motivo === 'PEDIDO' || i.motivo === 'PROBLEMA') && i.detalheMotivo ? `<div class="det">${esc(i.detalheMotivo)}</div>` : ''}</td>
        <td class="un">${esc(i.unidade || '')}</td><td class="sis">${qtd(i.saldoImpresso)}</td>
        <td class="ok"><span class="bx"></span></td><td class="cont"><span class="ln"></span></td><td class="obs"><span class="ln"></span></td></tr>`).join('')}
    </tbody></table>
    <div class="ass"><div>Conferente (nome legível)</div><div>Assinatura</div><div>Data</div></div>
    <div class="rodape"><span>Lance em Estoque › Inventário rotativo › Lista ${l.id}. A diferença é calculada pelo saldo da hora da contagem.</span><span>${esc(l.area)}</span></div>
  </body></html>`;
};

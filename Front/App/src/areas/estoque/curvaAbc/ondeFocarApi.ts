// "Onde focar": API, tipos, texto de promoção para WhatsApp e o PDF mensal (com os fundos de reposição).
import { API_URL } from '../../../shared/api/config';
import { lerConfiguracoes } from '../../../shared/core/configuracoes/configuracoes';
import type { ListaFundos } from '../../financeiro/reservas/reservasApi';

export type Quadrante = 'PROTEGER' | 'REVER_PRECO' | 'DIVULGAR' | 'LIQUIDAR' | 'ACOMPANHAR';
export interface CategoriaFoco {
  categoria: string; itens: number; vendidos: number; receita: number; lucro: number; margem: number | null; margemTabela: number | null;
  estoque: number; parado: number; participacao: number; giro: number | null; quadrante: Quadrante; motivo: string;
}
export interface ItemPropaganda {
  idItem: number; sku: string; nome: string; unidade: string | null; categoria: string | null; estoque: number; valorEstoque: number;
  preco: number; margemTabela: number; descontoMaximo: number; descontoSugerido: number; precoPromocao: number;
}
export interface RelatorioFoco {
  dias: number; historicoDesde: string | null; diasDeHistorico: number; margemAlvo: number; margemMinima: number;
  categorias: CategoriaFoco[]; propaganda: ItemPropaganda[];
  chamarizes: Array<{ idItem: number; sku: string; nome: string; categoria: string | null; receita: number; preco: number; xyz: string }>;
  repor: Array<{ idItem: number; sku: string; nome: string; categoria: string | null; classe: string; estoque: number; coberturaDias: number | null; vendidoNoPeriodo: number; unidade: string | null }>;
  naoRecomprar: Array<{ idItem: number; sku: string; nome: string; categoria: string | null; estoque: number; valorEstoque: number; coberturaDias: number | null; unidade: string | null; motivo: string }>;
  evolucao: { mesAnterior: string | null; subiram: Array<{ sku: string; nome: string; de: string; para: string }>; cairam: Array<{ sku: string; nome: string; de: string; para: string }> };
  totais: { receita: number; lucro: number; estoque: number; parado: number };
}

export const QUADRANTES: Record<Quadrante, { titulo: string; cor: string; acao: string }> = {
  PROTEGER: { titulo: 'Proteger', cor: '#389e0d', acao: 'Vende bem e com margem: não deixar faltar, dar destaque' },
  REVER_PRECO: { titulo: 'Rever preço', cor: '#d48806', acao: 'Vende bem, margem baixa: renegociar compra ou subir preço' },
  DIVULGAR: { titulo: 'Divulgar', cor: '#1677ff', acao: 'Parado com margem boa: promoção, ML, redes sociais' },
  LIQUIDAR: { titulo: 'Liquidar', cor: '#cf1322', acao: 'Parado com margem baixa: queima/devolução e não recomprar' },
  ACOMPANHAR: { titulo: 'Acompanhar', cor: '#8c8c8c', acao: 'Sem destaque por enquanto' },
};

export const ondeFocarApi = {
  carregar: async (dias: number): Promise<RelatorioFoco> => {
    const r = await fetch(`${API_URL}/api/estoque/curva-abc/onde-focar?dias=${dias}`);
    const d = await r.json().catch(() => ({}));
    if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
    if (!r.ok) throw new Error(d.error || 'Erro ao montar o relatório.');
    return d;
  },
};

/** Desconto máximo (fração, para baixo em 1%) que ainda deixa a margem mínima — mesma conta do servidor (ondeFocar.ts). */
export const descontoMaximo = (preco: number, custo: number, margemMinima: number) => {
  if (!(preco > 0) || !(custo >= 0) || margemMinima >= 1) return 0;
  return Math.max(0, Math.floor((1 - custo / (1 - margemMinima) / preco) * 100) / 100);
};

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Texto de promoção (WhatsApp/redes) com os itens escolhidos. */
export const textoPromocao = (itens: ItemPropaganda[]) => {
  const e = lerConfiguracoes().empresa;
  const loja = e.nomeFantasia || e.razaoSocial || 'nossa loja';
  return [
    `🔥 *Ofertas da semana · ${loja}*`, '',
    ...itens.map(i => `• ${i.nome}${i.unidade ? ` (${i.unidade})` : ''}: de ~${brl(i.preco)}~ por *${brl(i.precoPromocao)}*`),
    '', 'Enquanto durar o estoque. Chama no WhatsApp ou passa na loja!',
  ].join('\n');
};

/** PDF do mês: resumo, quadrantes, propaganda, compras, evolução e fundos de reposição (1 a 2 páginas). */
export const htmlRelatorioFoco = (r: RelatorioFoco, fundos: ListaFundos | null) => {
  const e = lerConfiguracoes().empresa;
  const empresa = e.nomeFantasia || e.razaoSocial || '';
  const hoje = new Date().toLocaleDateString('pt-BR');
  const grupos = (Object.keys(QUADRANTES) as Quadrante[]).filter(q => q !== 'ACOMPANHAR').map(q => ({ q, cats: r.categorias.filter(c => c.quadrante === q) })).filter(g => g.cats.length);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Onde focar · ${hoje}</title><style>
    @page { size: A4; margin: 11mm; } * { box-sizing: border-box; } table, td, th { font-size: inherit; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.6px; color: #1a1a1a; margin: 0; }
    .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1a1a1a; padding-bottom: 5px; }
    h1 { font-size: 15px; margin: 0; } .emp { font-size: 8.5px; text-transform: uppercase; letter-spacing: .6px; color: #555; } .dt { font-size: 9px; color: #555; text-align: right; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 7px 0; }
    .kpi { border: 1px solid #ddd; border-radius: 4px; padding: 4px 7px; } .kpi label { font-size: 7.5px; text-transform: uppercase; color: #666; letter-spacing: .5px; } .kpi b { display: block; font-size: 13px; }
    h2 { font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; margin: 9px 0 3px; border-bottom: 1px solid #1a1a1a; padding-bottom: 2px; }
    .q { margin: 3px 0 5px; } .q .t { font-weight: 700; font-size: 10px; } .q .a { color: #555; font-size: 8.5px; }
    table { width: 100%; border-collapse: collapse; } th { text-align: left; font-size: 7.5px; text-transform: uppercase; color: #555; border-bottom: 1px solid #999; padding: 2px 4px; }
    td { padding: 2.5px 4px; border-bottom: 1px solid #e5e5e5; } .r { text-align: right; } .dois { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .aviso { color: #8a5a00; background: #fff7e6; border: 1px solid #ffd591; padding: 3px 6px; border-radius: 3px; font-size: 8.5px; margin-top: 4px; }
    .neg { color: #b42318; } .pos { color: #2b7a0b; } tr { page-break-inside: avoid; }
  </style></head><body>
    <div class="cab"><div>${empresa ? `<div class="emp">${esc(empresa)}</div>` : ''}<h1>Onde focar · relatório do mês</h1></div>
      <div class="dt">Emitido em ${hoje}<br>Período: ${r.dias} dias${r.diasDeHistorico < r.dias ? ` (vendas desde ${r.historicoDesde?.split('-').reverse().join('/')})` : ''}</div></div>
    <div class="kpis">
      <div class="kpi"><label>Faturamento</label><b>${brl0(r.totais.receita)}</b></div>
      <div class="kpi"><label>Lucro bruto</label><b>${brl0(r.totais.lucro)}</b>${r.totais.receita ? `margem ${pct(r.totais.lucro / r.totais.receita)}` : ''}</div>
      <div class="kpi"><label>Estoque (custo)</label><b>${brl0(r.totais.estoque)}</b></div>
      <div class="kpi"><label>Parado (sem venda)</label><b class="neg">${brl0(r.totais.parado)}</b>${r.totais.estoque ? `${pct(r.totais.parado / r.totais.estoque)} do estoque` : ''}</div>
    </div>
    ${r.diasDeHistorico < 60 ? `<div class="aviso">Histórico de vendas curto (${r.diasDeHistorico} dias): o que vende ainda muda muito a cada venda; o estoque parado já é confiável.</div>` : ''}
    <h2>Categorias: onde agir</h2>
    ${grupos.map(g => `<div class="q"><span class="t" style="color:${QUADRANTES[g.q].cor}">${QUADRANTES[g.q].titulo}</span> <span class="a">— ${QUADRANTES[g.q].acao}</span>
      <table><tbody>${g.cats.map(c => `<tr><td style="width:34%"><b>${esc(c.categoria)}</b></td><td class="r" style="width:13%">${brl0(c.receita)}</td>
        <td class="r" style="width:9%">${pct(c.margem ?? c.margemTabela)}</td><td class="r" style="width:13%">parado ${brl0(c.parado)}</td><td style="color:#555">${esc(c.motivo)}</td></tr>`).join('')}</tbody></table></div>`).join('')}
    <h2>Propaganda: o que divulgar (desconto respeitando a margem mínima de ${pct(r.margemMinima)})</h2>
    <table><thead><tr><th>Item</th><th class="r">Estoque</th><th class="r">Margem</th><th class="r">Preço</th><th class="r">Promoção</th><th class="r">Desc. máx.</th></tr></thead><tbody>
      ${r.propaganda.slice(0, 15).map(i => `<tr><td>${esc(i.sku)} · ${esc(i.nome)}</td><td class="r">${qtd(i.estoque)} ${esc(i.unidade || '')} (${brl0(i.valorEstoque)})</td>
        <td class="r">${pct(i.margemTabela)}</td><td class="r">${brl(i.preco)}</td><td class="r"><b>${brl(i.precoPromocao)}</b></td><td class="r">${pct(i.descontoMaximo)}</td></tr>`).join('')}
    </tbody></table>
    ${r.chamarizes.length ? `<div style="margin-top:3px"><b>Chamarizes (vitrine):</b> ${r.chamarizes.map(c => esc(c.nome)).join(' · ')}</div>` : ''}
    <div class="dois">
      <div><h2>Repor (vende e está acabando)</h2><table><tbody>${r.repor.slice(0, 12).map(i => `<tr><td>${esc(i.nome)}</td><td class="r">${qtd(i.estoque)} ${esc(i.unidade || '')}</td>
        <td class="r">${i.coberturaDias === null || i.coberturaDias === 0 ? '<b class="neg">sem estoque</b>' : `${i.coberturaDias} dias`}</td></tr>`).join('') || '<tr><td>Nada urgente.</td></tr>'}</tbody></table></div>
      <div><h2>Não recomprar</h2><table><tbody>${r.naoRecomprar.slice(0, 12).map(i => `<tr><td>${esc(i.nome)}</td><td class="r">${brl0(i.valorEstoque)}</td><td class="r">${esc(i.motivo)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    ${r.evolucao.mesAnterior ? `<h2>Desde ${r.evolucao.mesAnterior.split('-').reverse().join('/')}</h2>
      <div><b class="pos">Subiram para A:</b> ${r.evolucao.subiram.map(x => esc(x.nome)).join(' · ') || '—'}</div>
      <div><b class="neg">Caíram de A:</b> ${r.evolucao.cairam.map(x => `${esc(x.nome)} (${x.para})`).join(' · ') || '—'}</div>` : ''}
    ${fundos && fundos.fundos.length ? `<h2>Fundos de reposição (fora do capital de giro): ${brl(fundos.totalSeparado)}</h2>
      <table><thead><tr><th>Fundo</th><th class="r">Deveria ter</th><th class="r">Estoque</th><th class="r">Cobre</th><th class="r">Mês: entrou</th><th class="r">Mês: saiu</th></tr></thead><tbody>
      ${fundos.fundos.filter(f => f.ativo).map(f => `<tr><td><b>${esc(f.nome)}</b></td><td class="r ${f.resumo.saldo < 0 ? 'neg' : ''}">${brl(f.resumo.saldo)}</td><td class="r">${brl0(f.resumo.estoque)}</td>
        <td class="r">${f.resumo.cobertura === null ? '—' : pct(f.resumo.cobertura)}</td><td class="r">${brl(f.resumo.entradasMes)}</td><td class="r">${brl(f.resumo.comprasMes)}</td></tr>`).join('')}
      </tbody></table>` : ''}
  </body></html>`;
};

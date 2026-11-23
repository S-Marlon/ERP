// Romaneio do pedido faturado: folha A4 para separar, conferir e entregar o material (com assinatura de quem recebe).
// Sem valores (vai com o motorista) ou com valores (via do cliente). Kit sai com os componentes, que são o que se separa.
// Puro, com teste.
import type { DadosEmpresa } from '../../../shared/core/configuracoes/configuracoes';
import { formatarDocumento, formatarTelefone } from '../../../shared/formularios/documentos';
import type { PedidoFaturadoDetalhe } from './pedidosFaturadosApi';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (s: string | null | undefined) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');

export interface LinhaRomaneio { n: string; sku: string; nome: string; local: string | null; unidade: string; quantidade: number; preco: number | null; total: number | null; componente: boolean }

/** Linhas da folha: serviço fica de fora (não se separa); kit vem seguido dos componentes (1.1, 1.2...) com a quantidade total. */
export const linhasDoRomaneio = (itens: PedidoFaturadoDetalhe['itens']): LinhaRomaneio[] => {
  const linhas: LinhaRomaneio[] = [];
  let k = 0;
  for (const i of itens) {
    if (i.servico) continue;
    k += 1;
    linhas.push({ n: String(k), sku: i.sku, nome: i.nome, local: i.localizacao ?? null, unidade: i.unidade || '', quantidade: i.quantidade, preco: i.precoUnitario, total: i.total, componente: false });
    i.componentes.forEach((c, j) => linhas.push({
      n: `${k}.${j + 1}`, sku: '', nome: c.nome, local: c.localizacao ?? null, unidade: '', quantidade: c.quantidade * (i.quantidadeBase || i.quantidade), preco: null, total: null, componente: true,
    }));
  }
  return linhas;
};

export const htmlRomaneio = (d: PedidoFaturadoDetalhe, e: Partial<DadosEmpresa>, opcoes: { comValores?: boolean } = {}) => {
  const empresa = e.nomeFantasia || e.razaoSocial || '';
  const linhas = linhasDoRomaneio(d.itens);
  const comValores = !!opcoes.comValores;
  const enderecoLoja = [e.logradouro && `${e.logradouro}${e.numero ? `, ${e.numero}` : ''}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ''}`].filter(Boolean).join(' · ');
  // CEP do cadastro vem só com números: 13300000 → 13300-000
  const entrega = (d.enderecoEntrega || d.clienteDados?.endereco || '').replace(/(^|\D)(\d{5})(\d{3})(?!\d)/g, '$1$2-$3');
  const nota = d.nota && d.nota.numero ? `${d.nota.numero}${d.nota.serie ? ` · série ${d.nota.serie}` : ''}` : '';
  const principais = linhas.filter(l => !l.componente);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Romaneio · pedido ${d.id}</title><style>
    @page { size: A4; margin: 10mm 10mm 12mm; }
    * { box-sizing: border-box; } table, td, th { font-size: inherit; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; }
    .cab { display: grid; grid-template-columns: 1fr auto; border: 1.2px solid #1a1a1a; }
    .cab .tit { padding: 6px 9px; } .cab h1 { font-size: 14px; margin: 0; letter-spacing: .2px; }
    .cab .emp { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 1px; }
    .cab .sub { font-size: 8.5px; color: #555; margin-top: 2px; }
    .cab .num { background: #1a1a1a; color: #fff; padding: 5px 14px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
    .cab .num b { font-size: 20px; line-height: 1; } .cab .num span { font-size: 8px; text-transform: uppercase; letter-spacing: .8px; opacity: .8; }
    .grade { display: grid; border: 1.2px solid #1a1a1a; border-top: 0; }
    .g4 { grid-template-columns: repeat(4, 1fr); } .g2 { grid-template-columns: 1.3fr 1fr; }
    .grade > div { padding: 3px 9px 4px; border-right: 1px solid #ccc; min-height: 26px; } .grade > div:last-child { border-right: 0; }
    label { display: block; font-size: 7.5px; text-transform: uppercase; letter-spacing: .6px; color: #666; }
    .forte { font-weight: 700; font-size: 11px; }
    .obs { border: 1.2px solid #1a1a1a; border-top: 0; padding: 3px 9px 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; } thead { display: table-header-group; } tr { page-break-inside: avoid; }
    th { font-size: 7.8px; text-transform: uppercase; letter-spacing: .5px; color: #fff; background: #1a1a1a; padding: 3.5px 5px; text-align: left; font-weight: 600; }
    td { padding: 3.5px 5px; border-bottom: 1px solid #ddd; vertical-align: middle; line-height: 1.25; }
    tbody tr.item:nth-child(even) td { background: #f6f6f6; }
    tr.comp td { color: #444; font-size: 9px; padding-top: 2px; padding-bottom: 2px; } tr.comp .nome { font-weight: 400; padding-left: 14px; }
    .n { color: #888; width: 24px; } .cod { width: 1%; white-space: nowrap; font-family: Consolas, monospace; font-size: 9.2px; }
    .nome { font-weight: 600; } .loc { color: #777; font-size: 8px; font-weight: 400; }
    .un { width: 30px; color: #555; } .q { width: 56px; text-align: right; font-weight: 700; font-size: 11px; } .r { text-align: right; white-space: nowrap; }
    .ok { width: 30px; text-align: center; }
    .bx { display: inline-block; width: 12px; height: 12px; border: 1.1px solid #333; border-radius: 2px; vertical-align: middle; }
    .tot { display: flex; justify-content: space-between; gap: 12px; margin-top: 5px; font-size: 9.5px; }
    .tot b { font-size: 11px; } .vol { display: inline-block; width: 60px; border-bottom: 1px solid #555; }
    .ass { display: grid; grid-template-columns: 1fr 1fr 1fr; margin-top: 10px; border: 1.2px solid #1a1a1a; page-break-inside: avoid; }
    .ass > div { padding: 20px 9px 4px; border-right: 1px solid #ccc; font-size: 7.5px; text-transform: uppercase; letter-spacing: .6px; color: #666; }
    .ass > div:last-child { border-right: 0; } .ass > div::before { content: ''; display: block; border-bottom: 1px solid #555; margin-bottom: 3px; }
    .receb { margin-top: 8px; border: 1.2px solid #1a1a1a; page-break-inside: avoid; }
    .receb .dec { padding: 4px 9px; font-size: 9px; border-bottom: 1px solid #ccc; }
    .receb .cps { display: grid; grid-template-columns: 1.4fr 1fr .8fr 1.4fr; }
    .receb .cps > div { padding: 22px 9px 4px; border-right: 1px solid #ccc; font-size: 7.5px; text-transform: uppercase; letter-spacing: .6px; color: #666; }
    .receb .cps > div:last-child { border-right: 0; } .receb .cps > div::before { content: ''; display: block; border-bottom: 1px solid #555; margin-bottom: 3px; }
    .rodape { margin-top: 5px; font-size: 7.5px; color: #888; display: flex; justify-content: space-between; }
  </style></head><body>
    <div class="cab">
      <div class="tit">${empresa ? `<div class="emp">${esc(empresa)}</div>` : ''}<h1>Romaneio de entrega${comValores ? ' · via do cliente' : ''}</h1>
        <div class="sub">${esc([e.cnpj && `CNPJ ${formatarDocumento(e.cnpj)}`, e.telefone && formatarTelefone(e.telefone), enderecoLoja].filter(Boolean).join(' · '))}</div></div>
      <div class="num"><span>Pedido</span><b>${d.id}</b></div>
    </div>
    <div class="grade g4">
      <div><label>Emitido</label>${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
      <div><label>Previsão de entrega</label><span class="forte">${dataBr(d.previsaoEntrega) || '—'}</span></div>
      <div><label>Pedido do cliente</label>${esc(d.pedidoCliente || '—')}</div>
      <div><label>Nota fiscal</label>${esc(nota || '—')}</div>
    </div>
    <div class="grade g2">
      <div><label>Cliente</label><span class="forte">${esc(d.cliente)}</span>
        ${d.clienteDados?.documento ? `<br>${esc(formatarDocumento(d.clienteDados.documento))}` : ''}
        ${[d.contato && `Contato: ${d.contato}`, d.clienteDados?.telefone && formatarTelefone(d.clienteDados.telefone)].filter(Boolean).length
          ? `<br>${esc([d.contato && `Contato: ${d.contato}`, d.clienteDados?.telefone && formatarTelefone(d.clienteDados.telefone)].filter(Boolean).join(' · '))}` : ''}</div>
      <div><label>Endereço de entrega</label>${entrega ? esc(entrega) : '<b>Retira na loja</b>'}</div>
    </div>
    ${d.observacao ? `<div class="obs"><label>Observação</label>${esc(d.observacao)}</div>` : ''}
    <table><thead><tr><th>#</th><th>Código</th><th>Produto</th><th>Un</th><th style="text-align:right">Qtd</th>
      ${comValores ? '<th style="text-align:right">Preço</th><th style="text-align:right">Total</th>' : ''}
      <th style="text-align:center">Separ.</th><th style="text-align:center">Conf.</th></tr></thead><tbody>
      ${linhas.map(l => `<tr class="${l.componente ? 'comp' : 'item'}"><td class="n">${l.n}</td><td class="cod">${esc(l.sku)}</td>
        <td><span class="nome">${l.componente ? '↳ ' : ''}${esc(l.nome)}</span>${l.local ? ` <span class="loc">· ${esc(l.local)}</span>` : ''}</td>
        <td class="un">${esc(l.unidade)}</td><td class="q">${qtd(l.quantidade)}</td>
        ${comValores ? `<td class="r">${l.preco !== null ? brl(l.preco) : ''}</td><td class="r">${l.total !== null ? brl(l.total) : ''}</td>` : ''}
        <td class="ok"><span class="bx"></span></td><td class="ok"><span class="bx"></span></td></tr>`).join('')}
    </tbody></table>
    <div class="tot"><span>${principais.length} ${principais.length === 1 ? 'item' : 'itens'}${linhas.length > principais.length ? ` (kits com ${linhas.length - principais.length} componentes)` : ''}</span>
      <span>Volumes: <span class="vol"></span></span>
      ${comValores ? `<span>Total do pedido: <b>${brl(d.total)}</b>${d.condicaoPagamento ? ` · ${esc(d.condicaoPagamento)}` : ''}</span>` : ''}</div>
    <div class="ass"><div>Separado por</div><div>Conferido por</div><div>Entregue por (motorista)</div></div>
    <div class="receb">
      <div class="dec">Recebi as mercadorias acima, nas quantidades indicadas e em perfeito estado.</div>
      <div class="cps"><div>Nome legível de quem recebeu</div><div>Documento (RG/CPF)</div><div>Data e hora</div><div>Assinatura</div></div>
    </div>
    <div class="rodape"><span>Depois da entrega, registre em Vendas › Pedidos faturados › Pedido ${d.id} (quem recebeu).</span><span>${esc(d.operador || '')}</span></div>
  </body></html>`;
};

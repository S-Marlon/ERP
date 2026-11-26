// Impressão do orçamento (HTML A4) no modelo da empresa, a partir de modeloOrcamento: cabeçalho, "ORÇAMENTO", cliente,
// seções numeradas com a tabela azul-marinho e o subtotal, TOTAL GERAL e as condições. O PDF (orcamentoPdf) desenha o mesmo.
import type { ModeloOrcamento } from './modeloOrcamento';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const htmlOrcamento = (m: ModeloOrcamento) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento ${m.numero}</title><style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #222; margin: 0; }
  @media screen { body { max-width: 210mm; margin: 0 auto; padding: 16mm 15mm; } }
  .marca { color: #1f3a5f; font-size: 13pt; font-weight: bold; }
  .emp { font-size: 8.5pt; color: #555; line-height: 1.35; }
  hr.topo { border: 0; border-top: 1.2pt solid #1f3a5f; margin: 9pt 0 14pt; }
  h1 { color: #1f3a5f; font-size: 24pt; margin: 0; letter-spacing: .3pt; }
  .meta { font-size: 9.5pt; margin: 3pt 0 8pt; } .meta .num { color: #1f3a5f; font-weight: bold; }
  .cli { font-size: 10pt; margin-bottom: 14pt; }
  h2 { color: #1f3a5f; font-size: 11.5pt; margin: 14pt 0 5pt; break-after: avoid; }
  table.itens { width: 100%; border-collapse: collapse; font-size: 9.5pt; break-inside: auto; table-layout: fixed; }
  table.itens th { background: #1f3a5f; color: #fff; text-align: left; padding: 6pt 7pt; font-weight: bold; }
  table.itens td { padding: 6pt 7pt; border-bottom: 1px solid #e3e7ec; vertical-align: top; }
  table.itens tr:nth-child(even) td { background: #f3f6f9; }
  table.itens .r { text-align: right; white-space: nowrap; } table.itens td.c { color: #444; }
  table.itens th.c { color: #fff; }
  table.itens tr.sub td { background: #fff !important; border-bottom: 0; font-weight: bold; }
  .extra { font-size: 8pt; color: #666; margin-top: 1pt; }
  tr { break-inside: avoid; }
  .totais { margin-top: 12pt; border-top: 1.2pt solid #1f3a5f; padding-top: 6pt; break-inside: avoid; }
  .totais div { display: flex; justify-content: flex-end; gap: 28pt; padding: 2pt 0; font-size: 10pt; }
  .totais div span:last-child { min-width: 95pt; text-align: right; }
  .totais .destaque { color: #1f3a5f; font-size: 13pt; font-weight: bold; padding-top: 4pt; }
  .totais .secundario { color: #666; font-size: 9pt; }
  .cond { margin-top: 18pt; font-size: 10pt; line-height: 1.5; break-inside: avoid; } .cond b.t { display: block; margin-bottom: 2pt; }
</style></head><body>
  <div class="marca">${esc(m.empresa.nome)}</div>
  <div class="emp">${m.empresa.razao ? `${esc(m.empresa.razao)}<br>` : ''}${m.empresa.documentos ? `${esc(m.empresa.documentos)}<br>` : ''}${esc(m.empresa.endereco)}${m.empresa.contato ? `<br>${esc(m.empresa.contato)}` : ''}</div>
  <hr class="topo">
  <h1>${esc(m.titulo)}</h1>
  <div class="meta"><span class="num">Nº ${m.numero}</span> &nbsp;|&nbsp; Data: ${esc(m.data)}${m.validade ? ` &nbsp;|&nbsp; Validade: ${esc(m.validade)}` : ''}</div>
  <div class="cli">Cliente: <b>${esc(m.cliente)}</b>${m.contato ? ` &nbsp;·&nbsp; Contato: ${esc(m.contato)}` : ''}${m.atendente ? ` &nbsp;·&nbsp; Atendente: ${esc(m.atendente)}` : ''}</div>
  ${m.secoes.map(s => `
    <h2>${s.numero}. ${esc(s.titulo)}</h2>
    <table class="itens"><colgroup><col style="width:24pt"><col><col style="width:42pt"><col style="width:30pt"><col style="width:78pt"><col style="width:84pt"></colgroup><thead><tr><th class="c">#</th><th>Descrição</th><th class="r">Qtd</th><th>Un</th><th class="r">Valor unit.</th><th class="r">Total</th></tr></thead><tbody>
      ${s.linhas.map(l => `<tr><td class="c">${l.n}</td><td>${esc(l.descricao)}${l.extras.map(x => `<div class="extra">${esc(x)}</div>`).join('')}</td>
        <td class="r">${esc(l.qtd)}</td><td>${esc(l.un)}</td><td class="r">${esc(l.unitario)}</td><td class="r">${esc(l.total)}</td></tr>`).join('')}
      <tr class="sub"><td></td><td></td><td></td><td></td><td class="r">Subtotal</td><td class="r">${esc(s.subtotal)}</td></tr>
    </tbody></table>`).join('')}
  <div class="totais">
    ${m.totais.map(t => `<div class="${t.destaque ? 'destaque' : t.secundario ? 'secundario' : ''}"><span>${esc(t.rotulo)}</span><span>${esc(t.valor)}</span></div>`).join('')}
  </div>
  <div class="cond"><b class="t">Condições</b>${m.condicoes.map(c => `${esc(c.rotulo)}: ${esc(c.valor)}`).join('<br>')}</div>
</body></html>`;

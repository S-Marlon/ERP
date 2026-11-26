// Impressão do orçamento (HTML A4) no modelo da empresa, compacta para caber numa folha: cabeçalho, "ORÇAMENTO" com
// data e validade, cliente, uma tabela só (cabeçalho azul-marinho uma vez; cada categoria é uma faixa fina com o número,
// o nome e o subtotal), TOTAL GERAL e as condições. O PDF (orcamentoPdf) desenha o mesmo a partir de modeloOrcamento.
import type { ModeloOrcamento } from './modeloOrcamento';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const htmlOrcamento = (m: ModeloOrcamento) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento ${m.numero}</title><style>
  @page { size: A4; margin: 12mm 13mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #222; margin: 0; }
  @media screen { body { max-width: 210mm; margin: 0 auto; padding: 12mm 13mm; } }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; gap: 12pt; border-bottom: 1.2pt solid #1f3a5f; padding-bottom: 5pt; margin-bottom: 7pt; }
  .marca { color: #1f3a5f; font-size: 12pt; font-weight: bold; }
  .emp { font-size: 7.8pt; color: #555; line-height: 1.3; }
  .doc { text-align: right; } .doc h1 { color: #1f3a5f; font-size: 17pt; margin: 0; line-height: 1; }
  .doc .meta { font-size: 8.5pt; margin-top: 2pt; } .doc .num { color: #1f3a5f; font-weight: bold; }
  .cli { font-size: 9pt; margin-bottom: 6pt; }
  table.itens { width: 100%; border-collapse: collapse; font-size: 8.8pt; table-layout: fixed; }
  table.itens th { background: #1f3a5f; color: #fff; text-align: left; padding: 3.5pt 5pt; font-weight: bold; font-size: 8.3pt; }
  table.itens td { padding: 2.6pt 5pt; border-bottom: 1px solid #e8ebef; vertical-align: top; }
  table.itens .r { text-align: right; white-space: nowrap; } table.itens td.c { color: #666; }
  table.itens tr.cat td { background: #eef2f6; color: #1f3a5f; font-weight: bold; font-size: 8.3pt; padding: 2.2pt 5pt; border-bottom: 1px solid #d5dde6; }
  .extra { font-size: 7.5pt; color: #666; }
  tr { break-inside: avoid; }
  .fim { display: flex; justify-content: space-between; gap: 16pt; margin-top: 7pt; break-inside: avoid; }
  .cond { font-size: 8.5pt; line-height: 1.4; flex: 1; } .cond b.t { display: block; color: #1f3a5f; }
  .totais { min-width: 200pt; border-top: 1.2pt solid #1f3a5f; padding-top: 3pt; }
  .totais div { display: flex; justify-content: space-between; gap: 14pt; padding: 1pt 0; font-size: 9pt; }
  .totais .destaque { color: #1f3a5f; font-size: 11.5pt; font-weight: bold; }
  .totais .secundario { color: #666; font-size: 8pt; }
</style></head><body>
  <div class="topo">
    <div>
      <div class="marca">${esc(m.empresa.nome)}</div>
      <div class="emp">${[m.empresa.razao, m.empresa.documentos, m.empresa.endereco, m.empresa.contato].filter(Boolean).map(esc).join('<br>')}</div>
    </div>
    <div class="doc">
      <h1>${esc(m.titulo)}</h1>
      <div class="meta"><span class="num">Nº ${m.numero}</span> · ${esc(m.data)}${m.validade ? ` · Validade: ${esc(m.validade)}` : ''}</div>
    </div>
  </div>
  <div class="cli">Cliente: <b>${esc(m.cliente)}</b>${m.contato ? ` · Contato: ${esc(m.contato)}` : ''}${m.atendente ? ` · Atendente: ${esc(m.atendente)}` : ''}</div>
  <table class="itens">
    <colgroup><col style="width:20pt"><col><col style="width:38pt"><col style="width:26pt"><col style="width:68pt"><col style="width:74pt"></colgroup>
    <thead><tr><th>#</th><th>Descrição</th><th class="r">Qtd</th><th>Un</th><th class="r">Valor unit.</th><th class="r">Total</th></tr></thead>
    <tbody>
      ${m.secoes.map(s => `
        ${m.secoes.length > 1 ? `<tr class="cat"><td colspan="5">${s.numero}. ${esc(s.titulo)}</td><td class="r">${esc(s.subtotal)}</td></tr>` : ''}
        ${s.linhas.map(l => `<tr><td class="c">${l.n}</td><td>${esc(l.descricao)}${l.extras.map(x => `<div class="extra">${esc(x)}</div>`).join('')}</td>
          <td class="r">${esc(l.qtd)}</td><td>${esc(l.un)}</td><td class="r">${esc(l.unitario)}</td><td class="r">${esc(l.total)}</td></tr>`).join('')}`).join('')}
    </tbody>
  </table>
  <div class="fim">
    <div class="cond"><b class="t">Condições</b>${m.condicoes.map(c => `${esc(c.rotulo)}: ${esc(c.valor)}`).join('<br>')}</div>
    <div class="totais">
      ${m.totais.map(t => `<div class="${t.destaque ? 'destaque' : t.secundario ? 'secundario' : ''}"><span>${esc(t.rotulo)}</span><span>${esc(t.valor)}</span></div>`).join('')}
    </div>
  </div>
</body></html>`;

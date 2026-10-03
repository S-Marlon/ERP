// OS de montagem em A4: dados da empresa, cliente, cada mangueira com a ficha e os materiais, sinal e saldo.
import { lerConfiguracoes } from '../../../core/configuracoes/configuracoes';
import { imprimirHtml } from '../../../core/impressao/saida';
import { ETAPAS_OS, OsDetalhe } from './montagensApi';

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export const imprimirOs = (os: OsDetalhe) => {
  const e = lerConfiguracoes().empresa;
  const nome = e.nomeFantasia || e.razaoSocial || 'Ordem de serviço';
  const linhaItens = (itens: OsDetalhe['itensAvulsos']) => itens.map(i => `<tr><td>${esc(i.descricao)}</td><td class="r">${i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${esc(i.unidade || '')}</td><td class="r">${brl(i.precoUnitario)}</td><td class="r">${brl(i.total || 0)}</td></tr>`).join('');
  const ficha = (m: OsDetalhe['mangueiras'][number]) => [
    m.posicao && `<b>Posição:</b> ${esc(m.posicao)}`, m.bitola && `<b>Bitola:</b> ${esc(m.bitola)}`,
    m.comprimentoM && `<b>Comprimento:</b> ${String(m.comprimentoM).replace('.', ',')} m`, `<b>Peças:</b> ${m.quantidade || 1}`,
    m.terminalA && `<b>Terminal A:</b> ${esc(m.terminalA)}`, m.terminalB && `<b>Terminal B:</b> ${esc(m.terminalB)}`,
    m.angulo && `<b>Ângulo:</b> ${esc(m.angulo)}`, m.pressaoTrabalho && `<b>Pressão:</b> ${esc(m.pressaoTrabalho)}`,
    m.observacao && `<b>Obs.:</b> ${esc(m.observacao)}`,
  ].filter(Boolean).join(' · ');
  const html = `<html><head><meta charset="utf-8"><title>OS ${os.idOs}</title><style>
    @page { size: A4; margin: 12mm; } body { font-family: Arial, sans-serif; font-size: 11.5px; color: #222; }
    .topo { display: flex; justify-content: space-between; border-bottom: 2px solid #1677ff; padding-bottom: 6px; margin-bottom: 10px; }
    h1 { margin: 0; font-size: 17px; } .num { text-align: right; } .num b { font-size: 18px; color: #1677ff; }
    .bloco { border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; margin-top: 8px; } .bloco h3 { margin: 0 0 4px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; } th { background: #f0f5ff; text-align: left; }
    th, td { padding: 3px 5px; border-bottom: 1px solid #eee; } .r { text-align: right; }
    .totais { width: 300px; margin-left: auto; margin-top: 10px; } .totais td { border: 0; } .total { font-weight: bold; font-size: 14px; }
    .ass { margin-top: 40px; display: flex; gap: 40px; } .ass div { flex: 1; border-top: 1px solid #333; text-align: center; padding-top: 3px; }
  </style></head><body>
    <div class="topo">
      <div><h1>${esc(nome)}</h1><div>${esc([e.cnpj && `CNPJ ${e.cnpj}`, e.telefone, e.email].filter(Boolean).join(' · '))}</div></div>
      <div class="num">ORDEM DE SERVIÇO<br><b>Nº ${os.idOs}</b><br>${ETAPAS_OS[os.status].label} · aberta em ${dataBr(os.criadoEm)}${os.previsao ? `<br>Previsão: <b>${dataBr(os.previsao)}</b>` : ''}</div>
    </div>
    <div><b>Cliente:</b> ${esc(os.cliente)}${os.contato ? ` · <b>Contato:</b> ${esc(os.contato)}` : ''}${os.equipamento ? ` · <b>Equipamento:</b> ${esc(os.equipamento)}` : ''}</div>
    ${os.observacao ? `<div style="margin-top:4px"><b>Observações:</b> ${esc(os.observacao)}</div>` : ''}
    ${os.mangueiras.map((m, i) => `<div class="bloco"><h3>Mangueira ${i + 1}${m.equipamento ? ` · ${esc(m.equipamento)}` : ''}</h3><div>${ficha(m)}</div>
      ${m.itens.length ? `<table><thead><tr><th>Material</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead><tbody>${linhaItens(m.itens)}</tbody></table>` : ''}</div>`).join('')}
    ${os.itensAvulsos.length ? `<div class="bloco"><h3>Outros itens</h3><table><thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead><tbody>${linhaItens(os.itensAvulsos)}</tbody></table></div>` : ''}
    <table class="totais">
      <tr class="total"><td>Total</td><td class="r">${brl(os.total)}</td></tr>
      ${os.sinalAberto > 0 ? `<tr><td>Sinal recebido</td><td class="r">- ${brl(os.sinalAberto)}</td></tr><tr class="total"><td>A pagar na entrega</td><td class="r">${brl(os.saldoAPagar)}</td></tr>` : ''}
    </table>
    <div class="ass"><div>Cliente</div><div>Responsável</div></div>
  </body></html>`;
  return imprimirHtml(html);
};

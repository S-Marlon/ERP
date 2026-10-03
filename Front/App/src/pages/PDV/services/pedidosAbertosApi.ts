// Orçamentos e vendas suspensas (/api/vendas/pdv/pedidos-abertos)
import { operadorAtual } from '../caixa/caixaApi';
import { lerConfiguracoes } from '../../../core/configuracoes/configuracoes';
import { imprimirHtml } from '../../../core/impressao/saida';

const API = 'http://localhost:3001/api/vendas/pdv/pedidos-abertos';

export type TipoPedidoAberto = 'ORCAMENTO' | 'SUSPENSA';
export type SituacaoPedido = 'VALIDO' | 'VENCIDO' | 'CONVERTIDO' | 'SUSPENSA';

export interface PedidoAbertoResumo {
  id: number; tipo: TipoPedidoAberto; situacao: SituacaoPedido; cliente: string; idCliente: number | null; contato: string | null;
  operador: string | null; total: number; custo: number; observacao: string | null; criadoEm: string; validade: string | null;
  qtdItens: number; idVendaGerada: number | null;
}

export interface ItemPedidoAberto {
  idItem: number; sku: string; nome: string; idUnidade: number | null; unidade: string | null; quantidade: number;
  precoTabela: number; precoUnitario: number; desconto: number; total: number;
}

export interface PedidoAbertoDetalhe {
  id: number; tipo: TipoPedidoAberto; situacao: SituacaoPedido; cliente: string; idCliente: number | null; contato: string | null;
  operador: string | null; observacao: string | null; validade: string | null; criadoEm: string;
  totalBruto: number; totalDesconto: number; total: number; itens: ItemPedidoAberto[];
}

export interface NovoPedidoAberto {
  tipo: TipoPedidoAberto;
  itens: Array<{ idItem: number; quantidade: number; idUnidade?: number | null; precoUnitario?: number }>;
  clienteNome?: string; idCliente?: number | null; contato?: string; observacao?: string; validadeDias?: number;
}

const pedir = async <T,>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || erro);
  return d as T;
};

export const pedidosAbertosApi = {
  salvar: (dados: NovoPedidoAberto) => pedir<{ id: number; tipo: TipoPedidoAberto; totalLiquido: number }>(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, operador: operadorAtual() }),
  }, 'Erro ao salvar.'),
  listar: (tipo: TipoPedidoAberto, situacao = 'ABERTOS', busca = '') =>
    pedir<PedidoAbertoResumo[]>(`${API}?${new URLSearchParams({ tipo, situacao, busca })}`, undefined, 'Erro ao listar.'),
  detalhe: (id: number) => pedir<PedidoAbertoDetalhe>(`${API}/${id}`, undefined, 'Erro ao carregar.'),
  retomar: (id: number) => pedir<PedidoAbertoDetalhe>(`${API}/${id}/retomar`, { method: 'POST' }, 'Erro ao retomar.'),
  excluir: (id: number) => pedir<{ success: boolean }>(`${API}/${id}`, { method: 'DELETE' }, 'Erro ao excluir.'),
};

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Orçamento em A4 com os dados da empresa (Configurações › Dados da empresa). */
export const imprimirOrcamento = (o: PedidoAbertoDetalhe) => {
  const e = lerConfiguracoes().empresa;
  const nomeEmpresa = e.nomeFantasia || e.razaoSocial || 'Orçamento';
  const endereco = [e.logradouro && `${e.logradouro}${e.numero ? `, ${e.numero}` : ''}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ''}`].filter(Boolean).join(' · ');
  const html = `<html><head><meta charset="utf-8"><title>Orçamento ${o.id}</title><style>
    @page { size: A4; margin: 14mm; } body { font-family: Arial, sans-serif; font-size: 12px; color: #222; }
    .topo { display: flex; justify-content: space-between; border-bottom: 2px solid #1677ff; padding-bottom: 8px; margin-bottom: 12px; }
    .topo h1 { margin: 0; font-size: 18px; } .num { text-align: right; } .num b { font-size: 18px; color: #1677ff; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; } th { background: #f0f5ff; text-align: left; }
    th, td { padding: 5px 6px; border-bottom: 1px solid #e5e5e5; } .r { text-align: right; }
    .totais { margin-top: 10px; width: 280px; margin-left: auto; } .totais td { border: 0; padding: 2px 6px; }
    .total { font-size: 16px; font-weight: bold; } .obs { margin-top: 14px; padding: 8px; background: #fafafa; border-radius: 4px; }
    .rodape { margin-top: 28px; font-size: 11px; color: #666; }
  </style></head><body>
    <div class="topo">
      <div><h1>${esc(nomeEmpresa)}</h1>
        <div>${esc([e.cnpj && `CNPJ ${e.cnpj}`, e.telefone, e.email].filter(Boolean).join(' · '))}</div>
        <div>${esc(endereco)}</div></div>
      <div class="num">ORÇAMENTO<br><b>Nº ${o.id}</b><br>Emitido em ${dataBr(String(o.criadoEm))}<br><b style="font-size:12px;color:#222">Válido até ${dataBr(o.validade)}</b></div>
    </div>
    <div><b>Cliente:</b> ${esc(o.cliente)}${o.contato ? ` · <b>Contato:</b> ${esc(o.contato)}` : ''}${o.operador ? ` · <b>Atendente:</b> ${esc(o.operador)}` : ''}</div>
    <table><thead><tr><th>Código</th><th>Descrição</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Total</th></tr></thead><tbody>
      ${o.itens.map(i => `<tr><td>${esc(i.sku)}</td><td>${esc(i.nome)}</td><td class="r">${i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${esc(i.unidade || '')}</td>
        <td class="r">${brl(i.precoUnitario)}</td><td class="r">${brl(i.total)}</td></tr>`).join('')}
    </tbody></table>
    <table class="totais">
      ${o.totalDesconto > 0 ? `<tr><td>Subtotal</td><td class="r">${brl(o.totalBruto)}</td></tr><tr><td>Desconto</td><td class="r">- ${brl(o.totalDesconto)}</td></tr>` : ''}
      <tr class="total"><td>Total</td><td class="r">${brl(o.total)}</td></tr>
    </table>
    ${o.observacao ? `<div class="obs"><b>Observações:</b> ${esc(o.observacao)}</div>` : ''}
    <div class="rodape">Preços válidos até ${dataBr(o.validade)}, sujeitos à disponibilidade de estoque. Formas de pagamento a combinar no fechamento.</div>
  </body></html>`;
  return imprimirHtml(html);
};

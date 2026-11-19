// Orçamentos e vendas suspensas (/api/vendas/pdv/pedidos-abertos)
import { operadorAtual } from '../../caixa/caixaApi';
import { lerConfiguracoes } from '../../../../shared/core/configuracoes/configuracoes';
import { imprimirHtml } from '../../../../shared/core/impressao/saida';
import { API_URL } from '../../../../shared/api/config';
import { codigoCliente, secoesDaProposta } from '../../negociacao/propostaNegociacao';
import type { CondicaoPagamento } from '../../negociacao/condicaoPagamento';

const API = `${API_URL}/api/vendas/pdv/pedidos-abertos`;

export type TipoPedidoAberto = 'ORCAMENTO' | 'SUSPENSA';
export type SituacaoPedido = 'VALIDO' | 'VENCIDO' | 'CONVERTIDO' | 'SUSPENSA';

export interface PedidoAbertoResumo {
  id: number; tipo: TipoPedidoAberto; situacao: SituacaoPedido; cliente: string; idCliente: number | null; contato: string | null;
  operador: string | null; total: number; custo: number; observacao: string | null; criadoEm: string; validade: string | null;
  qtdItens: number; idVendaGerada: number | null;
  /** O orçamento virou pedido faturado (Vendas › Pedidos faturados), não venda de balcão. */
  virouPedido?: boolean;
}

export interface ItemPedidoAberto {
  idItem: number; sku: string; nome: string; idUnidade: number | null; unidade: string | null; quantidade: number;
  precoTabela: number; precoUnitario: number; desconto: number; total: number;
  componentes?: Array<{ slot: number; idItem: number; quantidade: number }>;
  /** Negociação: unidade base (preço por L, kg, m...), categoria (seções da proposta), custo, item travado e faixas. */
  fator?: number; siglaBase?: string | null; categoria?: string | null; custoUnitarioBase?: number; travado?: boolean;
  faixas?: Array<{ quantidadeMinima: number; precoUnitario: number }>;
}

export interface PedidoAbertoDetalhe {
  id: number; tipo: TipoPedidoAberto; situacao: SituacaoPedido; cliente: string; idCliente: number | null; contato: string | null;
  operador: string | null; observacao: string | null; validade: string | null; criadoEm: string;
  totalBruto: number; totalDesconto: number; total: number; itens: ItemPedidoAberto[];
  /** Orçamento de negociação (null = orçamento comum). */
  margemAlvo?: number | null; condicaoPagamento?: string | null; autorizadoPor?: string | null;
  /** Condição em campos (null = a combinar ou só o texto). */
  condicao?: CondicaoPagamento | null;
  /** Telefone principal do cliente cadastrado (só no detalhe). */
  telefoneCliente?: string | null;
}

export interface NovoPedidoAberto {
  tipo: TipoPedidoAberto;
  itens: Array<{ idItem: number; quantidade: number; idUnidade?: number | null; precoUnitario?: number; componentes?: Array<{ slot: number; idItem: number; quantidade: number }> }>;
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
  /** Liga o orçamento (ou venda suspensa) a um cliente do cadastro. */
  definirCliente: (id: number, idCliente: number) => pedir<{ success: boolean; idCliente: number; cliente: string }>(`${API}/${id}/cliente`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idCliente }),
  }, 'Erro ao definir o cliente.'),
};

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Orçamento em A4 com os dados da empresa (Configurações › Dados da empresa). */
export const imprimirOrcamento = (o: PedidoAbertoDetalhe) => {
  if (o.margemAlvo !== null && o.margemAlvo !== undefined) return imprimirHtml(htmlProposta(o));
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

/** Proposta comercial do orçamento de negociação: seções por categoria, preço por unidade base, faixas e condições. */
export const htmlProposta = (o: PedidoAbertoDetalhe) => {
  const e = lerConfiguracoes().empresa;
  const nomeEmpresa = e.nomeFantasia || e.razaoSocial || 'Proposta comercial';
  const endereco = [e.logradouro && `${e.logradouro}${e.numero ? `, ${e.numero}` : ''}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ''}`].filter(Boolean).join(' · ');
  const codigo = codigoCliente(o.idCliente);
  const secoes = secoesDaProposta(o);
  return `<html><head><meta charset="utf-8"><title>Proposta ${o.id}</title><style>
    @page { size: A4; margin: 12mm; } body { font-family: Arial, sans-serif; font-size: 11.5px; color: #222; }
    .faixa { background: #1f1f1f; color: #fa8c16; text-align: center; font-size: 17px; font-weight: bold; padding: 9px; margin: 6px 0 12px; letter-spacing: .3px; }
    .caixas { display: flex; gap: 16px; background: #f5f5f5; padding: 10px 12px; } .caixas > div { flex: 1; }
    .caixas b.t { color: #d4380d; font-size: 11px; display: block; margin-bottom: 3px; }
    h3 { color: #d4380d; font-size: 13px; margin: 16px 0 4px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; } th { background: #1f1f1f; color: #fa8c16; text-align: left; font-size: 10.5px; padding: 6px; }
    td { padding: 5px 6px; border-bottom: 1px solid #e5e5e5; vertical-align: top; } tr:nth-child(even) td { background: #fafafa; }
    .r { text-align: right; } .b { font-weight: bold; } .fx { color: #555; font-size: 10.5px; margin-top: 2px; }
    .total { margin-top: 12px; text-align: right; font-size: 16px; font-weight: bold; }
    .cond td { border-bottom: 1px solid #ddd; } .cond td:first-child { font-weight: bold; width: 38%; }
    .rodape { margin-top: 24px; text-align: center; } .rodape small { color: #888; }
  </style></head><body>
    <div class="faixa">PROPOSTA COMERCIAL Nº ${o.id}</div>
    <div class="caixas">
      <div><b class="t">EMPRESA EMISSORA:</b><b>${esc(nomeEmpresa)}</b><br>${esc([e.cnpj && `CNPJ: ${e.cnpj}`].filter(Boolean).join(''))}<br>${esc(endereco)}<br>
        ${esc([e.telefone && `Tel: ${e.telefone}`, e.email].filter(Boolean).join(' · '))}${o.operador ? `<br>Vendedor: ${esc(o.operador)}` : ''}</div>
      <div><b class="t">CLIENTE:</b><b>${esc([codigo, o.cliente].filter(Boolean).join(' - '))}</b>${o.contato ? `<br>Contato: ${esc(o.contato)}` : ''}
        ${o.telefoneCliente ? `<br>Tel: ${esc(o.telefoneCliente)}` : ''}<br>Emitida em ${dataBr(String(o.criadoEm))}</div>
    </div>
    ${secoes.map((sec, n) => `<h3>${n + 1}. ${esc(sec.titulo)}</h3>
      <table><thead><tr><th>CÓDIGO</th><th>PRODUTO / DESCRIÇÃO</th><th>EMBALAGEM</th><th class="r">QTDE</th><th class="r">VALOR/BASE</th><th class="r">VALOR UN.</th><th class="r">TOTAL (R$)</th></tr></thead><tbody>
      ${sec.itens.map(i => `<tr><td>${esc(i.codigo)}</td><td>${esc(i.descricao)}${i.faixas.map(f => `<div class="fx">${esc(f)}</div>`).join('')}</td>
        <td>${esc(i.embalagem)}</td><td class="r">${esc(i.quantidade)}</td><td class="r b">${esc(i.valorBase || '—')}</td><td class="r">${esc(i.valorUnitario)}</td><td class="r b">${esc(i.total)}</td></tr>`).join('')}
      </tbody></table>`).join('')}
    <div class="total">Total da proposta: ${brl(o.total)}</div>
    <h3>${secoes.length + 1}. Condições de pagamento e observações</h3>
    <table class="cond"><tbody>
      <tr><td>Condição de pagamento / prazo:</td><td class="b" style="color:#d4380d">${esc(o.condicaoPagamento || 'A combinar no fechamento')}</td></tr>
      <tr><td>Validade da proposta:</td><td>Válida até ${dataBr(o.validade)}, sujeita à disponibilidade de estoque.</td></tr>
      ${o.observacao ? `<tr><td>Observações:</td><td>${esc(o.observacao)}</td></tr>` : ''}
    </tbody></table>
    <div class="rodape"><b>Agradecemos a preferência pela ${esc(nomeEmpresa)}!</b></div>
  </body></html>`;
};

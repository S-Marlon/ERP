// O documento do orçamento (impressão e PDF), no modelo da empresa: cabeçalho (nome, razão social, CNPJ | IE, endereço
// com CEP), "ORÇAMENTO" com data e validade, cliente, seções numeradas por categoria (# corrido, descrição, qtd, un,
// valor unit., total e subtotal da seção), TOTAL GERAL (com o desconto da forma de pagamento e as etapas, quando houver)
// e as condições. Puro: a impressão (HTML) e o PDF (jsPDF) desenham estas mesmas linhas. Com teste.
import type { DadosEmpresa } from '../../../shared/core/configuracoes/configuracoes';
import type { PedidoAbertoDetalhe } from '../pdv/services/pedidosAbertosApi';
import { codigoCliente, secoesDaProposta } from '../negociacao/propostaNegociacao';
import { pagamentosDaCondicao, totalComDesconto } from '../negociacao/condicaoPagamento';

export const brlDoc = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBr = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const cnpj = (v: string) => { const d = digitos(v); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : v; };
const ie = (v: string) => { const d = digitos(v); return d.length === 12 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1.$2.$3.$4') : v; };
const cep = (v: string) => { const d = digitos(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : v; };
const fone = (v: string) => { const d = digitos(v); return d.length === 11 ? d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : d.length === 10 ? d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3') : v; };
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface LinhaDoc { n: number; descricao: string; extras: string[]; qtd: string; un: string; unitario: string; total: string }
export interface SecaoDoc { numero: number; titulo: string; linhas: LinhaDoc[]; subtotal: string }

export const modeloOrcamento = (o: PedidoAbertoDetalhe, e: Partial<DadosEmpresa>) => {
  const negociacao = o.margemAlvo !== null && o.margemAlvo !== undefined;
  const nome = e.nomeFantasia || e.razaoSocial || 'Orçamento';
  const endereco = [
    e.logradouro && `${e.logradouro}${e.numero ? `, ${e.numero}` : ''}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ''}`, e.cep && `CEP ${cep(e.cep)}`,
  ].filter(Boolean).join(' – ');
  const dias = o.validade && o.criadoEm
    ? Math.round((new Date(`${String(o.validade).slice(0, 10)}T12:00:00`).getTime() - new Date(`${String(o.criadoEm).slice(0, 10)}T12:00:00`).getTime()) / 86400000)
    : null;

  // seções por categoria (as da proposta), numeradas; # corrido entre as seções
  let n = 0;
  const secoesBrutas = secoesDaProposta(o);
  const secoes: SecaoDoc[] = secoesBrutas.map((sec, k) => {
    const linhas = sec.itens.map(p => {
      const i = o.itens[p.indice];
      return {
        n: ++n, descricao: i.nome,
        extras: [p.valorBase ? `${p.embalagem} · ${p.valorBase}` : '', ...p.faixas].filter(Boolean),
        qtd: qtd(i.quantidade), un: (i.unidade || 'un'), unitario: brlDoc(i.precoUnitario), total: brlDoc(i.total),
      };
    });
    const subtotal = r2(sec.itens.reduce((s, p) => s + o.itens[p.indice].total, 0));
    return { numero: k + 1, titulo: secoesBrutas.length === 1 && sec.titulo === 'Outros itens' ? 'Itens' : sec.titulo, linhas, subtotal: brlDoc(subtotal) };
  });

  // totais: desconto nos itens (se houver), total geral e, com a condição, o desconto da forma e as etapas
  const c = o.condicao || null;
  const d = Number(c?.descontoPct) || 0;
  const aPagar = c ? totalComDesconto(c, o.total) : o.total;
  const etapas = c && c.entrada > 0 ? pagamentosDaCondicao(c, aPagar).filter(p => p.valor > 0) : [];
  const aVista = c?.forma === 'PIX' || c?.forma === 'DINHEIRO';
  const totais: Array<{ rotulo: string; valor: string; destaque?: boolean; secundario?: boolean }> = [
    ...(o.totalDesconto > 0 ? [{ rotulo: 'Subtotal', valor: brlDoc(o.totalBruto) }, { rotulo: 'Desconto', valor: `- ${brlDoc(o.totalDesconto)}` }] : []),
    { rotulo: 'TOTAL GERAL', valor: brlDoc(o.total), destaque: d === 0 },
    ...(d > 0 ? [
      { rotulo: `Desconto ${c?.forma === 'PIX' ? 'no PIX' : 'em dinheiro'} (${(d * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)`, valor: `- ${brlDoc(r2(o.total - aPagar))}` },
      { rotulo: `TOTAL ${c?.forma === 'PIX' ? 'NO PIX' : 'EM DINHEIRO'}`, valor: brlDoc(aPagar), destaque: true },
    ] : []),
    ...etapas.map((p, i) => ({
      rotulo: i === 0 ? (aVista ? 'Antecipado' : 'Entrada') : aVista ? 'Na conclusão e entrega' : 'Restante', valor: brlDoc(p.valor), secundario: true,
    })),
  ];

  const condicoes = [
    { rotulo: 'Forma de pagamento', valor: o.condicaoPagamento || 'a combinar' },
    { rotulo: 'Prazo de entrega', valor: 'a combinar' },
    { rotulo: 'Validade', valor: o.validade ? `até ${dataBr(o.validade)}, sujeita à disponibilidade de estoque` : 'sujeita à disponibilidade de estoque' },
    ...(o.observacao ? [{ rotulo: 'Observações', valor: o.observacao }] : []),
  ];

  return {
    empresa: {
      nome, razao: e.razaoSocial && e.razaoSocial !== nome ? e.razaoSocial : null,
      documentos: [e.cnpj && `CNPJ: ${cnpj(e.cnpj)}`, e.inscricaoEstadual && `IE: ${ie(e.inscricaoEstadual)}`].filter(Boolean).join('  |  '),
      endereco, contato: [e.telefone && fone(String(e.telefone)), e.email].filter(Boolean).join('  ·  '),
    },
    titulo: 'ORÇAMENTO', numero: o.id,
    data: dataBr(o.criadoEm), validade: dias !== null && dias > 0 ? `${dias} ${dias === 1 ? 'dia' : 'dias'}` : o.validade ? `até ${dataBr(o.validade)}` : null,
    cliente: [negociacao ? codigoCliente(o.idCliente) : null, o.cliente].filter(Boolean).join(' - '),
    contato: o.contato || o.telefoneCliente || null, atendente: o.operador || null,
    secoes, totais, condicoes,
  };
};
export type ModeloOrcamento = ReturnType<typeof modeloOrcamento>;

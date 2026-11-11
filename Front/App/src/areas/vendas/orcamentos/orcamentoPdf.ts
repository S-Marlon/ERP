// Orçamento em arquivo PDF (A4) para baixar ou mandar pelo WhatsApp, e a mensagem que acompanha o arquivo.
// Mesmo conteúdo do orçamento impresso (pedidosAbertosApi.imprimirOrcamento). Sem acesso a tela: roda também no teste.
import { jsPDF } from 'jspdf';
import type { DadosEmpresa } from '../../../shared/core/configuracoes/configuracoes';
import type { PedidoAbertoDetalhe } from '../pdv/services/pedidosAbertosApi';

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBr = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '-');
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
// A fonte padrão do PDF só tem Latin-1: troca o que ficaria em branco (travessão, reticências, aspas curvas)
const texto = (v: unknown) => String(v ?? '')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\x00-\xFF]/g, '');

// Cliente sem cadastro ("CONSUMIDOR", "Consumidor Final") não vai no nome do arquivo nem na saudação
const semNome = (cliente?: string | null) => !cliente || /^consumidor(\s|$)/i.test(cliente.trim());

export const nomeEmpresa = (e: Partial<DadosEmpresa>) => e.nomeFantasia || e.razaoSocial || '';

/** Nome do arquivo: Orcamento_123_Joao_Silva.pdf (sem acento nem espaço, para qualquer celular abrir). */
export const nomeArquivoOrcamento = (o: Pick<PedidoAbertoDetalhe, 'id' | 'cliente'>) => {
  const cliente = String(o.cliente || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '').slice(0, 30);
  return `Orcamento_${o.id}${cliente && !semNome(o.cliente) ? `_${cliente}` : ''}.pdf`;
};

/** Texto que vai junto do PDF no WhatsApp. */
export const mensagemOrcamento = (o: Pick<PedidoAbertoDetalhe, 'id' | 'cliente' | 'total' | 'validade'>, loja: string) => {
  const primeiro = semNome(o.cliente) ? '' : ` ${o.cliente.trim().split(/\s+/)[0]}`;
  return `Olá${primeiro}! Segue o orçamento Nº ${o.id}${loja ? ` da ${loja}` : ''}, no total de ${brl(o.total)}` +
    `${o.validade ? `, válido até ${dataBr(o.validade)}` : ''}. Qualquer dúvida estamos à disposição.`;
};

/** Monta o PDF do orçamento e devolve os bytes. */
export const gerarPdfOrcamento = (o: PedidoAbertoDetalhe, e: Partial<DadosEmpresa>): Uint8Array => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 14, L = 210 - M;           // margens
  const azul: [number, number, number] = [22, 119, 255];
  let y = M;

  // Cabeçalho: empresa à esquerda, número e datas à direita
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(0);
  doc.text(texto(nomeEmpresa(e) || 'Orçamento'), M, y + 5);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(70);
  const linhasEmpresa = [
    [e.cnpj && `CNPJ ${e.cnpj}`, e.telefone, e.email].filter(Boolean).join('  ·  '),
    [e.logradouro && `${e.logradouro}${e.numero ? `, ${e.numero}` : ''}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ''}`].filter(Boolean).join('  ·  '),
  ].filter(Boolean);
  linhasEmpresa.forEach((l, i) => doc.text(texto(l), M, y + 11 + i * 4.5));

  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(0).text('ORÇAMENTO', L, y + 3, { align: 'right' });
  doc.setFontSize(15).setTextColor(...azul).text(`Nº ${o.id}`, L, y + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(0).text(`Emitido em ${dataBr(o.criadoEm)}`, L, y + 15, { align: 'right' });
  doc.setFont('helvetica', 'bold').text(`Válido até ${dataBr(o.validade)}`, L, y + 19.5, { align: 'right' });
  y += Math.max(22, 13 + linhasEmpresa.length * 4.5);
  doc.setDrawColor(...azul).setLineWidth(0.6).line(M, y, L, y);
  y += 6;

  // Cliente
  doc.setFontSize(10).setTextColor(0);
  const cliente = [['Cliente', o.cliente], ['Contato', o.contato], ['Atendente', o.operador]].filter(([, v]) => v);
  let x = M;
  for (const [rotulo, valor] of cliente) {
    doc.setFont('helvetica', 'bold').text(`${rotulo}:`, x, y);
    const w = doc.getTextWidth(`${rotulo}: `);
    doc.setFont('helvetica', 'normal').text(texto(valor), x + w, y);
    x += w + doc.getTextWidth(texto(valor)) + 6;
    if (x > L - 40) { x = M; y += 5; }
  }
  y += 7;

  // Itens
  const col = { cod: M + 1, desc: M + 33, qtd: 140, unit: 168, total: L - 1 };
  const cabecalho = () => {
    doc.setFillColor(240, 245, 255).rect(M, y - 4.5, L - M, 7, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(0);
    doc.text('Código', col.cod, y); doc.text('Descrição', col.desc, y);
    doc.text('Qtd', col.qtd, y, { align: 'right' }); doc.text('Unitário', col.unit, y, { align: 'right' });
    doc.text('Total', col.total, y, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'normal');
  };
  cabecalho();
  for (const i of o.itens) {
    const desc: string[] = doc.splitTextToSize(texto(i.nome), col.qtd - 22 - col.desc);
    const altura = desc.length * 4 + 2;
    if (y + altura > 297 - M - 10) { doc.addPage(); y = M + 5; cabecalho(); }
    doc.setFontSize(9).setTextColor(0);
    doc.text(texto(i.sku).slice(0, 18), col.cod, y);
    doc.text(desc, col.desc, y);
    doc.text(texto(`${qtd(i.quantidade)} ${i.unidade || ''}`.trim()), col.qtd, y, { align: 'right' });
    doc.text(brl(i.precoUnitario), col.unit, y, { align: 'right' });
    doc.setFont('helvetica', 'bold').text(brl(i.total), col.total, y, { align: 'right' }).setFont('helvetica', 'normal');
    y += altura;
    doc.setDrawColor(229).setLineWidth(0.2).line(M, y - 3, L, y - 3);
  }

  // Totais
  if (y > 297 - M - 40) { doc.addPage(); y = M + 5; }
  y += 3;
  doc.setFontSize(10);
  if (o.totalDesconto > 0) {
    doc.text('Subtotal', L - 60, y); doc.text(brl(o.totalBruto), L, y, { align: 'right' }); y += 5;
    doc.text('Desconto', L - 60, y); doc.text(`- ${brl(o.totalDesconto)}`, L, y, { align: 'right' }); y += 6;
  }
  doc.setFont('helvetica', 'bold').setFontSize(13).text('Total', L - 60, y).text(brl(o.total), L, y, { align: 'right' });
  y += 9;

  // Observações e rodapé
  doc.setFont('helvetica', 'normal').setFontSize(9);
  if (o.observacao) {
    const obs: string[] = doc.splitTextToSize(texto(`Observações: ${o.observacao}`), L - M - 6);
    if (y + obs.length * 4 + 6 > 297 - M) { doc.addPage(); y = M + 5; }
    doc.setFillColor(250, 250, 250).rect(M, y - 4, L - M, obs.length * 4 + 4, 'F');
    doc.setTextColor(0).text(obs, M + 3, y);
    y += obs.length * 4 + 6;
  }
  doc.setTextColor(110).setFontSize(8.5).text(
    doc.splitTextToSize(`Preços válidos até ${dataBr(o.validade)}, sujeitos à disponibilidade de estoque. Formas de pagamento a combinar no fechamento.`, L - M),
    M, Math.min(y + 4, 297 - M),
  );

  return new Uint8Array(doc.output('arraybuffer'));
};

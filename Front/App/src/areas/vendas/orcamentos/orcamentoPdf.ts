// Orçamento em arquivo PDF (A4) para baixar ou mandar pelo WhatsApp, e a mensagem que acompanha o arquivo.
// Mesmo conteúdo do orçamento impresso (pedidosAbertosApi.imprimirOrcamento). Sem acesso a tela: roda também no teste.
import { jsPDF } from 'jspdf';
import type { DadosEmpresa } from '../../../shared/core/configuracoes/configuracoes';
import type { PedidoAbertoDetalhe } from '../pdv/services/pedidosAbertosApi';
import { modeloOrcamento } from './modeloOrcamento';

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBr = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '-');
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
  // o mesmo modelo da impressão (modeloOrcamento): cabeçalho, ORÇAMENTO, cliente, seções com subtotal, total e condições
  const m = modeloOrcamento(o, e);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 15, L = 210 - M, FIM = 297 - 16;
  const azul: [number, number, number] = [31, 58, 95];
  let y = 18;
  const novaPagina = (precisa: number) => { if (y + precisa > FIM) { doc.addPage(); y = 18; return true; } return false; };

  // cabeçalho da empresa
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...azul).text(texto(m.empresa.nome), M, y);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(85);
  for (const l of [m.empresa.razao, m.empresa.documentos, m.empresa.endereco, m.empresa.contato].filter(Boolean) as string[]) { y += 4; doc.text(texto(l), M, y); }
  y += 4;
  doc.setDrawColor(...azul).setLineWidth(0.45).line(M, y, L, y);
  y += 11;

  // título, data e validade, cliente
  doc.setFont('helvetica', 'bold').setFontSize(24).setTextColor(...azul).text(texto(m.titulo), M, y);
  y += 6;
  doc.setFontSize(9.5).setTextColor(...azul).text(`Nº ${m.numero}`, M, y);
  doc.setFont('helvetica', 'normal').setTextColor(40)
    .text(texto(`   |   Data: ${m.data}${m.validade ? `   |   Validade: ${m.validade}` : ''}`), M + doc.getTextWidth(`Nº ${m.numero}`), y);
  y += 6;
  doc.setFontSize(10).text('Cliente: ', M, y);
  doc.setFont('helvetica', 'bold').text(texto(m.cliente), M + doc.getTextWidth('Cliente: '), y);
  const extrasCli = [m.contato && `Contato: ${m.contato}`, m.atendente && `Atendente: ${m.atendente}`].filter(Boolean).join('   ·   ');
  if (extrasCli) { y += 5; doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90).text(texto(extrasCli), M, y); }
  y += 9;

  // seções: título, cabeçalho azul, linhas zebradas e o subtotal
  const col = { n: M + 2.5, desc: M + 10, qtd: 130, un: 134, unit: 166, total: L - 2.5 };
  const larguraDesc = col.qtd - 8 - col.desc;
  const cabecalho = () => {
    doc.setFillColor(...azul).rect(M, y - 5, L - M, 8, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(255);
    doc.text('#', col.n, y); doc.text('Descrição', col.desc, y); doc.text('Qtd', col.qtd, y, { align: 'right' }); doc.text('Un', col.un, y);
    doc.text('Valor unit.', col.unit, y, { align: 'right' }); doc.text('Total', col.total, y, { align: 'right' });
    y += 8;
  };
  for (const s of m.secoes) {
    novaPagina(24);
    doc.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(...azul).text(texto(`${s.numero}. ${s.titulo}`), M, y);
    y += 6.5;
    cabecalho();
    s.linhas.forEach((l, k) => {
      doc.setFont('helvetica', 'normal').setFontSize(9.5);
      const desc: string[] = doc.splitTextToSize(texto(l.descricao), larguraDesc);
      doc.setFontSize(8);
      const extras: string[] = l.extras.flatMap(x => doc.splitTextToSize(texto(x), larguraDesc));
      const altura = Math.max(8, desc.length * 4.3 + extras.length * 3.5 + 3.8);
      if (novaPagina(altura)) cabecalho();
      if (k % 2 === 1) doc.setFillColor(243, 246, 249).rect(M, y - 5, L - M, altura, 'F');
      doc.setFontSize(9.5).setTextColor(60).text(String(l.n), col.n, y);
      doc.setTextColor(30).text(desc, col.desc, y);
      if (extras.length) doc.setFontSize(8).setTextColor(105).text(extras, col.desc, y + desc.length * 4.3);
      doc.setFontSize(9.5).setTextColor(30);
      doc.text(texto(l.qtd), col.qtd, y, { align: 'right' }); doc.text(texto(l.un), col.un, y);
      doc.text(texto(l.unitario), col.unit, y, { align: 'right' }); doc.text(texto(l.total), col.total, y, { align: 'right' });
      y += altura;
      doc.setDrawColor(227, 231, 236).setLineWidth(0.2).line(M, y - 5, L, y - 5);
    });
    novaPagina(8);
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(30).text('Subtotal', col.unit, y, { align: 'right' }).text(texto(s.subtotal), col.total, y, { align: 'right' });
    y += 9;
  }

  // totais
  novaPagina(10 + m.totais.length * 7);
  doc.setDrawColor(...azul).setLineWidth(0.45).line(M, y - 3, L, y - 3);
  y += 4;
  for (const t of m.totais) {
    if (t.destaque) doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...azul);
    else if (t.secundario) doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(105);
    else doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(30);
    // o rótulo fica a 40 mm do valor: cabe o total em destaque (fonte maior) sem encostar
    doc.text(texto(t.rotulo), col.total - 40, y, { align: 'right' }).text(texto(t.valor), col.total, y, { align: 'right' });
    y += t.destaque ? 7.5 : 5.5;
  }

  // condições
  y += 6;
  const linhasCond: string[] = m.condicoes.flatMap(c => doc.setFontSize(10).splitTextToSize(texto(`${c.rotulo}: ${c.valor}`), L - M));
  novaPagina(8 + linhasCond.length * 5);
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(30).text('Condições', M, y);
  doc.setFont('helvetica', 'normal').text(linhasCond, M, y + 5.5);

  return new Uint8Array(doc.output('arraybuffer'));
};

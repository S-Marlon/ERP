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
  // o mesmo modelo da impressão (modeloOrcamento), compacto para caber numa folha: uma tabela só, com cada categoria
  // numa faixa fina (número, nome e subtotal), e os totais ao lado das condições
  const m = modeloOrcamento(o, e);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 13, L = 210 - M, FIM = 297 - 12;
  const azul: [number, number, number] = [31, 58, 95];
  let y = 15;
  const novaPagina = (precisa: number) => { if (y + precisa > FIM) { doc.addPage(); y = 15; return true; } return false; };

  // cabeçalho: empresa à esquerda, ORÇAMENTO / Nº / data / validade à direita
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...azul).text(texto(m.empresa.nome), M, y);
  doc.setFontSize(17).text(texto(m.titulo), L, y + 1, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(85);
  let yE = y;
  for (const l of [m.empresa.razao, m.empresa.documentos, m.empresa.endereco, m.empresa.contato].filter(Boolean) as string[]) { yE += 3.4; doc.text(texto(l), M, yE); }
  const meta = `Nº ${m.numero}  ·  ${m.data}${m.validade ? `  ·  Validade: ${m.validade}` : ''}`;
  doc.setFontSize(8.5).setTextColor(40).text(texto(meta), L, y + 6, { align: 'right' });
  y = Math.max(yE, y + 6) + 2.5;
  doc.setDrawColor(...azul).setLineWidth(0.4).line(M, y, L, y);
  y += 5;
  doc.setFontSize(9).setTextColor(30).text('Cliente: ', M, y);
  doc.setFont('helvetica', 'bold').text(texto(m.cliente), M + doc.getTextWidth('Cliente: '), y);
  const extrasCli = [m.contato && `Contato: ${m.contato}`, m.atendente && `Atendente: ${m.atendente}`].filter(Boolean).join('  ·  ');
  if (extrasCli) doc.setFont('helvetica', 'normal').setTextColor(90).text(texto(`  ·  ${extrasCli}`), M + doc.getTextWidth('Cliente: ') + doc.setFont('helvetica', 'bold').getTextWidth(texto(m.cliente)), y);
  y += 5;

  // tabela única
  const col = { n: M + 2, desc: M + 8.5, qtd: 136, un: 139.5, unit: 168, total: L - 2 };
  const larguraDesc = col.qtd - 9 - col.desc;
  const cabecalho = () => {
    doc.setFillColor(...azul).rect(M, y - 3.8, L - M, 6, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(8.3).setTextColor(255);
    doc.text('#', col.n, y); doc.text('Descrição', col.desc, y); doc.text('Qtd', col.qtd, y, { align: 'right' }); doc.text('Un', col.un, y);
    doc.text('Valor unit.', col.unit, y, { align: 'right' }); doc.text('Total', col.total, y, { align: 'right' });
    y += 5.6;
  };
  cabecalho();
  for (const s of m.secoes) {
    if (m.secoes.length > 1) {
      if (novaPagina(10)) cabecalho();
      doc.setFillColor(238, 242, 246).rect(M, y - 3.4, L - M, 5, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(8.3).setTextColor(...azul)
        .text(texto(`${s.numero}. ${s.titulo}`), col.n, y).text(texto(s.subtotal), col.total, y, { align: 'right' });
      y += 5;
    }
    for (const l of s.linhas) {
      doc.setFont('helvetica', 'normal').setFontSize(8.8);
      const desc: string[] = doc.splitTextToSize(texto(l.descricao), larguraDesc);
      doc.setFontSize(7.5);
      const extras: string[] = l.extras.flatMap(x => doc.splitTextToSize(texto(x), larguraDesc));
      const altura = desc.length * 3.7 + extras.length * 3.1 + 1.6;
      if (novaPagina(altura)) cabecalho();
      doc.setFontSize(8.8).setTextColor(100).text(String(l.n), col.n, y);
      doc.setTextColor(30).text(desc, col.desc, y);
      if (extras.length) doc.setFontSize(7.5).setTextColor(105).text(extras, col.desc, y + desc.length * 3.7);
      doc.setFontSize(8.8).setTextColor(30);
      doc.text(texto(l.qtd), col.qtd, y, { align: 'right' }); doc.text(texto(l.un), col.un, y);
      doc.text(texto(l.unitario), col.unit, y, { align: 'right' }); doc.text(texto(l.total), col.total, y, { align: 'right' });
      y += altura;
      doc.setDrawColor(232, 235, 239).setLineWidth(0.15).line(M, y - 3.3, L, y - 3.3);
    }
  }

  // condições à esquerda e totais à direita, lado a lado
  const xTot = 128;
  doc.setFontSize(8.5);
  const linhasCond: string[] = m.condicoes.flatMap(c => doc.splitTextToSize(texto(`${c.rotulo}: ${c.valor}`), xTot - 8 - M));
  const alturaFim = Math.max(5 + linhasCond.length * 3.6, 4 + m.totais.length * 4.8);
  novaPagina(alturaFim + 4);
  y += 2;
  doc.setDrawColor(...azul).setLineWidth(0.4).line(xTot, y - 2.5, L, y - 2.5);
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...azul).text('Condições', M, y + 1);
  doc.setFont('helvetica', 'normal').setTextColor(40).text(linhasCond, M, y + 5);
  let yT = y + 1.5;
  for (const t of m.totais) {
    if (t.destaque) doc.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(...azul);
    else if (t.secundario) doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(105);
    else doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(30);
    doc.text(texto(t.rotulo), xTot, yT).text(texto(t.valor), L, yT, { align: 'right' });
    yT += t.destaque ? 5.6 : 4.4;
  }

  return new Uint8Array(doc.output('arraybuffer'));
};

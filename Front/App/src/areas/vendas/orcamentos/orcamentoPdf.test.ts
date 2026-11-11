import assert from 'assert';
import { writeFileSync } from 'fs';
import type { PedidoAbertoDetalhe } from '../pdv/services/pedidosAbertosApi';
import { formatarTelefone, linkWhatsapp, telefoneDoTexto } from '../../../shared/utils/whatsapp';
import { gerarPdfOrcamento, mensagemOrcamento, nomeArquivoOrcamento } from './orcamentoPdf';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const orc = (n: number): PedidoAbertoDetalhe => ({
  id: 57, tipo: 'ORCAMENTO', situacao: 'VALIDO', cliente: 'João da Silva', idCliente: 3, contato: 'Obra — (11) 98888-7777', operador: 'ADM',
  observacao: 'Entrega na obra; pagamento 30/60 dias.', validade: '2026-11-21', criadoEm: '2026-11-11T10:00:00',
  totalBruto: 1000, totalDesconto: 50, total: 950,
  itens: Array.from({ length: n }, (_, i) => ({
    idItem: i, sku: `TUBO-${i}`, nome: `Tubo PVC soldável 25mm × 6m com conexão de pressão número ${i} e descrição bem comprida para quebrar a linha`,
    idUnidade: null, unidade: 'BR', quantidade: 2.5, precoTabela: 10, precoUnitario: 9.5, desconto: 0, total: 23.75,
  })),
});

teste('telefone e link do WhatsApp', () => {
  assert.strictEqual(telefoneDoTexto('Obra — (11) 98888-7777'), '11988887777');
  assert.strictEqual(telefoneDoTexto('+55 11 3333-4444 fixo'), '551133334444');
  assert.strictEqual(telefoneDoTexto('só o nome'), null);
  assert.strictEqual(formatarTelefone('5511988887777'), '(11) 98888-7777');
  assert.ok(linkWhatsapp('(11) 98888-7777', 'oi').startsWith('https://wa.me/5511988887777?text=oi'));
  assert.ok(linkWhatsapp('', 'oi').startsWith('https://wa.me/?text='));
});

teste('nome do arquivo e mensagem', () => {
  assert.strictEqual(nomeArquivoOrcamento({ id: 57, cliente: 'João da Silva' }), 'Orcamento_57_Joao_da_Silva.pdf');
  assert.strictEqual(nomeArquivoOrcamento({ id: 8, cliente: 'CONSUMIDOR' }), 'Orcamento_8.pdf');
  assert.strictEqual(nomeArquivoOrcamento({ id: 9, cliente: 'Consumidor Final' }), 'Orcamento_9.pdf');
  assert.ok(mensagemOrcamento({ ...orc(1), cliente: 'Consumidor Final' }, '').startsWith('Olá! Segue o orçamento Nº 57,'));
  assert.strictEqual(telefoneDoTexto('11998514969'), '11998514969');
  const m = mensagemOrcamento(orc(1), 'Casa Hidráulica');
  assert.ok(m.startsWith('Olá João! Segue o orçamento Nº 57 da Casa Hidráulica') && m.includes('R$ 950,00') && m.includes('21/11/2026'));
});

teste('PDF do orçamento (com quebra de página)', () => {
  const empresa = { nomeFantasia: 'Casa Hidráulica', cnpj: '12.345.678/0001-90', telefone: '(11) 3333-4444', cidade: 'São Paulo', uf: 'SP' };
  const pdf = gerarPdfOrcamento(orc(40), empresa);
  const cabeca = Buffer.from(pdf.slice(0, 5)).toString('latin1');
  assert.strictEqual(cabeca, '%PDF-');
  const paginas = (Buffer.from(pdf).toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  assert.ok(paginas >= 2, `páginas: ${paginas}`);
  if (process.env.SALVAR_PDF) writeFileSync(process.env.SALVAR_PDF, pdf);
});

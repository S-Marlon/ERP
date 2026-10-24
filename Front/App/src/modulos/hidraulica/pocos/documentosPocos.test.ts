import assert from 'assert';
import { escapar, htmlAdesivo, htmlLaudo, htmlOrcamento } from './documentosPocos';
import type { DocumentoObra } from './obrasApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const doc: DocumentoObra = {
  empresa: {
    empresaNome: 'Poços <Silva>', empresaDocumento: '12345678000190', empresaTelefone: '1144556677', empresaWhatsapp: '11999990000', empresaEmail: null,
    empresaEndereco: 'Rua A, 10', logo: null, textoGarantia: 'Cobre a perfuração.\nNão cobre a bomba.', formaPagamentoPadrao: null, validadeOrcamentoDias: 15,
    linkAvaliacao: null, msgAvaliacao: '', msgRevisao: '', respostaLeadMin: 60, orcamentoHoras: 24, avaliacaoDias: 7, revisaoMeses: 11,
    horaAbre: '08:00', horaFecha: '18:00', sabadoFecha: '12:00', configurado: true,
  },
  obra: {
    idObra: 15, titulo: 'Poço Sítio São José', servicos: ['PERFURACAO', 'INSTALACAO'], situacao: 'CONCLUIDA', criadaEm: '2026-10-01 09:00:00',
    dataInicio: '2026-10-10', dataTermino: '2026-10-12', metrosPrevistos: 120, valorContratado: 18000, valorMetroExcedente: 180, valorSinal: 5000,
    sinalQuando: 'ANTES', garantiaMeses: 12, garantiaAte: '2027-10-12', escopo: 'Perfuração de até 120 m\nRevestimento 6"', prazoExecucaoDias: 10,
    formaPagamento: '50% de sinal e o saldo na entrega', validadeOrcamentoDias: 15, adicionais: [{ descricao: '12 m excedentes', valor: 2160 }],
  },
  cliente: { nome: 'José', documento: '12345678901', telefone: '11977776666', endereco: null, cidade: 'Itupeva', uf: 'SP' },
  poco: { idPoco: 3, identificacao: 'Sítio São José - poço 1', endereco: 'Estrada Municipal, km 4', cidade: 'Itupeva', uf: 'SP', latitude: -23.05, longitude: -47.04,
    profundidadeM: 132, diametro: '6"', vazaoLh: 4500, nivelEstaticoM: 18, nivelDinamicoM: 62, tipoSolo: 'Cristalino', dataPerfuracao: '2026-10-12' },
  medido: { profundidadeM: null, vazaoLh: 4800, nivelEstaticoM: null, nivelDinamicoM: null, diametro: null, tipoSolo: null, bomba: 'Ebara, instalada a 90 m' },
};

teste('documentos de poço: orçamento', () => {
  const h = htmlOrcamento(doc, 'http://servidor/uploads/logo.png', '2026-10-24');
  assert.ok(/Or.amento n. 15/.test(h), 'número do orçamento');
  assert.ok(/V.lido at. 08\/11\/2026 \(15 dias\)/.test(h), 'validade de 15 dias a partir de hoje');
  assert.ok(h.includes('Perfuração + Instalação da bomba') && h.includes('<p>Revestimento 6&quot;</p>'));
  assert.ok(/R\$\s20\.160,00/.test(h), 'total com o adicional');                    // 18.000 + 2.160 de adicional aprovado
  assert.ok(h.includes('Sinal de') && h.includes('para agendar o início da obra') && h.includes('em até 10 dia(s)'));
  assert.ok(h.includes('Poços &lt;Silva&gt;') && !h.includes('Poços <Silva>'));                // escapa o HTML
  assert.ok(h.includes('<img src="http://servidor/uploads/logo.png"') && h.includes('12.345.678/0001-90'));
});

teste('documentos de poço: laudo e adesivo', () => {
  const l = htmlLaudo(doc, null, '2026-10-24');
  assert.ok(l.includes('Laudo de entrega · obra nº 15') && l.includes('132 m') && l.includes('4.800 L/h'));   // vazão medida no relatório vence a da ficha
  assert.ok(l.includes('Rebaixamento') && l.includes('44 m') && l.includes('até 12/10/2027') && l.includes('Ebara, instalada a 90 m'));
  const a = htmlAdesivo(doc, null);
  assert.strictEqual((a.match(/class="adesivo"/g) || []).length, 4);
  assert.ok(a.includes('(11) 99999-0000') && a.includes('Obra nº 15 · Poço Sítio São José - poço 1'));
  assert.strictEqual(escapar('<a href="x">\'</a>'), '&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;');
});

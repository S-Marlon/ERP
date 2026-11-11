import assert from 'assert';
import {
  escapar, htmlAditivo, htmlAdesivo, htmlContrato, htmlLaudo, htmlOrcamento, preencherModelo, qualificacaoCliente, valorPorExtenso,
} from './documentosPocos';
import type { Aditivo, DocumentoObra } from './obrasApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const doc: DocumentoObra = {
  empresa: {
    empresaNome: 'Poços <Silva>', empresaDocumento: '12345678000190', empresaTelefone: '1144556677', empresaWhatsapp: '11999990000', empresaEmail: null,
    empresaEndereco: 'Rua A, 10', logo: null, textoGarantia: 'Cobre a perfuração.\nNão cobre a bomba.', formaPagamentoPadrao: null, validadeOrcamentoDias: 15,
    linkAvaliacao: null, msgAvaliacao: '', msgRevisao: '', respostaLeadMin: 60, orcamentoHoras: 24, avaliacaoDias: 7, revisaoMeses: 11,
    horaAbre: '08:00', horaFecha: '18:00', sabadoFecha: '12:00', configurado: true,
    modeloContrato: null, modeloAditivo: null, foroCidade: 'Jundiaí', responsavelTecnico: 'Eng. Carlos', registroTecnico: 'CREA 123', usaMonitoramento: false, usaMapa: false, empresaRepresentante: null, empresaRepresentanteCpf: null,
  },
  obra: {
    idObra: 15, titulo: 'Poço Sítio São José', servicos: ['PERFURACAO', 'INSTALACAO'], situacao: 'CONCLUIDA', criadaEm: '2026-10-01 09:00:00',
    dataInicio: '2026-10-10', dataTermino: '2026-10-12', metrosPrevistos: 120, valorContratado: 18000, valorMetroExcedente: 180, valorSinal: 5000,
    sinalQuando: 'ANTES', garantiaMeses: 12, garantiaAte: '2027-10-12', escopo: 'Perfuração de até 120 m\nRevestimento 6"', prazoExecucaoDias: 10,
    formaPagamento: '50% de sinal e o saldo na entrega', validadeOrcamentoDias: 15, adicionais: [{ descricao: '12 m excedentes', valor: 2160 }],
    itens: [], contratoAssinadoEm: '2026-10-05',
  },
  cliente: {
    nome: 'José', tipoPessoa: 'PF', documento: '12345678901', rgIe: '12.345.678-9', estadoCivil: 'casado(a)', profissao: 'agricultor', telefone: '11977776666',
    email: null, endereco: 'Estrada Municipal, km 4', bairro: 'Rural', cidade: 'Itupeva', uf: 'SP', cep: '13295-000', representante: null, representanteDocumento: null,
  },
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
  assert.ok(h.includes('Sinal de') && h.includes('para agendar o início da obra') && h.includes('Em até 10 dia(s)'));
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

teste('documentos de poço: valor por extenso', () => {
  assert.strictEqual(valorPorExtenso(18500.5), 'dezoito mil e quinhentos reais e cinquenta centavos');
  assert.strictEqual(valorPorExtenso(1250), 'mil duzentos e cinquenta reais');
  assert.strictEqual(valorPorExtenso(2160), 'dois mil cento e sessenta reais');
  assert.strictEqual(valorPorExtenso(1), 'um real');
  assert.strictEqual(valorPorExtenso(0.01), 'um centavo');
  assert.strictEqual(valorPorExtenso(100), 'cem reais');
  assert.strictEqual(valorPorExtenso(1000000), 'um milhão de reais');
  assert.strictEqual(valorPorExtenso(2001050), 'dois milhões mil e cinquenta reais');
});

teste('documentos de poço: orçamento com itens (o opcional fica fora do total)', () => {
  const d = { ...doc, obra: { ...doc.obra, adicionais: [], itens: [
    { grupo: 'PERFURACAO' as const, descricao: 'Perfuração 6"', quantidade: 50, unidade: 'm', valorUnitario: 180, valorTotal: 9000, opcional: false },
    { grupo: 'BOMBA' as const, descricao: 'Bomba 1cv', quantidade: 1, unidade: 'un', valorUnitario: 2500, valorTotal: 2500, opcional: false },
    { grupo: 'PERFURACAO' as const, descricao: 'Metro excedente', quantidade: 1, unidade: 'm', valorUnitario: 200, valorTotal: 200, opcional: true },
  ] } };
  const h = htmlOrcamento(d, null, '2026-10-24');
  assert.ok(/Total<\/td><td class="n">R\$\s11\.500,00/.test(h), 'total sem o opcional');
  assert.ok(h.includes('Se necessário, não incluso no total') && /R\$\s200,00\/m/.test(h));
  assert.ok(h.includes('Condições gerais') && h.includes('obrigação de meio'));
  // item incluso: aparece com o valor de referência e "INCLUSO", fora do total
  const d2 = { ...d, obra: { ...d.obra, valorParcelado: 12000, itens: [...d.obra.itens,
    { grupo: 'BOMBA' as const, descricao: 'Painel elétrico', quantidade: 1, unidade: 'un', valorUnitario: 700, valorTotal: 700, opcional: false, incluso: true }] } };
  const h2 = htmlOrcamento(d2, null, '2026-10-24');
  assert.ok(/Total<\/td><td class="n">R\$\s11\.500,00/.test(h2) && h2.includes('class="pill">Incluso') && /R\$\s700,00/.test(h2));
  assert.ok(h2.includes('Parcelado (cartão de crédito)') && /R\$\s12\.000,00/.test(h2));
});

teste('documentos de poço: qualificação e modelo', () => {
  assert.strictEqual(qualificacaoCliente(doc.cliente),
    'JOSÉ, casado(a), agricultor, portador(a) do RG nº 12.345.678-9, inscrito(a) no CPF sob o nº 123.456.789-01, residente em Estrada Municipal, km 4, Rural, Itupeva/SP, CEP 13295-000');
  const pj = qualificacaoCliente({ ...doc.cliente!, tipoPessoa: 'PJ', nome: 'Fazenda Ltda', documento: '12345678000190', rgIe: null, representante: 'Ana', representanteDocumento: '98765432100' });
  assert.ok(pj.startsWith('FAZENDA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 12.345.678/0001-90') && pj.endsWith('neste ato representada por Ana, CPF nº 987.654.321-00'));
  assert.strictEqual(preencherModelo('{cliente} paga {valor} em {foro}; {tabela_itens}', { cliente: 'José', foro: 'Jundiaí', tabela_itens: '<table>' }),
    'José paga {valor} em Jundiaí; {tabela_itens}');   // campo desconhecido e tabela fora de linha própria ficam como estão
});

teste('documentos de poço: contrato e aditivo', () => {
  const c = htmlContrato(doc, null, '2026-10-24');
  assert.ok(c.includes('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS') && c.includes('<h3>CLÁUSULA 11ª – DO FORO</h3>') && c.includes('Comarca de Jundiaí'));
  assert.ok(c.includes('obrigação de meio') && c.includes('IPCA') && c.includes('data a combinar entre as partes'));
  // representante da empresa e preço parcelado
  const c2 = htmlContrato({ ...doc, empresa: { ...doc.empresa, empresaRepresentante: 'José M. Santos', empresaRepresentanteCpf: '12057232859' },
    obra: { ...doc.obra, valorParcelado: 19000, dataPrevisao: '2026-09-02' } }, null, '2026-10-24');
  assert.ok(c2.includes('neste ato representada por José M. Santos, CPF nº 120.572.328-59') && c2.includes('terá início em 02/09/2026'));
  assert.ok(/à vista, ou R\$\s19\.000,00 \(dezenove mil reais\) se parcelado no cartão de crédito/.test(c2));
  assert.ok(/R\$\s20\.160,00 \(vinte mil cento e sessenta reais\)/.test(c), 'total com o adicional e por extenso');
  assert.ok(c.includes('JOSÉ, casado(a)') && c.includes('Jundiaí, 24 de outubro de 2026') && c.includes('Eng. Carlos · CREA 123') && c.includes('Testemunha 2'));
  assert.ok(!/\{[a-z_]+\}/.test(c), 'nenhum campo sobrando');
  const ad = (numero: number, valor: number): Aditivo => ({ idAditivo: numero, numero, valor, observacao: numero === 2 ? 'água mais funda' : null, emitidoEm: '2026-10-11 10:00',
    assinadoEm: null, operador: 'ADM', adicionais: [{ idAdicional: numero, tipo: 'METRO_EXCEDENTE', descricao: `${numero}0 m a mais`, quantidade: 10, valorUnitario: valor / 10, valor,
      situacao: 'APROVADO', aprovadoEm: null, idAditivo: numero }] });
  const todos = [ad(1, 1000), ad(2, 2000)];
  const a = htmlAditivo(doc, todos[1], todos, null, '2026-10-24');
  assert.ok(a.includes('TERMO ADITIVO Nº 2 AO CONTRATO Nº 15') && a.includes('de 05/10/2026') && a.includes('20 m a mais') && a.includes('<p>água mais funda</p>'));
  assert.ok(/passando o valor total a R\$\s21\.000,00 \(vinte e um mil reais\)/.test(a), '18.000 do contrato + 1.000 + 2.000 dos aditivos');
  assert.ok(!/\{[a-z_]+\}/.test(a));
});

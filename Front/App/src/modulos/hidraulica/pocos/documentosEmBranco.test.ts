import assert from 'assert';
import type { ConfigProcesso } from './obrasApi';
import { CAMPOS_DO_MODELO, htmlEmBranco, juntarPaginas, MODELOS_BRANCO, PADRAO_PROPOSTA, semImpressao } from './documentosEmBranco';
import { camposVazios, campoDe, destaquePrevia } from './camposKit';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const empresa = {
  empresaNome: 'Mac Poços', empresaDocumento: '65860414000136', empresaTelefone: '11999935060', empresaWhatsapp: null, empresaEmail: null,
  empresaEndereco: 'R. dos Faveiros, 1125, Atibaia/SP', logo: null, textoGarantia: null, formaPagamentoPadrao: null, validadeOrcamentoDias: 15,
  linkAvaliacao: null, msgAvaliacao: '', msgRevisao: '', respostaLeadMin: 60, orcamentoHoras: 24, avaliacaoDias: 7, revisaoMeses: 11, horaAbre: '08:00',
  horaFecha: '18:00', sabadoFecha: null, configurado: true, modeloContrato: null, modeloAditivo: null, foroCidade: 'Atibaia', responsavelTecnico: null,
  registroTecnico: null, usaMonitoramento: false, usaMapa: false, empresaRepresentante: 'José M. Santos', empresaRepresentanteCpf: '12057232859',
} as ConfigProcesso;

teste('modelos em branco do kit de visita', () => {
  for (const m of MODELOS_BRANCO) {
    const h = htmlEmBranco(m.id, empresa, null);
    assert.ok(h.startsWith('<!doctype html>') && h.includes('Mac Poços'), m.id);
    assert.ok(!/\{[a-z_]+\}/.test(h) && !h.includes('⟦'), `${m.id}: nenhum campo sobrando`);
    // todo campo do formulário existe
    for (const g of CAMPOS_DO_MODELO[m.id]) for (const k of g.chaves) assert.ok(campoDe(k), `${m.id}: campo ${k}`);
  }
  const p = htmlEmBranco('PROPOSTA', empresa, null);
  assert.ok(p.includes('Metragem base') && /R\$\s280,00/.test(p), 'excedente de referência da planilha');
  assert.ok(!p.includes('opção B') && !/R\$\s18\.000,00/.test(p), 'uma opção só, em branco');
  const t = htmlEmBranco('TABELA', empresa, null);
  assert.ok(t.includes('rocha consolidada (40 a 60 m)') && t.includes('class="pill">Incluso') && /R\$\s1\.800,00/.test(t));
  const c = htmlEmBranco('CONTRATO', empresa, null);
  assert.ok(c.includes('CLÁUSULA 11ª – DO FORO') && c.includes('Comarca de Atibaia') && c.includes('neste ato representada por José M. Santos, CPF nº 120.572.328-59'));
  assert.ok(htmlEmBranco('AUTORIZACAO', empresa, null).includes('obrigação de meio'));
});

teste('modelos preenchidos em parte', () => {
  // proposta com o padrão e o cliente; o resto continua em linha (e marcado como vazio)
  const v = { ...PADRAO_PROPOSTA, cliente_nome: 'José da Silva', motobomba: 'INCLUSO', ass_data: '2026-11-11' };
  const p = htmlEmBranco('PROPOSTA', empresa, null, v);
  assert.ok(p.includes('<b>60 m</b>') && /<b>R\$\s18\.000,00<\/b>/.test(p) && /<b>R\$\s19\.000,00<\/b>/.test(p) && p.includes('<b>José da Silva</b>'));
  assert.ok(p.includes('caixa marcada"></span>Incluso') && p.includes('11 de novembro de 2026'));
  assert.ok(/class="cp cp-vazio" data-campo="cliente_doc"/.test(p), 'o que falta fica marcado');
  // contrato: valor por extenso sai sozinho; o nome entra na assinatura
  const c = htmlEmBranco('CONTRATO', empresa, null, { valor_vista: 18000, valor_parcelado: 19000, cliente_nome: 'José' });
  assert.ok(c.includes('dezoito mil reais') && c.includes('dezenove mil reais') && c.includes('>José</span></b>CONTRATANTE'));
  // tabela: total da linha e total geral pelas quantidades (incluso não soma)
  const t = htmlEmBranco('TABELA', empresa, null, { qtd_4: 10, qtd_5: 20, qtd_9: 6 });
  assert.ok(/<b>R\$\s3\.000,00<\/b>/.test(t) && /<b>R\$\s5\.800,00<\/b>/.test(t) && /<b>R\$\s8\.800,00<\/b>/.test(t));
  // autorização: profundidade total e valor máximo calculados
  const a = htmlEmBranco('AUTORIZACAO', empresa, null, { prof_contratada: 60, metros_adicionais: 20, valor_metro: 280 });
  assert.ok(a.includes('>80</span>') && /R\$\s5\.600,00/.test(a));
  assert.strictEqual(camposVazios(['metros', 'valor_vista', 'cliente_nome'], v), 0);
  assert.strictEqual(camposVazios(['cliente_doc', 'metros'], v), 1);
});

teste('pré-visualização, destaque e impressão de vários', () => {
  const p = htmlEmBranco('PROPOSTA', empresa, null);
  assert.ok(p.includes('window.print') && !semImpressao(p).includes('window.print'));
  const d = destaquePrevia(semImpressao(p), 'metros', true);
  assert.ok(d.includes('.cp-vazio { background: #fff59d') && d.includes('[data-campo="metros"]') && d.includes('scrollIntoView'));
  assert.ok(!destaquePrevia(p, null, false).includes('fff59d'), 'em branco não marca nada');
  const juntos = juntarPaginas([p, htmlEmBranco('TABELA', empresa, null)]);
  assert.strictEqual(juntos.match(/window\.print/g)?.length, 1);
  assert.strictEqual(juntos.match(/<!doctype html>/g)?.length, 1);
  assert.ok(juntos.includes('page-break-before: always') && juntos.includes('Tabela de preços de referência'));
  assert.strictEqual(juntarPaginas([p]), p);
});

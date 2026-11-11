import assert from 'assert';
import type { ConfigProcesso } from './obrasApi';
import { htmlEmBranco, juntarPaginas, MODELOS_BRANCO, semImpressao } from './documentosEmBranco';

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
    assert.ok(!/\{[a-z_]+\}/.test(h), `${m.id}: nenhum campo sobrando`);
  }
  const p = htmlEmBranco('PROPOSTA', empresa, null);
  assert.ok(p.includes('Metragem base') && /R\$\s280,00/.test(p), 'excedente de referência da planilha');
  const t = htmlEmBranco('TABELA', empresa, null);
  assert.ok(t.includes('rocha consolidada (40 a 60 m)') && t.includes('class="pill">Incluso') && /R\$\s1\.800,00/.test(t));
  const c = htmlEmBranco('CONTRATO', empresa, null);
  assert.ok(c.includes('CLÁUSULA 11ª – DO FORO') && c.includes('Comarca de Atibaia') && c.includes('neste ato representada por José M. Santos, CPF nº 120.572.328-59'));
  assert.ok(htmlEmBranco('AUTORIZACAO', empresa, null).includes('obrigação de meio'));
});

teste('pré-visualização e impressão de vários', () => {
  const p = htmlEmBranco('PROPOSTA', empresa, null);
  assert.ok(p.includes('window.print') && !semImpressao(p).includes('window.print'));
  const juntos = juntarPaginas([p, htmlEmBranco('TABELA', empresa, null)]);
  assert.strictEqual(juntos.match(/window\.print/g)?.length, 1);
  assert.strictEqual(juntos.match(/<!doctype html>/g)?.length, 1);
  assert.ok(juntos.includes('page-break-before: always') && juntos.includes('Tabela de preços de referência'));
  assert.strictEqual(juntarPaginas([p]), p);
});

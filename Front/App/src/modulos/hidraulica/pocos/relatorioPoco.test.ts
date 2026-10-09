import dayjs from 'dayjs';
import {
  calcularFinanceiro, dataGarantia, deRascunho, deXml, encadear, paraRascunho, paraXml, progresso, proximoInicio, resumoTeste, SECOES_PADRAO, vazao,
} from './relatorioPoco';
import { gerarModelo } from './templatesPoco';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

// Parser XML mínimo (só para o teste em Node): tags, CDATA, texto e a declaração <?xml ?>
type No = { nodeType: number; nodeName: string; childNodes: No[]; textContent: string; getElementsByTagName: (t: string) => No[] };
const parser = {
  parseFromString(xml: string) {
    let i = 0;
    const elemento = (nome: string, filhos: No[]): No => {
      const no: No = {
        nodeType: 1, nodeName: nome, childNodes: filhos,
        get textContent() { return filhos.map(f => f.textContent).join(''); },
        getElementsByTagName: (t: string) => {
          const out: No[] = [];
          const andar = (n: No) => n.childNodes.forEach(c => { if (c.nodeType === 1) { if (t === '*' || c.nodeName === t) out.push(c); andar(c); } });
          andar(no);
          return out;
        },
      } as No;
      return no;
    };
    const texto = (t: string): No => ({ nodeType: 3, nodeName: '#text', childNodes: [], textContent: t, getElementsByTagName: () => [] });
    const ler = (): No => {
      const m = /^<([\w-]+)([^>]*?)(\/?)>/.exec(xml.slice(i));
      if (!m) throw new Error(`XML inesperado em ${i}`);
      i += m[0].length;
      const filhos: No[] = [];
      if (m[3]) return elemento(m[1], filhos);
      while (!xml.startsWith(`</${m[1]}>`, i)) {
        if (xml.startsWith('<![CDATA[', i)) { const f = xml.indexOf(']]>', i); filhos.push(texto(xml.slice(i + 9, f))); i = f + 3; }
        else if (xml[i] === '<') filhos.push(ler());
        else { const f = xml.indexOf('<', i); filhos.push(texto(xml.slice(i, f).replace(/^\s+$/, ''))); i = f; }
      }
      i += m[1].length + 3;
      return elemento(m[1], filhos);
    };
    xml = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
    const raiz = ler();
    const doc = elemento('#document', [raiz]);
    return { documentElement: raiz, getElementsByTagName: (t: string) => (t === 'parsererror' ? [] : doc.getElementsByTagName(t)) };
  },
};

export const runRelatorioPocoTests = (): void => {
  assert(dataGarantia('2026-03-10', 6) === '10/09/2026' && dataGarantia('', 6) === '' && dataGarantia('2026-03-10', 0) === '', 'Garantia = término + meses.');
  assert(vazao(5000, true) === '~5.000 L/h' && vazao(5000) === '5.000 L/h' && vazao('') === '', 'Vazão aproximada leva ~.');
  const camadas = encadear([{ perfDe: 0, perfAte: 35 }, { perfDe: 0, perfAte: 90 }, { perfDe: 0, perfAte: 120 }], 'perfDe', 'perfAte');
  assert(camadas.map(c => c.perfDe).join() === '0,35,90' && proximoInicio(camadas, 'perfAte') === 120, 'Camadas encadeadas: De = Até da anterior.');
  console.log('regras: ok');

  const d = {
    cliente: 'Sítio <Boa> Vista', profundidade: 120, vazaoAprox: 5000, vazaoAproxAproximada: true, dtTermino: dayjs('2026-03-10'), garantiaMeses: 6,
    perfuracoes: [{ perfDe: 0, perfAte: 35, perfDiam: 8, perfDiamUnidade: '"' }, { perfDe: 35, perfAte: 120, perfDiam: 6, perfDiamUnidade: '"' }],
    revestimentos: [{ revDe: 0, revAte: 35, revDiam: 6, revDiamUnidade: '"', revMaterial: 'PVC geomecânico', revUniao: 'Rosca' }],
    chkPresencaFerro: true, testeVazaoDados: 'Recuperou em 2 h',
  };
  const html = gerarModelo('completo', d, { secoes: SECOES_PADRAO, agora: dayjs('2026-04-01 10:00') });
  assert(html.includes('Sítio &lt;Boa&gt; Vista') && !html.includes('<Boa>'), 'Texto escapado.');
  assert(html.includes('~5.000 L/h') && html.includes('10/09/2026') && html.includes('PVC geomecânico') && html.includes('Recuperou em 2 h'), 'Campos no relatório.');
  assert(html.includes('class="anomalia sim"'), 'Anomalia marcada aparece em destaque.');
  const semTeste = gerarModelo('completo', d, { secoes: { ...SECOES_PADRAO, testeVazao: false, assinaturas: false } });
  assert(!semTeste.includes('Teste de vazão') && !semTeste.includes('class="assinaturas"'), 'Seção desligada não sai.');
  const branco = gerarModelo('branco', d, { secoes: SECOES_PADRAO });
  assert(!branco.includes('Boa') && branco.includes('Formulário de campo') && branco.includes('class="branco"'), 'Em branco não leva dados.');
  console.log('html: ok');

  const r = deRascunho(JSON.parse(JSON.stringify(paraRascunho(d))));
  assert(dayjs.isDayjs(r.dtTermino) && r.dtTermino.format('YYYY-MM-DD') === '2026-03-10', 'Rascunho guarda e devolve a data.');
  const volta = deXml(paraXml(d), parser);
  assert(volta.cliente === 'Sítio <Boa> Vista' && volta.profundidade === 120 && volta.vazaoAproxAproximada === true, 'XML ida e volta: campos.');
  assert(volta.perfuracoes.length === 2 && volta.perfuracoes[1].perfAte === 120 && volta.revestimentos[0].revMaterial === 'PVC geomecânico', 'XML ida e volta: listas.');
  assert(volta.dtTermino.format('DD/MM/YYYY') === '10/03/2026' && volta.chkPresencaFerro === true, 'XML ida e volta: data e checkbox.');
  const antigo = `<?xml version="1.0"?><relatorio_tecnico versao="1.0"><dados_cliente><cliente><![CDATA[João]]></cliente></dados_cliente>
    <dados_obra><vazaoAprox>~3000</vazaoAprox><dtTermino>2026-01-05T03:00:00.000Z</dtTermino></dados_obra>
    <especificacoes_estruturais><perfAte>40</perfAte><perfDiam>6</perfDiam><revMaterial><![CDATA[PVC]]></revMaterial></especificacoes_estruturais>
    <observacoes_perfuracao><chkCaimento>true</chkCaimento></observacoes_perfuracao></relatorio_tecnico>`;
  const v1 = deXml(antigo, parser);
  assert(v1.cliente === 'João' && v1.vazaoAprox === 3000 && v1.vazaoAproxAproximada === true && v1.chkCaimento === true, 'XML antigo: campos e vazão com ~.');
  assert(v1.perfuracoes[0].perfAte === 40 && v1.revestimentos[0].revMaterial === 'PVC' && dayjs.isDayjs(v1.dtTermino), 'XML antigo: listas e data.');
  console.log('arquivo: ok');

  assert(progresso(d, 'perfuracao').feitos === 4 && progresso({}, 'cliente').feitos === 0, 'Progresso por seção.');
  console.log('progresso: ok');

  // Caso real (Tábata): 60 m contratados por 18.000; poço com 90 m; excedente a 280/m
  const obra = { profundidade: 90, finMetrosContratados: 60, finValorContratado: 18000, finValorMetroExcedente: 280,
    finPagamentos: [{ data: dayjs('2026-09-01'), forma: 'PIX', valor: 10000 }, { data: '2026-09-20', forma: 'Dinheiro', valor: 5000 }] };
  const fin = calcularFinanceiro(obra);
  assert(fin.excedente === 30 && fin.valorExcedente === 8400 && fin.total === 26400, 'Total do poço: 18.000 + 30 m × 280 = 26.400.');
  assert(fin.pago === 15000 && fin.saldo === 11400, 'Saldo = total − pagamentos.');
  const raso = calcularFinanceiro({ ...obra, profundidade: 50, finPagamentos: [] });
  assert(raso.falta === 10 && raso.abatimento === 0 && raso.total === 18000, 'Poço mais raso: sem abatimento, salvo se marcado.');
  assert(calcularFinanceiro({ ...obra, profundidade: 50, finAbaterFalta: true, finPagamentos: [] }).total === 15000, 'Abatimento pelo valor do metro contratado (300).');
  assert(calcularFinanceiro({ ...obra, finAdicionais: [{ descricao: 'Bomba 1 HP', valor: 2500 }] }).total === 28900, 'Adicionais somam no total.');
  // toLocaleString usa espaço não separável depois do R$
  const cobr = gerarModelo('cobranca', { ...obra, cliente: 'Tábata' }, { secoes: SECOES_PADRAO, empresa: { pix: 'chave@pix.com' } }).replace(/ /g, ' ');
  assert(cobr.includes('R$ 26.400,00') && cobr.includes('R$ 8.400,00') && cobr.includes('Saldo a receber') && cobr.includes('R$ 11.400,00') && cobr.includes('chave@pix.com'), 'Cobrança com a conta e o PIX.');
  assert(!gerarModelo('completo', obra, { secoes: SECOES_PADRAO }).includes('Financeiro da obra'), 'Financeiro fora do relatório técnico por padrão.');
  console.log('financeiro: ok');

  const teste = resumoTeste({ bombaNivelEstatico: 20, testeLeituras: [{ tempo: 0, nivel: 20, vazao: 4000 }, { tempo: 60, nivel: 55, vazao: 3800 }, { tempo: 120, nivel: 60, vazao: 3800 }],
    testeRecuperacao: [{ tempo: 30, nivel: 30 }, { tempo: 60, nivel: 22 }] });
  assert(teste.nd === 60 && teste.rebaixamento === 40 && teste.vazaoM3h === 3.8 && teste.vazaoEspecifica === 0.095, 'Rebaixamento e vazão específica.');
  assert(teste.recuperacaoPct === 95, 'Recuperação: (60 − 22) / 40 = 95%.');
  const vz = gerarModelo('vazao', { cliente: 'X', bombaNivelEstatico: 20, testeLeituras: [{ tempo: 0, nivel: 20 }, { tempo: 60, nivel: 55 }] }, { secoes: SECOES_PADRAO });
  assert(vz.includes('<svg') && vz.includes('RELATÓRIO DE TESTE DE VAZÃO'), 'Relatório de vazão com gráfico.');
  assert(gerarModelo('garantia', { cliente: 'X', dtTermino: '2026-03-10', garantiaMeses: 12 }, { secoes: SECOES_PADRAO }).includes('10/03/2027'), 'Garantia com a validade.');
  const xmlFin = deXml(paraXml({ ...obra, testeLeituras: [{ tempo: 0, nivel: 20 }] }), parser);
  assert(xmlFin.finPagamentos.length === 2 && xmlFin.finPagamentos[1].valor === 5000 && dayjs.isDayjs(xmlFin.finPagamentos[0].data) && xmlFin.testeLeituras[0].nivel === 20,
    'Arquivo leva pagamentos (com data) e leituras.');
  console.log('modelos: ok');
};

runRelatorioPocoTests();

// Módulo Poços (HIDRAULICA_POCOS): regras puras, sem banco. Os dados vivem no navegador (rascunho) e em arquivo XML;
// os modelos de impressão estão em templatesPoco.ts.
import dayjs, { Dayjs } from 'dayjs';

export type Dados = Record<string, any>;

// Seções do relatório completo (as outras impressões têm layout próprio)
export type SecaoId = 'dadosPoco' | 'perfuracao' | 'diagnostico' | 'bombeamento' | 'testeVazao' | 'financeiro' | 'assinaturas';
export const SECOES: Array<{ id: SecaoId; titulo: string }> = [
  { id: 'dadosPoco', titulo: 'Dados do poço' },
  { id: 'perfuracao', titulo: 'Perfuração e revestimento' },
  { id: 'diagnostico', titulo: 'Diagnóstico técnico' },
  { id: 'bombeamento', titulo: 'Sistema de bombeamento' },
  { id: 'testeVazao', titulo: 'Teste de vazão' },
  { id: 'financeiro', titulo: 'Financeiro da obra' },
  { id: 'assinaturas', titulo: 'Assinaturas' },
];
// Financeiro fora por padrão: o relatório técnico costuma ir sem valores
export const SECOES_PADRAO: Record<SecaoId, boolean> = {
  dadosPoco: true, perfuracao: true, diagnostico: true, bombeamento: true, testeVazao: true, financeiro: false, assinaturas: true,
};

export interface Empresa {
  nome?: string; documento?: string; telefone?: string; cidade?: string;
  pix?: string; dadosPagamento?: string; textoGarantia?: string;
}
export const TEXTO_GARANTIA_PADRAO = 'A garantia cobre a execução da perfuração e do revestimento contra defeitos de construção. '
  + 'Não cobre: redução natural da vazão do aquífero, falta de energia ou oscilação da rede, uso fora das condições informadas, '
  + 'intervenção de terceiros e desgaste de bomba e acessórios (que seguem a garantia do fabricante).';

export const CAMPOS_DATA = ['dtLimpeza', 'dtInicio', 'dtTermino', 'bombaDtInstalacao'];
// Datas dentro das listas
export const LISTAS_DATA: Record<string, string[]> = { finPagamentos: ['data'] };

export const ANOMALIAS: Array<[string, string]> = [
  ['chkReducaoVazao', 'Queda de vazão'], ['chkPresencaFerro', 'Água vermelha / ferro'], ['chkAguaNaoLimpou', 'Água turva / areia'],
  ['chkLajeInfiltracao', 'Risco de infiltração na laje'], ['chkEnergiaRuim', 'Oscilação de energia'], ['chkAquecimentoBomba', 'Superaquecimento do motor'],
];
export const OCORRENCIAS_OBRA: Array<[string, string]> = [
  ['chkCaimento', 'Caimento / desmoronamento'], ['chkEstruturas', 'Interferência com estruturas subterrâneas'],
];
export const FORMAS_PAGAMENTO = ['PIX', 'Dinheiro', 'Transferência', 'Boleto', 'Cartão', 'Cheque'];

export const VALORES_INICIAIS: Dados = {
  diamInternoUnidade: '"',
  bombaTuboUnidade: '"',
  perfuracoes: [{ perfDe: 0, perfDiamUnidade: '"' }],
  revestimentos: [{ revDe: 0, revDiamUnidade: '"' }],
  finAdicionais: [],
  finPagamentos: [],
  testeLeituras: [],
  testeRecuperacao: [],
};

// ---------------------------------------------------------------- utilidades
export const vazio = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
export const n = (v: unknown) => (vazio(v) ? 0 : Number(String(v).replace(',', '.')) || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
export const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (v: unknown) => (vazio(v) ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
export const data = (v: unknown) => (vazio(v) ? '' : dayjs(v as any).isValid() ? dayjs(v as any).format('DD/MM/YYYY') : String(v));
export const com = (v: unknown, sufixo: string) => (vazio(v) ? '' : `${num(v)}${sufixo}`);
export const escapar = (t: unknown) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Vazão com "~" quando marcada como aproximada. */
export const vazao = (valor: unknown, aproximada?: boolean) => (vazio(valor) ? '' : `${aproximada ? '~' : ''}${num(valor)} L/h`);

export const dataGarantia = (dtTermino: unknown, meses: unknown): string => {
  if (vazio(dtTermino) || !(Number(meses) > 0)) return '';
  return dayjs(dtTermino as any).add(Number(meses), 'month').format('DD/MM/YYYY');
};

/** Próximo "De" de uma lista de camadas: o "Até" da última. */
export const proximoInicio = (lista: Array<Record<string, any>> | undefined, campoAte: string) => {
  const ultimo = (lista || [])[Math.max(0, (lista || []).length - 1)];
  return Number(ultimo?.[campoAte]) || 0;
};
/** Recalcula os "De" encadeados: cada camada começa onde a anterior terminou. */
export const encadear = (lista: Array<Record<string, any>> = [], campoDe: string, campoAte: string) =>
  lista.map((c, i) => ({ ...c, [campoDe]: i === 0 ? (Number(c?.[campoDe]) || 0) : (Number(lista[i - 1]?.[campoAte]) || 0) }));

/** Profundidade final: a informada ou, sem ela, o fundo da perfuração. */
export const profundidadeFinal = (d: Dados) =>
  n(d.profundidade) || (d.perfuracoes || []).reduce((m: number, c: Dados) => Math.max(m, n(c?.perfAte)), 0);

// ---------------------------------------------------------------- financeiro da obra
export interface Financeiro {
  contratados: number; valorContratado: number; profundidade: number;
  excedente: number; valorMetroExcedente: number; valorExcedente: number;
  falta: number; valorMetroFalta: number; abatimento: number;
  adicionais: Array<{ descricao: string; valor: number }>; totalAdicionais: number;
  total: number; pagamentos: Array<{ data: string; forma: string; valor: number; obs?: string }>; pago: number; saldo: number;
}
/**
 * Pacote contratado + metros a mais (preço do metro excedente) − metros a menos (só se marcado para abater)
 * + adicionais (bomba, instalação...) = total; total − pagamentos = saldo. Cada linha arredondada antes de somar.
 */
export const calcularFinanceiro = (d: Dados): Financeiro => {
  const contratados = n(d.finMetrosContratados);
  const valorContratado = r2(n(d.finValorContratado));
  const profundidade = profundidadeFinal(d);
  const temBase = contratados > 0 && profundidade > 0;
  const excedente = temBase ? Math.max(0, r2(profundidade - contratados)) : 0;
  const valorMetroExcedente = n(d.finValorMetroExcedente);
  const valorExcedente = r2(excedente * valorMetroExcedente);
  const falta = temBase ? Math.max(0, r2(contratados - profundidade)) : 0;
  const valorMetroFalta = n(d.finValorMetroFalta) || (contratados > 0 ? r2(valorContratado / contratados) : 0);
  const abatimento = d.finAbaterFalta ? r2(falta * valorMetroFalta) : 0;
  const adicionais = (d.finAdicionais || []).filter((a: Dados) => !vazio(a?.descricao) || n(a?.valor))
    .map((a: Dados) => ({ descricao: String(a.descricao || ''), valor: r2(n(a.valor)) }));
  const totalAdicionais = r2(adicionais.reduce((s: number, a: { valor: number }) => s + a.valor, 0));
  const total = r2(valorContratado + valorExcedente - abatimento + totalAdicionais);
  const pagamentos = (d.finPagamentos || []).filter((p: Dados) => n(p?.valor))
    .map((p: Dados) => ({ data: data(p.data), forma: String(p.forma || ''), valor: r2(n(p.valor)), obs: p.obs ? String(p.obs) : undefined }));
  const pago = r2(pagamentos.reduce((s: number, p: { valor: number }) => s + p.valor, 0));
  return { contratados, valorContratado, profundidade, excedente, valorMetroExcedente, valorExcedente, falta, valorMetroFalta, abatimento,
    adicionais, totalAdicionais, total, pagamentos, pago, saldo: r2(total - pago) };
};

// ---------------------------------------------------------------- teste de vazão
export interface Leitura { tempo: number; nivel: number; vazao?: number }
const leituras = (lista: Dados[] = []): Leitura[] => lista
  .filter(l => !vazio(l?.tempo) && !vazio(l?.nivel))
  .map(l => ({ tempo: n(l.tempo), nivel: n(l.nivel), vazao: vazio(l.vazao) ? undefined : n(l.vazao) }))
  .sort((a, b) => a.tempo - b.tempo);

export interface ResumoTeste {
  bombeamento: Leitura[]; recuperacao: Leitura[];
  ne: number | null; nd: number | null; rebaixamento: number | null; vazaoM3h: number | null; vazaoEspecifica: number | null;
  recuperacaoPct: number | null;
}
/**
 * NE e ND (do teste ou da instalação), rebaixamento s = ND − NE, vazão específica Q/s (m³/h por metro)
 * e quanto o nível recuperou no fim da recuperação (% do rebaixamento).
 */
export const resumoTeste = (d: Dados): ResumoTeste => {
  const bombeamento = leituras(d.testeLeituras);
  const recuperacao = leituras(d.testeRecuperacao);
  const ne = !vazio(d.bombaNivelEstatico) ? n(d.bombaNivelEstatico) : bombeamento.length ? bombeamento[0].nivel : null;
  const nd = bombeamento.length ? bombeamento[bombeamento.length - 1].nivel : (!vazio(d.bombaNivelDinamico) ? n(d.bombaNivelDinamico) : null);
  const rebaixamento = ne !== null && nd !== null && nd > ne ? r2(nd - ne) : null;
  const ultimaVazao = [...bombeamento].reverse().find(l => l.vazao !== undefined)?.vazao;
  const vazaoM3h = !vazio(d.testeVazaoEstabilizada) ? n(d.testeVazaoEstabilizada) : ultimaVazao !== undefined ? r2(ultimaVazao / 1000) : null;
  const vazaoEspecifica = vazaoM3h !== null && rebaixamento ? Math.round((vazaoM3h / rebaixamento) * 1000) / 1000 : null;
  const fimRec = recuperacao.length ? recuperacao[recuperacao.length - 1].nivel : null;
  const recuperacaoPct = rebaixamento && fimRec !== null && nd !== null ? Math.max(0, Math.min(100, Math.round(((nd - fimRec) / rebaixamento) * 100))) : null;
  return { bombeamento, recuperacao, ne, nd, rebaixamento, vazaoM3h, vazaoEspecifica, recuperacaoPct };
};

// ---------------------------------------------------------------- progresso (painel lateral)
export const CAMPOS_SECAO: Record<string, string[]> = {
  cliente: ['cliente', 'documento', 'celular', 'endereco', 'bairro', 'cidade', 'uf', 'cep'],
  dadosPoco: ['localizacao', 'dtLimpeza', 'vazaoAprox', 'profundidade', 'diametroInterno'],
  perfuracao: ['dtInicio', 'dtTermino', 'tipoSolo', 'garantiaMeses', 'perfuracoes', 'revestimentos', 'respNomePerf'],
  diagnostico: ['manutAmperagem', 'manutMegometro', 'manutPeriodicidadeLimpeza', 'manutDiretrizesTexto'],
  bombeamento: ['bombaMarca', 'imgMotorModelo', 'imgBombeadorModelo', 'bombaDtInstalacao', 'bombaProfundidade', 'bombaNivelEstatico', 'bombaNivelDinamico', 'bombaVazaoEstimada'],
  testeVazao: ['testeVazaoDuracao', 'testeVazaoMetodo', 'testeVazaoEstabilizada', 'testeLeituras', 'testeVazaoDados'],
  financeiro: ['finMetrosContratados', 'finValorContratado', 'finValorMetroExcedente', 'finPagamentos'],
};
export const progresso = (d: Dados, secao: string) => {
  const campos = CAMPOS_SECAO[secao] || [];
  const feitos = campos.filter(c => {
    const v = d[c];
    if (Array.isArray(v)) return v.some(l => Object.entries(l || {}).some(([k, x]) => !/De$|Unidade$/.test(k) && !vazio(x)));
    return !vazio(v);
  }).length;
  return { feitos, total: campos.length };
};

// ---------------------------------------------------------------- rascunho (datas viram texto e voltam)
const paraTexto = (v: unknown) => (v && dayjs.isDayjs(v) ? (v as Dayjs).format('YYYY-MM-DD') : (v || null));
const paraData = (v: unknown) => (v ? (dayjs(v as any).isValid() ? dayjs(v as any) : null) : null);
const converter = (v: Dados, f: (x: unknown) => unknown): Dados => {
  const out: Dados = { ...v };
  for (const c of CAMPOS_DATA) out[c] = f(v[c]);
  for (const [lista, campos] of Object.entries(LISTAS_DATA)) {
    if (Array.isArray(v[lista])) out[lista] = v[lista].map((item: Dados) => { const o = { ...item }; for (const c of campos) o[c] = f(item?.[c]); return o; });
  }
  return out;
};
export const paraRascunho = (v: Dados): Dados => converter(v, paraTexto);
export const deRascunho = (v: Dados): Dados => converter(v, paraData);

// ---------------------------------------------------------------- arquivo (XML): tudo, inclusive as listas
const LISTAS_XML: Record<string, string> = {
  perfuracoes: 'perfuracao', revestimentos: 'revestimento', finAdicionais: 'adicional', finPagamentos: 'pagamento',
  testeLeituras: 'leitura', testeRecuperacao: 'leitura',
};
const cdata = (t: unknown) => `<![CDATA[${String(t ?? '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

export const paraXml = (dados: Dados): string => {
  const d = paraRascunho(dados);
  const linhas = Object.keys(d).sort().map(k => {
    const v = d[k];
    if (Array.isArray(v)) {
      const tag = LISTAS_XML[k] || 'item';
      return `  <${k}>\n${v.map(item => `    <${tag}>${Object.entries(item || {}).filter(([, b]) => !vazio(b)).map(([a, b]) => `<${a}>${cdata(b)}</${a}>`).join('')}</${tag}>`).join('\n')}\n  </${k}>`;
    }
    if (vazio(v)) return null;
    return `  <${k}>${typeof v === 'boolean' ? String(v) : cdata(v)}</${k}>`;
  }).filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<relatorio_poco versao="3">\n${linhas.join('\n')}\n</relatorio_poco>\n`;
};

// Campos e subcampos numéricos (o resto volta como texto)
const NUMEROS = new Set(['profundidade', 'diametroInterno', 'vazaoAprox', 'garantiaMeses', 'manutAmperagem', 'manutMegometro', 'bombaQtdTubos', 'bombaTamTubo',
  'bombaProfundidade', 'bombaNivelEstatico', 'bombaNivelDinamico', 'bombaVazaoEstimada', 'testeVazaoDuracao', 'testeVazaoEstabilizada',
  'perfDe', 'perfAte', 'perfDiam', 'revDe', 'revAte', 'revDiam', 'finMetrosContratados', 'finValorContratado', 'finValorMetroExcedente', 'finValorMetroFalta',
  'valor', 'tempo', 'nivel', 'vazao']);
const valorDe = (k: string, txt: string): any => {
  if (txt === 'true' || txt === 'false') return txt === 'true';
  // Vazão antiga "~5000": fica como texto até marcar a aproximada (abaixo)
  if (/vazao/i.test(k) && txt.includes('~')) return txt;
  if (NUMEROS.has(k)) { const x = Number(txt.replace(',', '.')); return txt !== '' && Number.isFinite(x) ? x : null; }
  return txt;
};
const filhos = (no: any) => Array.from((no.childNodes || []) as ArrayLike<any>).filter((c: any) => c.nodeType === 1);

/** Lê o XML (versões 2/3 deste módulo, ou o antigo "relatorio_tecnico" com campos soltos). Datas voltam como dayjs. */
export const deXml = (texto: string, parser: { parseFromString(t: string, tipo: 'text/xml'): any }): Dados => {
  const doc = parser.parseFromString(texto, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Arquivo XML inválido.');
  const raiz = doc.documentElement;
  const d: Dados = {};
  if (raiz.nodeName === 'relatorio_poco') {
    for (const no of filhos(raiz)) {
      const k = no.nodeName;
      if (LISTAS_XML[k]) {
        d[k] = filhos(no).map((item: any) => {
          const o: Dados = {};
          for (const c of filhos(item)) o[c.nodeName] = valorDe(c.nodeName, c.textContent || '');
          return o;
        });
      } else d[k] = valorDe(k, no.textContent || '');
    }
  } else {
    // Formato antigo: campos soltos dentro de grupos; perfuração/revestimento com uma linha só
    const folhas = Array.from(raiz.getElementsByTagName('*') as ArrayLike<any>).filter((x: any) => x.childNodes.length && !filhos(x).length);
    for (const no of folhas) d[no.nodeName] = valorDe(no.nodeName, no.textContent || '');
    d.perfuracoes = [{ perfDe: d.perfDe ?? 0, perfAte: d.perfAte ?? null, perfDiam: d.perfDiam ?? null, perfDiamUnidade: '"' }];
    d.revestimentos = [{ revDe: d.revDe ?? 0, revAte: d.revAte ?? null, revDiam: d.revDiam ?? null, revDiamUnidade: '"', revMaterial: d.revMaterial || '', revUniao: d.revUniao || '' }];
    for (const k of ['perfDe', 'perfAte', 'perfDiam', 'revDe', 'revAte', 'revDiam', 'revMaterial', 'revUniao']) delete d[k];
  }
  for (const [k, flag] of [['vazaoAprox', 'vazaoAproxAproximada'], ['bombaVazaoEstimada', 'bombaVazaoAproximada']]) {
    if (typeof d[k] === 'string' && d[k].includes('~')) { d[flag] = true; d[k] = valorDe(k, d[k].replace(/~/g, '').trim()); }
  }
  return deRascunho(d);
};

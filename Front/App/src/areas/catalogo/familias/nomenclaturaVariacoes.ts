// Nome e SKU das variações de uma família, montados igual ao servidor (familias.controller › montarTextoTemplate):
// tokens reservados ({FAMILIA}, {SIGLA}, {S}, {VARIACAO}, {MARCA}) e atributos por id, nome ou código.
// Também diz o que falta em cada variação e quais SKUs ficariam repetidos, para a tela mostrar antes de salvar.
import { textoDoValor } from './CatalogManager.helpers';

export const CHAVE_MARCA = 'atributo-marca-virtual';
export type PapelMarca = 'ficha' | 'dna' | 'grade';

export interface AtributoNomenclatura {
  id: string;
  nome: string;
  codigo?: string;
  classificacao: string;
  tipoDado: string;
  obrigatorio?: boolean;
  opcoesValidas?: Array<string | { id?: string; valor: string; codigo?: string }>;
  valorPadraoFamilia?: string;
}

export interface FamiliaNomenclatura {
  nome: string;
  siglaSku?: string;
  separadorSku?: string;
  templateSku?: string;
  templateNomeComercial?: string;
  papelMarca?: PapelMarca;
  /** Marca da família ('' = sem marca) */
  marca?: string;
}

export interface VariacaoEditavel {
  idItem: string;
  skuAtual: string;
  nomeAtual: string;
  variacao?: string;
  /** Valores por id do atributo; a marca do item fica em CHAVE_MARCA */
  valores: Record<string, unknown>;
}

export const normalizarToken = (v: unknown) => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const vazio = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const marcaReal = (m: unknown) => !vazio(m) && normalizarToken(m) !== 'semmarca';

/** {Atributo:cod} usa o código da opção da lista (rosca 1.1/16"-12 → 12); o atributo é o da base. Igual ao servidor. */
export const SUFIXO_CODIGO = /\s*:\s*(cod|codigo|código)\s*$/i;
export const baseDoToken = (t: string) => String(t ?? '').replace(SUFIXO_CODIGO, '').trim();

/** Tokens pela base ("{Rosca:cod}" → "Rosca"). */
export const tokensDoTemplate = (template?: string): string[] => Array.from(new Set(
  ((template || '').match(/\{([^}]+)\}|\[([^\]]+)\]/g) || []).map(t => baseDoToken(t.replace(/^[[{]/, '').replace(/[\]}]$/, ''))).filter(Boolean),
));

export const RESERVADOS = ['familia', 'grupo', 'sigla', 's', 'separador', 'variacao', 'marca'];

export const marcaEfetiva = (papel: PapelMarca | undefined, marcaFamilia?: string, marcaItem?: unknown): string => {
  const fam = marcaReal(marcaFamilia) ? String(marcaFamilia) : '';
  const item = marcaReal(marcaItem) ? String(marcaItem) : '';
  if (papel === 'dna') return fam;
  if (papel === 'grade') return item;
  return item || fam;
};

const atributoDoToken = (atributos: AtributoNomenclatura[], token: string) => {
  const t = normalizarToken(token);
  return atributos.find(a => [a.id, a.nome, a.codigo].some(x => !vazio(x) && normalizarToken(x) === t));
};

/** Valor do atributo no item; vazio usa o valor padrão da família (DNA fixo), como o servidor. */
export const valorDoAtributo = (a: AtributoNomenclatura, valores: Record<string, unknown>): unknown => {
  const v = valores[a.id];
  return vazio(v) ? (vazio(a.valorPadraoFamilia) ? undefined : a.valorPadraoFamilia) : v;
};

/** Texto do template com os valores; o que faltar sai como [Token]. */
export const montarTexto = (
  template: string | undefined, familia: FamiliaNomenclatura, atributos: AtributoNomenclatura[],
  valores: Record<string, unknown>, variacao = 'Principal',
): string => (template || '').replace(/\{([^}]+)\}|\[([^\]]+)\]/g, (_m, a, b) => {
  const token = String(a || b || '').trim();
  const usaCodigo = SUFIXO_CODIGO.test(token);
  const reservados: Record<string, string> = {
    familia: familia.nome, grupo: familia.nome, sigla: familia.siglaSku || '', s: familia.separadorSku ?? '-',
    separador: familia.separadorSku ?? '-', variacao, marca: marcaEfetiva(familia.papelMarca, familia.marca, valores[CHAVE_MARCA]),
  };
  const chave = normalizarToken(baseDoToken(token));
  if (Object.prototype.hasOwnProperty.call(reservados, chave)) return reservados[chave] || (chave === 'marca' ? `[${token}]` : '');
  const atributo = atributoDoToken(atributos, baseDoToken(token));
  if (!atributo) return `[${token}]`;
  const valor = valorDoAtributo(atributo, valores);
  if (vazio(valor)) return `[${token}]`;
  if (!usaCodigo) return textoDoValor(valor);
  const codigo = codigoDaOpcao(atributo, valor);
  return codigo || `[${token}]`;
});

/** Código cadastrado da opção escolhida ('' quando não tem). */
export const codigoDaOpcao = (a: AtributoNomenclatura, valor: unknown): string => {
  const opcao = (a.opcoesValidas || []).find(o => typeof o !== 'string' && normalizarToken(o.valor) === normalizarToken(valor));
  return opcao && typeof opcao !== 'string' && opcao.codigo ? String(opcao.codigo).trim() : '';
};

/** Atributos usados no nome ou no SKU (por id). */
export const atributosNosTemplates = (familia: FamiliaNomenclatura, atributos: AtributoNomenclatura[]) => {
  const ids = new Set<string>();
  [...tokensDoTemplate(familia.templateSku), ...tokensDoTemplate(familia.templateNomeComercial)].forEach(t => {
    const a = atributoDoToken(atributos, t);
    if (a) ids.add(a.id);
  });
  return ids;
};

export const opcoesDoAtributo = (a: AtributoNomenclatura): string[] =>
  (a.opcoesValidas || []).map(o => (typeof o === 'string' ? o : o.valor)).filter(Boolean);

export interface AvaliacaoVariacao {
  nomeNovo: string;
  skuNovo: string;
  /** Nome do atributo + motivo */
  pendencias: string[];
  mudaNome: boolean;
  mudaSku: boolean;
  pronta: boolean;
}

export const avaliarVariacao = (v: VariacaoEditavel, familia: FamiliaNomenclatura, atributos: AtributoNomenclatura[]): AvaliacaoVariacao => {
  const usados = atributosNosTemplates(familia, atributos);
  const pendencias: string[] = [];
  for (const a of atributos) {
    const valor = valorDoAtributo(a, v.valores);
    if (vazio(valor)) {
      if (usados.has(a.id)) pendencias.push(`${a.nome}: usado no nome/SKU`);
      else if (a.obrigatorio) pendencias.push(`${a.nome}: obrigatório`);
      continue;
    }
    const opcoes = opcoesDoAtributo(a);
    if (a.tipoDado === 'lista' && opcoes.length && !opcoes.some(o => normalizarToken(o) === normalizarToken(valor))) {
      pendencias.push(`${a.nome}: "${valor}" não está na lista`);
    }
    if ((a.tipoDado === 'numero' || a.tipoDado === 'decimal') && !Number.isFinite(Number(String(valor).replace(',', '.')))) {
      pendencias.push(`${a.nome}: precisa ser número`);
    }
  }
  const usaMarca = [...tokensDoTemplate(familia.templateSku), ...tokensDoTemplate(familia.templateNomeComercial)].some(t => normalizarToken(t) === 'marca');
  if (familia.papelMarca === 'grade' && !marcaReal(v.valores[CHAVE_MARCA])) pendencias.push('Marca: a marca gera variação nesta família');
  else if (usaMarca && !marcaEfetiva(familia.papelMarca, familia.marca, v.valores[CHAVE_MARCA])) pendencias.push('Marca: usada no nome/SKU');

  const nomeNovo = montarTexto(familia.templateNomeComercial, familia, atributos, v.valores, v.variacao);
  const skuNovo = montarTexto(familia.templateSku, familia, atributos, v.valores, v.variacao);
  const pronta = pendencias.length === 0 && !nomeNovo.includes('[') && !skuNovo.includes('[');
  return { nomeNovo, skuNovo, pendencias, mudaNome: nomeNovo !== v.nomeAtual, mudaSku: skuNovo !== v.skuAtual, pronta };
};

/** SKUs novos que se repetem dentro da família (ignorando maiúsculas). */
export const skusRepetidos = (avaliacoes: AvaliacaoVariacao[]): Set<string> => {
  const vistos = new Map<string, number>();
  avaliacoes.filter(a => a.pronta).forEach(a => vistos.set(a.skuNovo.toUpperCase(), (vistos.get(a.skuNovo.toUpperCase()) || 0) + 1));
  return new Set([...vistos.entries()].filter(([, n]) => n > 1).map(([s]) => s));
};

/** Valores alterados em relação ao original (para saber o que salvar). */
export const valoresMudaram = (antes: Record<string, unknown>, depois: Record<string, unknown>) =>
  Object.keys({ ...antes, ...depois }).some(k => String(antes[k] ?? '').trim() !== String(depois[k] ?? '').trim());

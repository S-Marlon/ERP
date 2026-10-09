// Saúde da família (regras do documento de arquitetura do PIM) e regra de publicação por item.
// Funções puras: recebem os dados já carregados e devolvem o diagnóstico.

import { baseDoToken } from '../atributos/atributosRegras';

export type PapelAtributo = 'dna' | 'grade' | 'ficha';

export interface AtributoEfetivo {
  id: string;
  nome: string;
  codigo?: string | null;
  classificacao: PapelAtributo | string;
  obrigatorio: boolean;
  compoeSku?: boolean;
  valorPadraoGrupo?: string | null;
  origem?: string; // 'herdados' (da categoria) | 'locais' (da família)
}

export interface FamiliaParaSaude {
  status: string;
  templateSku?: string | null;
  templateNomeComercial?: string | null;
  siglaSku?: string | null;
  comportamentoMarca?: string | null;
  nomeMarca?: string | null;
}

export interface Problema {
  codigo: string;
  mensagem: string;
}

export interface SaudeFamilia {
  saudavel: boolean;
  bloqueios: Problema[];
  avisos: Problema[];
}

// Tokens com significado fixo nos templates
export const TOKENS_RESERVADOS = ['familia', 'grupo', 'sigla', 's', 'separador', 'variacao', 'marca'];

export const normalizarToken = (valor: unknown): string => String(valor ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

// Tokens pela base: "{Rosca:cod}" usa o atributo Rosca
export const extrairTokens = (template?: string | null): string[] => Array.from(new Set(
  (template || '').match(/\{([^}]+)\}|\[([^\]]+)\]/g)?.map(t => baseDoToken(t.replace(/^[[{]/, '').replace(/[\]}]$/, ''))) || []
));

const casaAtributo = (token: string, attr: AtributoEfetivo) =>
  [attr.id, attr.nome, attr.codigo].some(alias => normalizarToken(alias) === normalizarToken(token));

const vazio = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/**
 * Regras mínimas de uma família para estar ATIVA:
 * - ao menos um atributo de grade (o que diferencia os itens);
 * - todo atributo de DNA com valor fixo definido na família;
 * - templates de código/nome só com tokens conhecidos;
 * - sigla definida se o template usa {SIGLA}.
 */
export const avaliarSaudeFamilia = (familia: FamiliaParaSaude, atributos: AtributoEfetivo[]): SaudeFamilia => {
  const bloqueios: Problema[] = [];
  const avisos: Problema[] = [];

  const marcaEhGrade = familia.comportamentoMarca === 'grade';
  const grades = atributos.filter(a => a.classificacao === 'grade');
  if (grades.length === 0 && !marcaEhGrade) {
    bloqueios.push({ codigo: 'SEM_GRADE', mensagem: 'A família não tem nenhum atributo de grade (o que diferencia um item do outro).' });
  }

  const dnaSemValor = atributos.filter(a => a.classificacao === 'dna' && vazio(a.valorPadraoGrupo));
  if (dnaSemValor.length > 0) {
    bloqueios.push({
      codigo: 'DNA_SEM_VALOR',
      mensagem: `Atributos de DNA sem valor fixo na família: ${dnaSemValor.map(a => a.nome).join(', ')}.`,
    });
  }

  const tokensSku = extrairTokens(familia.templateSku);
  const tokensNome = extrairTokens(familia.templateNomeComercial);
  const desconhecidos = [...new Set([...tokensSku, ...tokensNome])].filter(t =>
    !TOKENS_RESERVADOS.includes(normalizarToken(t)) && !atributos.some(a => casaAtributo(t, a)));
  if (desconhecidos.length > 0) {
    bloqueios.push({
      codigo: 'TOKEN_DESCONHECIDO',
      mensagem: `O template usa atributos que não existem na família: ${desconhecidos.map(t => `{${t}}`).join(', ')}.`,
    });
  }

  // Marca como DNA: a família precisa de uma marca real ("Sem Marca" não serve)
  const nomeMarcaNorm = normalizarToken(familia.nomeMarca);
  if (familia.comportamentoMarca === 'dna' && (nomeMarcaNorm === '' || nomeMarcaNorm === 'semmarca')) {
    bloqueios.push({ codigo: 'MARCA_DNA_SEM_VALOR', mensagem: 'A marca é DNA desta família, mas a família não tem marca definida.' });
  }
  if (marcaEhGrade && !tokensSku.some(t => normalizarToken(t) === 'marca')) {
    avisos.push({ codigo: 'MARCA_FORA_DO_CODIGO', mensagem: 'A marca gera variação, mas {MARCA} não está no template do código: itens que só diferem na marca teriam o mesmo SKU.' });
  }

  const usaSigla = [...tokensSku, ...tokensNome].some(t => normalizarToken(t) === 'sigla');
  if (usaSigla && vazio(familia.siglaSku)) {
    bloqueios.push({ codigo: 'SIGLA_VAZIA', mensagem: 'O template usa {SIGLA}, mas a sigla da família não foi definida.' });
  }

  const gradeNoCodigo = grades.some(g => tokensSku.some(t => casaAtributo(t, g)))
    || tokensSku.some(t => normalizarToken(t) === 'variacao')
    || (marcaEhGrade && tokensSku.some(t => normalizarToken(t) === 'marca'));
  if ((grades.length > 0 || marcaEhGrade) && !gradeNoCodigo) {
    avisos.push({ codigo: 'GRADE_FORA_DO_CODIGO', mensagem: 'Nenhum atributo de grade entra no código: as variações podem ficar com o mesmo SKU.' });
  }

  return { saudavel: bloqueios.length === 0, bloqueios, avisos };
};

/**
 * Status gravado após salvar: a família "quer" estar ativa (ATIVO ou BLOQUEADO) e só fica ATIVA se saudável.
 * RASCUNHO e INATIVO são escolhas do gestor e não mudam.
 */
export const statusAposSaude = (statusDesejado: string, saude: SaudeFamilia): string => {
  const status = String(statusDesejado || 'RASCUNHO').toUpperCase();
  if (status === 'ATIVO' || status === 'BLOQUEADO_INCONSISTENCIA') {
    return saude.saudavel ? 'ATIVO' : 'BLOQUEADO_INCONSISTENCIA';
  }
  return status;
};

/**
 * Atributos efetivos de uma família: os da categoria + os próprios (o próprio sobrescreve o herdado).
 * Também serve para item sem família, que herda direto da categoria ("família virtual").
 */
export const mesclarAtributos = <T extends { id: string }>(herdados: T[], locais: T[]): T[] => {
  const mapa = new Map<string, T>();
  herdados.forEach(a => mapa.set(String(a.id), a));
  locais.forEach(a => mapa.set(String(a.id), a));
  return Array.from(mapa.values());
};

// ---------------------------------------------------------------------------
// Publicação por item (gatekeeper): o que o PDV/canais podem exibir
// ---------------------------------------------------------------------------

export interface ItemParaPublicacao {
  statusItem: string;           // itens_core.status
  exibirNoPdv: boolean;         // comercial_produtos_dados.exibir_no_pdv
  statusFamilia: string | null; // null = item sem família
  obrigatorios: AtributoEfetivo[];
  atributosComValor: Set<string>; // ids de atributos com valor preenchido no item
}

export interface Publicacao {
  publicavel: boolean;
  motivos: string[];
}

export const avaliarPublicacao = (item: ItemParaPublicacao): Publicacao => {
  const motivos: string[] = [];
  if (String(item.statusItem).toUpperCase() === 'INATIVO') motivos.push('Item inativo');
  if (!item.exibirNoPdv) motivos.push('Oculto no PDV');

  const statusFamilia = item.statusFamilia ? String(item.statusFamilia).toUpperCase() : null;
  if (statusFamilia === 'RASCUNHO') motivos.push('Família em rascunho');
  else if (statusFamilia === 'INATIVO') motivos.push('Família inativa');
  else if (statusFamilia === 'BLOQUEADO_INCONSISTENCIA') motivos.push('Família bloqueada por inconsistência');

  // DNA com valor fixo na família já está resolvido para todos os itens
  const faltando = item.obrigatorios.filter(a =>
    !item.atributosComValor.has(String(a.id)) && !(a.classificacao === 'dna' && !vazio(a.valorPadraoGrupo)));
  if (faltando.length > 0) motivos.push(`Obrigatórios sem valor: ${faltando.map(a => a.nome).join(', ')}`);

  return { publicavel: motivos.length === 0, motivos };
};

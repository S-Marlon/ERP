// Regras puras da edição de atributos e das opções de lista: travas (total/parcial) conforme o uso,
// impacto de renomear/mudar o código de uma opção e plano para converter um atributo de texto em lista.
import { baseDoToken, codigoOpcao, normalizarTexto, tokenUsaCodigo } from './atributosRegras';

const normalizarToken = (v: unknown) => normalizarTexto(v).replace(/[^a-z0-9]/g, '');

/** Como o template usa o atributo: pelo texto ({Bitola}) e/ou pelo código da opção ({Bitola:cod}). */
export const usoNoTemplate = (template: string | null | undefined, aliases: Array<string | number | null | undefined>) => {
  const alvos = aliases.filter(a => a !== null && a !== undefined && String(a).trim() !== '').map(normalizarToken);
  const r = { texto: false, codigo: false };
  for (const t of (template || '').match(/\{([^}]+)\}|\[([^\]]+)\]/g) || []) {
    const chave = t.replace(/^[[{]/, '').replace(/[\]}]$/, '');
    if (!alvos.includes(normalizarToken(baseDoToken(chave)))) continue;
    if (tokenUsaCodigo(chave)) r.codigo = true;
    else r.texto = true;
  }
  return r;
};

export interface FamiliaNoTemplate {
  nome: string;
  noNome: { texto: boolean; codigo: boolean };
  noSku: { texto: boolean; codigo: boolean };
}

export type NivelTrava = 'livre' | 'aviso' | 'bloqueado';

/**
 * Impacto de mudar o texto e/ou o código de uma opção usada por itens: os itens continuam apontando para a opção
 * (o vínculo é pelo id), mas o nome/SKU das famílias que usam o texto/código muda na próxima gravação das variações.
 */
export const impactoEdicaoOpcao = (p: { itens: number; familias: FamiliaNoTemplate[]; mudaValor: boolean; mudaCodigo: boolean }) => {
  const afetaNome = p.familias.filter(f => (p.mudaValor && f.noNome.texto) || (p.mudaCodigo && f.noNome.codigo)).map(f => f.nome);
  const afetaSku = p.familias.filter(f => (p.mudaValor && f.noSku.texto) || (p.mudaCodigo && f.noSku.codigo)).map(f => f.nome);
  const mensagens: string[] = [];
  const lista = (nomes: string[]) => (nomes.length > 4 ? `${nomes.slice(0, 4).join(', ')} e mais ${nomes.length - 4}` : nomes.join(', '));
  if (p.itens > 0 && (p.mudaValor || p.mudaCodigo)) mensagens.push(`${p.itens} item(ns) usam esta opção e passam a mostrar o valor novo.`);
  if (afetaNome.length) mensagens.push(`O nome comercial muda (ao gravar as variações) nas famílias: ${lista(afetaNome)}.`);
  if (afetaSku.length) mensagens.push(`O SKU muda (ao gravar as variações) nas famílias: ${lista(afetaSku)}. Etiquetas impressas ficam desatualizadas.`);
  const nivel: NivelTrava = afetaSku.length || afetaNome.length ? 'aviso' : 'livre';
  return { nivel, afetaNome, afetaSku, mensagens };
};

/** Confere valor e código de uma opção nova/editada contra as demais do atributo. */
export const validarOpcao = (
  opcoes: Array<{ id: number; valor: string; codigo: string | null }>,
  idOpcao: number | null,
  valor: string,
  codigo: string | null
): string | null => {
  const v = String(valor ?? '').trim();
  if (!v) return 'Informe o valor da opção.';
  if (v.length > 100) return 'Valor muito longo (máx. 100).';
  if (codigo !== null && codigo !== undefined && codigo !== '' && !/^[A-Za-z0-9._-]{1,20}$/.test(codigo)) {
    return 'Código inválido: use letras, números, ponto, hífen ou _ (até 20).';
  }
  const outras = opcoes.filter(o => o.id !== idOpcao);
  const igualValor = outras.find(o => normalizarTexto(o.valor) === normalizarTexto(v));
  if (igualValor) return `Já existe a opção "${igualValor.valor}" neste atributo (use mesclar para juntar).`;
  if (codigo && outras.some(o => String(o.codigo || '').toUpperCase() === codigo.toUpperCase())) {
    return `O código ${codigo} já é de outra opção deste atributo.`;
  }
  return null;
};

/**
 * Travas do atributo conforme o uso. Total = não deixa mudar; parcial = deixa com aviso do que acontece.
 */
export const travasDoAtributo = (u: {
  itens: number; vinculos: number; familiasTemplate: FamiliaNoTemplate[]; tipo: string;
}) => {
  const nomesTemplate = u.familiasTemplate.map(f => f.nome);
  const trava = (nivel: NivelTrava, motivo = '') => ({ nivel, motivo });
  return {
    tipo: u.itens > 0
      ? trava('bloqueado', `${u.itens} item(ns) já têm valor: cada tipo grava numa coluna diferente. Para texto → lista use "Converter em lista".`)
      : trava('livre'),
    nome: nomesTemplate.length
      ? trava('bloqueado', `Usado no modelo de nome/SKU das famílias: ${nomesTemplate.join(', ')}. Ajuste os modelos antes (ou mescle).`)
      : trava('livre'),
    codigo: nomesTemplate.length
      ? trava('bloqueado', `Usado no modelo de nome/SKU das famílias: ${nomesTemplate.join(', ')}.`)
      : u.itens + u.vinculos > 0 ? trava('aviso', 'Em uso: integrações que leem pelo código técnico deixam de achar o atributo.') : trava('livre'),
    unidade: u.itens > 0 ? trava('aviso', 'Mudar a unidade não converte os números já gravados nos itens.') : trava('livre'),
    escopo: u.vinculos > 0 ? trava('aviso', 'É só o padrão para vínculos novos: famílias/categorias já ligadas mantêm o papel delas.') : trava('livre'),
    excluir: u.itens + u.vinculos > 0
      ? trava('bloqueado', `Em uso: ${u.itens} item(ns) com valor e ${u.vinculos} vínculo(s). Mescle com outro atributo ou remova os vínculos.`)
      : trava('livre'),
  };
};

/**
 * Converter texto em lista: agrupa os valores escritos igual (sem diferenciar maiúscula/acento/espaço),
 * fica com a grafia mais usada de cada grupo e gera o código da opção.
 */
export const planoConversaoLista = (valores: Array<{ texto: string; qtd: number }>) => {
  const grupos = new Map<string, { variantes: Map<string, number>; qtd: number }>();
  for (const v of valores) {
    const texto = String(v.texto ?? '').trim().replace(/\s+/g, ' ');
    const chave = normalizarTexto(texto);
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, { variantes: new Map(), qtd: 0 });
    const g = grupos.get(chave)!;
    g.variantes.set(texto, (g.variantes.get(texto) || 0) + v.qtd);
    g.qtd += v.qtd;
  }
  const opcoes = [...grupos.values()]
    .map(g => {
      const valor = [...g.variantes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      return { valor, variantes: [...g.variantes.keys()].filter(x => x !== valor), qtd: g.qtd };
    })
    .sort((a, b) => b.qtd - a.qtd || a.valor.localeCompare(b.valor))
    .map((o, i) => ({ ...o, codigo: codigoOpcao(o.valor, i + 1) }));
  return { opcoes, aviso: opcoes.length > 60 ? `São ${opcoes.length} valores diferentes: lista grande demais, talvez deva continuar texto.` : null };
};

/** Soma os impactos de várias opções alteradas de uma vez (salvar todas): uma confirmação só. */
export const impactoDoLote = (impactos: Array<{ itens: number; afetaNome: string[]; afetaSku: string[] }>) => {
  const nome = [...new Set(impactos.flatMap(i => i.afetaNome))];
  const sku = [...new Set(impactos.flatMap(i => i.afetaSku))];
  const itens = impactos.reduce((a, i) => a + i.itens, 0);
  const lista = (nomes: string[]) => (nomes.length > 4 ? `${nomes.slice(0, 4).join(', ')} e mais ${nomes.length - 4}` : nomes.join(', '));
  const mensagens: string[] = [];
  if (itens > 0) mensagens.push(`${impactos.length} opção(ões) alterada(s), usadas por ${itens} item(ns): eles passam a mostrar o valor novo.`);
  if (nome.length) mensagens.push(`O nome comercial muda (ao gravar as variações) nas famílias: ${lista(nome)}.`);
  if (sku.length) mensagens.push(`O SKU muda (ao gravar as variações) nas famílias: ${lista(sku)}. Etiquetas impressas ficam desatualizadas.`);
  return { nivel: (nome.length || sku.length ? 'aviso' : 'livre') as NivelTrava, afetaNome: nome, afetaSku: sku, mensagens };
};

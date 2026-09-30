// Regras puras do pool de atributos globais (sem banco).

export const normalizarTexto = (v: unknown): string => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const normalizarToken = (v: unknown): string => normalizarTexto(v).replace(/[^a-z0-9]/g, '');

export interface OpcaoExistente {
  id: number;
  valor: string;
  emUso: boolean; // algum item usa esta opção
}

export interface DiferencaOpcoes {
  manter: Array<{ id: number; ordem: number }>;
  inserir: Array<{ valor: string; ordem: number }>;
  desativar: number[];            // opções sem uso que saíram da lista
  bloqueadas: string[];           // opções em uso que o usuário tentou remover
}

/**
 * Compara a lista desejada com as opções atuais preservando os ids (os valores dos itens apontam para eles).
 * Casa por valor sem diferenciar maiúsculas/acentos.
 */
export const diferencaOpcoes = (atuais: OpcaoExistente[], desejadas: string[]): DiferencaOpcoes => {
  const vistas = new Set<string>();
  const lista = desejadas.map(v => String(v).trim()).filter(v => {
    const chave = normalizarTexto(v);
    if (!chave || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  const porValor = new Map(atuais.map(o => [normalizarTexto(o.valor), o]));
  const resultado: DiferencaOpcoes = { manter: [], inserir: [], desativar: [], bloqueadas: [] };

  lista.forEach((valor, i) => {
    const existente = porValor.get(normalizarTexto(valor));
    if (existente) resultado.manter.push({ id: existente.id, ordem: i + 1 });
    else resultado.inserir.push({ valor, ordem: i + 1 });
  });

  for (const opcao of atuais) {
    if (vistas.has(normalizarTexto(opcao.valor))) continue;
    if (opcao.emUso) resultado.bloqueadas.push(opcao.valor);
    else resultado.desativar.push(opcao.id);
  }
  return resultado;
};

// Código técnico de opção a partir do valor (ex: "Aço Inox" -> "ACO_INOX")
export const codigoOpcao = (valor: string, indice: number): string => {
  const codigo = String(valor).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return codigo || `OPC_${indice}`;
};

// Tokens de template que apontam para o atributo (os templates casam por id, nome ou código)
export const templateUsaAtributo = (template: string | null | undefined, aliases: Array<string | number | null | undefined>): boolean => {
  const alvos = aliases.filter(a => a !== null && a !== undefined && String(a).trim() !== '').map(normalizarToken);
  return ((template || '').match(/\{([^}]+)\}|\[([^\]]+)\]/g) || [])
    .some(t => alvos.includes(normalizarToken(t.replace(/^[[{]/, '').replace(/[\]}]$/, ''))));
};

/**
 * Troca, no template, os tokens que apontam para o atributo de origem pelo código do destino
 * (usado ao mesclar atributos duplicados).
 */
export const trocarTokenTemplate = (
  template: string | null | undefined,
  aliasesOrigem: Array<string | number | null | undefined>,
  codigoDestino: string
): string => {
  const alvos = aliasesOrigem.filter(a => a !== null && a !== undefined && String(a).trim() !== '').map(normalizarToken);
  return (template || '').replace(/\{([^}]+)\}|\[([^\]]+)\]/g, (token, chave1, chave2) => {
    const chave = String(chave1 ?? chave2 ?? '');
    if (!alvos.includes(normalizarToken(chave))) return token;
    return token.startsWith('{') ? `{${codigoDestino}}` : `[${codigoDestino}]`;
  });
};

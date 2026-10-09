// Regras puras do pool de atributos globais (sem banco).

export const normalizarTexto = (v: unknown): string => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const normalizarToken = (v: unknown): string => normalizarTexto(v).replace(/[^a-z0-9]/g, '');

/**
 * Token com ":cod" usa o código da opção da lista em vez do texto: {Rosca JIC} → 1.1/16"-12, {Rosca JIC:cod} → 12.
 * Para saber qual atributo o token usa, vale só a base ("Rosca JIC").
 */
export const SUFIXO_CODIGO = /\s*:\s*(cod|codigo|código)\s*$/i;
export const baseDoToken = (token: string): string => String(token ?? '').replace(SUFIXO_CODIGO, '').trim();
export const tokenUsaCodigo = (token: string): boolean => SUFIXO_CODIGO.test(String(token ?? ''));

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

/**
 * Opção digitada como "texto = código" (ex.: '1.1/16"-12 = 12'): o texto vai no nome do item e o código no SKU
 * ({Atributo:cod}). Sem "=", o código é gerado do texto. Código: letras, números, ponto, hífen e sublinhado.
 */
export const separarOpcaoCodigo = (texto: string): { valor: string; codigo: string | null } => {
  const t = String(texto ?? '').trim();
  const m = t.match(/^(.*\S)\s*=\s*([A-Za-z0-9._-]{1,20})$/);
  return m ? { valor: m[1].trim(), codigo: m[2] } : { valor: t, codigo: null };
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
    .some(t => alvos.includes(normalizarToken(baseDoToken(t.replace(/^[[{]/, '').replace(/[\]}]$/, '')))));
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
    if (!alvos.includes(normalizarToken(baseDoToken(chave)))) return token;
    const destino = tokenUsaCodigo(chave) ? `${codigoDestino}:cod` : codigoDestino;
    return token.startsWith('{') ? `{${destino}}` : `[${destino}]`;
  });
};

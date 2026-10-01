// Suspeitas de itens duplicados no catálogo: mesmo código de um fornecedor em itens diferentes,
// ou nomes iguais depois de normalizados (acentos, caixa, pontuação, ordem das palavras, marcas como "[NOVO]").

export interface ItemParaDuplicidade {
  idItem: number;
  nome: string;
}

export interface CodigoFornecedorItem {
  idFornecedor: number;
  fornecedor: string | null;
  codigo: string;
  idItem: number;
}

export interface GrupoDuplicados {
  chave: string;
  motivo: 'MESMO_CODIGO_FORNECEDOR' | 'NOME_IGUAL';
  descricao: string;
  idsItens: number[];
}

const PALAVRAS_DESCARTADAS = new Set(['novo', 'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'p', 'c']);

export const normalizarNome = (nome: string): string =>
  String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')          // [NOVO], [TESTE]...
    .replace(/(\d),(\d)/g, '$1.$2')        // 1,5 = 1.5
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(' ')
    .map(p => p.replace(/^\.+|\.+$/g, ''))
    .filter(p => p && !PALAVRAS_DESCARTADAS.has(p))
    .sort()
    .join(' ');

export const agruparDuplicados = (itens: ItemParaDuplicidade[], codigos: CodigoFornecedorItem[]): GrupoDuplicados[] => {
  const grupos: GrupoDuplicados[] = [];
  const ativos = new Set(itens.map(i => i.idItem));

  // 1. Mesmo código do mesmo fornecedor em itens diferentes
  const porCodigo = new Map<string, { c: CodigoFornecedorItem; ids: Set<number> }>();
  for (const c of codigos) {
    const codigo = String(c.codigo || '').trim().toUpperCase();
    if (!codigo || !ativos.has(c.idItem)) continue;
    const chave = `${c.idFornecedor}|${codigo}`;
    if (!porCodigo.has(chave)) porCodigo.set(chave, { c, ids: new Set() });
    porCodigo.get(chave)!.ids.add(c.idItem);
  }
  for (const [chave, { c, ids }] of porCodigo) {
    if (ids.size > 1) {
      grupos.push({
        chave: `forn:${chave}`,
        motivo: 'MESMO_CODIGO_FORNECEDOR',
        descricao: `Código ${c.codigo} de ${c.fornecedor || `fornecedor #${c.idFornecedor}`} em ${ids.size} itens`,
        idsItens: [...ids].sort((a, b) => a - b),
      });
    }
  }

  // 2. Mesmo nome normalizado (grupos já cobertos pelo código do fornecedor não se repetem)
  const jaAgrupados = new Set(grupos.map(g => g.idsItens.join(',')));
  const porNome = new Map<string, number[]>();
  for (const i of itens) {
    const chave = normalizarNome(i.nome);
    if (chave.length < 3) continue;
    porNome.set(chave, [...(porNome.get(chave) || []), i.idItem]);
  }
  for (const [chave, ids] of porNome) {
    const ordenados = [...new Set(ids)].sort((a, b) => a - b);
    if (ordenados.length > 1 && !jaAgrupados.has(ordenados.join(','))) {
      grupos.push({ chave: `nome:${chave}`, motivo: 'NOME_IGUAL', descricao: `Nomes iguais: "${itens.find(i => i.idItem === ordenados[0])?.nome}"`, idsItens: ordenados });
    }
  }
  return grupos;
};

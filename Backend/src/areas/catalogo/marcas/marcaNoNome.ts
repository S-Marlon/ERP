// Marca no nome do item: acha a marca do PRÓPRIO produto citada no nome (ex.: "KORAX ABRAC. 9MM", "VALV ... BRASFORT"),
// para atribuir a quem está sem marca. Ignora marca de compatibilidade ("escova p/ DeWALT", "terminal para Karcher"):
// marca logo depois de P/, PARA, TIPO, COMPATIVEL, MODELO, LINHA ou REF não conta. Puro, com teste.

export interface MarcaConhecida { nome: string; apelidos: string[] }

/**
 * Marcas que aparecem nos nomes do catálogo com abreviação (conferidas em 2026-11-21 nos itens sem marca). As marcas já
 * cadastradas entram também pelo próprio nome. NÃO entram as de compatibilidade (DeWALT, Bosch, Makita, Black & Decker,
 * Skil, Karcher, WAP, Jacto, Stihl): no nome elas dizem para qual máquina a peça serve.
 */
export const MARCAS_DOS_NOMES: MarcaConhecida[] = [
  { nome: 'KORAX', apelidos: ['KORAX'] },
  { nome: 'BRASFORT', apelidos: ['BRASFORT', 'BRASFO', 'BRASF'] },
  { nome: '3M', apelidos: ['3M'] },
  { nome: 'STARRETT', apelidos: ['STARRETT'] },
  { nome: 'STARFER', apelidos: ['STARFER', 'STARF'] },
  { nome: 'POLYFITA', apelidos: ['POLYFITA'] },
  { nome: 'GITANES', apelidos: ['GITANES'] },
  { nome: 'HYLIK', apelidos: ['HYLIK'] },
  { nome: 'MAYLE', apelidos: ['MAYLE'] },
  { nome: 'CRAFER', apelidos: ['CRAFER'] },
  { nome: 'PANOBOM', apelidos: ['PANOBOM'] },
  { nome: 'SOUTEXTIL', apelidos: ['SOUTEXTIL'] },
  { nome: 'IMAR', apelidos: ['IMAR'] },
  { nome: 'MTX', apelidos: ['MTX'] },
  { nome: 'SKF', apelidos: ['SKF'] },
];

/** Marca que não é marca (não sugerir nem casar). */
export const ehMarcaVazia = (nome: string) => /^(sem\s*marca|2.?\s*linha|gen[eé]rico|diversos?)$/i.test(nome.trim());

const PALAVRAS_DE_COMPATIBILIDADE = new Set(['P', 'PARA', 'TIPO', 'COMPATIVEL', 'COMPAT', 'MODELO', 'MOD', 'LINHA', 'REF', 'SERVE', 'USO']);

const tokens = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Z0-9&]+/).filter(Boolean);

/**
 * A marca do produto citada no nome (a primeira que aparecer), ou null. `marcas` = conhecidas + cadastradas.
 * Casa por palavra inteira (ou sequência de palavras, para marcas com espaço) e pula as de compatibilidade.
 */
export const marcaNoNome = (nome: string, marcas: MarcaConhecida[]): string | null => {
  const t = tokens(nome);
  const candidatas = marcas.filter(m => !ehMarcaVazia(m.nome))
    .flatMap(m => [m.nome, ...m.apelidos].map(a => ({ marca: m.nome, partes: tokens(a) })))
    .filter(c => c.partes.length && c.partes.join('').length >= 2);
  for (let i = 0; i < t.length; i++) {
    for (const c of candidatas) {
      if (c.partes.every((p, k) => t[i + k] === p)) {
        const antes = [t[i - 1], t[i - 2]].filter(Boolean);
        if (antes.some(a => PALAVRAS_DE_COMPATIBILIDADE.has(a))) continue;
        return c.marca;
      }
    }
  }
  return null;
};

/** Junta as conhecidas com as cadastradas (sem repetir pelo nome). */
export const marcasParaBusca = (cadastradas: string[]): MarcaConhecida[] => {
  const mapa = new Map<string, MarcaConhecida>();
  for (const m of MARCAS_DOS_NOMES) mapa.set(m.nome.toUpperCase(), m);
  for (const nome of cadastradas) if (!ehMarcaVazia(nome) && !mapa.has(nome.toUpperCase())) mapa.set(nome.toUpperCase(), { nome, apelidos: [] });
  return [...mapa.values()];
};

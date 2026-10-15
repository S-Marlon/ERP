// Campos que vão escritos nas imagens das variações (o editor troca {Campo} pelo valor de cada item): os atributos
// do cadastro de cada item e, como texto padrão da cota, os que mudam de um item para outro (ex.: {Comprimento}).

export interface CampoEtiqueta { chave: string; nome: string; valor: string }

const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Nomes dos campos que têm valores diferentes entre os itens (na ordem em que aparecem). */
export const camposQueVariam = (itens: { campos: CampoEtiqueta[] }[]): string[] => {
  if (itens.length < 2) return [];
  const nomes: string[] = [];
  for (const i of itens) for (const c of i.campos) if (!nomes.some(n => normal(n) === normal(c.chave))) nomes.push(c.chave);
  return nomes.filter(n => new Set(itens.map(i => normal(i.campos.find(c => normal(c.chave) === normal(n))?.valor || ''))).size > 1);
};

// medidas na ordem em que costumam ir na cota (o comprimento antes da largura); o resto (cor, quantidade) depois
const MEDIDAS = ['compr', 'tamanho', 'medida', 'diam', 'bitola', 'rosca', 'largura', 'altura', 'espessura', 'volume', 'capacidade', 'pressao', 'potencia'];
const peso = (nome: string) => { const k = MEDIDAS.findIndex(m => normal(nome).includes(m)); return k < 0 ? MEDIDAS.length : k; };

/** Texto padrão da cota: até dois campos que variam, as medidas primeiro (ex.: "{Tamanho} · {Largura}"). */
export const modeloPadraoDosCampos = (variam: string[]) =>
  [...variam].sort((a, b) => peso(a) - peso(b)).slice(0, 2).map(n => `{${n}}`).join(' · ');

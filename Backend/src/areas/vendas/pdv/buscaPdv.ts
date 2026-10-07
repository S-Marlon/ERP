// Busca do PDV: cada palavra precisa aparecer (em qualquer ordem) no SKU ou no nome; GTIN exato; e busca por medidas
// com espaço vazio ("17 mm x x 10mm" acha "| 17 mm x 35 mm x 10 mm |"), usando o padrão de medidas dos nomes.
// O sinal × vale como x dos dois lados.

const NOME_ITEM = `REPLACE(ic.nome_item, '×', 'x')`;
const NOME_COMERCIAL = `REPLACE(cpd.nome_comercial, '×', 'x')`;
const GTIN = `EXISTS (SELECT 1 FROM comercial_unidades_venda g WHERE g.tenant_id = ic.tenant_id AND g.id_item = ic.id_item AND g.gtin = ?)`;

const formatarMedida = (texto: string) => {
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : null;
};

/** Medidas digitadas (17 x 35 x 10, 17 mm x x 10mm, x 47 x) -> padrão LIKE do nome; null se a busca não é de medidas. */
export const padraoMedidas = (busca: string): string | null => {
  const t = busca.toLowerCase().replace(/×|\*/g, 'x').trim();
  if (!/\d/.test(t) || !t.includes('x')) return null;
  if (!/^[\d\s.,]*(mm)?\s*(x[\d\s.,]*(mm)?\s*){1,2}$/.test(t)) return null;
  const partes = t.replace(/mm/g, '').split('x').map(p => p.trim());
  const segmentos = partes.map(p => (p ? formatarMedida(p) : null));
  if (segmentos.some((s, i) => partes[i] && !s)) return null;
  const pedacos = segmentos.map(s => (s ? `${s} mm` : '%'));
  // A primeira medida informada começa logo depois de "| " (17 não pode casar com 117)
  return `%${segmentos[0] ? '| ' : ''}${pedacos.join(' x ')}%`.replace(/%+/g, '%');
};

/** Filtro SQL da busca (para o WHERE) e os parâmetros na ordem. */
export const filtroBusca = (busca: string): { sql: string; params: string[] } => {
  const termo = busca.trim();
  const medidas = padraoMedidas(termo);
  if (medidas) {
    return { sql: `((${NOME_COMERCIAL} LIKE ? OR ${NOME_ITEM} LIKE ?) OR ${GTIN})`, params: [medidas, medidas, termo] };
  }
  const palavras = termo.replace(/×/g, 'x').split(/\s+/).filter(Boolean).slice(0, 8);
  const porPalavra = palavras.map(() => `(ic.sku LIKE ? OR cpd.sku_customizado LIKE ? OR ${NOME_ITEM} LIKE ? OR ${NOME_COMERCIAL} LIKE ?)`);
  return {
    sql: `((${porPalavra.join(' AND ')}) OR ${GTIN})`,
    params: [...palavras.flatMap(p => Array(4).fill(`%${p}%`)), termo],
  };
};

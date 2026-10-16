// Ficha de uma forma de venda: cada atributo com de onde vem, o que o ERP manda e o que está no anúncio do ML.
// Junta os da categoria (os que o operador liga no anúncio) e os que o ERP preenche sozinho (SKU, código de barras,
// embalagem, unidades por kit). Regras puras.
import { AtributoComparavel, valorComparavel } from './divergencias';

export type OrigemFicha = 'cadastro' | 'marca' | 'fixo' | 'automatico' | 'nenhuma';
export type SituacaoFicha = 'IGUAL' | 'DIFERENTE' | 'FALTA' | 'SO_ML' | 'A_PUBLICAR' | 'SEM_VALOR';

export interface LinhaFicha {
  id: string; nome: string; obrigatorio: boolean; origem: OrigemFicha;
  erp: string | null; ml: string | null; situacao: SituacaoFicha;
}

/** Atributos que o ERP preenche sozinho (não dependem da ligação do anúncio). */
export const AUTOMATICOS: Record<string, string> = {
  SELLER_SKU: 'SKU do vendedor',
  GTIN: 'Código de barras (GTIN)',
  EMPTY_GTIN_REASON: 'Motivo de não ter código de barras',
  SELLER_PACKAGE_HEIGHT: 'Embalagem: altura',
  SELLER_PACKAGE_WIDTH: 'Embalagem: largura',
  SELLER_PACKAGE_LENGTH: 'Embalagem: comprimento',
  SELLER_PACKAGE_WEIGHT: 'Embalagem: peso',
  UNITS_PER_PACK: 'Unidades por kit',
  SALE_FORMAT: 'Formato de venda',
};

const texto = (a: AtributoComparavel | undefined) => (a ? (a.value_name ?? a.value_id ?? null) : null);
const iguais = (a: AtributoComparavel, b: AtributoComparavel) =>
  a.value_id && b.value_id ? String(a.value_id) === String(b.value_id) : valorComparavel(a.value_name) === valorComparavel(b.value_name);

const ORDEM: Record<SituacaoFicha, number> = { FALTA: 0, DIFERENTE: 1, SO_ML: 2, A_PUBLICAR: 3, IGUAL: 4, SEM_VALOR: 5 };

/**
 * Linhas da ficha. `categoria` = atributos que o ML pede; `envio` = o que o ERP manda (atributosDoItem); `noMl` = os do
 * anúncio publicado (null = ainda não publicado); `origens` = a ligação de cada atributo no anúncio.
 * Mostra só atributos da categoria ou automáticos (o ML devolve outros internos que não interessam).
 */
export const fichaDaLinha = (p: {
  categoria: { id: string; nome: string; obrigatorio: boolean }[];
  envio: AtributoComparavel[];
  noMl: AtributoComparavel[] | null;
  origens: Record<string, { origem: string } | undefined>;
}): LinhaFicha[] => {
  const enviados = new Map(p.envio.map(a => [a.id, a]));
  const lidos = new Map((p.noMl || []).map(a => [a.id, a]));
  const daCategoria = new Map(p.categoria.map(a => [a.id, a]));
  const ids = [...new Set([...p.categoria.map(a => a.id), ...p.envio.map(a => a.id), ...[...lidos.keys()].filter(id => daCategoria.has(id) || AUTOMATICOS[id])])];
  const linhas = ids.map((id): LinhaFicha => {
    const cat = daCategoria.get(id);
    const e = enviados.get(id);
    const m = lidos.get(id);
    const mlTem = !!m && (m.value_id || m.value_name);
    const origemDoAnuncio = p.origens[id]?.origem;
    const origem: OrigemFicha = AUTOMATICOS[id] ? 'automatico'
      : origemDoAnuncio === 'erp' ? 'cadastro' : origemDoAnuncio === 'marca' ? 'marca' : origemDoAnuncio === 'fixo' ? 'fixo' : 'nenhuma';
    let situacao: SituacaoFicha;
    // o ERP não manda: o ML já tem (só no ML) · obrigatório sem valor em lugar nenhum (falta) · opcional vazio
    if (!e) situacao = mlTem && p.noMl ? 'SO_ML' : cat?.obrigatorio ? 'FALTA' : 'SEM_VALOR';
    else if (p.noMl === null) situacao = 'A_PUBLICAR';
    else situacao = mlTem && iguais(e, m!) ? 'IGUAL' : 'DIFERENTE';
    return {
      id, nome: cat?.nome || AUTOMATICOS[id] || id, obrigatorio: !!cat?.obrigatorio, origem,
      erp: texto(e), ml: p.noMl === null ? null : (mlTem ? texto(m) : null), situacao,
    };
  });
  return linhas.sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || Number(b.obrigatorio) - Number(a.obrigatorio) || a.nome.localeCompare(b.nome));
};

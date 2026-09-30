// Herança de atributos na árvore de categorias (mesma regra do backend: Catalogo/Categorias/herancaCategorias.ts).
//  - atributo próprio desce para todas as subcategorias e famílias abaixo;
//  - vínculo numa subcategoria para um atributo herdado = "ajustado aqui" (papel/obrigatório/sufixo valem dali para baixo);
//  - vínculo com bloqueado = "não usar neste ramo".
import { AtributoHerdavel, Categoria } from './CategoryManager.types';

export type SituacaoAtributo = 'proprio' | 'herdado' | 'ajustado';

export interface AtributoEfetivoCategoria extends AtributoHerdavel {
  situacao: SituacaoAtributo;
  // Categoria de onde a configuração herdada vem (para herdado/ajustado)
  origemNome?: string;
}

export interface VisaoAtributosCategoria {
  atributos: AtributoEfetivoCategoria[];
  bloqueadosAqui: Array<{ id: string; nome: string; origemNome?: string }>;
}

export const cadeiaCategorias = (categorias: Categoria[], alvo: string | null): Categoria[] => {
  const cadeia: Categoria[] = [];
  const vistos = new Set<string>();
  let atual = categorias.find(c => c.id === alvo);
  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    cadeia.unshift(atual);
    const pai = atual.parentId;
    atual = pai ? categorias.find(c => c.id === pai) : undefined;
  }
  return cadeia;
};

// Ids da categoria e de todas as descendentes (não podem virar pai dela)
export const idsDescendentes = (categorias: Categoria[], id: string): Set<string> => {
  const ids = new Set<string>([id]);
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const c of categorias) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        cresceu = true;
      }
    }
  }
  return ids;
};

// O que chega de cima (sem os vínculos da própria categoria)
export const herdadosDoPai = (categorias: Categoria[], idCategoria: string | null): Map<string, AtributoEfetivoCategoria> => {
  const cadeia = cadeiaCategorias(categorias, idCategoria).slice(0, -1);
  const efetivos = new Map<string, AtributoEfetivoCategoria>();
  for (const cat of cadeia) {
    for (const attr of cat.atributosHeranca || []) {
      if (attr.bloqueado) efetivos.delete(attr.id);
      else efetivos.set(attr.id, { ...attr, situacao: 'herdado', origemNome: cat.nome });
    }
  }
  return efetivos;
};

export const visaoAtributosCategoria = (categorias: Categoria[], idCategoria: string | null): VisaoAtributosCategoria => {
  const categoria = categorias.find(c => c.id === idCategoria);
  if (!categoria) return { atributos: [], bloqueadosAqui: [] };

  const herdados = herdadosDoPai(categorias, idCategoria);
  const bloqueadosAqui: VisaoAtributosCategoria['bloqueadosAqui'] = [];
  const resultado = new Map(herdados);

  for (const attr of categoria.atributosHeranca || []) {
    const deCima = herdados.get(attr.id);
    if (attr.bloqueado) {
      resultado.delete(attr.id);
      bloqueadosAqui.push({ id: attr.id, nome: deCima?.nome || attr.nome, origemNome: deCima?.origemNome });
      continue;
    }
    resultado.set(attr.id, deCima
      ? { ...attr, nome: attr.nome || deCima.nome, tipoDado: attr.tipoDado || deCima.tipoDado, situacao: 'ajustado', origemNome: deCima.origemNome }
      : { ...attr, situacao: 'proprio' });
  }

  const atributos = Array.from(resultado.values()).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
  return { atributos, bloqueadosAqui };
};

/**
 * Altera um campo de um atributo na categoria. Se o atributo é herdado e ainda não tem vínculo aqui,
 * cria o ajuste local (cópia do herdado com a mudança).
 */
export const alterarAtributoNaCategoria = (
  categorias: Categoria[],
  idCategoria: string,
  atributoId: string,
  mudancas: Partial<AtributoHerdavel>
): AtributoHerdavel[] => {
  const categoria = categorias.find(c => c.id === idCategoria);
  const locais = categoria?.atributosHeranca || [];
  if (locais.some(a => a.id === atributoId)) {
    return locais.map(a => (a.id === atributoId ? { ...a, ...mudancas } : a));
  }
  const herdado = herdadosDoPai(categorias, idCategoria).get(atributoId);
  if (!herdado) return locais;
  const { situacao: _s, origemNome: _o, ...base } = herdado;
  return [...locais, { ...base, bloqueado: false, sobrescreve: true, ...mudancas }];
};

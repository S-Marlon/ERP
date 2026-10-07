// Pendências do PIM por item: o que tira o item do PDV (crítico) e o que deixa o cadastro incompleto.
// Regras puras: o controller carrega os dados e esta função decide. Itens fora da venda
// (consumo/insumo/patrimônio) só são cobrados de classificação.

export type NivelPendencia = 'critico' | 'incompleto';

export const PENDENCIAS = {
  OBRIGATORIOS: { nivel: 'critico', label: 'Obrigatórios sem valor', ajuda: 'Fica fora do PDV até preencher os atributos obrigatórios da família/categoria.' },
  FAMILIA_NAO_ATIVA: { nivel: 'critico', label: 'Família não ativa', ajuda: 'Família em rascunho, inativa ou bloqueada: os itens dela ficam fora do PDV.' },
  SEM_PRECO: { nivel: 'critico', label: 'Sem preço de venda', ajuda: 'Item de venda sem preço de varejo configurado.' },
  SEM_CLASSIFICACAO: { nivel: 'incompleto', label: 'Sem família/categoria', ajuda: 'Não herda atributos nem regras do PIM.' },
  GRADE_VAZIA: { nivel: 'incompleto', label: 'Grade sem valor', ajuda: 'Atributos de grade vazios: o SKU não se diferencia dos outros da família.' },
  SEM_MARCA: { nivel: 'incompleto', label: 'Sem marca', ajuda: 'A família varia por marca (marca na grade), mas o item não tem marca.' },
  SEM_GTIN: { nivel: 'incompleto', label: 'Sem código de barras', ajuda: 'Nenhuma unidade de venda com GTIN: o PDV não acha o item pelo leitor.' },
} as const;

export type CodigoPendencia = keyof typeof PENDENCIAS;

export interface Pendencia {
  codigo: CodigoPendencia;
  nivel: NivelPendencia;
  detalhe: string;
}

export interface ItemParaPendencias {
  tipoRecurso: string;
  familiaId: number | null;
  categoriaId: number | null;
  comportamentoMarca: string | null;
  idMarca: number | null;
  temPreco: boolean;
  temGtin: boolean;
  motivosPublicacao: string[];   // de avaliarPublicacao
  gradeSemValor: string[];
}

const TIPOS_FORA_DA_VENDA = ['CONSUMO', 'INSUMO', 'ATIVO'];
export const itemDeVenda = (tipo: string) => !TIPOS_FORA_DA_VENDA.includes(String(tipo || '').toUpperCase());

const p = (codigo: CodigoPendencia, detalhe?: string): Pendencia => ({
  codigo, nivel: PENDENCIAS[codigo].nivel, detalhe: detalhe || PENDENCIAS[codigo].ajuda,
});

export const pendenciasDoItem = (i: ItemParaPendencias): Pendencia[] => {
  const lista: Pendencia[] = [];
  if (!i.familiaId && !i.categoriaId) lista.push(p('SEM_CLASSIFICACAO'));
  if (!itemDeVenda(i.tipoRecurso)) return lista;

  const obrigatorios = i.motivosPublicacao.find(m => m.startsWith('Obrigatórios sem valor'));
  if (obrigatorios) lista.push(p('OBRIGATORIOS', obrigatorios));
  const familia = i.motivosPublicacao.find(m => m.startsWith('Família'));
  if (familia) lista.push(p('FAMILIA_NAO_ATIVA', familia));
  if (!i.temPreco) lista.push(p('SEM_PRECO'));
  if (i.gradeSemValor.length > 0) lista.push(p('GRADE_VAZIA', `Grade sem valor: ${i.gradeSemValor.join(', ')}`));
  if (i.familiaId && i.comportamentoMarca === 'grade' && !i.idMarca) lista.push(p('SEM_MARCA'));
  if (!i.temGtin) lista.push(p('SEM_GTIN'));
  return lista;
};

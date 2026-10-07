// Tipo de entrada do item da NF: define para qual área do ERP ele vai (só PRODUTO é vendável).
// Nenhum item sai da nota; o operador apenas reclassifica.
export type TipoRecurso = 'PRODUTO' | 'ATIVO' | 'CONSUMO' | 'INSUMO' | 'SERVICO';

export const TIPO_RECURSO_PADRAO: TipoRecurso = 'PRODUTO';

export const TIPOS_RECURSO: { value: TipoRecurso; label: string; short: string; color: string }[] = [
  { value: 'PRODUTO', label: 'Produto / Revenda', short: 'Prod.', color: 'blue' },
  { value: 'ATIVO', label: 'Ativo / Imobilizado', short: 'Ativo', color: 'purple' },
  { value: 'CONSUMO', label: 'Consumo Interno', short: 'Consumo', color: 'orange' },
  { value: 'INSUMO', label: 'Insumo / Matéria-Prima', short: 'Insumo', color: 'green' },
  { value: 'SERVICO', label: 'Serviço', short: 'Serviço', color: 'default' },
];

export const getTipoRecursoConfig = (tipo?: string) =>
  TIPOS_RECURSO.find(t => t.value === tipo) ?? { value: tipo || '', label: tipo || '', short: tipo || '', color: 'default' };

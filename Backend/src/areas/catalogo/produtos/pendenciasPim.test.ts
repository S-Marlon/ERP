import { pendenciasDoItem, ItemParaPendencias } from './pendenciasPim';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`pendenciasPim: ${msg}`); };
const base: ItemParaPendencias = {
  tipoRecurso: 'PRODUTO', familiaId: 1, categoriaId: 2, comportamentoMarca: 'dna', idMarca: null,
  temPreco: true, temGtin: true, motivosPublicacao: [], gradeSemValor: [], fotos: 1, pesoKg: 0.2, temMedidas: true, temEmbalagem: true,
};
const codigos = (i: Partial<ItemParaPendencias>) => pendenciasDoItem({ ...base, ...i }).map(x => x.codigo).join(',');

export const runPendenciasPim = () => {
  ok(codigos({}) === '', 'item completo sem pendências');
  ok(codigos({ familiaId: null, categoriaId: null }) === 'SEM_CLASSIFICACAO', 'sem família/categoria');
  ok(codigos({ familiaId: null }) === '', 'só categoria basta');
  ok(codigos({ motivosPublicacao: ['Obrigatórios sem valor: Tensão', 'Família em rascunho', 'Oculto no PDV'] }) === 'OBRIGATORIOS,FAMILIA_NAO_ATIVA', 'motivos de publicação (oculto não é pendência)');
  ok(pendenciasDoItem({ ...base, motivosPublicacao: ['Obrigatórios sem valor: Tensão'] })[0].detalhe.includes('Tensão'), 'detalhe traz o atributo');
  ok(codigos({ temPreco: false, temGtin: false }) === 'SEM_PRECO,SEM_GTIN', 'preço e GTIN');
  ok(codigos({ gradeSemValor: ['Tamanho'] }) === 'GRADE_VAZIA', 'grade vazia');
  ok(codigos({ comportamentoMarca: 'grade' }) === 'SEM_MARCA', 'marca na grade sem marca');
  ok(codigos({ comportamentoMarca: 'grade', idMarca: 3 }) === '', 'marca na grade com marca');
  ok(codigos({ comportamentoMarca: 'grade', familiaId: null }) === '', 'sem família não cobra marca');
  // Logística: o que o envio e o ML precisam (não tira do PDV)
  ok(codigos({ fotos: 0, pesoKg: null, temMedidas: false, temEmbalagem: false }) === 'SEM_FOTO,SEM_PESO,SEM_MEDIDAS,SEM_EMBALAGEM', 'logística');
  ok(pendenciasDoItem({ ...base, pesoKg: 0 }).every(x => x.nivel === 'logistica'), 'peso zero é sem peso, nível logística');
  ok(codigos({ tipoRecurso: 'CONSUMO', fotos: 0, pesoKg: null, temMedidas: false, temEmbalagem: false }) === '', 'consumo não cobra logística');
  // Fora da venda: só classificação
  ok(codigos({ tipoRecurso: 'CONSUMO', temPreco: false, temGtin: false, motivosPublicacao: ['Obrigatórios sem valor: X'] }) === '', 'consumo não cobra venda');
  ok(codigos({ tipoRecurso: 'ATIVO', familiaId: null, categoriaId: null, temPreco: false }) === 'SEM_CLASSIFICACAO', 'ativo só classificação');
};

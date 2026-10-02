import { agruparDuplicados, normalizarNome } from './duplicados';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(`duplicados: ${msg}`); };

export const runDuplicadosTests = () => {
  assert(normalizarNome('[NOVO] Graxa Azul 500g') === normalizarNome('graxa azul 500G'), 'ignora [NOVO] e caixa');
  assert(normalizarNome('Óleo 2T 1,5L') === normalizarNome('oleo 2t 1.5l'), 'acentos e vírgula decimal');
  assert(normalizarNome('Chave de Fenda 6mm') === normalizarNome('6mm chave fenda'), 'ordem das palavras e preposições');
  assert(normalizarNome('Chave 6mm') !== normalizarNome('Chave 8mm'), 'medidas diferentes não juntam');

  const itens = [
    { idItem: 1, nome: 'Graxa Azul 500g' },
    { idItem: 2, nome: '[NOVO] GRAXA AZUL 500G' },
    { idItem: 3, nome: 'Detergente' },
    { idItem: 4, nome: 'Detergente Neutro' },
    { idItem: 5, nome: 'Bomba 1cv' },
    { idItem: 6, nome: 'Bomba Ebara 1cv' },
  ];
  const codigos = [
    { idFornecedor: 10, fornecedor: 'Drill', codigo: '3862', idItem: 5 },
    { idFornecedor: 10, fornecedor: 'Drill', codigo: '3862 ', idItem: 6 },
    { idFornecedor: 11, fornecedor: 'Outro', codigo: '3862', idItem: 3 },   // outro fornecedor: não junta
    { idFornecedor: 10, fornecedor: 'Drill', codigo: '999', idItem: 7 },    // item inativo/fora da lista
  ];
  const grupos = agruparDuplicados(itens, codigos);
  const fornecedor = grupos.find(g => g.motivo === 'MESMO_CODIGO_FORNECEDOR');
  assert(fornecedor && fornecedor.idsItens.join(',') === '5,6', 'mesmo código do mesmo fornecedor');
  const nome = grupos.find(g => g.motivo === 'NOME_IGUAL');
  assert(nome && nome.idsItens.join(',') === '1,2', 'nome igual normalizado');
  assert(grupos.length === 2, 'detergentes diferentes não viram suspeita');

  // Mesma família com grade diferente (balde x galão): não é duplicado
  const oleos = [
    { idItem: 20, nome: '[NOVO] Hidraulico 68', familiaId: 9, assinaturaGrade: 'emb=BALDE 20L' },
    { idItem: 21, nome: '[NOVO] Hidraulico 68', familiaId: 9, assinaturaGrade: 'emb=GALAO 3,6L' },
  ];
  assert(agruparDuplicados(oleos, []).length === 0, 'grade diferente na mesma família não é suspeita');
  // Mesma grade ou sem grade preenchida: continua suspeito
  assert(agruparDuplicados([oleos[0], { ...oleos[1], assinaturaGrade: 'emb=BALDE 20L' }], []).length === 1, 'mesma grade é suspeita');
  assert(agruparDuplicados([oleos[0], { ...oleos[1], assinaturaGrade: null }], []).length === 1, 'grade vazia não distingue');
  assert(agruparDuplicados([oleos[0], { ...oleos[1], familiaId: 10 }], []).length === 1, 'famílias diferentes não se distinguem pela grade');
  // Três itens: o par distinguido sai, o terceiro (sem família) continua com os dois
  const tres = agruparDuplicados([...oleos, { idItem: 22, nome: 'Hidraulico 68', familiaId: null, assinaturaGrade: null }], []);
  assert(tres.length === 1 && tres[0].idsItens.join(',') === '20,21,22', 'terceiro item sem família continua suspeito com os dois');
  // Mesmo código de fornecedor, grades diferentes na mesma família: não é suspeita
  const cods = [
    { idFornecedor: 10, fornecedor: 'X', codigo: 'H68', idItem: 20 },
    { idFornecedor: 10, fornecedor: 'X', codigo: 'H68', idItem: 21 },
  ];
  assert(agruparDuplicados(oleos, cods).length === 0, 'código igual com grade diferente não é suspeita');
};

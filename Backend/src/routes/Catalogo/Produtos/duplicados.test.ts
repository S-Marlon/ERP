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
};

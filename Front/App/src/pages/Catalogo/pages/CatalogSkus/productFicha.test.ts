import { alteracoesParaPayload, calcularAlteracoes } from './productFicha';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runProductFichaTests = (): void => {
  const inicial = { nomeInterno: 'Motobomba 0,5HP', skuPrincipal: '3862', familiaId: 101, status: true, ncm: undefined, idMarca: 4 };

  const semMudanca = calcularAlteracoes(inicial, { ...inicial, nomeInterno: 'Motobomba 0,5HP  ' });
  assert(semMudanca.length === 0, 'Espaços nas pontas não contam como alteração.');

  const mudou = calcularAlteracoes(inicial, { ...inicial, nomeInterno: 'Motobomba 0,5 HP', familiaId: undefined, status: false, ncm: '8413.70.10' });
  const payload = alteracoesParaPayload(mudou);
  assert(Object.keys(payload).sort().join() === 'familia_id,ncm,nome_item,status', 'Só os campos alterados deveriam ir no payload.');
  assert(payload.familia_id === null, 'Campo esvaziado deveria ir como null (limpa no banco).');
  assert(payload.status === 'INATIVO', 'Status desligado deveria ir como INATIVO.');
  assert(!('custo_gerencial' in payload) && !('preco_venda' in payload), 'Custo e preço nunca vão pela ficha.');
  assert(!('id_marca' in payload), 'Marca não alterada não deveria ir no payload.');
};

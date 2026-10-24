// Obras de poços › orçamento linha a linha e termos aditivos: regras puras. O orçamento tem itens (ex.: perfuração
// 50 m × R$ 180/m, revestimento, bomba, instalação); item opcional ("se necessário") aparece no PDF mas não soma. O
// total dos itens vira o valor contratado da obra; a perfuração em metros dá os metros previstos e o valor do metro.
// O aditivo junta adicionais aprovados que ainda não entraram em aditivo nenhum.
import { ErroObra } from './obras';

export const GRUPOS_ITEM = ['PERFURACAO', 'REVESTIMENTO', 'BOMBA', 'INSTALACAO', 'MATERIAL', 'SERVICO', 'OUTRO'] as const;
export const UNIDADES_ITEM = ['m', 'un', 'h', 'sc', 'kg', 'L', 'vb'] as const;
export const ITENS_MAXIMO = 60;

export interface ItemOrcamento {
  grupo: typeof GRUPOS_ITEM[number]; descricao: string; quantidade: number; unidade: string; valorUnitario: number; valorTotal: number; opcional: boolean;
}

const c = (v: number) => Math.round((Number(v) || 0) * 100);

/** Lê os itens: descrição obrigatória, quantidade > 0, valor ≥ 0; total = quantidade × unitário arredondado na linha. */
export const validarItens = (lista: unknown): ItemOrcamento[] => {
  if (!Array.isArray(lista)) throw new ErroObra('Itens do orçamento inválidos.');
  if (lista.length > ITENS_MAXIMO) throw new ErroObra(`No máximo ${ITENS_MAXIMO} itens.`);
  return lista.map((b: any, i) => {
    const descricao = String(b?.descricao ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!descricao) throw new ErroObra(`Item ${i + 1}: descreva o item.`);
    const grupo = String(b?.grupo || 'SERVICO').toUpperCase();
    if (!(GRUPOS_ITEM as readonly string[]).includes(grupo)) throw new ErroObra(`Item ${i + 1}: grupo inválido.`);
    const unidade = (UNIDADES_ITEM as readonly string[]).find(u => u.toLowerCase() === String(b?.unidade || 'un').trim().toLowerCase());
    if (!unidade) throw new ErroObra(`Item ${i + 1}: unidade inválida (${UNIDADES_ITEM.join(', ')}).`);
    const quantidade = Number(String(b?.quantidade ?? 1).replace(',', '.'));
    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1e6) throw new ErroObra(`Item ${i + 1}: quantidade inválida.`);
    const valorUnitario = Number(String(b?.valorUnitario ?? 0).replace(',', '.'));
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0 || valorUnitario > 1e8) throw new ErroObra(`Item ${i + 1}: valor inválido.`);
    const q = Math.round(quantidade * 10000) / 10000, vu = Math.round(valorUnitario * 10000) / 10000;
    return { grupo: grupo as ItemOrcamento['grupo'], descricao, quantidade: q, unidade, valorUnitario: vu, valorTotal: Math.round(q * vu * 100) / 100, opcional: !!b?.opcional };
  });
};

/**
 * O que os itens dizem da obra: o total (só os não opcionais), os metros previstos e o valor do metro (do primeiro item
 * de perfuração em metros, não opcional). Metro excedente: o item opcional de perfuração em metros, se houver; senão o
 * valor do metro da perfuração.
 */
export const resumoDosItens = (itens: ItemOrcamento[]) => {
  const total = itens.filter(i => !i.opcional).reduce((s, i) => s + c(i.valorTotal), 0) / 100;
  const perf = itens.find(i => i.grupo === 'PERFURACAO' && i.unidade === 'm' && !i.opcional);
  const excedente = itens.find(i => i.grupo === 'PERFURACAO' && i.unidade === 'm' && i.opcional);
  return {
    total, opcionais: itens.filter(i => i.opcional).reduce((s, i) => s + c(i.valorTotal), 0) / 100,
    metrosPrevistos: perf ? perf.quantidade : null, valorMetro: perf ? perf.valorUnitario : null,
    valorMetroExcedente: excedente ? excedente.valorUnitario : perf ? perf.valorUnitario : null,
  };
};

/** Próximo número de aditivo da obra e o valor dele (soma dos adicionais escolhidos, aprovados e ainda sem aditivo). */
export const novoAditivo = (adicionais: { idAdicional: number; situacao: string; valor: number; idAditivo: number | null }[], escolhidos: number[] | null, numeros: number[]) => {
  const livres = adicionais.filter(a => a.situacao === 'APROVADO' && !a.idAditivo);
  const entram = escolhidos && escolhidos.length ? livres.filter(a => escolhidos.includes(a.idAdicional)) : livres;
  if (escolhidos && escolhidos.length && entram.length !== escolhidos.length) throw new ErroObra('Só entram no aditivo adicionais aprovados que ainda não estão em outro aditivo.');
  if (!entram.length) throw new ErroObra('Não há adicional aprovado fora de aditivo (aprove o adicional na cobrança antes).');
  return { numero: (numeros.length ? Math.max(...numeros) : 0) + 1, ids: entram.map(a => a.idAdicional), valor: entram.reduce((s, a) => s + c(a.valor), 0) / 100 };
};

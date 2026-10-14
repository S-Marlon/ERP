// Modo de venda do anúncio publicado no ML: tipo (Clássico/Premium) e frete grátis. Lê como está hoje, o que o ML deixa
// trocar e aplica a troca nos itens publicados (o editor manda isso ao salvar as alterações).
import type { AnuncioCarregado } from './anuncios.controller';
import { foraDoMl } from './anuncios';
import { ErroML, ml } from './mercadolivreApi';
import { esquecerItemNoMl, freteGratisNoMl, tiposPermitidosNoMl } from './freteMl';
import { LIMITE_FRETE_GRATIS } from './custosMl';

const NOME_TIPO: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium', gold_premium: 'Diamante' };

const vivos = (c: AnuncioCarregado) => c.itens
  .map(i => ({ item: i, mlbId: c.noMl.get(i.idItem)?.mlbId || null, status: c.noMl.get(i.idItem)?.status || null }))
  .filter(x => x.mlbId && !foraDoMl(x.status)) as { item: AnuncioCarregado['itens'][number]; mlbId: string; status: string | null }[];

/** Como o anúncio vende hoje no ML (pelos itens publicados) e o que dá para trocar. null se nada está no ML. */
export const vendaDoAnuncio = async (tenant: number, c: AnuncioCarregado) => {
  const lista = vivos(c);
  if (!lista.length) return null;
  const estados = await Promise.all(lista.map(x => freteGratisNoMl(tenant, x.mlbId)));
  const primeiro = estados.find(Boolean);
  if (!primeiro) return null;
  const permitidos = await tiposPermitidosNoMl(tenant, lista[0].mlbId);
  return {
    tipo: primeiro.tipo,
    freteGratis: primeiro.gratis,
    tiposPermitidos: [...new Set([primeiro.tipo, ...permitidos].filter((t): t is string => !!t))],
    podeMudarFrete: estados.every(e => !e || e.preco < LIMITE_FRETE_GRATIS),
    misturado: estados.some(e => !!e && (e.gratis !== primeiro.gratis || e.tipo !== primeiro.tipo)),
  };
};

/** Troca o tipo e/ou o frete grátis nos itens publicados. Devolve as falhas ("SKU: motivo"). */
export const aplicarModoDeVenda = async (tenant: number, c: AnuncioCarregado, op: { tipo?: string; freteGratis?: boolean }) => {
  const falhas: string[] = [];
  for (const { item, mlbId } of vivos(c)) {
    try {
      const agora = await freteGratisNoMl(tenant, mlbId);
      if (op.tipo && agora?.tipo !== op.tipo) {
        const permitidos = await tiposPermitidosNoMl(tenant, mlbId);
        if (!permitidos.includes(op.tipo)) {
          throw new ErroML(`o ML não deixa trocar de ${NOME_TIPO[agora?.tipo || ''] || agora?.tipo} para ${NOME_TIPO[op.tipo] || op.tipo} num anúncio publicado (só republicando)`);
        }
        await ml(tenant, 'POST', `/items/${mlbId}/listing_type`, { id: op.tipo });
      }
      if (op.freteGratis !== undefined && agora?.gratis !== op.freteGratis) {
        if (!op.freteGratis && (agora?.preco ?? 0) >= LIMITE_FRETE_GRATIS) throw new ErroML(`a partir de R$ ${LIMITE_FRETE_GRATIS} o frete grátis é obrigatório`);
        await ml(tenant, 'PUT', `/items/${mlbId}`, { shipping: { free_shipping: op.freteGratis } });
      }
    } catch (e: any) {
      falhas.push(`${item.sku}: ${e?.message || 'erro no ML'}`);
    } finally {
      esquecerItemNoMl(mlbId);
    }
  }
  return falhas;
};

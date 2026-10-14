// Frete grátis que o vendedor paga no ML: preferências de envio da conta, peso cobrado do item e o custo de um envio
// para um valor de compra (a faixa de preço muda o frete). Consultas com cache de 1 h.
import { ml } from './mercadolivreApi';
import type { FreteEnvio } from './custosMl';

const UMA_HORA = 60 * 60 * 1000;
const cache = new Map<string, { em: number; valor: Promise<any> }>();
const guardado = <T>(chave: string, buscar: () => Promise<T>): Promise<T> => {
  const g = cache.get(chave);
  if (g && Date.now() - g.em < UMA_HORA) return g.valor;
  const valor = buscar();
  valor.catch(() => cache.delete(chave));
  cache.set(chave, { em: Date.now(), valor });
  return valor;
};

/** Logística padrão da conta (ex.: xd_drop_off) e se ela oferece frete grátis em tudo por padrão. */
export const preferenciasEnvio = (tenant: number) => guardado(`pref|${tenant}`, async () => {
  const eu: any = await ml(tenant, 'GET', '/users/me?attributes=id');
  const p: any = await ml(tenant, 'GET', `/users/${eu.id}/shipping_preferences`);
  const me2 = (p?.logistics || []).find((l: any) => l.mode === 'me2');
  const tipo = (me2?.types || []).find((t: any) => t.default && t.status === 'active') || (me2?.types || [])[0];
  const padrao = (p?.free_configurations || []).find((f: any) => f?.rule?.default);
  return { idUsuario: Number(eu.id), logistica: String(tipo?.type || 'drop_off'), freteGratisPadrao: !!padrao?.rule?.free_shipping_flag };
});

/** Como o anúncio publicado vende hoje no ML: frete grátis, logística e tipo (null se não deu para ler). */
export const freteGratisNoMl = (tenant: number, mlbId: string) => guardado(`item|${mlbId}`, async () => {
  const it: any = await ml(tenant, 'GET', `/items/${mlbId}?attributes=shipping,listing_type_id,price`);
  return {
    gratis: !!it?.shipping?.free_shipping, logistica: (it?.shipping?.logistic_type as string) || null,
    tipo: (it?.listing_type_id as string) || null, preco: Number(it?.price) || 0,
  };
}).catch(() => null);

/** Tipos de anúncio para onde o ML deixa trocar o anúncio publicado (só sobe: Clássico -> Premium). */
export const tiposPermitidosNoMl = (tenant: number, mlbId: string) => guardado(`tipos|${mlbId}`, async () => {
  const [sobe, desce]: any[] = await Promise.all([
    ml(tenant, 'GET', `/items/${mlbId}/available_upgrades`).catch(() => []),
    ml(tenant, 'GET', `/items/${mlbId}/available_downgrades`).catch(() => []),
  ]);
  return [...(sobe || []), ...(desce || [])].map((t: any) => String(t?.id)).filter(Boolean);
}).catch(() => [] as string[]);

/** Esquece o que foi lido do anúncio (depois de mudar tipo ou frete no ML). */
export const esquecerItemNoMl = (mlbId: string) => { cache.delete(`item|${mlbId}`); cache.delete(`tipos|${mlbId}`); cache.delete(`peso|${mlbId}`); };

const ajustarCm = (v: number) => Math.max(1, Math.ceil(v));

/** Peso cobrado (g) de um envio do item: o que o ML calcula para o anúncio publicado; senão, o do cadastro do ERP. */
export const pesoCobrado = async (tenant: number, p: {
  mlbId: string | null; pesoKg: number | null; medidasCm: { altura: number; largura: number; comprimento: number } | null; fator: number;
}): Promise<{ pesoG: number; fonte: 'ML' | 'ERP' } | null> => {
  const { idUsuario } = await preferenciasEnvio(tenant);
  if (p.mlbId) {
    const r: any = await guardado(`peso|${p.mlbId}`, () => ml(tenant, 'GET', `/users/${idUsuario}/shipping_options/free?item_id=${p.mlbId}`)).catch(() => null);
    const g = Number(r?.coverage?.all_country?.billable_weight);
    if (g > 0) return { pesoG: g, fonte: 'ML' };
  }
  if (!p.pesoKg) return null;
  const peso = Math.round(p.pesoKg * 1000 * Math.max(1, p.fator));
  // pacote (fator > 1): as medidas do cadastro são da unidade; vai só o peso
  if (p.medidasCm && p.fator <= 1) {
    const { altura, largura, comprimento } = p.medidasCm;
    const dims = `${ajustarCm(altura)}x${ajustarCm(largura)}x${ajustarCm(comprimento)},${peso}`;
    const r: any = await guardado(`dims|${tenant}|${dims}`, () => ml(tenant, 'GET', `/users/${idUsuario}/shipping_options/free?dimensions=${dims}&item_price=50&mode=me2&condition=new&verbose=true`)).catch(() => null);
    const g = Number(r?.coverage?.all_country?.billable_weight);
    if (g > 0) return { pesoG: g, fonte: 'ERP' };
  }
  return { pesoG: peso, fonte: 'ERP' };
};

/** Quanto o vendedor paga de frete grátis num envio com esse peso cobrado e esse valor de compra. */
export const freteDoEnvio = (tenant: number, p: { pesoG: number; valorCompra: number; tipo: string; logistica: string }): Promise<FreteEnvio | null> => {
  const peso = Math.max(1, Math.round(p.pesoG));
  const valor = Math.round(p.valorCompra * 100) / 100;
  return guardado(`frete|${tenant}|${peso}|${valor}|${p.tipo}|${p.logistica}`, async () => {
    const { idUsuario } = await preferenciasEnvio(tenant);
    // caixa mínima: o peso informado já é o cobrado, as medidas não podem pesar mais que ele
    const r: any = await ml(tenant, 'GET',
      `/users/${idUsuario}/shipping_options/free?dimensions=5x5x5,${peso}&item_price=${valor}&listing_type_id=${p.tipo}&mode=me2&condition=new&logistic_type=${p.logistica}&verbose=true`);
    const c = r?.coverage?.all_country;
    if (!c || c.list_cost === undefined) return null;
    return {
      valor: Number(c.list_cost) || 0,
      cheio: c.discount?.promoted_amount !== undefined ? Number(c.discount.promoted_amount) : null,
      descontoPct: c.discount?.rate !== undefined ? Math.round(Number(c.discount.rate) * 100) : null,
      pesoG: Number(c.billable_weight) || peso,
    };
  }).catch(() => null);
};

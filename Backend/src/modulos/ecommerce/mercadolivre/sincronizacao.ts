// Sincronização de estoque e preço com o Mercado Livre: manda só o que mudou desde o último envio.
// Roda pelo botão (anúncio ou todos) e sozinha a cada poucos minutos, só com o módulo ligado e a conta conectada.
import pool from '../../../infra/db';
import { mudancasParaMl, precoNoMl } from './anuncios';
import { carregarAnuncios } from './anuncios.controller';
import { ErroML, ml } from './mercadolivreApi';

export interface ResultadoSincronizacao {
  idAnuncio: number;
  idItem: number;
  sku: string;
  mlbId: string;
  estoqueDe: number | null;
  estoquePara: number | null;
  precoDe: number | null;
  precoPara: number | null;
  erro: string | null;
}

/**
 * Sincroniza os itens já publicados. somenteAutomaticos: só anúncios com "atualizar sozinho" ligado
 * (o importado começa desligado, para o operador revisar a divisão loja/ML antes).
 */
export const sincronizarAnuncios = async (
  tenant: number, opcoes: { idAnuncio?: number; idItem?: number; somenteAutomaticos?: boolean; forcar?: boolean } = {}
): Promise<ResultadoSincronizacao[]> => {
  const anuncios = await carregarAnuncios(pool as any, tenant, opcoes.idAnuncio);
  const resultado: ResultadoSincronizacao[] = [];
  for (const c of anuncios) {
    if (opcoes.somenteAutomaticos && !Number(c.registro.estoque_automatico)) continue;
    for (const item of c.itens) {
      const m = c.noMl.get(item.idItem);
      if (!m?.mlbId || (opcoes.idItem && opcoes.idItem !== item.idItem)) continue;
      const atual = { estoque: item.estoqueMl ?? 0, preco: precoNoMl(item, c.dados.ajustePreco) };
      const corpo = opcoes.forcar
        ? { available_quantity: atual.estoque, ...(atual.preco > 0 ? { price: atual.preco } : {}) }
        : mudancasParaMl({ estoque: m.estoqueEnviado, preco: m.precoEnviado }, atual);
      if (!corpo) continue;
      const linha: ResultadoSincronizacao = {
        idAnuncio: Number(c.registro.id), idItem: item.idItem, sku: item.sku, mlbId: m.mlbId,
        estoqueDe: corpo.available_quantity !== undefined ? m.estoqueEnviado : null,
        estoquePara: corpo.available_quantity ?? null,
        precoDe: corpo.price !== undefined ? m.precoEnviado : null,
        precoPara: corpo.price ?? null,
        erro: null,
      };
      try {
        const r: any = await ml(tenant, 'PUT', `/items/${m.mlbId}`, corpo);
        await pool.execute(
          `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens
           SET estoque_enviado = COALESCE(?, estoque_enviado), preco_enviado = COALESCE(?, preco_enviado),
               status_ml = COALESCE(?, status_ml), sincronizado_em = NOW(), ultimo_erro = NULL
           WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
          [corpo.available_quantity ?? null, corpo.price ?? null, r?.status || null, Number(c.registro.id), tenant, item.idItem]
        );
      } catch (e: any) {
        linha.erro = e instanceof ErroML ? e.message : (e?.message || 'erro');
        await pool.execute(
          `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens SET ultimo_erro = ? WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
          [String(linha.erro).slice(0, 500), Number(c.registro.id), tenant, item.idItem]
        );
      }
      resultado.push(linha);
    }
  }
  if (resultado.length) {
    const ids = [...new Set(resultado.filter(r => !r.erro).map(r => r.idAnuncio))];
    for (const id of ids) {
      await pool.execute(`UPDATE modulo_ecommerce_mercadolivre_anuncios SET sincronizado_em = NOW() WHERE id = ? AND tenant_id = ?`, [id, tenant]);
    }
  }
  return resultado;
};

// ---------------------------------------------------------------------------
// Rodada automática
// ---------------------------------------------------------------------------

const INTERVALO_MS = 3 * 60 * 1000;

export interface SituacaoAutomatica { ultimaEm: string | null; enviados: number; erros: number; mensagem: string | null; rodando: boolean }
const situacao = new Map<number, SituacaoAutomatica>();
let iniciado = false;
let rodando = false;

export const situacaoAutomatica = (tenant: number): SituacaoAutomatica & { intervaloMin: number } => ({
  ...(situacao.get(tenant) || { ultimaEm: null, enviados: 0, erros: 0, mensagem: null, rodando: false }),
  rodando,
  intervaloMin: INTERVALO_MS / 60000,
});

const rodada = async () => {
  if (rodando) return;
  rodando = true;
  try {
    const [lojas]: any = await pool.execute(
      `SELECT m.tenant_id FROM sistema_modulos m
       INNER JOIN modulo_ecommerce_mercadolivre_contas c ON c.tenant_id = m.tenant_id
       WHERE m.codigo = 'ECOMMERCE_MERCADOLIVRE' AND m.ativo = 1`
    );
    for (const { tenant_id } of lojas) {
      const tenant = Number(tenant_id);
      try {
        const r = await sincronizarAnuncios(tenant, { somenteAutomaticos: true });
        const erros = r.filter(x => x.erro);
        situacao.set(tenant, {
          ultimaEm: new Date().toISOString(), enviados: r.length - erros.length, erros: erros.length,
          mensagem: erros[0] ? `${erros[0].sku}: ${erros[0].erro}` : null, rodando: false,
        });
      } catch (e: any) {
        situacao.set(tenant, { ultimaEm: new Date().toISOString(), enviados: 0, erros: 1, mensagem: e?.message || 'erro', rodando: false });
      }
    }
  } catch (e: any) {
    console.error('[Mercado Livre] sincronização automática:', e?.message || e);
  } finally {
    rodando = false;
  }
};

/** Liga a rodada automática (chamada uma vez quando o servidor sobe). */
export const iniciarSincronizacaoAutomatica = () => {
  if (iniciado) return;
  iniciado = true;
  setTimeout(rodada, 30 * 1000);
  setInterval(rodada, INTERVALO_MS);
};

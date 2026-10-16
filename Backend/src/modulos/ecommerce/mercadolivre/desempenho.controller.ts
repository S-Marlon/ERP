// Desempenho dos anúncios (lista principal): visitas do ML por dia e vendas dos pedidos do ML importados no ERP,
// últimos 30 dias contra os 30 anteriores, e a cobertura do estoque no ML.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarAnuncios, responderErro, tenantDe } from './anuncios.controller';
import { foraDoMl } from './anuncios';
import { ml } from './mercadolivreApi';
import { acaoDoStatus } from './pedidos';
import { coberturaDias, DIAS_PADRAO, numeros, Numeros, PedidoResumo, periodos, somar, vendasNoPeriodo, visitasNoPeriodo } from './desempenho';

// visitas por dia de cada anúncio (o ML só deixa consultar um por vez): guardadas por 1 h
const cacheVisitas = new Map<string, { em: number; valor: Promise<{ date: string; total: number }[] | null> }>();
const visitasPorDia = (tenant: number, mlb: string, dias: number) => {
  const chave = `${tenant}|${mlb}|${dias}`;
  const g = cacheVisitas.get(chave);
  if (g && Date.now() - g.em < 60 * 60 * 1000) return g.valor;
  const valor = ml(tenant, 'GET', `/items/${mlb}/visits/time_window?last=${dias}&unit=day`)
    .then((r: any) => (Array.isArray(r?.results) ? r.results : []))
    .catch(() => null);
  valor.then(v => { if (v === null) cacheVisitas.delete(chave); });
  cacheVisitas.set(chave, { em: Date.now(), valor });
  return valor;
};

/** GET /anuncios/desempenho — por anúncio e por linha: visitas, vendas e conversão (30 dias × 30 anteriores) e cobertura. */
export const desempenhoAnuncios = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const dias = DIAS_PADRAO;
    const per = periodos(new Date(), dias);
    const anuncios = await carregarAnuncios(pool as any, tenant);

    // visitas: uma consulta por anúncio publicado, 5 de cada vez (2 períodos + hoje)
    const mlbs = [...new Set(anuncios.flatMap(c => [...c.noMl.values()].filter(m => m.mlbId && !foraDoMl(m.status)).map(m => m.mlbId!)))];
    const visitas = new Map<string, { date: string; total: number }[] | null>();
    for (let k = 0; k < mlbs.length; k += 5) {
      const parte = mlbs.slice(k, k + 5);
      const r = await Promise.all(parte.map(m => visitasPorDia(tenant, m, dias * 2 + 1)));
      parte.forEach((m, i) => visitas.set(m, r[i]));
    }

    // vendas: pedidos do ML gravados no ERP desde o começo do período anterior
    const [linhas]: any = await pool.execute(
      `SELECT DATE_FORMAT(data_pedido, '%Y-%m-%d %H:%i:%s') AS data, status, detalhes
       FROM modulo_ecommerce_mercadolivre_pedidos WHERE tenant_id = ? AND data_pedido >= ?`,
      [tenant, per.anterior.de]
    );
    const pedidos: PedidoResumo[] = linhas.map((p: any) => {
      let itens: any[] = [];
      try { itens = JSON.parse(p.detalhes || '{}').itens || []; } catch { /* sem itens */ }
      return { data: String(p.data || ''), pago: acaoDoStatus(String(p.status || '')) === 'VENDER', itens: itens.map(i => ({ mlbId: String(i.mlbId || ''), quantidade: Number(i.quantidade) || 0 })) };
    });
    const vendasAtual = vendasNoPeriodo(pedidos, per.atual);
    const vendasAntes = vendasNoPeriodo(pedidos, per.anterior);

    const saida = anuncios.map(c => {
      const porLinha = c.itens.flatMap(item => {
        const m = c.noMl.get(item.idLinha);
        if (!m?.mlbId) return [];
        const v = visitas.get(m.mlbId);
        const atual: Numeros = numeros(v ? visitasNoPeriodo(v, per.atual) : 0, vendasAtual.get(m.mlbId));
        const anterior: Numeros = numeros(v ? visitasNoPeriodo(v, per.anterior) : 0, vendasAntes.get(m.mlbId));
        return [{ idLinha: item.idLinha, atual, anterior, semVisitas: v === null || v === undefined, estoqueMl: item.estoqueMl ?? 0 }];
      });
      if (!porLinha.length) return null;
      const atual = somar(porLinha.map(l => l.atual));
      return {
        id: Number(c.registro.id), atual, anterior: somar(porLinha.map(l => l.anterior)), semVisitas: porLinha.every(l => l.semVisitas),
        coberturaDias: coberturaDias(porLinha.reduce((s, l) => s + l.estoqueMl, 0), atual.unidades, dias),
        linhas: porLinha.map(l => ({ idLinha: l.idLinha, atual: l.atual, anterior: l.anterior, coberturaDias: coberturaDias(l.estoqueMl, l.atual.unidades, dias) })),
      };
    }).filter(Boolean);
    return res.json({ dias, periodo: per, anuncios: saida });
  } catch (error) {
    return responderErro(res, error, 'Erro ao ler o desempenho dos anúncios.');
  }
};

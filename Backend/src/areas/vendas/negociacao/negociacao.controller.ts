// Orçamento de negociação: prepara as linhas para a tela (preço de tabela atual, custo da linha, categoria com a margem
// sugerida, unidade base e a última venda do item para este cliente) e devolve as margens configuradas. A conta da
// margem e o "equilibrar" ficam em negociacao.ts; salvar é o mesmo POST dos orçamentos (pedidosAbertos.controller).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { calcularItensDoPedido } from '../pdv/vendas.controller';
import { custoDasLinhas } from '../pdv/pedidosAbertos.controller';
import { ErroVenda } from '../pdv/vendaPdv';
import { carregarMargensNegociacao, carregarRegras } from '../regras/regrasVenda.controller';
import { margem } from './negociacao';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** POST /api/vendas/negociacao/preparar { itens: [{ idItem, quantidade, idUnidade?, componentes? }], idCliente? } */
export const prepararNegociacao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const itens = req.body?.itens;
    if (!Array.isArray(itens) || !itens.length) throw new ErroVenda('Sem itens para negociar.');
    const { ids, itensBanco, linhas } = await calcularItensDoPedido(pool as any, tenant, itens.map((i: any) => ({ ...i, precoUnitario: null })));
    const custoDaLinha = await (await custoDasLinhas(pool, tenant, ids, itensBanco))(linhas);

    const idsCat = [...new Set([...itensBanco.values()].map((i: any) => Number(i.categoria_id)).filter(Boolean))];
    const [cats]: any = idsCat.length
      ? await pool.execute(`SELECT id, nome, margem_sugerida FROM comercial_categorias WHERE tenant_id = ? AND id IN (${idsCat.map(() => '?').join(',')})`, [tenant, ...idsCat])
      : [[]];
    const categoria = new Map<number, any>(cats.map((c: any) => [Number(c.id), c]));

    // última venda de cada item para este cliente (preço e margem daquela venda)
    const idCliente = Number(req.body?.idCliente) || 0;
    const ultima = new Map<number, any>();
    if (idCliente) {
      const [hist]: any = await pool.execute(
        `SELECT i.id_item, i.preco_unitario, i.fator_conversao, i.custo_unitario_base, i.unidade_sigla, p.id_venda, DATE_FORMAT(p.created_at, '%Y-%m-%d') AS dia
         FROM vendas_pedidos_itens i JOIN vendas_pedidos p ON p.id_venda = i.id_venda
         WHERE p.tenant_id = ? AND p.id_cliente = ? AND p.status = 'CONCLUIDA' AND i.quantidade > 0 AND i.id_item IN (${ids.map(() => '?').join(',')})
         ORDER BY p.created_at DESC, p.id_venda DESC`,
        [tenant, idCliente, ...ids]);
      for (const h of hist) if (!ultima.has(Number(h.id_item))) ultima.set(Number(h.id_item), h);
    }

    const regras = await carregarRegras(pool as any, tenant);
    return res.json({
      config: { ...(await carregarMargensNegociacao(pool as any, tenant)), temSenha: Boolean(regras.senhaHash) },
      linhas: linhas.map((l, indice) => {
        const item: any = itensBanco.get(l.idItem);
        const cat = categoria.get(Number(item.categoria_id) || -1);
        const custoUnitario = r4(custoDaLinha(l) * l.fator);
        const h = ultima.get(l.idItem);
        const fatorHist = h ? Number(h.fator_conversao) || 1 : 1;
        return {
          indice, idItem: l.idItem, sku: item.sku_customizado || item.sku_core, nome: item.nome_comercial || item.nome_item,
          quantidade: l.quantidade, idUnidade: l.idUnidade, sigla: l.sigla, fator: l.fator, siglaBase: item.sigla_base || null,
          precoTabela: l.precoTabela, custoUnitario, margemTabela: margem(l.precoTabela, custoUnitario),
          categoria: cat ? { id: Number(cat.id), nome: cat.nome, margemSugerida: Number(cat.margem_sugerida) > 0 ? Number(cat.margem_sugerida) / 100 : null } : null,
          // preço da última venda convertido para a unidade desta linha
          ultimaVenda: h ? {
            idVenda: Number(h.id_venda), data: h.dia, preco: r4(Number(h.preco_unitario) / fatorHist * l.fator), unidade: h.unidade_sigla,
            margem: margem(Number(h.preco_unitario), Number(h.custo_unitario_base) * fatorHist),
          } : null,
        };
      }),
    });
  } catch (e: any) {
    if (e instanceof ErroVenda) return res.status(e.status).json({ error: e.message });
    console.error('Erro ao preparar a negociação:', e);
    return res.status(500).json({ error: 'Erro ao preparar a negociação.' });
  }
};

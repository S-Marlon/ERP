// Tela de pendências do PIM: todos os itens com algo a resolver, sem precisar entrar família por família.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { avaliarPublicacaoItens } from './publicacaoProdutos';
import { CodigoPendencia, PENDENCIAS, Pendencia, itemDeVenda, pendenciasDoItem } from './pendenciasPim';

const tenantDe = (req: Request): number =>
  Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

/**
 * GET /catalogo/pendencias?tipo=VENDA|TODOS&familia_id=&codigo=&nivel=&busca=&lote=&page=&limit=
 * lote: só os itens que entraram por aquela nota (aviso após a aprovação).
 * Retorna os itens com pendência, o resumo por pendência e por família.
 */
export const listarPendenciasPim = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const tipo = String(req.query.tipo || 'VENDA').toUpperCase();
    const familiaFiltro = req.query.familia_id !== undefined && req.query.familia_id !== '' ? String(req.query.familia_id) : null;
    const codigo = req.query.codigo ? String(req.query.codigo).toUpperCase() as CodigoPendencia : null;
    const nivel = req.query.nivel ? String(req.query.nivel) : null;
    const busca = String(req.query.busca || '').trim();
    const lote = Number(req.query.lote) || null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const where: string[] = ['ic.tenant_id = ?', "UPPER(COALESCE(ic.status, 'ATIVO')) <> 'INATIVO'"];
    const params: any[] = [tenant];
    if (busca) {
      where.push('(ic.sku LIKE ? OR cpd.sku_customizado LIKE ? OR ic.nome_item LIKE ? OR cpd.nome_comercial LIKE ?)');
      params.push(...Array(4).fill(`%${busca}%`));
    }
    if (lote) {
      where.push(`ic.id_item IN (SELECT produto_id_sistema FROM importacao_produtos_staging
                  WHERE lote_importacao_id = ? AND tenant_id = ? AND produto_id_sistema IS NOT NULL)`);
      params.push(lote, tenant);
    }

    const [rows]: any = await pool.execute(
      `SELECT ic.id_item, COALESCE(NULLIF(cpd.sku_customizado, ''), ic.sku) AS sku,
              COALESCE(NULLIF(cpd.nome_comercial, ''), ic.nome_item) AS nome, UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) AS tipo_recurso,
              cpd.familia_id, f.nome AS familia_nome, f.status AS familia_status, f.comportamento_marca,
              COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id, cat.nome AS categoria_nome, cpd.id_marca,
              EXISTS (SELECT 1 FROM comercial_precos_faixas pf
                      WHERE pf.tenant_id = ic.tenant_id AND pf.id_item = ic.id_item AND pf.preco_unitario > 0) AS tem_preco,
              EXISTS (SELECT 1 FROM comercial_unidades_venda uv
                      WHERE uv.tenant_id = ic.tenant_id AND uv.id_item = ic.id_item AND NULLIF(TRIM(uv.gtin), '') IS NOT NULL) AS tem_gtin
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
       LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id)
       WHERE ${where.join(' AND ')}`,
      params
    );
    const itensBase = rows.filter((r: any) => tipo === 'TODOS' || itemDeVenda(r.tipo_recurso));
    const ids = itensBase.map((r: any) => Number(r.id_item));
    const publicacao = ids.length > 0 ? await avaliarPublicacaoItens(pool as any, tenant, ids) : new Map();

    type Linha = { item: any; pendencias: Pendencia[] };
    const comPendencia: Linha[] = [];
    for (const r of itensBase) {
      const pub = publicacao.get(Number(r.id_item));
      const pendencias = pendenciasDoItem({
        tipoRecurso: r.tipo_recurso,
        familiaId: r.familia_id ? Number(r.familia_id) : null,
        categoriaId: r.categoria_id ? Number(r.categoria_id) : null,
        comportamentoMarca: r.comportamento_marca || null,
        idMarca: r.id_marca ? Number(r.id_marca) : null,
        temPreco: Boolean(Number(r.tem_preco)),
        temGtin: Boolean(Number(r.tem_gtin)),
        motivosPublicacao: pub?.motivos || [],
        gradeSemValor: pub?.gradeSemValor || [],
      });
      if (pendencias.length > 0) comPendencia.push({ item: r, pendencias });
    }

    // Por família (sem o filtro de família, para navegar entre elas)
    const familias = new Map<string, { familiaId: number | null; nome: string; itens: number; criticos: number }>();
    for (const l of comPendencia) {
      const chave = l.item.familia_id ? String(l.item.familia_id) : '0';
      if (!familias.has(chave)) familias.set(chave, { familiaId: l.item.familia_id ? Number(l.item.familia_id) : null, nome: l.item.familia_nome || '(sem família)', itens: 0, criticos: 0 });
      const f = familias.get(chave)!;
      f.itens++;
      if (l.pendencias.some(p => p.nivel === 'critico')) f.criticos++;
    }

    let filtrados = familiaFiltro === null ? comPendencia
      : comPendencia.filter(l => String(l.item.familia_id || 0) === familiaFiltro);
    const resumo: Record<string, number> = {};
    for (const c of Object.keys(PENDENCIAS)) resumo[c] = 0;
    for (const l of filtrados) for (const p of l.pendencias) resumo[p.codigo]++;

    if (codigo) filtrados = filtrados.filter(l => l.pendencias.some(p => p.codigo === codigo));
    if (nivel) filtrados = filtrados.filter(l => l.pendencias.some(p => p.nivel === nivel));

    const peso = (l: Linha) => (l.pendencias.some(p => p.nivel === 'critico') ? 0 : 1);
    filtrados.sort((a, b) => peso(a) - peso(b)
      || String(a.item.familia_nome || '~').localeCompare(String(b.item.familia_nome || '~'))
      || String(a.item.nome).localeCompare(String(b.item.nome)));

    const pagina = filtrados.slice((page - 1) * limit, page * limit).map(l => ({
      idItem: Number(l.item.id_item),
      sku: l.item.sku,
      nome: l.item.nome,
      tipoRecurso: l.item.tipo_recurso,
      familia: l.item.familia_id ? { id: Number(l.item.familia_id), nome: l.item.familia_nome, status: l.item.familia_status } : null,
      categoria: l.item.categoria_id ? { id: Number(l.item.categoria_id), nome: l.item.categoria_nome } : null,
      pendencias: l.pendencias,
    }));

    return res.json({
      data: pagina,
      pagination: { page, limit, total: filtrados.length },
      totalItensComPendencia: comPendencia.length,
      criticos: comPendencia.filter(l => l.pendencias.some(p => p.nivel === 'critico')).length,
      resumo,
      porFamilia: [...familias.values()].sort((a, b) => b.criticos - a.criticos || b.itens - a.itens),
      tipos: PENDENCIAS,
    });
  } catch (error: any) {
    console.error('Erro ao listar pendências do PIM:', error);
    return res.status(500).json({ error: error.message });
  }
};

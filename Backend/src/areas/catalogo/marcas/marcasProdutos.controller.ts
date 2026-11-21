// Marcas (Catálogo › Marcas): os produtos de uma marca com vendas, estoque e curva; editar a marca; trocar a marca de um item.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarCurva } from '../../estoque/curvaAbc/curvaAbc.controller';
import { classeExibida } from '../../estoque/curvaAbc/curvaAbc';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** GET /api/catalogo/marcas/:id/produtos?dias=90 — produtos da marca (no item ou, sem marca no item, na família). */
export const produtosDaMarca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const dias = [30, 90, 180, 365].includes(Number(req.query.dias)) ? Number(req.query.dias) : 90;
    const [[marca]]: any = await pool.execute(`SELECT id, nome FROM comercial_marcas WHERE id = ? AND tenant_id = ?`, [id, tenant]);
    if (!marca) return res.status(404).json({ error: 'Marca não encontrada.' });
    const [ligados]: any = await pool.execute(
      `SELECT cpd.id_item, (cpd.id_marca IS NULL) AS pela_familia, ic.status
       FROM comercial_produtos_dados cpd
       INNER JOIN itens_core ic ON ic.id_item = cpd.id_item
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
       WHERE cpd.tenant_id = ? AND (cpd.id_marca = ? OR (cpd.id_marca IS NULL AND f.id_marca = ?))`, [tenant, id, id]);
    const pelaFamilia = new Map<number, boolean>(ligados.map((l: any) => [Number(l.id_item), Boolean(Number(l.pela_familia))]));
    const inativos = ligados.filter((l: any) => String(l.status).toUpperCase() !== 'ATIVO').length;
    const curva = await carregarCurva(tenant, dias);
    const itens = curva.itens.filter(i => pelaFamilia.has(i.idItem)).map(i => ({
      idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidade, categoria: (i as any).categoria || i.categoriaTopoNome,
      receita: i.receita, lucro: i.lucro, margem: i.margem, quantidade: i.quantidade, vendas: i.vendas, estoque: i.estoque, valorEstoque: i.valorEstoque,
      custoUnitario: i.custoUnitario, precoVenda: i.precoVenda, coberturaDias: i.coberturaDias, ultimaVenda: i.ultimaVenda, situacao: i.situacao,
      classeVenda: classeExibida(i, 'VENDA'), classeEstoque: i.estoqueClasse, xyz: i.xyz, recomendacao: i.recomendacao,
      decisaoCompra: (i as any).decisaoCompra || null, pelaFamilia: pelaFamilia.get(i.idItem) || false,
    })).sort((a, b) => b.receita - a.receita || b.valorEstoque - a.valorEstoque);
    const soma = (f: (x: typeof itens[number]) => number) => r2(itens.reduce((a, x) => a + f(x), 0));
    return res.json({
      marca: { id: Number(marca.id), nome: marca.nome }, dias, diasDeHistorico: curva.diasDeHistorico, inativos,
      totais: {
        itens: itens.length, vendidos: itens.filter(i => i.situacao === 'NORMAL').length, receita: soma(i => i.receita), lucro: soma(i => i.lucro),
        estoque: soma(i => i.valorEstoque), parado: soma(i => (i.situacao === 'PARADO' ? i.valorEstoque : 0)),
      },
      itens,
    });
  } catch (error: any) {
    console.error('Erro nos produtos da marca:', error);
    return res.status(500).json({ error: 'Erro ao carregar os produtos da marca.', details: error?.message });
  }
};

/** PUT /api/catalogo/marcas/:id { nome, codigo, site, descricao, status } */
export const atualizarMarca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const nome = String(req.body?.nome || '').trim().slice(0, 150);
    if (!nome) return res.status(400).json({ error: 'O nome da marca é obrigatório.' });
    const status = req.body?.status === 'Inativo' ? 'Inativo' : 'Ativo';
    const [r]: any = await pool.execute(
      `UPDATE comercial_marcas SET nome = ?, codigo = ?, site = ?, descricao = ?, status = ?, alterado_em = NOW() WHERE id = ? AND tenant_id = ?`,
      [nome, String(req.body?.codigo || '').trim().slice(0, 10) || null, String(req.body?.site || '').trim().slice(0, 255) || null,
        String(req.body?.descricao || '').trim() || null, status, Number(req.params.id), tenant]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Marca não encontrada.' });
    return res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Já existe uma marca com este nome.' });
    console.error('Erro ao salvar marca:', error);
    return res.status(500).json({ error: 'Erro ao salvar a marca.', details: error?.message });
  }
};

/** PUT /api/catalogo/marcas/itens/:idItem { idMarca | null } — corrige a marca de um item. */
export const trocarMarcaDoItem = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idMarca = req.body?.idMarca ? Number(req.body.idMarca) : null;
    if (idMarca) {
      const [[m]]: any = await pool.execute(`SELECT id FROM comercial_marcas WHERE id = ? AND tenant_id = ?`, [idMarca, tenant]);
      if (!m) return res.status(404).json({ error: 'Marca não encontrada.' });
    }
    const [r]: any = await pool.execute(`UPDATE comercial_produtos_dados SET id_marca = ? WHERE id_item = ? AND tenant_id = ?`, [idMarca, Number(req.params.idItem), tenant]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Item não encontrado.' });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao trocar a marca do item.', details: error?.message });
  }
};

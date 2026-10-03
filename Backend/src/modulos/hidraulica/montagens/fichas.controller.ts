// Fichas técnicas das mangueiras (modulo_hidraulica_montagens_mangueiras): gravadas na montagem feita na hora
// (ligadas à venda) ou na OS; o histórico por cliente/equipamento serve para refazer a mesma mangueira.
import { Request, Response } from 'express';
import pool from '../../../routes/Estoque/db.config';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null;

export interface FichaEntrada {
  equipamento?: string; posicao?: string; bitola?: string; comprimentoM?: number; quantidade?: number;
  terminalA?: string; terminalB?: string; angulo?: string; pressaoTrabalho?: string; observacao?: string;
}

/** Insere fichas (dentro de uma transação já aberta). Usado pela montagem na hora e pela OS. */
export const inserirFichas = async (conn: any, tenant: number, fichas: FichaEntrada[], vinculo: { idVenda?: number | null; idOs?: number | null; idCliente?: number | null }) => {
  const ids: number[] = [];
  for (const f of fichas) {
    const comprimento = Number(f.comprimentoM);
    const [r]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_montagens_mangueiras
         (tenant_id, id_os, id_venda, id_cliente, equipamento, posicao, bitola, comprimento_m, quantidade,
          terminal_a, terminal_b, angulo, pressao_trabalho, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant, vinculo.idOs || null, vinculo.idVenda || null, vinculo.idCliente || null,
        txt(f.equipamento, 150), txt(f.posicao, 150), txt(f.bitola, 20),
        Number.isFinite(comprimento) && comprimento > 0 ? comprimento.toFixed(3) : null,
        Math.max(1, Math.floor(Number(f.quantidade) || 1)),
        txt(f.terminalA, 150), txt(f.terminalB, 150), txt(f.angulo, 30), txt(f.pressaoTrabalho, 30), txt(f.observacao, 255),
      ]
    );
    ids.push(Number(r.insertId));
  }
  return ids;
};

/** POST /fichas { idVenda, fichas: [...] } — fichas das montagens feitas na hora, depois da venda gravada */
export const salvarFichasDaVenda = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idVenda = Number(req.body?.idVenda);
  const fichas: FichaEntrada[] = Array.isArray(req.body?.fichas) ? req.body.fichas : [];
  if (!idVenda || fichas.length === 0) return res.status(400).json({ error: 'Informe a venda e as fichas.' });
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[venda]]: any = await connection.execute(`SELECT id_venda, id_cliente, status FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ?`, [idVenda, tenant]);
    if (!venda) { await connection.rollback(); return res.status(404).json({ error: 'Venda não encontrada.' }); }
    const ids = await inserirFichas(connection, tenant, fichas, { idVenda, idCliente: venda.id_cliente ? Number(venda.id_cliente) : null });
    await connection.commit();
    return res.status(201).json({ success: true, ids });
  } catch (error: any) {
    await connection.rollback().catch(() => undefined);
    console.error('Erro ao salvar fichas de montagem:', error);
    return res.status(500).json({ error: 'Erro ao salvar as fichas.', details: error?.message });
  } finally {
    connection.release();
  }
};

/** GET /fichas?idCliente=&busca= — histórico para refazer (equipamento, posição, bitola, terminais) */
export const listarFichas = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const filtros = ['m.tenant_id = ?'];
    const params: any[] = [tenant];
    if (Number(req.query.idCliente) > 0) { filtros.push('m.id_cliente = ?'); params.push(Number(req.query.idCliente)); }
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      filtros.push(`(m.equipamento LIKE ? OR m.posicao LIKE ? OR m.bitola LIKE ? OR m.terminal_a LIKE ? OR m.terminal_b LIKE ? OR m.observacao LIKE ?)`);
      params.push(...Array(6).fill(`%${busca}%`));
    }
    const [rows]: any = await pool.execute(
      `SELECT m.*, COALESCE(NULLIF(pf.nome, ''), NULLIF(pj.nome_fantasia, ''), pj.razao_social, v.cliente_nome, o.cliente_nome) AS cliente
       FROM modulo_hidraulica_montagens_mangueiras m
       LEFT JOIN pessoas_pf pf ON pf.id_cliente = m.id_cliente
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = m.id_cliente
       LEFT JOIN vendas_pedidos v ON v.id_venda = m.id_venda
       LEFT JOIN modulo_hidraulica_montagens_os o ON o.id_os = m.id_os
       WHERE ${filtros.join(' AND ')} ORDER BY m.id_mangueira DESC LIMIT 200`,
      params
    );
    return res.json(rows.map((m: any) => ({
      idMangueira: Number(m.id_mangueira), idOs: m.id_os ? Number(m.id_os) : null, idVenda: m.id_venda ? Number(m.id_venda) : null,
      idCliente: m.id_cliente ? Number(m.id_cliente) : null, cliente: m.cliente, equipamento: m.equipamento, posicao: m.posicao,
      bitola: m.bitola, comprimentoM: m.comprimento_m === null ? null : Number(m.comprimento_m), quantidade: Number(m.quantidade),
      terminalA: m.terminal_a, terminalB: m.terminal_b, angulo: m.angulo, pressaoTrabalho: m.pressao_trabalho,
      observacao: m.observacao, criadoEm: m.created_at,
    })));
  } catch (error: any) {
    console.error('Erro ao listar fichas de montagem:', error);
    return res.status(500).json({ error: 'Erro ao listar as fichas.', details: error?.message });
  }
};

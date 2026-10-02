// Dicionário de unidades de entrada (itens_unidades_equivalencias): consulta para a conferência,
// cadastro da resposta "o que é 'M' deste fornecedor?" e a lista para manutenção.
import { Request, Response } from 'express';
import db from '../../Estoque/db.config';
import { obterOuCriarUnidade } from '../../Catalogo/Vendas/configVendas.controller';
import { carregarResolvedor, normalizarSigla } from '../staging/unidadesEntrada';
import { buscarFornecedorId } from './stagingLoteController';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.body?.tenant_id || 1);

const unidadesDoCadastro = async (tenant: number) => {
  const [rows]: any = await db.execute(
    `SELECT id_unidade AS id, sigla, descricao FROM itens_unidades_medida WHERE tenant_id = ? AND ativa = 1 ORDER BY sigla`, [tenant]
  );
  return rows.map((r: any) => ({ id: Number(r.id), sigla: String(r.sigla), descricao: String(r.descricao || r.sigla) }));
};

/**
 * GET /compras/unidades-entrada?cnpj=&siglas=M,KG
 * Como cada sigla da nota será tratada para este fornecedor + as unidades do cadastro (para escolher).
 */
export const resolverUnidadesEntrada = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const idFornecedor = await buscarFornecedorId(db as any, String(req.query.cnpj || ''), tenant);
    const siglas = [...new Set(String(req.query.siglas || '').split(',').map(normalizarSigla).filter(Boolean))];
    const resolver = await carregarResolvedor(db as any, tenant, idFornecedor);
    const resolucoes = Object.fromEntries(siglas.map(s => [s, resolver(s)]));
    return res.json({ idFornecedor, unidades: await unidadesDoCadastro(tenant), resolucoes });
  } catch (error: any) {
    console.error('Erro ao resolver unidades de entrada:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /compras/unidades-equivalencias — todas as regras (geral e por fornecedor)
 */
export const listarEquivalencias = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const [rows]: any = await db.execute(
      `SELECT e.id_equivalencia AS id, e.sigla_entrada AS siglaEntrada, e.id_fornecedor AS idFornecedor,
              u.sigla AS siglaInterna, u.descricao AS descricaoInterna,
              COALESCE(NULLIF(pj.nome_fantasia, ''), pj.razao_social) AS fornecedor
       FROM itens_unidades_equivalencias e
       INNER JOIN itens_unidades_medida u ON u.id_unidade = e.id_unidade
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = e.id_fornecedor
       WHERE e.tenant_id = ?
       ORDER BY e.id_fornecedor IS NOT NULL, fornecedor, e.sigla_entrada`,
      [tenant]
    );
    return res.json({ equivalencias: rows, unidades: await unidadesDoCadastro(tenant) });
  } catch (error: any) {
    console.error('Erro ao listar equivalências de unidade:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /compras/unidades-equivalencias
 * { siglaEntrada, siglaInterna, descricaoInterna?, escopo: 'fornecedor' | 'geral', cnpj? | idFornecedor? }
 * - siglaInterna inexistente vira unidade nova do cadastro (com descricaoInterna);
 * - siglaEntrada igual à interna só cadastra a unidade (não precisa de regra).
 */
export const salvarEquivalencia = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const siglaEntrada = normalizarSigla(req.body?.siglaEntrada);
  const siglaInterna = normalizarSigla(req.body?.siglaInterna);
  const descricao = String(req.body?.descricaoInterna || '').trim() || null;
  if (!siglaEntrada || !siglaInterna) return res.status(400).json({ error: 'Informe a sigla da nota e a unidade interna.' });
  if (siglaEntrada.length > 10 || siglaInterna.length > 10) return res.status(400).json({ error: 'Sigla com no máximo 10 caracteres.' });

  const connection: any = await db.getConnection();
  try {
    await connection.beginTransaction();
    let idFornecedor: number | null = null;
    if (req.body?.escopo === 'fornecedor') {
      idFornecedor = Number(req.body?.idFornecedor) || await buscarFornecedorId(connection, String(req.body?.cnpj || ''), tenant);
      if (!idFornecedor) {
        await connection.rollback();
        return res.status(400).json({ error: 'Fornecedor não cadastrado: cadastre-o antes ou salve a regra para todos os fornecedores.' });
      }
    }
    const idUnidade = await obterOuCriarUnidade(connection, tenant, siglaInterna, descricao);
    if (siglaEntrada !== siglaInterna || idFornecedor !== null) {
      await connection.execute(
        `INSERT INTO itens_unidades_equivalencias (tenant_id, id_fornecedor, sigla_entrada, id_unidade, fator_conversao)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE id_unidade = VALUES(id_unidade)`,
        [tenant, idFornecedor, siglaEntrada, idUnidade]
      );
    }
    await connection.commit();
    return res.json({ success: true, idUnidade, idFornecedor });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao salvar equivalência de unidade:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * DELETE /compras/unidades-equivalencias/:id
 */
export const excluirEquivalencia = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const [r]: any = await db.execute(
      `DELETE FROM itens_unidades_equivalencias WHERE id_equivalencia = ? AND tenant_id = ?`, [Number(req.params.id), tenant]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Equivalência não encontrada.' });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir equivalência de unidade:', error);
    return res.status(500).json({ error: error.message });
  }
};

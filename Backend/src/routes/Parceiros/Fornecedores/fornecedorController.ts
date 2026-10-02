import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

// 🟢 [READ] Verificar se o fornecedor existe pelo CNPJ (Usado pelo Front para o Modal via GET)
export const verificarFornecedorPorCnpj = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || 1);
  const cnpj = String(req.query.cnpj || '').replace(/\D/g, '');

  if (!cnpj) {
    return res.status(400).json({ success: false, error: 'CNPJ não informado.' });
  }

  const connection = await pool.getConnection();
  try {
    const query = `
      SELECT pj.id_cliente as id, pj.razao_social as name, pj.nome_fantasia as fantasyName
      FROM pessoas_pj pj
      INNER JOIN pessoas_core c ON c.id_pessoa = pj.id_cliente
      INNER JOIN pessoas_papeis_atribuido pa ON pa.id_cliente = c.id_pessoa
      INNER JOIN pessoas_papeis_definicao pd ON pd.id_cliente_papel = pa.id_cliente_papel
      WHERE pj.cnpj = ? AND c.tenant_id = ? AND pd.codigo = 'FORNECEDOR'
      LIMIT 1
    `;
    const [rows]: [any[], any] = await connection.execute(query, [cnpj, tenantId]);

    if (rows.length > 0) {
      return res.json({
        exists: true,
        supplier: rows[0]
      });
    }

    return res.json({ exists: false });
  } catch (error: any) {
    console.error('Erro ao verificar fornecedor:', error);
    return res.status(500).json({ success: false, error: 'Erro interno ao verificar fornecedor.' });
  } finally {
    connection.release();
  }
};

// 🟢 [CREATE/FIND] Cadastrar ou Buscar Fornecedor pelo CNPJ (Ideal para o Leitor de XML)
// Body: { cnpj, razao_social, nome_fantasia?, inscricao_estadual?, inscricao_municipal?, telefone?, enderecos?: [...] }
// Pessoa já existente com o CNPJ (ex.: cadastrada como cliente) só recebe o papel de FORNECEDOR.
export const obterOuCriarFornecedorPorCnpj = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.body.tenant_id || 1);
  const dados = req.body || {};
  const cnpj = String(dados.cnpj || '').replace(/\D/g, '');

  if (!cnpj) {
    return res.status(400).json({ success: false, error: 'CNPJ do fornecedor é obrigatório.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[papel]]: any = await connection.execute(
      `SELECT id_cliente_papel FROM pessoas_papeis_definicao WHERE codigo = 'FORNECEDOR' AND ativo = 1 ORDER BY tenant_id DESC LIMIT 1`
    );
    if (!papel) throw new Error('Papel FORNECEDOR não encontrado em pessoas_papeis_definicao.');
    const idPapel = Number(papel.id_cliente_papel);

    // 1. Pessoa com este CNPJ no tenant
    const [rows]: [any[], any] = await connection.execute(
      `SELECT pj.id_cliente, pj.inscricao_estadual
       FROM pessoas_pj pj
       INNER JOIN pessoas_core c ON c.id_pessoa = pj.id_cliente
       WHERE pj.cnpj = ? AND c.tenant_id = ?
       LIMIT 1`,
      [cnpj, tenantId]
    );

    let idPessoa: number;
    let criado = false;

    if (rows.length > 0) {
      idPessoa = Number(rows[0].id_cliente);
      // Completa a IE se a pessoa ainda não tinha
      if (!rows[0].inscricao_estadual && dados.inscricao_estadual) {
        await connection.execute(`UPDATE pessoas_pj SET inscricao_estadual = ? WHERE id_cliente = ?`, [dados.inscricao_estadual, idPessoa]);
      }
    } else {
      // 2. Não existe: cadastra como PJ
      const [resultCore]: any = await connection.execute(
        `INSERT INTO pessoas_core (tenant_id, tipo_pessoa, status, observacoes, created_at)
         VALUES (?, 'PJ', 'ATIVO', 'Cadastrado a partir da nota fiscal de entrada', NOW())`,
        [tenantId]
      );
      idPessoa = Number(resultCore.insertId);
      criado = true;

      await connection.execute(
        `INSERT INTO pessoas_pj (id_cliente, tenant_id, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          idPessoa, tenantId,
          dados.razao_social || 'Fornecedor Importado',
          dados.nome_fantasia || dados.razao_social || 'Fornecedor',
          cnpj,
          dados.inscricao_estadual || null,
          dados.inscricao_municipal || null,
        ]
      );

      // Endereço da nota
      if (Array.isArray(dados.enderecos)) {
        for (const end of dados.enderecos) {
          if (!end?.logradouro) continue;
          await connection.execute(
            `INSERT INTO pessoas_enderecos (id_cliente, tenant_id, tipo, principal, logradouro, numero, complemento, bairro, cidade, estado, cep, pais, created_at)
             VALUES (?, ?, 'PRINCIPAL', 1, ?, ?, ?, ?, ?, ?, ?, 'Brasil', NOW())`,
            [idPessoa, tenantId, end.logradouro, end.numero || '', end.complemento || null, end.bairro || '', end.cidade || '', end.estado || '', String(end.cep || '').replace(/\D/g, '')]
          );
        }
      }

      // Telefone da nota
      const telefone = String(dados.telefone || '').trim();
      if (telefone) {
        await connection.execute(
          `INSERT INTO pessoas_contatos (id_cliente, tenant_id, nome_contato, tipo, telefone, principal, whatsapp, nome_referencia, created_at)
           VALUES (?, ?, '', 'FIXO', ?, 1, 0, 'Telefone da NF-e', NOW())`,
          [idPessoa, tenantId, telefone.slice(0, 20)]
        );
      }
    }

    // 3. Papel de fornecedor (também para quem já existia como cliente, por exemplo)
    const [[temPapel]]: any = await connection.execute(
      `SELECT COUNT(*) AS total FROM pessoas_papeis_atribuido WHERE id_cliente = ? AND id_cliente_papel = ?`,
      [idPessoa, idPapel]
    );
    const papelAtribuido = Number(temPapel.total) === 0;
    if (papelAtribuido) {
      await connection.execute(
        `INSERT INTO pessoas_papeis_atribuido (tenant_id, id_cliente, id_cliente_papel, created_at) VALUES (?, ?, ?, NOW())`,
        [tenantId, idPessoa, idPapel]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: criado
        ? 'Fornecedor cadastrado com sucesso.'
        : papelAtribuido ? 'CNPJ já cadastrado: marcado como fornecedor.' : 'Fornecedor já estava cadastrado.',
      id_pessoa: idPessoa,
      criado,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao processar fornecedor da nota:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar fornecedor.',
      details: error.message
    });
  } finally {
    connection.release();
  }
};

export const getFornecedores = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);

  const connection = await pool.getConnection();
  try {
    const queryCore = `
      SELECT DISTINCT
        c.id_pessoa, c.tenant_id, c.tipo_pessoa, c.status, c.observacoes, c.created_at,
        pj.razao_social, pj.nome_fantasia, pj.cnpj, pj.inscricao_estadual, pj.inscricao_municipal
      FROM pessoas_core c
      INNER JOIN pessoas_papeis_atribuido pa ON c.id_pessoa = pa.id_cliente
      INNER JOIN pessoas_papeis_definicao pd ON pa.id_cliente_papel = pd.id_cliente_papel
      INNER JOIN pessoas_pj pj ON c.id_pessoa = pj.id_cliente
      WHERE c.tenant_id = ? 
        AND c.deleted_at IS NULL
        AND pd.codigo = 'FORNECEDOR'
      ORDER BY pj.razao_social ASC
    `;
    const [rows]: [any[], any] = await connection.execute(queryCore, [tenantId]);

    if (rows.length === 0) {
      return res.json([]);
    }

    const idsPessoas = rows.map(r => r.id_pessoa);

    const [enderecos]: [any[], any] = await connection.query(
      `SELECT * FROM pessoas_enderecos WHERE id_cliente IN (?) AND deleted_at IS NULL`,
      [idsPessoas]
    );

    const [emails]: [any[], any] = await connection.query(
      `SELECT * FROM pessoas_emails WHERE id_cliente IN (?) AND deleted_at IS NULL`,
      [idsPessoas]
    );

    const [contatos]: [any[], any] = await connection.query(
      `SELECT * FROM pessoas_contatos WHERE id_cliente IN (?) AND deleted_at IS NULL`,
      [idsPessoas]
    );

    const resultadoFormatado = rows.map(fornecedor => {
      const ends = enderecos.filter(e => e.id_cliente === fornecedor.id_pessoa);
      const mailList = emails.filter(m => m.id_cliente === fornecedor.id_pessoa);
      const telList = contatos.filter(t => t.id_cliente === fornecedor.id_pessoa);

      return {
        id_pessoa: fornecedor.id_pessoa,
        tenant_id: fornecedor.tenant_id,
        status: fornecedor.status,
        razao_social: fornecedor.razao_social,
        nome_fantasia: fornecedor.nome_fantasia,
        cnpj: fornecedor.cnpj,
        inscricao_estadual: fornecedor.inscricao_estadual,
        email: mailList.find(m => m.principal)?.email || mailList[0]?.email || '',
        telefone: telList.find(t => t.principal)?.telefone || telList[0]?.telefone || '',
        enderecos: ends,
        emails: mailList,
        telefones: telList
      };
    });

    return res.json(resultadoFormatado);
  } catch (error) {
    console.error('Erro ao buscar lista de fornecedores:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar lista de fornecedores.' });
  } finally {
    connection.release();
  }
};
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
export const obterOuCriarFornecedorPorCnpj = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.body.tenant_id || 1);
  const dados = req.body; 

  if (!dados.cnpj) {
    return res.status(400).json({ success: false, error: 'CNPJ do fornecedor é obrigatório.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verifica se o fornecedor já existe na base para este tenant pelo CNPJ
    const queryBusca = `
      SELECT pj.id_cliente 
      FROM pessoas_pj pj
      INNER JOIN pessoas_core c ON c.id_pessoa = pj.id_cliente
      WHERE pj.cnpj = ? AND c.tenant_id = ?
      LIMIT 1
    `;
    const [rows]: [any[], any] = await connection.execute(queryBusca, [dados.cnpj, tenantId]);

    let idPessoa: number;

    if (rows.length > 0) {
      idPessoa = rows[0].id_cliente;
    } else {
      // 2. Se não existe, cadastra do zero como PJ
      const queryCore = `
        INSERT INTO pessoas_core (tenant_id, tipo_pessoa, status, observacoes, created_at)
        VALUES (?, 'PJ', 'ATIVO', 'Cadastrado automaticamente via importação de nota', NOW())
      `;
      const [resultCore]: any = await connection.execute(queryCore, [tenantId]);
      idPessoa = resultCore.insertId;

      // Insere em pessoas_pj
      const queryPJ = `
        INSERT INTO pessoas_pj (
          id_cliente, tenant_id, razao_social, nome_fantasia, cnpj, 
          inscricao_estadual, inscricao_municipal, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      await connection.execute(queryPJ, [
        idPessoa,
        tenantId,
        dados.razao_social || 'Fornecedor Importado',
        dados.nome_fantasia || dados.razao_social || 'Fornecedor',
        dados.cnpj,
        dados.inscricao_estadual || null,
        dados.inscricao_municipal || null
      ]);

      // 3. Atribui o Papel de Fornecedor na tabela pivô (id_cliente_papel = 2)
      const queryPapel = `
        INSERT INTO pessoas_papeis_atribuido (tenant_id, id_cliente, id_cliente_papel, created_at)
        VALUES (?, ?, 2, NOW())
      `;
      await connection.execute(queryPapel, [tenantId, idPessoa]);

      // 4. Insere Endereços se vierem preenchidos no XML
      if (dados.enderecos && Array.isArray(dados.enderecos)) {
        for (const end of dados.enderecos) {
          if (end.logradouro) {
            const queryEnd = `
              INSERT INTO pessoas_enderecos (
                id_cliente, tenant_id, tipo, principal, logradouro, numero, complemento, bairro, cidade, estado, cep, pais, created_at
              ) VALUES (?, ?, 'PRINCIPAL', 1, ?, ?, ?, ?, ?, ?, ?, 'Brasil', NOW())
            `;
            await connection.execute(queryEnd, [
              idPessoa, tenantId, end.logradouro, end.numero || '', end.complemento || null,
              end.bairro || '', end.cidade || '', end.estado || '', end.cep || ''
            ]);
          }
        }
      }
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: rows.length > 0 ? 'Fornecedor já existente localizado com sucesso!' : 'Fornecedor cadastrado automaticamente com sucesso!',
      id_pessoa: idPessoa
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

// 🔌 [READ] Buscar Apenas Fornecedores
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
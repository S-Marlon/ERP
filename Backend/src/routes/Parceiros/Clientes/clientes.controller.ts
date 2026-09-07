import { Request, Response } from 'express';
import pool from '../../Estoque/db.config'; // Ajuste o caminho do seu pool do banco

// 🟢 [CREATE] Cadastrar Pessoa Completa (PJ/PF com Endereços, E-mails e Telefones normalizados)
export const createCliente = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.body.tenant_id || 1);
  const dados = req.body;

  const connection = await pool.getConnection();
  try {
    // Inicia a transação com segurança
    await connection.beginTransaction();

    const tipoPessoa = dados.tipo_pessoa || 'PJ';
    const status = 'ATIVO';
    const observacoes = dados.observacoes || null;

    // 1. Insere na tabela core (pessoas_core)
    const queryCore = `
      INSERT INTO pessoas_core (tenant_id, tipo_pessoa, status, observacoes, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    const [resultCore]: any = await connection.execute(queryCore, [
      tenantId,
      tipoPessoa,
      status,
      observacoes
    ]);
    const idPessoa = resultCore.insertId;

    // 2. Insere na entidade específica (PJ ou PF) de acordo com o schema real
    if (tipoPessoa === 'PJ') {
      const queryPJ = `
        INSERT INTO pessoas_pj (
          id_cliente, tenant_id, razao_social, nome_fantasia, cnpj, 
          inscricao_estadual, inscricao_municipal, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      await connection.execute(queryPJ, [
        idPessoa,
        tenantId,
        dados.razao_social || '',
        dados.nome_fantasia || null,
        dados.documento || '', // CNPJ salvo em 'documento' no front vindo do form
        dados.inscricao_estadual || null,
        dados.inscricao_municipal || null
      ]);
    } else {
      const queryPF = `
        INSERT INTO pessoas_pf (
          id_cliente, tenant_id, nome, cpf, rg, created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
      `;
      await connection.execute(queryPF, [
        idPessoa,
        tenantId,
        dados.nome_pf || '',
        dados.documento || '', // CPF
        dados.rg || null
      ]);
    }

    // 3. Atribui o Papel de Consumidor/Cliente na tabela pivô (id_cliente_papel = 1)
    const queryPapel = `
      INSERT INTO pessoas_papeis_atribuido (tenant_id, id_cliente, id_cliente_papel, created_at)
      VALUES (?, ?, 1, NOW())
    `;
    await connection.execute(queryPapel, [tenantId, idPessoa]);

    // 4. Insere Endereços (Mapeando para o schema de pessoas_enderecos)
    if (dados.enderecos && Array.isArray(dados.enderecos)) {
      for (const end of dados.enderecos) {
        if (end.logradouro) {
          const queryEnd = `
            INSERT INTO pessoas_enderecos (
              id_cliente, tenant_id, tipo, principal, logradouro, numero, complemento, bairro, cidade, estado, cep, pais, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Brasil', NOW())
          `;
          await connection.execute(queryEnd, [
            idPessoa,
            tenantId,
            end.tipo || 'PRINCIPAL',
            end.is_principal ? 1 : 0,
            end.logradouro || '',
            end.numero || '',
            end.complemento || null,
            end.bairro || '',
            end.cidade || '',
            end.estado || '',
            end.cep || ''
          ]);
        }
      }
    }

    // 5. Insere E-mails (Mapeando para o schema de pessoas_emails)
    if (dados.emails && Array.isArray(dados.emails)) {
      for (const mail of dados.emails) {
        if (mail.email) {
          const queryMail = `
            INSERT INTO pessoas_emails (
              id_cliente, tenant_id, email, tipo, principal, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
          `;
          await connection.execute(queryMail, [
            idPessoa,
            tenantId,
            mail.email,
            mail.tipo || 'PESSOAL',
            mail.is_principal ? 1 : 0
          ]);
        }
      }
    }

    // 6. Insere Telefones/Contatos (Mapeando para o schema de pessoas_contatos)
    if (dados.telefones && Array.isArray(dados.telefones)) {
      for (const tel of dados.telefones) {
        if (tel.telefone) {
          const queryTel = `
            INSERT INTO pessoas_contatos (
              id_cliente, tenant_id, nome_contato, tipo, telefone, principal, whatsapp, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
          `;
          await connection.execute(queryTel, [
            idPessoa,
            tenantId,
            tel.nome_contato || 'Contato Principal',
            tel.tipo || 'CELULAR',
            tel.telefone,
            tel.is_principal ? 1 : 0,
            tel.whatsapp ? 1 : 0
          ]);
        }
      }
    }

    // Efetiva a transação no banco de dados
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Cliente cadastrado com sucesso!',
      id_pessoa: idPessoa
    });

  } catch (error: any) {
    // Desfaz tudo se houver qualquer erro
    await connection.rollback();
    console.error('Erro ao cadastrar cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar o cadastro.',
      details: error.message
    });
  } finally {
    connection.release();
  }
};

// 🔌 [READ] Buscar Clientes/Pessoas (Unindo Core com PF e PJ)
export const getClientes = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);

  const connection = await pool.getConnection();
  try {
    // 1. Busca registros core que possuem o papel de Cliente/Consumidor
    const queryCore = `
      SELECT DISTINCT
        c.id_pessoa, c.tenant_id, c.tipo_pessoa, c.status, c.observacoes, c.created_at,
        pf.nome as pf_nome, pf.cpf, pf.rg, pf.data_nascimento, pf.genero,
        pj.razao_social, pj.nome_fantasia, pj.cnpj, pj.inscricao_estadual, pj.inscricao_municipal
      FROM pessoas_core c
      INNER JOIN pessoas_papeis_atribuido pa ON c.id_pessoa = pa.id_cliente
      INNER JOIN pessoas_papeis_definicao pd ON pa.id_cliente_papel = pd.id_cliente_papel
      LEFT JOIN pessoas_pf pf ON c.id_pessoa = pf.id_cliente
      LEFT JOIN pessoas_pj pj ON c.id_pessoa = pj.id_cliente
      WHERE c.tenant_id = ? 
        AND c.deleted_at IS NULL
        AND (pd.codigo = 'CONSUMIDOR' OR pd.codigo = 'CLIENTE')
      ORDER BY c.id_pessoa DESC
    `;
    const [rows]: [any[], any] = await connection.execute(queryCore, [tenantId]);

    if (rows.length === 0) {
      return res.json([]);
    }

    const idsPessoas = rows.map(r => r.id_pessoa);

    // 2. Busca em lote os endereços, e-mails e contatos vinculados a esses clientes
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

    // 3. Agrega os dados no formato esperado pelo Frontend (ClienteAggregate)
    const resultadoFormatado = rows.map(pessoa => {
      const isPJ = pessoa.tipo_pessoa === 'PJ';
      
      const endsDoCliente = enderecos.filter(e => e.id_cliente === pessoa.id_pessoa);
      const emailsDoCliente = emails.filter(m => m.id_cliente === pessoa.id_pessoa);
      const contatosDoCliente = contatos.filter(t => t.id_cliente === pessoa.id_pessoa);

      const emailPrincipal = emailsDoCliente.find(m => m.principal) || emailsDoCliente[0];
      const contatoPrincipal = contatosDoCliente.find(t => t.principal) || contatosDoCliente[0];

      return {
        id_pessoa: pessoa.id_pessoa,
        tenant_id: pessoa.tenant_id,
        tipo_pessoa: pessoa.tipo_pessoa,
        status: pessoa.status,
        observacoes: pessoa.observacoes,
        
        nome_razao: isPJ ? pessoa.razao_social : pessoa.pf_nome,
        nome_fantasia: pessoa.nome_fantasia,
        documento: isPJ ? pessoa.cnpj : pessoa.cpf,
        inscricao_estadual: pessoa.inscricao_estadual,
        
        email: emailPrincipal ? emailPrincipal.email : '',
        telefone: contatoPrincipal ? contatoPrincipal.telefone : '',
        
        enderecos: endsDoCliente,
        emails: emailsDoCliente,
        telefones: contatosDoCliente
      };
    });

    return res.json(resultadoFormatado);
  } catch (error) {
    console.error('Erro ao buscar lista de clientes:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar lista de clientes.' });
  } finally {
    connection.release();
  }
};
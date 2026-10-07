import { Request, Response } from 'express';
import pool from '../../../infra/db';

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
          if (!end?.logradouro && !end?.cidade) continue;
          await connection.execute(
            `INSERT INTO pessoas_enderecos (id_cliente, tenant_id, tipo, principal, logradouro, numero, complemento, bairro, cidade, estado, cep, pais, created_at)
             VALUES (?, ?, 'PRINCIPAL', 1, ?, ?, ?, ?, ?, ?, ?, 'Brasil', NOW())`,
            [idPessoa, tenantId, end.logradouro || '', end.numero || '', end.complemento || null, end.bairro || '', end.cidade || '', end.estado || '', String(end.cep || '').replace(/\D/g, '')]
          );
        }
      }

      // E-mail informado no cadastro manual
      const email = String(dados.email || '').trim();
      if (email) {
        await connection.execute(
          `INSERT INTO pessoas_emails (id_cliente, tenant_id, email, principal, created_at) VALUES (?, ?, ?, 1, NOW())`,
          [idPessoa, tenantId, email.slice(0, 150)]
        );
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

// ---------------------------------------------------------------------------------------------
// Detalhe e edição (tela de fornecedores)
// ---------------------------------------------------------------------------------------------
const textoOuNulo = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null;
const dataIso = (v: any) => (v instanceof Date ? v.toISOString() : v ?? null);

// GET /api/parceiros/fornecedores/:id — cadastro, contato, endereço e o histórico real (notas, contas a pagar, produtos)
export const detalheFornecedor = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
  const id = Number(req.params.id);
  try {
    const [[f]]: any = await pool.execute(
      `SELECT c.id_pessoa, c.status, c.observacoes, c.created_at, pj.razao_social, pj.nome_fantasia, pj.cnpj, pj.inscricao_estadual, pj.inscricao_municipal
       FROM pessoas_core c INNER JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa
       WHERE c.id_pessoa = ? AND c.tenant_id = ? AND c.deleted_at IS NULL`,
      [id, tenantId]
    );
    if (!f) return res.status(404).json({ error: 'Fornecedor não encontrado.' });
    const cnpj = String(f.cnpj || '').replace(/\D/g, '');

    const [[email]]: any = await pool.execute(
      `SELECT email FROM pessoas_emails WHERE id_cliente = ? AND deleted_at IS NULL ORDER BY principal DESC, id_email LIMIT 1`, [id]
    );
    const [[contato]]: any = await pool.execute(
      `SELECT nome_contato, telefone, whatsapp FROM pessoas_contatos WHERE id_cliente = ? AND deleted_at IS NULL ORDER BY principal DESC, id_contato LIMIT 1`, [id]
    );
    const [[endereco]]: any = await pool.execute(
      `SELECT logradouro, numero, complemento, bairro, cidade, estado, cep FROM pessoas_enderecos
       WHERE id_cliente = ? AND deleted_at IS NULL ORDER BY principal DESC, id_endereco LIMIT 1`, [id]
    );
    const [notas]: any = await pool.execute(
      `SELECT id, numero_nf, serie, data_emissao, created_at, status, financeiro_situacao,
              COALESCE(NULLIF(valor_total_nf, 0), CAST(JSON_UNQUOTE(JSON_EXTRACT(dados_nota_fiscal, '$.totais.icmsTot.vNF')) AS DECIMAL(15,2)), 0) AS valor
       FROM importacoes_lotes
       WHERE tenant_id = ? AND REPLACE(REPLACE(REPLACE(cnpj_fornecedor, '.', ''), '/', ''), '-', '') = ?
       ORDER BY COALESCE(data_emissao, created_at) DESC LIMIT 100`,
      [tenantId, cnpj]
    );
    const [titulos]: any = await pool.execute(
      `SELECT t.id_titulo, t.numero_documento, t.parcela, t.total_parcelas, DATE_FORMAT(t.vencimento, '%Y-%m-%d') AS vencimento, t.valor, t.status,
              DATE_FORMAT(t.pago_em, '%Y-%m-%d') AS pago_em, t.vencimento < CURDATE() AS vencido, l.numero_nf
       FROM financeiro_contas_pagar t LEFT JOIN importacoes_lotes l ON l.id = t.id_lote
       WHERE t.tenant_id = ? AND t.id_fornecedor = ? AND t.status <> 'CANCELADO'
       ORDER BY t.status = 'PAGO', t.vencimento LIMIT 200`,
      [tenantId, id]
    );
    const [produtos]: any = await pool.execute(
      `SELECT fp.id_item, fp.codigo_produto_fornecedor, fp.unidade_compra, fp.fator_compra, fp.preco_ultima_compra, fp.criado_em,
              COALESCE(NULLIF(cpd.sku_customizado, ''), ic.sku) AS sku, COALESCE(NULLIF(cpd.nome_comercial, ''), ic.nome_item) AS nome
       FROM comercial_fornecedores_produtos fp
       INNER JOIN itens_core ic ON ic.id_item = fp.id_item
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       WHERE fp.tenant_id = ? AND fp.id_fornecedor = ?
       ORDER BY nome LIMIT 500`,
      [tenantId, id]
    );

    const importadas = notas.filter((n: any) => n.status === 'IMPORTADO');
    const abertos = titulos.filter((t: any) => t.status === 'ABERTO');
    return res.json({
      idPessoa: Number(f.id_pessoa), status: f.status, observacoes: f.observacoes, criadoEm: dataIso(f.created_at),
      razaoSocial: f.razao_social, nomeFantasia: f.nome_fantasia, cnpj, inscricaoEstadual: f.inscricao_estadual, inscricaoMunicipal: f.inscricao_municipal,
      email: email?.email || null, telefone: contato?.telefone || null, whatsapp: Boolean(Number(contato?.whatsapp)), nomeContato: contato?.nome_contato || null,
      endereco: endereco ? { ...endereco } : null,
      resumo: {
        qtdNotas: importadas.length,
        totalComprado: Number(importadas.reduce((a: number, n: any) => a + Number(n.valor), 0).toFixed(2)),
        ultimaCompra: dataIso(importadas[0]?.data_emissao || importadas[0]?.created_at || null),
        aPagar: Number(abertos.reduce((a: number, t: any) => a + Number(t.valor), 0).toFixed(2)),
        vencido: Number(abertos.filter((t: any) => Number(t.vencido)).reduce((a: number, t: any) => a + Number(t.valor), 0).toFixed(2)),
      },
      notas: notas.map((n: any) => ({
        idLote: Number(n.id), numero: n.numero_nf, serie: n.serie, emissao: dataIso(n.data_emissao || n.created_at), status: n.status,
        financeiro: n.financeiro_situacao, valor: Number(n.valor),
      })),
      titulos: titulos.map((t: any) => ({
        idTitulo: Number(t.id_titulo), documento: t.numero_documento, parcela: Number(t.parcela), totalParcelas: Number(t.total_parcelas),
        vencimento: t.vencimento, valor: Number(t.valor), status: t.status, pagoEm: t.pago_em, vencido: t.status === 'ABERTO' && Boolean(Number(t.vencido)),
        numeroNf: t.numero_nf,
      })),
      produtos: produtos.map((p: any) => ({
        idItem: Number(p.id_item), sku: p.sku, nome: p.nome, codigoFornecedor: p.codigo_produto_fornecedor, unidadeCompra: p.unidade_compra,
        fatorCompra: p.fator_compra === null ? null : Number(p.fator_compra), precoUltimaCompra: p.preco_ultima_compra === null ? null : Number(p.preco_ultima_compra),
        vinculadoEm: dataIso(p.criado_em),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao carregar fornecedor:', error);
    return res.status(500).json({ error: 'Erro ao carregar o fornecedor.', details: error.message });
  }
};

// PUT /api/parceiros/fornecedores/:id — razão/fantasia, inscrições, situação, observações e contato/endereço principais
export const atualizarFornecedor = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.body?.tenant_id || 1);
  const id = Number(req.params.id);
  const d = req.body || {};
  const razaoSocial = textoOuNulo(d.razaoSocial, 150);
  if (!razaoSocial) return res.status(400).json({ error: 'Informe a razão social.' });
  const status = String(d.status || 'ATIVO').toUpperCase();
  if (!['ATIVO', 'INATIVO'].includes(status)) return res.status(400).json({ error: 'Situação inválida.' });
  const email = textoOuNulo(d.email, 150);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[f]]: any = await connection.execute(
      `SELECT c.id_pessoa FROM pessoas_core c INNER JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa WHERE c.id_pessoa = ? AND c.tenant_id = ? FOR UPDATE`,
      [id, tenantId]
    );
    if (!f) { await connection.rollback(); return res.status(404).json({ error: 'Fornecedor não encontrado.' }); }

    await connection.execute(
      `UPDATE pessoas_pj SET razao_social = ?, nome_fantasia = ?, inscricao_estadual = ?, inscricao_municipal = ? WHERE id_cliente = ?`,
      [razaoSocial, textoOuNulo(d.nomeFantasia, 150), textoOuNulo(d.inscricaoEstadual, 30), textoOuNulo(d.inscricaoMunicipal, 30), id]
    );
    await connection.execute(`UPDATE pessoas_core SET status = ?, observacoes = ? WHERE id_pessoa = ?`, [status, textoOuNulo(d.observacoes, 1000), id]);

    // E-mail principal: atualiza, cria ou remove (vazio)
    const [[emailAtual]]: any = await connection.execute(
      `SELECT id_email FROM pessoas_emails WHERE id_cliente = ? AND deleted_at IS NULL ORDER BY principal DESC, id_email LIMIT 1`, [id]
    );
    if (emailAtual && email) await connection.execute(`UPDATE pessoas_emails SET email = ?, principal = 1 WHERE id_email = ?`, [email, emailAtual.id_email]);
    else if (emailAtual) await connection.execute(`UPDATE pessoas_emails SET deleted_at = NOW() WHERE id_email = ?`, [emailAtual.id_email]);
    else if (email) await connection.execute(`INSERT INTO pessoas_emails (id_cliente, tenant_id, email, principal, created_at) VALUES (?, ?, ?, 1, NOW())`, [id, tenantId, email]);

    // Telefone principal
    const telefone = textoOuNulo(d.telefone, 20);
    const whatsapp = d.whatsapp ? 1 : 0;
    const [[telAtual]]: any = await connection.execute(
      `SELECT id_contato FROM pessoas_contatos WHERE id_cliente = ? AND deleted_at IS NULL ORDER BY principal DESC, id_contato LIMIT 1`, [id]
    );
    if (telAtual && telefone) {
      await connection.execute(`UPDATE pessoas_contatos SET telefone = ?, whatsapp = ?, nome_contato = ?, principal = 1 WHERE id_contato = ?`,
        [telefone, whatsapp, textoOuNulo(d.nomeContato, 100) || '', telAtual.id_contato]);
    } else if (telAtual) {
      await connection.execute(`UPDATE pessoas_contatos SET deleted_at = NOW() WHERE id_contato = ?`, [telAtual.id_contato]);
    } else if (telefone) {
      await connection.execute(
        `INSERT INTO pessoas_contatos (id_cliente, tenant_id, nome_contato, tipo, telefone, principal, whatsapp, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, NOW())`,
        [id, tenantId, textoOuNulo(d.nomeContato, 100) || '', whatsapp ? 'CELULAR' : 'FIXO', telefone, whatsapp]
      );
    }

    // Endereço principal
    const e = d.endereco || {};
    const temEndereco = ['logradouro', 'cidade', 'cep'].some(k => String(e[k] || '').trim());
    const valoresEnd = [textoOuNulo(e.logradouro, 150) || '', textoOuNulo(e.numero, 20) || '', textoOuNulo(e.complemento, 100), textoOuNulo(e.bairro, 100) || '',
      textoOuNulo(e.cidade, 100) || '', (textoOuNulo(e.estado, 2) || '').toUpperCase(), String(e.cep || '').replace(/\D/g, '').slice(0, 8)];
    const [[endAtual]]: any = await connection.execute(
      `SELECT id_endereco FROM pessoas_enderecos WHERE id_cliente = ? AND deleted_at IS NULL ORDER BY principal DESC, id_endereco LIMIT 1`, [id]
    );
    if (endAtual && temEndereco) {
      await connection.execute(
        `UPDATE pessoas_enderecos SET logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, principal = 1 WHERE id_endereco = ?`,
        [...valoresEnd, endAtual.id_endereco]
      );
    } else if (!endAtual && temEndereco) {
      await connection.execute(
        `INSERT INTO pessoas_enderecos (id_cliente, tenant_id, tipo, principal, logradouro, numero, complemento, bairro, cidade, estado, cep, pais, created_at)
         VALUES (?, ?, 'PRINCIPAL', 1, ?, ?, ?, ?, ?, ?, ?, 'Brasil', NOW())`,
        [id, tenantId, ...valoresEnd]
      );
    }

    await connection.commit();
    return res.json({ success: true });
  } catch (error: any) {
    await connection.rollback().catch(() => undefined);
    console.error('Erro ao atualizar fornecedor:', error);
    return res.status(500).json({ error: 'Erro ao salvar o fornecedor.', details: error.message });
  } finally {
    connection.release();
  }
};

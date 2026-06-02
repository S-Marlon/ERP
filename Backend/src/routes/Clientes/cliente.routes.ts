// backend/src/routes/clientes.routes.ts

import { Router, Request, Response } from 'express';
import pool from '../Estoque/db.config';

const router = Router();

/*
|--------------------------------------------------------------------------
| GET ALL CLIENTES (Lista Simplificada)
|--------------------------------------------------------------------------
*/
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        c.id_cliente,
        c.tipo_pessoa,
        c.status,

        -- PF
        pf.nome,

        pf.cpf,

        -- PJ
        pj.razao_social,
        pj.nome_fantasia,
        pj.cnpj,

        -- Endereço principal
        e.cidade,
        e.estado,

        -- Email principal
        em.email,

        -- Contato principal
        ct.telefone

      FROM clientes_core c

      LEFT JOIN clientes_core_pf pf
        ON c.id_cliente = pf.id_cliente
        AND pf.deleted_at IS NULL

      LEFT JOIN clientes_core_pj pj
        ON c.id_cliente = pj.id_cliente
        AND pj.deleted_at IS NULL

      LEFT JOIN clientes_core_enderecos e
        ON c.id_cliente = e.id_cliente
        AND e.principal = 1
        AND e.deleted_at IS NULL

      LEFT JOIN clientes_core_emails em
        ON c.id_cliente = em.id_cliente
        AND em.principal = 1
        AND em.deleted_at IS NULL

      LEFT JOIN clientes_core_contatos ct
        ON c.id_cliente = ct.id_cliente
        AND ct.principal = 1
        AND ct.deleted_at IS NULL

      WHERE c.deleted_at IS NULL

      ORDER BY c.id_cliente DESC
    `);

    const listaFormatada = rows.map((cliente: any) => {
      const isPF = cliente.tipo_pessoa === 'PF';

      return {
        id_cliente: cliente.id_cliente,

        tipo_cliente: isPF
          ? 'PESSOA_FISICA'
          : 'PESSOA_JURIDICA',

        nome_razao: isPF
          ? cliente.nome
          : cliente.razao_social,

        nome_fantasia: isPF
          ? null
          : cliente.nome_fantasia,

        cpf_cnpj: isPF
          ? cliente.cpf
          : cliente.cnpj,

        status_cliente: cliente.status,

        cidade: cliente.cidade,
        estado: cliente.estado,

        email: cliente.email,
        telefone: cliente.telefone
      };
    });

    res.json(listaFormatada);

  } catch (error) {
    console.error('Erro ao buscar clientes:', error);

    res.status(500).json({
      error: 'Erro ao buscar clientes'
    });
  }
});

// /*
// |--------------------------------------------------------------------------
// | GET CLIENTE BY ID (Retorna o ClienteCompleto)
// |--------------------------------------------------------------------------
// */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // =========================
    // CLIENTE PRINCIPAL
    // =========================

    const [rows]: any = await pool.query(`
      SELECT 
        c.id_cliente,
        c.tipo_pessoa,
        c.status,
        c.observacoes,
        c.created_at,
        c.updated_at,

        -- PF
        pf.nome,
        pf.cpf,
        pf.rg,
        pf.data_nascimento,
        pf.genero,

        -- PJ
        pj.razao_social,
        pj.nome_fantasia,
        pj.cnpj,
        pj.inscricao_estadual,
        pj.inscricao_municipal,

        -- ENDEREÇO PRINCIPAL
        e.logradouro,
        e.numero,
        e.complemento,
        e.bairro,
        e.cidade,
        e.estado,
        e.cep,
        e.pais,
        e.referencia

      FROM clientes_core c

      LEFT JOIN clientes_core_pf pf
        ON c.id_cliente = pf.id_cliente
        AND pf.deleted_at IS NULL

      LEFT JOIN clientes_core_pj pj
        ON c.id_cliente = pj.id_cliente
        AND pj.deleted_at IS NULL

      LEFT JOIN clientes_core_enderecos e
        ON c.id_cliente = e.id_cliente
        AND e.principal = 1
        AND e.deleted_at IS NULL

      WHERE c.id_cliente = ?
        AND c.deleted_at IS NULL
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Cliente não encontrado'
      });
    }

    const cDb = rows[0];

    // =========================
    // CONTATOS
    // =========================

    const [contatosDb]: any = await pool.query(`
      SELECT 
        id_contato,
        id_cliente,
        nome_contato,
        cargo,
        tipo,
        telefone,
        setor,
        principal,
        whatsapp,
        nome_referencia,
        observacoes

      FROM clientes_core_contatos

      WHERE id_cliente = ?
        AND deleted_at IS NULL

      ORDER BY principal DESC
    `, [id]);

    // =========================
    // EMAILS
    // =========================

    const [emailsDb]: any = await pool.query(`
      SELECT 
        id_email,
        id_cliente,
        email,
        setor,
        tipo,
        principal,
        verificado,
        recebe_nfe,
        recebe_marketing,
        recebe_cobranca

      FROM clientes_core_emails

      WHERE id_cliente = ?
        AND deleted_at IS NULL

      ORDER BY principal DESC
    `, [id]);

    // =========================
    // TIPO CLIENTE
    // =========================

    const isPF = cDb.tipo_pessoa === 'PF';

    // =========================
    // OBJETO FINAL
    // =========================

    const clienteCompleto = {

      // =========================
      // PRINCIPAL
      // =========================

      id_cliente: cDb.id_cliente,

      tipo_cliente: isPF
        ? 'PESSOA_FISICA'
        : 'PESSOA_JURIDICA',

      nome_razao: isPF
        ? cDb.nome
        : cDb.razao_social,

      nome_fantasia: isPF
        ? null
        : cDb.nome_fantasia,

      cpf_cnpj: isPF
        ? cDb.cpf
        : cDb.cnpj,

      rg_ie: isPF
        ? cDb.rg
        : cDb.inscricao_estadual,

      status_cliente: cDb.status,

      observacoes: cDb.observacoes,

      created_at: cDb.created_at,
      updated_at: cDb.updated_at,

      // =========================
      // PF
      // =========================

      data_nascimento:
        cDb.data_nascimento,

      genero:
        cDb.genero,

      // =========================
      // ENDEREÇO
      // =========================

      endereco: {
        logradouro: cDb.logradouro,
        numero: cDb.numero,
        complemento: cDb.complemento,
        bairro: cDb.bairro,
        cidade: cDb.cidade,
        estado: cDb.estado,
        cep: cDb.cep,
        pais: cDb.pais,
        referencia: cDb.referencia,
      },

      // =========================
      // CONTATOS
      // =========================

      contatos: contatosDb.map(
        (cnt: any) => ({
          id: cnt.id_contato,

          id_cliente:
            cnt.id_cliente,

          nome:
            cnt.nome_contato ||
            cnt.nome_referencia ||
            'Sem Nome',

          telefone:
            cnt.telefone,

          cargo:
            cnt.cargo,

          tipo:
            cnt.tipo,

          setor:
            cnt.setor,

          principal:
            Boolean(cnt.principal),

          whatsapp:
            Boolean(cnt.whatsapp),

          observacoes:
            cnt.observacoes,
        })
      ),

      // =========================
      // EMAILS
      // =========================

      emails: emailsDb.map(
        (eml: any) => ({
          id: eml.id_email,

          id_cliente:
            eml.id_cliente,

          email:
            eml.email,

          setor:
            eml.setor,

          tipo:
            eml.tipo,

          principal:
            Boolean(eml.principal),

          verificado:
            Boolean(eml.verificado),

          recebe_nfe:
            Boolean(eml.recebe_nfe),

          recebe_marketing:
            Boolean(eml.recebe_marketing),

          recebe_cobranca:
            Boolean(eml.recebe_cobranca),
        })
      ),

      // =========================
      // PLACEHOLDERS
      // =========================

      financeiro: {
        saldo_devedor_atual: 0,
        total_aberto: 0,
        total_pago: 0,
        total_atrasado: 0,
        contas: [],
      },

      credito: null,

      crm: null,

      ClienteAtividade: [],
    };

    res.json(clienteCompleto);

  } catch (error) {

    console.error(
      'Erro ao recuperar cliente completo:',
      error
    );

    res.status(500).json({
      error: 'Erro ao buscar dados do cliente'
    });
  }
});
// /*
// |--------------------------------------------------------------------------
// | DELETE CLIENTE (Exclusão Lógica)
// |--------------------------------------------------------------------------
// */
// router.delete('/:id', async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     // Mudado de DELETE para UPDATE respeitando a coluna 'deleted_at' do banco
//     await pool.query(
//       'UPDATE clientes SET deleted_at = NOW() WHERE id_cliente = ?',
//       [id]
//     );

//     res.json({ success: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Erro ao remover cliente' });
//   }
// });

// /*
// |--------------------------------------------------------------------------
// | GET PREÇOS ESPECIAIS DO CLIENTE
// |--------------------------------------------------------------------------
// */
// router.get('/:id/precos-especiais', async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const [rows]: any = await pool.query(`
//       SELECT 
//         cpe.id,
//         cpe.id_produto,
//         p.descricao AS nome_produto,         
//         p.codigo_barras,                
//         cpe.tipo_desconto,              
//         cpe.valor,
//         cpe.preco_final,
//         cpe.percentual_desconto,
//         cpe.data_fim,
//         CASE 
//           WHEN cpe.ativo = 0 THEN 'INATIVO'
//           WHEN cpe.data_fim IS NULL OR cpe.data_fim >= CURDATE() THEN 'ATIVO'
//           ELSE 'EXPIRADO'
//         END AS status_preco
//       FROM cliente_precos_especiais cpe
//       INNER JOIN produtos p ON cpe.id_produto = p.id_produto
//       WHERE cpe.id_cliente = ?
//       ORDER BY status_preco ASC, cpe.data_fim ASC
//     `, [id]);

//     // Opcional: Converter valores para Number caso o driver do banco traga como string
//     const precosFormatados = rows.map((item: any) => ({
//       ...item,
//       valor: Number(item.valor),
//       preco_final: item.preco_final ? Number(item.preco_final) : null,
//       percentual_desconto: item.percentual_desconto ? Number(item.percentual_desconto) : null
//     }));

//     res.json(precosFormatados);
//   } catch (error) {
//     console.error('Erro ao buscar preços especiais:', error);
//     res.status(500).json({ error: 'Erro ao buscar preços especiais' });
//   }
// });

// /*
// |--------------------------------------------------------------------------
// | GET DADOS ABA GERAL (Isolado por ID)
// |--------------------------------------------------------------------------
// */
// router.get('/:id/geral', async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     // 1. Busca dados mestre do cliente + endereço principal + crédito vigente + dados crm
//     const [rows]: any = await pool.query(`
//       SELECT 
//         c.*,
//         e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.estado, e.cep, e.pais, e.referencia,
//         cr.limite_credito, cr.dia_vencimento, cr.status_credito, cr.score_credito,
//         crm.classificacao, crm.potencial, crm.score_comercial,
//         IFNULL(fr.saldo_devedor_atual, 0.00) as saldo_devedor_atual
//       FROM clientes c
//       LEFT JOIN cliente_enderecos e ON c.id_cliente = e.id_cliente AND e.principal = 1
//       LEFT JOIN cliente_credito cr ON c.id_cliente = cr.id_cliente AND cr.vigente = 1
//       LEFT JOIN cliente_crm crm ON c.id_cliente = crm.id_cliente
//       LEFT JOIN cliente_financeiro_resumo fr ON c.id_cliente = fr.id_cliente
//       WHERE c.id_cliente = ? AND c.deleted_at IS NULL
//     `, [id]);

//     if (rows.length === 0) {
//       return res.status(404).json({ error: 'Cliente não encontrado' });
//     }

//     const cDb = rows[0];

//     // 2. Busca vetores dependentes em paralelo
//     const [contatosDb]: any = await pool.query(
//       `SELECT 
//   id_contato AS id,
//   id_cliente,
//   nome,
//   cargo,
//   tipo,
//   numero AS telefone,
//   principal,
//   whatsapp
// FROM cliente_contatos
// WHERE id_cliente = ?
// AND deleted_at IS NULL`, 
//       [id]
//     );

//     const [emailsDb]: any = await pool.query(
//       `SELECT id_email AS id, id_cliente, email, principal, verificado, tipo 
//        FROM cliente_emails 
//        WHERE id_cliente = ? AND deleted_at IS NULL`, 
//       [id]
//     );

//     // 3. Montagem limpa do payload para o Frontend
//    const dadosGeral = {
//   id_cliente: Number(cDb.id_cliente),

//   nome_razao: cDb.nome_razao || '',
//   nome_fantasia: cDb.nome_fantasia || '',

//   cpf_cnpj: cDb.cpf_cnpj || '',

//   tipo_cliente:
//     cDb.tipo_cliente === 'PF'
//       ? 'PESSOA_FISICA'
//       : 'PESSOA_JURIDICA',

//   segmento: cDb.segmento || '',

//   status_cliente: cDb.status_cliente || 'ATIVO',

//   inscricao_estadual: cDb.rg_ie || '',

//   telefone_principal:
//     cDb.telefone_principal || '',

//   whatsapp:
//     cDb.whatsapp || '',

//   aceita_marketing:
//     Boolean(cDb.aceita_marketing),

//   endereco: {
//     logradouro: cDb.logradouro || '',
//     numero: cDb.numero || '',
//     complemento: cDb.complemento || '',
//     bairro: cDb.bairro || '',
//     cidade: cDb.cidade || '',
//     estado: cDb.estado || '',
//     cep: cDb.cep || '',
//     pais: cDb.pais || 'Brasil',
//     referencia: cDb.referencia || '',
//   },

//   limite_credito: Number(
//     cDb.limite_credito || 0
//   ),

//   dia_vencimento: Number(
//     cDb.dia_vencimento || 1
//   ),

//   status_credito:
//     cDb.status_credito || 'ANALISE',

//   saldo_devedor_atual: Number(
//     cDb.saldo_devedor_atual || 0
//   ),

//   classificacao:
//     cDb.classificacao || '',

//   potencial:
//     cDb.potencial || '',

//   contatos: contatosDb.map((cnt: any) => ({
//     id: Number(cnt.id),

//     id_cliente: Number(
//       cnt.id_cliente
//     ),

//     nome: cnt.nome || '',

//     telefone:
//       cnt.telefone || '',

//     cargo:
//       cnt.cargo || '',

//     tipo:
//       cnt.tipo || 'GERAL',

//     principal:
//       Boolean(cnt.principal),

//     whatsapp:
//       Boolean(cnt.whatsapp),
//   })),

//   emails: emailsDb.map((eml: any) => ({
//     id: Number(eml.id),

//     id_cliente: Number(
//       eml.id_cliente
//     ),

//     email: eml.email || '',

//     principal:
//       Boolean(eml.principal),

//     verificado:
//       Boolean(eml.verificado),

//     tipo:
//       eml.tipo || 'GERAL',
//   })),
// };

//     return res.json(dadosGeral);
//   } catch (error) {
//     console.error('Erro ao buscar aba geral:', error);
//     return res.status(500).json({ error: 'Erro ao buscar dados da aba geral' });
//   }
// });

// /*
// |--------------------------------------------------------------------------
// | PUT DADOS ABA GERAL (Gravação unificada com Transaction MySQL)
// |--------------------------------------------------------------------------
// */
// router.put('/:id/geral', async (req: Request, res: Response) => {
//   const connection = await pool.getConnection(); // Obtém conexão dedicada para a transação
//   try {
//     const { id } = req.params;
//     const { 
//       nome_razao, nome_fantasia, cpf_cnpj, tipo_cliente, segmento, status_cliente,
//       endereco, limite_credito, dia_vencimento, status_credito, classificacao, potencial,
//       contatos, emails 
//     } = req.body;

//     await connection.beginTransaction(); // Inicia transação SQL

//     // 1. Atualiza dados mestres na tabela 'clientes'
//     const dbTipo = tipo_cliente === 'PESSOA_FISICA' ? 'PF' : 'PJ';
//     await connection.query(`
//       UPDATE clientes SET 
//         nome_razao = ?, nome_fantasia = ?, cpf_cnpj = ?, 
//         tipo_cliente = ?, segmento = ?, status_cliente = ?, updated_at = NOW()
//       WHERE id_cliente = ?
//     `, [nome_razao, nome_fantasia, cpf_cnpj, dbTipo, segmento, status_cliente, id]);

//     // 2. Atualiza a tabela 'cliente_enderecos' (Apenas o endereço principal = 1)
//     if (endereco) {
//       await connection.query(`
//         UPDATE cliente_enderecos SET
//           logradouro = ?, numero = ?, complemento = ?, bairro = ?, 
//           cidade = ?, estado = ?, cep = ?, pais = ?, referencia = ?
//         WHERE id_cliente = ? AND principal = 1
//       `, [
//         endereco.logradouro, endereco.numero, endereco.complemento, endereco.bairro,
//         endereco.cidade, endereco.estado, endereco.cep, endereco.pais, endereco.referencia, id
//       ]);
//     }

//     // 3. Atualiza tabela 'cliente_credito' (vigente = 1)
//     await connection.query(`
//       UPDATE cliente_credito SET
//         limite_credito = ?, dia_vencimento = ?, status_credito = ?
//       WHERE id_cliente = ? AND vigente = 1
//     `, [limite_credito || 0, dia_vencimento || 1, status_credito || 'ANALISE', id]);

//     // 4. Atualiza tabela 'cliente_crm'
//     await connection.query(`
//       UPDATE cliente_crm SET
//         classificacao = ?, potencial = ?
//       WHERE id_cliente = ?
//     `, [classificacao || null, potencial || null, id]);

//     // 5. Sincroniza Contatos (Deleta lógicos/físicos anteriores e reinseri o vetor atual)
//     await connection.query('DELETE FROM cliente_contatos WHERE id_cliente = ?', [id]);
//     if (contatos && contatos.length > 0) {
//       for (const c of contatos) {
//         await connection.query(`
//           INSERT INTO cliente_contatos (id_cliente, nome, numero, cargo, tipo, principal)
//           VALUES (?, ?, ?, ?, ?, ?)
//         `, [id, c.nome, c.telefone, c.cargo, c.tipo, c.principal ? 1 : 0]);
//       }
//     }

//     // 6. Sincroniza E-mails (Deleta anteriores e reinseri o vetor atual)
//     await connection.query('DELETE FROM cliente_emails WHERE id_cliente = ?', [id]);
//     if (emails && emails.length > 0) {
//       for (const e of emails) {
//         await connection.query(`
//           INSERT INTO cliente_emails (id_cliente, email, tipo, principal, verificado)
//           VALUES (?, ?, ?, ?, ?)
//         `, [id, e.email, e.tipo, e.principal ? 1 : 0, e.verificado ? 1 : 0]);
//       }
//     }

//     await connection.commit(); // Tudo deu certo, grava de fato no banco!
//     return res.json({ success: true, message: 'Aba Geral sincronizada com sucesso!' });

//   } catch (error) {
//     await connection.rollback(); // Qualquer erro desfaz todas as alterações parciais
//     console.error('Erro na transação da aba geral:', error);
//     return res.status(500).json({ error: 'Erro ao salvar dados da aba geral no banco de dados.' });
//   } finally {
//     connection.release(); // Libera a conexão de volta para o pool do MySQL
//   }
// });

// /*
// |--------------------------------------------------------------------------
// | GET HISTÓRICO DE VENDAS DO CLIENTE (Conserta o Erro 404)
// |--------------------------------------------------------------------------
// */
// router.get('/:id/vendas', async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const [rows]: any = await pool.query(`
//       SELECT 
//         id,
//         tipo,
//         valor,
//         payload,
//         data_evento
//       FROM cliente_eventos
//       WHERE id_cliente = ?
//         AND tipo = 'VENDA_REALIZADA'
//       ORDER BY data_evento DESC
//     `, [id]);

//     const vendas = rows.map((row: any) => {
//       const payload = typeof row.payload === 'string'
//         ? JSON.parse(row.payload)
//         : row.payload;

//       return {
//         id_venda: row.id,
//         numero_pedido: payload?.pedido || null,
//         data_venda: row.data_evento,
//         valor_total: Number(row.valor || 0),
//         forma_pagamento: payload?.forma_pagamento || 'DESCONHECIDO',
//         status_venda: 'CONCLUIDA'
//       };
//     });

//     return res.json(vendas);

//   } catch (error) {
//     console.error('Erro ao buscar vendas:', error);
//     return res.status(500).json({ error: 'Erro ao buscar vendas' });
//   }
// });

// /*
// |--------------------------------------------------------------------------
// | GET HISTÓRICO UNIFICADO DO CLIENTE (TIMELINE CRM)
// |--------------------------------------------------------------------------
// */
// router.get('/:id/historico', async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     // 1. VENDAS (EVENTOS DE PEDIDO)
//     const [vendas]: any = await pool.query(`
//       SELECT 
//         id_venda,
//         data_venda,
//         valor_total,
//         forma_pagamento
//       FROM vendas
//       WHERE id_cliente = ?
//       ORDER BY data_venda DESC
//       LIMIT 50
//     `, [id]);

//     // 2. ATIVIDADES (CRM / INTERAÇÕES)
//     const [atividades]: any = await pool.query(`
//       SELECT 
//         id,
//         data_atividade,
//         titulo,
//         descricao,
//         tipo
//       FROM cliente_atividades
//       WHERE id_cliente = ?
//       ORDER BY data_atividade DESC
//       LIMIT 50
//     `, [id]);

//     // 3. TRANSFORMAR VENDAS EM EVENTOS
//     const eventosVendas = vendas.map((v: any) => ({
//       id: v.id_venda,
//       tipo: "EVENTO",
//       titulo: "Pedido Realizado",
//       data_evento: v.data_venda,
//       valor: Number(v.valor_total),
//       forma_pagamento: v.forma_pagamento
//     }));

//     // 4. TRANSFORMAR ATIVIDADES EM EVENTOS
//     const eventosAtividades = atividades.map((a: any) => ({
//       id: a.id,
//       tipo: "EVENTO",
//       titulo: a.titulo || "Atividade CRM",
//       data_evento: a.data_atividade,
//       valor: 0,
//       descricao: a.descricao
//     }));

//     // 5. UNIFICAR TIMELINE
//     const timeline = [
//       ...eventosVendas,
//       ...eventosAtividades
//     ].sort((a, b) =>
//       new Date(b.data_evento).getTime() -
//       new Date(a.data_evento).getTime()
//     );

//     return res.json({
//       dados: timeline
//     });

//   } catch (error) {
//     console.error('Erro ao buscar histórico:', error);
//     return res.status(500).json({
//       error: 'Erro ao buscar histórico do cliente'
//     });
//   }
// });

 export default router;
// backend/src/routes/pessoas.routes.ts

import { Router, Request, Response } from 'express';
import pool from '../Estoque/db.config';

const router = Router();

/*
|--------------------------------------------------------------------------
| GET ALL PESSOAS (Lista Simplificada)
|--------------------------------------------------------------------------
*/
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        c.id_pessoa,
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

      FROM pessoas_core c

      LEFT JOIN pessoas_pf pf
        ON c.id_pessoa = pf.id_cliente
        AND pf.deleted_at IS NULL

      LEFT JOIN pessoas_pj pj
        ON c.id_pessoa = pj.id_cliente
        AND pj.deleted_at IS NULL

      LEFT JOIN pessoas_enderecos e
        ON c.id_pessoa = e.id_cliente
        AND e.principal = 1
        AND e.deleted_at IS NULL

      LEFT JOIN pessoas_emails em
        ON c.id_pessoa = em.id_cliente
        AND em.principal = 1
        AND em.deleted_at IS NULL

      LEFT JOIN pessoas_contatos ct
        ON c.id_pessoa = ct.id_cliente
        AND ct.principal = 1
        AND ct.deleted_at IS NULL

      WHERE c.deleted_at IS NULL

      ORDER BY c.id_pessoa DESC
    `);

    const listaFormatada = rows.map((pessoa: any) => {
      const isPF = pessoa.tipo_pessoa === 'PF';

      return {
        id_pessoa: pessoa.id_pessoa,
        tipo_pessoa: isPF ? 'PESSOA_FISICA' : 'PESSOA_JURIDICA',
        nome_razao: isPF ? pessoa.nome : pessoa.razao_social,
        nome_fantasia: isPF ? null : pessoa.nome_fantasia,
        cpf_cnpj: isPF ? pessoa.cpf : pessoa.cnpj,
        status: pessoa.status,
        cidade: pessoa.cidade,
        estado: pessoa.estado,
        email: pessoa.email,
        telefone: pessoa.telefone
      };
    });

    res.json(listaFormatada);

  } catch (error) {
    console.error('Erro ao buscar pessoas:', error);
    res.status(500).json({
      error: 'Erro ao buscar pessoas'
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET PESSOA BY ID (Retorna a Pessoa Completa)
|--------------------------------------------------------------------------
*/
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // =========================
    // PESSOA PRINCIPAL
    // =========================
    const [rows]: any = await pool.query(`
      SELECT 
        c.id_pessoa,
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

      FROM pessoas_core c

      LEFT JOIN pessoas_pf pf
        ON c.id_pessoa = pf.id_cliente
        AND pf.deleted_at IS NULL

      LEFT JOIN pessoas_pj pj
        ON c.id_pessoa = pj.id_cliente
        AND pj.deleted_at IS NULL

      LEFT JOIN pessoas_enderecos e
        ON c.id_pessoa = e.id_cliente
        AND e.principal = 1
        AND e.deleted_at IS NULL

      WHERE c.id_pessoa = ?
        AND c.deleted_at IS NULL
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Pessoa não encontrada'
      });
    }

    const pDb = rows[0];

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
      FROM pessoas_contatos
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
      FROM pessoas_emails
      WHERE id_cliente = ?
        AND deleted_at IS NULL
      ORDER BY principal DESC
    `, [id]);

    // =========================
    // PAPÉIS / VÍNCULOS (Adicionado com base no seu banco)
    // =========================
    const [papeisDb]: any = await pool.query(`
      SELECT pd.nome, pd.codigo
      FROM pessoas_papeis_atribuido pa
      INNER JOIN pessoas_papeis_definicao pd ON pa.id_cliente_papel = pd.id_cliente_papel
      WHERE pa.id_cliente = ?
    `, [id]);

    const isPF = pDb.tipo_pessoa === 'PF';

    // =========================
    // OBJETO FINAL
    // =========================
    const pessoaCompleta = {
      id_pessoa: pDb.id_pessoa,
      tipo_pessoa: isPF ? 'PESSOA_FISICA' : 'PESSOA_JURIDICA',
      nome_razao: isPF ? pDb.nome : pDb.razao_social,
      nome_fantasia: isPF ? null : pDb.nome_fantasia,
      cpf_cnpj: isPF ? pDb.cpf : pDb.cnpj,
      rg_ie: isPF ? pDb.rg : pDb.inscricao_estadual,
      im: isPF ? null : pDb.inscricao_municipal,
      status: pDb.status,
      observacoes: pDb.observacoes,
      papeis: papeisDb.map((p: any) => p.codigo), // Retorna ex: ['CONSUMIDOR', 'FUNCIONARIO']
      created_at: pDb.created_at,
      updated_at: pDb.updated_at,

      // Dados específicos PF
      data_nascimento: isPF ? pDb.data_nascimento : null,
      genero: isPF ? pDb.genero : null,

      endereco: {
        logradouro: pDb.logradouro,
        numero: pDb.numero,
        complemento: pDb.complemento,
        bairro: pDb.bairro,
        cidade: pDb.cidade,
        estado: pDb.estado,
        cep: pDb.cep,
        pais: pDb.pais,
        referencia: pDb.referencia,
      },

      contatos: contatosDb.map((cnt: any) => ({
        id: cnt.id_contato,
        nome: cnt.nome_contato || cnt.nome_referencia || 'Sem Nome',
        telefone: cnt.telefone,
        cargo: cnt.cargo,
        tipo: cnt.tipo,
        setor: cnt.setor,
        principal: Boolean(cnt.principal),
        whatsapp: Boolean(cnt.whatsapp),
        observacoes: cnt.observacoes,
      })),

      emails: emailsDb.map((eml: any) => ({
        id: eml.id_email,
        email: eml.email,
        setor: eml.setor,
        tipo: eml.tipo,
        principal: Boolean(eml.principal),
        verificado: Boolean(eml.verificado),
        recebe_nfe: Boolean(eml.recebe_nfe),
        recebe_marketing: Boolean(eml.recebe_marketing),
        recebe_cobranca: Boolean(eml.recebe_cobranca),
      })),

      // Placeholders mantidos para compatibilidade com seu front-end
      financeiro: {
        saldo_devedor_atual: 0,
        total_aberto: 0,
        total_pago: 0,
        total_atrasado: 0,
        contas: [],
      },
      credito: null,
      crm: null,
      atividade: [],
    };

    res.json(pessoaCompleta);

  } catch (error) {
    console.error('Erro ao recuperar pessoa completa:', error);
    res.status(500).json({
      error: 'Erro ao buscar dados da pessoa'
    });
  }
});

export default router;
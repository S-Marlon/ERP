import { Request, Response } from 'express';
import pool from '../db.config'; // Ajuste os níveis se necessário

// 🔌 [READ] Buscar Grupos trazendo os Atributos via JOIN Relacional
export const getGrupos = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1; 
  const tenantId = Number(rawTenantId);

  try {
    // 1. Busca os dados mestre do grupo
    const [grupoRows] = await pool.execute(`
      SELECT 
        id_grupo as id, nome_grupo as nome, id_categoria as categoriaPai, 
        descricao, status, separador_sku as separadorSku, 
        unidade_medida_base as unidadeMedidaBase, template_nome as templateNome, 
        cor, imagem
      FROM itens_grupos
      WHERE tenant_id = ?
      ORDER BY nome_grupo ASC
    `, [tenantId]);

    const grupos = grupoRows as any[];

    // 2. Para cada grupo, busca seus atributos relacionados via INNER JOIN na tabela de config
    const formatados = await Promise.all(grupos.map(async (grupo) => {
      const [attrRows] = await pool.execute(`
        SELECT 
          a.id_atributo as id,
          a.nome_atributo as nome,
          a.tipo_dado as tipoDado,
          a.sufixo,
          a.separador_sufixo as separadorSufixo,
          a.exemplos,
          c.obrigatorio,
          c.gera_variacao as geraVariacao,
          c.compoe_sku as compoeSku,
          c.ordem_nome as ordemSku
        FROM itens_grupos_atributos_config c
        INNER JOIN itens_atributos a ON c.id_atributo = a.id_atributo AND c.tenant_id = a.tenant_id
        WHERE c.id_grupo = ? AND c.tenant_id = ?
        ORDER BY c.ordem_nome ASC
      `, [grupo.id, tenantId]);

      const atributosMapeados = (attrRows as any[]).map(attr => ({
        id: String(attr.id),
        nome: attr.nome,
        tipoDado: attr.tipoDado || 'texto',
        separadorSufixo: attr.separadorSufixo || 'nenhum',
        sufixo: attr.sufixo || '',
        obrigatorio: Boolean(attr.obrigatorio),
        geraVariacao: Boolean(attr.geraVariacao),
        compoeSku: Boolean(attr.compoeSku),
        ordemSku: Number(attr.ordemSku || 0),
        exemplos: attr.exemplos || ''
      }));

      return {
        id: String(grupo.id),
        nome: grupo.nome || 'Grupo Sem Nome',
        categoriaPai: grupo.categoriaPai ? String(grupo.categoriaPai) : '',
        descricao: grupo.descricao || '',
        status: String(grupo.status).toLowerCase() === 'ativo' ? 'ativo' : 'inativo',
        separadorSku: grupo.separadorSku || '-',
        unidadeMedidaBase: grupo.unidadeMedidaBase || 'PC',
        templateNome: grupo.templateNome || '{GRUPO}',
        cor: grupo.cor || '#0050b3',
        imagem: grupo.imagem || '',
        atributos: atributosMapeados
      };
    }));

    return res.json(formatados);
  } catch (error) {
    console.error('Erro ao buscar grupos relacionais:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao buscar grupos' });
  }
};

// 🟡 [UPDATE] Atualizar Grupo com Persistência Relacional em Cascata (Transaction)
export const updateGrupo = async (req: Request, res: Response) => {
  const { idGrupo } = req.params;
  const tenantId = Number(req.query.tenant_id || 1);
  const { 
    nome, categoriaPai, descricao, status, unidadeMedidaBase, 
    templateNome, separadorSku, cor, imagem, atributos 
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // PASSO 1: Atualizar dados mestres da tabela `itens_grupos`
    const queryGrupo = `
      UPDATE itens_grupos SET
        nome_grupo = COALESCE(?, nome_grupo),
        id_categoria = ?,
        descricao = COALESCE(?, descricao),
        status = COALESCE(?, status),
        unidade_medida_base = COALESCE(?, unidade_medida_base),
        template_nome = COALESCE(?, template_nome),
        separador_sku = COALESCE(?, separador_sku),
        cor = COALESCE(?, cor),
        imagem = COALESCE(?, imagem)
      WHERE id_grupo = ? AND tenant_id = ?
    `;

    await connection.execute(queryGrupo, [
      nome || null,
      categoriaPai ? Number(categoriaPai) : null,
      descricao || null,
      status ? String(status).toUpperCase() : null,
      unidadeMedidaBase || null,
      templateNome || null,
      separadorSku || null,
      cor || null,
      imagem || null,
      idGrupo,
      tenantId
    ]);

    // PASSO 2: Limpar os vínculos antigos na tabela pivot para reconstruir a árvore limpa
    await connection.execute(
      'DELETE FROM itens_grupos_atributos_config WHERE id_grupo = ? AND tenant_id = ?',
      [idGrupo, tenantId]
    );

    // PASSO 3: Iterar sobre os atributos enviados pelo Frontend
    if (Array.isArray(atributos) && atributos.length > 0) {
      for (const attr of atributos) {
        let idAtributoFinal: number;

        const isNovoAtributo = isNaN(Number(attr.id));

        if (isNovoAtributo) {
          const [insAttr] = await connection.execute(`
            INSERT INTO itens_atributos 
              (tenant_id, nome_atributo, tipo_dado, sufixo, separador_sufixo, exemplos)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            tenantId,
            attr.nome,
            attr.tipoDado || 'texto',
            attr.sufixo || '',
            attr.separadorSufixo || 'nenhum',
            attr.exemplos || ''
          ]);
          idAtributoFinal = (insAttr as any).insertId;
        } else {
          idAtributoFinal = Number(attr.id);
          await connection.execute(`
            UPDATE itens_atributos SET
              nome_atributo = ?, tipo_dado = ?, sufixo = ?, separador_sufixo = ?, exemplos = ?
            WHERE id_atributo = ? AND tenant_id = ?
          `, [
            attr.nome,
            attr.tipoDado || 'texto',
            attr.sufixo || '',
            attr.separadorSufixo || 'nenhum',
            attr.exemplos || '',
            idAtributoFinal,
            tenantId
          ]);
        }

        await connection.execute(`
          INSERT INTO itens_grupos_atributos_config
            (tenant_id, id_grupo, id_atributo, gera_variacao, compoe_sku, obrigatorio, ordem_nome, escopo)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'GLOBAL')
        `, [
          tenantId,
          Number(idGrupo),
          idAtributoFinal,
          attr.geraVariacao ? 1 : 0,
          attr.compoeSku ? 1 : 0,
          attr.obrigatorio ? 1 : 0,
          Number(attr.ordemSku || 0)
        ]);
      }
    }

    await connection.commit();
    return res.json({ success: true, message: 'Estrutura relacional do grupo salva com sucesso!' });

  } catch (error) {
    await connection.rollback();
    console.error('Erro na transação de salvamento do grupo:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar estrutura relacional do grupo.' });
  } finally {
    connection.release();
  }
};

// 🟢 [CREATE] Criar um Novo Grupo de Itens Vazio
export const createGrupo = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || 1);
  const { nome, categoriaPai, descricao, unidadeMedidaBase, templateNome, separadorSku, cor, imagem } = req.body;

  try {
    const query = `
      INSERT INTO itens_grupos 
        (tenant_id, nome_grupo, id_categoria, descricao, status, unidade_medida_base, template_nome, separador_sku, cor, imagem)
      VALUES (?, ?, ?, ?, 'ATIVO', ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      tenantId,
      nome || 'Novo Grupo de Produtos',
      categoriaPai ? Number(categoriaPai) : null,
      descricao || null,
      unidadeMedidaBase || 'PC',
      templateNome || '{GRUPO}',
      separadorSku || '-',
      cor || '#0050b3',
      imagem || ''
    ]);

    const insertId = (result as any).insertId;

    return res.status(201).json({
      success: true,
      message: 'Grupo criado com sucesso!',
      id_grupo: String(insertId)
    });
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    return res.status(500).json({ error: 'Erro interno ao processar a criação do grupo no servidor.' });
  }
};

// 🔴 [DELETE] Excluir um Grupo de Itens permanentemente
export const deleteGrupo = async (req: Request, res: Response) => {
  const { idGrupo } = req.params;
  const tenantId = Number(req.query.tenant_id || 1);

  try {
    // Como criamos restrições ON DELETE CASCADE no dump SQL, deletar da itens_grupos 
    // vai limpar automaticamente a itens_grupos_atributos_config!
    const query = 'DELETE FROM itens_grupos WHERE id_grupo = ? AND tenant_id = ?';
    const [result] = await pool.execute(query, [idGrupo, tenantId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Grupo não encontrado ou não pertence a este tenant.' });
    }

    return res.json({ success: true, message: 'Grupo e suas configurações removidos com sucesso!' });
  } catch (error) {
    console.error('Erro ao deletar grupo:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao tentar excluir o grupo.' });
  }
};
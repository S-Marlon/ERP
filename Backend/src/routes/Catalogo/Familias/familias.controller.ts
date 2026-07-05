import { Request, Response } from 'express';
import pool from '../../Estoque/db.config'; 

// 🔌 [READ] Buscar Famílias trazendo os Atributos via Pivot `atributos_core_entidades`
export const getFamilias = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);

  try {
    const queryFamilias = `
      SELECT 
        f.id AS id, 
        f.nome AS nome, 
        f.categoria_id AS categoriaPai, 
        c.nome AS categoriaPaiNome,
        f.descricao, 
        f.status, 
        f.separador_sku AS separadorSku, 
        f.unidade_base AS unidadeMedidaBase, 
        f.template_nome AS templateNome, 
        f.cor, 
        f.imagem
      FROM comercial_familias f
      LEFT JOIN comercial_categorias c 
        ON f.categoria_id = c.id AND f.tenant_id = c.tenant_id
      WHERE f.tenant_id = ?
      ORDER BY f.nome ASC
    `;

    const [familiasRows] = await pool.execute(queryFamilias, [tenantId]);
    const familias = familiasRows as any[];

    if (familias.length === 0) {
      return res.json([]);
    }

    const queryAtributos = `
      SELECT 
        core.id_entidade AS id_familia,
        a.id AS id,
        a.nome AS nome,
        core.escopo_comercial AS classificacao,
        a.tipo AS tipoDado,
        a.sufixo,
        core.obrigatorio,
        core.ordem
      FROM atributos_core_entidades core
      INNER JOIN atributos_comercial a 
        ON core.atributo_id = a.id AND core.tenant_id = a.tenant_id
      WHERE core.tenant_id = ? AND core.tipo_entidade = 'familia' AND core.ativo = 1
    `;

    const [atributosRows] = await pool.execute(queryAtributos, [tenantId]);
    const todosAtributos = atributosRows as any[];

    const resultadoFinal = familias.map(f => {
      const atributosDaFamilia = todosAtributos
        .filter(attr => String(attr.id_familia) === String(f.id))
        .map(attr => ({
          id: String(attr.id),
          nome: attr.nome,
          classificacao: attr.classificacao || 'ficha',
          tipoDado: attr.tipoDado === 'lista' ? 'opcoes' : (attr.tipoDado === 'decimal' || attr.tipoDado === 'numero' ? 'numero' : 'texto'),
          separadorSufixo: attr.sufixo ? 'espaco' : 'nenhum',
          sufixo: attr.sufixo || '',
          obrigatorio: attr.obrigatorio === 1 || attr.obrigatorio === true,
          geraVariacao: attr.classificacao === 'grade',
          compoeSku: attr.classificacao === 'grade' || attr.classificacao === 'dna',
          ordemSku: Number(attr.ordem || 0),
          exemplos: '',
          valorHerdadoDoGrupo: false,
          valorPadraoGrupo: ''
        }));

      return {
        ...f,
        id: String(f.id),
        categoriaPai: f.categoriaPai ? String(f.categoriaPai) : '',
        categoriaPaiNome: f.categoriaPaiNome || '',
        status: String(f.status).toLowerCase() === 'inativo' ? 'inativo' : 'ativo',
        atributos: atributosDaFamilia
      };
    });

    return res.json(resultadoFinal);
  } catch (error) {
    console.error('Erro ao buscar familias relacionais:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar grupos' });
  }
};

// 🟡 [UPDATE] Atualizar Família com Persistência na Pivot `atributos_core_entidades`
export const updateFamilia = async (req: Request, res: Response) => {
  const { idFamilia } = req.params;
  const tenantId = Number(req.query.tenant_id || 1);
  const {
    nome, categoriaPai, descricao, status, unidadeMedidaBase,
    templateNome, separadorSku, cor, imagem, atributos
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const categoriaIdFinal = (categoriaPai && String(categoriaPai).trim() !== '') ? Number(categoriaPai) : null;

    // PASSO 1: Atualizar dados mestres
    const queryFamilia = `
      UPDATE comercial_familias SET
        nome = COALESCE(?, nome),
        categoria_id = ?,
        descricao = COALESCE(?, descricao),
        status = COALESCE(?, status),
        unidade_base = COALESCE(?, unidade_base),
        template_nome = COALESCE(?, template_nome),
        separador_sku = COALESCE(?, separador_sku),
        cor = COALESCE(?, cor),
        imagem = COALESCE(?, imagem)
      WHERE id = ? AND tenant_id = ?
    `;

    await connection.execute(queryFamilia, [
      nome || null,
      categoriaIdFinal,
      descricao || null,
      status ? String(status).toUpperCase() : 'ATIVO',
      unidadeMedidaBase || null,
      templateNome || null,
      separadorSku || null,
      cor || null,
      imagem || null,
      idFamilia,
      tenantId
    ]);

    // PASSO 2: Limpar os vínculos antigos na pivot para evitar órfãos
    await connection.execute(
      `DELETE FROM atributos_core_entidades 
       WHERE tenant_id = ? AND tipo_entidade = 'familia' AND id_entidade = ?`,
      [tenantId, idFamilia]
    );

    // PASSO 3: Mapear e vincular os atributos
    if (Array.isArray(atributos) && atributos.length > 0) {
      // Busca um grupo genérico padrão do tenant para não quebrar a FK de grupo_id
      const [grupoRows] = await connection.execute(
        'SELECT id FROM atributos_comercial_grupos WHERE tenant_id = ? LIMIT 1',
        [tenantId]
      );
      const grupoIdPadrao = (grupoRows as any[])[0]?.id || 1; // Fallback seguro para 1 se não achar

      for (const attr of atributos) {
        let idAtributoFinal: number;
        const isNovoAtributo = isNaN(Number(attr.id));

        if (isNovoAtributo) {
          const tipoMapeado = attr.tipoDado === 'opcoes' ? 'lista' : (attr.tipoDado === 'numero' ? 'numero' : 'texto');
          
          // Tratamento para evitar quebra da Unique Key `uk_tenant_codigo` adicionando timestamp aleatório
          const codigoGerado = `${String(attr.nome).toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}`;

          const [insAttr] = await connection.execute(`
            INSERT INTO atributos_comercial 
              (tenant_id, grupo_id, nome, codigo, tipo, sufixo, ativo)
            VALUES (?, ?, ?, ?, ?, ?, 1)
          `, [
            tenantId,
            grupoIdPadrao, // Dinâmico por Tenant
            attr.nome,
            codigoGerado, // Seguro contra duplicidade interna
            tipoMapeado,
            attr.sufixo || null
          ]);
          idAtributoFinal = (insAttr as any).insertId;
        } else {
          idAtributoFinal = Number(attr.id);
        }

        const escopoMapeado = attr.classificacao === 'grade' ? 'grade' : (attr.classificacao === 'dna' ? 'dna' : 'ficha');

        await connection.execute(`
          INSERT INTO atributos_core_entidades
            (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, ordem, ativo)
          VALUES (?, 'familia', ?, ?, ?, ?, 1, ?, 1)
        `, [
          tenantId,
          Number(idFamilia),
          idAtributoFinal,
          escopoMapeado,
          attr.obrigatorio ? 1 : 0,
          Number(attr.ordemSku || 0)
        ]);
      }
    }

    await connection.commit();
    return res.json({ success: true, message: 'Estrutura relacional da família salva com sucesso!' });

  } catch (error) {
    await connection.rollback();
    console.error('Erro na transação de atualização da família:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar estrutura relacional da família.' });
  } finally {
    connection.release();
  }
};

// 🟢 [CREATE] Criar uma Nova Família Vazia
export const createFamilia = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || 1);
  const { 
    nome, categoriaPai, descricao, unidadeMedidaBase, templateNome, separadorSku, cor, imagem 
  } = req.body;

  try {
    const categoriaIdFinal = (categoriaPai && String(categoriaPai).trim() !== '') ? Number(categoriaPai) : null;

    const query = `
      INSERT INTO comercial_familias 
        (tenant_id, categoria_id, nome, descricao, status, separador_sku, unidade_base, template_nome, cor, imagem, ordem)
      VALUES (?, ?, ?, ?, 'ATIVO', ?, ?, ?, ?, ?, 0)
    `;

    const [result] = await pool.execute(query, [
      tenantId,
      categoriaIdFinal,
      nome || 'Nova Família de Produtos',
      descricao || null,
      separadorSku || '-',
      unidadeMedidaBase || 'PC',
      templateNome || '{GRUPO}',
      cor || '#0050b3',
      imagem || null
    ]);

    const insertId = (result as any).insertId;

    return res.status(201).json({
      success: true,
      message: 'Família criada com sucesso!',
      id: String(insertId) // Mudado de id_grupo para id para manter uniformidade com o rest do CRUD
    });
  } catch (error) {
    console.error('Erro ao criar família:', error);
    return res.status(500).json({ error: 'Erro interno ao processar a criação da família.' });
  }
};

// 🔴 [DELETE] Excluir uma Família limpando dependências na pivot
export const deleteFamilia = async (req: Request, res: Response) => {
  const { idFamilia } = req.params;
  const tenantId = Number(req.query.tenant_id || 1);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Remove os vínculos na pivot para evitar órfãos antes de matar o registro pai
    await connection.execute(
      `DELETE FROM atributos_core_entidades 
       WHERE tenant_id = ? AND tipo_entidade = 'familia' AND id_entidade = ?`,
      [tenantId, idFamilia]
    );

    const query = 'DELETE FROM comercial_familias WHERE id = ? AND tenant_id = ?';
    const [result] = await connection.execute(query, [idFamilia, tenantId]);

    if ((result as any).affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Família não encontrada ou não pertence a este tenant.' });
    }

    await connection.commit();
    return res.json({ success: true, message: 'Família e seus vínculos relacionais removidos com sucesso!' });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao deletar família:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao tentar excluir a família.' });
  } finally {
    connection.release();
  }
};
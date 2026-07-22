import { Request, Response } from 'express';
import pool from '../../Estoque/db.config'; 



// 🟡 [UPDATE] Atualizar Família com Persistência Completa de Todos os Campos na Pivot e Mestre
export const updateFamilia = async (req: Request, res: Response) => {
  const { idFamilia } = req.params;
  const tenantId = Number(req.query.tenant_id || 1);
  const {
    nome, categoriaPai, descricao, status, tipoItem, ncmPadrao, cestPadrao,
    unidadeMedidaBase, templateNomeComercial, separadorSku, siglaSku, templateSku,
    descricaoComercialPadrao, observacoesPadrao, cor, imagem, atributos
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const categoriaIdFinal = (categoriaPai && String(categoriaPai).trim() !== '') ? Number(categoriaPai) : null;

    // PASSO 1: Atualizar dados mestres completos
    const queryFamilia = `
      UPDATE comercial_familias SET
        nome = COALESCE(?, nome),
        categoria_id = ?,
        descricao = COALESCE(?, descricao),
        status = COALESCE(?, status),
        tipo_item = COALESCE(?, tipo_item),
        ncm_padrao = COALESCE(?, ncm_padrao),
        cest_padrao = COALESCE(?, cest_padrao),
        unidade_base = COALESCE(?, unidade_base),
        template_nome = COALESCE(?, template_nome),
        separador_sku = COALESCE(?, separador_sku),
        sigla_sku = COALESCE(?, sigla_sku),
        template_sku = COALESCE(?, template_sku),
        descricao_comercial_padrao = COALESCE(?, descricao_comercial_padrao),
        observacoes_padrao = COALESCE(?, observacoes_padrao),
        cor = COALESCE(?, cor),
        imagem = COALESCE(?, imagem)
      WHERE id = ? AND tenant_id = ?
    `;

    await connection.execute(queryFamilia, [
      nome || null,
      categoriaIdFinal,
      descricao || null,
      status ? String(status).toUpperCase() : 'ATIVO',
      tipoItem || 'PA',
      ncmPadrao || null,
      cestPadrao || null,
      unidadeMedidaBase || null,
      templateNomeComercial || null,
      separadorSku || null,
      siglaSku || null,
      templateSku || null,
      descricaoComercialPadrao || null,
      observacoesPadrao || null,
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

    // PASSO 3: Mapear e vincular os atributos com suas novas regras de SKU
    if (Array.isArray(atributos) && atributos.length > 0) {
      const [grupoRows] = await connection.execute(
        'SELECT id FROM atributos_comercial_grupos WHERE tenant_id = ? LIMIT 1',
        [tenantId]
      );
      const grupoIdPadrao = (grupoRows as any[])[0]?.id || 1;

      for (const attr of atributos) {
        let idAtributoFinal: number;
        const isNovoAtributo = isNaN(Number(attr.id));

        if (isNovoAtributo) {
          const tipoMapeado = attr.tipoDado === 'opcoes' ? 'lista' : (attr.tipoDado === 'numero' ? 'numero' : 'texto');
          const codigoGerado = `${String(attr.nome).toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}`;

          const [insAttr] = await connection.execute(`
            INSERT INTO atributos_comercial 
              (tenant_id, grupo_id, nome, codigo, tipo, sufixo, ativo)
            VALUES (?, ?, ?, ?, ?, ?, 1)
          `, [
            tenantId,
            grupoIdPadrao,
            attr.nome,
            codigoGerado,
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
            (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, ordem, exemplos, compoe_sku, gera_variacao, separador_sufixo, valor_padrao_grupo, herdar, ativo)
          VALUES (?, 'familia', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          tenantId,
          Number(idFamilia),
          idAtributoFinal,
          escopoMapeado,
          attr.obrigatorio ? 1 : 0,
          attr.pesquisavel !== undefined ? (attr.pesquisavel ? 1 : 0) : 1,
          Number(attr.ordemSku || 0),
          attr.exemplos || null,
          attr.compoeSku ? 1 : 0,
          attr.geraVariacao ? 1 : 0,
          attr.separadorSufixo || 'nenhum',
          attr.valorPadraoGrupo || null,
          attr.valorHerdadoDoGrupo ? 1 : 0
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

// 🟢 [CREATE] Criar uma Nova Família com os novos campos padrão
export const createFamilia = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || 1);
  const { 
    nome, categoriaPai, descricao, tipoItem, ncmPadrao, cestPadrao,
    unidadeMedidaBase, templateNomeComercial, separadorSku, siglaSku, templateSku,
    descricaoComercialPadrao, observacoesPadrao, cor, imagem 
  } = req.body;

  try {
    const categoriaIdFinal = (categoriaPai && String(categoriaPai).trim() !== '') ? Number(categoriaPai) : null;

    const query = `
      INSERT INTO comercial_familias 
        (tenant_id, categoria_id, nome, descricao, status, tipo_item, ncm_padrao, cest_padrao, separador_sku, sigla_sku, template_sku, unidade_base, template_nome, descricao_comercial_padrao, observacoes_padrao, cor, imagem, ordem)
      VALUES (?, ?, ?, ?, 'ATIVO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    const [result] = await pool.execute(query, [
      tenantId,
      categoriaIdFinal,
      nome || 'Nova Família de Produtos',
      descricao || null,
      tipoItem || 'PA',
      ncmPadrao || null,
      cestPadrao || null,
      separadorSku || '-',
      siglaSku || null,
      templateSku || '{SIGLA}{SEPARADOR}{VARIACAO}',
      unidadeMedidaBase || 'PC',
      templateNomeComercial || '{FAMILIA}',
      descricaoComercialPadrao || null,
      observacoesPadrao || null,
      cor || '#0050b3',
      imagem || null
    ]);

    const insertId = (result as any).insertId;

    return res.status(201).json({
      success: true,
      message: 'Família criada com sucesso!',
      id: String(insertId)
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


// 🔌 [READ] Buscar Famílias + Atributos Locais + Herdados da Categoria Pai + Opções
export const getFamilias = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);

  try {
    // 1. Buscar Famílias
    const queryFamilias = `
      SELECT 
        f.id AS id, 
        f.nome AS nome, 
        f.categoria_id AS categoriaPai, 
        c.nome AS categoriaPaiNome,
        f.descricao, 
        f.status, 
        f.tipo_item AS tipoItem,
        f.ncm_padrao AS ncmPadrao,
        f.cest_padrao AS cestPadrao,
        f.separador_sku AS separadorSku, 
        f.sigla_sku AS siglaSku,
        f.template_sku AS templateSku,
        f.unidade_base AS unidadeMedidaBase, 
        f.template_nome AS templateNomeComercial, 
        f.descricao_comercial_padrao AS descricaoComercialPadrao,
        f.observacoes_padrao AS observacoesPadrao,
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

    // 2. Buscar Atributos Locais (da Família) e Herdados (da Categoria) em uma única consulta
    const queryAtributos = `
      SELECT 
        core.id_entidade,
        core.tipo_entidade,
        a.id AS id,
        a.nome AS nome,
        a.codigo AS codigo,
        core.escopo_comercial AS classificacao,
        a.tipo AS tipoDado,
        a.sufixo,
        core.separador_sufixo AS separadorSufixo,
        core.obrigatorio,
        core.gera_variacao AS geraVariacao,
        core.compoe_sku AS compoeSku,
        core.pesquisavel,
        core.ordem AS ordemSku,
        core.exemplos,
        core.herdar AS valorHerdadoDoGrupo,
        core.valor_padrao_grupo AS valorPadraoGrupo,
        core.bloqueado,
        core.retransmitir
      FROM atributos_core_entidades core
      INNER JOIN atributos_comercial a 
        ON core.atributo_id = a.id AND core.tenant_id = a.tenant_id
      WHERE core.tenant_id = ? 
        AND core.ativo = 1
        AND (core.tipo_entidade = 'familia' OR core.tipo_entidade = 'categoria')
      ORDER BY core.ordem ASC, a.nome ASC
    `;

    const [atributosRows] = await pool.execute(queryAtributos, [tenantId]);
    const todosAtributos = atributosRows as any[];

    // 3. Buscar Opções para Atributos do tipo 'lista'
    const queryOpcoes = `
      SELECT id, atributo_id, valor, codigo, ordem 
      FROM atributos_comercial_opcoes 
      WHERE tenant_id = ? AND ativo = 1
      ORDER BY ordem ASC
    `;
    const [opcoesRows] = await pool.execute(queryOpcoes, [tenantId]);
    const todasOpcoes = opcoesRows as any[];

    // 4. Montar estrutura final combinando Herança e Opções
    const resultadoFinal = familias.map(f => {
      // Atributos diretos da família
      const locais = todosAtributos.filter(
        attr => attr.tipo_entidade === 'familia' && String(attr.id_entidade) === String(f.id)
      );

      // Atributos herdados da categoria pai
      const herdados = f.categoriaPai 
        ? todosAtributos.filter(
            attr => attr.tipo_entidade === 'categoria' && String(attr.id_entidade) === String(f.categoriaPai)
          )
        : [];

      // Unifica garantindo que se o atributo existir na família, ele se sobrepõe ao da categoria
      const mapaAtributos = new Map();

      [...herdados, ...locais].forEach(attr => {
        const opcoes = todasOpcoes
          .filter(o => String(o.atributo_id) === String(attr.id))
          .map(o => ({ id: String(o.id), valor: o.valor, codigo: o.codigo }));

        mapaAtributos.set(String(attr.id), {
          id: String(attr.id),
          nome: attr.nome,
          codigo: attr.codigo || '',
          classificacao: attr.classificacao || 'ficha',
          tipoDado: attr.tipoDado === 'lista' ? 'opcoes' : (attr.tipoDado === 'decimal' || attr.tipoDado === 'numero' ? 'numero' : 'texto'),
          separadorSufixo: attr.separadorSufixo || 'nenhum',
          sufixo: attr.sufixo || '',
          obrigatorio: attr.obrigatorio === 1 || attr.obrigatorio === true,
          geraVariacao: attr.geraVariacao === 1 || attr.geraVariacao === true,
          compoeSku: attr.compoeSku === 1 || attr.compoeSku === true,
          ordemSku: Number(attr.ordemSku || 0),
          exemplos: attr.exemplos || '',
          valorHerdadoDoGrupo: attr.valorHerdadoDoGrupo === 1 || attr.valorHerdadoDoGrupo === true,
          valorPadraoGrupo: attr.valorPadraoGrupo || '',
          pesquisavel: attr.pesquisavel === 1 || attr.pesquisavel === true,
          bloqueado: attr.bloqueado === 1 || attr.bloqueado === true,
          retransmitir: attr.retransmitir === 1 || attr.retransmitir === true,
          origem: attr.tipo_entidade === 'categoria' ? 'herdados' : 'locais',
          opcoes: opcoes
        });
      });

      return {
        ...f,
        id: String(f.id),
        categoriaPai: f.categoriaPai ? String(f.categoriaPai) : '',
        categoriaPaiNome: f.categoriaPaiNome || '',
        status: String(f.status).toLowerCase() === 'inativo' ? 'inativo' : 'ativo',
        tipoItem: f.tipoItem || 'PA',
        ncmPadrao: f.ncmPadrao || '',
        cestPadrao: f.cestPadrao || '',
        siglaSku: f.siglaSku || '',
        templateSku: f.templateSku || '{SIGLA}{SEPARADOR}{VARIACAO}',
        descricaoComercialPadrao: f.descricaoComercialPadrao || '',
        observacoesPadrao: f.observacoesPadrao || '',
        atributos: Array.from(mapaAtributos.values())
      };
    });

    return res.json(resultadoFinal);
  } catch (error) {
    console.error('Erro ao buscar familias relacionais:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar grupos' });
  }
};
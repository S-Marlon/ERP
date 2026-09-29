// familias.controller.ts

import { Request, Response } from 'express';
import pool from '../../Estoque/db.config'; 

type DbConnection = Awaited<ReturnType<typeof pool.getConnection>>;

const normalizarToken = (valor: unknown): string => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const extrairTokens = (template: string): string[] => Array.from(new Set(
  (template || '').match(/\{([^}]+)\}|\[([^\]]+)\]/g)?.map(token =>
    token.replace(/^[\[{]/, '').replace(/[\]}]$/, '').trim()
  ) || []
));

const resolverValor = (valores: Record<string, any>, aliases: unknown[]): any => {
  for (const alias of aliases) {
    const chave = String(alias ?? '').trim();
    if (!chave) continue;
    const direta = valores[chave];
    if (direta !== undefined && direta !== null && String(direta).trim() !== '') return direta;
    const chaveEncontrada = Object.keys(valores).find(item => normalizarToken(item) === normalizarToken(chave));
    if (chaveEncontrada && valores[chaveEncontrada] !== undefined && valores[chaveEncontrada] !== null) {
      return valores[chaveEncontrada];
    }
  }
  return undefined;
};

const obterValorAtributo = (valor: any): any => {
  if (!valor) return undefined;
  if (valor.valor_texto !== null && valor.valor_texto !== undefined) return valor.valor_texto;
  if (valor.valor_numero !== null && valor.valor_numero !== undefined) return valor.valor_numero;
  if (valor.valor_decimal !== null && valor.valor_decimal !== undefined) return valor.valor_decimal;
  if (valor.valor_data !== null && valor.valor_data !== undefined) return valor.valor_data;
  if (valor.valor_boolean !== null && valor.valor_boolean !== undefined) return valor.valor_boolean;
  return valor.valor_opcao ?? valor.codigo_opcao;
};

const estaVazio = (valor: any): boolean => valor === undefined || valor === null || String(valor).trim() === '';

const montarTextoTemplate = (
  template: string,
  familia: any,
  atributos: any[],
  valores: Record<string, any>,
  variacao = ''
): string => (template || '').replace(/\{([^}]+)\}|\[([^\]]+)\]/g, (_token, chaveBrace, chaveColchete) => {
  const token = String(chaveBrace || chaveColchete || '').trim();
  const tokenNormalizado = normalizarToken(token);
  const reservados: Record<string, any> = {
    familia: familia.nome,
    grupo: familia.nome,
    sigla: familia.siglaSku,
    s: familia.separadorSku,
    separador: familia.separadorSku,
    variacao,
    marca: familia.nomeMarca || ''
  };
  if (Object.prototype.hasOwnProperty.call(reservados, tokenNormalizado)) {
    return String(reservados[tokenNormalizado] ?? '');
  }

  const atributo = atributos.find(attr => [attr.id, attr.nome, attr.codigo]
    .some(alias => normalizarToken(alias) === tokenNormalizado));
  if (!atributo) return `[${token}]`;
  const valor = resolverValor(valores, [atributo.id, atributo.nome, atributo.codigo, token]);
  return estaVazio(valor) ? `[${token}]` : String(valor);
});

const carregarContextoFormalizacao = async (connection: DbConnection, familiaId: string, tenantId: number) => {
  const [familiaRows] = await connection.execute(`
    SELECT f.id, f.nome, f.categoria_id AS categoriaId, f.sigla_sku AS siglaSku,
           f.separador_sku AS separadorSku, f.template_sku AS templateSku,
           f.template_nome AS templateNomeComercial,
           f.id_marca AS idMarca, f.comportamento_marca AS comportamentoMarca
    FROM comercial_familias f
    WHERE f.id = ? AND f.tenant_id = ?
    LIMIT 1
  `, [familiaId, tenantId]);
  const familia = (familiaRows as any[])[0];
  if (!familia) return null;

  const [atributoRows] = await connection.execute(`
    SELECT core.id_entidade, core.tipo_entidade, a.id, a.nome, a.codigo,
           core.escopo_comercial AS classificacao, a.tipo AS tipoDado,
           core.obrigatorio, core.compoe_sku AS compoeSku,
           core.gera_variacao AS geraVariacao, core.valor_padrao_grupo AS valorPadraoGrupo,
           core.ordem AS ordemSku
    FROM atributos_core_entidades core
    INNER JOIN atributos_comercial a
      ON a.id = core.atributo_id AND a.tenant_id = core.tenant_id
    WHERE core.tenant_id = ? AND core.ativo = 1
      AND ((core.tipo_entidade = 'familia' AND core.id_entidade = ?)
       OR (core.tipo_entidade = 'categoria' AND core.id_entidade = ?))
    ORDER BY core.ordem ASC, a.nome ASC
  `, [tenantId, familia.id, familia.categoriaId]);

  const atributosPorId = new Map<string, any>();
  for (const atributo of atributoRows as any[]) {
    const chave = String(atributo.id);
    const anterior = atributosPorId.get(chave);
    if (!anterior || atributo.tipo_entidade === 'familia') {
      atributosPorId.set(chave, {
        id: String(atributo.id),
        nome: atributo.nome,
        codigo: atributo.codigo || '',
        classificacao: atributo.classificacao || 'ficha',
        tipoDado: atributo.tipoDado,
        obrigatorio: Boolean(atributo.obrigatorio),
        compoeSku: Boolean(atributo.compoeSku),
        geraVariacao: Boolean(atributo.geraVariacao),
        valorPadraoGrupo: atributo.valorPadraoGrupo || '',
        ordemSku: Number(atributo.ordemSku || 0),
        origem: atributo.tipo_entidade === 'categoria' ? 'herdados' : 'locais'
      });
    }
  }

  return { familia, atributos: Array.from(atributosPorId.values()) };
};

const carregarItensComValores = async (connection: DbConnection, familiaId: string, tenantId: number) => {
  const [rows] = await connection.execute(`
    SELECT p.id_item AS idItem, p.sku_customizado AS skuCustomizado,
           p.nome_comercial AS nomeComercial, p.descricao_comercial AS descricaoComercial,
           p.custo_gerencial AS custoGerencial, p.preco_venda AS precoVenda,
           p.margem_lucro AS margemLucro, p.exibir_no_pdv AS exibirNoPdv,
           p.pode_vender_sem_estoque AS podeVenderSemEstoque,
           i.sku AS skuGlobal, i.nome_item AS nomeItemGlobal,
           i.tipo_recurso AS tipoRecurso, i.status AS statusItem,
           i.descricao_variacao AS variacao, av.atributo_id,
           av.valor_texto, av.valor_numero, av.valor_decimal, av.valor_data,
           av.valor_boolean, av.opcao_id, ao.valor AS valor_opcao,
           ao.codigo AS codigo_opcao
    FROM comercial_produtos_dados p
    INNER JOIN itens_core i ON i.id_item = p.id_item AND i.tenant_id = p.tenant_id
    LEFT JOIN atributos_comercial_valores av
      ON av.id_entidade = p.id_item AND av.tipo_entidade = 'produto' AND av.tenant_id = p.tenant_id
    LEFT JOIN atributos_comercial_opcoes ao ON ao.id = av.opcao_id
    WHERE p.tenant_id = ? AND p.familia_id = ?
    ORDER BY i.nome_item ASC
  `, [tenantId, familiaId]);

  const itens = new Map<string, any>();
  for (const row of rows as any[]) {
    const id = String(row.idItem);
    if (!itens.has(id)) {
      itens.set(id, {
        id,
        idItem: id,
        sku: row.skuCustomizado || row.skuGlobal || '',
        skuGlobal: row.skuGlobal || '',
        nome: row.nomeComercial || row.nomeItemGlobal || 'Produto sem nome',
        nomeItem: row.nomeComercial || row.nomeItemGlobal || 'Produto sem nome',
        nomeComercial: row.nomeComercial || '',
        descricaoComercial: row.descricaoComercial || '',
        tipoRecurso: row.tipoRecurso || 'PRODUTO',
        status: row.statusItem || 'ATIVO',
        valoresAtributos: {},
        variacao: row.variacao || 'Principal'
      });
    }
    if (row.atributo_id !== null && row.atributo_id !== undefined) {
      itens.get(id).valoresAtributos[String(row.atributo_id)] = obterValorAtributo(row);
    }
  }
  return Array.from(itens.values());
};

// 🟡 [UPDATE] Atualizar Família com Persistência Completa
export const updateFamilia = async (req: Request, res: Response) => {
  const { idFamilia } = req.params;
  const tenantId = Number(req.query.tenant_id || 1);
  const {
    nome, categoriaPai, descricao, status, tipoItem, ncmPadrao, cestPadrao,
    unidadeMedidaBase, templateNomeComercial, separadorSku, siglaSku, templateSku,
    descricaoComercialPadrao, observacoesPadrao, cor, imagem, atributos,
    idMarca, comportamentoMarca
  } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const cleanVal = (val: any) => (val !== undefined && val !== null && String(val).trim() !== '') ? val : null;

    const categoriaIdFinal = cleanVal(categoriaPai) ? Number(categoriaPai) : null;
    const idMarcaFinal = cleanVal(idMarca) ? Number(idMarca) : null;

    const queryFamilia = `
      UPDATE comercial_familias SET
        nome = COALESCE(?, nome),
        categoria_id = COALESCE(?, categoria_id),
        id_marca = COALESCE(?, id_marca),
        comportamento_marca = COALESCE(?, comportamento_marca),
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
      cleanVal(nome),
      categoriaIdFinal,
      idMarcaFinal,
      cleanVal(comportamentoMarca),
      cleanVal(descricao),
      status ? String(status).toUpperCase() : null,
      cleanVal(tipoItem),
      cleanVal(ncmPadrao),
      cleanVal(cestPadrao),
      cleanVal(unidadeMedidaBase),
      cleanVal(templateNomeComercial),
      cleanVal(separadorSku),
      cleanVal(siglaSku),
      cleanVal(templateSku),
      cleanVal(descricaoComercialPadrao),
      cleanVal(observacoesPadrao),
      cleanVal(cor),
      cleanVal(imagem),
      idFamilia,
      tenantId
    ]);

    await connection.execute(
      `DELETE FROM atributos_core_entidades 
       WHERE tenant_id = ? AND tipo_entidade = 'familia' AND id_entidade = ?`,
      [tenantId, idFamilia]
    );

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
            (tenant_id, grupo_id, nome, codigo, tipo, ativo)
            VALUES (?, ?, ?, ?, ?, 1)
          `, [
            tenantId,
            grupoIdPadrao,
            attr.nome,
            codigoGerado,
            tipoMapeado
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
          cleanVal(attr.exemplos),
          attr.compoeSku ? 1 : 0,
          attr.geraVariacao ? 1 : 0,
          attr.separadorSufixo || 'nenhum',
          cleanVal(attr.valorPadraoGrupo),
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

// 🟢 [CREATE] Criar Família
export const createFamilia = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || 1);
  const { 
    nome, categoriaPai, descricao, tipoItem, ncmPadrao, cestPadrao,
    unidadeMedidaBase, templateNomeComercial, separadorSku, siglaSku, templateSku,
    descricaoComercialPadrao, observacoesPadrao, cor, imagem,
    idMarca, comportamentoMarca 
  } = req.body;

  try {
    const categoriaIdFinal = (categoriaPai && String(categoriaPai).trim() !== '') ? Number(categoriaPai) : null;
    const marcaIdFinal = (idMarca && !isNaN(Number(idMarca))) ? Number(idMarca) : 1;
    const comportamentoFinal = comportamentoMarca || 'ficha';

    const query = `
      INSERT INTO comercial_familias 
      (tenant_id, categoria_id, id_marca, comportamento_marca, nome, descricao, status, tipo_item, ncm_padrao, cest_padrao, separador_sku, sigla_sku, template_sku, unidade_base, template_nome, descricao_comercial_padrao, observacoes_padrao, cor, imagem, ordem)
      VALUES (?, ?, ?, ?, ?, ?, 'ATIVO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    const [result] = await pool.execute(query, [
      tenantId,
      categoriaIdFinal,
      marcaIdFinal,
      comportamentoFinal,
      nome || 'Nova Família de Produtos',
      descricao || null,
      tipoItem || 'PA',
      ncmPadrao || null,
      cestPadrao || null,
      separadorSku || '-',
      siglaSku || null,
      templateSku || '{SIGLA}{S}{VARIACAO}',
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

// 🔴 [DELETE] Excluir Família
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

// 🔌 [READ] Buscar Famílias
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
        f.imagem,
        f.comportamento_marca AS comportamentoMarca
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
        core.id_entidade,
        core.tipo_entidade,
        a.id AS id,
        a.nome AS nome,
        a.codigo AS codigo,
        core.escopo_comercial AS classificacao,
        a.tipo AS tipoDado,
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

    const queryOpcoes = `
      SELECT id, atributo_id, valor, codigo, ordem 
      FROM atributos_comercial_opcoes 
      WHERE tenant_id = ? AND ativo = 1
      ORDER BY ordem ASC
    `;
    const [opcoesRows] = await pool.execute(queryOpcoes, [tenantId]);
    const todasOpcoes = opcoesRows as any[];

    const resultadoFinal = familias.map(f => {
      const locais = todosAtributos.filter(
        attr => attr.tipo_entidade === 'familia' && String(attr.id_entidade) === String(f.id)
      );

      const herdados = f.categoriaPai 
        ? todosAtributos.filter(
            attr => attr.tipo_entidade === 'categoria' && String(attr.id_entidade) === String(f.categoriaPai)
          )
        : [];

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
          sufixo: '',
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
        templateSku: f.templateSku || '{SIGLA}{S}{VARIACAO}',
        descricaoComercialPadrao: f.descricaoComercialPadrao || '',
        observacoesPadrao: f.observacoesPadrao || '',
        comportamentoMarca: f.comportamentoMarca || 'ficha',
        atributos: Array.from(mapaAtributos.values())
      };
    });

    return res.json(resultadoFinal);
  } catch (error) {
    console.error('Erro ao buscar familias relacionais:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar grupos' });
  }
};

// 🔎 Diagnóstico
export const getDiagnosticoFormalizacao = async (req: Request, res: Response) => {
  const { idFamilia } = req.params;
  const tenantId = Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
  const connection = await pool.getConnection();

  try {
    const contexto = await carregarContextoFormalizacao(connection, idFamilia, tenantId);
    if (!contexto) return res.status(404).json({ error: 'Família não encontrada.' });

    const itens = await carregarItensComValores(connection, idFamilia, tenantId);
    const tokens = [
      ...extrairTokens(contexto.familia.templateSku),
      ...extrairTokens(contexto.familia.templateNomeComercial)
    ];
    const atributos = contexto.atributos.map(attr => {
      const usadoNoSku = extrairTokens(contexto.familia.templateSku)
        .some(token => [attr.id, attr.nome, attr.codigo].some(alias => normalizarToken(alias) === normalizarToken(token)));
      const usadoNoNome = extrairTokens(contexto.familia.templateNomeComercial)
        .some(token => [attr.id, attr.nome, attr.codigo].some(alias => normalizarToken(alias) === normalizarToken(token)));
      return { ...attr, usadoNoSku, usadoNoNome, usadoNoTemplate: usadoNoSku || usadoNoNome };
    });

    const itensDiagnostico = itens.map(item => {
      const valores = { ...item.valoresAtributos };
      for (const attr of atributos) {
        if (estaVazio(valores[attr.id]) && !estaVazio(attr.valorPadraoGrupo)) {
          valores[attr.id] = attr.valorPadraoGrupo;
        }
      }
      const atributosPendentes = atributos
        .filter(attr => attr.usadoNoTemplate && estaVazio(resolverValor(valores, [attr.id, attr.nome, attr.codigo])))
        .map(attr => ({
          atributoId: attr.id,
          nome: attr.nome,
          codigo: attr.codigo,
          motivo: 'Atributo usado no template sem valor para este item'
        }));
      const skuCalculado = atributosPendentes.length === 0
        ? montarTextoTemplate(contexto.familia.templateSku, contexto.familia, atributos, valores, item.variacao)
        : null;
      const nomeCalculado = atributosPendentes.length === 0
        ? montarTextoTemplate(contexto.familia.templateNomeComercial, contexto.familia, atributos, valores, item.variacao)
        : null;

      return {
        ...item,
        valoresAtributos: valores,
        atributosPendentes,
        statusFormalizacao: atributosPendentes.length > 0 ? 'PENDENTE' : 'PRONTO',
        skuCalculado,
        nomeCalculado,
        podeFormalizar: atributosPendentes.length === 0
      };
    });

    return res.json({
      familia: {
        id: String(contexto.familia.id),
        nome: contexto.familia.nome,
        templateSku: contexto.familia.templateSku || '',
        templateNomeComercial: contexto.familia.templateNomeComercial || '',
        siglaSku: contexto.familia.siglaSku || '',
        separadorSku: contexto.familia.separadorSku || '-'
      },
      atributosFamilia: atributos,
      tokensTemplate: tokens,
      itens: itensDiagnostico,
      resumo: {
        totalItens: itensDiagnostico.length,
        itensProntos: itensDiagnostico.filter(item => item.podeFormalizar).length,
        itensPendentes: itensDiagnostico.filter(item => !item.podeFormalizar).length
      }
    });
  } catch (error) {
    console.error('Erro ao diagnosticar formalização:', error);
    return res.status(500).json({ error: 'Erro interno ao diagnosticar os itens da família.' });
  } finally {
    connection.release();
  }
};

// ✅ Formalização transacional
export const formalizarItensFamilia = async (req: Request, res: Response) => {
  const { idFamilia } = req.params;
  const tenantId = Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
  const itensRecebidos = Array.isArray(req.body?.itens) ? req.body.itens : [];
  const connection = await pool.getConnection();

  try {
    if (itensRecebidos.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um item para formalização.' });
    }

    const contexto = await carregarContextoFormalizacao(connection, idFamilia, tenantId);
    if (!contexto) return res.status(404).json({ error: 'Família não encontrada.' });

    await connection.beginTransaction();
    const resultados: any[] = [];

    for (const entrada of itensRecebidos) {
      const idItem = String(entrada?.idItem ?? entrada?.id ?? '');
      if (!idItem) throw new Error('Cada item precisa informar idItem.');

      const [itemRows] = await connection.execute(`
        SELECT i.id_item AS idItem, i.descricao_variacao AS variacao
        FROM itens_core i
        INNER JOIN comercial_produtos_dados p
          ON p.id_item = i.id_item AND p.tenant_id = i.tenant_id
        WHERE i.id_item = ? AND i.tenant_id = ? AND p.familia_id = ?
        LIMIT 1
      `, [idItem, tenantId, idFamilia]);
      if ((itemRows as any[]).length === 0) {
        throw new Error(`O item ${idItem} não pertence à família informada.`);
      }

      const [valorRows] = await connection.execute(`
        SELECT av.atributo_id, av.valor_texto, av.valor_numero, av.valor_decimal, av.valor_data,
               av.valor_boolean, av.opcao_id, ao.valor AS valor_opcao, ao.codigo AS codigo_opcao
        FROM atributos_comercial_valores av
        LEFT JOIN atributos_comercial_opcoes ao ON ao.id = av.opcao_id
        WHERE av.tenant_id = ? AND av.tipo_entidade = 'produto' AND av.id_entidade = ?
      `, [tenantId, idItem]);
      const valores: Record<string, any> = {};
      for (const row of valorRows as any[]) valores[String(row.atributo_id)] = obterValorAtributo(row);

      const valoresEntrada = entrada.atributos && typeof entrada.atributos === 'object' ? entrada.atributos : {};
      for (const attr of contexto.atributos) {
        const valorRecebido = resolverValor(valoresEntrada, [attr.id, attr.nome, attr.codigo]);
        if (!estaVazio(valorRecebido)) valores[attr.id] = valorRecebido;
      }

      const atributosUsados = contexto.atributos.filter(attr =>
        [...extrairTokens(contexto.familia.templateSku), ...extrairTokens(contexto.familia.templateNomeComercial)]
          .some(token => [attr.id, attr.nome, attr.codigo].some(alias => normalizarToken(alias) === normalizarToken(token)))
      );
      const pendentes = atributosUsados.filter(attr => estaVazio(resolverValor(valores, [attr.id, attr.nome, attr.codigo])));
      if (pendentes.length > 0) {
        throw new Error(`O item ${idItem} possui atributos pendentes: ${pendentes.map(attr => attr.nome).join(', ')}.`);
      }

      for (const attr of contexto.atributos) {
        const valor = resolverValor(valores, [attr.id, attr.nome, attr.codigo]);
        if (estaVazio(valor)) continue;

        const [existente] = await connection.execute(
          `SELECT id FROM atributos_comercial_valores
           WHERE tenant_id = ? AND tipo_entidade = 'produto' AND id_entidade = ? AND atributo_id = ? LIMIT 1`,
          [tenantId, idItem, attr.id]
        );

        if ((existente as any[]).length > 0) {
          await connection.execute(
            `UPDATE atributos_comercial_valores SET valor_texto = ?, valor_numero = NULL,
             valor_decimal = NULL, valor_data = NULL, valor_boolean = NULL, opcao_id = NULL
             WHERE id = ?`, [String(valor), (existente as any[])[0].id]
          );
        } else {
          await connection.execute(
            `INSERT INTO atributos_comercial_valores
             (tenant_id, atributo_id, tipo_entidade, id_entidade, valor_texto)
             VALUES (?, ?, 'produto', ?, ?)`, [tenantId, attr.id, idItem, String(valor)]
          );
        }
      }

      const variacao = (itemRows as any[])[0].variacao || 'Principal';
      const novoSku = montarTextoTemplate(contexto.familia.templateSku, contexto.familia, contexto.atributos, valores, variacao);
      const novoNome = montarTextoTemplate(contexto.familia.templateNomeComercial, contexto.familia, contexto.atributos, valores, variacao);
      if (novoSku.includes('[') || novoNome.includes('[')) throw new Error(`Não foi possível resolver o template do item ${idItem}.`);

      const [skuRows] = await connection.execute(
        `SELECT id_item FROM itens_core WHERE tenant_id = ? AND sku = ? AND id_item <> ? LIMIT 1`,
        [tenantId, novoSku, idItem]
      );
      if ((skuRows as any[]).length > 0) throw new Error(`O SKU ${novoSku} já está sendo usado por outro item.`);

      await connection.execute(`UPDATE itens_core SET sku = ?, nome_item = ? WHERE id_item = ? AND tenant_id = ?`,
        [novoSku, novoNome, idItem, tenantId]);
      await connection.execute(`UPDATE comercial_produtos_dados SET sku_customizado = ?, nome_comercial = ?
        WHERE id_item = ? AND tenant_id = ?`, [novoSku, novoNome, idItem, tenantId]);
      resultados.push({ idItem, sku: novoSku, nome: novoNome, status: 'FORMALIZADO' });
    }

    await connection.commit();
    return res.json({ success: true, itens: resultados, message: 'Itens formalizados com sucesso.' });
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : 'Erro interno ao formalizar os itens.';
    console.error('Erro ao formalizar itens da família:', error);
    return res.status(message.startsWith('O item') || message.startsWith('O SKU') ? 400 : 500).json({ error: message });
  } finally {
    connection.release();
  }
};

// 🔌 [READ] Buscar Produtos da Família
export const getProdutosPorFamilia = async (req: Request, res: Response) => {
  const { idFamilia } = req.params;
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);

  if (!idFamilia) {
    return res.status(400).json({ error: 'O ID da família é obrigatório nos parâmetros.' });
  }

  try {
    const queryProdutos = `
      SELECT 
        p.id_item AS idItem,
        p.sku_customizado AS skuCustomizado,
        p.categoria_id AS categoriaId,
        p.familia_id AS familiaId,
        p.custo_gerencial AS custoGerencial,
        p.id_marca AS idMarca,
        p.preco_venda AS precoVenda,
        p.margem_lucro AS margemLucro,
        p.exibir_no_pdv AS exibirNoPdv,
        p.pode_vender_sem_estoque AS podeVenderSemEstoque,
        p.nome_comercial AS nomeComercial,
        p.descricao_comercial AS descricaoComercial,
        i.sku AS skuGlobal,
        i.nome_item AS nomeItemGlobal,
        i.tipo_recurso AS tipoRecurso,
        i.status AS statusItem,
        i.descricao_variacao AS variacao
      FROM comercial_produtos_dados p
      INNER JOIN itens_core i 
        ON p.id_item = i.id_item AND p.tenant_id = i.tenant_id
      WHERE p.tenant_id = ? AND p.familia_id = ?
      ORDER BY i.nome_item ASC
    `;

    const [produtosRows] = await pool.execute(queryProdutos, [tenantId, idFamilia]);
    const produtos = produtosRows as any[];

    if (produtos.length === 0) {
      return res.json([]);
    }

    const resultadoFinal = produtos.map(prod => ({
      ...prod,
      idItem: String(prod.idItem),
      categoriaId: prod.categoriaId ? String(prod.categoriaId) : null,
      familiaId: prod.familiaId ? String(prod.familiaId) : null,
      idMarca: prod.idMarca ? String(prod.idMarca) : null,
      custoGerencial: prod.custoGerencial !== null ? Number(prod.custoGerencial) : 0,
      precoVenda: prod.precoVenda !== null ? Number(prod.precoVenda) : 0,
      margemLucro: prod.margemLucro !== null ? Number(prod.margemLucro) : 0,
      exibirNoPdv: prod.exibirNoPdv === 1 || prod.exibirNoPdv === true,
      podeVenderSemEstoque: prod.podeVenderSemEstoque === 1 || prod.podeVenderSemEstoque === true,
      nome_item: prod.nomeComercial || prod.nomeItemGlobal,
      variacao: prod.variacao || 'Principal'
    }));

    return res.json(resultadoFinal);
  } catch (error) {
    console.error('Erro ao buscar produtos por família:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar produtos da família.' });
  }
};
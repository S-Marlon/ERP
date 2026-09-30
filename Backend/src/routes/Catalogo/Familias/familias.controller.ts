// familias.controller.ts

import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { carregarOpcoes, converterValorAtributo, gravarValorAtributo, OpcaoAtributo } from '../Atributos/valoresAtributo';
import { AtributoEfetivo, avaliarSaudeFamilia, mesclarAtributos, statusAposSaude } from './saudeFamilia';
import { CHAVE_MARCA, marcaEfetiva, marcaReal, MarcaCadastro, papelMarca, pendenciaMarca, resolverMarcaInformada } from './marcaFamilia';
import { atributosEfetivosDaCategoria, carregarArvore, carregarAtributosDaCategoria, carregarVinculosCategorias } from '../Categorias/herancaCategorias';

// Atributos efetivos da família (categoria + próprios) para avaliar a saúde
const carregarAtributosEfetivos = async (connection: DbConnection, tenantId: number, familiaId: number | string, categoriaId: number | null) => {
  const [rows] = await connection.execute(`
    SELECT core.tipo_entidade, a.id, a.nome, a.codigo, core.escopo_comercial AS classificacao,
           core.obrigatorio, core.compoe_sku AS compoeSku, core.valor_padrao_grupo AS valorPadraoGrupo
    FROM atributos_core_entidades core
    INNER JOIN atributos_comercial a ON a.id = core.atributo_id AND a.tenant_id = core.tenant_id
    WHERE core.tenant_id = ? AND core.ativo = 1 AND core.tipo_entidade = 'familia' AND core.id_entidade = ?
  `, [tenantId, familiaId]);
  const herdados = await carregarAtributosDaCategoria(connection as any, tenantId, categoriaId);
  const paraAttr = (r: any): AtributoEfetivo => ({
    id: String(r.id), nome: r.nome, codigo: r.codigo, classificacao: r.classificacao || 'ficha',
    obrigatorio: Boolean(Number(r.obrigatorio)), compoeSku: Boolean(Number(r.compoeSku)), valorPadraoGrupo: r.valorPadraoGrupo,
  });
  return mesclarAtributos(herdados.map(paraAttr), (rows as any[]).map(paraAttr));
};

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
    marca: valores[CHAVE_MARCA] ?? ''
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
           f.id_marca AS idMarca, f.comportamento_marca AS comportamentoMarca, mar.nome AS nomeMarca
    FROM comercial_familias f
    LEFT JOIN comercial_marcas mar ON mar.id = f.id_marca AND mar.tenant_id = f.tenant_id
    WHERE f.id = ? AND f.tenant_id = ?
    LIMIT 1
  `, [familiaId, tenantId]);
  const familia = (familiaRows as any[])[0];
  if (!familia) return null;

  const [atributoRows] = await connection.execute(`
    SELECT core.id_entidade, core.tipo_entidade, a.id, a.nome, a.codigo,
           core.escopo_comercial AS classificacao, a.tipo AS tipoDado, a.tipo AS tipoBanco,
           core.obrigatorio, core.compoe_sku AS compoeSku,
           core.gera_variacao AS geraVariacao, core.valor_padrao_grupo AS valorPadraoGrupo,
           core.ordem AS ordemSku
    FROM atributos_core_entidades core
    INNER JOIN atributos_comercial a
      ON a.id = core.atributo_id AND a.tenant_id = core.tenant_id
    WHERE core.tenant_id = ? AND core.ativo = 1
      AND core.tipo_entidade = 'familia' AND core.id_entidade = ?
    ORDER BY core.ordem ASC, a.nome ASC
  `, [tenantId, familia.id]);
  const herdadosCategoria = await carregarAtributosDaCategoria(connection as any, tenantId, familia.categoriaId);

  const atributosPorId = new Map<string, any>();
  for (const atributo of [...herdadosCategoria, ...(atributoRows as any[])]) {
    const chave = String(atributo.id);
    const anterior = atributosPorId.get(chave);
    if (!anterior || atributo.tipo_entidade === 'familia') {
      atributosPorId.set(chave, {
        id: String(atributo.id),
        nome: atributo.nome,
        codigo: atributo.codigo || '',
        classificacao: atributo.classificacao || 'ficha',
        tipoDado: atributo.tipoDado,
        tipoBanco: String(atributo.tipoBanco || 'texto'),
        obrigatorio: Boolean(atributo.obrigatorio),
        compoeSku: Boolean(atributo.compoeSku),
        geraVariacao: Boolean(atributo.geraVariacao),
        valorPadraoGrupo: atributo.valorPadraoGrupo || '',
        ordemSku: Number(atributo.ordemSku || 0),
        origem: atributo.tipo_entidade === 'categoria' ? 'herdados' : 'locais'
      });
    }
  }

  const atributos = Array.from(atributosPorId.values());
  const opcoes = await carregarOpcoes(connection as any, tenantId, atributos.map(a => a.id));
  const [marcaRows] = await connection.execute(`SELECT id, nome FROM comercial_marcas WHERE tenant_id = ?`, [tenantId]);
  const marcas: MarcaCadastro[] = (marcaRows as any[]).map(m => ({ id: Number(m.id), nome: String(m.nome) }));
  familia.papelMarca = papelMarca(familia.comportamentoMarca);
  return { familia, atributos, opcoes, marcas };
};

// Atributos que o item precisa ter preenchidos: os usados nos templates e os obrigatórios
const pendenciasDoItem = (
  atributos: any[],
  valores: Record<string, any>,
  tokensTemplate: string[],
  opcoes: Map<string, OpcaoAtributo[]>
) => {
  const pendentes: Array<{ atributoId: string; nome: string; codigo: string; motivo: string }> = [];
  for (const attr of atributos) {
    const usadoNoTemplate = tokensTemplate.some(token =>
      [attr.id, attr.nome, attr.codigo].some(alias => normalizarToken(alias) === normalizarToken(token)));
    const valor = resolverValor(valores, [attr.id, attr.nome, attr.codigo]);
    if (estaVazio(valor)) {
      if (usadoNoTemplate) pendentes.push({ atributoId: attr.id, nome: attr.nome, codigo: attr.codigo, motivo: 'Usado no código/nome e sem valor' });
      else if (attr.obrigatorio) pendentes.push({ atributoId: attr.id, nome: attr.nome, codigo: attr.codigo, motivo: 'Atributo obrigatório sem valor' });
      continue;
    }
    const conversao = converterValorAtributo(attr.tipoBanco, valor, opcoes.get(String(attr.id)) || []);
    if (!conversao.ok) pendentes.push({ atributoId: attr.id, nome: attr.nome, codigo: attr.codigo, motivo: `Valor inválido: ${conversao.erro}` });
  }
  return pendentes;
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
           i.descricao_variacao AS variacao, p.id_marca AS idMarca, mi.nome AS nomeMarca, av.atributo_id,
           av.valor_texto, av.valor_numero, av.valor_decimal, av.valor_data,
           av.valor_boolean, av.opcao_id, ao.valor AS valor_opcao,
           ao.codigo AS codigo_opcao
    FROM comercial_produtos_dados p
    INNER JOIN itens_core i ON i.id_item = p.id_item AND i.tenant_id = p.tenant_id
    LEFT JOIN comercial_marcas mi ON mi.id = p.id_marca AND mi.tenant_id = p.tenant_id
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
        // Marca própria do item (a tela edita como o "atributo" Marca)
        valoresAtributos: marcaReal(row.nomeMarca) ? { [CHAVE_MARCA]: row.nomeMarca } : {},
        idMarca: row.idMarca ? String(row.idMarca) : null,
        marca: marcaReal(row.nomeMarca) ? row.nomeMarca : '',
        variacao: row.variacao || 'Principal'
      });
    }
    if (row.atributo_id !== null && row.atributo_id !== undefined) {
      itens.get(id).valoresAtributos[String(row.atributo_id)] = obterValorAtributo(row);
    }
  }
  return Array.from(itens.values());
};

// Campos editáveis da família: chave do payload -> coluna
const CAMPOS_FAMILIA: Record<string, string> = {
  nome: 'nome', categoriaPai: 'categoria_id', idMarca: 'id_marca', comportamentoMarca: 'comportamento_marca',
  descricao: 'descricao', status: 'status', tipoItem: 'tipo_item', ncmPadrao: 'ncm_padrao', cestPadrao: 'cest_padrao',
  unidadeMedidaBase: 'unidade_base', templateNomeComercial: 'template_nome', separadorSku: 'separador_sku',
  siglaSku: 'sigla_sku', templateSku: 'template_sku', descricaoComercialPadrao: 'descricao_comercial_padrao',
  observacoesPadrao: 'observacoes_padrao', cor: 'cor', imagem: 'imagem', margemMinima: 'margem_minima',
  margemMaxima: 'margem_maxima', markupPadrao: 'markup_padrao', estoqueMinimo: 'estoque_minimo', loteMinimo: 'lote_minimo',
  curvaAbc: 'curva_abc', prioridadeExposicao: 'prioridade_exposicao',
};
const CAMPOS_NUMERICOS_FAMILIA = new Set(['categoriaPai', 'idMarca', 'margemMinima', 'margemMaxima', 'markupPadrao', 'estoqueMinimo', 'loteMinimo']);
// Colunas NOT NULL: valor vazio é ignorado (mantém o atual) em vez de limpar
const CAMPOS_NAO_NULOS_FAMILIA = new Set(['nome', 'status', 'comportamentoMarca']);
export const STATUS_FAMILIA = ['ATIVO', 'INATIVO', 'RASCUNHO', 'BLOQUEADO_INCONSISTENCIA'];
const PAPEIS_MARCA = ['ficha', 'dna', 'grade'];

const TIPO_BANCO_ATRIBUTO: Record<string, string> = {
  opcoes: 'lista', lista: 'lista', numero: 'numero', decimal: 'decimal', boolean: 'boolean', data: 'data'
};

const primeiroDefinido = (...valores: unknown[]) => valores.find(v => v !== undefined);

// 🟡 [UPDATE] Atualizar Família (parcial: campo ausente mantém; vazio limpa)
export const updateFamilia = async (req: Request, res: Response) => {
  const { idFamilia } = req.params;
  const tenantId = Number(req.query.tenant_id || 1);
  const body = req.body || {};

  if (body.status !== undefined && body.status !== null && body.status !== '' && !STATUS_FAMILIA.includes(String(body.status).toUpperCase())) {
    return res.status(400).json({ error: `Status inválido. Use: ${STATUS_FAMILIA.join(', ')}.` });
  }
  if (body.comportamentoMarca && !PAPEIS_MARCA.includes(String(body.comportamentoMarca))) {
    return res.status(400).json({ error: 'Papel da marca inválido (ficha, dna ou grade).' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existe] = await connection.execute(
      'SELECT id FROM comercial_familias WHERE id = ? AND tenant_id = ? FOR UPDATE', [idFamilia, tenantId]
    );
    if ((existe as any[]).length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Família não encontrada.' });
    }

    // 1. Campos da família: só os presentes no payload
    const sets: string[] = [];
    const valores: any[] = [];
    for (const [chave, coluna] of Object.entries(CAMPOS_FAMILIA)) {
      if (!Object.prototype.hasOwnProperty.call(body, chave)) continue;
      const bruto = body[chave];
      const vazio = bruto === null || bruto === undefined || String(bruto).trim() === '';
      if (vazio && CAMPOS_NAO_NULOS_FAMILIA.has(chave)) continue;
      let valor: any = vazio ? null : bruto;
      if (!vazio && CAMPOS_NUMERICOS_FAMILIA.has(chave)) {
        valor = Number(String(bruto).replace(',', '.'));
        if (!Number.isFinite(valor)) valor = null;
      } else if (!vazio && chave === 'status') {
        valor = String(bruto).toUpperCase();
      } else if (!vazio && typeof valor === 'string') {
        valor = valor.trim();
      }
      sets.push(`${coluna} = ?`);
      valores.push(valor);
    }
    if (sets.length > 0) {
      await connection.execute(
        `UPDATE comercial_familias SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
        [...valores, idFamilia, tenantId]
      );
    }

    // 2. Atributos PRÓPRIOS da família (os herdados da categoria não são copiados)
    if (Array.isArray(body.atributos)) {
      const locais = body.atributos.filter((attr: any) =>
        (attr.origem ?? 'locais') === 'locais' && !attr.isMarcaSistema && String(attr.id) !== 'atributo-marca-virtual');

      const [grupoRows] = await connection.execute(
        'SELECT id FROM atributos_comercial_grupos WHERE tenant_id = ? LIMIT 1', [tenantId]
      );
      const grupoIdPadrao = (grupoRows as any[])[0]?.id || 1;

      const [vinculosRows] = await connection.execute(
        `SELECT atributo_id FROM atributos_core_entidades WHERE tenant_id = ? AND tipo_entidade = 'familia' AND id_entidade = ?`,
        [tenantId, idFamilia]
      );
      const vinculosAtuais = new Set((vinculosRows as any[]).map(v => String(v.atributo_id)));
      const mantidos = new Set<string>();

      for (const attr of locais) {
        let idAtributo = Number(attr.id);
        if (!Number.isFinite(idAtributo) || idAtributo <= 0) {
          const tipoBanco = TIPO_BANCO_ATRIBUTO[String(attr.tipoDado)] || 'texto';
          const codigoGerado = `${String(attr.nome).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-4)}`;
          const [insAttr] = await connection.execute(
            `INSERT INTO atributos_comercial (tenant_id, grupo_id, nome, codigo, tipo, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
            [tenantId, grupoIdPadrao, String(attr.nome).trim(), codigoGerado, tipoBanco]
          );
          idAtributo = (insAttr as any).insertId;
        }
        mantidos.add(String(idAtributo));

        const escopo = attr.classificacao === 'grade' ? 'grade' : (attr.classificacao === 'dna' ? 'dna' : 'ficha');
        const valorPadrao = primeiroDefinido(attr.valorPadraoGrupo, attr.valorPadraoFamilia);
        const campos: Record<string, any> = {
          escopo_comercial: escopo,
          obrigatorio: attr.obrigatorio ? 1 : 0,
          pesquisavel: attr.pesquisavel === false ? 0 : 1,
          ordem: Number(attr.ordemSku || 0),
          exemplos: attr.exemplos ? String(attr.exemplos) : '',
          compoe_sku: attr.compoeSku ? 1 : 0,
          // Papel define o comportamento: grade gera variação; DNA é herdado (valor fixo da família)
          gera_variacao: escopo === 'grade' ? 1 : 0,
          herdar: escopo === 'dna' ? 1 : 0,
          separador_sufixo: attr.separadorSufixo || 'nenhum',
        };
        // Campos que só são alterados quando enviados (preserva o que a tela não conhece)
        if (valorPadrao !== undefined) campos.valor_padrao_grupo = String(valorPadrao ?? '').trim() || null;
        if (attr.bloqueado !== undefined) campos.bloqueado = attr.bloqueado ? 1 : 0;
        if (attr.retransmitir !== undefined) campos.retransmitir = attr.retransmitir ? 1 : 0;

        if (vinculosAtuais.has(String(idAtributo))) {
          await connection.execute(
            `UPDATE atributos_core_entidades SET ${Object.keys(campos).map(c => `${c} = ?`).join(', ')}, ativo = 1
             WHERE tenant_id = ? AND tipo_entidade = 'familia' AND id_entidade = ? AND atributo_id = ?`,
            [...Object.values(campos), tenantId, Number(idFamilia), idAtributo]
          );
        } else {
          await connection.execute(
            `INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, ${Object.keys(campos).join(', ')}, ativo)
             VALUES (?, 'familia', ?, ?, ${Object.keys(campos).map(() => '?').join(', ')}, 1)`,
            [tenantId, Number(idFamilia), idAtributo, ...Object.values(campos)]
          );
        }
      }

      // Removidos da família: só o vínculo sai. Os valores já preenchidos nos itens são preservados.
      const removidos = [...vinculosAtuais].filter(id => !mantidos.has(id));
      if (removidos.length > 0) {
        await connection.execute(
          `DELETE FROM atributos_core_entidades
           WHERE tenant_id = ? AND tipo_entidade = 'familia' AND id_entidade = ? AND atributo_id IN (${removidos.map(() => '?').join(',')})`,
          [tenantId, Number(idFamilia), ...removidos]
        );
      }
    }

    // 3. Saúde da família: ATIVA só se atender às regras mínimas; senão fica BLOQUEADA com os motivos
    const [[familiaAtual]] = await connection.execute(
      `SELECT f.status, f.categoria_id, f.template_sku AS templateSku, f.template_nome AS templateNomeComercial,
              f.sigla_sku AS siglaSku, f.comportamento_marca AS comportamentoMarca, mar.nome AS nomeMarca
       FROM comercial_familias f
       LEFT JOIN comercial_marcas mar ON mar.id = f.id_marca AND mar.tenant_id = f.tenant_id
       WHERE f.id = ? AND f.tenant_id = ?`,
      [idFamilia, tenantId]
    ) as any;
    const efetivos = await carregarAtributosEfetivos(connection, tenantId, idFamilia, familiaAtual.categoria_id);
    const saude = avaliarSaudeFamilia(familiaAtual, efetivos);
    const statusFinal = statusAposSaude(familiaAtual.status, saude);
    if (statusFinal !== familiaAtual.status) {
      await connection.execute(`UPDATE comercial_familias SET status = ? WHERE id = ? AND tenant_id = ?`, [statusFinal, idFamilia, tenantId]);
    }

    await connection.commit();
    return res.json({
      success: true,
      message: statusFinal === 'BLOQUEADO_INCONSISTENCIA'
        ? 'Família salva, mas BLOQUEADA: corrija as pendências para ativá-la.'
        : 'Família salva com sucesso!',
      status: statusFinal,
      saude,
    });

  } catch (error) {
    await connection.rollback();
    console.error('Erro na transação de atualização da família:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar a família.' });
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
    const comportamentoFinal = papelMarca(comportamentoMarca);

    const query = `
      INSERT INTO comercial_familias 
      (tenant_id, categoria_id, id_marca, comportamento_marca, nome, descricao, status, tipo_item, ncm_padrao, cest_padrao, separador_sku, sigla_sku, template_sku, unidade_base, template_nome, descricao_comercial_padrao, observacoes_padrao, cor, imagem, ordem)
      VALUES (?, ?, ?, ?, ?, ?, 'RASCUNHO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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

    // Família com produtos não pode ser excluída: os itens ficariam apontando para uma família inexistente
    const [emUso] = await connection.execute(
      `SELECT COUNT(*) AS total FROM comercial_produtos_dados WHERE tenant_id = ? AND familia_id = ?`,
      [tenantId, idFamilia]
    );
    const totalItens = Number((emUso as any[])[0]?.total || 0);
    if (totalItens > 0) {
      await connection.rollback();
      return res.status(409).json({
        error: `A família possui ${totalItens} produto(s) vinculado(s). Mova ou desagrupe os itens antes de excluir.`,
        totalItens
      });
    }

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
        f.comportamento_marca AS comportamentoMarca,
        f.id_marca AS idMarca,
        mar.nome AS nomeMarca,
        f.margem_minima AS margemMinima,
        f.margem_maxima AS margemMaxima,
        f.markup_padrao AS markupPadrao,
        f.estoque_minimo AS estoqueMinimo,
        f.lote_minimo AS loteMinimo,
        f.curva_abc AS curvaAbc,
        f.prioridade_exposicao AS prioridadeExposicao,
        (SELECT COUNT(*) FROM comercial_produtos_dados p WHERE p.tenant_id = f.tenant_id AND p.familia_id = f.id) AS totalItens
      FROM comercial_familias f
      LEFT JOIN comercial_categorias c
        ON f.categoria_id = c.id AND f.tenant_id = c.tenant_id
      LEFT JOIN comercial_marcas mar ON mar.id = f.id_marca AND mar.tenant_id = f.tenant_id
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
        AND core.tipo_entidade = 'familia'
      ORDER BY core.ordem ASC, a.nome ASC
    `;

    const [atributosRows] = await pool.execute(queryAtributos, [tenantId]);
    const todosAtributos = atributosRows as any[];
    // Herdados: cadeia inteira de categorias (raiz -> categoria da família), com ajustes e bloqueios por ramo
    const [arvoreCategorias, vinculosCategorias] = await Promise.all([
      carregarArvore(pool as any, tenantId),
      carregarVinculosCategorias(pool as any, tenantId),
    ]);

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

      const herdados = atributosEfetivosDaCategoria(arvoreCategorias, vinculosCategorias, f.categoriaPai);

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

      const atributosFamilia = Array.from(mapaAtributos.values());
      const saude = avaliarSaudeFamilia(f, atributosFamilia);

      return {
        ...f,
        saude,
        id: String(f.id),
        categoriaPai: f.categoriaPai ? String(f.categoriaPai) : '',
        categoriaPaiNome: f.categoriaPaiNome || '',
        status: STATUS_FAMILIA.includes(String(f.status).toUpperCase()) ? String(f.status).toUpperCase() : 'RASCUNHO',
        idMarca: f.idMarca ? String(f.idMarca) : '',
        nomeMarca: marcaReal(f.nomeMarca) ? f.nomeMarca : '',
        margemMinima: f.margemMinima !== null ? Number(f.margemMinima) : null,
        margemMaxima: f.margemMaxima !== null ? Number(f.margemMaxima) : null,
        markupPadrao: f.markupPadrao !== null ? Number(f.markupPadrao) : null,
        estoqueMinimo: f.estoqueMinimo !== null ? Number(f.estoqueMinimo) : null,
        loteMinimo: f.loteMinimo !== null ? Number(f.loteMinimo) : null,
        totalItens: Number(f.totalItens || 0),
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
      const atributosPendentes: any[] = pendenciasDoItem(atributos, valores, tokens, contexto.opcoes);
      const familia = contexto.familia;
      const usaMarca = tokens.some(t => t.toLowerCase().replace(/[^a-z]/g, '') === 'marca');
      const pendMarca = pendenciaMarca(familia.papelMarca, familia.nomeMarca, item.marca, usaMarca);
      if (pendMarca) atributosPendentes.push(pendMarca);
      // Para montar código/nome vale a marca efetiva pelo papel; a devolvida para edição é a do item
      const valoresCalculo = { ...valores, [CHAVE_MARCA]: marcaEfetiva(familia.papelMarca, familia.nomeMarca, item.marca) };
      const skuCalculado = atributosPendentes.length === 0
        ? montarTextoTemplate(contexto.familia.templateSku, contexto.familia, atributos, valoresCalculo, item.variacao)
        : null;
      const nomeCalculado = atributosPendentes.length === 0
        ? montarTextoTemplate(contexto.familia.templateNomeComercial, contexto.familia, atributos, valoresCalculo, item.variacao)
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
        separadorSku: contexto.familia.separadorSku || '-',
        papelMarca: contexto.familia.papelMarca,
        marca: marcaReal(contexto.familia.nomeMarca) ? contexto.familia.nomeMarca : ''
      },
      marcas: contexto.marcas.filter(m => marcaReal(m.nome)),
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
        SELECT i.id_item AS idItem, i.descricao_variacao AS variacao, p.id_marca AS idMarca, mi.nome AS nomeMarca
        FROM itens_core i
        INNER JOIN comercial_produtos_dados p
          ON p.id_item = i.id_item AND p.tenant_id = i.tenant_id
        LEFT JOIN comercial_marcas mi ON mi.id = p.id_marca AND mi.tenant_id = p.tenant_id
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

      // Valor padrão da família (DNA fixo) completa o que o item não tem
      for (const attr of contexto.atributos) {
        if (estaVazio(valores[attr.id]) && !estaVazio(attr.valorPadraoGrupo)) valores[attr.id] = attr.valorPadraoGrupo;
      }

      const tokensTemplate = [...extrairTokens(contexto.familia.templateSku), ...extrairTokens(contexto.familia.templateNomeComercial)];
      const pendentes: any[] = pendenciasDoItem(contexto.atributos, valores, tokensTemplate, contexto.opcoes);

      // Marca: DNA usa a da família; ficha/grade usam a informada na tela ou a atual do item
      const familia = contexto.familia;
      const itemAtual = (itemRows as any[])[0];
      const marcaInformada = resolverMarcaInformada(
        valoresEntrada[CHAVE_MARCA] ?? valoresEntrada.MARCA ?? valoresEntrada.marca, contexto.marcas);
      if (!marcaInformada.ok) throw new Error(`O item ${idItem}: ${marcaInformada.erro}`);
      let idMarcaItem: number | null = itemAtual.idMarca ? Number(itemAtual.idMarca) : null;
      let nomeMarcaItem: string = itemAtual.nomeMarca || '';
      if (familia.papelMarca === 'dna') {
        if (marcaReal(familia.nomeMarca)) { idMarcaItem = Number(familia.idMarca); nomeMarcaItem = familia.nomeMarca; }
      } else if (marcaInformada.marca) {
        idMarcaItem = marcaInformada.marca.id;
        nomeMarcaItem = marcaInformada.marca.nome;
      }
      const usaMarca = tokensTemplate.some(t => t.toLowerCase().replace(/[^a-z]/g, '') === 'marca');
      const pendMarca = pendenciaMarca(familia.papelMarca, familia.nomeMarca, nomeMarcaItem, usaMarca);
      if (pendMarca) pendentes.push(pendMarca);
      valores[CHAVE_MARCA] = marcaEfetiva(familia.papelMarca, familia.nomeMarca, nomeMarcaItem);
      if (pendentes.length > 0) {
        throw new Error(`O item ${idItem} possui atributos pendentes: ${pendentes.map(p => `${p.nome} (${p.motivo})`).join(', ')}.`);
      }

      // Cada valor vai para a coluna do seu tipo (número, decimal, opção...)
      for (const attr of contexto.atributos) {
        const valor = resolverValor(valores, [attr.id, attr.nome, attr.codigo]);
        if (estaVazio(valor)) continue;
        await gravarValorAtributo(
          connection as any, tenantId, 'produto', idItem,
          { id: attr.id, nome: attr.nome, tipo: attr.tipoBanco }, valor, contexto.opcoes.get(String(attr.id)) || []
        );
      }

      const variacao = (itemRows as any[])[0].variacao || 'Principal';
      const novoSku = montarTextoTemplate(contexto.familia.templateSku, contexto.familia, contexto.atributos, valores, variacao);
      const novoNome = montarTextoTemplate(contexto.familia.templateNomeComercial, contexto.familia, contexto.atributos, valores, variacao);
      if (novoSku.includes('[') || novoNome.includes('[')) throw new Error(`Não foi possível resolver o template do item ${idItem}.`);

      // O SKU raiz (itens_core.sku) é a identidade do item e nunca muda: o template gera o SKU customizado
      const [skuRows] = await connection.execute(
        `SELECT id_item FROM comercial_produtos_dados WHERE tenant_id = ? AND sku_customizado = ? AND id_item <> ? LIMIT 1`,
        [tenantId, novoSku, idItem]
      );
      if ((skuRows as any[]).length > 0) throw new Error(`O SKU ${novoSku} já está sendo usado por outro item.`);

      await connection.execute(`UPDATE comercial_produtos_dados SET sku_customizado = ?, nome_comercial = ?, id_marca = ?
        WHERE id_item = ? AND tenant_id = ?`, [novoSku, novoNome, idMarcaItem, idItem, tenantId]);
      resultados.push({ idItem, sku: novoSku, nome: novoNome, marca: nomeMarcaItem, status: 'FORMALIZADO' });
    }

    await connection.commit();
    return res.json({ success: true, itens: resultados, message: 'Itens formalizados com sucesso.' });
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : 'Erro interno ao formalizar os itens.';
    console.error('Erro ao formalizar itens da família:', error);
    const erroDeNegocio = message.startsWith('O item') || message.startsWith('O SKU') || message.startsWith('Atributo "');
    return res.status(erroDeNegocio ? 400 : 500).json({ error: message });
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
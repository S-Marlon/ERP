// backend/src/routes/Catalogo/Atributos/atributosGlobais.controller.ts
// Pool global de atributos do PIM (Diâmetro, Material, Tensão...), reaproveitado por categorias e famílias.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { codigoOpcao, diferencaOpcoes, normalizarTexto, separarOpcaoCodigo, templateUsaAtributo, trocarTokenTemplate } from './atributosRegras';

type Conn = { query: (sql: string, params?: any[]) => Promise<any>; execute?: (sql: string, params?: any[]) => Promise<any> };

const TIPOS = ['texto', 'numero', 'decimal', 'boolean', 'lista', 'data'];
const ESCOPOS = ['dna', 'grade', 'ficha'];

const tenantDe = (req: Request): number => Number(req.headers['x-tenant-id'] || req.query.tenant_id || req.body?.tenant_id || 1);

const gerarCodigo = (nome: string): string => String(nome || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Lista "a, b, c" (formato da tela) ou array
const listaOpcoes = (valor: unknown): string[] =>
  Array.isArray(valor) ? valor.map(String) : String(valor ?? '').split(',').map(v => v.trim()).filter(Boolean);

class ErroNegocio extends Error {}

/** Uso real do atributo: itens com valor, vínculos com família/categoria e templates que o citam */
const carregarUso = async (conn: Conn, tenant: number, idAtributo: number) => {
  const [[valores]] = await conn.query(
    `SELECT COUNT(DISTINCT id_entidade) AS itens FROM atributos_comercial_valores
     WHERE tenant_id = ? AND atributo_id = ? AND tipo_entidade = 'produto'`,
    [tenant, idAtributo]
  );
  const [[vinculos]] = await conn.query(
    `SELECT COUNT(*) AS total FROM atributos_core_entidades WHERE tenant_id = ? AND atributo_id = ? AND ativo = 1`,
    [tenant, idAtributo]
  );
  return { qtdItens: Number(valores.itens) || 0, qtdVinculos: Number(vinculos.total) || 0 };
};

// Famílias cujo template de código/nome cita o atributo (por id, nome ou código)
const familiasQueUsamNoTemplate = async (conn: Conn, tenant: number, aliases: Array<string | number>) => {
  const [familias] = await conn.query(
    `SELECT id, nome, template_sku, template_nome FROM comercial_familias WHERE tenant_id = ?`,
    [tenant]
  );
  return (familias as any[]).filter(f => templateUsaAtributo(f.template_sku, aliases) || templateUsaAtributo(f.template_nome, aliases));
};

/**
 * Sincroniza as opções de uma lista preservando os ids (os valores dos itens apontam para eles).
 * Opção em uso não pode sair da lista; opção sem uso que sai fica inativa.
 */
const sincronizarOpcoes = async (conn: Conn, tenant: number, idAtributo: number, desejadasTexto: string[]) => {
  // "texto = código": o código informado vale para a opção (novo ou já existente); sem código, mantém/gera
  const separadas = desejadasTexto.map(separarOpcaoCodigo);
  const desejadas = separadas.map(s => s.valor);
  const codigoInformado = new Map(separadas.filter(s => s.codigo).map(s => [normalizarTexto(s.valor), s.codigo as string]));
  const [atuais] = await conn.query(
    `SELECT o.id, o.valor,
            EXISTS (SELECT 1 FROM atributos_comercial_valores v WHERE v.opcao_id = o.id) AS em_uso
     FROM atributos_comercial_opcoes o
     WHERE o.tenant_id = ? AND o.atributo_id = ? AND o.ativo = 1`,
    [tenant, idAtributo]
  );
  const diff = diferencaOpcoes(
    (atuais as any[]).map(o => ({ id: Number(o.id), valor: o.valor, emUso: Boolean(Number(o.em_uso)) })),
    desejadas
  );
  if (diff.bloqueadas.length > 0) {
    throw new ErroNegocio(`Estas opções já estão em uso por itens e não podem sair da lista: ${diff.bloqueadas.join(', ')}.`);
  }
  const valorPorId = new Map((atuais as any[]).map(o => [Number(o.id), String(o.valor)]));
  for (const m of diff.manter) {
    const codigo = codigoInformado.get(normalizarTexto(valorPorId.get(m.id)));
    if (codigo) await conn.query(`UPDATE atributos_comercial_opcoes SET ordem = ?, codigo = ? WHERE id = ?`, [m.ordem, codigo, m.id]);
    else await conn.query(`UPDATE atributos_comercial_opcoes SET ordem = ? WHERE id = ?`, [m.ordem, m.id]);
  }
  for (const n of diff.inserir) {
    // Reativa uma opção antiga com o mesmo valor, se existir (preserva o id)
    const [inativa] = await conn.query(
      `SELECT id, valor FROM atributos_comercial_opcoes WHERE tenant_id = ? AND atributo_id = ? AND ativo = 0`,
      [tenant, idAtributo]
    );
    const reaproveitar = (inativa as any[]).find(o => normalizarTexto(o.valor) === normalizarTexto(n.valor));
    if (reaproveitar) {
      await conn.query(`UPDATE atributos_comercial_opcoes SET ativo = 1, ordem = ?, valor = ?, codigo = COALESCE(?, codigo) WHERE id = ?`,
        [n.ordem, n.valor, codigoInformado.get(normalizarTexto(n.valor)) ?? null, reaproveitar.id]);
    } else {
      await conn.query(
        `INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
        [tenant, idAtributo, n.valor, codigoInformado.get(normalizarTexto(n.valor)) ?? codigoOpcao(n.valor, n.ordem), n.ordem]
      );
    }
  }
  if (diff.desativar.length > 0) {
    await conn.query(
      `UPDATE atributos_comercial_opcoes SET ativo = 0 WHERE id IN (${diff.desativar.map(() => '?').join(',')})`,
      diff.desativar
    );
  }
};

const responderErro = (res: Response, error: any, contexto: string) => {
  if (error instanceof ErroNegocio) return res.status(400).json({ error: error.message });
  console.error(`❌ ${contexto}:`, error);
  return res.status(500).json({ error: `${contexto}.` });
};

/**
 * 🔍 LISTAR ATRIBUTOS GLOBAIS (com uso real e opções)
 */
export async function getAtributosGlobais(req: Request, res: Response): Promise<void> {
  try {
    const tenant = tenantDe(req);
    const [atributos]: any = await pool.query(
      `SELECT a.*, u.simbolo AS unidade_simbolo,
              (SELECT COUNT(DISTINCT v.id_entidade) FROM atributos_comercial_valores v
                WHERE v.atributo_id = a.id AND v.tenant_id = a.tenant_id AND v.tipo_entidade = 'produto') AS qtd_itens,
              (SELECT COUNT(*) FROM atributos_core_entidades c
                WHERE c.atributo_id = a.id AND c.tenant_id = a.tenant_id AND c.ativo = 1) AS qtd_vinculos
       FROM atributos_comercial a
       LEFT JOIN atributos_comercial_unidades u ON u.id = a.unidade_id
       WHERE a.tenant_id = ? AND a.ativo = 1
       ORDER BY a.nome ASC`,
      [tenant]
    );
    const [opcoes]: any = await pool.query(
      `SELECT o.id, o.atributo_id, o.valor, o.codigo,
              EXISTS (SELECT 1 FROM atributos_comercial_valores v WHERE v.opcao_id = o.id) AS em_uso
       FROM atributos_comercial_opcoes o WHERE o.tenant_id = ? AND o.ativo = 1 ORDER BY o.ordem ASC`,
      [tenant]
    );
    const opcoesPorAtributo: Record<string, any[]> = {};
    for (const o of opcoes) (opcoesPorAtributo[o.atributo_id] ||= []).push(o);

    res.status(200).json(atributos.map((a: any) => {
      const lista = opcoesPorAtributo[a.id] || [];
      const qtdItens = Number(a.qtd_itens) || 0;
      const qtdVinculos = Number(a.qtd_vinculos) || 0;
      return {
        id: String(a.id),
        grupo_id: a.grupo_id ? Number(a.grupo_id) : undefined,
        nome: a.nome,
        codigo: a.codigo,
        tipo: a.tipo,
        escopoPadrao: ESCOPOS.includes(a.escopo_padrao) ? a.escopo_padrao : 'ficha',
        unidade_id: a.unidade_id ? Number(a.unidade_id) : undefined,
        sufixo: a.unidade_simbolo || undefined,
        descricao: a.descricao || undefined,
        obrigatorioPadrao: Number(a.obrigatorio_padrao) === 1,
        pesquisavel: Number(a.pesquisavel) === 1,
        valoresSugeridos: lista.map(o => o.valor).join(', ') || undefined,
        opcoes: lista.map(o => ({ id: String(o.id), valor: o.valor, codigo: o.codigo, emUso: Boolean(Number(o.em_uso)) })),
        qtdItens,
        qtdVinculos,
        // Em uso: tem valores em itens ou está ligado a família/categoria
        emUso: qtdItens > 0 || qtdVinculos > 0,
      };
    }));
  } catch (error) {
    responderErro(res, error, 'Erro ao listar atributos globais');
  }
}

/**
 * ➕ CRIAR ATRIBUTO GLOBAL
 */
export async function createAtributoGlobal(req: Request, res: Response): Promise<void> {
  const tenant = tenantDe(req);
  const { grupoId, nome, codigo, tipo, escopoPadrao, unidadeId, obrigatorioPadrao, pesquisavel, valoresSugeridos } = req.body;
  const descricao = req.body.descricao ?? req.body.ajudaContextual;

  if (!String(nome || '').trim()) { res.status(400).json({ error: 'Informe o nome do atributo.' }); return; }
  if (!TIPOS.includes(tipo)) { res.status(400).json({ error: 'Tipo de dado inválido.' }); return; }
  const codigoFinal = String(codigo || '').trim() || gerarCodigo(nome);

  const connection: any = await pool.getConnection();
  try {
    const [codigoExiste]: any = await connection.query(
      'SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = ? AND ativo = 1 LIMIT 1',
      [tenant, codigoFinal]
    );
    if (codigoExiste.length > 0) throw new ErroNegocio('O código técnico informado já está em uso.');

    await connection.beginTransaction();
    const [ins]: any = await connection.query(
      `INSERT INTO atributos_comercial
       (tenant_id, grupo_id, nome, codigo, tipo, escopo_padrao, unidade_id, descricao, obrigatorio_padrao, pesquisavel, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        tenant, Number(grupoId) || null, String(nome).trim(), codigoFinal, tipo,
        ESCOPOS.includes(escopoPadrao) ? escopoPadrao : 'ficha', Number(unidadeId) || null,
        String(descricao || '').trim() || null, obrigatorioPadrao ? 1 : 0, pesquisavel === false ? 0 : 1,
      ]
    );
    if (tipo === 'lista') await sincronizarOpcoes(connection, tenant, ins.insertId, listaOpcoes(valoresSugeridos));

    await connection.commit();
    res.status(201).json({ success: true, id: String(ins.insertId), message: 'Atributo criado com sucesso!' });
  } catch (error) {
    await connection.rollback();
    responderErro(res, error, 'Erro ao salvar o novo atributo');
  } finally {
    connection.release();
  }
}

/**
 * ✏️ ATUALIZAR ATRIBUTO GLOBAL (parcial, com proteção de integridade)
 */
export async function updateAtributoGlobal(req: Request, res: Response): Promise<void> {
  const tenant = tenantDe(req);
  const idAtributo = Number(req.params.idAtributo);
  const body = req.body || {};
  const tem = (campo: string) => Object.prototype.hasOwnProperty.call(body, campo) && body[campo] !== undefined;

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[atual]]: any = await connection.query(
      `SELECT * FROM atributos_comercial WHERE id = ? AND tenant_id = ? AND ativo = 1 FOR UPDATE`,
      [idAtributo, tenant]
    );
    if (!atual) throw new ErroNegocio('Atributo não encontrado.');

    const uso = await carregarUso(connection, tenant, idAtributo);
    const sets: string[] = [];
    const valores: any[] = [];
    const definir = (coluna: string, valor: any) => { sets.push(`${coluna} = ?`); valores.push(valor); };

    // Tipo: não muda se já há valores (cada tipo grava numa coluna diferente)
    if (tem('tipo') && body.tipo !== atual.tipo) {
      if (!TIPOS.includes(body.tipo)) throw new ErroNegocio('Tipo de dado inválido.');
      if (uso.qtdItens > 0) throw new ErroNegocio(`Não é possível mudar o tipo: ${uso.qtdItens} item(ns) já têm valor neste atributo.`);
      definir('tipo', body.tipo);
    }

    // Nome e código: são usados nos templates de SKU/nome das famílias
    const novoNome = tem('nome') ? String(body.nome).trim() : atual.nome;
    const novoCodigo = tem('codigo') ? String(body.codigo).trim() : atual.codigo;
    if (!novoNome) throw new ErroNegocio('O nome do atributo não pode ficar vazio.');
    if (!novoCodigo) throw new ErroNegocio('O código técnico não pode ficar vazio.');
    const mudouNome = novoNome !== atual.nome;
    const mudouCodigo = novoCodigo !== atual.codigo;
    if (mudouCodigo) {
      const [dup]: any = await connection.query(
        'SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = ? AND ativo = 1 AND id <> ? LIMIT 1',
        [tenant, novoCodigo, idAtributo]
      );
      if (dup.length > 0) throw new ErroNegocio('O código técnico informado já está em uso por outro atributo.');
    }
    if (mudouNome || mudouCodigo) {
      const aliasesQueSomem = [mudouNome ? atual.nome : null, mudouCodigo ? atual.codigo : null].filter(Boolean) as string[];
      const familias = await familiasQueUsamNoTemplate(connection, tenant, aliasesQueSomem);
      if (familias.length > 0) {
        throw new ErroNegocio(`O ${mudouCodigo ? 'código' : 'nome'} é usado no template de SKU/nome das famílias: ${familias.map(f => f.nome).join(', ')}. Ajuste os templates antes.`);
      }
      if (mudouNome) definir('nome', novoNome);
      if (mudouCodigo) definir('codigo', novoCodigo);
    }

    if (tem('grupoId')) definir('grupo_id', Number(body.grupoId) || null);
    if (tem('escopoPadrao')) definir('escopo_padrao', ESCOPOS.includes(body.escopoPadrao) ? body.escopoPadrao : 'ficha');
    if (tem('unidadeId')) definir('unidade_id', Number(body.unidadeId) || null);
    if (tem('descricao') || tem('ajudaContextual')) definir('descricao', String(body.descricao ?? body.ajudaContextual ?? '').trim() || null);
    if (tem('obrigatorioPadrao')) definir('obrigatorio_padrao', body.obrigatorioPadrao ? 1 : 0);
    if (tem('pesquisavel')) definir('pesquisavel', body.pesquisavel ? 1 : 0);

    if (sets.length > 0) {
      await connection.query(`UPDATE atributos_comercial SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, [...valores, idAtributo, tenant]);
    }

    const tipoFinal = tem('tipo') ? body.tipo : atual.tipo;
    if (tipoFinal === 'lista' && tem('valoresSugeridos')) {
      await sincronizarOpcoes(connection, tenant, idAtributo, listaOpcoes(body.valoresSugeridos));
    }

    await connection.commit();
    res.status(200).json({ success: true, message: 'Atributo atualizado com sucesso.' });
  } catch (error) {
    await connection.rollback();
    responderErro(res, error, 'Erro ao modificar o atributo');
  } finally {
    connection.release();
  }
}

/**
 * 🗑️ EXCLUIR ATRIBUTO GLOBAL (soft delete; só se não estiver em uso)
 */
export async function deleteAtributoGlobal(req: Request, res: Response): Promise<void> {
  try {
    const tenant = tenantDe(req);
    const idAtributo = Number(req.params.idAtributo);
    const uso = await carregarUso(pool as any, tenant, idAtributo);
    if (uso.qtdItens > 0 || uso.qtdVinculos > 0) {
      res.status(400).json({
        error: `Atributo em uso: ${uso.qtdItens} item(ns) com valor e ${uso.qtdVinculos} vínculo(s) com família/categoria. Remova os vínculos ou mescle com outro atributo.`,
      });
      return;
    }
    await pool.query('UPDATE atributos_comercial SET ativo = 0 WHERE id = ? AND tenant_id = ?', [idAtributo, tenant]);
    res.status(200).json({ success: true, message: 'Atributo removido com sucesso.' });
  } catch (error) {
    responderErro(res, error, 'Erro ao remover o atributo');
  }
}

/**
 * 🔀 MESCLAR ATRIBUTOS DUPLICADOS: POST /atributos-globais/:idAtributo/mesclar { destinoId }
 * Move valores dos itens, vínculos de família/categoria e tokens de template da origem para o destino,
 * e desativa a origem. Em conflito (item já tem valor no destino), o valor do destino é mantido.
 */
export async function mesclarAtributos(req: Request, res: Response): Promise<void> {
  const tenant = tenantDe(req);
  const origemId = Number(req.params.idAtributo);
  const destinoId = Number(req.body?.destinoId);
  if (!destinoId || destinoId === origemId) { res.status(400).json({ error: 'Informe um atributo de destino diferente da origem.' }); return; }

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [attrs]: any = await connection.query(
      `SELECT * FROM atributos_comercial WHERE tenant_id = ? AND ativo = 1 AND id IN (?, ?) FOR UPDATE`,
      [tenant, origemId, destinoId]
    );
    const origem = attrs.find((a: any) => Number(a.id) === origemId);
    const destino = attrs.find((a: any) => Number(a.id) === destinoId);
    if (!origem || !destino) throw new ErroNegocio('Atributo de origem ou destino não encontrado.');
    if (origem.tipo !== destino.tipo) throw new ErroNegocio(`Só é possível mesclar atributos do mesmo tipo (${origem.tipo} ≠ ${destino.tipo}).`);

    const resumo = { valoresMovidos: 0, conflitos: 0, vinculosMovidos: 0, vinculosDuplicados: 0, familiasTemplate: 0 };

    // 1. Valores dos itens
    const [valoresOrigem]: any = await connection.query(
      `SELECT v.*, o.valor AS opcao_valor FROM atributos_comercial_valores v
       LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
       WHERE v.tenant_id = ? AND v.atributo_id = ?`,
      [tenant, origemId]
    );
    for (const v of valoresOrigem) {
      const [conflito]: any = await connection.query(
        `SELECT id FROM atributos_comercial_valores WHERE tenant_id = ? AND atributo_id = ? AND tipo_entidade = ? AND id_entidade = ? LIMIT 1`,
        [tenant, destinoId, v.tipo_entidade, v.id_entidade]
      );
      if (conflito.length > 0) {
        await connection.query(`DELETE FROM atributos_comercial_valores WHERE id = ?`, [v.id]);
        resumo.conflitos++;
        continue;
      }
      let opcaoDestino: number | null = null;
      if (v.opcao_id) {
        // Lista: a opção equivalente no destino (criada se não existir)
        await sincronizarOpcoesSemRemover(connection, tenant, destinoId, v.opcao_valor);
        const [[op]]: any = await connection.query(
          `SELECT id FROM atributos_comercial_opcoes WHERE tenant_id = ? AND atributo_id = ? AND ativo = 1 AND valor = ? LIMIT 1`,
          [tenant, destinoId, v.opcao_valor]
        );
        opcaoDestino = op ? Number(op.id) : null;
      }
      await connection.query(
        `UPDATE atributos_comercial_valores SET atributo_id = ?, opcao_id = COALESCE(?, opcao_id) WHERE id = ?`,
        [destinoId, opcaoDestino, v.id]
      );
      resumo.valoresMovidos++;
    }

    // 2. Vínculos com família/categoria
    const [vinculos]: any = await connection.query(
      `SELECT id, tipo_entidade, id_entidade FROM atributos_core_entidades WHERE tenant_id = ? AND atributo_id = ?`,
      [tenant, origemId]
    );
    for (const vinc of vinculos) {
      const [ja]: any = await connection.query(
        `SELECT id FROM atributos_core_entidades WHERE tenant_id = ? AND atributo_id = ? AND tipo_entidade = ? AND id_entidade = ? LIMIT 1`,
        [tenant, destinoId, vinc.tipo_entidade, vinc.id_entidade]
      );
      if (ja.length > 0) {
        await connection.query(`DELETE FROM atributos_core_entidades WHERE id = ?`, [vinc.id]);
        resumo.vinculosDuplicados++;
      } else {
        await connection.query(`UPDATE atributos_core_entidades SET atributo_id = ? WHERE id = ?`, [destinoId, vinc.id]);
        resumo.vinculosMovidos++;
      }
    }

    // 3. Templates das famílias que citavam a origem passam a citar o destino
    const aliasesOrigem = [origemId, origem.nome, origem.codigo];
    const familias = await familiasQueUsamNoTemplate(connection, tenant, aliasesOrigem);
    for (const f of familias) {
      await connection.query(
        `UPDATE comercial_familias SET template_sku = ?, template_nome = ? WHERE id = ?`,
        [trocarTokenTemplate(f.template_sku, aliasesOrigem, destino.codigo), trocarTokenTemplate(f.template_nome, aliasesOrigem, destino.codigo), f.id]
      );
      resumo.familiasTemplate++;
    }

    // 4. Origem sai do pool (as opções dela ficam inativas)
    await connection.query(`UPDATE atributos_comercial SET ativo = 0 WHERE id = ?`, [origemId]);
    await connection.query(`UPDATE atributos_comercial_opcoes SET ativo = 0 WHERE atributo_id = ?`, [origemId]);

    await connection.commit();
    res.status(200).json({
      success: true,
      message: `"${origem.nome}" mesclado em "${destino.nome}": ${resumo.valoresMovidos} valor(es) e ${resumo.vinculosMovidos} vínculo(s) movidos.`,
      resumo,
    });
  } catch (error) {
    await connection.rollback();
    responderErro(res, error, 'Erro ao mesclar atributos');
  } finally {
    connection.release();
  }
}

// Garante que a opção exista (ativa) no atributo, sem remover as demais
const sincronizarOpcoesSemRemover = async (conn: Conn, tenant: number, idAtributo: number, valor: string) => {
  const [atuais] = await conn.query(
    `SELECT valor FROM atributos_comercial_opcoes WHERE tenant_id = ? AND atributo_id = ? AND ativo = 1`,
    [tenant, idAtributo]
  );
  const lista = (atuais as any[]).map(o => o.valor);
  if (!lista.some(v => normalizarTexto(v) === normalizarTexto(valor))) {
    await sincronizarOpcoes(conn, tenant, idAtributo, [...lista, valor]);
  }
};

/**
 * ⚡ CADASTRO RÁPIDO DE ATRIBUTO GLOBAL
 */
export async function createAtributoGlobalRapido(req: Request, res: Response): Promise<void> {
  const tenant = tenantDe(req);
  const { nome, tipo, grupo_id, unidade_id } = req.body;
  if (!String(nome || '').trim() || !TIPOS.includes(tipo)) {
    res.status(400).json({ error: 'Parâmetros obrigatórios ausentes ou inválidos: nome e tipo de dado.' });
    return;
  }
  try {
    let codigo = gerarCodigo(nome);
    const [existe]: any = await pool.query(
      'SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = ? AND ativo = 1 LIMIT 1',
      [tenant, codigo]
    );
    if (existe.length > 0) codigo = `${codigo}_${Date.now().toString().slice(-4)}`;

    const [ins]: any = await pool.query(
      `INSERT INTO atributos_comercial
       (tenant_id, grupo_id, nome, codigo, tipo, escopo_padrao, unidade_id, obrigatorio_padrao, pesquisavel, ativo)
       VALUES (?, ?, ?, ?, ?, 'ficha', ?, 0, 1, 1)`,
      [tenant, Number(grupo_id) || null, String(nome).trim(), codigo, tipo, Number(unidade_id) || null]
    );
    res.status(201).json({ success: true, id: String(ins.insertId) });
  } catch (error) {
    responderErro(res, error, 'Erro ao processar criação rápida do atributo');
  }
}

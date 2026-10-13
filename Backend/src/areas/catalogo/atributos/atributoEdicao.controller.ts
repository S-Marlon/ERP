// Edição detalhada de um atributo do PIM: uso real (itens, vínculos, modelos de nome/SKU), travas por campo,
// opções da lista editáveis no lugar (renomear, mudar código, ordenar, mesclar, excluir), conversão texto → lista
// e correção de valores inconsistentes.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { codigoOpcao, normalizarTexto } from './atributosRegras';
import {
  FamiliaNoTemplate, impactoDoLote, impactoEdicaoOpcao, planoConversaoLista, travasDoAtributo, usoNoTemplate, validarOpcao,
} from './atributosEdicao';

type Conn = { query: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.headers['x-tenant-id'] || req.query.tenant_id || req.body?.tenant_id || 1);

class ErroAtributo extends Error {
  constructor(message: string, public status = 400, public detalhes?: unknown) { super(message); }
}

const responderErro = (res: Response, error: any, contexto: string) => {
  if (error instanceof ErroAtributo) return res.status(error.status).json({ error: error.message, detalhes: error.detalhes });
  console.error(`❌ ${contexto}:`, error);
  return res.status(500).json({ error: `${contexto}.` });
};

const carregarAtributo = async (conn: Conn, tenant: number, id: number, trava = false) => {
  const [[a]]: any = await conn.query(
    `SELECT * FROM atributos_comercial WHERE id = ? AND tenant_id = ? AND ativo = 1 ${trava ? 'FOR UPDATE' : ''}`, [id, tenant]
  );
  if (!a) throw new ErroAtributo('Atributo não encontrado.', 404);
  return a;
};

/** Famílias cujos modelos de nome/SKU citam o atributo (por id, nome ou código), e se pelo texto ou pelo código. */
const familiasNoTemplate = async (conn: Conn, tenant: number, a: any): Promise<Array<FamiliaNoTemplate & { id: number }>> => {
  const [familias]: any = await conn.query(`SELECT id, nome, template_sku, template_nome FROM comercial_familias WHERE tenant_id = ?`, [tenant]);
  const aliases = [a.id, a.nome, a.codigo];
  return (familias as any[])
    .map(f => ({ id: Number(f.id), nome: f.nome, noNome: usoNoTemplate(f.template_nome, aliases), noSku: usoNoTemplate(f.template_sku, aliases) }))
    .filter(f => f.noNome.texto || f.noNome.codigo || f.noSku.texto || f.noSku.codigo);
};

/** Só as famílias dos itens que usam a opção (o impacto de mexer nela fica restrito a elas). */
const familiasDaOpcao = async (conn: Conn, tenant: number, a: any, idOpcao: number) => {
  const [rows]: any = await conn.query(
    `SELECT DISTINCT cpd.familia_id FROM atributos_comercial_valores v
     INNER JOIN comercial_produtos_dados cpd ON cpd.id_item = v.id_entidade AND cpd.tenant_id = v.tenant_id
     WHERE v.tenant_id = ? AND v.opcao_id = ? AND v.tipo_entidade = 'produto' AND cpd.familia_id IS NOT NULL`,
    [tenant, idOpcao]
  );
  const ids = new Set((rows as any[]).map(r => Number(r.familia_id)));
  return (await familiasNoTemplate(conn, tenant, a)).filter(f => ids.has(f.id));
};

const opcoesComUso = async (conn: Conn, tenant: number, idAtributo: number) => {
  const [rows]: any = await conn.query(
    `SELECT o.id, o.valor, o.codigo, o.ordem,
            (SELECT COUNT(DISTINCT v.id_entidade) FROM atributos_comercial_valores v WHERE v.opcao_id = o.id AND v.tipo_entidade = 'produto') AS itens
     FROM atributos_comercial_opcoes o
     WHERE o.tenant_id = ? AND o.atributo_id = ? AND o.ativo = 1
     ORDER BY o.ordem, o.id`,
    [tenant, idAtributo]
  );
  return (rows as any[]).map(o => ({ id: Number(o.id), valor: o.valor, codigo: o.codigo || '', ordem: Number(o.ordem) || 0, itens: Number(o.itens) || 0 }));
};

/** GET /atributos-globais/:idAtributo/detalhe */
export const detalheAtributo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.idAtributo);
  try {
    const a = await carregarAtributo(pool as any, tenant, id);
    const [[itens]]: any = await pool.query(
      `SELECT COUNT(DISTINCT id_entidade) AS n FROM atributos_comercial_valores WHERE tenant_id = ? AND atributo_id = ? AND tipo_entidade = 'produto'`,
      [tenant, id]
    );
    const [vinculos]: any = await pool.query(
      `SELECT c.tipo_entidade, c.id_entidade, c.escopo_comercial, c.obrigatorio,
              COALESCE(f.nome, cat.nome) AS nome
       FROM atributos_core_entidades c
       LEFT JOIN comercial_familias f ON c.tipo_entidade = 'familia' AND f.id = c.id_entidade
       LEFT JOIN comercial_categorias cat ON c.tipo_entidade = 'categoria' AND cat.id = c.id_entidade
       WHERE c.tenant_id = ? AND c.atributo_id = ? AND c.ativo = 1
       ORDER BY c.tipo_entidade, nome`,
      [tenant, id]
    );
    const familiasTemplate = await familiasNoTemplate(pool as any, tenant, a);
    const opcoes = a.tipo === 'lista' ? await opcoesComUso(pool as any, tenant, id) : [];
    // Valores gravados (fora de lista): os mais usados, para conferir e para converter em lista
    const [valores]: any = a.tipo === 'lista' ? [[]] : await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(valor_texto), ''), CAST(valor_numero AS CHAR),
                       TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(valor_decimal AS CHAR))),
                       CAST(valor_boolean AS CHAR), CAST(valor_data AS CHAR)) AS texto, COUNT(*) AS qtd
       FROM atributos_comercial_valores WHERE tenant_id = ? AND atributo_id = ? AND tipo_entidade = 'produto'
       GROUP BY texto ORDER BY qtd DESC LIMIT 80`,
      [tenant, id]
    );
    // Inconsistências: lista com valor de texto sem opção; valores de itens que não existem mais
    const [[soltos]]: any = await pool.query(
      `SELECT COUNT(*) AS n, GROUP_CONCAT(DISTINCT valor_texto SEPARATOR ' | ') AS textos
       FROM atributos_comercial_valores WHERE tenant_id = ? AND atributo_id = ? AND opcao_id IS NULL AND ? = 'lista'`,
      [tenant, id, a.tipo]
    );
    const [[orfaos]]: any = await pool.query(
      `SELECT COUNT(*) AS n FROM atributos_comercial_valores v LEFT JOIN itens_core i ON i.id_item = v.id_entidade
       WHERE v.tenant_id = ? AND v.atributo_id = ? AND v.tipo_entidade = 'produto' AND i.id_item IS NULL`,
      [tenant, id]
    );
    const uso = { itens: Number(itens.n) || 0, vinculos: (vinculos as any[]).length };
    return res.json({
      atributo: {
        id: String(a.id), nome: a.nome, codigo: a.codigo, tipo: a.tipo, escopoPadrao: a.escopo_padrao || 'ficha',
        grupoId: a.grupo_id ? String(a.grupo_id) : '', unidadeId: a.unidade_id ? String(a.unidade_id) : '',
        descricao: a.descricao || '', obrigatorioPadrao: Number(a.obrigatorio_padrao) === 1, pesquisavel: Number(a.pesquisavel) === 1,
      },
      uso: {
        ...uso,
        vinculos: (vinculos as any[]).map(v => ({ tipo: v.tipo_entidade, id: Number(v.id_entidade), nome: v.nome || `#${v.id_entidade}`, escopo: v.escopo_comercial, obrigatorio: Number(v.obrigatorio) === 1 })),
        familiasTemplate,
      },
      travas: travasDoAtributo({ itens: uso.itens, vinculos: uso.vinculos, familiasTemplate, tipo: a.tipo }),
      opcoes,
      valores: (valores as any[]).filter(v => v.texto !== null).map(v => ({ texto: String(v.texto), qtd: Number(v.qtd) })),
      inconsistencias: {
        valoresSemOpcao: Number(soltos?.n) || 0,
        textosSemOpcao: soltos?.textos ? String(soltos.textos).split(' | ') : [],
        valoresDeItensApagados: Number(orfaos.n) || 0,
      },
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o atributo');
  }
};

/**
 * PUT /atributos-globais/:idAtributo/opcoes/:idOpcao { valor?, codigo?, confirmar? }
 * Renomeia/muda o código no lugar (os itens continuam na mesma opção). Se mudar nome/SKU de famílias, pede confirmar.
 */
export const editarOpcao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.idAtributo);
  const idOpcao = Number(req.params.idOpcao);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const a = await carregarAtributo(connection, tenant, id, true);
    const opcoes = await opcoesComUso(connection, tenant, id);
    const atual = opcoes.find(o => o.id === idOpcao);
    if (!atual) throw new ErroAtributo('Opção não encontrada.', 404);
    const valor = req.body?.valor !== undefined ? String(req.body.valor).trim() : atual.valor;
    const codigo = req.body?.codigo !== undefined ? String(req.body.codigo).trim() : atual.codigo;
    const erro = validarOpcao(opcoes, idOpcao, valor, codigo || null);
    if (erro) throw new ErroAtributo(erro);
    const mudaValor = valor !== atual.valor;
    const mudaCodigo = (codigo || '') !== (atual.codigo || '');
    if (!mudaValor && !mudaCodigo) { await connection.rollback(); return res.json({ success: true, semMudanca: true }); }
    const impacto = impactoEdicaoOpcao({ itens: atual.itens, familias: await familiasDaOpcao(connection, tenant, a, idOpcao), mudaValor, mudaCodigo });
    if (impacto.nivel === 'aviso' && !req.body?.confirmar) {
      throw new ErroAtributo('Esta mudança altera nome/SKU de itens.', 409, { codigo: 'CONFIRMAR', impacto });
    }
    await connection.query(
      `UPDATE atributos_comercial_opcoes SET valor = ?, codigo = ? WHERE id = ? AND atributo_id = ?`,
      [valor, codigo || codigoOpcao(valor, atual.ordem || 1), idOpcao, id]
    );
    await connection.commit();
    return res.json({ success: true, impacto });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao editar a opção');
  } finally {
    connection.release();
  }
};

/**
 * PUT /atributos-globais/:idAtributo/opcoes-lote { opcoes: [{ id, valor, codigo }], confirmar? }
 * Salva várias opções de uma vez: confere contra a lista final (permite trocar valores entre opções),
 * pede uma confirmação só se nome/SKU de itens mudar e grava tudo ou nada.
 */
export const editarOpcoesLote = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.idAtributo);
  const pedidas: Array<{ id: number; valor: string; codigo: string }> = (Array.isArray(req.body?.opcoes) ? req.body.opcoes : [])
    .map((o: any) => ({ id: Number(o.id), valor: String(o.valor ?? '').trim(), codigo: String(o.codigo ?? '').trim() }));
  const connection: any = await pool.getConnection();
  try {
    if (!pedidas.length) throw new ErroAtributo('Nenhuma opção alterada.');
    await connection.beginTransaction();
    const a = await carregarAtributo(connection, tenant, id, true);
    const atuais = await opcoesComUso(connection, tenant, id);
    // Lista final (com as edições) para conferir repetidos entre todas
    const final = atuais.map(o => {
      const e = pedidas.find(p => p.id === o.id);
      return e ? { ...o, valor: e.valor, codigo: e.codigo } : o;
    });
    const mudancas = pedidas.map(p => {
      const atual = atuais.find(o => o.id === p.id);
      if (!atual) throw new ErroAtributo(`Opção ${p.id} não encontrada (recarregue).`, 404);
      const erro = validarOpcao(final, p.id, p.valor, p.codigo || null);
      if (erro) throw new ErroAtributo(`"${p.valor || atual.valor}": ${erro}`);
      return { atual, p, mudaValor: p.valor !== atual.valor, mudaCodigo: p.codigo !== (atual.codigo || '') };
    }).filter(m => m.mudaValor || m.mudaCodigo);
    if (!mudancas.length) { await connection.rollback(); return res.json({ success: true, alteradas: 0 }); }

    const impactos = [];
    for (const m of mudancas) {
      const i = impactoEdicaoOpcao({ itens: m.atual.itens, familias: await familiasDaOpcao(connection, tenant, a, m.atual.id), mudaValor: m.mudaValor, mudaCodigo: m.mudaCodigo });
      impactos.push({ itens: m.atual.itens, afetaNome: i.afetaNome, afetaSku: i.afetaSku });
    }
    const impacto = impactoDoLote(impactos);
    if (impacto.nivel === 'aviso' && !req.body?.confirmar) {
      throw new ErroAtributo(`Estas ${mudancas.length} alterações mudam nome/SKU de itens.`, 409, { codigo: 'CONFIRMAR', impacto });
    }
    for (const m of mudancas) {
      await connection.query(
        `UPDATE atributos_comercial_opcoes SET valor = ?, codigo = ? WHERE id = ? AND atributo_id = ?`,
        [m.p.valor, m.p.codigo || codigoOpcao(m.p.valor, m.atual.ordem || 1), m.atual.id, id]
      );
    }
    await connection.commit();
    return res.json({ success: true, alteradas: mudancas.length, impacto });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao salvar as opções');
  } finally {
    connection.release();
  }
};

/** DELETE /atributos-globais/:idAtributo/opcoes/:idOpcao — só sem uso (em uso: mesclar em outra opção) */
export const excluirOpcao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.idAtributo);
  const idOpcao = Number(req.params.idOpcao);
  try {
    await carregarAtributo(pool as any, tenant, id);
    const atual = (await opcoesComUso(pool as any, tenant, id)).find(o => o.id === idOpcao);
    if (!atual) throw new ErroAtributo('Opção não encontrada.', 404);
    if (atual.itens > 0) throw new ErroAtributo(`"${atual.valor}" está em ${atual.itens} item(ns): mescle em outra opção em vez de excluir.`);
    await pool.query(`UPDATE atributos_comercial_opcoes SET ativo = 0 WHERE id = ? AND atributo_id = ?`, [idOpcao, id]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir a opção');
  }
};

/**
 * POST /atributos-globais/:idAtributo/opcoes/:idOpcao/mesclar { destinoId, confirmar? }
 * Os itens da opção passam para a opção destino (ex.: "1/2 pol" → '1/2"') e a origem sai da lista.
 */
export const mesclarOpcao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.idAtributo);
  const idOpcao = Number(req.params.idOpcao);
  const destinoId = Number(req.body?.destinoId);
  const connection: any = await pool.getConnection();
  try {
    if (!destinoId || destinoId === idOpcao) throw new ErroAtributo('Escolha outra opção como destino.');
    await connection.beginTransaction();
    const a = await carregarAtributo(connection, tenant, id, true);
    const opcoes = await opcoesComUso(connection, tenant, id);
    const origem = opcoes.find(o => o.id === idOpcao);
    const destino = opcoes.find(o => o.id === destinoId);
    if (!origem || !destino) throw new ErroAtributo('Opção não encontrada.', 404);
    const impacto = impactoEdicaoOpcao({
      itens: origem.itens, familias: await familiasDaOpcao(connection, tenant, a, idOpcao),
      mudaValor: origem.valor !== destino.valor, mudaCodigo: origem.codigo !== destino.codigo,
    });
    if (origem.itens > 0 && impacto.nivel === 'aviso' && !req.body?.confirmar) {
      throw new ErroAtributo('Juntar muda nome/SKU dos itens desta opção.', 409, { codigo: 'CONFIRMAR', impacto });
    }
    const [r]: any = await connection.query(
      `UPDATE atributos_comercial_valores SET opcao_id = ? WHERE tenant_id = ? AND atributo_id = ? AND opcao_id = ?`, [destinoId, tenant, id, idOpcao]
    );
    await connection.query(`UPDATE atributos_comercial_opcoes SET ativo = 0 WHERE id = ?`, [idOpcao]);
    await connection.commit();
    return res.json({ success: true, movidos: Number(r.affectedRows) || 0, impacto });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao mesclar as opções');
  } finally {
    connection.release();
  }
};

/** PUT /atributos-globais/:idAtributo/opcoes-ordem { ids: [idOpcao...] } — a ordem das opções nas telas */
export const ordenarOpcoes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.idAtributo);
  const ids: number[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter((n: number) => n > 0);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await carregarAtributo(connection, tenant, id, true);
    for (const [i, idOpcao] of ids.entries()) {
      await connection.query(`UPDATE atributos_comercial_opcoes SET ordem = ? WHERE id = ? AND atributo_id = ? AND tenant_id = ?`, [i + 1, idOpcao, id, tenant]);
    }
    await connection.commit();
    return res.json({ success: true });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao ordenar as opções');
  } finally {
    connection.release();
  }
};

/**
 * POST /atributos-globais/:idAtributo/converter-lista { aplicar? }
 * Texto → lista: cada valor diferente vira uma opção (grafias iguais se juntam) e os itens passam a apontar para ela.
 * Sem aplicar devolve só o plano.
 */
export const converterEmLista = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.idAtributo);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const a = await carregarAtributo(connection, tenant, id, true);
    if (a.tipo !== 'texto') throw new ErroAtributo(`Só atributo de texto pode virar lista (este é ${a.tipo}).`);
    const [valores]: any = await connection.query(
      `SELECT TRIM(valor_texto) AS texto, COUNT(*) AS qtd FROM atributos_comercial_valores
       WHERE tenant_id = ? AND atributo_id = ? AND NULLIF(TRIM(valor_texto), '') IS NOT NULL GROUP BY TRIM(valor_texto)`,
      [tenant, id]
    );
    const plano = planoConversaoLista((valores as any[]).map(v => ({ texto: v.texto, qtd: Number(v.qtd) })));
    if (!req.body?.aplicar) { await connection.rollback(); return res.json({ aplicado: false, ...plano }); }

    for (const [i, o] of plano.opcoes.entries()) {
      const [ins]: any = await connection.query(
        `INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
        [tenant, id, o.valor, o.codigo, i + 1]
      );
      const grafias = [o.valor, ...o.variantes];
      await connection.query(
        `UPDATE atributos_comercial_valores SET opcao_id = ?, valor_texto = NULL
         WHERE tenant_id = ? AND atributo_id = ? AND TRIM(valor_texto) IN (${grafias.map(() => '?').join(',')})`,
        [ins.insertId, tenant, id, ...grafias]
      );
    }
    // Sobra (grafia com espaço duplo etc.): casa pela forma normalizada
    const [restantes]: any = await connection.query(
      `SELECT id, valor_texto FROM atributos_comercial_valores WHERE tenant_id = ? AND atributo_id = ? AND opcao_id IS NULL AND NULLIF(TRIM(valor_texto), '') IS NOT NULL`,
      [tenant, id]
    );
    const [novas]: any = await connection.query(`SELECT id, valor FROM atributos_comercial_opcoes WHERE tenant_id = ? AND atributo_id = ? AND ativo = 1`, [tenant, id]);
    for (const r of restantes) {
      const op = (novas as any[]).find(o => normalizarTexto(String(o.valor).replace(/\s+/g, ' ')) === normalizarTexto(String(r.valor_texto).trim().replace(/\s+/g, ' ')));
      if (op) await connection.query(`UPDATE atributos_comercial_valores SET opcao_id = ?, valor_texto = NULL WHERE id = ?`, [op.id, r.id]);
    }
    await connection.query(`UPDATE atributos_comercial SET tipo = 'lista' WHERE id = ?`, [id]);
    await connection.commit();
    return res.json({ aplicado: true, ...plano });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao converter em lista');
  } finally {
    connection.release();
  }
};

/**
 * POST /atributos-globais/:idAtributo/corrigir-valores
 * Lista: valor gravado como texto solto passa a apontar para a opção (criada se faltar).
 * Também apaga valores de itens que não existem mais.
 */
export const corrigirValores = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.idAtributo);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const a = await carregarAtributo(connection, tenant, id, true);
    let ligados = 0;
    let opcoesCriadas = 0;
    if (a.tipo === 'lista') {
      const [soltos]: any = await connection.query(
        `SELECT id, valor_texto FROM atributos_comercial_valores WHERE tenant_id = ? AND atributo_id = ? AND opcao_id IS NULL AND NULLIF(TRIM(valor_texto), '') IS NOT NULL`,
        [tenant, id]
      );
      for (const s of soltos) {
        const texto = String(s.valor_texto).trim();
        const [ops]: any = await connection.query(`SELECT id, valor, codigo FROM atributos_comercial_opcoes WHERE tenant_id = ? AND atributo_id = ? AND ativo = 1`, [tenant, id]);
        let op = (ops as any[]).find(o => normalizarTexto(o.valor) === normalizarTexto(texto) || (o.codigo && normalizarTexto(o.codigo) === normalizarTexto(texto)));
        if (!op) {
          const [ins]: any = await connection.query(
            `INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
            [tenant, id, texto, codigoOpcao(texto, ops.length + 1), ops.length + 1]
          );
          op = { id: ins.insertId };
          opcoesCriadas++;
        }
        await connection.query(`UPDATE atributos_comercial_valores SET opcao_id = ?, valor_texto = NULL WHERE id = ?`, [op.id, s.id]);
        ligados++;
      }
    }
    const [orfaos]: any = await connection.query(
      `DELETE v FROM atributos_comercial_valores v LEFT JOIN itens_core i ON i.id_item = v.id_entidade
       WHERE v.tenant_id = ? AND v.atributo_id = ? AND v.tipo_entidade = 'produto' AND i.id_item IS NULL`,
      [tenant, id]
    );
    await connection.commit();
    return res.json({ success: true, ligados, opcoesCriadas, orfaosApagados: Number(orfaos.affectedRows) || 0 });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao corrigir os valores');
  } finally {
    connection.release();
  }
};

// Galeria da família. Cada foto tem um papel (uso): PRINCIPAL (a foto limpa do produto, 1ª da variação que não tem foto
// limpa própria; uma só por família), COMUM (aplicação, embalagem: entra em todas as variações depois das fotos de cada
// item) ou EDITOR (gabarito, ex.: desenho sem medidas: só base do editor de imagem, não vai ao canal). Cada foto pode
// guardar o modelo do editor (cotas, textos) montado sobre ela.
// comercial_familias.imagem espelha a PRINCIPAL: as telas e rotas que só conhecem uma foto continuam certas.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ErroArquivo, salvarArquivo } from '../../../infra/arquivos';
import { apagarArquivos, semUso } from '../arquivosEmUso';
import { ehImagemGeradaNoEditor, lerIds, ordemComNovaNaPosicao, lerPosicao } from '../produtos/ordemAnexos';
import { CampoEtiqueta, camposQueVariam, modeloPadraoDosCampos } from '../imagens/camposEtiqueta';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };
const tenantDe = (req: Request) => Number(req.query.tenant_id || req.body?.tenant_id || 1);
export const USOS_FOTO_FAMILIA = ['PRINCIPAL', 'COMUM', 'EDITOR'];
const nomeDaUrl = (url: string) => decodeURIComponent(url.split('?')[0].split('/').pop() || 'foto').slice(0, 255);

class ErroFotoFamilia extends Error { constructor(msg: string, public status = 400) { super(msg); } }

const conferirFamilia = async (conn: Conn, tenant: number, idFamilia: number) => {
  const [[f]] = await conn.execute(`SELECT id FROM comercial_familias WHERE id = ? AND tenant_id = ? FOR UPDATE`, [idFamilia, tenant]);
  if (!f) throw new ErroFotoFamilia('Família não encontrada.', 404);
};

const listar = async (conn: Conn, tenant: number, idFamilia: number) => {
  const [rows] = await conn.execute(
    `SELECT id_foto, nome_arquivo, url_foto, ordem, uso, modelo_editor IS NOT NULL AS tem_modelo
     FROM comercial_familias_fotos WHERE tenant_id = ? AND id_familia = ? ORDER BY ordem, id_foto`,
    [tenant, idFamilia]
  );
  return (rows as any[]).map(r => ({
    idFoto: Number(r.id_foto), nome: r.nome_arquivo, url: r.url_foto, ordem: Number(r.ordem),
    uso: USOS_FOTO_FAMILIA.includes(r.uso) ? String(r.uso) : 'COMUM', temModelo: !!Number(r.tem_modelo),
  }));
};

/** Regrava a ordem (a pedida, ou a de hoje) e espelha a PRINCIPAL (sem ela, a 1ª que vai ao canal) em comercial_familias.imagem. */
const regravar = async (conn: Conn, tenant: number, idFamilia: number, pedida?: number[]) => {
  const atuais = (await listar(conn, tenant, idFamilia)).map(f => f.idFoto);
  const conhecidas = new Set(atuais);
  const inicio = [...new Set((pedida || []).filter(id => conhecidas.has(id)))];
  const ordem = [...inicio, ...atuais.filter(id => !inicio.includes(id))];
  for (const [k, id] of ordem.entries()) await conn.execute(`UPDATE comercial_familias_fotos SET ordem = ? WHERE id_foto = ?`, [k, id]);
  const [[primeira]] = await conn.execute(
    `SELECT url_foto FROM comercial_familias_fotos WHERE tenant_id = ? AND id_familia = ? AND uso <> 'EDITOR'
     ORDER BY (uso = 'PRINCIPAL') DESC, ordem, id_foto LIMIT 1`, [tenant, idFamilia]
  );
  // a coluna tem 255: link maior fica só na galeria
  const url = primeira?.url_foto && String(primeira.url_foto).length <= 255 ? primeira.url_foto : null;
  await conn.execute(`UPDATE comercial_familias SET imagem = ? WHERE id = ? AND tenant_id = ?`, [url, idFamilia, tenant]);
};

/** Nova foto: a 1ª da família (sem principal ainda) vira a PRINCIPAL; as outras entram como COMUM. */
const inserir = async (conn: Conn, tenant: number, idFamilia: number, url: string, nome: string, posicao: number | null, operador: string, uso?: string) => {
  const [[jaTem]] = await conn.execute(`SELECT id_foto FROM comercial_familias_fotos WHERE tenant_id = ? AND id_familia = ? AND url_foto = ?`, [tenant, idFamilia, url]);
  if (jaTem) throw new ErroFotoFamilia('Esta foto já está na família.', 409);
  const [[{ proxima }]] = await conn.execute(
    `SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima FROM comercial_familias_fotos WHERE tenant_id = ? AND id_familia = ?`, [tenant, idFamilia]
  );
  const [[temPrincipal]] = await conn.execute(
    `SELECT COUNT(*) AS n FROM comercial_familias_fotos WHERE tenant_id = ? AND id_familia = ? AND uso = 'PRINCIPAL'`, [tenant, idFamilia]
  );
  const papel = uso && USOS_FOTO_FAMILIA.includes(uso) ? uso : Number(temPrincipal.n) ? 'COMUM' : 'PRINCIPAL';
  if (papel === 'PRINCIPAL') await conn.execute(`UPDATE comercial_familias_fotos SET uso = 'COMUM' WHERE tenant_id = ? AND id_familia = ? AND uso = 'PRINCIPAL'`, [tenant, idFamilia]);
  const [r] = await conn.execute(
    `INSERT INTO comercial_familias_fotos (tenant_id, id_familia, nome_arquivo, url_foto, ordem, uso, operador) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenant, idFamilia, nome.slice(0, 255), url, Number(proxima), papel, operador.slice(0, 60)]
  );
  const ids = (await listar(conn, tenant, idFamilia)).map(f => f.idFoto);
  await regravar(conn, tenant, idFamilia, posicao ? ordemComNovaNaPosicao(ids, Number(r.insertId), posicao) : undefined);
  return Number(r.insertId);
};

/**
 * Para as rotas antigas de "uma foto da família": a nova foto vira a principal-modelo (no lugar da anterior, que sai da
 * galeria e, se ninguém mais usa, do disco). url vazia tira a principal. Devolve os arquivos para apagar.
 */
export const trocarPrincipalDaFamilia = async (conn: Conn, tenant: number, idFamilia: number, url: string | null, imagemAnterior?: string | null) => {
  const [[principal]] = await conn.execute(
    `SELECT id_foto, url_foto FROM comercial_familias_fotos WHERE tenant_id = ? AND id_familia = ? AND uso = 'PRINCIPAL' ORDER BY ordem, id_foto LIMIT 1`, [tenant, idFamilia]
  );
  if (principal?.url_foto === url) return [];
  if (principal) await conn.execute(`DELETE FROM comercial_familias_fotos WHERE id_foto = ?`, [principal.id_foto]);
  const [[naGaleria]] = url
    ? await conn.execute(`SELECT id_foto FROM comercial_familias_fotos WHERE tenant_id = ? AND id_familia = ? AND url_foto = ?`, [tenant, idFamilia, url])
    : [[null]];
  if (naGaleria) {   // já estava: vira a principal e sobe para 1ª
    await conn.execute(`UPDATE comercial_familias_fotos SET uso = 'COMUM' WHERE tenant_id = ? AND id_familia = ? AND uso = 'PRINCIPAL'`, [tenant, idFamilia]);
    await conn.execute(`UPDATE comercial_familias_fotos SET uso = 'PRINCIPAL' WHERE id_foto = ?`, [naGaleria.id_foto]);
    await regravar(conn, tenant, idFamilia, [Number(naGaleria.id_foto)]);
  } else if (url) await inserir(conn, tenant, idFamilia, url, nomeDaUrl(url), 1, 'ADM', 'PRINCIPAL');
  else await regravar(conn, tenant, idFamilia);
  return semUso(conn, [principal?.url_foto, imagemAnterior]);
};

const comConexao = async (res: Response, padrao: string, fn: (conn: Conn) => Promise<unknown>) => {
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const r = await fn(connection);
    await connection.commit();
    return res.json(r);
  } catch (error: any) {
    await connection.rollback().catch(() => null);
    if (error instanceof ErroFotoFamilia) return res.status(error.status).json({ error: error.message });
    if (error instanceof ErroArquivo) return res.status(400).json({ error: error.message });
    console.error(padrao, error);
    return res.status(500).json({ error: padrao, details: error?.message });
  } finally {
    connection.release();
  }
};

/** GET /catalogo/cadastros/familias/:idFamilia/fotos */
export const listarFotosFamilia = async (req: Request, res: Response) => {
  try {
    return res.json({ fotos: await listar(pool as any, tenantDe(req), Number(req.params.idFamilia)) });
  } catch (error: any) {
    console.error('Erro ao listar as fotos da família:', error);
    return res.status(500).json({ error: 'Erro ao listar as fotos da família.' });
  }
};

/** POST /catalogo/cadastros/familias/:idFamilia/fotos/arquivo { nome, conteudo (data URL), posicao? } */
export const enviarFotoFamilia = (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFamilia = Number(req.params.idFamilia);
  const enviados: string[] = [];
  return comConexao(res, 'Erro ao enviar a foto da família.', async conn => {
    await conferirFamilia(conn, tenant, idFamilia);
    const salvo = salvarArquivo(`familias/${tenant}/${idFamilia}`, String(req.body?.nome || 'foto'), String(req.body?.conteudo || ''));
    const url = `${req.protocol}://${req.get('host')}/uploads/${salvo.relativo}`;
    enviados.push(url);
    if (!salvo.tipo.startsWith('image/')) { apagarArquivos(enviados); throw new ErroFotoFamilia('A foto da família precisa ser uma imagem (JPG, PNG ou WEBP).'); }
    await inserir(conn, tenant, idFamilia, url, String(req.body?.nome || '').trim() || nomeDaUrl(url), lerPosicao(req.body?.posicao), String(req.body?.operador || 'ADM'));
    return { success: true, fotos: await listar(conn, tenant, idFamilia) };
  });
};

/** POST /catalogo/cadastros/familias/:idFamilia/fotos { url, posicao? } — foto por link */
export const adicionarFotoFamilia = (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFamilia = Number(req.params.idFamilia);
  const url = String(req.body?.url || '').trim();
  return comConexao(res, 'Erro ao adicionar a foto da família.', async conn => {
    if (!/^https?:\/\/\S+$/i.test(url)) throw new ErroFotoFamilia('Cole um link válido (começando com http:// ou https://).');
    if (url.length > 500) throw new ErroFotoFamilia('O link pode ter no máximo 500 caracteres.');
    await conferirFamilia(conn, tenant, idFamilia);
    await inserir(conn, tenant, idFamilia, url, nomeDaUrl(url), lerPosicao(req.body?.posicao), String(req.body?.operador || 'ADM'));
    return { success: true, fotos: await listar(conn, tenant, idFamilia) };
  });
};

/** POST /catalogo/cadastros/familias/:idFamilia/fotos/do-item { idAnexo, posicao? } — leva uma foto do item para a família (mesmo arquivo) */
export const fotoDoItemParaFamilia = (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFamilia = Number(req.params.idFamilia);
  return comConexao(res, 'Erro ao levar a foto para a família.', async conn => {
    await conferirFamilia(conn, tenant, idFamilia);
    const [[a]] = await conn.execute(
      `SELECT url_anexo, nome_arquivo FROM itens_anexos WHERE id_anexo = ? AND tenant_id = ? AND tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA')`,
      [Number(req.body?.idAnexo), tenant]
    );
    if (!a) throw new ErroFotoFamilia('Foto não encontrada.', 404);
    await inserir(conn, tenant, idFamilia, a.url_anexo, a.nome_arquivo, lerPosicao(req.body?.posicao), String(req.body?.operador || 'ADM'));
    return { success: true, fotos: await listar(conn, tenant, idFamilia) };
  });
};

/** DELETE /catalogo/cadastros/familias/:idFamilia/fotos/:idFoto */
export const removerFotoFamilia = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFamilia = Number(req.params.idFamilia);
  let apagar: string[] = [];
  const r = await comConexao(res, 'Erro ao tirar a foto da família.', async conn => {
    const [[f]] = await conn.execute(
      `SELECT url_foto FROM comercial_familias_fotos WHERE id_foto = ? AND id_familia = ? AND tenant_id = ?`, [Number(req.params.idFoto), idFamilia, tenant]
    );
    if (!f) throw new ErroFotoFamilia('Foto não encontrada.', 404);
    await conn.execute(`DELETE FROM comercial_familias_fotos WHERE id_foto = ?`, [Number(req.params.idFoto)]);
    await regravar(conn, tenant, idFamilia);
    apagar = await semUso(conn, [f.url_foto]);
    return { success: true, fotos: await listar(conn, tenant, idFamilia) };
  });
  if (res.statusCode < 400) apagarArquivos(apagar);
  return r;
};

/** PUT /catalogo/cadastros/familias/:idFamilia/fotos-ordem { ids } — a 1ª vira a principal-modelo */
export const ordenarFotosFamilia = (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFamilia = Number(req.params.idFamilia);
  return comConexao(res, 'Erro ao ordenar as fotos da família.', async conn => {
    const ids = lerIds(req.body?.ids);
    if (!ids.length) throw new ErroFotoFamilia('Informe a ordem das fotos.');
    await conferirFamilia(conn, tenant, idFamilia);
    await regravar(conn, tenant, idFamilia, ids);
    return { success: true, fotos: await listar(conn, tenant, idFamilia) };
  });
};

/** GET /catalogo/cadastros/familias/:idFamilia/fotos/:idFoto/modelo — o modelo do editor de imagem guardado na foto */
export const lerModeloEditor = async (req: Request, res: Response) => {
  try {
    const [[f]]: any = await pool.execute(
      `SELECT modelo_editor FROM comercial_familias_fotos WHERE id_foto = ? AND id_familia = ? AND tenant_id = ?`,
      [Number(req.params.idFoto), Number(req.params.idFamilia), tenantDe(req)]
    );
    if (!f) return res.status(404).json({ error: 'Foto não encontrada.' });
    return res.json({ modelo: f.modelo_editor || null });
  } catch (error: any) {
    console.error('Erro ao ler o modelo do editor:', error);
    return res.status(500).json({ error: 'Erro ao ler o modelo do editor.' });
  }
};

/** PUT /catalogo/cadastros/familias/:idFamilia/fotos/:idFoto/modelo { modelo } — guarda (ou tira, com null) o modelo do editor */
export const salvarModeloEditor = async (req: Request, res: Response) => {
  const modelo = req.body?.modelo === null || req.body?.modelo === undefined ? null : String(req.body.modelo);
  try {
    if (modelo !== null) {
      if (modelo.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Modelo grande demais.' });
      try { JSON.parse(modelo); } catch { return res.status(400).json({ error: 'Modelo inválido.' }); }
    }
    const [r]: any = await pool.execute(
      `UPDATE comercial_familias_fotos SET modelo_editor = ? WHERE id_foto = ? AND id_familia = ? AND tenant_id = ?`,
      [modelo, Number(req.params.idFoto), Number(req.params.idFamilia), tenantDe(req)]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Foto não encontrada.' });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao guardar o modelo do editor:', error);
    return res.status(500).json({ error: 'Erro ao guardar o modelo do editor.' });
  }
};

const valorExibicao = (r: any): string | null => {
  if (r.opcao_valor !== null && r.opcao_valor !== undefined) return String(r.opcao_valor);
  if (r.valor_texto !== null && r.valor_texto !== undefined && String(r.valor_texto).trim() !== '') return String(r.valor_texto);
  if (r.valor_numero !== null && r.valor_numero !== undefined) return String(r.valor_numero);
  if (r.valor_decimal !== null && r.valor_decimal !== undefined) return String(Number(r.valor_decimal));
  if (r.valor_boolean !== null && r.valor_boolean !== undefined) return Number(r.valor_boolean) === 1 ? 'Sim' : 'Não';
  return null;
};

/**
 * GET /catalogo/cadastros/familias/:idFamilia/editor-imagem — o que o editor de imagem precisa para aplicar nas
 * variações: as fotos da família, os itens ativos com as fotos limpas de cada um e os campos do cadastro (atributos)
 * que vão escritos na imagem, e o texto padrão da cota (os campos que variam).
 */
export const dadosDoEditorFamilia = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFamilia = Number(req.params.idFamilia);
  try {
    const [[familia]]: any = await pool.execute(`SELECT id, nome FROM comercial_familias WHERE id = ? AND tenant_id = ?`, [idFamilia, tenant]);
    if (!familia) return res.status(404).json({ error: 'Família não encontrada.' });
    const [itens]: any = await pool.execute(
      `SELECT ic.id_item, COALESCE(cpd.sku_customizado, ic.sku) AS sku, COALESCE(cpd.nome_comercial, ic.nome_item) AS nome
       FROM comercial_produtos_dados cpd
       INNER JOIN itens_core ic ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id AND ic.status = 'ATIVO'
       WHERE cpd.tenant_id = ? AND cpd.familia_id = ? ORDER BY sku`,
      [tenant, idFamilia]
    );
    const ids: number[] = itens.map((i: any) => Number(i.id_item));
    const lista = ids.map(() => '?').join(',');
    const [anexos]: any = ids.length ? await pool.execute(
      `SELECT id_item, url_anexo, nome_arquivo FROM itens_anexos WHERE tenant_id = ? AND id_item IN (${lista}) AND tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA')
       ORDER BY id_item, (tipo_anexo = 'IMAGEM_PRINCIPAL') DESC, ordem, id_anexo`, [tenant, ...ids]
    ) : [[]];
    const [valores]: any = ids.length ? await pool.execute(
      `SELECT v.id_entidade, a.nome, v.valor_texto, v.valor_numero, v.valor_decimal, v.valor_boolean, o.valor AS opcao_valor
       FROM atributos_comercial_valores v
       INNER JOIN atributos_comercial a ON a.id = v.atributo_id AND a.tenant_id = v.tenant_id
       LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
       WHERE v.tenant_id = ? AND v.tipo_entidade = 'produto' AND v.id_entidade IN (${lista})
       ORDER BY a.nome`, [tenant, ...ids]
    ) : [[]];
    const saida = itens.map((i: any) => {
      const id = Number(i.id_item);
      // fotos limpas do item (sem as imagens de medidas geradas pelo editor)
      const fotos = anexos.filter((a: any) => Number(a.id_item) === id && !ehImagemGeradaNoEditor(a.nome_arquivo)).map((a: any) => ({ url: a.url_anexo, nome: a.nome_arquivo }));
      const campos: CampoEtiqueta[] = [];
      for (const v of valores.filter((x: any) => Number(x.id_entidade) === id)) {
        const valor = valorExibicao(v);
        if (valor && !campos.some(c => c.chave === v.nome)) campos.push({ chave: v.nome, nome: v.nome, valor: valor.replace(/\s+/g, ' ').trim() });
      }
      return { idItem: id, sku: i.sku, nome: i.nome, foto: fotos[0]?.url || null, fotos, campos };
    });
    const variam = camposQueVariam(saida);
    return res.json({ familia: { id: Number(familia.id), nome: familia.nome }, fotos: await listar(pool as any, tenant, idFamilia), itens: saida, variam, modeloPadrao: modeloPadraoDosCampos(variam) });
  } catch (error: any) {
    console.error('Erro ao ler os dados do editor da família:', error);
    return res.status(500).json({ error: 'Erro ao ler os itens da família.' });
  }
};

/** PUT /catalogo/cadastros/familias/:idFamilia/fotos/:idFoto/uso { uso } — PRINCIPAL (uma só: a anterior vira COMUM), COMUM ou EDITOR */
export const definirUsoFotoFamilia = (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFamilia = Number(req.params.idFamilia);
  const idFoto = Number(req.params.idFoto);
  const uso = String(req.body?.uso || '').toUpperCase();
  return comConexao(res, 'Erro ao mudar o papel da foto.', async conn => {
    if (!USOS_FOTO_FAMILIA.includes(uso)) throw new ErroFotoFamilia('Papel inválido (PRINCIPAL, COMUM ou EDITOR).');
    await conferirFamilia(conn, tenant, idFamilia);
    const [[f]] = await conn.execute(`SELECT id_foto FROM comercial_familias_fotos WHERE id_foto = ? AND id_familia = ? AND tenant_id = ?`, [idFoto, idFamilia, tenant]);
    if (!f) throw new ErroFotoFamilia('Foto não encontrada.', 404);
    if (uso === 'PRINCIPAL') await conn.execute(`UPDATE comercial_familias_fotos SET uso = 'COMUM' WHERE tenant_id = ? AND id_familia = ? AND uso = 'PRINCIPAL'`, [tenant, idFamilia]);
    await conn.execute(`UPDATE comercial_familias_fotos SET uso = ? WHERE id_foto = ?`, [uso, idFoto]);
    await regravar(conn, tenant, idFamilia);
    return { success: true, fotos: await listar(conn, tenant, idFamilia) };
  });
};

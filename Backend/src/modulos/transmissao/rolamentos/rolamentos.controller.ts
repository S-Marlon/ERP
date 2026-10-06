// Módulo Rolamentos (TRANSMISSAO_ROLAMENTOS): configuração (famílias/atributos), linha das marcas (1ª/2ª),
// medidas aprendidas e a análise das linhas da nota de entrada. O cadastro em si usa a entrada de NF do núcleo.
import { Request, Response } from 'express';
import pool from '../../../routes/Estoque/db.config';
import { lerDescricao, MarcaModulo, medidasDoCodigo, montarNome, montarSku, TipoRolamento, TIPOS } from './rolamentos';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const erro = (res: Response, error: any, padrao: string, status = 500) => {
  if (status === 500) console.error(padrao, error);
  return res.status(status).json({ error: status === 500 ? padrao : String(error), details: error?.message });
};

export interface ConfigRolamentos {
  idCategoria?: number | null;
  familias?: Partial<Record<TipoRolamento, number>>;
  atributos?: Partial<Record<'codigo' | 'vedacao' | 'folga' | 'linha' | 'diametroInterno' | 'diametroExterno' | 'largura', number>>;
  idMarcaSegundaLinha?: number | null;
  markup?: number;
}

const carregarConfig = async (tenant: number): Promise<ConfigRolamentos> => {
  const [[c]]: any = await pool.execute(`SELECT configuracao FROM modulo_transmissao_rolamentos_config WHERE tenant_id = ?`, [tenant]);
  if (!c) return {};
  return typeof c.configuracao === 'string' ? JSON.parse(c.configuracao) : c.configuracao || {};
};

const carregarMarcas = async (tenant: number) => {
  const [rows]: any = await pool.execute(
    `SELECT m.id, m.nome, m.codigo, mm.linha, mm.apelidos
     FROM comercial_marcas m
     LEFT JOIN modulo_transmissao_rolamentos_marcas mm ON mm.id_marca = m.id AND mm.tenant_id = m.tenant_id
     WHERE m.tenant_id = ?
     ORDER BY m.nome`,
    [tenant]
  );
  return rows.map((r: any): MarcaModulo => ({
    id: Number(r.id), nome: r.nome, codigo: r.codigo || null, linha: r.linha ? (Number(r.linha) === 2 ? 2 : 1) : null,
    apelidos: String(r.apelidos || '').split(',').map((a: string) => a.trim()).filter(Boolean),
  }));
};

interface MedidaAprendida { idMedida: number; codigo: string; tipo: string | null; d: number | null; D: number | null; B: number | null }

const medidasAprendidas = async (tenant: number): Promise<MedidaAprendida[]> => {
  const [rows]: any = await pool.execute(
    `SELECT id_medida, codigo, tipo, diametro_interno, diametro_externo, largura FROM modulo_transmissao_rolamentos_medidas WHERE tenant_id = ? ORDER BY codigo`,
    [tenant]
  );
  return rows.map((r: any): MedidaAprendida => ({
    idMedida: Number(r.id_medida), codigo: r.codigo, tipo: r.tipo,
    d: r.diametro_interno === null ? null : Number(r.diametro_interno), D: r.diametro_externo === null ? null : Number(r.diametro_externo),
    B: r.largura === null ? null : Number(r.largura),
  }));
};

/** Itens do catálogo com esses SKUs customizados (para vincular em vez de cadastrar de novo). */
const itensPorSku = async (tenant: number, skus: string[]) => {
  const unicos = [...new Set(skus.map(s => s.toUpperCase()).filter(Boolean))];
  const mapa: Record<string, { idItem: number; sku: string; nome: string; tipoRecurso: string; unidadeBase: string | null }> = {};
  if (!unicos.length) return mapa;
  const [rows]: any = await pool.query(
    `SELECT ic.id_item, cpd.sku_customizado, COALESCE(NULLIF(cpd.nome_comercial, ''), ic.nome_item) AS nome, ic.tipo_recurso, um.sigla
     FROM comercial_produtos_dados cpd
     INNER JOIN itens_core ic ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
     LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
     WHERE cpd.tenant_id = ? AND UPPER(cpd.sku_customizado) IN (?)`,
    [tenant, unicos]
  );
  for (const r of rows) {
    mapa[String(r.sku_customizado).toUpperCase()] = {
      idItem: Number(r.id_item), sku: r.sku_customizado, nome: r.nome, tipoRecurso: r.tipo_recurso, unidadeBase: r.sigla || null,
    };
  }
  return mapa;
};

// GET /api/modulos/transmissao/rolamentos/config
export const obterConfig = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const configuracao = await carregarConfig(tenant);
    const idsFamilias = Object.values(configuracao.familias || {}).filter(Boolean) as number[];
    const familias: Record<number, { id: number; nome: string; status: string }> = {};
    if (idsFamilias.length) {
      const [rows]: any = await pool.query(`SELECT id, nome, status FROM comercial_familias WHERE tenant_id = ? AND id IN (?)`, [tenant, idsFamilias]);
      for (const f of rows) familias[Number(f.id)] = { id: Number(f.id), nome: f.nome, status: f.status };
    }
    return res.json({
      configuracao, familias, marcas: await carregarMarcas(tenant), medidas: await medidasAprendidas(tenant),
      tipos: Object.entries(TIPOS).map(([codigo, t]) => ({ codigo, ...t })),
    });
  } catch (e) {
    return erro(res, e, 'Erro ao carregar a configuração de rolamentos.');
  }
};

// PUT /api/modulos/transmissao/rolamentos/config { configuracao }
export const salvarConfig = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const atual = await carregarConfig(tenant);
    const nova: ConfigRolamentos = { ...atual, ...(req.body?.configuracao || {}) };
    if (nova.markup !== undefined && !(Number(nova.markup) > 0)) return erro(res, 'Markup deve ser maior que zero.', '', 400);
    await pool.execute(
      `INSERT INTO modulo_transmissao_rolamentos_config (tenant_id, configuracao) VALUES (?, ?) ON DUPLICATE KEY UPDATE configuracao = VALUES(configuracao)`,
      [tenant, JSON.stringify(nova)]
    );
    return res.json({ success: true, configuracao: nova });
  } catch (e) {
    return erro(res, e, 'Erro ao salvar a configuração de rolamentos.');
  }
};

// PUT /api/modulos/transmissao/rolamentos/marcas/:idMarca { linha: 1 | 2 | null, apelidos }
export const salvarMarca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idMarca = Number(req.params.idMarca);
  const linha = req.body?.linha === null || req.body?.linha === undefined ? null : Number(req.body.linha);
  const apelidos = String(req.body?.apelidos ?? '').split(',').map(a => a.trim()).filter(Boolean).join(', ').slice(0, 255) || null;
  try {
    if (linha !== null && linha !== 1 && linha !== 2) return erro(res, 'Linha deve ser 1 ou 2.', '', 400);
    const [[m]]: any = await pool.execute(`SELECT id FROM comercial_marcas WHERE id = ? AND tenant_id = ?`, [idMarca, tenant]);
    if (!m) return erro(res, 'Marca não encontrada.', '', 404);
    if (linha === null && !apelidos) {
      await pool.execute(`DELETE FROM modulo_transmissao_rolamentos_marcas WHERE tenant_id = ? AND id_marca = ?`, [tenant, idMarca]);
    } else {
      await pool.execute(
        `INSERT INTO modulo_transmissao_rolamentos_marcas (tenant_id, id_marca, linha, apelidos) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE linha = VALUES(linha), apelidos = VALUES(apelidos)`,
        [tenant, idMarca, linha ?? 1, apelidos]
      );
    }
    return res.json({ success: true });
  } catch (e) {
    return erro(res, e, 'Erro ao salvar a marca.');
  }
};

// POST /api/modulos/transmissao/rolamentos/analisar { linhas: [{ chave, descricao }] }
export const analisarLinhas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const linhas: Array<{ chave: string; descricao: string }> = Array.isArray(req.body?.linhas) ? req.body.linhas : [];
  try {
    const [config, marcas, aprendidas] = await Promise.all([carregarConfig(tenant), carregarMarcas(tenant), medidasAprendidas(tenant)]);
    const porCodigo = new Map<string, MedidaAprendida>(aprendidas.map(m => [String(m.codigo).toUpperCase(), m]));
    const resultado = linhas.map(l => {
      const leitura = lerDescricao(String(l.descricao || ''), marcas);
      const aprendida = leitura.codigo ? porCodigo.get(leitura.codigo.toUpperCase()) : undefined;
      const tabela = leitura.codigo ? medidasDoCodigo(leitura.tipo, leitura.codigo) : null;
      const medidas = aprendida && aprendida.d !== null ? { d: aprendida.d, D: aprendida.D ?? 0, B: aprendida.B ?? 0 } : tabela;
      const linha = leitura.marca?.linha ?? null;
      const sku = leitura.codigo && linha ? montarSku({ codigo: leitura.codigo, vedacao: leitura.vedacao, folga: leitura.folga, linha, marca: leitura.marca }) : null;
      return {
        chave: l.chave, ...leitura, linha, medidas,
        origemMedidas: aprendida && aprendida.d !== null ? 'APRENDIDA' : tabela ? 'TABELA' : null,
        sku,
        nome: leitura.codigo && leitura.tipo && linha ? montarNome({ tipo: leitura.tipo, codigo: leitura.codigo, vedacao: leitura.vedacao, folga: leitura.folga, linha, marca: leitura.marca }) : null,
      };
    });
    return res.json({ linhas: resultado, existentes: await itensPorSku(tenant, resultado.map(r => r.sku || '')), configuracao: config });
  } catch (e) {
    return erro(res, e, 'Erro ao analisar as linhas.');
  }
};

// POST /api/modulos/transmissao/rolamentos/skus { skus } — itens já cadastrados com esses SKUs
export const verificarSkus = async (req: Request, res: Response) => {
  try {
    return res.json({ existentes: await itensPorSku(tenantDe(req), Array.isArray(req.body?.skus) ? req.body.skus.map(String) : []) });
  } catch (e) {
    return erro(res, e, 'Erro ao verificar os SKUs.');
  }
};

const numeroOuNulo = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// POST /api/modulos/transmissao/rolamentos/medidas { lista: [{ codigo, tipo, d, D, B }] } — aprende/corrige medidas
export const salvarMedidas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const lista: any[] = Array.isArray(req.body?.lista) ? req.body.lista : [];
  try {
    let gravadas = 0;
    for (const m of lista) {
      const codigo = String(m?.codigo || '').trim().toUpperCase().slice(0, 30);
      const d = numeroOuNulo(m?.d); const D = numeroOuNulo(m?.D); const B = numeroOuNulo(m?.B);
      if (!codigo || d === null || D === null || B === null) continue;
      await pool.execute(
        `INSERT INTO modulo_transmissao_rolamentos_medidas (tenant_id, codigo, tipo, diametro_interno, diametro_externo, largura) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE tipo = VALUES(tipo), diametro_interno = VALUES(diametro_interno), diametro_externo = VALUES(diametro_externo), largura = VALUES(largura)`,
        [tenant, codigo, m?.tipo ? String(m.tipo).slice(0, 30) : null, d, D, B]
      );
      gravadas++;
    }
    return res.json({ success: true, gravadas });
  } catch (e) {
    return erro(res, e, 'Erro ao salvar as medidas.');
  }
};

// DELETE /api/modulos/transmissao/rolamentos/medidas/:id
export const excluirMedida = async (req: Request, res: Response) => {
  try {
    await pool.execute(`DELETE FROM modulo_transmissao_rolamentos_medidas WHERE id_medida = ? AND tenant_id = ?`, [Number(req.params.id), tenantDe(req)]);
    return res.json({ success: true });
  } catch (e) {
    return erro(res, e, 'Erro ao excluir a medida.');
  }
};

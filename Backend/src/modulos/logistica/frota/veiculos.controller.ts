// Veículos da frota (modulo_logistica_frota_veiculos): lista, cadastro, edição e ajuste de km.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroFrota, novoKm, placaParaMostrar, validarKm, validarVeiculo } from './veiculos';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const responderErro = (res: Response, e: any, padrao: string) => {
  if (e instanceof ErroFrota) return res.status(e.status).json({ error: e.message });
  if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe um veículo com essa placa.' });
  console.error(padrao, e);
  return res.status(500).json({ error: padrao, details: e?.message });
};

const formatar = (r: any) => ({
  idVeiculo: Number(r.id_veiculo), placa: r.placa, placaFormatada: placaParaMostrar(r.placa), apelido: r.apelido || null,
  tipo: r.tipo, marca: r.marca || null, modelo: r.modelo || null, anoFabricacao: nulo(r.ano_fabricacao), anoModelo: nulo(r.ano_modelo),
  cor: r.cor || null, renavam: r.renavam || null, chassi: r.chassi || null, combustivel: r.combustivel,
  tanqueLitros: nulo(r.tanque_litros), cargaKg: nulo(r.carga_kg), kmAtual: Number(r.km_atual) || 0, kmAtualizadoEm: r.km_txt || null,
  situacao: r.situacao, observacao: r.observacao || null,
});

const SELECT = `SELECT v.*, DATE_FORMAT(v.km_atualizado_em, '%Y-%m-%d %H:%i') AS km_txt FROM modulo_logistica_frota_veiculos v`;

const carregar = async (tenant: number, id: number) => {
  const [[v]]: any = await pool.execute(`${SELECT} WHERE v.id_veiculo = ? AND v.tenant_id = ?`, [id, tenant]);
  if (!v) throw new ErroFrota('Veículo não encontrado.', 404);
  return v;
};

// GET /veiculos?situacao=&busca=
export const listarVeiculos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const where = ['v.tenant_id = ?'];
    const params: any[] = [tenant];
    const situacao = String(req.query.situacao || '').toUpperCase();
    if (situacao) { where.push('v.situacao = ?'); params.push(situacao); }
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      where.push('(v.placa LIKE ? OR v.apelido LIKE ? OR v.marca LIKE ? OR v.modelo LIKE ?)');
      params.push(`%${busca.toUpperCase().replace(/[^A-Z0-9]/g, '') || busca}%`, ...Array(3).fill(`%${busca}%`));
    }
    const [rows]: any = await pool.execute(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY v.situacao = 'VENDIDO', v.apelido IS NULL, v.apelido, v.placa`, params);
    return res.json(rows.map(formatar));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os veículos.'); }
};

// POST /veiculos { ...cadastro, kmAtual }
export const criarVeiculo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const v = validarVeiculo(req.body, new Date().getFullYear());
    const km = req.body?.kmAtual === undefined || req.body?.kmAtual === null || req.body?.kmAtual === '' ? 0 : validarKm(req.body.kmAtual);
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_logistica_frota_veiculos (tenant_id, placa, apelido, tipo, marca, modelo, ano_fabricacao, ano_modelo, cor, renavam, chassi,
         combustivel, tanque_litros, carga_kg, km_atual, km_atualizado_em, situacao, observacao, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [tenant, v.placa, v.apelido, v.tipo, v.marca, v.modelo, v.anoFabricacao, v.anoModelo, v.cor, v.renavam, v.chassi,
        v.combustivel, v.tanqueLitros, v.cargaKg, km, v.situacao, v.observacao, operadorDe(req)]
    );
    return res.status(201).json(formatar(await carregar(tenant, Number(ins.insertId))));
  } catch (e) { return responderErro(res, e, 'Erro ao cadastrar o veículo.'); }
};

// PUT /veiculos/:id { ...cadastro } (o km muda pelo ajuste de km)
export const salvarVeiculo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregar(tenant, id);
    const v = validarVeiculo(req.body, new Date().getFullYear());
    await pool.execute(
      `UPDATE modulo_logistica_frota_veiculos SET placa = ?, apelido = ?, tipo = ?, marca = ?, modelo = ?, ano_fabricacao = ?, ano_modelo = ?, cor = ?,
         renavam = ?, chassi = ?, combustivel = ?, tanque_litros = ?, carga_kg = ?, situacao = ?, observacao = ?, operador = ?
       WHERE id_veiculo = ? AND tenant_id = ?`,
      [v.placa, v.apelido, v.tipo, v.marca, v.modelo, v.anoFabricacao, v.anoModelo, v.cor, v.renavam, v.chassi, v.combustivel,
        v.tanqueLitros, v.cargaKg, v.situacao, v.observacao, operadorDe(req), id, tenant]
    );
    return res.json(formatar(await carregar(tenant, id)));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o veículo.'); }
};

// POST /veiculos/:id/km { km, corrigir? } — ajuste manual do km (só sobe, a não ser corrigindo)
export const ajustarKm = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const atual = await carregar(tenant, id);
    const km = novoKm(Number(atual.km_atual) || 0, req.body?.km, req.body?.corrigir === true);
    await pool.execute(
      `UPDATE modulo_logistica_frota_veiculos SET km_atual = ?, km_atualizado_em = NOW(), operador = ? WHERE id_veiculo = ? AND tenant_id = ?`,
      [km, operadorDe(req), id, tenant]
    );
    return res.json(formatar(await carregar(tenant, id)));
  } catch (e) { return responderErro(res, e, 'Erro ao ajustar o km.'); }
};

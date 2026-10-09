// Salva-vida (fêmea para soldar no tubo): família de terminal prensável com Tubo (mm) e Mangueira como grade.
// SKU igual ao de hoje: 100SV-{tubo}-{mangueira} (ex.: 100SV-12-06 = tubo 12 mm × mangueira 3/8").
//   npx ts-node src/scripts/migracaoSalvaVida.ts simular | aplicar | reverter <backup>
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';

const TENANT = 1;
const NOME = 'TERMINAL PRENSÁVEL SALVA-VIDA (FÊMEA P/ SOLDA EM TUBO)';
(async () => {
  const [modo, arquivo] = process.argv.slice(2);
  const conn: any = await pool.getConnection();
  const original = { getConnection: pool.getConnection, execute: pool.execute, query: pool.query };
  const q = async (sql: string, p: any[] = []) => (await conn.query(sql, p))[0] as any[];
  try {
    await conn.beginTransaction();
    if (modo === 'reverter') {
      const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      for (const i of b.itens) await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ?, sku_customizado = ?, nome_comercial = ? WHERE id_item = ?`,
        [i.familia_id, i.categoria_id, i.sku_customizado, i.nome_comercial, i.id_item]);
      await conn.query(`DELETE FROM atributos_comercial_valores WHERE atributo_id = ? AND id_entidade IN (${b.itens.map((i: any) => i.id_item).join(',')})`, [b.idTubo]);
      await conn.query(`DELETE FROM atributos_core_entidades WHERE tipo_entidade = 'familia' AND id_entidade = ?`, [b.idFamilia]);
      await conn.query(`DELETE FROM comercial_familias WHERE id = ?`, [b.idFamilia]);
      await conn.commit();
      console.log('Revertido.');
      return;
    }
    if ((await q(`SELECT id FROM comercial_familias WHERE nome = ?`, [NOME])).length) throw new Error('Família já existe.');
    const attr = async (c: string) => Number((await q(`SELECT id FROM atributos_comercial WHERE codigo = ? AND ativo = 1`, [c]))[0].id);
    const idTubo = await attr('terminal_tubo');
    const idMang = await attr('terminal_mangueira');
    const opc = async (id: number) => new Map((await q(`SELECT valor, codigo FROM atributos_comercial_opcoes WHERE atributo_id = ? AND ativo = 1`, [id])).map(o => [String(o.codigo), String(o.valor)]));
    const tubos = await opc(idTubo);
    const mangs = await opc(idMang);
    const [r] = await conn.query(`INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
        template_sku, unidade_base, template_nome, cor, ordem) VALUES (?, 10, 1, 'ficha', ?, 'ATIVO', 'PA', '-', 'SV', ?, 'PC', ?, '#1677ff', 0)`,
      [TENANT, NOME, '100{SIGLA}-{Tubo:cod}-{Mangueira:cod}', '{FAMILIA} - TUBO {Tubo} - {Mangueira} - {Mangueira:cod}']);
    const idFamilia = Number(r.insertId);
    await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, herdar, ordem, compoe_sku, gera_variacao, ativo)
      VALUES (?, 'familia', ?, ?, 'grade', 0, 1, 1, 1, 1, 1, 1)`, [TENANT, idFamilia, idTubo]);
    const itens = (await q(`SELECT p.id_item, p.familia_id, p.categoria_id, p.sku_customizado, p.nome_comercial, COALESCE(NULLIF(p.sku_customizado,''), ic.sku) sku
      FROM comercial_produtos_dados p JOIN itens_core ic ON ic.id_item = p.id_item WHERE ic.status <> 'INATIVO' AND ic.nome_item LIKE '%SALVA-VIDA%'`))
      .filter(i => /^100SV-\d\d-\d\d$/.test(String(i.sku)));
    await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = 10 WHERE id_item IN (${itens.map(i => i.id_item).join(',')})`, [idFamilia]);
    (pool as any).getConnection = async () => Object.assign(Object.create(conn), { beginTransaction: async () => undefined, commit: async () => undefined, rollback: async () => undefined, release: () => undefined });
    let status = 200; let dados: any;
    const res: any = { status: (s: number) => { status = s; return res; }, json: (d: any) => { dados = d; return res; } };
    await formalizarItensFamilia({ params: { idFamilia: String(idFamilia) }, query: { tenant_id: TENANT }, headers: {}, body: { itens: itens.map(i => {
      const [, t, m] = String(i.sku).match(/^100SV-(\d\d)-(\d\d)$/)!;
      if (!tubos.get(t) || !mangs.get(m)) throw new Error(`${i.sku}: tubo ${t} ou mangueira ${m} fora da lista`);
      return { idItem: String(i.id_item), atributos: { [idTubo]: tubos.get(t), [idMang]: mangs.get(m) } };
    }) } } as any, res);
    Object.assign(pool as any, original);
    if (status >= 400) throw new Error(dados?.error);
    const depois = await q(`SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE familia_id = ?`, [idFamilia]);
    for (const d of depois) {
      const antes = itens.find(i => i.id_item === d.id_item);
      if (d.sku_customizado !== antes.sku) throw new Error(`SKU mudaria: ${antes.sku} → ${d.sku_customizado}`);
      console.log(`${d.sku_customizado} · ${d.nome_comercial}`);
    }
    if (modo === 'aplicar') {
      const destino = path.resolve(__dirname, '../../../backups', `salva-vida-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(destino, JSON.stringify({ idFamilia, idTubo, itens }, null, 1));
      await conn.commit();
      console.log(`GRAVADO. Backup: ${destino}`);
    } else { await conn.rollback(); console.log('SIMULAÇÃO: nada foi gravado.'); }
  } catch (e) {
    Object.assign(pool as any, original);
    await conn.rollback();
    console.error(`ERRO: ${e instanceof Error ? e.message : e}. Nada foi gravado.`);
  } finally { conn.release(); process.exit(); }
})();

// Rolamentos GTOP-GBR que estavam na categoria Transmissão: entram na família do código (Rígidos de esferas),
// com vedação, folga e linha preenchidas; nome e SKU montados pela família. O "B" (sem embalagem) do 607 fica fora
// do SKU até a decisão sobre esse sufixo.   npx ts-node src/scripts/migracaoRolamentosSoltos.ts simular | aplicar
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';
import { medidasDoCodigo, montarNome, montarSku } from '../modulos/transmissao/rolamentos/rolamentos';

const PLANO = [
  { idItem: 50, familia: 237, codigo: '6005', vedacao: 'ZZ', valores: { 'Vedação': 'ZZ', 'Folga': 'Normal', 'Linha (1ª/2ª)': '2ª linha' } },
  { idItem: 49, familia: 246, codigo: '6200', vedacao: '2RS', valores: { 'Vedação': '2RS', 'Folga': 'Normal', 'Linha (1ª/2ª)': '2ª linha' } },
  { idItem: 47, familia: 247, codigo: '607', vedacao: '2RS', valores: { 'Vedação': '2RS', 'Folga': 'Normal', 'Linha (1ª/2ª)': '2ª linha' } },
];
(async () => {
  const modo = process.argv[2];
  const conn: any = await pool.getConnection();
  const original = { getConnection: pool.getConnection, execute: pool.execute, query: pool.query };
  const falsa = Object.create(conn);
  Object.assign(falsa, { beginTransaction: async () => undefined, commit: async () => undefined, rollback: async () => undefined, release: () => undefined });
  try {
    await conn.beginTransaction();
    const [antes] = await conn.query(`SELECT id_item, familia_id, categoria_id, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE id_item IN (50, 49, 47)`);
    (pool as any).getConnection = async () => falsa;
    for (const p of PLANO) {
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = 66 WHERE id_item = ?`, [p.familia, p.idItem]);
      let status = 200; let dados: any;
      const res: any = { status: (s: number) => { status = s; return res; }, json: (d: any) => { dados = d; return res; } };
      await formalizarItensFamilia({ params: { idFamilia: String(p.familia) }, body: { itens: [{ idItem: String(p.idItem), atributos: p.valores }] }, query: { tenant_id: 1 }, headers: {} } as any, res);
      if (status >= 400) throw new Error(`Item ${p.idItem}: ${dados?.error}`);
      // Nome e SKU do módulo de rolamentos (iguais aos irmãos: 6005-2RS/GTOPGBR · ROLAMENTO 6005-2RS | 25 mm x 47 mm x 12 mm | GTOP-GBR)
      const [[m]]: any = await conn.query(`SELECT mar.nome, mar.codigo FROM comercial_produtos_dados p JOIN comercial_marcas mar ON mar.id = p.id_marca WHERE p.id_item = ?`, [p.idItem]);
      const base = { codigo: p.codigo, vedacao: p.vedacao, folga: null, linha: 2 as const, marca: m ? { nome: m.nome, codigo: m.codigo } : null };
      const sku = montarSku(base);
      const nome = montarNome({ ...base, medidas: medidasDoCodigo('RIGIDO_ESFERAS', p.codigo, p.vedacao) });
      const [[dono]]: any = await conn.query(`SELECT id_item FROM comercial_produtos_dados WHERE sku_customizado = ? AND id_item <> ?`, [sku, p.idItem]);
      if (dono) throw new Error(`SKU ${sku} já é do item ${dono.id_item}`);
      await conn.query(`UPDATE comercial_produtos_dados SET sku_customizado = ?, nome_comercial = ? WHERE id_item = ?`, [sku, nome, p.idItem]);
    }
    Object.assign(pool as any, original);
    const [depois] = await conn.query(`SELECT id_item, familia_id, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE id_item IN (50, 49, 47)`);
    for (const d of depois as any[]) console.log(`${d.id_item} fam ${d.familia_id} · ${d.sku_customizado} · ${d.nome_comercial}`);
    if (modo === 'aplicar') {
      const destino = path.resolve(__dirname, '../../../backups', `rolamentos-soltos-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, JSON.stringify(antes, null, 1));
      await conn.commit();
      console.log(`GRAVADO. Backup: ${destino}`);
    } else { await conn.rollback(); console.log('SIMULAÇÃO: nada foi gravado.'); }
  } catch (e) {
    Object.assign(pool as any, original);
    await conn.rollback();
    console.error(`ERRO: ${e instanceof Error ? e.message : e}. Nada foi gravado.`);
  } finally { conn.release(); process.exit(); }
})();
